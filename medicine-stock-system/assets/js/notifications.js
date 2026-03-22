(() => {
  const STATE_ENDPOINT = "state-api.php";
  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;
  const ADMIN_NOTIFICATION_HIDDEN_STORAGE_PREFIX = "mss_admin_hidden_notifications_v1";

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
  const notificationViewButtons = Array.from(document.querySelectorAll("[data-notification-view]"));
  const notificationTypeButtons = Array.from(document.querySelectorAll("[data-notification-type]"));

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
    viewFilter: notificationViewButtons.length ? "active" : "all",
    quickFilter: "all"
  };

  let alertTimer = 0;
  let notificationsHydrationPromise = null;
  let pendingDeleteNotificationId = "";
  let adminNotificationHiddenState = {};
  let adminNotificationHiddenStorageKey = "";

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
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
    const baseBody = text(notification?.body) || "Review the medicine notification.";
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

  const syncNotificationStateToServer = async ({ keepalive = false } = {}) => {
    try {
      const payload = await requestJson(STATE_ENDPOINT, {
        method: "POST",
        keepalive,
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          state: {
            notifications: state.notifications,
            notificationDismissedState: state.notificationDismissedState,
            notificationReadState: state.notificationReadState,
            notificationResolvedState: state.notificationResolvedState
          }
        })
      });
      syncStateFromServer(payload?.state || {});
    } catch (error) {
      console.error("Unable to persist notifications.", error);
    }
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
    return syncNotificationStateToServer(options);
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
    state.notificationDismissedState = serverState.notificationDismissedState && typeof serverState.notificationDismissedState === "object"
      ? normalizeDismissedState(serverState.notificationDismissedState)
      : state.notificationDismissedState;
    state.notificationResolvedState = mergeResolvedStateWithNotifications(
      serverState.notificationResolvedState && typeof serverState.notificationResolvedState === "object"
        ? normalizeResolvedState(serverState.notificationResolvedState)
        : state.notificationResolvedState,
      nextNotifications
    );
    const hydratedNotifications = applyResolvedStateToNotifications(nextNotifications, state.notificationResolvedState);
    const nextReadState = serverState.notificationReadState && typeof serverState.notificationReadState === "object"
      ? normalizeReadState(serverState.notificationReadState)
      : state.notificationReadState;
    state.notifications = hydratedNotifications;
    state.notificationReadState = mergeReadStateWithNotifications(nextReadState, hydratedNotifications);
    state.inventory = Array.isArray(serverState.inventory)
      ? serverState.inventory.map((entry, index) => normalizeMedicine(entry, index))
      : state.inventory;
    state.movements = Array.isArray(serverState.movements)
      ? serverState.movements.map(normalizeMovement)
      : state.movements;
    state.users = Array.isArray(serverState.users) ? serverState.users : state.users;
    state.sessions = Array.isArray(serverState.sessions) ? serverState.sessions : state.sessions;
    state.activityLogs = Array.isArray(serverState.logs) ? serverState.logs : state.activityLogs;
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
  const deriveState = (notification) => (notification.read ? "read" : "unread");
  const badgeClass = (priority) => `notification-badge notification-badge--${priority === "critical" ? "critical" : priority === "high" ? "high" : priority === "medium" ? "medium" : "low"}`;

  const normalizeNotification = (entry = {}) => {
    const category = text(entry.category) || "Medicine Status";
    const priority = ["critical", "high", "medium", "low"].includes(keyOf(entry.priority)) ? keyOf(entry.priority) : "medium";
    const title = text(entry.title) || "Medicine alert";
    const body = text(entry.body) || "Review the medicine notification.";

    return {
      id: text(entry.id) || uid(),
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
        createdAt: preserveRead && previousEntry ? previousEntry.createdAt : (nextNotification.createdAt || nowIso()),
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
          body: isOut
            ? `Stock is 0 ${unit}. Reorder immediately.`
            : `${quantityLabel(stock, unit)} remaining. Reorder soon.`,
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

  const matchesViewFilter = (notification) => {
    if (uiState.viewFilter === "active") return !notification.resolved;
    if (uiState.viewFilter === "resolved") return notification.resolved;
    return true;
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
    return true;
  };

  const filteredNotifications = () => getVisibleNotifications().filter((notification) => (
    matchesViewFilter(notification) && matchesQuickFilter(notification)
  ));

  const canRemoveNotificationFromView = (notification) => Boolean(notification?.resolved);

  const syncFilterButtons = (buttons, dataKey, activeValue) => {
    buttons.forEach((button) => {
      const isActive = text(button.dataset[dataKey]) === activeValue;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const renderViewState = () => {
    syncFilterButtons(notificationViewButtons, "notificationView", uiState.viewFilter);
  };

  const renderFilterState = () => {
    syncFilterButtons(notificationTypeButtons, "notificationType", uiState.quickFilter);
  };

  const renderCount = () => {
    if (!refs.notificationCount) return;
    const visibleNotifications = filteredNotifications();
    const noun = uiState.viewFilter === "resolved"
      ? "resolved notification"
      : uiState.viewFilter === "active"
        ? "active alert"
        : "notification";
    refs.notificationCount.textContent = `${formatNumber(visibleNotifications.length)} ${visibleNotifications.length === 1 ? noun : `${noun}s`}`;
  };

  const renderFeed = () => {
    if (!refs.notificationFeed) return;
    const visibleNotifications = filteredNotifications();

    if (!visibleNotifications.length) {
      const emptyMessage = uiState.viewFilter === "resolved"
        ? "No resolved notifications yet."
        : uiState.viewFilter === "active"
          ? "No active alerts right now."
          : "No notifications yet.";
      refs.notificationFeed.innerHTML = `<div class="notification-empty">${esc(emptyMessage)}</div>`;
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
    renderViewState();
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
    if (refs.notificationModalTime) {
      refs.notificationModalTime.textContent = notificationTimelineText(notification);
    }

    notificationMessageModal?.show();
  };

  const updateNotification = (id, updater, { persist = true, keepalive = false } = {}) => {
    const notification = state.notifications.find((entry) => entry.id === id);
    if (!notification) return null;
    updater(notification);
    notification.updatedAt = nowIso();
    if (persist) {
      void saveState({ keepalive });
    }
    renderAll();
    return notification;
  };

  const markRead = (notification, { silent = false } = {}) => {
    if (!notification || notification.read) return;

    const updated = updateNotification(notification.id, (entry) => {
      entry.read = true;
    }, { persist: false });
    if (!updated) return null;

    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: "Marked notification as read",
      actionType: "updated",
      target: updated.title,
      details: `${updated.title} was marked as read in the notification module.`,
      category: "Notifications",
      resultLabel: "Read",
      resultTone: "success",
      createdAt: updated.updatedAt
    });
    if (!updated.resolved) {
      state.notificationReadState = {
        ...state.notificationReadState,
        [updated.id]: updated.signature
      };
    }
    void saveState({ keepalive: true });
    void saveLogs();
    if (!silent) showNotice("Notification marked as read.");
    return updated;
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
      refs.deleteNotificationMessage.textContent = `Remove "${notification.title}" from your view only? This will not affect staff accounts, and resolved notifications older than 90 days are cleaned up automatically.`;
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
    await hydrateNotifications();
    const previous = state.notifications.length ? state.notifications : [];
    const previousActiveIds = new Set(previous.filter((entry) => !entry.resolved).map((entry) => entry.id));
    const derivedState = buildDerivedNotifications(previous);
    state.notifications = derivedState.notifications;
    state.notificationResolvedState = derivedState.notificationResolvedState;
    state.notificationReadState = derivedState.notificationReadState;
    void saveState();
    renderAll();

    if (notify) {
      const newCount = state.notifications.filter((entry) => !entry.resolved && !previousActiveIds.has(entry.id)).length;
      showNotice(newCount ? `${pluralize(newCount, "alert")} refreshed.` : "Notifications updated.", newCount ? "success" : "info");
    }

    if (logAction) {
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
      state.notifications = event.detail.notifications.map(normalizeNotification);
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
      }
      renderAll();
      return;
    }
    void refreshNotifications();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshNotifications();
  });

  notificationViewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.viewFilter = text(button.dataset.notificationView) || "active";
      renderAll();
    });
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

    const row = event.target.closest("[data-id]");
    if (!row) return;

    const notificationId = text(row.getAttribute("data-id"));
    const notification = state.notifications.find((entry) => entry.id === notificationId);
    if (!notification) return;

    const openedNotification = notification.read ? notification : (markRead(notification, { silent: true }) || notification);
    openNotificationModal(openedNotification);
  });

  refs.confirmDeleteNotificationBtn?.addEventListener("click", confirmDeleteNotification);

  deleteNotificationModalElement?.addEventListener("hidden.bs.modal", () => {
    pendingDeleteNotificationId = "";
    if (refs.deleteNotificationMessage) {
      refs.deleteNotificationMessage.textContent = "Remove this notification from your view only?";
    }
  });

  void refreshNotifications();
})();
