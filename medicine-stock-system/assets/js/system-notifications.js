(() => {
  if (window.MSSSystemNotifications) return;

  const STORAGE_KEY = "mss_notifications_v2";
  const POPUP_STATE_KEY = "mss_notification_popup_seen_v1";
  const DISMISSED_STATE_KEY = "mss_notification_dismissed_v1";
  const SOUND_PREF_KEY = "mss_notification_sound_enabled_v1";
  const INVENTORY_STORAGE = "mss_inventory_records_v1";
  const MOVEMENTS_STORAGE = "mss_inventory_movements_v1";
  const STATE_ENDPOINT = "state-api.php";
  const MAX_POPUPS = 3;
  const AUTO_DISMISS_BY_PRIORITY = {
    critical: 12000,
    high: 8000,
    medium: 6000,
    low: 5000
  };

  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
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
      return;
    }

    if (key === DISMISSED_STATE_KEY) {
      state.notificationDismissedState = value && typeof value === "object" && !Array.isArray(value)
        ? { ...value }
        : {};
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

  const normalizeMedicine = (entry = {}, index = 0) => ({
    id: text(entry.id) || `medicine_${index + 1}`,
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
    { medicineId: "fallback_ors", medicineName: "ORS", actionType: "dispense", quantity: 18, createdAt: new Date(Date.now() - (5 * 3600000)).toISOString() },
    { medicineId: "fallback_lagundi", medicineName: "Lagundi", actionType: "dispense", quantity: 6, createdAt: new Date(Date.now() - (9 * 3600000)).toISOString() },
    { medicineId: "fallback_amoxicillin", medicineName: "Amoxicillin", actionType: "dispense", quantity: 32, createdAt: new Date(Date.now() - (30 * 3600000)).toISOString() }
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

  const normalizeNotification = (entry = {}) => {
    const category = text(entry.category) || "Medicine Status";
    const priority = ["critical", "high", "medium", "low"].includes(keyOf(entry.priority)) ? keyOf(entry.priority) : "medium";
    const title = text(entry.title) || "Medicine alert";
    const body = text(entry.body) || "Review the medicine notification.";

    return {
      id: text(entry.id) || `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      category,
      priority,
      title,
      body,
      source: text(entry.source) || "Inventory Analytics",
      recommendation: text(entry.recommendation) || "Review the medicine notification.",
      signature: text(entry.signature) || [category, priority, title, body].join("|"),
      createdAt: text(entry.createdAt) || nowIso(),
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      read: Boolean(entry.read),
      resolved: Boolean(entry.resolved),
      resolvedAt: text(entry.resolvedAt || entry.resolved_at)
    };
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
        resolvedAt: text(resolvedEntry.resolvedAt ?? resolvedEntry.resolved_at) || nowIso()
      };
    });
    return resolvedState;
  };

  const mergeReadStateWithNotifications = (currentReadState = {}, notifications = []) => {
    const nextReadState = { ...currentReadState };
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (!normalized.resolved && normalized.read && normalized.id && normalized.signature) {
        nextReadState[normalized.id] = normalized.signature;
      }
    });
    return nextReadState;
  };

  const mergeResolvedStateWithNotifications = (currentResolvedState = {}, notifications = []) => {
    const nextResolvedState = { ...currentResolvedState };
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (normalized.resolved && normalized.id && normalized.signature) {
        nextResolvedState[normalized.id] = {
          signature: normalized.signature,
          resolvedAt: text(normalized.resolvedAt) || normalized.updatedAt || normalized.createdAt || nowIso()
        };
      }
    });
    return nextResolvedState;
  };

  const applyResolvedStateToNotifications = (notifications = [], resolvedState = {}) => (
    notifications.map((notification) => {
      const normalized = normalizeNotification(notification);
      const resolvedEntry = resolvedState[normalized.id];
      if (resolvedEntry && text(resolvedEntry.signature) === text(normalized.signature)) {
        normalized.resolved = true;
        normalized.resolvedAt = text(resolvedEntry.resolvedAt) || normalized.updatedAt || normalized.createdAt || nowIso();
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
    state.notificationResolvedState = mergeResolvedStateWithNotifications(
      serverState.notificationResolvedState && typeof serverState.notificationResolvedState === "object"
        ? normalizeResolvedState(serverState.notificationResolvedState)
        : state.notificationResolvedState,
      nextNotifications
    );
    const hydratedNotifications = applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState);
    state.notificationReadState = mergeReadStateWithNotifications(
      serverState.notificationReadState && typeof serverState.notificationReadState === "object"
        ? normalizeReadState(serverState.notificationReadState)
        : state.notificationReadState,
      hydratedNotifications
    );
    state.notifications = hydratedNotifications;
  };

  const persistStateToServer = async (nextState, { keepalive = false } = {}) => {
    try {
      const payload = await requestJson(STATE_ENDPOINT, {
        method: "POST",
        keepalive,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          state: nextState
        })
      });
      syncStateFromServer(payload?.state || {});
    } catch (error) {
      console.error("Unable to persist system notifications.", error);
    }
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
    const previousMap = new Map(previous.map((entry) => {
      const normalized = normalizeNotification(entry);
      return [normalized.id, normalized];
    }));
    const inventory = readInventory();
    const movements = readMovements();
    const recentCutoff = Date.now() - (14 * 86400000);
    const demandMap = new Map();

    movements.forEach((movement) => {
      if (movement.actionType !== "dispense") return;
      const createdAt = new Date(movement.createdAt).getTime();
      if (Number.isNaN(createdAt) || createdAt < recentCutoff) return;

      const keys = [text(movement.medicineId), keyOf(movement.medicineName)].filter(Boolean);
      keys.forEach((key) => {
        const entry = demandMap.get(key) || { count: 0, quantity: 0 };
        entry.count += 1;
        entry.quantity += movement.quantity;
        demandMap.set(key, entry);
      });
    });

    const notifications = [];
    const activeIds = new Set();
    const nextResolvedState = normalizeResolvedState(state.notificationResolvedState);
    const nextReadState = { ...state.notificationReadState };
    const pushNotification = (raw) => {
      const nextNotification = normalizeNotification(raw);
      if (text(state.notificationDismissedState[nextNotification.id]) === text(nextNotification.signature)) {
        return;
      }
      const previousEntry = previousMap.get(nextNotification.id);
      delete nextResolvedState[nextNotification.id];
      activeIds.add(nextNotification.id);
      const preserveRead = text(nextReadState[nextNotification.id]) === text(nextNotification.signature)
        || (Boolean(previousEntry) && text(previousEntry.signature) === text(nextNotification.signature) && previousEntry.read && !previousEntry.resolved);

      notifications.push(normalizeNotification({
        ...nextNotification,
        createdAt: preserveRead && previousEntry ? previousEntry.createdAt : nextNotification.createdAt,
        updatedAt: nowIso(),
        read: preserveRead ? (previousEntry?.read || text(nextReadState[nextNotification.id]) === text(nextNotification.signature)) : false,
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
      const demand = demandMap.get(medicineKey) || demandMap.get(keyOf(medicine.name)) || { count: 0, quantity: 0 };

      if (stock <= reorderLevel) {
        const isOut = stock <= 0;
        pushNotification({
          id: `status-${medicineKey}`,
          category: "Medicine Status",
          priority: isOut ? "critical" : stock <= Math.max(5, Math.round(reorderLevel * 0.5)) ? "high" : "medium",
          title: isOut ? `${label} is out of stock` : `${label} is low in stock`,
          body: isOut ? `Stock is 0 ${unit}. Reorder immediately.` : `${quantityLabel(stock, unit)} remaining. Reorder soon.`,
          source: "Inventory Analytics",
          recommendation: isOut
            ? "Prepare an urgent restock request and confirm supplier lead time."
            : "Review stock balance and reorder before the medicine runs out."
        });
      }

      if (demand.quantity >= Math.max(20, Math.round(reorderLevel * 0.35)) && stock <= Math.round(reorderLevel * 1.4)) {
        pushNotification({
          id: `trend-${medicineKey}`,
          category: "Medicine Status",
          priority: stock <= reorderLevel ? "high" : "medium",
          title: `${label} shows high usage trend`,
          body: `${quantityLabel(demand.quantity, unit)} released in recent transactions.`,
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

    previousMap.forEach((previousEntry, notificationId) => {
      if (activeIds.has(notificationId)) return;
      if (!notificationId || !text(previousEntry.signature)) return;
      if (text(state.notificationDismissedState[notificationId]) === text(previousEntry.signature)) return;

      const resolvedEntry = nextResolvedState[notificationId];
      const resolvedAt = text(resolvedEntry?.signature) === text(previousEntry.signature)
        ? (text(resolvedEntry.resolvedAt) || text(previousEntry.resolvedAt) || previousEntry.updatedAt || nowIso())
        : nowIso();

      nextResolvedState[notificationId] = {
        signature: previousEntry.signature,
        resolvedAt
      };

      notifications.push(normalizeNotification({
        ...previousEntry,
        resolved: true,
        resolvedAt,
        updatedAt: resolvedAt
      }));

      if (text(nextReadState[notificationId]) === text(previousEntry.signature)) {
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
      if (left.read !== right.read) return left.read ? 1 : -1;
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
  const playAlertTone = (priority) => {
    if (!toastState.soundEnabled) return;
    if (!["critical", "high"].includes(text(priority))) return;

    void resumeAudioContext().then((context) => {
      if (!context) return;

      const tones = priority === "critical"
        ? [
            { frequency: 880, duration: 0.12, delay: 0 },
            { frequency: 660, duration: 0.18, delay: 0.16 }
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
            <p class="mss-system-toast__body">${esc(notification.body)}</p>
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
    return false;
  };

  const syncNotifications = async ({ showToasts = false } = {}) => {
    await hydrateNotificationsFromServer();
    const previous = state.notifications.map(normalizeNotification);
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
      if (!activeEntry || text(popupState[notificationId]) !== text(activeEntry.signature)) {
        delete popupState[notificationId];
      }
    });
    const unseen = showToasts
      ? activeNotifications
        .filter((notification) => !notification.read && shouldPopup(notification) && text(popupState[notification.id]) !== text(notification.signature))
        .slice(0, MAX_POPUPS)
      : [];

    if (unseen.length) {
      const loudestAlert = unseen.reduce((current, item) => (
        !current || (priorityWeight[item.priority] || 0) > (priorityWeight[current.priority] || 0) ? item : current
      ), null);
      if (loudestAlert) playAlertTone(loudestAlert.priority);

      unseen.forEach((notification) => {
        popupState[notification.id] = notification.signature;
        showToast(notification);
      });
    }

    writeMap(POPUP_STATE_KEY, popupState);
    void persistNotificationsToServer(notifications);
    window.dispatchEvent(new CustomEvent("mss:notifications-synced", {
      detail: {
        monitoringSnapshot,
        notifications,
        notificationDismissedState: state.notificationDismissedState,
        notificationReadState: state.notificationReadState,
        notificationResolvedState: state.notificationResolvedState
      }
    }));
    return notifications;
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
    if (Array.isArray(event.detail?.notifications)) {
      state.notifications = event.detail.notifications.map(normalizeNotification);
      state.monitoringSnapshot = buildMonitoringSnapshot(state.notifications);
    }
    if (event.detail?.notificationDismissedState && typeof event.detail.notificationDismissedState === "object") {
      state.notificationDismissedState = normalizeDismissedState(event.detail.notificationDismissedState);
    }
    if (event.detail?.notificationReadState && typeof event.detail.notificationReadState === "object") {
      state.notificationReadState = normalizeReadState(event.detail.notificationReadState);
    } else {
      state.notificationReadState = mergeReadStateWithNotifications(state.notificationReadState, state.notifications);
    }
    if (event.detail?.notificationResolvedState && typeof event.detail.notificationResolvedState === "object") {
      state.notificationResolvedState = normalizeResolvedState(event.detail.notificationResolvedState);
      state.notifications = applyResolvedStateToNotifications(state.notifications, state.notificationResolvedState);
      state.monitoringSnapshot = buildMonitoringSnapshot(state.notifications);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") queueRefresh({ showToasts: false });
  });

  window.setInterval(() => {
    queueRefresh({ showToasts: true });
  }, 300000);

  window.MSSSystemNotifications = {
    refresh: queueRefresh,
    sync: syncNotifications
  };

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
