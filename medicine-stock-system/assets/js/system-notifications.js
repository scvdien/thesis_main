(() => {
  if (window.MSSSystemNotifications) return;

  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;
  const STORAGE_KEY = "mss_notifications_v2";
  const NOTIFICATION_RUNTIME_STORAGE_PREFIX = "mss_notification_runtime_state_v1";
  const POPUP_STATE_KEY = "mss_notification_popup_seen_v1";
  const DISMISSED_STATE_KEY = "mss_notification_dismissed_v1";
  const SOUND_PREF_KEY = "mss_notification_sound_enabled_v1";
  const INVENTORY_STORAGE = "mss_inventory_records_v1";
  const MOVEMENTS_STORAGE = "mss_inventory_movements_v1";
  const STATE_ENDPOINT = "state-api.php";
  const NOTIFICATION_OCCURRENCE_SEPARATOR = "::";
  const MAX_POPUPS = 3;
  const NOTIFICATION_SYNC_POLL_INTERVAL_MS = 10000;
  const AUTO_DISMISS_BY_PRIORITY = {
    critical: 12000,
    high: 8000,
    medium: 6000,
    low: 5000
  };
  const DEFAULT_NOTIFICATION_MESSAGE = "Review the medicine notification.";

  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
  const parseNotificationOccurrenceId = (value) => {
    const notificationId = text(value);
    if (!notificationId) return { alertKey: "", occurrenceIndex: 0 };

    const separatorIndex = notificationId.lastIndexOf(NOTIFICATION_OCCURRENCE_SEPARATOR);
    if (separatorIndex <= 0) {
      return {
        alertKey: notificationId,
        occurrenceIndex: 0
      };
    }

    const alertKey = text(notificationId.slice(0, separatorIndex));
    const occurrenceIndex = Number.parseInt(notificationId.slice(separatorIndex + NOTIFICATION_OCCURRENCE_SEPARATOR.length), 10);
    if (!alertKey || !Number.isInteger(occurrenceIndex) || occurrenceIndex < 1) {
      return {
        alertKey: notificationId,
        occurrenceIndex: 0
      };
    }

    return {
      alertKey,
      occurrenceIndex
    };
  };
  const composeNotificationOccurrenceId = (alertKey, occurrenceIndex = 0) => {
    const normalizedAlertKey = text(alertKey);
    if (!normalizedAlertKey) return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return occurrenceIndex > 0
      ? `${normalizedAlertKey}${NOTIFICATION_OCCURRENCE_SEPARATOR}${occurrenceIndex}`
      : normalizedAlertKey;
  };
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const nowIso = () => new Date().toISOString();
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatChange = (value) => `${numeric(value) >= 0 ? "+" : ""}${numeric(value).toFixed(1)}%`;
  const formatShortDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit"
    }).format(parsed);
  };
  const formatRelativeTime = (value) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "Just now";
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };
  const daysUntil = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / 86400000);
  };
  const pluralize = (value, singular, plural = `${singular}s`) => `${formatNumber(value)} ${value === 1 ? singular : plural}`;
  const quantityLabel = (value, unit) => `${formatNumber(value)} ${text(unit) || "units"}`;
  let notificationHydrationPromise = null;
  let notificationPersistQueue = Promise.resolve();
  let lastQueuedNotificationPersistId = 0;
  let syncNotificationsPromise = null;
  let syncNotificationsQueued = false;
  let queuedSyncOptions = {
    showToasts: false
  };
  const cloneEntry = (entry) => (entry && typeof entry === "object" && !Array.isArray(entry) ? { ...entry } : entry);
  const cloneEntries = (entries = []) => Array.isArray(entries) ? entries.map(cloneEntry) : [];
  const state = {
    inventory: [],
    movements: [],
    notifications: [],
    monitoringSnapshot: null,
    notificationPreferences: {
      soundEnabled: true
    },
    notificationPopupState: {},
    notificationDismissedState: {},
    notificationReadState: {},
    notificationResolvedState: {}
  };

  const readList = (key) => {
    if (key === STORAGE_KEY) return cloneEntries(state.notifications);
    if (key === INVENTORY_STORAGE) return cloneEntries(state.inventory);
    if (key === MOVEMENTS_STORAGE) return cloneEntries(state.movements);
    return [];
  };

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      const message = String(payload.message || "Unable to sync system notifications right now.");
      throw new Error(message);
    }
    return payload;
  };

  const readMap = (key) => {
    if (key === POPUP_STATE_KEY) return { ...state.notificationPopupState };
    if (key === DISMISSED_STATE_KEY) return { ...state.notificationDismissedState };
    return {};
  };

  const writeMap = (key, value) => {
    if (key === POPUP_STATE_KEY) {
      state.notificationPopupState = value && typeof value === "object" && !Array.isArray(value)
        ? { ...value }
        : {};
      syncNotificationRuntimeCache({
        notificationPopupState: state.notificationPopupState,
        notificationDismissedState: state.notificationDismissedState,
        notificationReadState: state.notificationReadState,
        notificationResolvedState: state.notificationResolvedState
      });
      return;
    }

    if (key === DISMISSED_STATE_KEY) {
      state.notificationDismissedState = value && typeof value === "object" && !Array.isArray(value)
        ? { ...value }
        : {};
      syncNotificationRuntimeCache({
        notificationPopupState: state.notificationPopupState,
        notificationDismissedState: state.notificationDismissedState,
        notificationReadState: state.notificationReadState,
        notificationResolvedState: state.notificationResolvedState
      });
    }
  };
  const readSoundEnabled = () => state.notificationPreferences.soundEnabled !== false;
  const saveSoundEnabled = (enabled) => {
    state.notificationPreferences = {
      ...state.notificationPreferences,
      soundEnabled: enabled !== false
    };
    void persistNotificationPreferencesToServer({ keepalive: true });
  };

  const fallbackMedicineId = (entry = {}, index = 0) => {
    const identity = [
      keyOf(text(entry.name || entry.medicineName)).replace(/[^a-z0-9]+/g, "_"),
      keyOf(text(entry.strength)).replace(/[^a-z0-9]+/g, "_"),
      keyOf(text(entry.unit)).replace(/[^a-z0-9]+/g, "_")
    ].filter(Boolean).join("_").replace(/^_+|_+$/g, "");
    return identity ? `medicine_${identity}` : `medicine_${index + 1}`;
  };

  const normalizeMedicine = (entry = {}, index = 0) => ({
    id: text(entry.id) || fallbackMedicineId(entry, index),
    name: text(entry.name) || "Medicine",
    strength: text(entry.strength),
    stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
    reorderLevel: Math.max(1, Math.round(numeric(entry.reorderLevel) || 1)),
    unit: text(entry.unit) || "units",
    expiryDate: text(entry.expiryDate),
    recordStatus: text(entry.recordStatus || entry.record_status).toLowerCase() === "archived" ? "archived" : "active",
    updatedAt: text(entry.lastUpdatedAt) || nowIso()
  });

  const normalizeMovement = (entry = {}) => ({
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName),
    actionType: keyOf(entry.actionType) || "adjusted",
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    diseaseCategory: text(entry.diseaseCategory || entry.disease_category),
    illness: text(entry.illness),
    createdAt: text(entry.createdAt) || nowIso()
  });

  const fallbackInventory = [
    { id: "fallback_paracetamol", name: "Paracetamol", strength: "500mg", stockOnHand: 540, reorderLevel: 220, unit: "tablets", expiryDate: "2026-09-14" },
    { id: "fallback_amoxicillin", name: "Amoxicillin", strength: "500mg", stockOnHand: 95, reorderLevel: 160, unit: "capsules", expiryDate: "2026-05-22" },
    { id: "fallback_ors", name: "ORS", strength: "20.5g", stockOnHand: 62, reorderLevel: 120, unit: "sachets", expiryDate: "2026-04-30" },
    { id: "fallback_lagundi", name: "Lagundi", strength: "60mL", stockOnHand: 28, reorderLevel: 40, unit: "bottles", expiryDate: "2026-04-16" },
    { id: "fallback_zinc", name: "Zinc Sulfate", strength: "20mg", stockOnHand: 0, reorderLevel: 90, unit: "tablets", expiryDate: "2026-07-20" }
  ].map(normalizeMedicine);

  const fallbackMovements = [
    { medicineId: "fallback_ors", medicineName: "ORS", actionType: "dispense", quantity: 18, diseaseCategory: "Diarrhea", illness: "Acute diarrhea", createdAt: new Date(Date.now() - (5 * 3600000)).toISOString() },
    { medicineId: "fallback_lagundi", medicineName: "Lagundi", actionType: "dispense", quantity: 6, diseaseCategory: "Cough / Cold", illness: "Cough and colds", createdAt: new Date(Date.now() - (9 * 3600000)).toISOString() },
    { medicineId: "fallback_amoxicillin", medicineName: "Amoxicillin", actionType: "dispense", quantity: 32, diseaseCategory: "Cough / Cold", illness: "Upper respiratory infection", createdAt: new Date(Date.now() - (30 * 3600000)).toISOString() }
  ].map(normalizeMovement);

  const isActiveMedicine = (medicine) => text(medicine?.recordStatus).toLowerCase() !== "archived";

  const readInventory = () => {
    const records = readList(INVENTORY_STORAGE)
      .map((entry, index) => normalizeMedicine(entry, index))
      .filter((entry) => text(entry.name));
    const activeRecords = records.filter(isActiveMedicine);
    return activeRecords.length ? activeRecords : records;
  };

  const readMovements = () => {
    const records = readList(MOVEMENTS_STORAGE)
      .map(normalizeMovement)
      .filter((entry) => text(entry.medicineId) || text(entry.medicineName));
    return records;
  };

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;
  const medicineIcon = (medicine = {}) => {
    const label = keyOf(text(medicine.name) || text(medicine.medicineName));
    if (label.includes("ors")) return "bi bi-droplet-half";
    if (label.includes("lagundi") || label.includes("syrup")) return "bi bi-capsule-pill";
    return "bi bi-capsule";
  };
  const buildUsageMap = (movements, windowDays = 30) => {
    const cutoff = Date.now() - (windowDays * 86400000);
    const usageMap = new Map();

    movements.forEach((movement) => {
      if (movement.actionType !== "dispense") return;
      const createdAt = new Date(movement.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt < cutoff) return;

      const keys = [text(movement.medicineId), keyOf(movement.medicineName)].filter(Boolean);
      keys.forEach((key) => {
        const entry = usageMap.get(key) || { quantity: 0, count: 0 };
        entry.quantity += movement.quantity;
        entry.count += 1;
        usageMap.set(key, entry);
      });
    });

    return usageMap;
  };
  const usageForMedicine = (usageMap, medicine) => {
    const direct = usageMap.get(text(medicine.id));
    if (direct) return direct;
    return usageMap.get(keyOf(medicine.name)) || { quantity: 0, count: 0 };
  };
  const illnessSignalWindowDays = 30;
  const illnessSignalMinimumShare = 0.18;
  const illnessSignalMinimumContribution = 0.16;
  const illnessSignalMinimumScore = 0.75;
  const resolveDiseaseLabel = (movement = {}) => {
    const category = text(movement.diseaseCategory);
    const illness = text(movement.illness);
    if (category && keyOf(category) !== "others") return category;
    return illness || category || "Unspecified";
  };
  const medicineSignalKey = (movement = {}) => {
    const medicineId = text(movement.medicineId);
    if (medicineId) return `id:${medicineId}`;
    const medicineName = keyOf(movement.medicineName);
    return medicineName ? `name:${medicineName}` : "";
  };
  const prepareDispenseDiseaseRows = (movements = []) => movements
    .filter((movement) => keyOf(movement.actionType) === "dispense")
    .map((movement) => ({
      medicineKey: medicineSignalKey(movement),
      medicineName: text(movement.medicineName) || "Unknown medicine",
      quantity: Math.max(0, Math.round(numeric(movement.quantity))),
      label: resolveDiseaseLabel(movement),
      createdAt: text(movement.createdAt) || nowIso(),
      createdTimestamp: new Date(text(movement.createdAt) || nowIso()).getTime()
    }))
    .filter((row) => row.medicineKey && Number.isFinite(row.createdTimestamp));
  const buildDiseaseAssociationMap = (trainingRows = [], baselineFactor = 1) => {
    const associationMap = new Map();

    trainingRows.forEach((row) => {
      const label = text(row.label);
      const medicineKey = text(row.medicineKey);
      if (!medicineKey || !label || label === "Unspecified") return;

      const current = associationMap.get(medicineKey) || {
        medicine: text(row.medicineName) || "Unknown medicine",
        requests: 0,
        quantity: 0,
        patterns: new Map()
      };
      current.requests += 1;
      current.quantity += Math.max(0, Math.round(numeric(row.quantity)));

      const pattern = current.patterns.get(label) || {
        illness: label,
        requests: 0,
        quantity: 0
      };
      pattern.requests += 1;
      pattern.quantity += Math.max(0, Math.round(numeric(row.quantity)));
      current.patterns.set(label, pattern);
      associationMap.set(medicineKey, current);
    });

    associationMap.forEach((entry, medicineKey) => {
      const patternRows = Array.from(entry.patterns.values())
        .sort((left, right) => right.requests - left.requests || right.quantity - left.quantity || left.illness.localeCompare(right.illness))
        .map((pattern) => ({
          ...pattern,
          share: entry.requests > 0 ? pattern.requests / entry.requests : 0
        }));

      if (!patternRows.length) {
        associationMap.delete(medicineKey);
        return;
      }

      const dominantRequests = Math.max(1, Math.round(numeric(patternRows[0]?.requests)));
      const dominantShare = dominantRequests / Math.max(1, entry.requests);
      const supportDepth = Math.min(1, entry.requests / 6);
      const reliability = Math.max(0.12, Math.min(1, baselineFactor * ((supportDepth * 0.65) + (dominantShare * 0.35))));

      associationMap.set(medicineKey, {
        ...entry,
        patterns: patternRows,
        dominantIllness: text(patternRows[0]?.illness) || "Unspecified",
        dominantShare,
        reliability
      });
    });

    return associationMap;
  };
  const scoreDiseaseWindow = (windowRows = [], associationMap = new Map()) => {
    const signalMap = new Map();
    const medicineMap = new Map();
    let matchedRequests = 0;
    let windowTotalScore = 0;

    windowRows.forEach((row) => {
      const medicineKey = text(row.medicineKey);
      const association = associationMap.get(medicineKey);
      if (!medicineKey || !association) return;

      const medicineName = text(row.medicineName) || "Unknown medicine";
      const quantity = Math.max(1, Math.round(numeric(row.quantity) || 1));
      const eventImpact = 1 + Math.min(1.5, quantity / 10);
      matchedRequests += 1;

      const currentMedicine = medicineMap.get(medicineName) || {
        medicine: medicineName,
        requests: 0,
        quantity: 0,
        mappedIllness: text(association.dominantIllness) || "Unspecified",
        confidence: 0
      };
      currentMedicine.requests += 1;
      currentMedicine.quantity += quantity;
      currentMedicine.confidence = Math.max(
        currentMedicine.confidence,
        Math.round((((numeric(association.dominantShare) * 0.55) + (numeric(association.reliability) * 0.45)) * 100))
      );
      medicineMap.set(medicineName, currentMedicine);

      (Array.isArray(association.patterns) ? association.patterns : []).forEach((pattern) => {
        const illness = text(pattern.illness);
        const share = numeric(pattern.share);
        if (!illness || share < illnessSignalMinimumShare) return;

        const contribution = share * numeric(association.reliability) * eventImpact;
        if (contribution < illnessSignalMinimumContribution) return;

        const currentSignal = signalMap.get(illness) || {
          illness,
          score: 0,
          weightedQuantity: 0,
          matchedRequests: 0,
          associationShareTotal: 0,
          associationReliabilityTotal: 0,
          supportingMedicines: new Map(),
          latestAt: "",
          latestTimestamp: 0
        };

        currentSignal.score += contribution;
        currentSignal.weightedQuantity += quantity * share;
        currentSignal.matchedRequests += 1;
        currentSignal.associationShareTotal += share;
        currentSignal.associationReliabilityTotal += numeric(association.reliability);
        currentSignal.supportingMedicines.set(medicineName, (currentSignal.supportingMedicines.get(medicineName) || 0) + contribution);
        if (numeric(row.createdTimestamp) > numeric(currentSignal.latestTimestamp)) {
          currentSignal.latestTimestamp = numeric(row.createdTimestamp);
          currentSignal.latestAt = text(row.createdAt);
        }

        signalMap.set(illness, currentSignal);
        windowTotalScore += contribution;
      });
    });

    const signals = Array.from(signalMap.values())
      .filter((entry) => numeric(entry.score) >= illnessSignalMinimumScore)
      .map((entry) => {
        const supportingMedicines = Array.from(entry.supportingMedicines.entries())
          .map(([medicine, score]) => ({ medicine, score: Number(numeric(score).toFixed(2)) }))
          .sort((left, right) => numeric(right.score) - numeric(left.score));
        const matchedCount = Math.max(1, Math.round(numeric(entry.matchedRequests)));
        const supportBreadth = Math.min(1, supportingMedicines.length / 3);
        const scoreShare = windowTotalScore > 0 ? numeric(entry.score) / windowTotalScore : 0;
        const averageShare = numeric(entry.associationShareTotal) / matchedCount;
        const averageReliability = numeric(entry.associationReliabilityTotal) / matchedCount;
        const confidenceRatio = Math.min(0.96, Math.max(0.18, (scoreShare * 0.35) + (averageShare * 0.25) + (averageReliability * 0.25) + (supportBreadth * 0.15)));
        const supportSummary = supportingMedicines.length <= 2
          ? supportingMedicines.map((item) => item.medicine).join(", ")
          : `${supportingMedicines.slice(0, 2).map((item) => item.medicine).join(", ")} +${supportingMedicines.length - 2} more`;

        return {
          illness: entry.illness,
          requests: Math.max(1, Math.round(numeric(entry.score))),
          mappedRequests: Number(numeric(entry.score).toFixed(2)),
          quantity: Math.round(numeric(entry.weightedQuantity)),
          confidence: Math.round(confidenceRatio * 100),
          supportingMedicines: supportingMedicines.slice(0, 3),
          supportingMedicineSummary: supportSummary || "No strong medicine signal yet",
          matchedRequests: Math.round(numeric(entry.matchedRequests)),
          latestAt: text(entry.latestAt),
          basis: "inferred",
          basisLabel: "Mapped from medicine frequency"
        };
      })
      .sort((left, right) => numeric(right.mappedRequests) - numeric(left.mappedRequests) || numeric(right.confidence) - numeric(left.confidence) || left.illness.localeCompare(right.illness));

    const medicines = Array.from(medicineMap.values())
      .sort((left, right) => numeric(right.requests) - numeric(left.requests) || numeric(right.quantity) - numeric(left.quantity) || numeric(right.confidence) - numeric(left.confidence) || left.medicine.localeCompare(right.medicine));

    return {
      signals,
      medicines,
      matchedRequests,
      windowTotalScore: Number(windowTotalScore.toFixed(2))
    };
  };
  const buildIllnessSignalSnapshot = (movements = []) => {
    const dispenseRows = prepareDispenseDiseaseRows(movements);
    const labeledRows = dispenseRows.filter((row) => {
      const label = text(row.label);
      return label && label !== "Unspecified";
    });
    const now = Date.now();
    const recentCutoff = now - (illnessSignalWindowDays * 86400000);
    const previousCutoff = now - ((illnessSignalWindowDays * 2) * 86400000);

    let trainingRows = labeledRows.filter((row) => numeric(row.createdTimestamp) > 0 && numeric(row.createdTimestamp) < previousCutoff);
    let baselineFactor = 1;
    if (trainingRows.length < 8) {
      trainingRows = labeledRows.filter((row) => numeric(row.createdTimestamp) > 0 && numeric(row.createdTimestamp) < recentCutoff);
      baselineFactor = 0.9;
    }
    const trainingPatterns = new Set(trainingRows.map((row) => keyOf(row.label)).filter(Boolean));
    if (trainingRows.length < 6 || trainingPatterns.size < 2) {
      trainingRows = [...labeledRows];
      baselineFactor = 0.75;
    }

    const associationMap = buildDiseaseAssociationMap(trainingRows, baselineFactor);
    const recentRows = dispenseRows.filter((row) => numeric(row.createdTimestamp) >= recentCutoff);
    const previousRows = dispenseRows.filter((row) => numeric(row.createdTimestamp) >= previousCutoff && numeric(row.createdTimestamp) < recentCutoff);
    const recentSignals = associationMap.size ? scoreDiseaseWindow(recentRows, associationMap) : { signals: [], medicines: [], matchedRequests: 0, windowTotalScore: 0 };
    const previousSignals = associationMap.size ? scoreDiseaseWindow(previousRows, associationMap) : { signals: [], medicines: [], matchedRequests: 0, windowTotalScore: 0 };
    const previousSignalMap = new Map((previousSignals.signals || []).map((signal) => [keyOf(signal.illness), signal]));

    return {
      signals: (recentSignals.signals || []).map((signal) => {
        const previous = previousSignalMap.get(keyOf(signal.illness));
        const previousScore = numeric(previous?.mappedRequests);
        const currentScore = numeric(signal.mappedRequests);
        const growthPercent = previousScore > 0 ? ((currentScore - previousScore) / previousScore) * 100 : (currentScore > 0 ? 100 : 0);
        const trend = previousScore <= 0
          ? "new"
          : growthPercent >= 12
            ? "rising"
            : growthPercent <= -12
              ? "easing"
              : "steady";
        return {
          ...signal,
          growthPercent: Number(growthPercent.toFixed(1)),
          trend,
          trendLabel: trend === "rising"
            ? "Rising vs previous 30 days"
            : trend === "easing"
              ? "Lower vs previous 30 days"
              : trend === "new"
                ? "New signal this month"
                : "Steady vs previous 30 days"
        };
      }),
      medicines: recentSignals.medicines || []
    };
  };
  const analyticsDemandWindowDays = 14;
  const projectedCoverDays = (stockOnHand, recentQuantity, windowDays = analyticsDemandWindowDays) => {
    const safeStock = Math.max(0, numeric(stockOnHand));
    const safeQuantity = Math.max(0, numeric(recentQuantity));
    if (safeStock <= 0) return 0;
    if (safeQuantity <= 0 || windowDays <= 0) return Number.POSITIVE_INFINITY;
    return safeStock / (safeQuantity / windowDays);
  };
  const buildStatusAnalyticsNotification = ({ medicineKey, label, stock, reorderLevel, unit, recentQuantity }) => {
    const safeStock = Math.max(0, numeric(stock));
    const safeReorderLevel = Math.max(1, Math.round(numeric(reorderLevel) || 1));
    const safeRecentQuantity = Math.max(0, Math.round(numeric(recentQuantity)));
    const coverDays = projectedCoverDays(safeStock, safeRecentQuantity);
    const roundedCoverDays = Number.isFinite(coverDays) ? Math.max(1, Math.ceil(coverDays)) : 0;

    if (safeStock <= 0) {
      return {
        id: `status-${medicineKey}`,
        category: "Medicine Status",
        priority: safeRecentQuantity >= Math.max(20, Math.round(safeReorderLevel * 0.35)) ? "critical" : "high",
        title: `${label} is out of stock`,
        body: safeRecentQuantity > 0
          ? `${quantityLabel(safeRecentQuantity, unit)} released in the last ${analyticsDemandWindowDays} days. Remaining stock can no longer cover current demand.`
          : `Current stock is 0 ${unit}. Review expected demand and replenish immediately.`,
        source: "Data Analytics",
        recommendation: safeRecentQuantity > 0
          ? "Prioritize replenishment because recent release activity shows active demand."
          : "Restock and verify expected patient demand before the next release cycle."
      };
    }

    if (safeRecentQuantity > 0 && coverDays <= 30) {
      return {
        id: `status-${medicineKey}`,
        category: "Medicine Status",
        priority: coverDays <= 7 ? "critical" : coverDays <= 14 ? "high" : "medium",
        title: `${label} is low in stock`,
        body: `${quantityLabel(safeRecentQuantity, unit)} released in the last ${analyticsDemandWindowDays} days. Remaining stock may last about ${pluralize(roundedCoverDays, "day")} at the current demand rate.`,
        source: "Data Analytics",
        recommendation: coverDays <= 14
          ? "Prepare replenishment now to avoid stockout under the current demand trend."
          : "Review reorder timing because current stock cover is below one month."
      };
    }

    if (safeStock <= safeReorderLevel) {
      return {
        id: `status-${medicineKey}`,
        category: "Medicine Status",
        priority: safeStock <= Math.max(5, Math.round(safeReorderLevel * 0.5)) ? "high" : "medium",
        title: `${label} is low in stock`,
        body: `${quantityLabel(safeStock, unit)} remaining, below the safety stock level. No recent dispense was recorded in the last ${analyticsDemandWindowDays} days, so monitor upcoming demand.`,
        source: "Stock Balance Analytics",
        recommendation: "Review whether this medicine should be replenished now or monitored based on expected demand."
      };
    }

    return null;
  };

  const normalizeNotification = (entry = {}) => {
    const category = text(entry.category) || "Medicine Status";
    const priority = ["critical", "high", "medium", "low"].includes(keyOf(entry.priority)) ? keyOf(entry.priority) : "medium";
    const title = text(entry.title) || "Medicine alert";
    const body = text(entry.body) || DEFAULT_NOTIFICATION_MESSAGE;
    const notificationId = text(entry.id) || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const parsedOccurrence = parseNotificationOccurrenceId(notificationId);
    const occurrenceCandidate = Number.parseInt(text(entry.occurrenceIndex || entry.occurrence_index), 10);
    const occurrenceIndex = Number.isInteger(occurrenceCandidate) && occurrenceCandidate > 0
      ? occurrenceCandidate
      : parsedOccurrence.occurrenceIndex;
    const alertKey = text(entry.alertKey || entry.alert_key) || parsedOccurrence.alertKey || notificationId;

    return {
      id: notificationId,
      alertKey,
      occurrenceIndex,
      category,
      priority,
      title,
      body,
      source: text(entry.source) || "Inventory Analytics",
      recommendation: text(entry.recommendation) || DEFAULT_NOTIFICATION_MESSAGE,
      signature: [category, priority, title].join("|"),
      createdAt: text(entry.createdAt) || nowIso(),
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      read: Boolean(entry.read),
      resolved: Boolean(entry.resolved),
      resolvedAt: text(entry.resolvedAt || entry.resolved_at)
    };
  };

  const matchesNotificationSignature = (notification, signature) => {
    const normalized = normalizeNotification(notification);
    const candidate = text(signature);
    if (!candidate) return false;

    const legacySignature = [normalized.category, normalized.priority, normalized.title, normalized.body].join("|");
    return candidate === normalized.signature || candidate === legacySignature;
  };

  const matchesNotificationReadState = (notification, value) => {
    const normalized = normalizeNotification(notification);
    const candidate = text(value);
    if (!candidate) return false;

    return candidate === normalized.id || matchesNotificationSignature(normalized, candidate);
  };

  const hasActionableRecommendation = (notification) => {
    const recommendation = text(notification?.recommendation);
    return Boolean(recommendation) && recommendation !== DEFAULT_NOTIFICATION_MESSAGE;
  };

  const toastMessageText = (notification) => {
    const baseBody = text(notification?.body) || DEFAULT_NOTIFICATION_MESSAGE;
    if (!hasActionableRecommendation(notification)) return baseBody;

    const recommendation = text(notification?.recommendation);
    if (!recommendation || recommendation === baseBody) return baseBody;
    return `${baseBody} Recommendation: ${recommendation}`;
  };

  const normalizeNotificationPreferences = (entry = {}) => ({
    soundEnabled: entry?.soundEnabled !== false
  });

  const normalizePopupState = (entry = {}) => {
    const popupState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const normalizedKey = text(key);
      const signature = text(value);
      if (!normalizedKey || !signature) return;
      popupState[normalizedKey] = signature;
    });
    return popupState;
  };

  const normalizeDismissedState = (entry = {}) => {
    const dismissedState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const normalizedKey = text(key);
      const signature = text(value);
      if (!normalizedKey || !signature) return;
      dismissedState[normalizedKey] = signature;
    });
    return dismissedState;
  };

  const normalizeReadState = (entry = {}) => {
    const readState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const normalizedKey = text(key);
      const signature = text(value);
      if (!normalizedKey || !signature) return;
      readState[normalizedKey] = signature;
    });
    return readState;
  };

  const normalizeResolvedState = (entry = {}) => {
    const resolvedState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const normalizedKey = text(key);
      const resolvedEntry = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const signature = text(resolvedEntry.signature ?? value);
      if (!normalizedKey || !signature) return;
      resolvedState[normalizedKey] = {
        signature,
        resolvedAt: text(resolvedEntry.resolvedAt ?? resolvedEntry.resolved_at) || nowIso(),
        read: resolvedEntry.read === true || resolvedEntry.isRead === true || resolvedEntry.is_read === true
      };
    });
    return resolvedState;
  };

  const mergeReadStates = (...entries) => {
    const nextReadState = {};
    entries.forEach((entry) => {
      Object.entries(normalizeReadState(entry)).forEach(([notificationId, value]) => {
        nextReadState[notificationId] = value;
      });
    });
    return nextReadState;
  };

  const resolvedStateTimestamp = (value) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };

  const mergeResolvedStateEntry = (currentEntry = {}, incomingEntry = {}) => {
    const current = currentEntry && typeof currentEntry === "object" && !Array.isArray(currentEntry) ? currentEntry : {};
    const incoming = incomingEntry && typeof incomingEntry === "object" && !Array.isArray(incomingEntry) ? incomingEntry : {};
    const currentResolvedAt = text(current.resolvedAt ?? current.resolved_at);
    const incomingResolvedAt = text(incoming.resolvedAt ?? incoming.resolved_at);
    const useIncoming = resolvedStateTimestamp(incomingResolvedAt) >= resolvedStateTimestamp(currentResolvedAt);
    const preferredEntry = useIncoming ? incoming : current;
    const fallbackEntry = useIncoming ? current : incoming;

    return {
      signature: text(preferredEntry.signature) || text(fallbackEntry.signature),
      resolvedAt: text(preferredEntry.resolvedAt ?? preferredEntry.resolved_at)
        || text(fallbackEntry.resolvedAt ?? fallbackEntry.resolved_at)
        || nowIso(),
      read: Boolean(
        current.read === true
        || current.isRead === true
        || current.is_read === true
        || incoming.read === true
        || incoming.isRead === true
        || incoming.is_read === true
      )
    };
  };

  const mergeResolvedStates = (...entries) => {
    const nextResolvedState = {};
    entries.forEach((entry) => {
      Object.entries(normalizeResolvedState(entry)).forEach(([notificationId, resolvedEntry]) => {
        nextResolvedState[notificationId] = mergeResolvedStateEntry(nextResolvedState[notificationId], resolvedEntry);
      });
    });
    return nextResolvedState;
  };

  const notificationRuntimeStorageKey = () => {
    const identity = keyOf(
      currentAuthUser?.id
      || currentAuthUser?.userId
      || currentAuthUser?.username
      || currentAuthUser?.role
      || "shared"
    ) || "shared";
    return `${NOTIFICATION_RUNTIME_STORAGE_PREFIX}:${identity}`;
  };

  const readNotificationRuntimeCache = () => {
    try {
      const raw = window.localStorage.getItem(notificationRuntimeStorageKey());
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  };

  const syncNotificationRuntimeCache = (nextState = {}) => {
    const cached = readNotificationRuntimeCache();
    const payload = {
      ...cached
    };

    if (nextState.notificationPopupState && typeof nextState.notificationPopupState === "object" && !Array.isArray(nextState.notificationPopupState)) {
      payload.notificationPopupState = normalizePopupState(nextState.notificationPopupState);
    }
    if (nextState.notificationDismissedState && typeof nextState.notificationDismissedState === "object" && !Array.isArray(nextState.notificationDismissedState)) {
      payload.notificationDismissedState = normalizeDismissedState(nextState.notificationDismissedState);
    }
    if (nextState.notificationReadState && typeof nextState.notificationReadState === "object" && !Array.isArray(nextState.notificationReadState)) {
      payload.notificationReadState = normalizeReadState(nextState.notificationReadState);
    }
    if (nextState.notificationResolvedState && typeof nextState.notificationResolvedState === "object" && !Array.isArray(nextState.notificationResolvedState)) {
      payload.notificationResolvedState = normalizeResolvedState(nextState.notificationResolvedState);
    }

    try {
      window.localStorage.setItem(notificationRuntimeStorageKey(), JSON.stringify(payload));
    } catch (error) {
      // Ignore storage write failures and continue with in-memory state.
    }
  };

  const hydrateNotificationRuntimeCache = () => {
    const cached = readNotificationRuntimeCache();

    if (cached.notificationPopupState && typeof cached.notificationPopupState === "object" && !Array.isArray(cached.notificationPopupState)) {
      state.notificationPopupState = normalizePopupState(cached.notificationPopupState);
    }
    if (cached.notificationDismissedState && typeof cached.notificationDismissedState === "object" && !Array.isArray(cached.notificationDismissedState)) {
      state.notificationDismissedState = normalizeDismissedState(cached.notificationDismissedState);
    }
    if (cached.notificationReadState && typeof cached.notificationReadState === "object" && !Array.isArray(cached.notificationReadState)) {
      state.notificationReadState = normalizeReadState(cached.notificationReadState);
    }
    if (cached.notificationResolvedState && typeof cached.notificationResolvedState === "object" && !Array.isArray(cached.notificationResolvedState)) {
      state.notificationResolvedState = normalizeResolvedState(cached.notificationResolvedState);
    }
  };

  const createNotificationPersistSnapshot = (nextState = {}) => {
    const snapshot = {};

    if (Array.isArray(nextState.notifications)) {
      snapshot.notifications = nextState.notifications.map((notification) => normalizeNotification(notification));
    }
    if (nextState.notificationPreferences && typeof nextState.notificationPreferences === "object" && !Array.isArray(nextState.notificationPreferences)) {
      snapshot.notificationPreferences = { ...nextState.notificationPreferences };
    }
    if (nextState.notificationPopupState && typeof nextState.notificationPopupState === "object" && !Array.isArray(nextState.notificationPopupState)) {
      snapshot.notificationPopupState = { ...nextState.notificationPopupState };
    }
    if (nextState.notificationDismissedState && typeof nextState.notificationDismissedState === "object" && !Array.isArray(nextState.notificationDismissedState)) {
      snapshot.notificationDismissedState = { ...nextState.notificationDismissedState };
    }
    if (nextState.notificationReadState && typeof nextState.notificationReadState === "object" && !Array.isArray(nextState.notificationReadState)) {
      snapshot.notificationReadState = normalizeReadState(nextState.notificationReadState);
    }
    if (nextState.notificationResolvedState && typeof nextState.notificationResolvedState === "object" && !Array.isArray(nextState.notificationResolvedState)) {
      snapshot.notificationResolvedState = normalizeResolvedState(nextState.notificationResolvedState);
    }

    return snapshot;
  };

  const mergeReadStateWithNotifications = (currentReadState = {}, notifications = []) => {
    const nextReadState = { ...currentReadState };
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (!normalized.resolved && normalized.id && normalized.signature && (
        normalized.read || matchesNotificationReadState(normalized, nextReadState[normalized.id])
      )) {
        nextReadState[normalized.id] = normalized.id;
      }
    });
    return nextReadState;
  };

  const applyReadStateToNotifications = (notifications = [], readState = {}) => (
    notifications.map((notification) => {
      const normalized = normalizeNotification(notification);
      normalized.read = normalized.resolved
        ? Boolean(normalized.read) || matchesNotificationReadState(normalized, readState[normalized.id])
        : matchesNotificationReadState(normalized, readState[normalized.id]);
      return normalized;
    })
  );

  const mergeResolvedStateWithNotifications = (currentResolvedState = {}, notifications = []) => {
    const nextResolvedState = normalizeResolvedState(currentResolvedState);
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (normalized.resolved && normalized.id && normalized.signature) {
        nextResolvedState[normalized.id] = mergeResolvedStateEntry(nextResolvedState[normalized.id], {
          signature: normalized.signature,
          resolvedAt: text(normalized.resolvedAt) || normalized.updatedAt || normalized.createdAt || nowIso(),
          read: Boolean(normalized.read)
        });
      }
    });
    return nextResolvedState;
  };

  const applyResolvedStateToNotifications = (notifications = [], resolvedState = {}) => (
    notifications.map((notification) => {
      const normalized = normalizeNotification(notification);
      const resolvedEntry = resolvedState[normalized.id];
      if (resolvedEntry && matchesNotificationSignature(normalized, resolvedEntry.signature)) {
        normalized.resolved = true;
        normalized.resolvedAt = text(resolvedEntry.resolvedAt) || normalized.updatedAt || normalized.createdAt || nowIso();
        normalized.read = Boolean(resolvedEntry.read) || normalized.read;
      } else {
        normalized.resolved = false;
        normalized.resolvedAt = "";
      }
      return normalized;
    })
  );

  const syncStateFromServer = (serverState = {}) => {
    const nextNotifications = Array.isArray(serverState.notifications)
      ? serverState.notifications.map(normalizeNotification)
      : state.notifications;
    if (Array.isArray(serverState.inventory)) {
      state.inventory = serverState.inventory.map((entry, index) => normalizeMedicine(entry, index));
    }
    if (Array.isArray(serverState.movements)) {
      state.movements = serverState.movements.map(normalizeMovement);
    }
    if (serverState.notificationPreferences && typeof serverState.notificationPreferences === "object") {
      state.notificationPreferences = normalizeNotificationPreferences(serverState.notificationPreferences);
    }
    if (serverState.notificationPopupState && typeof serverState.notificationPopupState === "object") {
      state.notificationPopupState = normalizePopupState(serverState.notificationPopupState);
    }
    if (serverState.notificationDismissedState && typeof serverState.notificationDismissedState === "object") {
      state.notificationDismissedState = normalizeDismissedState(serverState.notificationDismissedState);
    }
    const incomingResolvedState = serverState.notificationResolvedState && typeof serverState.notificationResolvedState === "object"
      ? normalizeResolvedState(serverState.notificationResolvedState)
      : {};
    state.notificationResolvedState = mergeResolvedStateWithNotifications(
      mergeResolvedStates(state.notificationResolvedState, incomingResolvedState),
      nextNotifications
    );
    const hydratedNotifications = applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState);
    const incomingReadState = serverState.notificationReadState && typeof serverState.notificationReadState === "object"
      ? normalizeReadState(serverState.notificationReadState)
      : {};
    state.notificationReadState = mergeReadStateWithNotifications(
      mergeReadStates(state.notificationReadState, incomingReadState),
      hydratedNotifications
    );
    state.notifications = applyReadStateToNotifications(hydratedNotifications, state.notificationReadState);
    syncNotificationRuntimeCache({
      notificationPopupState: state.notificationPopupState,
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    });
  };

  const persistStateToServer = (nextState, { keepalive = false } = {}) => {
    const requestId = ++lastQueuedNotificationPersistId;
    const snapshot = createNotificationPersistSnapshot(nextState);
    notificationPersistQueue = notificationPersistQueue
      .catch(() => null)
      .then(async () => {
        try {
          const payload = await requestJson(STATE_ENDPOINT, {
            method: "POST",
            keepalive,
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              state: snapshot
            })
          });
          if (requestId === lastQueuedNotificationPersistId) {
            syncStateFromServer(payload?.state || {});
          }
          return payload;
        } catch (error) {
          console.error("Unable to persist system notifications.", error);
          return null;
        }
      });
    return notificationPersistQueue;
  };

  const persistNotificationsToServer = async (notifications, options = {}) => (
    persistStateToServer({
      notifications,
      notificationPreferences: state.notificationPreferences,
      notificationPopupState: state.notificationPopupState,
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    }, options)
  );

  const persistNotificationPreferencesToServer = async (options = {}) => (
    persistStateToServer({
      notificationPreferences: state.notificationPreferences
    }, options)
  );

  const hydrateNotificationsFromServer = async () => {
    if (notificationHydrationPromise) {
      await notificationHydrationPromise;
      return;
    }

    notificationHydrationPromise = (async () => {
      try {
        const payload = await requestJson(`${STATE_ENDPOINT}?t=${Date.now()}`);
        syncStateFromServer(payload?.state || {});
        toastState.soundEnabled = readSoundEnabled();
        updateSoundToggle();
      } catch (error) {
        console.error("Unable to hydrate notifications from server.", error);
      }
    })();

    try {
      await notificationHydrationPromise;
    } finally {
      notificationHydrationPromise = null;
    }
  };

  const buildDerivedNotifications = (previous = []) => {
    const previousNotifications = previous.map((entry) => normalizeNotification(entry));
    const previousMap = new Map(previousNotifications.map((entry) => [entry.id, entry]));
    const previousActiveByAlertKey = new Map();
    const occurrenceIndexByAlertKey = new Map();
    previousNotifications.forEach((entry) => {
      const alertKey = text(entry.alertKey) || entry.id;
      occurrenceIndexByAlertKey.set(
        alertKey,
        Math.max(occurrenceIndexByAlertKey.get(alertKey) || 0, Number.isInteger(entry.occurrenceIndex) ? entry.occurrenceIndex : 0)
      );
      if (!entry.resolved && !previousActiveByAlertKey.has(alertKey)) {
        previousActiveByAlertKey.set(alertKey, entry);
      }
    });
    const inventory = readInventory();
    const movements = readMovements();
    const usageMap = buildUsageMap(movements, analyticsDemandWindowDays);

    const notifications = [];
    const activeIds = new Set();
    const nextResolvedState = normalizeResolvedState(state.notificationResolvedState);
    const nextReadState = { ...state.notificationReadState };
    const pushNotification = (raw) => {
      const baseNotification = normalizeNotification(raw);
      const alertKey = text(baseNotification.alertKey) || baseNotification.id;
      const previousEntry = previousActiveByAlertKey.get(alertKey) || null;
      const nextOccurrenceIndex = previousEntry
        ? previousEntry.occurrenceIndex
        : ((occurrenceIndexByAlertKey.get(alertKey) || 0) + 1);
      if (!previousEntry) {
        occurrenceIndexByAlertKey.set(alertKey, nextOccurrenceIndex);
      }

      const nextNotification = normalizeNotification({
        ...baseNotification,
        id: previousEntry ? previousEntry.id : composeNotificationOccurrenceId(alertKey, nextOccurrenceIndex),
        alertKey,
        occurrenceIndex: nextOccurrenceIndex
      });
      if (matchesNotificationSignature(nextNotification, state.notificationDismissedState[nextNotification.id])) {
        return;
      }
      delete nextResolvedState[nextNotification.id];
      activeIds.add(nextNotification.id);
      const preserveCreatedAt = Boolean(previousEntry) && text(previousEntry.signature) === text(nextNotification.signature);
      const preserveRead = matchesNotificationReadState(nextNotification, nextReadState[nextNotification.id])
        || (Boolean(previousEntry) && text(previousEntry.signature) === text(nextNotification.signature) && previousEntry.read && !previousEntry.resolved);

      notifications.push(normalizeNotification({
        ...nextNotification,
        createdAt: preserveCreatedAt && previousEntry ? previousEntry.createdAt : nextNotification.createdAt,
        updatedAt: nowIso(),
        read: preserveRead ? (previousEntry?.read || matchesNotificationReadState(nextNotification, nextReadState[nextNotification.id])) : false,
        resolved: false,
        resolvedAt: ""
      }));
    };

    inventory.forEach((medicine) => {
      const medicineKey = text(medicine.id);
      const label = medicineLabel(medicine);
      const stock = Math.max(0, numeric(medicine.stockOnHand));
      const reorderLevel = Math.max(1, numeric(medicine.reorderLevel));
      const unit = text(medicine.unit) || "units";
      const expiryDays = daysUntil(medicine.expiryDate);
      const demand = usageForMedicine(usageMap, medicine);
      const coverDays = projectedCoverDays(stock, demand.quantity);
      const statusNotification = buildStatusAnalyticsNotification({
        medicineKey,
        label,
        stock,
        reorderLevel,
        unit,
        recentQuantity: demand.quantity
      });

      if (statusNotification) {
        pushNotification(statusNotification);
      }

      if (demand.quantity >= Math.max(20, Math.round(reorderLevel * 0.35)) && coverDays > 30) {
        const usageCount = Math.max(1, Math.round(numeric(demand.count)));
        pushNotification({
          id: `trend-${medicineKey}`,
          category: "Medicine Status",
          priority: coverDays <= 45 ? "high" : "medium",
          title: `${label} shows high usage trend`,
          body: `${quantityLabel(demand.quantity, unit)} released in the last ${analyticsDemandWindowDays} days across ${pluralize(usageCount, "transaction")}. Current stock cover is about ${pluralize(Math.max(1, Math.ceil(coverDays)), "day")}.`,
          source: "Data Analytics",
          recommendation: "Monitor movement trends and consider early replenishment."
        });
      }

      if (expiryDays <= 90) {
        let priority = "medium";
        let title = `${label} is within the 3-month expiry watch`;
        let body = `Expires in ${pluralize(expiryDays, "day")}.`;
        let recommendation = "Prioritize this batch for release before new stock is opened.";

        if (expiryDays < 0) {
          priority = "critical";
          title = `${label} has expired`;
          body = `Expired ${pluralize(Math.abs(expiryDays), "day")} ago.`;
          recommendation = "Remove the remaining stock from circulation and record disposal.";
        } else if (expiryDays <= 30) {
          priority = "high";
          title = `${label} expires within 30 days`;
          body = `Expiry alert triggered ${pluralize(expiryDays, "day")} before expiration.`;
        }

        pushNotification({
          id: `expiry-${medicineKey}`,
          category: "Expiring Soon",
          priority,
          title,
          body,
          source: "Expiry Analytics",
          recommendation
        });
      }
    });

    const illnessSignalSnapshot = buildIllnessSignalSnapshot(movements);
    (illnessSignalSnapshot.signals || [])
      .filter((signal) => {
        const confidence = Math.max(0, Math.round(numeric(signal.confidence)));
        const mappedRequests = numeric(signal.mappedRequests);
        const trend = keyOf(signal.trend);
        return confidence >= 58 && mappedRequests >= 2.5 && (trend === "rising" || trend === "new" || confidence >= 78);
      })
      .slice(0, 2)
      .forEach((signal) => {
        const illnessKey = keyOf(signal.illness).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "signal";
        const confidence = Math.max(0, Math.round(numeric(signal.confidence)));
        const mappedRequests = Math.max(1, Math.round(numeric(signal.requests)));
        const trend = keyOf(signal.trend);
        const growthPercent = numeric(signal.growthPercent);
        const supportSummary = text(signal.supportingMedicineSummary) || "recently dispensed medicines";
        const priority = confidence >= 80 && (trend === "rising" || trend === "new") ? "high" : "medium";
        const title = trend === "new"
          ? `Possible ${text(signal.illness)} signal detected`
          : `${text(signal.illness)} signal is rising`;
        const body = trend === "new"
          ? `${formatNumber(mappedRequests)} mapped request${mappedRequests === 1 ? "" : "s"} were detected in the last ${illnessSignalWindowDays} days. Supporting medicines: ${supportSummary}. Confidence is ${formatNumber(confidence)}%.`
          : `${formatNumber(mappedRequests)} mapped request${mappedRequests === 1 ? "" : "s"} suggest a ${text(signal.illness)} trend in the last ${illnessSignalWindowDays} days, ${formatChange(growthPercent)} versus the previous window. Supporting medicines: ${supportSummary}.`;
        const recommendation = trend === "new"
          ? "Review recent patient complaints and verify if related medicines should be monitored more closely."
          : "Review recent patient complaints and prepare the commonly associated medicines if the trend continues.";

        pushNotification({
          id: `illness-signal-${illnessKey}`,
          category: "Disease Signal",
          priority,
          title,
          body,
          source: "Illness Analytics",
          recommendation
        });
      });

    previousMap.forEach((previousEntry, notificationId) => {
      if (activeIds.has(notificationId)) return;
      if (!notificationId || !text(previousEntry.signature)) return;

      const resolvedEntry = nextResolvedState[notificationId];
      const resolvedAt = matchesNotificationSignature(previousEntry, resolvedEntry?.signature)
        ? (text(resolvedEntry.resolvedAt) || text(previousEntry.resolvedAt) || previousEntry.updatedAt || nowIso())
        : nowIso();
      const resolvedWasRead = Boolean(
        resolvedEntry?.read
        || previousEntry.read
        || matchesNotificationReadState(previousEntry, nextReadState[notificationId])
      );

      nextResolvedState[notificationId] = {
        signature: previousEntry.signature,
        resolvedAt,
        read: resolvedWasRead
      };

      notifications.push(normalizeNotification({
        ...previousEntry,
        read: resolvedWasRead,
        resolved: true,
        resolvedAt,
        updatedAt: resolvedAt
      }));

      if (matchesNotificationReadState(previousEntry, nextReadState[notificationId])) {
        delete nextReadState[notificationId];
      }
    });

    Object.keys(nextResolvedState).forEach((notificationId) => {
      if (activeIds.has(notificationId)) {
        delete nextResolvedState[notificationId];
      }
    });

    const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
    notifications.sort((left, right) => {
      if (left.resolved !== right.resolved) return left.resolved ? 1 : -1;
      const priorityDelta = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
      if (priorityDelta) return priorityDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return {
      notifications,
      notificationResolvedState: nextResolvedState,
      notificationReadState: nextReadState
    };
  };
  const buildMonitoringSnapshot = (notifications) => {
    const activeNotifications = notifications.filter((notification) => !normalizeNotification(notification).resolved);
    const inventory = readInventory();
    const movements = readMovements();
    const usageMap = buildUsageMap(movements, 30);

    const inventoryRows = inventory.map((medicine) => {
      const usage = usageForMedicine(usageMap, medicine);
      const monthlyUsage = Math.max(0, Math.round(usage.quantity));
      const daysLeft = daysUntil(medicine.expiryDate);
      const monthsToExpire = Number.isFinite(daysLeft) ? daysLeft / 30 : Number.POSITIVE_INFINITY;
      const monthsToClear = monthlyUsage > 0 ? medicine.stockOnHand / monthlyUsage : Number.POSITIVE_INFINITY;
      const overstockThreshold = Math.max(
        Math.round(medicine.reorderLevel * 3),
        monthlyUsage > 0 ? Math.round(monthlyUsage * 4) : Math.round(medicine.reorderLevel * 4)
      );
      const isLow = medicine.stockOnHand <= medicine.reorderLevel;
      const isOverstock = !isLow && medicine.stockOnHand >= overstockThreshold;

      let consumptionLevel = "Moderate";
      let consumptionTone = "moderate";
      if (monthlyUsage >= 60) {
        consumptionLevel = "Fast";
        consumptionTone = "fast";
      } else if (monthlyUsage <= 15) {
        consumptionLevel = "Slow";
        consumptionTone = "slow";
      }

      let expiryTone = "watch";
      if (daysLeft < 0 || daysLeft <= 30) expiryTone = "danger";
      else if (daysLeft <= 60) expiryTone = "warning";

      let expiryStatus = "Healthy";
      const severityScore = monthsToClear - monthsToExpire;
      if (daysLeft < 0 || severityScore >= 0.4) expiryStatus = "High Risk";
      else if (daysLeft <= 90 || severityScore >= -0.2) expiryStatus = "Watch";

      return {
        id: medicine.id,
        name: medicineLabel(medicine),
        shortName: text(medicine.name) || medicineLabel(medicine),
        icon: medicineIcon(medicine),
        stock: Math.max(0, numeric(medicine.stockOnHand)),
        reorderLevel: Math.max(1, numeric(medicine.reorderLevel)),
        unit: text(medicine.unit) || "units",
        expiryDate: medicine.expiryDate,
        expiryLabel: formatShortDate(medicine.expiryDate),
        daysLeft,
        monthlyUsage,
        usageCount: usage.count,
        monthsToExpire,
        monthsToClear,
        severityScore,
        consumptionLevel,
        consumptionTone,
        expiryTone,
        expiryStatus,
        isLow,
        isOverstock,
        overstockThreshold
      };
    });

    const activeMovementItems = [...inventoryRows]
      .filter((item) => item.monthlyUsage > 0)
      .sort((left, right) => right.monthlyUsage - left.monthlyUsage || right.usageCount - left.usageCount || left.stock - right.stock);
    const fastMovement = activeMovementItems
      .slice(0, 4)
      .map((item) => ({
        ...item,
        movementLabel: "Fast Moving",
        movementHelper: "High stock turnover",
        movementTone: "fast"
      }));
    const fastMovementIds = new Set(fastMovement.map((item) => item.id));
    const slowMovement = [...inventoryRows]
      .filter((item) => !fastMovementIds.has(item.id))
      .sort((left, right) => {
        const leftHasUsage = left.monthlyUsage > 0 ? 1 : 0;
        const rightHasUsage = right.monthlyUsage > 0 ? 1 : 0;
        if (leftHasUsage !== rightHasUsage) return rightHasUsage - leftHasUsage;
        if (left.monthlyUsage !== right.monthlyUsage) return left.monthlyUsage - right.monthlyUsage;
        if (left.stock !== right.stock) return left.stock - right.stock;
        return text(left.shortName).localeCompare(text(right.shortName));
      })
      .slice(0, 4)
      .map((item) => ({
        ...item,
        movementLabel: item.monthlyUsage > 0 ? "Slow Moving" : "No Recent Dispense",
        movementHelper: item.monthlyUsage > 0 ? "Low stock turnover" : "No recorded dispense in the last 30 days",
        movementTone: "slow"
      }));

    const expiringMedicines = [...inventoryRows]
      .filter((item) => item.daysLeft <= 90)
      .sort((left, right) => left.daysLeft - right.daysLeft)
      .slice(0, 5);
    const withinThirtyDays = expiringMedicines.filter((item) => item.daysLeft <= 30).length;
    const slowConsumptionItems = [...inventoryRows]
      .sort((left, right) => left.monthlyUsage - right.monthlyUsage || left.daysLeft - right.daysLeft)
      .slice(0, 4);
    const riskItem = [...inventoryRows]
      .filter((item) => item.daysLeft <= 90 || item.expiryStatus !== "Healthy")
      .sort((left, right) => {
        if (right.severityScore !== left.severityScore) return right.severityScore - left.severityScore;
        return left.daysLeft - right.daysLeft;
      })[0] || null;

    const lowItems = inventoryRows.filter((item) => item.isLow);
    const overstockItems = inventoryRows.filter((item) => item.isOverstock);
    const balancedItems = inventoryRows.filter((item) => !item.isLow && !item.isOverstock);
    const focusItem = lowItems[0] || balancedItems[0] || overstockItems[0] || inventoryRows[0] || null;

    return {
      generatedAt: nowIso(),
      notifications: {
        total: activeNotifications.length,
        urgent: activeNotifications.filter((item) => item.priority === "critical" || item.priority === "high").length,
        lowStock: activeNotifications.filter((item) => text(item.id).startsWith("status-")).length,
        trend: activeNotifications.filter((item) => text(item.id).startsWith("trend-")).length,
        expiry: activeNotifications.filter((item) => text(item.id).startsWith("expiry-")).length
      },
      movement: {
        fast: fastMovement,
        slow: slowMovement
      },
      expiry: {
        soonCount: expiringMedicines.length,
        withinThirtyCount: withinThirtyDays,
        inventoryTotalUnits: inventoryRows.reduce((total, item) => total + item.stock, 0),
        slowConsumptionCount: slowConsumptionItems.filter((item) => item.consumptionLevel === "Slow").length,
        medicines: expiringMedicines,
        slowConsumption: slowConsumptionItems,
        riskItem
      },
      balance: {
        totalMedicines: inventoryRows.length,
        balancedCount: balancedItems.length,
        lowCount: lowItems.length,
        overstockCount: overstockItems.length,
        rows: inventoryRows,
        focusItem,
        comparisonItems: (lowItems[0] ? [lowItems[0]] : [])
          .concat(balancedItems[0] ? [balancedItems[0]] : [])
          .concat(overstockItems[0] ? [overstockItems[0]] : [])
      }
    };
  };

  const toastState = {
    container: null,
    soundToggle: null,
    activeKeys: new Set(),
    soundEnabled: readSoundEnabled(),
    audioContext: null
  };
  const priorityWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };
  const notificationControlsHost = () => document.getElementById("notificationSystemControls");
  const ensureAudioContext = () => {
    if (toastState.audioContext) return toastState.audioContext;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextCtor) return null;
    try {
      toastState.audioContext = new AudioContextCtor();
      return toastState.audioContext;
    } catch (error) {
      return null;
    }
  };
  const resumeAudioContext = () => {
    const context = ensureAudioContext();
    if (!context) return Promise.resolve(null);
    if (context.state === "running") return Promise.resolve(context);
    return context.resume()
      .then(() => context)
      .catch(() => null);
  };
  const updateSoundToggle = () => {
    if (!toastState.soundToggle) return;
    toastState.soundToggle.classList.toggle("is-muted", !toastState.soundEnabled);
    toastState.soundToggle.innerHTML = `
      <i class="bi ${toastState.soundEnabled ? "bi-bell-fill" : "bi-bell-slash-fill"}" aria-hidden="true"></i>
      <span>${toastState.soundEnabled ? "Alert sound on" : "Alert sound off"}</span>
    `;
    toastState.soundToggle.setAttribute("aria-pressed", toastState.soundEnabled ? "true" : "false");
  };
  const ensureSoundToggle = () => {
    const host = notificationControlsHost();
    if (!host) return null;

    if (toastState.soundToggle && document.body.contains(toastState.soundToggle)) {
      if (toastState.soundToggle.parentElement !== host) host.appendChild(toastState.soundToggle);
      updateSoundToggle();
      return toastState.soundToggle;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "mss-system-sound-toggle";
    button.setAttribute("aria-label", "Toggle notification sound");
    button.addEventListener("click", () => {
      toastState.soundEnabled = !toastState.soundEnabled;
      saveSoundEnabled(toastState.soundEnabled);
      updateSoundToggle();
      if (toastState.soundEnabled) {
        void resumeAudioContext();
      }
    });
    host.appendChild(button);
    toastState.soundToggle = button;
    updateSoundToggle();
    return button;
  };
  const openNotificationCenter = () => {
    if (typeof window.MSSOpenNotificationCenter === "function") {
      try {
        window.MSSOpenNotificationCenter();
        return;
      } catch (error) {
        // Fall back to the default notification page if a page-specific handler fails.
      }
    }

    window.location.href = "notifications.php";
  };
  const registerAudioUnlock = () => {
    const unlock = () => {
      void resumeAudioContext();
    };
    document.addEventListener("pointerdown", unlock, { once: true, passive: true });
    document.addEventListener("keydown", unlock, { once: true });
  };
  const supportsAlertTone = (notification) => {
    if (!notification) return false;
    const priority = text(notification.priority);
    const category = text(notification.category);
    return ["critical", "high"].includes(priority) || category === "Expiring Soon";
  };

  const playAlertTone = (notification) => {
    if (!toastState.soundEnabled) return;
    if (!supportsAlertTone(notification)) return;

    const priority = text(notification?.priority);
    const category = text(notification?.category);

    void resumeAudioContext().then((context) => {
      if (!context) return;

      const tones = priority === "critical"
        ? [
            { frequency: 880, duration: 0.12, delay: 0 },
            { frequency: 660, duration: 0.18, delay: 0.16 }
          ]
        : category === "Expiring Soon"
          ? [
              { frequency: 620, duration: 0.1, delay: 0 },
              { frequency: 784, duration: 0.12, delay: 0.13 }
            ]
        : [
            { frequency: 740, duration: 0.1, delay: 0 },
            { frequency: 880, duration: 0.12, delay: 0.12 }
          ];

      tones.forEach((tone) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startAt = context.currentTime + tone.delay;
        const endAt = startAt + tone.duration;

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(tone.frequency, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(0.035, startAt + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt + 0.02);
      });
    });
  };

  const ensureContainer = () => {
    if (toastState.container && document.body.contains(toastState.container)) return toastState.container;
    const container = document.createElement("div");
    container.className = "mss-system-toast-stack";
    container.setAttribute("aria-live", "polite");
    container.setAttribute("aria-label", "System alerts");
    document.body.appendChild(container);
    toastState.container = container;
    return container;
  };

  const hideToast = (toast) => {
    if (!toast) return;
    const toastKey = text(toast.getAttribute("data-toast-key"));
    if (toastKey) toastState.activeKeys.delete(toastKey);
    toast.classList.add("is-hiding");
    window.setTimeout(() => toast.remove(), 220);
  };

  const showToast = (notification) => {
    const container = ensureContainer();
    const toastKey = `${notification.id}|${notification.signature}`;
    if (toastState.activeKeys.has(toastKey)) return;

    const existingToasts = Array.from(container.querySelectorAll("[data-toast-key]"));
    if (existingToasts.length >= MAX_POPUPS) {
      hideToast(existingToasts[0]);
    }

    const toast = document.createElement("section");
    toast.className = `mss-system-toast mss-system-toast--${esc(notification.priority)}`;
    toast.setAttribute("data-toast-key", toastKey);
    toast.innerHTML = `
      <div class="mss-system-toast__inner">
        <div class="mss-system-toast__head">
          <div class="flex-grow-1">
            <div class="mss-system-toast__eyebrow">
              <span class="mss-system-toast__dot" aria-hidden="true"></span>
              <span>${esc(notification.category)}</span>
            </div>
            <h6 class="mss-system-toast__title">${esc(notification.title)}</h6>
            <p class="mss-system-toast__body">${esc(toastMessageText(notification))}</p>
            <div class="mss-system-toast__meta">${esc(formatRelativeTime(notification.createdAt))}</div>
          </div>
          <button type="button" class="mss-system-toast__close" aria-label="Dismiss alert">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>
        <div class="mss-system-toast__actions">
          <span class="mss-system-toast__badge">${esc(notification.priority)}</span>
          <button type="button" class="mss-system-toast__link">View notifications</button>
        </div>
      </div>
    `;

    const closeButton = toast.querySelector(".mss-system-toast__close");
    const openButton = toast.querySelector(".mss-system-toast__link");
    closeButton?.addEventListener("click", () => hideToast(toast));
    openButton?.addEventListener("click", () => {
      openNotificationCenter();
    });

    container.appendChild(toast);
    toastState.activeKeys.add(toastKey);

    window.requestAnimationFrame(() => toast.classList.add("is-visible"));
    const dismissDelay = AUTO_DISMISS_BY_PRIORITY[text(notification.priority)] || AUTO_DISMISS_BY_PRIORITY.medium;
    window.setTimeout(() => hideToast(toast), dismissDelay);
  };

  const shouldPopup = (notification) => {
    const title = keyOf(notification.title);
    if (notification.priority === "critical" || notification.priority === "high") return true;
    if (title.includes("low in stock")) return true;
    if (title.includes("high usage trend")) return true;
    return hasActionableRecommendation(notification);
  };

  const syncNotifications = async ({ showToasts = false } = {}) => {
    queuedSyncOptions = {
      showToasts: Boolean(queuedSyncOptions.showToasts || showToasts)
    };
    syncNotificationsQueued = true;

    if (syncNotificationsPromise) return syncNotificationsPromise;

    syncNotificationsPromise = (async () => {
      try {
        let latestNotifications = state.notifications;

        while (syncNotificationsQueued) {
          const nextOptions = { ...queuedSyncOptions };
          syncNotificationsQueued = false;
          queuedSyncOptions = {
            showToasts: false
          };

          await hydrateNotificationsFromServer();
          const previous = state.notifications.map((notification) => normalizeNotification(notification));
          const derivedState = buildDerivedNotifications(previous);
          const notifications = derivedState.notifications;
          state.notificationResolvedState = derivedState.notificationResolvedState;
          state.notificationReadState = derivedState.notificationReadState;
          const monitoringSnapshot = buildMonitoringSnapshot(notifications);
          state.notifications = notifications;
          state.monitoringSnapshot = monitoringSnapshot;
          const popupState = readMap(POPUP_STATE_KEY);
          const activeNotifications = notifications.filter((notification) => !notification.resolved);
          const activeNotificationMap = new Map(activeNotifications.map((notification) => [notification.id, notification]));
          Object.keys(popupState).forEach((notificationId) => {
            const activeEntry = activeNotificationMap.get(notificationId);
            if (!activeEntry || !matchesNotificationSignature(activeEntry, popupState[notificationId])) {
              delete popupState[notificationId];
            }
          });
          const unseen = nextOptions.showToasts
            ? activeNotifications
              .filter((notification) => !notification.read && shouldPopup(notification) && !matchesNotificationSignature(notification, popupState[notification.id]))
              .sort((left, right) => {
                const priorityDelta = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
                if (priorityDelta !== 0) return priorityDelta;
                return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
              })
              .slice(0, MAX_POPUPS)
            : [];

          if (unseen.length) {
            const loudestAlert = unseen.reduce((current, item) => (
              !current || (priorityWeight[item.priority] || 0) > (priorityWeight[current.priority] || 0) ? item : current
            ), null);
            const audibleAlert = unseen.find((notification) => supportsAlertTone(notification)) || loudestAlert;
            if (audibleAlert) playAlertTone(audibleAlert);

            unseen.forEach((notification) => {
              popupState[notification.id] = notification.signature;
              showToast(notification);
            });
          }

          writeMap(POPUP_STATE_KEY, popupState);
          await persistNotificationsToServer(notifications);
          window.dispatchEvent(new CustomEvent("mss:notifications-synced", {
            detail: {
              monitoringSnapshot,
              notifications,
              notificationDismissedState: state.notificationDismissedState,
              notificationReadState: state.notificationReadState,
              notificationResolvedState: state.notificationResolvedState
            }
          }));
          latestNotifications = notifications;
        }

        return latestNotifications;
      } finally {
        syncNotificationsPromise = null;
      }
    })();

    return syncNotificationsPromise;
  };

  let refreshTimer = 0;
  const queueRefresh = ({ showToasts = true } = {}) => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      void syncNotifications({ showToasts });
    }, 120);
  };

  window.addEventListener("mss:inventory-updated", () => {
    queueRefresh({ showToasts: true });
  });

  window.addEventListener("mss:notifications-state-updated", (event) => {
    const nextNotifications = Array.isArray(event.detail?.notifications)
      ? event.detail.notifications.map(normalizeNotification)
      : state.notifications;
    if (event.detail?.notificationDismissedState && typeof event.detail.notificationDismissedState === "object") {
      state.notificationDismissedState = normalizeDismissedState(event.detail.notificationDismissedState);
    }
    state.notificationReadState = mergeReadStateWithNotifications(
      mergeReadStates(
        state.notificationReadState,
        event.detail?.notificationReadState && typeof event.detail.notificationReadState === "object"
          ? normalizeReadState(event.detail.notificationReadState)
          : {}
      ),
      nextNotifications
    );
    state.notificationResolvedState = mergeResolvedStateWithNotifications(
      mergeResolvedStates(
        state.notificationResolvedState,
        event.detail?.notificationResolvedState && typeof event.detail.notificationResolvedState === "object"
          ? normalizeResolvedState(event.detail.notificationResolvedState)
          : {}
      ),
      nextNotifications
    );
    state.notifications = applyReadStateToNotifications(
      applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState),
      state.notificationReadState
    );
    state.monitoringSnapshot = buildMonitoringSnapshot(state.notifications);
    syncNotificationRuntimeCache({
      notificationPopupState: state.notificationPopupState,
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") queueRefresh({ showToasts: false });
  });

  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    queueRefresh({ showToasts: true });
  }, NOTIFICATION_SYNC_POLL_INTERVAL_MS);

  window.MSSSystemNotifications = {
    refresh: queueRefresh,
    sync: syncNotifications
  };

  hydrateNotificationRuntimeCache();
  registerAudioUnlock();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureSoundToggle();
      void syncNotifications({ showToasts: true });
    }, { once: true });
  } else {
    ensureSoundToggle();
    void syncNotifications({ showToasts: true });
  }
})();
