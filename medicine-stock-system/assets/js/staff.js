(() => {
  const STORAGE = {
    inventory: "mss_inventory_records_v1",
    movements: "mss_inventory_movements_v1",
    residents: "mss_resident_accounts_v1"
  };
  const ACTIVITY_LOG_STORAGE = "mss_activity_logs_v1";
  const USERS_STORAGE = "mss_users_v1";
  const SESSIONS_STORAGE = "mss_active_sessions_v1";
  const NOTIFICATION_STORAGE = "mss_notifications_v2";

  const HOUSEHOLD_RESIDENT_API = "../household-system/registration-sync.php";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    staffSidebarNotifications: byId("staffSidebarNotifications"),
    staffSidebarNotificationBadge: byId("staffSidebarNotificationBadge"),
    staffAccountToggle: byId("staffAccountToggle"),
    staffAccountName: byId("staffAccountName"),
    staffAccountMeta: byId("staffAccountMeta"),
    staffAccountStatus: byId("staffAccountStatus"),
    dispenseSuccessModal: byId("dispenseSuccessModal"),
    dispenseSuccessTitle: byId("dispenseSuccessTitle"),
    dispenseSuccessBody: byId("dispenseSuccessBody"),
    dashboardLowCount: byId("dashboardLowCount"),
    dashboardExpiringCount: byId("dashboardExpiringCount"),
    dashboardReleasedToday: byId("dashboardReleasedToday"),
    dashboardResidentCount: byId("dashboardResidentCount"),
    dashboardDispenseBtn: byId("dashboardDispenseBtn"),
    staffNotificationCount: byId("staffNotificationCount"),
    staffNotificationFeed: byId("staffNotificationFeed"),
    staffNotificationModalPriority: byId("staffNotificationModalPriority"),
    staffNotificationModalCategory: byId("staffNotificationModalCategory"),
    staffNotificationModalTitle: byId("staffNotificationModalTitle"),
    staffNotificationModalBody: byId("staffNotificationModalBody"),
    staffNotificationModalTime: byId("staffNotificationModalTime"),
    residentSearchInput: byId("residentSearchInput"),
    residentBarangayFilter: byId("residentBarangayFilter"),
    residentSortFilter: byId("residentSortFilter"),
    residentLookupCount: byId("residentLookupCount"),
    residentLookupResults: byId("residentLookupResults"),
    patientProfileSearchInput: byId("patientProfileSearchInput"),
    patientProfileSearchBtn: byId("patientProfileSearchBtn"),
    patientProfileCount: byId("patientProfileCount"),
    patientProfileList: byId("patientProfileList"),
    dispenseResidentSearchBox: byId("dispenseResidentSearchBox"),
    dispenseResidentSearch: byId("dispenseResidentSearch"),
    dispenseResidentSearchBtn: byId("dispenseResidentSearchBtn"),
    dispenseResidentPreview: byId("dispenseResidentPreview"),
    dispenseResidentResults: byId("dispenseResidentResults"),
    dispenseMedicineCard: byId("dispenseMedicineCard"),
    residentFormModal: byId("residentFormModal"),
    residentHouseholdPanel: byId("residentHouseholdPanel"),
    residentModeCabarianBtn: byId("residentModeCabarianBtn"),
    residentModeManualBtn: byId("residentModeManualBtn"),
    residentCabarianSearch: byId("residentCabarianSearch"),
    residentCabarianSearchBtn: byId("residentCabarianSearchBtn"),
    residentCabarianCount: byId("residentCabarianCount"),
    residentCabarianResults: byId("residentCabarianResults"),
    residentSummaryModal: byId("residentSummaryModal"),
    selectedResidentCard: byId("selectedResidentCard"),
    selectedResidentName: byId("selectedResidentName"),
    selectedResidentMeta: byId("selectedResidentMeta"),
    selectedResidentReleaseCount: byId("selectedResidentReleaseCount"),
    selectedResidentLastMedicineValue: byId("selectedResidentLastMedicineValue"),
    selectedResidentLastReleaseValue: byId("selectedResidentLastReleaseValue"),
    selectedResidentUseBtn: byId("selectedResidentUseBtn"),
    toggleResidentFormBtn: byId("toggleResidentFormBtn"),
    closeResidentFormBtn: byId("closeResidentFormBtn"),
    residentFormPanel: byId("residentFormPanel"),
    residentForm: byId("residentForm"),
    quickResidentName: byId("quickResidentName"),
    quickResidentBarangay: byId("quickResidentBarangay"),
    quickResidentZone: byId("quickResidentZone"),
    quickResidentCity: byId("quickResidentCity"),
    dispenseForm: byId("dispenseForm"),
    dispenseMedicineSearch: byId("dispenseMedicineSearch"),
    dispenseMedicine: byId("dispenseMedicine"),
    dispenseMedicineResults: byId("dispenseMedicineResults"),
    dispenseStockPreview: byId("dispenseStockPreview"),
    dispenseDiseaseCategory: byId("dispenseDiseaseCategory"),
    dispenseIllness: byId("dispenseIllness"),
    dispenseQuantity: byId("dispenseQuantity"),
    dispenseDate: byId("dispenseDate"),
    dispenseCancelBtn: byId("dispenseCancelBtn"),
    dispenseSubmitBtn: byId("dispenseSubmitBtn"),
    historyTitle: byId("historyTitle"),
    historySubtitle: byId("historySubtitle"),
    historyCount: byId("historyCount"),
    historyList: byId("historyList"),
    settingsSummaryView: byId("settingsSummaryView"),
    settingsCredentialsPanel: byId("settingsCredentialsPanel"),
    settingsForm: byId("settingsForm"),
    settingsStatusChip: byId("settingsStatusChip"),
    settingsChangeBtn: byId("settingsChangeBtn"),
    settingsFullName: byId("settingsFullName"),
    settingsUsername: byId("settingsUsername"),
    settingsPassword: byId("settingsPassword"),
    settingsConfirmPassword: byId("settingsConfirmPassword"),
    settingsSubmitBtn: byId("settingsSubmitBtn"),
    settingsNotice: byId("settingsNotice"),
    settingsContact: byId("settingsContact"),
    settingsRole: byId("settingsRole")
  };
  const staffNavLinks = Array.from(document.querySelectorAll("#sidebar .menu a[href^='#']"));
  const staffSections = Array.from(document.querySelectorAll("[data-staff-section]"));

  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;
  const dispenseSuccessModal = refs.dispenseSuccessModal && window.bootstrap
    ? new window.bootstrap.Modal(refs.dispenseSuccessModal, { backdrop: false, keyboard: false })
    : null;
  const staffNotificationMessageModal = byId("staffNotificationMessageModal") && window.bootstrap ? new window.bootstrap.Modal(byId("staffNotificationMessageModal")) : null;
  const residentFormModal = refs.residentFormModal && window.bootstrap ? new window.bootstrap.Modal(refs.residentFormModal) : null;
  const residentSummaryModal = refs.residentSummaryModal && window.bootstrap ? new window.bootstrap.Modal(refs.residentSummaryModal) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    inventory: [],
    movements: [],
    residentAccounts: [],
    residentSearch: "",
    patientProfileSearch: "",
    dispenseResidentSearch: "",
    residentBarangayFilter: "all",
    residentSort: "recent",
    selectedResidentId: "",
    currentUserId: "",
    residentFormOpen: false,
    residentFormMode: "cabarian",
    residentCabarianSearch: "",
    householdResidentsLoaded: false,
    householdResidentsSyncing: false
  };

  let alertTimer = 0;
  let dispenseSuccessTimer = 0;

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }).format(parsed);
  };
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
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const todayInputValue = () => {
    const current = new Date();
    const offset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - offset).toISOString().slice(0, 10);
  };

  if (refs.dispenseDate) refs.dispenseDate.value = todayInputValue();

  const daysUntil = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / 86400000);
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

  const relativeTime = (value) => {
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

  const notificationPriorityWeight = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  const badgeClass = (priority) => `notification-badge notification-badge--${
    priority === "critical" ? "critical" : priority === "high" ? "high" : priority === "medium" ? "medium" : "low"
  }`;

  const normalizeNotification = (entry = {}) => {
    const priority = ["critical", "high", "medium", "low"].includes(keyOf(entry.priority)) ? keyOf(entry.priority) : "medium";
    return {
      id: text(entry.id) || uid(),
      category: text(entry.category) || "Medicine Status",
      priority,
      title: text(entry.title) || "Medicine alert",
      body: text(entry.body) || "Review the medicine notification.",
      createdAt: text(entry.createdAt) || nowIso(),
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      read: Boolean(entry.read),
      signature: text(entry.signature)
    };
  };

  const getStoredNotifications = () => readList(NOTIFICATION_STORAGE)
    .map(normalizeNotification)
    .sort((left, right) => {
      if (left.read !== right.read) return left.read ? 1 : -1;
      const priorityDelta = (notificationPriorityWeight[right.priority] || 0) - (notificationPriorityWeight[left.priority] || 0);
      if (priorityDelta) return priorityDelta;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

  const updateStoredNotification = (id, updater) => {
    let updatedNotification = null;
    const nextItems = readList(NOTIFICATION_STORAGE).map((entry) => {
      const normalized = normalizeNotification(entry);
      if (text(normalized.id) !== text(id)) return entry;

      const draft = { ...normalized };
      updater(draft);
      draft.updatedAt = nowIso();
      updatedNotification = draft;
      return { ...entry, ...draft };
    });

    if (!updatedNotification) return null;
    localStorage.setItem(NOTIFICATION_STORAGE, JSON.stringify(nextItems));
    return updatedNotification;
  };

  const openStaffNotificationCenter = () => {
    renderStaffNotifications();
    openSection("notifications");
  };

  const openStaffNotificationDetail = (notification) => {
    if (!notification) return;
    if (refs.staffNotificationModalPriority) {
      refs.staffNotificationModalPriority.className = badgeClass(notification.priority);
      refs.staffNotificationModalPriority.textContent = notification.priority;
    }
    if (refs.staffNotificationModalCategory) refs.staffNotificationModalCategory.textContent = notification.category;
    if (refs.staffNotificationModalTitle) refs.staffNotificationModalTitle.textContent = notification.title;
    if (refs.staffNotificationModalBody) refs.staffNotificationModalBody.textContent = notification.body;
    if (refs.staffNotificationModalTime) refs.staffNotificationModalTime.textContent = formatDateTime(notification.createdAt);
    staffNotificationMessageModal?.show();
  };

  const renderStaffNotifications = () => {
    const notifications = getStoredNotifications();
    const unreadCount = notifications.filter((entry) => !entry.read).length;

    [refs.staffSidebarNotificationBadge].forEach((badge) => {
      if (!badge) return;
      badge.textContent = formatNumber(unreadCount);
      badge.classList.toggle("d-none", unreadCount <= 0);
    });

    if (refs.staffNotificationCount) {
      refs.staffNotificationCount.textContent = `${formatNumber(notifications.length)} alert${notifications.length === 1 ? "" : "s"}`;
    }

    if (!refs.staffNotificationFeed) return;

    if (!notifications.length) {
      refs.staffNotificationFeed.innerHTML = '<div class="notification-empty">No notifications yet for this dashboard.</div>';
      return;
    }

    refs.staffNotificationFeed.innerHTML = notifications.map((notification) => {
      const unreadDot = !notification.read
        ? '<span class="notification-unread-dot" aria-hidden="true"></span>'
        : "";
      const unreadClass = notification.read ? "" : " is-unread";

      return `
        <article class="notification-card${unreadClass}" data-staff-notification-id="${esc(notification.id)}">
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

  const accountRoleLabel = (value) => keyOf(value) === "staff" ? "Staff" : "Barangay Health Worker";
  const accountPresenceLabel = (value) => {
    const normalized = text(value);
    if (!normalized) return "Offline";
    if (keyOf(normalized) === "active") return "Active";
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  };
  const renderTopbarAccount = () => {
    const user = getCurrentBhwUser();
    const session = user ? getCurrentBhwSession(user.id) : null;
    const resolvedPresence = text(session?.presence) || (text(user?.status) === "Active" ? "Online" : text(user?.status));

    if (!user) {
      if (refs.staffAccountName) refs.staffAccountName.textContent = "Staff Account";
      if (refs.staffAccountMeta) refs.staffAccountMeta.textContent = "Barangay Health Worker";
      if (refs.staffAccountStatus) {
        refs.staffAccountStatus.textContent = "Not linked";
        refs.staffAccountStatus.dataset.state = "not-linked";
      }
      return;
    }

    if (refs.staffAccountName) refs.staffAccountName.textContent = user.fullName || "Assigned Staff";
    if (refs.staffAccountMeta) refs.staffAccountMeta.textContent = accountRoleLabel(user.role);
    if (refs.staffAccountStatus) {
      refs.staffAccountStatus.textContent = accountPresenceLabel(resolvedPresence || "Online");
      refs.staffAccountStatus.dataset.state = keyOf(resolvedPresence || "online") || "online";
    }
  };

  const USER_ROLE_ADMIN = "Admin";
  const USER_ROLE_BHW = "BHW";
  const parseTimestamp = (value) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const normalizeUserRole = (value) => text(value) === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW;
  const normalizeModuleUser = (entry = {}) => {
    const role = normalizeUserRole(text(entry.role) || text(entry.accountType));
    return {
      ...entry,
      id: text(entry.id) || uid(),
      fullName: text(entry.fullName),
      username: text(entry.username),
      contact: text(entry.contact),
      role,
      accountType: role === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW,
      status: text(entry.status) || "Active",
      password: String(entry.password || ""),
      createdAt: text(entry.createdAt) || nowIso(),
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      updatedBy: text(entry.updatedBy) || "System Seed"
    };
  };
  const getStoredUsers = () => readList(USERS_STORAGE).map(normalizeModuleUser);
  const getStoredSessions = () => readList(SESSIONS_STORAGE)
    .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
  const writeStoredUsers = (users) => localStorage.setItem(USERS_STORAGE, JSON.stringify(users));
  const writeStoredSessions = (sessions) => localStorage.setItem(SESSIONS_STORAGE, JSON.stringify(sessions));
  const roleName = (value) => keyOf(value) === "staff" ? "Staff" : "BHW";
  const defaultUsernameForRole = (role) => keyOf(role) === "staff" ? "staff.user" : "bhw.user";
  const defaultIpForRole = (role) => keyOf(role) === "staff" ? "192.168.10.24" : "192.168.10.31";

  const makeUsername = (value, fallback = "bhw.user") => {
    const slug = keyOf(value)
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    return slug || fallback;
  };

  const findStoredUser = ({ fullName = "", accountType = "" } = {}) => {
    const users = readList(USERS_STORAGE);
    if (!fullName) return null;

    return users.find((user) => {
      const sameName = keyOf(user.fullName) === keyOf(fullName);
      if (!sameName) return false;
      if (!accountType) return true;
      return keyOf(user.accountType) === keyOf(accountType) || keyOf(user.role) === keyOf(accountType);
    }) || null;
  };

  const resolveSessionIp = (userId, fallbackIp) => {
    if (!userId) return fallbackIp;
    const sessions = readList(SESSIONS_STORAGE);
    const activeSession = sessions.find((session) => text(session.userId) === text(userId));
    return text(activeSession?.ipAddress) || fallbackIp;
  };

  const getCurrentBhwUser = () => {
    const users = getStoredUsers();
    const selected = users.find((user) => text(user.id) === text(state.currentUserId) && text(user.role) !== USER_ROLE_ADMIN);
    if (selected) return selected;

    const sessions = getStoredSessions();
    const fromSession = sessions
      .map((session) => users.find((user) => text(user.id) === text(session.userId)))
      .find((user) => user && text(user.role) !== USER_ROLE_ADMIN && text(user.status) === "Active");

    const fallback = fromSession
      || users.find((user) => text(user.role) !== USER_ROLE_ADMIN && text(user.status) === "Active")
      || users.find((user) => text(user.role) !== USER_ROLE_ADMIN)
      || null;

    state.currentUserId = fallback?.id || "";
    return fallback;
  };

  const getCurrentBhwSession = (userId) => getStoredSessions().find((session) => text(session.userId) === text(userId)) || null;

  const setSettingsEditorOpen = (open) => {
    refs.settingsSummaryView?.classList.toggle("d-none", open);
    refs.settingsCredentialsPanel?.classList.toggle("d-none", !open);
  };

  const setSettingsDisabled = (disabled) => {
    refs.settingsForm?.querySelectorAll("input, button").forEach((field) => {
      field.disabled = disabled;
    });
    if (refs.settingsChangeBtn) refs.settingsChangeBtn.disabled = disabled;
    if (!disabled) {
      if (refs.settingsRole) refs.settingsRole.disabled = false;
    }
  };

  const appendActivityLog = ({
    actor = "BHW",
    username = "bhw.user",
    action = "Updated medicine release",
    actionType = "updated",
    target = "",
    details = "",
    category = "Dispensing",
    resultLabel = "Success",
    resultTone = "success",
    createdAt = nowIso(),
    ipAddress = "192.168.10.31"
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

  const saveState = () => {
    localStorage.setItem(STORAGE.inventory, JSON.stringify(state.inventory));
    localStorage.setItem(STORAGE.movements, JSON.stringify(state.movements));
    localStorage.setItem(STORAGE.residents, JSON.stringify(state.residentAccounts));
  };
  const emitInventoryNotificationRefresh = () => {
    window.dispatchEvent(new CustomEvent("mss:inventory-updated"));
  };

  const showNotice = (message, type = "success") => {
    if (!refs.moduleAlert) return;
    refs.moduleAlert.className = `alert alert-${type}`;
    refs.moduleAlert.textContent = message;
    refs.moduleAlert.classList.remove("d-none");
    window.clearTimeout(alertTimer);
    alertTimer = window.setTimeout(() => refs.moduleAlert?.classList.add("d-none"), 3200);
  };

  const clearNotice = () => {
    window.clearTimeout(alertTimer);
    refs.moduleAlert?.classList.add("d-none");
  };

  const setSettingsNotice = (message, tone = "muted") => {
    if (!refs.settingsNotice) return;
    refs.settingsNotice.textContent = message;
    refs.settingsNotice.classList.remove("is-muted", "is-danger", "is-success");
    refs.settingsNotice.classList.add(
      tone === "danger" ? "is-danger" : tone === "success" ? "is-success" : "is-muted"
    );
  };

  const showTransientSuccess = ({ title = "Success", body = "Action completed successfully.", fallback = "Saved successfully." } = {}) => {
    if (!dispenseSuccessModal) {
      showNotice(fallback);
      return;
    }

    window.clearTimeout(alertTimer);
    refs.moduleAlert?.classList.add("d-none");

    if (refs.dispenseSuccessTitle) refs.dispenseSuccessTitle.textContent = title;
    if (refs.dispenseSuccessBody) refs.dispenseSuccessBody.textContent = body;

    window.clearTimeout(dispenseSuccessTimer);
    dispenseSuccessModal.show();
    dispenseSuccessTimer = window.setTimeout(() => dispenseSuccessModal.hide(), 1500);
  };

  const showDispenseSuccess = ({ medicineName = "Medicine", residentName = "Resident", quantity = 0, unit = "units" } = {}) => {
    showTransientSuccess({
      title: "Successfully Dispensed",
      body: `${medicineName} was dispensed to ${residentName} (${formatNumber(quantity)} ${unit}).`,
      fallback: `${medicineName} dispensed to ${residentName}.`
    });
  };

  const showResidentSelectedSuccess = ({ residentName = "Resident" } = {}) => {
    showTransientSuccess({
      title: "Resident Selected",
      body: `${residentName} is ready for dispensing.`,
      fallback: `${residentName} is ready for dispensing.`
    });
  };

  const closeMobileSidebar = () => {
    refs.sidebar?.classList.remove("open");
    refs.sidebarBackdrop?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  };

  const setActiveSection = (sectionId) => {
    const fallbackId = staffSections[0]?.id || "";
    const nextId = staffSections.some((section) => section.id === sectionId) ? sectionId : fallbackId;
    if (!nextId) return;

    if (nextId !== "my-settings") {
      setSettingsEditorOpen(false);
    }

    if (nextId === "notifications") {
      renderStaffNotifications();
    }

    staffSections.forEach((section) => {
      section.classList.toggle("is-active", section.id === nextId);
    });

    staffNavLinks.forEach((link) => {
      link.classList.toggle("active", text(link.getAttribute("href")).replace(/^#/, "") === nextId);
    });
  };

  const openSection = (sectionId) => {
    if (!sectionId) return;
    setActiveSection(sectionId);
    if (history.replaceState) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${sectionId}`);
    }
    closeMobileSidebar();
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

  const normalizeMedicine = (entry = {}) => {
    const parsedExpiry = new Date(text(entry.expiryDate));
    const safeExpiry = Number.isNaN(parsedExpiry.getTime())
      ? new Date(Date.now() + (180 * 86400000)).toISOString().slice(0, 10)
      : parsedExpiry.toISOString().slice(0, 10);

    return {
      id: text(entry.id) || uid(),
      name: text(entry.name),
      genericName: text(entry.genericName),
      category: text(entry.category) || "General",
      form: text(entry.form) || "Tablet",
      strength: text(entry.strength),
      stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
      reorderLevel: Math.max(1, Math.round(numeric(entry.reorderLevel) || 1)),
      unit: text(entry.unit) || "units",
      batchNumber: text(entry.batchNumber) || "-",
      expiryDate: safeExpiry,
      supplier: text(entry.supplier) || "Ligao City Coastal RHU Supply",
      location: text(entry.location) || "Main Cabinet",
      unitCost: Number(numeric(entry.unitCost).toFixed(2)),
      updatedBy: text(entry.updatedBy) || "Nurse-in-Charge",
      lastUpdatedAt: text(entry.lastUpdatedAt) || nowIso()
    };
  };

  const normalizeMovement = (entry = {}) => ({
    id: text(entry.id) || uid(),
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName),
    actionType: text(entry.actionType) || "adjusted",
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    diseaseCategory: text(entry.diseaseCategory),
    illness: text(entry.illness),
    note: text(entry.note) || "Inventory movement recorded.",
    stockBefore: Math.max(0, Math.round(numeric(entry.stockBefore))),
    stockAfter: Math.max(0, Math.round(numeric(entry.stockAfter))),
    createdAt: text(entry.createdAt) || nowIso(),
    user: text(entry.user) || "Nurse-in-Charge",
    recipientId: text(entry.recipientId),
    recipientName: text(entry.recipientName),
    recipientBarangay: text(entry.recipientBarangay),
    releasedByRole: text(entry.releasedByRole),
    releasedByName: text(entry.releasedByName)
  });

  const normalizeResidentAccount = (entry = {}) => ({
    id: text(entry.id) || text(entry.residentId) || text(entry.resident_id) || uid(),
    residentId: text(entry.residentId) || text(entry.resident_id) || `MSR-${new Date().getFullYear()}-${uid().slice(-4).toUpperCase()}`,
    householdId: text(entry.householdId) || text(entry.household_id),
    fullName: text(entry.fullName) || text(entry.full_name) || "Resident Account",
    barangay: text(entry.barangay) || "Cabarian",
    zone: text(entry.zone),
    city: text(entry.city) || "Ligao City",
    province: text(entry.province) || "Albay",
    address: text(entry.address),
    source: text(entry.source) || "medicine-system",
    lastDispensedAt: text(entry.lastDispensedAt),
    lastDispensedMedicine: text(entry.lastDispensedMedicine)
  });

  const residentAddressLabel = (resident) => [
    text(resident.zone),
    text(resident.barangay),
    text(resident.city)
  ].filter(Boolean).join(", ");

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;
  const medicinePickerMeta = (medicine) => [
    text(medicine.genericName),
    text(medicine.form),
    text(medicine.batchNumber) ? `Batch ${text(medicine.batchNumber)}` : ""
  ].filter(Boolean).join(" | ");
  const medicineSearchText = (medicine) => [
    medicineLabel(medicine),
    text(medicine.genericName),
    text(medicine.category),
    text(medicine.form),
    text(medicine.strength),
    text(medicine.batchNumber),
    text(medicine.unit)
  ].join(" ").toLowerCase();
  const getSortedMedicines = () => [...state.inventory].sort((left, right) => medicineLabel(left).localeCompare(medicineLabel(right)));
  const movementConditionLabel = (movement) => {
    const diseaseCategory = text(movement?.diseaseCategory);
    const illness = text(movement?.illness);
    if (diseaseCategory && illness) return `${diseaseCategory} | ${illness}`;
    return diseaseCategory || illness || "";
  };
  const getDispenseMovements = () => state.movements
    .filter((movement) => keyOf(movement.actionType) === "dispense")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const movementMatchesResident = (movement, resident) => (
    text(movement.recipientId).toLowerCase() === text(resident.residentId).toLowerCase()
    || (
      !text(movement.recipientId)
      && text(movement.recipientName).toLowerCase() === text(resident.fullName).toLowerCase()
    )
  );
  const getResidentDispenseHistory = (resident) => {
    if (!resident) return [];
    return getDispenseMovements().filter((movement) => movementMatchesResident(movement, resident));
  };
  const getResidentStatusMeta = ({ totalReleases = 0, lastMovement = null } = {}) => {
    if (!lastMovement || totalReleases <= 0) {
      return { label: "New", tone: "neutral", helper: "No recorded dispense yet." };
    }

    const daysSinceLastRelease = Math.max(0, Math.round((Date.now() - new Date(lastMovement.createdAt).getTime()) / 86400000));
    if (daysSinceLastRelease <= 7) {
      return { label: "Recent", tone: "success", helper: "Dispensed within the last 7 days." };
    }
    if (totalReleases >= 5) {
      return { label: "Frequent", tone: "success", helper: "Multiple dispensing records on file." };
    }
    if (daysSinceLastRelease <= 30) {
      return { label: "Active", tone: "success", helper: "Dispensed within the last 30 days." };
    }
    return { label: "Follow-up", tone: "warning", helper: "No recent medicine dispensing recorded." };
  };
  const getResidentStats = (resident) => {
    const history = getResidentDispenseHistory(resident);
    const lastMovement = history[0] || null;
    return {
      history,
      totalReleases: history.length,
      totalUnits: history.reduce((total, movement) => total + Math.max(0, numeric(movement.quantity)), 0),
      lastMovement,
      lastMedicine: text(lastMovement?.medicineName) || text(resident?.lastDispensedMedicine) || "-",
      lastReleaseAt: text(lastMovement?.createdAt) || text(resident?.lastDispensedAt),
      status: getResidentStatusMeta({ totalReleases: history.length, lastMovement })
    };
  };
  const residentStatusChipClass = (tone) => {
    if (tone === "warning") return "staff-chip staff-chip--warning";
    if (tone === "neutral") return "staff-chip staff-chip--neutral";
    return "staff-chip";
  };
  const stockStatusChipClass = (tone) => {
    if (tone === "warning") return "staff-chip staff-chip--warning";
    if (tone === "danger") return "staff-chip staff-chip--danger";
    return "staff-chip";
  };

  const seedInventory = () => ([
    {
      name: "Paracetamol",
      genericName: "Acetaminophen",
      category: "Analgesic",
      form: "Tablet",
      strength: "500mg",
      stockOnHand: 540,
      reorderLevel: 220,
      unit: "tablets",
      batchNumber: "PCM-2026-041",
      expiryDate: "2026-09-14",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Main Cabinet A",
      unitCost: 2.15
    },
    {
      name: "Amoxicillin",
      genericName: "Amoxicillin Trihydrate",
      category: "Antibiotic",
      form: "Capsule",
      strength: "500mg",
      stockOnHand: 95,
      reorderLevel: 160,
      unit: "capsules",
      batchNumber: "AMX-2026-013",
      expiryDate: "2026-05-22",
      supplier: "DOH Provincial Supply",
      location: "Antibiotic Shelf",
      unitCost: 5.4
    },
    {
      name: "Cetirizine",
      genericName: "Cetirizine Hydrochloride",
      category: "Antihistamine",
      form: "Tablet",
      strength: "10mg",
      stockOnHand: 132,
      reorderLevel: 120,
      unit: "tablets",
      batchNumber: "CTZ-2026-020",
      expiryDate: "2026-08-09",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Allergy Drawer",
      unitCost: 3.8
    },
    {
      name: "ORS",
      genericName: "Oral Rehydration Salts",
      category: "Hydration",
      form: "Sachet",
      strength: "20.5g",
      stockOnHand: 62,
      reorderLevel: 120,
      unit: "sachets",
      batchNumber: "ORS-2026-115",
      expiryDate: "2026-04-30",
      supplier: "DOH Provincial Supply",
      location: "Emergency Rack",
      unitCost: 7.25
    },
    {
      name: "Lagundi",
      genericName: "Vitex negundo",
      category: "Herbal",
      form: "Syrup",
      strength: "60mL",
      stockOnHand: 28,
      reorderLevel: 40,
      unit: "bottles",
      batchNumber: "LGD-2026-018",
      expiryDate: "2026-04-16",
      supplier: "LGU Herbal Procurement",
      location: "Liquid Cabinet",
      unitCost: 68
    },
    {
      name: "Zinc Sulfate",
      genericName: "Zinc Sulfate",
      category: "Supplement",
      form: "Tablet",
      strength: "20mg",
      stockOnHand: 0,
      reorderLevel: 90,
      unit: "tablets",
      batchNumber: "ZNC-2026-006",
      expiryDate: "2026-07-20",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Supplement Shelf",
      unitCost: 1.9
    },
    {
      name: "Metformin",
      genericName: "Metformin Hydrochloride",
      category: "Maintenance",
      form: "Tablet",
      strength: "500mg",
      stockOnHand: 186,
      reorderLevel: 140,
      unit: "tablets",
      batchNumber: "MTF-2026-044",
      expiryDate: "2026-11-03",
      supplier: "City Medical Depot",
      location: "Maintenance Cabinet",
      unitCost: 4.3
    },
    {
      name: "Salbutamol",
      genericName: "Salbutamol Sulfate",
      category: "Respiratory",
      form: "Tablet",
      strength: "2mg",
      stockOnHand: 74,
      reorderLevel: 110,
      unit: "tablets",
      batchNumber: "SLB-2026-017",
      expiryDate: "2026-06-18",
      supplier: "City Medical Depot",
      location: "Respiratory Tray",
      unitCost: 3.15
    },
    {
      name: "Amlodipine",
      genericName: "Amlodipine Besylate",
      category: "Maintenance",
      form: "Tablet",
      strength: "5mg",
      stockOnHand: 154,
      reorderLevel: 100,
      unit: "tablets",
      batchNumber: "AML-2026-008",
      expiryDate: "2026-10-01",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Maintenance Cabinet",
      unitCost: 6.1
    }
  ]).map((entry, index) => normalizeMedicine({
    ...entry,
    lastUpdatedAt: new Date(Date.now() - ((index + 1) * 3600000)).toISOString()
  }));

  const seedResidentAccounts = () => ([
    {
      residentId: "RS-2026-0012",
      householdId: "HH-2026-004",
      fullName: "Maria Santos",
      barangay: "Cabarian",
      zone: "Zone 2",
      city: "Ligao City",
      province: "Albay",
      source: "household-system"
    },
    {
      residentId: "RS-2026-0048",
      householdId: "HH-2026-011",
      fullName: "Juan Dela Cruz",
      barangay: "Cabarian",
      zone: "Zone 4",
      city: "Ligao City",
      province: "Albay",
      source: "household-system"
    },
    {
      residentId: "MSR-2026-0001",
      fullName: "Lorna Reyes",
      barangay: "Bonga",
      city: "Ligao City",
      province: "Albay",
      source: "medicine-system"
    },
    {
      residentId: "MSR-2026-0002",
      fullName: "Kevin Ramos",
      barangay: "Tinago",
      city: "Ligao City",
      province: "Albay",
      source: "medicine-system"
    },
    {
      residentId: "MSR-2026-0003",
      fullName: "Ana Lopez",
      barangay: "Busac",
      city: "Oas",
      province: "Albay",
      source: "medicine-system"
    }
  ]).map(normalizeResidentAccount);

  const seedMovements = (inventory) => {
    const findByName = (name) => inventory.find((medicine) => medicine.name === name);
    return [
      {
        medicineName: "Paracetamol",
        actionType: "restock",
        quantity: 180,
        stockBefore: 360,
        stockAfter: 540,
        createdAt: new Date(Date.now() - (2 * 3600000)).toISOString(),
        note: "Monthly replenishment from RHU supply."
      },
      {
        medicineName: "ORS",
        actionType: "dispense",
        quantity: 18,
        diseaseCategory: "Diarrhea",
        illness: "Acute diarrhea",
        stockBefore: 80,
        stockAfter: 62,
        createdAt: new Date(Date.now() - (5 * 3600000)).toISOString(),
        note: "Distributed for diarrhea support cases.",
        recipientId: "RS-2026-0012",
        recipientName: "Maria Santos",
        recipientBarangay: "Cabarian",
        releasedByRole: "BHW",
        releasedByName: "Assigned BHW"
      },
      {
        medicineName: "Lagundi",
        actionType: "dispense",
        quantity: 6,
        diseaseCategory: "Cough / Cold",
        illness: "Cough and colds",
        stockBefore: 34,
        stockAfter: 28,
        createdAt: new Date(Date.now() - (9 * 3600000)).toISOString(),
        note: "Dispensed for cough and colds consultations.",
        recipientId: "MSR-2026-0001",
        recipientName: "Lorna Reyes",
        recipientBarangay: "Bonga",
        releasedByRole: "BHW",
        releasedByName: "Field BHW"
      },
      {
        medicineName: "Zinc Sulfate",
        actionType: "dispose",
        quantity: 20,
        stockBefore: 20,
        stockAfter: 0,
        createdAt: new Date(Date.now() - (26 * 3600000)).toISOString(),
        note: "Expired batch removed from shelf."
      },
      {
        medicineName: "Salbutamol",
        actionType: "restock",
        quantity: 40,
        stockBefore: 34,
        stockAfter: 74,
        createdAt: new Date(Date.now() - (34 * 3600000)).toISOString(),
        note: "Supplemental request delivered by city medical depot."
      }
    ].map((entry) => {
      const medicine = findByName(entry.medicineName);
      return normalizeMovement({
        ...entry,
        medicineId: medicine?.id || "",
        user: entry.releasedByName || "Nurse-in-Charge"
      });
    });
  };

  const nextResidentAccountCode = () => {
    const year = new Date().getFullYear();
    const count = state.residentAccounts.filter((resident) => text(resident.residentId).startsWith(`MSR-${year}-`)).length + 1;
    return `MSR-${year}-${String(count).padStart(4, "0")}`;
  };

  const mergeResidentAccounts = (entries = []) => {
    let changed = false;

    entries.forEach((entry) => {
      const incoming = normalizeResidentAccount(entry);
      const existing = state.residentAccounts.find((resident) =>
        text(resident.residentId).toLowerCase() === text(incoming.residentId).toLowerCase()
        || (
          text(resident.fullName).toLowerCase() === text(incoming.fullName).toLowerCase()
          && text(resident.barangay).toLowerCase() === text(incoming.barangay).toLowerCase()
        )
      );

      if (!existing) {
        state.residentAccounts.push(incoming);
        changed = true;
        return;
      }

      const snapshot = JSON.stringify(existing);
      existing.householdId = existing.householdId || incoming.householdId;
      existing.barangay = existing.barangay || incoming.barangay;
      existing.zone = existing.zone || incoming.zone;
      existing.city = existing.city || incoming.city;
      existing.province = existing.province || incoming.province;
      existing.address = existing.address || incoming.address;
      existing.source = existing.source === "medicine-system" ? existing.source : incoming.source;
      existing.lastDispensedAt = existing.lastDispensedAt || incoming.lastDispensedAt;
      existing.lastDispensedMedicine = existing.lastDispensedMedicine || incoming.lastDispensedMedicine;

      if (JSON.stringify(existing) !== snapshot) {
        changed = true;
      }
    });

    state.residentAccounts.sort((left, right) => text(left.fullName).localeCompare(text(right.fullName)));
    return changed;
  };

  const ensureSeedData = () => {
    state.inventory = readList(STORAGE.inventory).map(normalizeMedicine);
    state.movements = readList(STORAGE.movements).map(normalizeMovement);
    state.residentAccounts = readList(STORAGE.residents).map(normalizeResidentAccount);

    if (!state.inventory.length) {
      state.inventory = seedInventory();
    }

    if (!state.residentAccounts.length) {
      state.residentAccounts = seedResidentAccounts();
    }

    if (!state.movements.length) {
      state.movements = seedMovements(state.inventory);
    }

    saveState();
  };

  const syncHouseholdResidents = async () => {
    if (state.householdResidentsLoaded) return;
    state.householdResidentsLoaded = true;
    state.householdResidentsSyncing = true;
    renderCabarianResidentResults();

    try {
      const items = [];
      let offset = 0;
      let pageCount = 0;

      while (pageCount < 6) {
        const params = new URLSearchParams({
          action: "list_residents",
          limit: "250",
          offset: String(offset)
        });

        const response = await fetch(`${HOUSEHOLD_RESIDENT_API}?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        if (!response.ok || !payload || payload.success !== true) break;

        const pageItems = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        items.push(...pageItems);
        pageCount += 1;

        if (pageItems.length < 250) break;
        offset += 250;
      }

      if (!items.length) return;

      const normalized = items.map((entry) => normalizeResidentAccount({
        resident_id: entry?.resident_id,
        household_id: entry?.household_id,
        full_name: entry?.full_name,
        zone: entry?.zone,
        barangay: "Cabarian",
        city: "Ligao City",
        province: "Albay",
        source: "household-system"
      }));

      if (mergeResidentAccounts(normalized)) {
        saveState();
        renderResidentSearchResults();
        renderPatientProfiles();
        renderCabarianResidentResults();
        renderDashboard();
      }
    } catch (error) {
      // Keep local resident lookup available even if sync fails.
    } finally {
      state.householdResidentsSyncing = false;
      renderCabarianResidentResults();
    }
  };

  const getStatus = (medicine) => {
    const stock = numeric(medicine.stockOnHand);
    const reorderLevel = Math.max(1, numeric(medicine.reorderLevel));
    const expiryDays = daysUntil(medicine.expiryDate);

    if (stock <= 0) {
      return { key: "out-of-stock", label: "Out of Stock", tone: "danger", note: "No units on hand" };
    }

    if (expiryDays < 0) {
      return { key: "expired", label: "Expired", tone: "danger", note: `${Math.abs(expiryDays)} days overdue` };
    }

    if (expiryDays <= 30) {
      return { key: "expiring-soon", label: "Expiring Soon", tone: "warning", note: `${expiryDays} days remaining` };
    }

    if (stock <= Math.max(5, Math.round(reorderLevel * 0.5))) {
      return { key: "critical", label: "Critical", tone: "danger", note: "Below half of reorder level" };
    }

    if (stock <= reorderLevel) {
      return { key: "low-stock", label: "Low Stock", tone: "warning", note: "At or below reorder level" };
    }

    return { key: "healthy", label: "Healthy", tone: "success", note: "Stock within target range" };
  };

  const renderDashboard = () => {
    const today = todayInputValue();
    const dispenseMovements = getDispenseMovements();
    const lowStockItems = state.inventory.filter((medicine) => {
      const statusKey = getStatus(medicine).key;
      return statusKey === "out-of-stock" || statusKey === "critical" || statusKey === "low-stock";
    });
    const expiringItems = state.inventory.filter((medicine) => {
      const remainingDays = daysUntil(medicine.expiryDate);
      return remainingDays >= 0 && remainingDays <= 30;
    });
    const releasesToday = dispenseMovements.filter((movement) => text(movement.createdAt).slice(0, 10) === today);
    const profilesWithHistory = state.residentAccounts.filter((resident) => getResidentStats(resident).totalReleases > 0);

    if (refs.dashboardLowCount) refs.dashboardLowCount.textContent = formatNumber(lowStockItems.length);
    if (refs.dashboardExpiringCount) refs.dashboardExpiringCount.textContent = formatNumber(expiringItems.length);
    if (refs.dashboardReleasedToday) refs.dashboardReleasedToday.textContent = formatNumber(releasesToday.length);
    if (refs.dashboardResidentCount) refs.dashboardResidentCount.textContent = formatNumber(profilesWithHistory.length);
  };

  const findMedicine = (id) => state.inventory.find((medicine) => medicine.id === id) || null;
  const findResidentAccount = (id) => state.residentAccounts.find((resident) =>
    text(resident.id) === text(id) || text(resident.residentId) === text(id)
  ) || null;

  const clearResidentForm = () => {
    refs.residentForm?.reset();
    if (refs.quickResidentCity) refs.quickResidentCity.value = "Ligao City";
  };

  const getResidentFormFocusTarget = () => {
    if (state.residentFormMode === "manual") return refs.quickResidentName;
    return refs.residentCabarianSearch;
  };

  const setResidentFormMode = (mode = "cabarian") => {
    state.residentFormMode = mode === "manual" ? "manual" : "cabarian";
    const isCabarian = state.residentFormMode === "cabarian";

    refs.residentHouseholdPanel?.classList.toggle("d-none", !isCabarian);
    refs.residentFormPanel?.classList.toggle("d-none", isCabarian);

    if (refs.residentModeCabarianBtn) {
      refs.residentModeCabarianBtn.classList.toggle("is-active", isCabarian);
      refs.residentModeCabarianBtn.setAttribute("aria-pressed", String(isCabarian));
    }
    if (refs.residentModeManualBtn) {
      refs.residentModeManualBtn.classList.toggle("is-active", !isCabarian);
      refs.residentModeManualBtn.setAttribute("aria-pressed", String(!isCabarian));
    }
  };

  const filteredCabarianResidents = () => {
    const query = text(state.residentCabarianSearch).toLowerCase();
    return state.residentAccounts
      .filter((resident) => resident.source === "household-system")
      .filter((resident) => {
        if (!query) return true;
        const haystack = [
          resident.residentId,
          resident.householdId,
          resident.fullName,
          resident.barangay,
          resident.zone,
          resident.city
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => text(left.fullName).localeCompare(text(right.fullName)));
  };

  const renderResidentBarangayOptions = () => {
    if (!refs.residentBarangayFilter) return;

    const currentValue = text(state.residentBarangayFilter) || "all";
    const barangays = Array.from(new Set(
      state.residentAccounts
        .map((resident) => text(resident.barangay))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right))
    ));

    const options = [
      { value: "all", label: "All Barangays" },
      ...barangays.map((barangay) => ({
        value: keyOf(barangay),
        label: barangay
      }))
    ];

    const hasCurrent = options.some((option) => option.value === currentValue);
    const nextValue = hasCurrent ? currentValue : "all";
    state.residentBarangayFilter = nextValue;

    refs.residentBarangayFilter.innerHTML = options.map((option) => `
      <option value="${esc(option.value)}"${option.value === nextValue ? " selected" : ""}>${esc(option.label)}</option>
    `).join("");
  };

  const renderCabarianResidentResults = () => {
    if (!refs.residentCabarianResults) return;
    const query = text(state.residentCabarianSearch);

    if (!query) {
      refs.residentCabarianResults.innerHTML = '<div class="staff-empty">Search a resident name, resident ID, or household ID to view matches.</div>';
      if (refs.residentCabarianCount) refs.residentCabarianCount.textContent = "";
      return;
    }

    if (state.householdResidentsSyncing) {
      refs.residentCabarianResults.innerHTML = '<div class="staff-empty">Loading Cabarian residents...</div>';
      if (refs.residentCabarianCount) refs.residentCabarianCount.textContent = "Syncing";
      return;
    }

    const matches = filteredCabarianResidents();
    if (refs.residentCabarianCount) {
      refs.residentCabarianCount.textContent = `${formatNumber(matches.length)} resident${matches.length === 1 ? "" : "s"}`;
    }

    if (!matches.length) {
      refs.residentCabarianResults.innerHTML = '<div class="staff-empty">No matching Cabarian resident found in the household system.</div>';
      return;
    }

    refs.residentCabarianResults.innerHTML = matches.slice(0, 24).map((resident) => {
      const meta = [resident.residentId, text(resident.householdId)].filter(Boolean).join(" | ");
      const address = residentAddressLabel(resident) || "Cabarian, Ligao City";
      const stats = getResidentStats(resident);
      const hasExistingPatient = stats.totalReleases > 0 || Boolean(text(stats.lastReleaseAt));
      const statusLabel = hasExistingPatient ? "Existing patient" : "New patient";
      const statusClass = hasExistingPatient
        ? "staff-account-result__status staff-account-result__status--existing"
        : "staff-account-result__status staff-account-result__status--new";
      return `
        <button type="button" class="staff-account-result" data-cabarian-resident-id="${esc(resident.id)}">
          <span class="staff-account-result__main">
            <strong>${esc(resident.fullName)}</strong>
            <small>${esc(meta || "Household resident")}</small>
          </span>
          <span class="staff-account-result__tail">
            <span>${esc(address)}</span>
            <small class="${statusClass}">${esc(statusLabel)}</small>
          </span>
        </button>
      `;
    }).join("");
  };

  const toggleResidentForm = (forceOpen = null) => {
    const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !state.residentFormOpen;
    state.residentFormOpen = shouldOpen;

    if (residentFormModal) {
      if (shouldOpen) {
        state.residentCabarianSearch = "";
        if (refs.residentCabarianSearch) refs.residentCabarianSearch.value = "";
        setResidentFormMode("cabarian");
        void syncHouseholdResidents();
        renderCabarianResidentResults();
        residentFormModal.show();
      } else {
        residentFormModal.hide();
      }
      return;
    }

    refs.residentFormPanel?.classList.toggle("d-none", !shouldOpen);
    if (shouldOpen) {
      window.setTimeout(() => refs.quickResidentName?.focus(), 180);
      return;
    }

    clearResidentForm();
  };

  const setSelectedResident = (resident, { openModal = false } = {}) => {
    state.selectedResidentId = resident?.id || "";
    toggleResidentForm(false);
    renderSelectedResident();
    renderResidentSearchResults();
    renderHistory();
    if (openModal && resident) residentSummaryModal?.show();
  };

  const filteredResidentAccounts = () => {
    const query = text(state.residentSearch).toLowerCase();
    const selectedId = text(state.selectedResidentId);
    const barangayFilter = keyOf(state.residentBarangayFilter);
    const sortKey = keyOf(state.residentSort);

    return state.residentAccounts
      .map((resident) => ({
        resident,
        stats: getResidentStats(resident)
      }))
      .filter(({ resident, stats }) => {
        const haystack = [
          resident.residentId,
          resident.householdId,
          resident.fullName,
          resident.barangay,
          resident.zone,
          resident.city
        ].join(" ").toLowerCase();

        if (query && !haystack.includes(query)) return false;
        if (barangayFilter !== "all" && keyOf(resident.barangay) !== barangayFilter) return false;

        return true;
      })
      .sort((left, right) => {
        if (text(left.resident.id) === selectedId) return -1;
        if (text(right.resident.id) === selectedId) return 1;

        if (sortKey === "name") {
          return text(left.resident.fullName).localeCompare(text(right.resident.fullName));
        }

        if (sortKey === "releases") {
          if (left.stats.totalReleases !== right.stats.totalReleases) {
            return right.stats.totalReleases - left.stats.totalReleases;
          }
          const leftRecent = new Date(text(left.stats.lastReleaseAt) || 0).getTime();
          const rightRecent = new Date(text(right.stats.lastReleaseAt) || 0).getTime();
          return rightRecent - leftRecent;
        }

        const leftRecent = new Date(text(left.stats.lastReleaseAt) || 0).getTime();
        const rightRecent = new Date(text(right.stats.lastReleaseAt) || 0).getTime();
        if (leftRecent !== rightRecent) return rightRecent - leftRecent;

        if (left.stats.totalReleases !== right.stats.totalReleases) {
          return right.stats.totalReleases - left.stats.totalReleases;
        }

        return text(left.resident.fullName).localeCompare(text(right.resident.fullName));
      });
  };

  const filteredPatientProfiles = () => {
    const query = text(state.patientProfileSearch).toLowerCase();
    const selectedId = text(state.selectedResidentId);

    return state.residentAccounts
      .map((resident) => ({
        resident,
        stats: getResidentStats(resident)
      }))
      .filter(({ stats }) => stats.totalReleases > 0)
      .filter(({ resident, stats }) => {
        const haystack = [
          resident.residentId,
          resident.householdId,
          resident.fullName,
          resident.barangay,
          resident.zone,
          resident.city,
          stats.lastMedicine,
          movementConditionLabel(stats.lastMovement)
        ].join(" ").toLowerCase();

        return !query || haystack.includes(query);
      })
      .sort((left, right) => {
        if (text(left.resident.id) === selectedId) return -1;
        if (text(right.resident.id) === selectedId) return 1;

        const leftRecent = new Date(text(left.stats.lastReleaseAt) || 0).getTime();
        const rightRecent = new Date(text(right.stats.lastReleaseAt) || 0).getTime();
        if (leftRecent !== rightRecent) return rightRecent - leftRecent;

        if (left.stats.totalReleases !== right.stats.totalReleases) {
          return right.stats.totalReleases - left.stats.totalReleases;
        }

        return text(left.resident.fullName).localeCompare(text(right.resident.fullName));
      });
  };

  const renderPatientProfiles = () => {
    if (!refs.patientProfileList) return;

    const profiles = filteredPatientProfiles();
    if (refs.patientProfileCount) {
      refs.patientProfileCount.textContent = `${formatNumber(profiles.length)} profile${profiles.length === 1 ? "" : "s"}`;
    }

    if (!profiles.length) {
      refs.patientProfileList.innerHTML = `<div class="staff-empty">${
        text(state.patientProfileSearch)
          ? "No matching patient profile with dispense records."
          : "No patient profiles with dispense records yet."
      }</div>`;
      return;
    }

    refs.patientProfileList.innerHTML = profiles.map(({ resident, stats }) => {
      const isActive = text(resident.id) === text(state.selectedResidentId) ? " is-active" : "";
      const address = residentAddressLabel(resident) || resident.barangay || "Resident account";
      const lastDispense = stats.lastReleaseAt ? formatDateTime(stats.lastReleaseAt) : "No recent dispense";
      const patientMeta = [resident.residentId, text(resident.householdId)].filter(Boolean).join(" | ");

      return `
        <button type="button" class="staff-profile-row${isActive}" data-profile-resident-id="${esc(resident.id)}">
          <span class="staff-profile-row__patient">
            <strong>${esc(resident.fullName)}</strong>
            <small>${esc(patientMeta || "Resident profile")}</small>
          </span>
          <span class="staff-profile-row__text staff-profile-row__address" title="${esc(address)}">${esc(address)}</span>
          <span class="staff-profile-row__text">${esc(stats.lastMedicine || "-")}</span>
          <span class="staff-profile-row__text">${esc(lastDispense)}</span>
          <span class="staff-profile-row__count">${esc(formatNumber(stats.totalReleases))}</span>
          <span class="staff-profile-row__action">
            <span class="staff-chip staff-chip--neutral">View Profile</span>
          </span>
        </button>
      `;
    }).join("");
  };

  const filteredDispenseResidents = () => {
    const query = keyOf(state.dispenseResidentSearch);
    const selectedId = text(state.selectedResidentId);

    return state.residentAccounts
      .map((resident) => ({
        resident,
        stats: getResidentStats(resident)
      }))
      .filter(({ resident }) => {
        if (!query) return true;
        const haystack = [
          resident.residentId,
          resident.householdId,
          resident.fullName,
          resident.barangay,
          resident.zone,
          resident.city
        ].join(" ").toLowerCase();
        return haystack.includes(query);
      })
      .sort((left, right) => {
        const leftSelected = text(left.resident.id) === selectedId ? 1 : 0;
        const rightSelected = text(right.resident.id) === selectedId ? 1 : 0;
        if (leftSelected !== rightSelected) return rightSelected - leftSelected;

        const leftRecent = new Date(text(left.stats.lastReleaseAt) || 0).getTime();
        const rightRecent = new Date(text(right.stats.lastReleaseAt) || 0).getTime();
        if (leftRecent !== rightRecent) return rightRecent - leftRecent;

        return text(left.resident.fullName).localeCompare(text(right.resident.fullName));
      });
  };

  const renderDispenseResidentPicker = () => {
    const resident = findResidentAccount(state.selectedResidentId);
    const query = text(state.dispenseResidentSearch);

    if (refs.dispenseResidentSearchBox) {
      refs.dispenseResidentSearchBox.classList.toggle("d-none", Boolean(resident));
    }

    if (refs.dispenseResidentPreview) {
      if (!resident) {
        refs.dispenseResidentPreview.className = "staff-dispense-patient-preview d-none";
        refs.dispenseResidentPreview.innerHTML = "";
      } else {
        const stats = getResidentStats(resident);
        const latest = stats.lastReleaseAt ? `Last dispense ${formatDateTime(stats.lastReleaseAt)}` : "No dispense history yet";
        refs.dispenseResidentPreview.className = "staff-dispense-patient-preview is-active";
        refs.dispenseResidentPreview.innerHTML = `
          <div class="staff-dispense-patient-preview__head">
            <strong>Selected Patient</strong>
            <button type="button" class="btn btn-sm btn-light" data-change-dispense-resident>Change</button>
          </div>
          <span>${esc(resident.fullName)}</span>
          <small>${esc([resident.residentId, residentAddressLabel(resident)].filter(Boolean).join(" | "))}</small>
          <small>${esc(latest)}</small>
        `;
      }
    }

    if (!refs.dispenseResidentResults) return;

    if (!query) {
      refs.dispenseResidentResults.classList.add("d-none");
      refs.dispenseResidentResults.innerHTML = "";
      return;
    }

    refs.dispenseResidentResults.classList.remove("d-none");

    const residents = filteredDispenseResidents();
    if (!residents.length) {
      refs.dispenseResidentResults.innerHTML = '<div class="staff-empty">No matching patient account found.</div>';
      return;
    }

    refs.dispenseResidentResults.innerHTML = residents.slice(0, 6).map(({ resident, stats }) => {
      const isActive = text(resident.id) === text(state.selectedResidentId);
      const meta = [resident.residentId, text(resident.householdId)].filter(Boolean).join(" | ");
      return `
        <button type="button" class="staff-account-result${isActive ? " is-active" : ""}" data-dispense-resident-id="${esc(resident.id)}">
          <span class="staff-account-result__main">
            <strong>${esc(resident.fullName)}</strong>
            <small>${esc(meta || "Resident account")}</small>
          </span>
          <span class="staff-account-result__tail">
            <span>${esc(residentAddressLabel(resident) || resident.barangay || "Ligao City")}</span>
            <small>${esc(isActive ? "Selected" : "Select patient")}</small>
          </span>
        </button>
      `;
    }).join("");
  };

  const updateDispenseFormState = () => {
    const resident = findResidentAccount(state.selectedResidentId);
    const hasResident = Boolean(resident);
    if (!hasResident) {
      updateDispenseMedicineSelection("");
    }
    if (refs.dispenseMedicineCard) {
      refs.dispenseMedicineCard.classList.toggle("is-disabled", !hasResident);
    }
    if (refs.dispenseMedicineSearch) {
      refs.dispenseMedicineSearch.disabled = !hasResident;
      refs.dispenseMedicineSearch.placeholder = hasResident
        ? "Search medicine, form, strength, or batch"
        : "Select patient first";
    }
    if (refs.dispenseMedicine) refs.dispenseMedicine.disabled = !hasResident;
    if (refs.dispenseSubmitBtn) refs.dispenseSubmitBtn.disabled = !hasResident;
    renderMedicineSearchResults();
    renderStockPreview();
  };

  const renderSelectedResident = () => {
    const resident = findResidentAccount(state.selectedResidentId);
    if (!resident) {
      if (refs.selectedResidentName) refs.selectedResidentName.textContent = "No patient selected";
      if (refs.selectedResidentMeta) refs.selectedResidentMeta.textContent = "Choose a resident from the directory to review patient details.";
      if (refs.selectedResidentReleaseCount) refs.selectedResidentReleaseCount.textContent = "0";
      if (refs.selectedResidentLastMedicineValue) refs.selectedResidentLastMedicineValue.textContent = "-";
      if (refs.selectedResidentLastReleaseValue) refs.selectedResidentLastReleaseValue.textContent = "-";
      if (refs.selectedResidentUseBtn) refs.selectedResidentUseBtn.disabled = true;
      updateDispenseFormState();
      renderDispenseResidentPicker();
      renderPatientProfiles();
      renderDashboard();
      return;
    }

    const stats = getResidentStats(resident);

    if (refs.selectedResidentName) refs.selectedResidentName.textContent = resident.fullName;
    if (refs.selectedResidentMeta) {
      refs.selectedResidentMeta.textContent = [
        resident.residentId,
        text(resident.householdId),
        residentAddressLabel(resident)
      ].filter(Boolean).join(" | ");
    }
    if (refs.selectedResidentReleaseCount) refs.selectedResidentReleaseCount.textContent = formatNumber(stats.totalReleases);
    if (refs.selectedResidentLastMedicineValue) refs.selectedResidentLastMedicineValue.textContent = stats.lastMedicine || "-";
    if (refs.selectedResidentLastReleaseValue) {
      refs.selectedResidentLastReleaseValue.textContent = stats.lastReleaseAt ? formatDateTime(stats.lastReleaseAt) : "-";
    }
    if (refs.selectedResidentUseBtn) refs.selectedResidentUseBtn.disabled = false;

    updateDispenseFormState();
    renderDispenseResidentPicker();
    renderPatientProfiles();
    renderDashboard();
  };

  const renderResidentSearchResults = () => {
    if (!refs.residentLookupResults) return;
    renderResidentBarangayOptions();
    const results = filteredResidentAccounts();
    if (refs.residentLookupCount) {
      refs.residentLookupCount.textContent = `${formatNumber(results.length)} record${results.length === 1 ? "" : "s"}`;
    }

    if (!results.length) {
      refs.residentLookupResults.innerHTML = '<div class="staff-empty">No matching resident account.</div>';
      return;
    }

    refs.residentLookupResults.innerHTML = results.map(({ resident, stats }) => {
      const isActive = text(resident.id) === text(state.selectedResidentId) ? " is-active" : "";
      const location = residentAddressLabel(resident) || resident.barangay || "Resident account";
      const statusClass = residentStatusChipClass(stats.status.tone);
      const sourceLabel = resident.source === "household-system" ? "Household" : "Manual";
      const lastMedicine = stats.totalReleases > 0 ? stats.lastMedicine : "No dispense yet";
      const lastRelease = stats.lastReleaseAt ? formatDateTime(stats.lastReleaseAt) : "No dispense yet";

      return `
        <button type="button" class="staff-resident-row${isActive}" data-resident-id="${esc(resident.id)}">
          <span class="staff-resident-row__patient">
            <strong>${esc(resident.fullName)}</strong>
            <small>${esc(resident.residentId)}${text(resident.householdId) ? ` | ${esc(resident.householdId)}` : ""} | ${esc(sourceLabel)}</small>
          </span>
          <span class="staff-resident-row__text">${esc(location)}</span>
          <span class="staff-resident-row__text">${esc(lastMedicine)}</span>
          <span class="staff-resident-row__text">${esc(lastRelease)}</span>
          <span class="staff-resident-row__count">${esc(formatNumber(stats.totalReleases))}</span>
          <span class="${esc(statusClass)}">${esc(stats.status.label)}</span>
        </button>
      `;
    }).join("");
  };

  const updateDispenseMedicineSelection = (medicineId, { syncInput = true } = {}) => {
    if (!refs.dispenseMedicine) return;
    const nextMedicine = findMedicine(text(medicineId));
    refs.dispenseMedicine.value = nextMedicine?.id || "";
    if (syncInput && refs.dispenseMedicineSearch) {
      refs.dispenseMedicineSearch.value = nextMedicine ? medicineLabel(nextMedicine) : "";
    }
    renderMedicineSearchResults();
    renderStockPreview();
  };

  const renderMedicineSearchResults = () => {
    if (!refs.dispenseMedicineResults) return;
    const resident = findResidentAccount(state.selectedResidentId);

    if (!resident) {
      refs.dispenseMedicineResults.innerHTML = '<div class="staff-empty">Select a patient first to unlock medicine selection.</div>';
      return;
    }

    const medicines = getSortedMedicines();
    const query = keyOf(refs.dispenseMedicineSearch?.value);
    const selectedMedicine = findMedicine(text(refs.dispenseMedicine?.value));

    if (!medicines.length) {
      refs.dispenseMedicineResults.innerHTML = '<div class="staff-empty">No medicine available in inventory.</div>';
      return;
    }

    if (selectedMedicine && (!query || query === keyOf(medicineLabel(selectedMedicine)))) {
      const status = getStatus(selectedMedicine);
      refs.dispenseMedicineResults.innerHTML = `
        <article class="staff-medicine-selected">
          <div class="staff-medicine-selected__main">
            <strong>${esc(medicineLabel(selectedMedicine))}</strong>
            <small>${esc(medicinePickerMeta(selectedMedicine) || "Inventory medicine")}</small>
          </div>
          <div class="staff-medicine-selected__tail">
            <span class="${esc(stockStatusChipClass(status.tone))}">${esc(status.label)}</span>
            <button type="button" class="btn btn-sm btn-light" data-clear-dispense-medicine>Change</button>
          </div>
        </article>
      `;
      return;
    }

    const matches = medicines
      .filter((medicine) => !query || medicineSearchText(medicine).includes(query))
      .slice(0, 6);

    if (!matches.length) {
      refs.dispenseMedicineResults.innerHTML = '<div class="staff-empty">No matching medicine found in inventory.</div>';
      return;
    }

    refs.dispenseMedicineResults.innerHTML = matches.map((medicine) => {
      const status = getStatus(medicine);
      return `
        <button type="button" class="staff-medicine-result" data-dispense-medicine-id="${esc(medicine.id)}">
          <span class="staff-medicine-result__main">
            <strong>${esc(medicineLabel(medicine))}</strong>
            <small>${esc(medicinePickerMeta(medicine) || "Inventory medicine")}</small>
          </span>
          <span class="staff-medicine-result__tail">
            <small>${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)}</small>
            <span class="${esc(stockStatusChipClass(status.tone))}">${esc(status.label)}</span>
          </span>
        </button>
      `;
    }).join("");
  };

  const renderMedicineOptions = () => {
    if (!refs.dispenseMedicine) return;
    const current = text(refs.dispenseMedicine.value);
    const medicines = getSortedMedicines();

    refs.dispenseMedicine.innerHTML = [
      '<option value="">Select medicine</option>',
      ...medicines.map((medicine) => {
        const status = getStatus(medicine);
        return `<option value="${esc(medicine.id)}">${esc(medicineLabel(medicine))} | ${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)} | ${esc(status.label)}</option>`;
      })
    ].join("");

    const hasCurrent = medicines.some((medicine) => medicine.id === current);
    refs.dispenseMedicine.value = hasCurrent ? current : "";
    if (refs.dispenseMedicineSearch && !hasCurrent) refs.dispenseMedicineSearch.value = "";
    renderMedicineSearchResults();
    renderStockPreview();
  };

  const renderStockPreview = () => {
    if (!refs.dispenseStockPreview) return;
    const resident = findResidentAccount(state.selectedResidentId);

    if (!resident) {
      refs.dispenseStockPreview.className = "staff-stock-preview";
      refs.dispenseStockPreview.innerHTML = "<strong>Medicine selection locked</strong><span>Select a patient first before choosing a medicine.</span>";
      return;
    }

    const medicine = findMedicine(text(refs.dispenseMedicine?.value));

    if (!medicine) {
      refs.dispenseStockPreview.className = "staff-stock-preview";
      refs.dispenseStockPreview.innerHTML = "<strong>No medicine selected</strong><span>Choose a medicine to view stock details.</span>";
      return;
    }

    const status = getStatus(medicine);
    refs.dispenseStockPreview.className = `staff-stock-preview staff-stock-preview--${status.tone}`;
    refs.dispenseStockPreview.innerHTML = `
      <strong>${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)} available</strong>
      <span>${esc(status.label)} | Exp ${esc(formatDate(medicine.expiryDate))} | ${esc(medicine.location || "Main Cabinet")}</span>
    `;
  };

  const getCurrentDispenseActor = () => {
    const user = getCurrentBhwUser();
    if (!user) return null;

    return {
      user,
      role: roleName(user.role),
      name: text(user.fullName) || "Assigned Staff"
    };
  };

  const renderSettings = () => {
    const user = getCurrentBhwUser();

    if (!user) {
      if (refs.settingsStatusChip) refs.settingsStatusChip.textContent = "Security";
      refs.settingsForm?.reset();
      if (refs.settingsFullName) refs.settingsFullName.value = "";
      if (refs.settingsUsername) refs.settingsUsername.value = "";
      if (refs.settingsPassword) refs.settingsPassword.value = "";
      if (refs.settingsConfirmPassword) refs.settingsConfirmPassword.value = "";
      if (refs.settingsContact) refs.settingsContact.value = "";
      if (refs.settingsRole) refs.settingsRole.value = "Staff";
      setSettingsNotice("Admin needs to create your staff account first.", "danger");
      setSettingsEditorOpen(false);
      setSettingsDisabled(true);
      renderTopbarAccount();
      return;
    }

    if (refs.settingsStatusChip) refs.settingsStatusChip.textContent = "Security";
    if (refs.settingsFullName) refs.settingsFullName.value = user.fullName || "";
    if (refs.settingsUsername) refs.settingsUsername.value = user.username || "";
    if (refs.settingsPassword) refs.settingsPassword.value = "";
    if (refs.settingsConfirmPassword) refs.settingsConfirmPassword.value = "";
    if (refs.settingsContact) refs.settingsContact.value = user.contact || "";
    if (refs.settingsRole) refs.settingsRole.value = roleName(user.role);
    setSettingsNotice("Staff account only.");

    setSettingsDisabled(false);
    renderTopbarAccount();
  };

  const resetDispenseForm = () => {
    updateDispenseMedicineSelection("");
    if (refs.dispenseQuantity) refs.dispenseQuantity.value = "";
    if (refs.dispenseDiseaseCategory) refs.dispenseDiseaseCategory.value = "";
    if (refs.dispenseIllness) refs.dispenseIllness.value = "";
    if (refs.dispenseDate) refs.dispenseDate.value = todayInputValue();
  };

  const resetDispenseResidentSelection = () => {
    state.selectedResidentId = "";
    state.dispenseResidentSearch = "";
    if (refs.dispenseResidentSearch) refs.dispenseResidentSearch.value = "";
    renderSelectedResident();
    renderResidentSearchResults();
    renderHistory();
  };

  const renderHistory = () => {
    if (!refs.historyList) return;
    const resident = findResidentAccount(state.selectedResidentId);
    const allDispense = getDispenseMovements();

    const filtered = resident
      ? allDispense.filter((movement) => movementMatchesResident(movement, resident))
      : allDispense;

    const items = filtered.slice(0, 8);
    if (refs.historyTitle) refs.historyTitle.textContent = resident ? "Resident Dispensing Records" : "Dispensing Records";
    if (refs.historySubtitle) {
      refs.historySubtitle.textContent = resident
        ? `Latest dispensing records for ${resident.fullName}.`
        : "Latest medicine dispensing records recorded by BHW.";
    }
    if (refs.historyCount) refs.historyCount.textContent = `${formatNumber(filtered.length)} entr${filtered.length === 1 ? "y" : "ies"}`;

    if (!items.length) {
      refs.historyList.innerHTML = '<div class="staff-empty">No dispensing records found.</div>';
      return;
    }

    refs.historyList.innerHTML = items.map((movement) => {
      const actor = [roleName(movement.releasedByRole), text(movement.releasedByName) || text(movement.user)]
        .filter(Boolean)
        .join(" | ");
      const residentMeta = [text(movement.recipientName), text(movement.recipientBarangay)].filter(Boolean).join(" | ");
      const caseLabel = movementConditionLabel(movement);
      return `
        <article class="staff-history-item">
          <div class="staff-history-item__meta">
            <strong>${esc(movement.medicineName || "Medicine Dispensed")}</strong>
            <span>${esc(formatNumber(movement.quantity))} unit${numeric(movement.quantity) === 1 ? "" : "s"} dispensed</span>
            <small>${esc(residentMeta || "Resident account")}</small>
            ${caseLabel ? `<small>${esc(caseLabel)}</small>` : ""}
            <small>${esc(movement.note || "Dispensing record saved.")}</small>
          </div>
          <div class="staff-history-item__tail">
            <span class="staff-chip staff-chip--neutral">${esc(actor || "BHW")}</span>
            <small>${esc(formatDateTime(movement.createdAt))}</small>
            <small>${esc(formatNumber(movement.stockBefore))} to ${esc(formatNumber(movement.stockAfter))}</small>
          </div>
        </article>
      `;
    }).join("");
  };

  const createResidentAccount = () => {
    const fullName = text(refs.quickResidentName?.value);
    const barangay = text(refs.quickResidentBarangay?.value);
    const zone = text(refs.quickResidentZone?.value);
    const city = text(refs.quickResidentCity?.value) || "Ligao City";

    if (!fullName || !barangay) {
      showNotice("Complete the resident name and barangay to save the account.", "danger");
      return null;
    }

    const resident = normalizeResidentAccount({
      id: uid(),
      residentId: nextResidentAccountCode(),
      fullName,
      barangay,
      zone,
      city,
      province: "Albay",
      source: "medicine-system"
    });

    mergeResidentAccounts([resident]);
    saveState();
    clearResidentForm();
    renderResidentSearchResults();
    renderCabarianResidentResults();
    setSelectedResident(resident);
    showNotice(`${resident.fullName} was added to resident accounts.`);
    return resident;
  };

  const handleResidentFormSubmit = (event) => {
    event.preventDefault();
    const resident = createResidentAccount();
    if (resident) openSection("dispense-medicine");
  };

  const handleDispenseSubmit = (event) => {
    event.preventDefault();
    const resident = findResidentAccount(state.selectedResidentId);
    const medicine = findMedicine(text(refs.dispenseMedicine?.value));
    const quantity = Math.max(0, Math.round(numeric(refs.dispenseQuantity?.value)));
    const diseaseCategory = text(refs.dispenseDiseaseCategory?.value);
    const illness = text(refs.dispenseIllness?.value);
    const dispenseActor = getCurrentDispenseActor();
    const actionDate = text(refs.dispenseDate?.value) || todayInputValue();

    if (!resident) {
      showNotice("Select or create a resident account before dispensing medicine.", "danger");
      return;
    }

    if (!medicine) {
      showNotice("Select a medicine to dispense.", "danger");
      return;
    }

    if (!dispenseActor?.name) {
      showNotice("No active staff account is linked for dispensing.", "danger");
      return;
    }

    if (!diseaseCategory) {
      showNotice("Select the disease category for this dispensing entry.", "danger");
      return;
    }

    if (!illness) {
      showNotice("Enter the illness or complaint for this dispensing entry.", "danger");
      return;
    }

    if (quantity <= 0) {
      showNotice("Enter a valid quantity to dispense.", "danger");
      return;
    }

    if (quantity > medicine.stockOnHand) {
      showNotice("Dispense quantity cannot be greater than available stock.", "danger");
      return;
    }

    const stockBefore = medicine.stockOnHand;
    const stockAfter = stockBefore - quantity;
    const createdAt = `${actionDate}T08:00:00`;
    const releasedByRole = dispenseActor.role;
    const releasedByName = dispenseActor.name;

    medicine.stockOnHand = stockAfter;
    medicine.lastUpdatedAt = createdAt;
    medicine.updatedBy = `${releasedByRole}: ${releasedByName}`;

    resident.lastDispensedAt = createdAt;
    resident.lastDispensedMedicine = medicineLabel(medicine);

    state.movements.unshift(normalizeMovement({
      medicineId: medicine.id,
      medicineName: medicineLabel(medicine),
      actionType: "dispense",
      quantity,
      diseaseCategory,
      illness,
      stockBefore,
      stockAfter,
      note: `Dispensed for ${illness} to ${resident.fullName}${resident.residentId ? ` (${resident.residentId})` : ""}.`,
      createdAt,
      user: releasedByName,
      recipientId: resident.residentId,
      recipientName: resident.fullName,
      recipientBarangay: resident.barangay,
      releasedByRole,
      releasedByName
    }));

    const storedUser = findStoredUser({ fullName: releasedByName, accountType: releasedByRole });
    const username = text(storedUser?.username) || makeUsername(releasedByName, defaultUsernameForRole(releasedByRole));
    const ipAddress = resolveSessionIp(storedUser?.id, defaultIpForRole(releasedByRole));
    const residentLabel = resident.residentId ? `${resident.fullName} (${resident.residentId})` : resident.fullName;
    const detailParts = [
      `${formatNumber(quantity)} ${medicine.unit} dispensed to ${residentLabel}.`,
      `Case: ${diseaseCategory}${illness ? ` | ${illness}` : ""}.`,
      `Dispensed by ${releasedByRole}: ${releasedByName}.`,
      `Stock updated from ${formatNumber(stockBefore)} to ${formatNumber(stockAfter)} ${medicine.unit}.`
    ];

    appendActivityLog({
      actor: releasedByName,
      username,
      action: "Dispensed medicine",
      actionType: "updated",
      target: medicineLabel(medicine),
      details: detailParts.join(" "),
      category: "Dispensing",
      resultLabel: "Dispensed",
      resultTone: "success",
      createdAt,
      ipAddress
    });

    saveState();
    renderSelectedResident();
    renderResidentSearchResults();
    renderMedicineOptions();
    renderHistory();
    emitInventoryNotificationRefresh();

    resetDispenseForm();
    resetDispenseResidentSelection();

    openSection("staff-dashboard");
    showDispenseSuccess({
      medicineName: medicineLabel(medicine),
      residentName: resident.fullName,
      quantity,
      unit: medicine.unit
    });
  };

  const handleSettingsSubmit = (event) => {
    event.preventDefault();
    clearNotice();

    const users = getStoredUsers();
    const userIndex = users.findIndex((user) => text(user.id) === text(state.currentUserId) && text(user.role) !== USER_ROLE_ADMIN);
    if (userIndex < 0) {
      setSettingsNotice("No active staff account is available for this module.", "danger");
      renderSettings();
      return;
    }

    const currentUser = users[userIndex];
    const previousName = currentUser.fullName;
    const fullName = text(refs.settingsFullName?.value);
    const username = text(refs.settingsUsername?.value);
    const password = String(refs.settingsPassword?.value || "");
    const confirm = String(refs.settingsConfirmPassword?.value || "");
    const profileChanged = fullName !== text(currentUser.fullName) || username !== text(currentUser.username);
    const passwordChanged = Boolean(password || confirm);

    if (!fullName || !username) {
      setSettingsNotice("Complete the full name and username first.", "danger");
      return;
    }

    if (!profileChanged && !passwordChanged) {
      setSettingsNotice("No changes to save yet.", "danger");
      return;
    }

    const duplicateUsername = users.some((user, index) => index !== userIndex && keyOf(user.username) === keyOf(username));
    if (duplicateUsername) {
      setSettingsNotice("Username is already in use. Choose another one.", "danger");
      return;
    }

    if (passwordChanged) {
      if (!password || !confirm) {
        setSettingsNotice("Enter and confirm the new password.", "danger");
        return;
      }
      if (password.length < 8) {
        setSettingsNotice("New password must be at least 8 characters.", "danger");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setSettingsNotice("Password must include at least 1 special character.", "danger");
        return;
      }
      if (password !== confirm) {
        setSettingsNotice("Password and confirmation do not match.", "danger");
        return;
      }
    }

    const updatedAt = nowIso();
    const nextUser = {
      ...currentUser,
      fullName,
      username,
      updatedAt,
      updatedBy: previousName || "BHW Self-Service"
    };

    if (passwordChanged) {
      nextUser.password = password;
    }

    users[userIndex] = nextUser;
    writeStoredUsers(users);

    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex((session) => text(session.userId) === text(nextUser.id));
    if (sessionIndex >= 0) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        fullName: nextUser.fullName,
        username: nextUser.username,
        role: nextUser.role,
        accountType: nextUser.accountType,
        presence: text(sessions[sessionIndex].presence) || "Online",
        location: "Staff Credentials",
        lastSeenAt: updatedAt
      };
    } else {
      sessions.unshift({
        id: uid(),
        userId: nextUser.id,
        fullName: nextUser.fullName,
        username: nextUser.username,
        role: nextUser.role,
        accountType: nextUser.accountType,
        presence: "Online",
        location: "Staff Credentials",
        deviceLabel: "Android Tablet",
        ipAddress: defaultIpForRole(nextUser.role),
        signedInAt: updatedAt,
        lastSeenAt: updatedAt
      });
    }
    sessions.sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
    writeStoredSessions(sessions);

    const detailParts = [];
    if (profileChanged) detailParts.push("Staff credentials were updated from the staff settings panel.");
    if (passwordChanged) detailParts.push("Password was changed from the staff settings panel.");

    appendActivityLog({
      actor: nextUser.fullName,
      username: nextUser.username || makeUsername(nextUser.fullName, defaultUsernameForRole(nextUser.role)),
      action: passwordChanged && profileChanged
        ? "Updated staff profile and password"
        : passwordChanged
          ? "Changed staff password"
          : "Updated staff profile",
      actionType: passwordChanged ? "security" : "updated",
      target: nextUser.fullName,
      details: detailParts.join(" "),
      category: "Security",
      resultLabel: "Saved",
      resultTone: "success",
      createdAt: updatedAt,
      ipAddress: resolveSessionIp(nextUser.id, defaultIpForRole(nextUser.role))
    });

    state.currentUserId = nextUser.id;
    renderSettings();
    setSettingsEditorOpen(false);
    showNotice("Staff credentials updated successfully.");
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

  window.MSSOpenNotificationCenter = openStaffNotificationCenter;

  refs.staffNotificationFeed?.addEventListener("click", (event) => {
    const card = event.target.closest("[data-staff-notification-id]");
    if (!card) return;

    const notificationId = text(card.getAttribute("data-staff-notification-id"));
    let notification = getStoredNotifications().find((entry) => text(entry.id) === notificationId) || null;
    if (!notification) return;

    if (!notification.read) {
      notification = updateStoredNotification(notificationId, (entry) => {
        entry.read = true;
      }) || notification;
      renderStaffNotifications();
    }

    openStaffNotificationDetail(notification);
  });

  window.addEventListener("mss:notifications-synced", () => {
    renderStaffNotifications();
  });

  window.addEventListener("storage", (event) => {
    if (text(event.key) !== NOTIFICATION_STORAGE) return;
    renderStaffNotifications();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") renderStaffNotifications();
  });

  refs.residentFormModal?.addEventListener("shown.bs.modal", () => {
    state.residentFormOpen = true;
    renderCabarianResidentResults();
    const target = getResidentFormFocusTarget();
    window.setTimeout(() => target?.focus(), 120);
  });

  refs.residentFormModal?.addEventListener("hidden.bs.modal", () => {
    state.residentFormOpen = false;
    state.residentCabarianSearch = "";
    if (refs.residentCabarianSearch) refs.residentCabarianSearch.value = "";
    setResidentFormMode("cabarian");
    clearResidentForm();
    renderCabarianResidentResults();
  });

  refs.dispenseSuccessModal?.addEventListener("hidden.bs.modal", () => {
    window.clearTimeout(dispenseSuccessTimer);
  });

  refs.residentSearchInput?.addEventListener("input", (event) => {
    state.residentSearch = text(event.target.value);
    renderResidentSearchResults();
  });

  refs.patientProfileSearchInput?.addEventListener("input", (event) => {
    state.patientProfileSearch = text(event.target.value);
    renderPatientProfiles();
  });

  refs.patientProfileSearchBtn?.addEventListener("click", () => {
    state.patientProfileSearch = text(refs.patientProfileSearchInput?.value);
    renderPatientProfiles();
    refs.patientProfileSearchInput?.focus();
  });

  refs.dispenseResidentSearch?.addEventListener("input", (event) => {
    state.dispenseResidentSearch = text(event.target.value);
    renderDispenseResidentPicker();
  });

  refs.dispenseResidentSearchBtn?.addEventListener("click", () => {
    state.dispenseResidentSearch = text(refs.dispenseResidentSearch?.value);
    renderDispenseResidentPicker();
    refs.dispenseResidentSearch?.focus();
  });

  refs.residentModeCabarianBtn?.addEventListener("click", () => {
    setResidentFormMode("cabarian");
    renderCabarianResidentResults();
    window.setTimeout(() => refs.residentCabarianSearch?.focus(), 120);
  });

  refs.residentModeManualBtn?.addEventListener("click", () => {
    setResidentFormMode("manual");
    window.setTimeout(() => refs.quickResidentName?.focus(), 120);
  });

  refs.residentCabarianSearch?.addEventListener("input", (event) => {
    state.residentCabarianSearch = text(event.target.value);
    renderCabarianResidentResults();
  });

  refs.residentCabarianSearchBtn?.addEventListener("click", () => {
    state.residentCabarianSearch = text(refs.residentCabarianSearch?.value);
    renderCabarianResidentResults();
    refs.residentCabarianSearch?.focus();
  });

  refs.dispenseMedicineSearch?.addEventListener("input", (event) => {
    const query = text(event.target.value);
    const selectedMedicine = findMedicine(text(refs.dispenseMedicine?.value));
    if (selectedMedicine && keyOf(query) !== keyOf(medicineLabel(selectedMedicine))) {
      if (refs.dispenseMedicine) refs.dispenseMedicine.value = "";
    }
    renderMedicineSearchResults();
    renderStockPreview();
  });

  refs.residentBarangayFilter?.addEventListener("change", (event) => {
    state.residentBarangayFilter = text(event.target.value) || "all";
    renderResidentSearchResults();
  });

  refs.residentSortFilter?.addEventListener("change", (event) => {
    state.residentSort = text(event.target.value) || "recent";
    renderResidentSearchResults();
  });

  refs.residentLookupResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-resident-id]");
    if (!button) return;
    const resident = findResidentAccount(text(button.getAttribute("data-resident-id")));
    if (!resident) return;
    setSelectedResident(resident, { openModal: true });
  });

  refs.patientProfileList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-profile-resident-id]");
    if (!button) return;
    const resident = findResidentAccount(text(button.getAttribute("data-profile-resident-id")));
    if (!resident) return;
    setSelectedResident(resident, { openModal: true });
  });

  refs.dispenseResidentResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dispense-resident-id]");
    if (!button) return;

    const resident = findResidentAccount(text(button.getAttribute("data-dispense-resident-id")));
    if (!resident) return;

    state.dispenseResidentSearch = "";
    if (refs.dispenseResidentSearch) refs.dispenseResidentSearch.value = "";
    clearNotice();
    setSelectedResident(resident);
    window.setTimeout(() => refs.dispenseMedicineSearch?.focus(), 120);
  });

  refs.dispenseResidentPreview?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-change-dispense-resident]");
    if (!button) return;

    resetDispenseResidentSelection();
    clearNotice();
    window.setTimeout(() => refs.dispenseResidentSearch?.focus(), 120);
  });

  refs.residentCabarianResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cabarian-resident-id]");
    if (!button) return;
    const resident = findResidentAccount(text(button.getAttribute("data-cabarian-resident-id")));
    if (!resident) return;
    setSelectedResident(resident);
    residentFormModal?.hide();
    openSection("dispense-medicine");
    window.setTimeout(() => {
      showResidentSelectedSuccess({ residentName: resident.fullName });
    }, 180);
  });

  refs.dispenseMedicineResults?.addEventListener("click", (event) => {
    if (!findResidentAccount(state.selectedResidentId)) return;

    const clearButton = event.target.closest("[data-clear-dispense-medicine]");
    if (clearButton) {
      updateDispenseMedicineSelection("");
      refs.dispenseMedicineSearch?.focus();
      return;
    }

    const button = event.target.closest("[data-dispense-medicine-id]");
    if (!button) return;
    updateDispenseMedicineSelection(text(button.getAttribute("data-dispense-medicine-id")));
  });

  refs.selectedResidentUseBtn?.addEventListener("click", () => {
    if (!findResidentAccount(state.selectedResidentId)) return;
    residentSummaryModal?.hide();
    openSection("dispense-medicine");
  });
  refs.dashboardDispenseBtn?.addEventListener("click", () => {
    resetDispenseResidentSelection();
    resetDispenseForm();
    clearNotice();
    openSection("dispense-medicine");
    window.setTimeout(() => {
      refs.dispenseResidentSearch?.focus();
    }, 120);
  });
  refs.toggleResidentFormBtn?.addEventListener("click", () => toggleResidentForm());
  refs.closeResidentFormBtn?.addEventListener("click", () => toggleResidentForm(false));
  refs.residentForm?.addEventListener("submit", handleResidentFormSubmit);
  refs.dispenseMedicine?.addEventListener("change", () => {
    const selectedMedicine = findMedicine(text(refs.dispenseMedicine?.value));
    if (refs.dispenseMedicineSearch && selectedMedicine) {
      refs.dispenseMedicineSearch.value = medicineLabel(selectedMedicine);
    }
    renderMedicineSearchResults();
    renderStockPreview();
  });
  refs.dispenseForm?.addEventListener("submit", handleDispenseSubmit);
  refs.dispenseCancelBtn?.addEventListener("click", () => {
    resetDispenseForm();
    resetDispenseResidentSelection();
    clearNotice();
    openSection("staff-dashboard");
  });
  refs.settingsForm?.addEventListener("submit", handleSettingsSubmit);
  refs.settingsChangeBtn?.addEventListener("click", () => {
    if (refs.settingsChangeBtn?.disabled) return;
    clearNotice();
    openSection("my-settings");
    renderSettings();
    setSettingsEditorOpen(true);
    window.setTimeout(() => refs.settingsUsername?.focus(), 120);
  });
  refs.staffAccountToggle?.addEventListener("click", () => {
    clearNotice();
    openSection("my-settings");
    renderSettings();
    setSettingsEditorOpen(false);
    window.setTimeout(() => refs.settingsChangeBtn?.focus(), 120);
  });
  staffNavLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = text(link.getAttribute("href")).replace(/^#/, "");
      if (!targetId) return;
      openSection(targetId);
      if (targetId === "my-settings") {
        renderSettings();
        setSettingsEditorOpen(false);
      }
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveSection(text(window.location.hash).replace(/^#/, ""));
  });

  ensureSeedData();
  renderMedicineOptions();
  renderSettings();
  renderTopbarAccount();
  renderSelectedResident();
  renderResidentSearchResults();
  renderPatientProfiles();
  renderHistory();
  renderStaffNotifications();
  setActiveSection(text(window.location.hash).replace(/^#/, "") || "staff-dashboard");
  void syncHouseholdResidents();
})();
