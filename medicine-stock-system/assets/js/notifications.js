(() => {
  const STATE_ENDPOINT = "state-api.php";
  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;
  const NOTIFICATION_RUNTIME_STORAGE_PREFIX = "mss_notification_runtime_state_v1";
  const ADMIN_NOTIFICATION_HIDDEN_STORAGE_PREFIX = "mss_admin_hidden_notifications_v1";
  const NOTIFICATION_OCCURRENCE_SEPARATOR = "::";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    notificationCount: byId("notificationCount"),
    notificationFeed: byId("notificationFeed"),
    notificationModalPriority: byId("notificationModalPriority"),
    notificationModalCategory: byId("notificationModalCategory"),
    notificationModalTitle: byId("notificationModalTitle"),
    notificationModalBody: byId("notificationModalBody"),
    notificationModalTime: byId("notificationModalTime"),
    deleteNotificationMessage: byId("deleteNotificationMessage"),
    confirmDeleteNotificationBtn: byId("confirmDeleteNotificationBtn")
  };
  const ensureNotificationTypeButtons = () => {
    const quickFilters = document.querySelector(".notification-quick-filters");
    if (quickFilters && !quickFilters.querySelector('[data-notification-type="resolved"]')) {
      const resolvedButton = document.createElement("button");
      resolvedButton.type = "button";
      resolvedButton.className = "notification-filter-pill";
      resolvedButton.dataset.notificationType = "resolved";
      resolvedButton.setAttribute("aria-pressed", "false");
      resolvedButton.textContent = "Resolved";
      quickFilters.appendChild(resolvedButton);
    }

    return Array.from(document.querySelectorAll("[data-notification-type]"));
  };
  const notificationTypeButtons = ensureNotificationTypeButtons();

  const notificationMessageModal = byId("notificationMessageModal") && window.bootstrap ? new window.bootstrap.Modal(byId("notificationMessageModal")) : null;
  const deleteNotificationModalElement = byId("deleteNotificationModal");
  const deleteNotificationModal = deleteNotificationModalElement && window.bootstrap ? new window.bootstrap.Modal(deleteNotificationModalElement) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    notifications: [],
    notificationDismissedState: {},
    notificationReadState: {},
    notificationResolvedState: {},
    inventory: [],
    movements: [],
    users: [],
    sessions: [],
    activityLogs: []
  };

  const uiState = {
    quickFilter: "all"
  };

  let alertTimer = 0;
  let notificationsHydrationPromise = null;
  let notificationStateSaveQueue = Promise.resolve();
  let lastQueuedNotificationStateSyncId = 0;
  let refreshNotificationsPromise = null;
  let refreshNotificationsQueued = false;
  let queuedRefreshOptions = {
    notify: false,
    logAction: false
  };
  let pendingDeleteNotificationId = "";
  let pendingReadNotificationId = "";
  let adminNotificationHiddenState = {};
  let adminNotificationHiddenStorageKey = "";
  const DEFAULT_NOTIFICATION_MESSAGE = "Review the medicine notification.";

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
    if (!normalizedAlertKey) return uid();
    return occurrenceIndex > 0
      ? `${normalizedAlertKey}${NOTIFICATION_OCCURRENCE_SEPARATOR}${occurrenceIndex}`
      : normalizedAlertKey;
  };
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatDateTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(parsed);
  };
  const relativeTime = (value) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "-";
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
  const resolvedTimestamp = (notification) => text(notification?.resolvedAt) || text(notification?.updatedAt) || text(notification?.createdAt) || nowIso();
  const notificationTimelineText = (notification) => (
    notification?.resolved
      ? `${formatDateTime(notification.createdAt)} - Resolved ${formatDateTime(resolvedTimestamp(notification))}`
      : formatDateTime(notification?.createdAt)
  );
  const notificationMessageText = (notification) => {
    const baseBody = text(notification?.body) || DEFAULT_NOTIFICATION_MESSAGE;
    if (!notification?.resolved) return baseBody;
    return `${baseBody} Status update: Resolved automatically on ${formatDateTime(resolvedTimestamp(notification))} after the alert condition cleared.`;
  };

  const priorityWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  const showNotice = (message, type = "success") => {
    if (!refs.moduleAlert) return;
    refs.moduleAlert.className = `alert alert-${type}`;
    refs.moduleAlert.textContent = message;
    refs.moduleAlert.classList.remove("d-none");
    window.clearTimeout(alertTimer);
    alertTimer = window.setTimeout(() => refs.moduleAlert?.classList.add("d-none"), 3200);
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
      const message = String(payload.message || "Unable to sync notifications right now.");
      throw new Error(message);
    }
    return payload;
  };

  const dispatchNotificationStateUpdate = () => {
    window.dispatchEvent(new CustomEvent("mss:notifications-state-updated", {
      detail: {
        notifications: state.notifications.map(normalizeNotification),
        notificationDismissedState: { ...state.notificationDismissedState },
        notificationReadState: { ...state.notificationReadState },
        notificationResolvedState: { ...state.notificationResolvedState }
      }
    }));
  };

  const syncNotificationStateToServer = ({ keepalive = false, snapshot = createNotificationStateSnapshot() } = {}) => {
    const requestId = ++lastQueuedNotificationStateSyncId;
    notificationStateSaveQueue = notificationStateSaveQueue
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
          if (requestId === lastQueuedNotificationStateSyncId) {
            syncStateFromServer(payload?.state || {});
          }
          return payload;
        } catch (error) {
          console.error("Unable to persist notifications.", error);
          return null;
        }
      });
    return notificationStateSaveQueue;
  };

  const syncActivityLogsToServer = async ({ keepalive = false } = {}) => {
    try {
      const payload = await requestJson(STATE_ENDPOINT, {
        method: "POST",
        keepalive,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          state: {
            logs: state.activityLogs
          }
        })
      });
      if (Array.isArray(payload?.state?.logs)) {
        state.activityLogs = payload.state.logs;
      }
    } catch (error) {
      console.error("Unable to persist notification logs.", error);
    }
  };

  const saveState = (options = {}) => {
    dispatchNotificationStateUpdate();
    syncNotificationRuntimeCache({
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    });
    return syncNotificationStateToServer({
      ...options,
      snapshot: createNotificationStateSnapshot()
    });
  };

  const saveLogs = (options = {}) => syncActivityLogsToServer(options);

  const normalizeReadState = (entry = {}) => {
    const readState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const notificationId = text(key);
      const signature = text(value);
      if (!notificationId || !signature) return;
      readState[notificationId] = signature;
    });
    return readState;
  };

  const normalizeResolvedState = (entry = {}) => {
    const resolvedState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const notificationId = text(key);
      const resolvedEntry = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const signature = text(resolvedEntry.signature ?? value);
      if (!notificationId || !signature) return;
      resolvedState[notificationId] = {
        signature,
        resolvedAt: text(resolvedEntry.resolvedAt ?? resolvedEntry.resolved_at) || nowIso(),
        read: resolvedEntry.read === true || resolvedEntry.isRead === true || resolvedEntry.is_read === true
      };
    });
    return resolvedState;
  };

  const createNotificationStateSnapshot = () => ({
    notifications: state.notifications.map((entry) => normalizeNotification(entry)),
    notificationDismissedState: { ...state.notificationDismissedState },
    notificationReadState: normalizeReadState(state.notificationReadState),
    notificationResolvedState: normalizeResolvedState(state.notificationResolvedState)
  });

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
    const nextResolvedState = { ...currentResolvedState };
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (normalized.resolved && normalized.id && normalized.signature) {
        nextResolvedState[normalized.id] = {
          signature: normalized.signature,
          resolvedAt: text(normalized.resolvedAt) || normalized.updatedAt || normalized.createdAt || nowIso(),
          read: Boolean(normalized.read)
        };
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
    state.notificationDismissedState = serverState.notificationDismissedState && typeof serverState.notificationDismissedState === "object"
      ? normalizeDismissedState(serverState.notificationDismissedState)
      : state.notificationDismissedState;
    const incomingResolvedState = serverState.notificationResolvedState && typeof serverState.notificationResolvedState === "object"
      ? normalizeResolvedState(serverState.notificationResolvedState)
      : {};
    state.notificationResolvedState = mergeResolvedStateWithNotifications(
      {
        ...incomingResolvedState,
        ...state.notificationResolvedState
      },
      nextNotifications
    );
    const hydratedNotifications = applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState);
    const incomingReadState = serverState.notificationReadState && typeof serverState.notificationReadState === "object"
      ? normalizeReadState(serverState.notificationReadState)
      : {};
    state.notificationReadState = mergeReadStateWithNotifications(
      {
        ...incomingReadState,
        ...state.notificationReadState
      },
      hydratedNotifications
    );
    state.notifications = applyReadStateToNotifications(hydratedNotifications, state.notificationReadState);
    state.inventory = Array.isArray(serverState.inventory)
      ? serverState.inventory.map((entry, index) => normalizeMedicine(entry, index))
      : state.inventory;
    state.movements = Array.isArray(serverState.movements)
      ? serverState.movements.map(normalizeMovement)
      : state.movements;
    state.users = Array.isArray(serverState.users) ? serverState.users : state.users;
    state.sessions = Array.isArray(serverState.sessions) ? serverState.sessions : state.sessions;
    state.activityLogs = Array.isArray(serverState.logs) ? serverState.logs : state.activityLogs;
    syncNotificationRuntimeCache({
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    });
  };

  const hydrateNotifications = async () => {
    if (notificationsHydrationPromise) {
      await notificationsHydrationPromise;
      return;
    }

    notificationsHydrationPromise = (async () => {
      try {
        const payload = await requestJson(`${STATE_ENDPOINT}?t=${Date.now()}`);
        syncStateFromServer(payload?.state || {});
      } catch (error) {
        console.error("Unable to load persisted notifications.", error);
      }
    })();

    try {
      await notificationsHydrationPromise;
    } finally {
      notificationsHydrationPromise = null;
    }
  };

  const findAdminUser = () => {
    return state.users.find((user) => keyOf(user.role) === "admin") || null;
  };

  const resolveSessionIp = (userId, fallbackIp = "192.168.10.15") => {
    if (!userId) return fallbackIp;
    const activeSession = state.sessions.find((session) => text(session.userId) === text(userId));
    return text(activeSession?.ipAddress) || fallbackIp;
  };

  const currentAuditActor = () => {
    const adminUser = findAdminUser();
    return {
      actor: text(adminUser?.fullName) || "Nurse-in-Charge",
      username: text(adminUser?.username) || "nurse.incharge",
      ipAddress: resolveSessionIp(adminUser?.id, "192.168.10.15")
    };
  };

  const appendActivityLog = ({
    actor = "Nurse-in-Charge",
    username = "nurse.incharge",
    action = "Updated notification",
    actionType = "updated",
    target = "",
    details = "",
    category = "Notifications",
    resultLabel = "Success",
    resultTone = "success",
    createdAt = nowIso(),
    ipAddress = "192.168.10.15"
  }) => {
    state.activityLogs.unshift({
      id: uid(),
      actor,
      username,
      action,
      actionType,
      target,
      details,
      category,
      resultLabel,
      resultTone,
      ipAddress,
      createdAt
    });
    state.activityLogs = state.activityLogs
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 60);
  };

  const closeMobileSidebar = () => {
    refs.sidebar?.classList.remove("open");
    refs.sidebarBackdrop?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  };

  const toggleSidebar = () => {
    if (!refs.sidebar || !refs.sidebarBackdrop) return;
    if (isMobile()) {
      refs.sidebar.classList.toggle("open");
      refs.sidebarBackdrop.classList.toggle("show");
      document.body.classList.toggle("sidebar-open");
      return;
    }

    refs.sidebar.classList.toggle("collapsed");
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
    createdAt: text(entry.createdAt) || nowIso()
  });

  const fallbackInventory = [
    {
      id: "fallback_paracetamol",
      name: "Paracetamol",
      strength: "500mg",
      stockOnHand: 540,
      reorderLevel: 220,
      unit: "tablets",
      expiryDate: "2026-09-14"
    },
    {
      id: "fallback_amoxicillin",
      name: "Amoxicillin",
      strength: "500mg",
      stockOnHand: 95,
      reorderLevel: 160,
      unit: "capsules",
      expiryDate: "2026-05-22"
    },
    {
      id: "fallback_ors",
      name: "ORS",
      strength: "20.5g",
      stockOnHand: 62,
      reorderLevel: 120,
      unit: "sachets",
      expiryDate: "2026-04-30"
    },
    {
      id: "fallback_lagundi",
      name: "Lagundi",
      strength: "60mL",
      stockOnHand: 28,
      reorderLevel: 40,
      unit: "bottles",
      expiryDate: "2026-04-16"
    },
    {
      id: "fallback_zinc",
      name: "Zinc Sulfate",
      strength: "20mg",
      stockOnHand: 0,
      reorderLevel: 90,
      unit: "tablets",
      expiryDate: "2026-07-20"
    }
  ].map(normalizeMedicine);

  const fallbackMovements = [
    {
      medicineId: "fallback_ors",
      medicineName: "ORS",
      actionType: "dispense",
      quantity: 18,
      createdAt: new Date(Date.now() - (5 * 3600000)).toISOString()
    },
    {
      medicineId: "fallback_lagundi",
      medicineName: "Lagundi",
      actionType: "dispense",
      quantity: 6,
      createdAt: new Date(Date.now() - (9 * 3600000)).toISOString()
    },
    {
      medicineId: "fallback_amoxicillin",
      medicineName: "Amoxicillin",
      actionType: "dispense",
      quantity: 32,
      createdAt: new Date(Date.now() - (30 * 3600000)).toISOString()
    }
  ].map(normalizeMovement);

  const isActiveMedicine = (medicine) => text(medicine?.recordStatus).toLowerCase() !== "archived";

  const readInventory = () => {
    const records = state.inventory
      .map((entry, index) => normalizeMedicine(entry, index))
      .filter((entry) => text(entry.name));
    const activeRecords = records.filter(isActiveMedicine);
    return activeRecords.length ? activeRecords : records;
  };

  const readMovements = () => {
    const records = state.movements
      .map(normalizeMovement)
      .filter((entry) => text(entry.medicineId) || text(entry.medicineName));
    return records;
  };

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;
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
  const deriveState = (notification) => (notification.read ? "read" : "unread");
  const badgeClass = (priority) => `notification-badge notification-badge--${priority === "critical" ? "critical" : priority === "high" ? "high" : priority === "medium" ? "medium" : "low"}`;

  const normalizeNotification = (entry = {}) => {
    const category = text(entry.category) || "Medicine Status";
    const priority = ["critical", "high", "medium", "low"].includes(keyOf(entry.priority)) ? keyOf(entry.priority) : "medium";
    const title = text(entry.title) || "Medicine alert";
    const body = text(entry.body) || DEFAULT_NOTIFICATION_MESSAGE;
    const notificationId = text(entry.id) || uid();
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

  const normalizeDismissedState = (entry = {}) => {
    const dismissedState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const notificationId = text(key);
      const signature = text(value);
      if (!notificationId || !signature) return;
      dismissedState[notificationId] = signature;
    });
    return dismissedState;
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

  const normalizeAdminNotificationHiddenState = (entry = {}) => {
    const hiddenState = {};
    Object.entries(entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {}).forEach(([key, value]) => {
      const notificationId = text(key);
      const token = text(value);
      if (!notificationId || !token) return;
      hiddenState[notificationId] = token;
    });
    return hiddenState;
  };

  const adminNotificationHiddenToken = (notification) => {
    const normalized = normalizeNotification(notification);
    return [normalized.signature, text(normalized.resolvedAt) || text(normalized.updatedAt) || text(normalized.createdAt)].join("|");
  };

  const getAdminNotificationHiddenStorageKey = () => {
    const authScope = text(currentAuthUser?.id) || keyOf(currentAuthUser?.username) || "admin";
    return `${ADMIN_NOTIFICATION_HIDDEN_STORAGE_PREFIX}_${authScope}`;
  };

  const loadAdminNotificationHiddenState = () => {
    const nextStorageKey = getAdminNotificationHiddenStorageKey();
    if (nextStorageKey === adminNotificationHiddenStorageKey) return adminNotificationHiddenState;

    adminNotificationHiddenStorageKey = nextStorageKey;
    try {
      const raw = window.localStorage.getItem(nextStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      adminNotificationHiddenState = normalizeAdminNotificationHiddenState(parsed);
    } catch (error) {
      console.error("Unable to load admin notification hidden state.", error);
      adminNotificationHiddenState = {};
    }
    return adminNotificationHiddenState;
  };

  const saveAdminNotificationHiddenState = () => {
    const nextStorageKey = getAdminNotificationHiddenStorageKey();
    if (nextStorageKey !== adminNotificationHiddenStorageKey) {
      adminNotificationHiddenStorageKey = nextStorageKey;
    }

    try {
      if (Object.keys(adminNotificationHiddenState).length) {
        window.localStorage.setItem(adminNotificationHiddenStorageKey, JSON.stringify(adminNotificationHiddenState));
      } else {
        window.localStorage.removeItem(adminNotificationHiddenStorageKey);
      }
    } catch (error) {
      console.error("Unable to save admin notification hidden state.", error);
    }
  };

  const pruneAdminNotificationHiddenState = (notifications = []) => {
    const hiddenState = loadAdminNotificationHiddenState();
    const resolvedNotificationsById = new Map();
    notifications.forEach((notification) => {
      const normalized = normalizeNotification(notification);
      if (normalized.resolved) {
        resolvedNotificationsById.set(normalized.id, normalized);
      }
    });
    const nextHiddenState = {};

    Object.entries(hiddenState).forEach(([notificationId, token]) => {
      const resolvedNotification = resolvedNotificationsById.get(notificationId);
      if (!resolvedNotification) {
        nextHiddenState[notificationId] = text(token);
        return;
      }

      const hiddenToken = adminNotificationHiddenToken(resolvedNotification);
      if (text(token) === hiddenToken) {
        nextHiddenState[notificationId] = hiddenToken;
      }
    });

    if (JSON.stringify(nextHiddenState) !== JSON.stringify(adminNotificationHiddenState)) {
      adminNotificationHiddenState = nextHiddenState;
      saveAdminNotificationHiddenState();
    }

    return adminNotificationHiddenState;
  };

  const isAdminNotificationRemoved = (notification) => {
    const hiddenState = loadAdminNotificationHiddenState();
    const normalized = normalizeNotification(notification);
    return normalized.resolved && text(hiddenState[normalized.id]) === adminNotificationHiddenToken(normalized);
  };

  const getVisibleNotifications = () => {
    const notifications = state.notifications.map(normalizeNotification);
    pruneAdminNotificationHiddenState(notifications);
    return notifications.filter((notification) => !isAdminNotificationRemoved(notification));
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
        createdAt: preserveCreatedAt && previousEntry ? previousEntry.createdAt : (nextNotification.createdAt || nowIso()),
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

    previousMap.forEach((previousEntry, notificationId) => {
      if (activeIds.has(notificationId)) return;
      if (!notificationId || !text(previousEntry.signature)) return;

      const resolvedEntry = nextResolvedState[notificationId];
      const resolvedAt = matchesNotificationSignature(previousEntry, resolvedEntry?.signature)
        ? (text(resolvedEntry.resolvedAt) || text(previousEntry.resolvedAt) || previousEntry.updatedAt || nowIso())
        : nowIso();
      const resolvedWasRead = Boolean(previousEntry.read || matchesNotificationReadState(previousEntry, nextReadState[notificationId]));

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

  const matchesQuickFilter = (notification) => {
    const title = keyOf(notification.title);
    if (uiState.quickFilter === "low-stock") {
      return notification.category === "Medicine Status" && title.includes("low in stock");
    }
    if (uiState.quickFilter === "out-of-stock") {
      return notification.category === "Medicine Status" && title.includes("out of stock");
    }
    if (uiState.quickFilter === "expiring-soon") return notification.category === "Expiring Soon";
    if (uiState.quickFilter === "critical") return notification.priority === "critical";
    if (uiState.quickFilter === "resolved") return Boolean(notification.resolved);
    return true;
  };

  const filteredNotifications = () => getVisibleNotifications().filter(matchesQuickFilter);

  const canRemoveNotificationFromView = (notification) => Boolean(notification?.resolved);

  const syncFilterButtons = (buttons, dataKey, activeValue) => {
    buttons.forEach((button) => {
      const isActive = text(button.dataset[dataKey]) === activeValue;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const renderFilterState = () => {
    syncFilterButtons(notificationTypeButtons, "notificationType", uiState.quickFilter);
  };

  const renderCount = () => {
    if (!refs.notificationCount) return;
    const visibleNotifications = filteredNotifications();
    refs.notificationCount.textContent = `${formatNumber(visibleNotifications.length)} ${visibleNotifications.length === 1 ? "notification" : "notifications"}`;
  };

  const renderFeed = () => {
    if (!refs.notificationFeed) return;
    const visibleNotifications = filteredNotifications();

    if (!visibleNotifications.length) {
      refs.notificationFeed.innerHTML = '<div class="notification-empty">No notifications found.</div>';
      return;
    }

    refs.notificationFeed.innerHTML = visibleNotifications.map((notification) => {
      const displayBody = notificationMessageText(notification);
      const unreadDot = !notification.read
        ? '<span class="notification-unread-dot" aria-hidden="true"></span>'
        : "";
      const unreadClass = notification.read ? "" : " is-unread";
      const resolvedClass = notification.resolved ? " is-resolved" : "";
      const resolvedBadge = notification.resolved
        ? '<span class="notification-state-pill notification-state-pill--resolved">Resolved</span>'
        : "";
      const resolvedMeta = notification.resolved
        ? `
            <span class="notification-meta-separator" aria-hidden="true">|</span>
            <span class="notification-meta-label notification-meta-label--resolved">Resolved</span>
            <span>${esc(formatDateTime(notification.resolvedAt || notification.updatedAt || notification.createdAt))}</span>
          `
        : "";
      const deleteButton = canRemoveNotificationFromView(notification)
        ? `
              <button
                type="button"
                class="notification-delete-btn notification-delete-btn--local"
                data-action="delete-notification"
                data-id="${esc(notification.id)}"
                aria-label="Remove notification from your view"
                title="Remove from your view"
              >
                <i class="bi bi-eye-slash"></i>
              </button>
            `
        : "";
      return `
        <article class="notification-card${unreadClass}${resolvedClass}" data-id="${esc(notification.id)}">
          <div class="notification-card__head">
            <div class="notification-card__head-main">
              <div class="notification-card__title">${unreadDot}${esc(notification.title)}</div>
              <p class="notification-card__body">${esc(displayBody)}</p>
            </div>
            <div class="notification-card__head-actions">
              ${resolvedBadge}
              <span class="${esc(badgeClass(notification.priority))}">${esc(notification.priority)}</span>
              ${deleteButton}
            </div>
          </div>

          <div class="notification-card__meta">
            <span class="notification-meta-label">${esc(notification.category)}</span>
            <span class="notification-meta-separator" aria-hidden="true">|</span>
            <span>${esc(formatDateTime(notification.createdAt))}</span>
            <span class="notification-meta-separator" aria-hidden="true">|</span>
            <span>${esc(relativeTime(notification.createdAt))}</span>
            ${resolvedMeta}
          </div>
        </article>
      `;
    }).join("");
  };

  const renderAll = () => {
    renderFilterState();
    renderCount();
    renderFeed();
  };

  const openNotificationModal = (notification) => {
    if (!notification) return;

    if (refs.notificationModalPriority) {
      refs.notificationModalPriority.className = badgeClass(notification.priority);
      refs.notificationModalPriority.textContent = notification.priority;
    }
    if (refs.notificationModalCategory) {
      refs.notificationModalCategory.textContent = notification.resolved
        ? `${notification.category} - Resolved`
        : notification.category;
    }
    if (refs.notificationModalTitle) refs.notificationModalTitle.textContent = notification.title;
    if (refs.notificationModalBody) refs.notificationModalBody.textContent = notificationMessageText(notification);
    if (refs.notificationModalTime) refs.notificationModalTime.textContent = notificationTimelineText(notification);
    notificationMessageModal?.show();
  };

  const markNotificationAsRead = (notificationId) => {
    const normalizedId = text(notificationId);
    if (!normalizedId) return null;

    let changed = false;
    let selectedNotification = null;
    state.notifications = state.notifications.map((notification) => {
      const normalized = normalizeNotification(notification);
      if (normalized.id !== normalizedId) return normalized;
      selectedNotification = normalized;
      if (normalized.read) return normalized;

      normalized.read = true;
      normalized.updatedAt = nowIso();
      if (!normalized.resolved) {
        state.notificationReadState = {
          ...state.notificationReadState,
          [normalized.id]: normalized.id
        };
      }
      changed = true;
      return normalized;
    });

    if (!selectedNotification) return null;
    if (!changed) return selectedNotification;

    syncNotificationRuntimeCache({
      notificationDismissedState: state.notificationDismissedState,
      notificationReadState: state.notificationReadState,
      notificationResolvedState: state.notificationResolvedState
    });
    renderAll();
    void saveState({ keepalive: true });
    return selectedNotification;
  };

  const removeNotificationFromAdminView = (notification) => {
    if (!notification) return;
    if (!canRemoveNotificationFromView(notification)) {
      showNotice("Notifications can only be removed after they are resolved.", "warning");
      return;
    }

    loadAdminNotificationHiddenState();
    adminNotificationHiddenState = {
      ...adminNotificationHiddenState,
      [notification.id]: adminNotificationHiddenToken(notification)
    };
    saveAdminNotificationHiddenState();
    renderAll();
    notificationMessageModal?.hide();
    deleteNotificationModal?.hide();
  };

  const openDeleteNotificationModal = (notification) => {
    if (!notification) return;
    if (!canRemoveNotificationFromView(notification)) {
      showNotice("Resolve the notification first before removing it.", "warning");
      return;
    }

    pendingDeleteNotificationId = notification.id;
    if (refs.deleteNotificationMessage) {
      refs.deleteNotificationMessage.textContent = `Remove "${notification.title}" from your view only? Resolved notifications older than 90 days are cleaned up automatically.`;
    }
    deleteNotificationModal?.show();
  };

  const confirmDeleteNotification = () => {
    const notificationId = text(pendingDeleteNotificationId);
    if (!notificationId) {
      deleteNotificationModal?.hide();
      return;
    }

    const notification = state.notifications.find((entry) => entry.id === notificationId);
    if (!notification) {
      deleteNotificationModal?.hide();
      return;
    }
    if (!canRemoveNotificationFromView(notification)) {
      deleteNotificationModal?.hide();
      showNotice("Resolve the notification first before removing it.", "warning");
      return;
    }

    removeNotificationFromAdminView(notification);
  };

  const refreshNotifications = async ({ notify = false, logAction = false } = {}) => {
    queuedRefreshOptions = {
      notify: Boolean(queuedRefreshOptions.notify || notify),
      logAction: Boolean(queuedRefreshOptions.logAction || logAction)
    };
    refreshNotificationsQueued = true;

    if (refreshNotificationsPromise) return refreshNotificationsPromise;

    refreshNotificationsPromise = (async () => {
      try {
        while (refreshNotificationsQueued) {
          const nextOptions = { ...queuedRefreshOptions };
          refreshNotificationsQueued = false;
          queuedRefreshOptions = {
            notify: false,
            logAction: false
          };

          await hydrateNotifications();
          const previous = state.notifications.length ? state.notifications.map((entry) => normalizeNotification(entry)) : [];
          const previousActiveIds = new Set(previous.filter((entry) => !entry.resolved).map((entry) => entry.id));
          const derivedState = buildDerivedNotifications(previous);
          state.notifications = derivedState.notifications;
          state.notificationResolvedState = derivedState.notificationResolvedState;
          state.notificationReadState = derivedState.notificationReadState;
          renderAll();
          await saveState();

          if (nextOptions.notify) {
            const newCount = state.notifications.filter((entry) => !entry.resolved && !previousActiveIds.has(entry.id)).length;
            showNotice(newCount ? `${pluralize(newCount, "alert")} refreshed.` : "Notifications updated.", newCount ? "success" : "info");
          }

          if (nextOptions.logAction) {
            const audit = currentAuditActor();
            appendActivityLog({
              ...audit,
              action: "Refreshed notifications",
              actionType: "updated",
              target: "Notification Center",
              details: `${pluralize(state.notifications.filter((entry) => !entry.resolved).length, "active notification")} were refreshed from inventory analytics and expiry checks.`,
              category: "Notifications",
              resultLabel: "Updated",
              resultTone: "success",
              createdAt: nowIso()
            });
            void saveLogs();
          }
        }
      } finally {
        refreshNotificationsPromise = null;
      }
    })();

    return refreshNotificationsPromise;
  };

  refs.sidebarToggle?.addEventListener("click", toggleSidebar);
  refs.sidebarBackdrop?.addEventListener("click", closeMobileSidebar);
  refs.logoutLink?.addEventListener("click", (event) => {
    event.preventDefault();
    logoutModal?.show();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
  });

  window.addEventListener("mss:inventory-updated", () => {
    void refreshNotifications();
  });

  window.addEventListener("mss:notifications-synced", (event) => {
    if (Array.isArray(event.detail?.notifications)) {
      const nextNotifications = event.detail.notifications.map(normalizeNotification);
      if (event.detail?.notificationDismissedState && typeof event.detail.notificationDismissedState === "object") {
        state.notificationDismissedState = normalizeDismissedState(event.detail.notificationDismissedState);
      }
      state.notificationReadState = mergeReadStateWithNotifications(
        {
          ...(event.detail?.notificationReadState && typeof event.detail.notificationReadState === "object"
            ? normalizeReadState(event.detail.notificationReadState)
            : {}),
          ...state.notificationReadState
        },
        nextNotifications
      );
      state.notificationResolvedState = mergeResolvedStateWithNotifications(
        {
          ...(event.detail?.notificationResolvedState && typeof event.detail.notificationResolvedState === "object"
            ? normalizeResolvedState(event.detail.notificationResolvedState)
            : {}),
          ...state.notificationResolvedState
        },
        nextNotifications
      );
      state.notifications = applyReadStateToNotifications(
        applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState),
        state.notificationReadState
      );
      syncNotificationRuntimeCache({
        notificationDismissedState: state.notificationDismissedState,
        notificationReadState: state.notificationReadState,
        notificationResolvedState: state.notificationResolvedState
      });
      renderAll();
      return;
    }
    void refreshNotifications();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshNotifications();
  });

  notificationTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.quickFilter = text(button.dataset.notificationType) || "all";
      renderAll();
    });
  });

  refs.notificationFeed?.addEventListener("click", (event) => {
    const deleteButton = event.target.closest('[data-action="delete-notification"][data-id]');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      const notificationId = text(deleteButton.getAttribute("data-id"));
      const notification = state.notifications.find((entry) => entry.id === notificationId);
      if (!notification) return;
      openDeleteNotificationModal(notification);
      return;
    }

    const row = event.target.closest(".notification-card[data-id]");
    if (!row) return;

    const notificationId = text(row.getAttribute("data-id"));
    const notification = state.notifications.find((entry) => entry.id === notificationId);
    if (!notification) return;

    const openedNotification = normalizeNotification(notification);
    if (!notification.read && notificationMessageModal) {
      pendingReadNotificationId = notificationId;
      openNotificationModal(openedNotification);
      return;
    }

    pendingReadNotificationId = "";
    const readNotification = notification.read ? openedNotification : (markNotificationAsRead(notificationId) || openedNotification);
    openNotificationModal(readNotification);
  });

  refs.confirmDeleteNotificationBtn?.addEventListener("click", confirmDeleteNotification);

  byId("notificationMessageModal")?.addEventListener("shown.bs.modal", () => {
    if (!pendingReadNotificationId) return;
    void markNotificationAsRead(pendingReadNotificationId);
    pendingReadNotificationId = "";
  });

  byId("notificationMessageModal")?.addEventListener("hidden.bs.modal", () => {
    pendingReadNotificationId = "";
  });

  deleteNotificationModalElement?.addEventListener("hidden.bs.modal", () => {
    pendingDeleteNotificationId = "";
    if (refs.deleteNotificationMessage) {
      refs.deleteNotificationMessage.textContent = "Remove this notification from your view only?";
    }
  });

  hydrateNotificationRuntimeCache();
  void refreshNotifications();
})();
