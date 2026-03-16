(() => {
  const STORAGE_KEY = "mss_notifications_v2";
  const ACTIVITY_LOG_STORAGE = "mss_activity_logs_v1";
  const USERS_STORAGE = "mss_users_v1";
  const SESSIONS_STORAGE = "mss_active_sessions_v1";
  const INVENTORY_STORAGE = "mss_inventory_records_v1";
  const MOVEMENTS_STORAGE = "mss_inventory_movements_v1";

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
    notificationModalTime: byId("notificationModalTime")
  };

  const quickFilterButtons = Array.from(document.querySelectorAll("[data-quick-filter]"));
  const notificationMessageModal = byId("notificationMessageModal") && window.bootstrap ? new window.bootstrap.Modal(byId("notificationMessageModal")) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    notifications: []
  };

  const uiState = {
    quickFilter: "all"
  };

  let alertTimer = 0;

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

  const readList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.notifications));
  };

  const findAdminUser = () => {
    const users = readList(USERS_STORAGE);
    return users.find((user) => keyOf(user.role) === "admin") || null;
  };

  const resolveSessionIp = (userId, fallbackIp = "192.168.10.15") => {
    if (!userId) return fallbackIp;
    const sessions = readList(SESSIONS_STORAGE);
    const activeSession = sessions.find((session) => text(session.userId) === text(userId));
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
    const logs = readList(ACTIVITY_LOG_STORAGE);
    logs.unshift({
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
    logs.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    localStorage.setItem(ACTIVITY_LOG_STORAGE, JSON.stringify(logs.slice(0, 60)));
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

  const readInventory = () => {
    const records = readList(INVENTORY_STORAGE)
      .map((entry, index) => normalizeMedicine(entry, index))
      .filter((entry) => text(entry.name));
    return records.length ? records : fallbackInventory;
  };

  const readMovements = () => {
    const records = readList(MOVEMENTS_STORAGE)
      .map(normalizeMovement)
      .filter((entry) => text(entry.medicineId) || text(entry.medicineName));
    return records.length ? records : fallbackMovements;
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
      read: Boolean(entry.read)
    };
  };

  const buildDerivedNotifications = (previous = []) => {
    const previousMap = new Map(previous.map((entry) => [entry.id, entry]));
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
    const pushNotification = (raw) => {
      const nextNotification = normalizeNotification(raw);
      const previousEntry = previousMap.get(nextNotification.id);
      const preserveRead = Boolean(previousEntry) && text(previousEntry.signature) === text(nextNotification.signature);

      notifications.push(normalizeNotification({
        ...nextNotification,
        createdAt: preserveRead ? previousEntry.createdAt : (nextNotification.createdAt || nowIso()),
        updatedAt: nowIso(),
        read: preserveRead ? previousEntry.read : false
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

    notifications.sort((left, right) => {
      if (left.resolved !== right.resolved) return left.resolved ? 1 : -1;
      if (left.read !== right.read) return left.read ? 1 : -1;
      const priorityDelta = (priorityWeight[right.priority] || 0) - (priorityWeight[left.priority] || 0);
      if (priorityDelta) return priorityDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return notifications;
  };

  const filteredNotifications = () => state.notifications.filter((notification) => {
    if (uiState.quickFilter === "status") return notification.category === "Medicine Status";
    if (uiState.quickFilter === "expiring") return notification.category === "Expiring Soon";
    if (uiState.quickFilter === "urgent") {
      return notification.priority === "critical" || notification.priority === "high";
    }
    return true;
  });

  const renderFilterState = () => {
    quickFilterButtons.forEach((button) => {
      const filterKey = text(button.getAttribute("data-quick-filter")) || "all";
      button.classList.toggle("is-active", filterKey === uiState.quickFilter);
    });
  };

  const renderCount = () => {
    if (!refs.notificationCount) return;
    const visibleNotifications = filteredNotifications();
    refs.notificationCount.textContent = `${formatNumber(visibleNotifications.length)} alert${visibleNotifications.length === 1 ? "" : "s"}`;
  };

  const renderFeed = () => {
    if (!refs.notificationFeed) return;
    const visibleNotifications = filteredNotifications();

    if (!visibleNotifications.length) {
      refs.notificationFeed.innerHTML = '<div class="notification-empty">No notifications in this view.</div>';
      return;
    }

    refs.notificationFeed.innerHTML = visibleNotifications.map((notification) => {
      const unreadDot = !notification.read
        ? '<span class="notification-unread-dot" aria-hidden="true"></span>'
        : "";
      const unreadClass = notification.read ? "" : " is-unread";
      return `
        <article class="notification-card${unreadClass}" data-id="${esc(notification.id)}">
          <div class="notification-card__head">
            <div>
              <div class="notification-card__title">${unreadDot}${esc(notification.title)}</div>
              <p class="notification-card__body">${esc(notification.body)}</p>
            </div>
            <span class="${esc(badgeClass(notification.priority))}">${esc(notification.priority)}</span>
          </div>

          <div class="notification-card__meta">
            <span class="notification-meta-label">${esc(notification.category)}</span>
            <span class="notification-meta-separator" aria-hidden="true">|</span>
            <span>${esc(formatDateTime(notification.createdAt))}</span>
            <span class="notification-meta-separator" aria-hidden="true">|</span>
            <span>${esc(relativeTime(notification.createdAt))}</span>
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
    if (refs.notificationModalCategory) refs.notificationModalCategory.textContent = notification.category;
    if (refs.notificationModalTitle) refs.notificationModalTitle.textContent = notification.title;
    if (refs.notificationModalBody) refs.notificationModalBody.textContent = notification.body;
    if (refs.notificationModalTime) refs.notificationModalTime.textContent = formatDateTime(notification.createdAt);

    notificationMessageModal?.show();
  };

  const updateNotification = (id, updater) => {
    const notification = state.notifications.find((entry) => entry.id === id);
    if (!notification) return null;
    updater(notification);
    notification.updatedAt = nowIso();
    saveState();
    renderAll();
    return notification;
  };

  const markRead = (notification, { silent = false } = {}) => {
    if (!notification || notification.read) return;

    const updated = updateNotification(notification.id, (entry) => {
      entry.read = true;
    });
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
    if (!silent) showNotice("Notification marked as read.");
    return updated;
  };

  const refreshNotifications = ({ notify = false, logAction = false } = {}) => {
    const previous = state.notifications.length ? state.notifications : readList(STORAGE_KEY).map(normalizeNotification);
    const previousIds = new Set(previous.map((entry) => entry.id));
    state.notifications = buildDerivedNotifications(previous);
    saveState();
    renderAll();

    if (notify) {
      const newCount = state.notifications.filter((entry) => !previousIds.has(entry.id)).length;
      showNotice(newCount ? `${pluralize(newCount, "alert")} refreshed.` : "Notifications updated.", newCount ? "success" : "info");
    }

    if (logAction) {
      const audit = currentAuditActor();
      appendActivityLog({
        ...audit,
        action: "Refreshed notifications",
        actionType: "updated",
        target: "Notification Center",
        details: `${pluralize(state.notifications.length, "notification")} were refreshed from inventory analytics and expiry checks.`,
        category: "Notifications",
        resultLabel: "Updated",
        resultTone: "success",
        createdAt: nowIso()
      });
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

  window.addEventListener("storage", (event) => {
    if (![INVENTORY_STORAGE, MOVEMENTS_STORAGE].includes(text(event.key))) return;
    refreshNotifications();
  });

  window.addEventListener("mss:inventory-updated", () => {
    refreshNotifications();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshNotifications();
  });

  quickFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      uiState.quickFilter = text(button.getAttribute("data-quick-filter")) || "all";
      renderAll();
    });
  });

  refs.notificationFeed?.addEventListener("click", (event) => {
    const row = event.target.closest("[data-id]");
    if (!row) return;

    const notificationId = text(row.getAttribute("data-id"));
    const notification = state.notifications.find((entry) => entry.id === notificationId);
    if (!notification) return;

    const openedNotification = notification.read ? notification : (markRead(notification, { silent: true }) || notification);
    openNotificationModal(openedNotification);
  });

  refreshNotifications();
})();
