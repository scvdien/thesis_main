(() => {
  const STORAGE = {
    users: "mss_users_v1",
    logs: "mss_activity_logs_v1",
    sessions: "mss_active_sessions_v1"
  };

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    createAccountForm: byId("createAccountForm"),
    usersList: byId("usersList"),
    usersListNotice: byId("usersListNotice"),
    nurseSettingsForm: byId("nurseSettingsForm"),
    nurseCredentialsPanel: byId("nurseCredentialsPanel"),
    nurseCredentialsStartBtn: byId("nurseCredentialsStartBtn"),
    nurseFullName: byId("nurseFullName"),
    nurseUsername: byId("nurseUsername"),
    nurseContact: byId("nurseContact"),
    nursePassword: byId("nursePassword"),
    nurseConfirmPassword: byId("nurseConfirmPassword"),
    nurseSettingsNotice: byId("nurseSettingsNotice"),
    activeUsersBadge: byId("activeUsersBadge"),
    activeUsersList: byId("activeUsersList"),
    activityLogSearch: byId("activityLogSearch"),
    activityLogCount: byId("activityLogCount"),
    activityLogTableBody: byId("activityLogTableBody"),
    editAccountForm: byId("editAccountForm"),
    editUserId: byId("editUserId"),
    editFullName: byId("editFullName"),
    editUsername: byId("editUsername"),
    editContact: byId("editContact"),
    editType: byId("editType"),
    editRole: byId("editRole"),
    editRoleDisplay: byId("editRoleDisplay"),
    editToggleStatusBtn: byId("editToggleStatusBtn"),
    editResetPasswordBtn: byId("editResetPasswordBtn"),
    editChangePasswordBtn: byId("editChangePasswordBtn"),
    changePasswordForm: byId("changePasswordForm"),
    passwordUserId: byId("passwordUserId"),
    newPassword: byId("newPassword"),
    confirmNewPassword: byId("confirmNewPassword")
  };

  const settingsNavLinks = Array.from(document.querySelectorAll(".settings-nav a[href^='#']"));
  const settingsPanels = Array.from(document.querySelectorAll(".settings-panel"));
  const settingsContent = document.querySelector(".settings-content");
  const activityLogFilterButtons = Array.from(document.querySelectorAll("[data-activity-log-filter]"));
  const editUserModal = byId("editUserModal") && window.bootstrap ? new window.bootstrap.Modal(byId("editUserModal")) : null;
  const changePasswordModal = byId("changePasswordModal") && window.bootstrap ? new window.bootstrap.Modal(byId("changePasswordModal")) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = { users: [], logs: [], sessions: [] };
  const logUiState = { actionType: "all" };
  const LOG_ACTION_LABELS = {
    created: "Created",
    updated: "Updated",
    deleted: "Deleted",
    security: "Security",
    access: "Access"
  };

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const minutesAgoIso = (minutes) => new Date(Date.now() - (Math.max(0, Number(minutes) || 0) * 60000)).toISOString();
  const text = (value) => String(value || "").trim();
  const keyOf = (value) => text(value).toLowerCase();
  const esc = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const formatDateTime = (iso) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
  };

  const formatRelativeTime = (iso) => {
    const timestamp = new Date(iso).getTime();
    if (Number.isNaN(timestamp)) return "-";
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };

  const formatLogDate = (iso) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }).format(parsed);
  };

  const formatLogTime = (iso) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).format(parsed);
  };
  const USER_ROLE_ADMIN = "Admin";
  const USER_ROLE_BHW = "BHW";
  const normalizeUserRole = (value) => text(value) === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW;

  const resolveLogActionType = (value = {}) => {
    const explicitType = keyOf(value.actionType || value.type);
    if (LOG_ACTION_LABELS[explicitType]) return explicitType;

    const category = keyOf(value.category);
    const actionText = `${text(value.action)} ${text(value.details)}`.toLowerCase();

    if (category === "security" || /password|credential|security/.test(actionText)) return "security";
    if (category === "access" || /login|logout|activate|deactivate|access/.test(actionText)) return "access";
    if (/created|added|provisioned|registered/.test(actionText)) return "created";
    if (/deleted|removed|archived|expired batch/.test(actionText)) return "deleted";
    return "updated";
  };

  const currentActorUsername = () => getAdminUser()?.username || "nurse.incharge";
  const currentActorIp = () => {
    const admin = getAdminUser();
    const session = admin ? state.sessions.find((entry) => entry.userId === admin.id) : null;
    return text(session?.ipAddress) || "127.0.0.1 (localhost)";
  };

  const normalizeLog = (entry = {}) => {
    const actionType = resolveLogActionType(entry);
    return {
      id: text(entry.id) || uid(),
      actor: text(entry.actor) || actorName(),
      username: text(entry.username) || currentActorUsername(),
      category: text(entry.category) || "General",
      actionType,
      actionLabel: text(entry.actionLabel) || LOG_ACTION_LABELS[actionType] || "Updated",
      action: text(entry.action) || text(entry.actionLabel) || LOG_ACTION_LABELS[actionType] || "Updated",
      target: text(entry.target),
      details: text(entry.details) || "No details recorded.",
      resultLabel: text(entry.resultLabel) || "Success",
      resultTone: keyOf(entry.resultTone) || "success",
      ipAddress: text(entry.ipAddress) || currentActorIp(),
      createdAt: text(entry.createdAt) || nowIso()
    };
  };

  const readList = (storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const saveState = () => {
    localStorage.setItem(STORAGE.users, JSON.stringify(state.users));
    localStorage.setItem(STORAGE.logs, JSON.stringify(state.logs));
    localStorage.setItem(STORAGE.sessions, JSON.stringify(state.sessions));
  };

  const setNotice = (element, baseClass, message, tone = "muted") => {
    if (!element) return;
    const toneClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-muted";
    element.className = `${baseClass} ${toneClass}`;
    element.textContent = message;
  };

  const showNotice = (message, type = "success") => {
    if (!refs.moduleAlert) return;
    refs.moduleAlert.className = `alert alert-${type}`;
    refs.moduleAlert.textContent = message;
    refs.moduleAlert.classList.remove("d-none");
    window.setTimeout(() => refs.moduleAlert?.classList.add("d-none"), 3200);
  };

  const hideNotice = () => {
    refs.moduleAlert?.classList.add("d-none");
  };

  const normalizeUser = (entry = {}) => {
    const role = normalizeUserRole(text(entry.role) || text(entry.accountType));
    return {
      ...entry,
      fullName: text(entry.fullName),
      username: text(entry.username),
      contact: text(entry.contact),
      accountType: role === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW,
      role,
      status: text(entry.status) || "Active",
      password: String(entry.password || ""),
      credentialsUpdatedAt: text(entry.credentialsUpdatedAt),
      createdAt: text(entry.createdAt) || nowIso(),
      createdBy: text(entry.createdBy) || "System Seed",
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      updatedBy: text(entry.updatedBy) || "System Seed"
    };
  };

  const getAdminUser = () => state.users.find((user) => text(user.role) === USER_ROLE_ADMIN) || null;
  const actorName = () => getAdminUser()?.fullName || "Nurse-in-Charge";
  const roleLabel = (role) => text(role) === USER_ROLE_ADMIN ? "Nurse-in-Charge" : "BHW";
  const findUser = (id) => state.users.find((user) => user.id === id) || null;
  const getUsers = () => state.users
    .filter((user) => text(user.role) !== USER_ROLE_ADMIN)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const usernameExists = (username, excludeId = "") => state.users.some((user) => keyOf(user.username) === keyOf(username) && user.id !== excludeId);
  const accountMeta = (user) => text(user.role) === USER_ROLE_ADMIN
    ? "Nurse-in-Charge | Medicine Stock Module"
    : "BHW Access | Medicine Stock Module";

  const ensureAdminUser = () => {
    const existing = getAdminUser();
    if (existing) return existing;
    const timestamp = nowIso();
    const user = {
      id: uid(),
      fullName: "Nurse-in-Charge",
      username: "nurse.incharge",
      contact: "09170000000",
      accountType: USER_ROLE_ADMIN,
      role: USER_ROLE_ADMIN,
      status: "Active",
      password: "Admin123!",
      credentialsUpdatedAt: "",
      createdAt: timestamp,
      createdBy: "System Seed",
      updatedAt: timestamp,
      updatedBy: "System Seed"
    };
    state.users.push(user);
    return user;
  };

  const seedUsers = () => {
    const timestamp = nowIso();
    state.users = [
      { id: uid(), fullName: "Maricel Dela Cruz", username: "mdelacruz", contact: "09171234567", accountType: USER_ROLE_BHW, role: USER_ROLE_BHW, status: "Active", password: "BHW123!", createdAt: timestamp, createdBy: "System Seed", updatedAt: timestamp, updatedBy: "System Seed" },
      { id: uid(), fullName: "Rico L. Ramos", username: "rramos", contact: "09179876543", accountType: USER_ROLE_ADMIN, role: USER_ROLE_ADMIN, status: "Active", password: "Admin123!", credentialsUpdatedAt: "", createdAt: timestamp, createdBy: "System Seed", updatedAt: timestamp, updatedBy: "System Seed" },
      { id: uid(), fullName: "Ana Mae Santillan", username: "asantillan", contact: "09172345678", accountType: USER_ROLE_BHW, role: USER_ROLE_BHW, status: "Inactive", password: "BHW123!", createdAt: timestamp, createdBy: "System Seed", updatedAt: timestamp, updatedBy: "System Seed" }
    ].map(normalizeUser);
  };

  const addLog = ({ actor = actorName(), username = currentActorUsername(), action, actionType = "", target = "", details = "", category = "Settings", resultLabel = "Success", resultTone = "success", ipAddress = currentActorIp(), createdAt = nowIso() }) => {
    state.logs.unshift(normalizeLog({
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
    }));
    state.logs = state.logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60);
  };

  const removeSession = (userId) => {
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  };

  const upsertSession = (user, overrides = {}) => {
    if (!user || text(user.status) !== "Active") {
      if (user?.id) removeSession(user.id);
      return null;
    }
    const current = state.sessions.find((session) => session.userId === user.id);
    const next = {
      id: current?.id || uid(),
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      accountType: user.accountType,
      presence: current?.presence || "Online",
      location: current?.location || (text(user.role) === "Admin" ? "Settings Module" : "Medicine Inventory"),
      deviceLabel: current?.deviceLabel || (text(user.role) === "Admin" ? "Desktop Browser" : "Android Tablet"),
      ipAddress: current?.ipAddress || `192.168.10.${15 + (state.sessions.length % 180)}`,
      signedInAt: current?.signedInAt || nowIso(),
      lastSeenAt: current?.lastSeenAt || nowIso(),
      ...overrides,
      userId: user.id,
      fullName: user.fullName,
      username: user.username,
      role: user.role,
      accountType: user.accountType
    };
    state.sessions = state.sessions.filter((session) => session.userId !== user.id);
    state.sessions.push(next);
    state.sessions.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    return next;
  };

  const syncSessions = () => {
    state.sessions = state.sessions
      .map((session) => {
        const user = findUser(session.userId);
        if (!user || text(user.status) !== "Active") return null;
        return { ...session, fullName: user.fullName, username: user.username, role: user.role, accountType: user.accountType };
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  };

  const seedLogs = () => {
    const admin = getAdminUser();
    const staff = getUsers();
    state.logs = [
      normalizeLog({
        id: uid(),
        actor: admin?.fullName || "Rico L. Ramos",
        username: admin?.username || "rramos",
        actionType: "access",
        action: "Login successful",
        target: "Ligao City Coastal RHU Medicine Stock Monitoring System",
        details: "Admin accessed the medicine stock dashboard to review daily inventory movements.",
        resultLabel: "Success",
        resultTone: "success",
        ipAddress: "127.0.0.1 (localhost)",
        createdAt: minutesAgoIso(4)
      }),
      normalizeLog({
        id: uid(),
        actor: staff[0]?.fullName || "Maricel Dela Cruz",
        username: staff[0]?.username || "mdelacruz",
        actionType: "updated",
        action: "Updated stock count",
        target: "Paracetamol 500mg",
        details: "Stock balance was updated from 420 to 360 units after morning dispensing.",
        resultLabel: "Success",
        resultTone: "success",
        ipAddress: "192.168.10.24",
        createdAt: minutesAgoIso(18)
      }),
      normalizeLog({
        id: uid(),
        actor: admin?.fullName || "Rico L. Ramos",
        username: admin?.username || "rramos",
        actionType: "created",
        action: "Created medicine batch",
        target: "Amoxicillin 250mg",
        details: "New lot CAB-2026-014 was added to inventory with 180 units and a June 2027 expiry date.",
        resultLabel: "Success",
        resultTone: "success",
        ipAddress: "192.168.10.15",
        createdAt: minutesAgoIso(47)
      }),
      normalizeLog({
        id: uid(),
        actor: staff[1]?.fullName || "Ana Mae Santillan",
        username: staff[1]?.username || "asantillan",
        actionType: "deleted",
        action: "Archived expired lot",
        target: "Cetirizine 10mg",
        details: "Expired lot CET-2025-003 was removed from active stock after verification.",
        resultLabel: "Archived",
        resultTone: "neutral",
        ipAddress: "192.168.10.31",
        createdAt: new Date("2025-11-12T09:14:00+08:00").toISOString()
      }),
      normalizeLog({
        id: uid(),
        actor: admin?.fullName || "Rico L. Ramos",
        username: admin?.username || "rramos",
        actionType: "security",
        action: "Updated admin credentials",
        target: "Admin Credentials",
        details: "Primary monitoring account credentials were updated for secure system access.",
        resultLabel: "Success",
        resultTone: "success",
        ipAddress: "192.168.10.15",
        createdAt: new Date("2025-08-27T14:36:00+08:00").toISOString()
      }),
      normalizeLog({
        id: uid(),
        actor: staff[0]?.fullName || "Maricel Dela Cruz",
        username: staff[0]?.username || "mdelacruz",
        actionType: "access",
        action: "Logout successful",
        target: "Medicine Inventory",
        details: "User signed out after completing the low-stock review for the afternoon shift.",
        resultLabel: "Success",
        resultTone: "success",
        ipAddress: "127.0.0.1 (localhost)",
        createdAt: new Date("2025-08-27T16:05:00+08:00").toISOString()
      })
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const seedSessions = () => {
    state.sessions = [];
    const admin = getAdminUser();
    const activeStaff = getUsers().filter((user) => text(user.status) === "Active");
    if (admin) upsertSession(admin, { presence: "Online", location: "Settings Module", deviceLabel: "Desktop Browser", ipAddress: "192.168.10.15", signedInAt: minutesAgoIso(6), lastSeenAt: minutesAgoIso(1) });
    if (activeStaff[0]) upsertSession(activeStaff[0], { presence: "Online", location: "Medicine Inventory", deviceLabel: "Android Tablet", ipAddress: "192.168.10.24", signedInAt: minutesAgoIso(22), lastSeenAt: minutesAgoIso(4) });
    if (activeStaff[1]) upsertSession(activeStaff[1], { presence: "Idle", location: "Reports Workspace", deviceLabel: "Windows Laptop", ipAddress: "192.168.10.31", signedInAt: minutesAgoIso(54), lastSeenAt: minutesAgoIso(13) });
  };

  const loadState = () => {
    state.users = readList(STORAGE.users).map(normalizeUser);
    if (!state.users.length) seedUsers();
    state.logs = readList(STORAGE.logs).map(normalizeLog);
    state.logs = state.logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60);
    state.sessions = readList(STORAGE.sessions);
    ensureAdminUser();
    if (!state.logs.length) seedLogs();
    if (!state.sessions.length) seedSessions();
    syncSessions();
    const admin = getAdminUser();
    if (admin) upsertSession(admin, { presence: "Online", location: "Settings Module", deviceLabel: "Desktop Browser", ipAddress: "192.168.10.15", lastSeenAt: nowIso() });
    saveState();
  };

  const hasUpdatedAdminCredentials = (admin) => {
    if (!admin || text(admin.role) !== "Admin") return false;
    return Boolean(text(admin.credentialsUpdatedAt) || (text(admin.password) && admin.password !== "Admin123!"));
  };

  const syncNurseCredentialsVisibility = ({ forceOpen = false } = {}) => {
    const admin = ensureAdminUser();
    const shouldHidePanel = hasUpdatedAdminCredentials(admin) && !forceOpen;
    refs.nurseCredentialsPanel?.classList.toggle("d-none", shouldHidePanel);
    refs.nurseCredentialsStartBtn?.classList.toggle("d-none", !shouldHidePanel);
  };

  const syncNurseSettingsForm = () => {
    const admin = ensureAdminUser();
    if (!admin) return;
    if (refs.nurseFullName) refs.nurseFullName.value = admin.fullName || "";
    if (refs.nurseUsername) refs.nurseUsername.value = admin.username || "";
    if (refs.nurseContact) refs.nurseContact.value = admin.contact || "";
    if (refs.nursePassword) refs.nursePassword.value = "";
    if (refs.nurseConfirmPassword) refs.nurseConfirmPassword.value = "";
    setNotice(refs.nurseSettingsNotice, "account-helper", "Admin account only.");
    syncNurseCredentialsVisibility();
  };

  const renderUsers = () => {
    if (!refs.usersList) return;
    const users = getUsers();
    if (!users.length) {
      refs.usersList.innerHTML = `<div class="account-list-empty"><div class="fw-semibold">No BHW accounts yet.</div><div class="small">Create a new BHW account to get started.</div></div>`;
      setNotice(refs.usersListNotice, "small mt-2", "No BHW accounts created yet.");
      return;
    }

    refs.usersList.innerHTML = users.map((user) => `
      <div class="account-list-item">
        <div class="account-card-main">
          <div class="account-card-head">
            <div class="item-info">
              <div class="account-card-name">${esc(user.fullName)}</div>
              <div class="account-card-meta">${esc(accountMeta(user))}</div>
              <div class="account-card-subline">Username: ${esc(user.username)}</div>
            </div>
          </div>
        </div>
        <div class="account-card-actions">
          <span class="badge ${user.status === "Active" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger"} status-badge">${esc(user.status)}</span>
          <button type="button" class="btn btn-sm btn-outline-primary account-action-btn account-view-btn" data-action="view" data-id="${esc(user.id)}" title="View account">
            <i class="bi bi-eye"></i>View
          </button>
        </div>
      </div>
    `).join("");

    setNotice(refs.usersListNotice, "small mt-2", users.length === 1 ? "1 BHW account available in this module." : `${users.length} BHW accounts available in this module.`);
  };

  const renderSessions = () => {
    if (!refs.activeUsersList) return;
    const rows = state.users.map((user) => {
      const session = state.sessions.find((entry) => entry.userId === user.id) || null;
      const isOnline = Boolean(session) && text(user.status) === "Active";
      const roleText = text(user.role) === USER_ROLE_ADMIN
        ? "Admin"
        : "BHW";
      const moduleName = text(session?.location)
        || (text(user.role) === USER_ROLE_ADMIN ? "Admin Dashboard" : "Medicine Inventory");
      const lastSeenText = session?.lastSeenAt
        ? formatDateTime(session.lastSeenAt)
        : "No recent activity";

      return {
        fullName: user.fullName,
        roleText,
        moduleName,
        username: user.username,
        isOnline,
        presenceText: isOnline ? "Currently active" : `Last seen: ${lastSeenText}`
      };
    }).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.fullName.localeCompare(b.fullName);
    });

    const onlineCount = rows.filter((row) => row.isOnline).length;
    if (refs.activeUsersBadge) refs.activeUsersBadge.textContent = `${onlineCount} Online`;

    if (!rows.length) {
      refs.activeUsersList.innerHTML = `
        <div class="settings-list-item">
          <div class="item-info">
            <div class="fw-semibold">No active users</div>
            <div class="small text-muted">No active accounts are currently available.</div>
          </div>
          <span class="badge bg-secondary-subtle text-secondary">Offline</span>
        </div>
      `;
      return;
    }

    refs.activeUsersList.innerHTML = rows.map((row) => {
      const badgeClass = row.isOnline
        ? "bg-success-subtle text-success"
        : "bg-secondary-subtle text-secondary";
      const badgeLabel = row.isOnline ? "Online" : "Offline";

      return `
        <div class="settings-list-item">
          <div class="item-info">
            <div class="fw-semibold">${esc(row.fullName)}</div>
            <div class="small">Role: ${esc(row.roleText)}</div>
            <div class="small">Module: ${esc(row.moduleName)}</div>
            <div class="small text-muted">Username: ${esc(row.username)}</div>
            <div class="small text-muted">${esc(row.presenceText)}</div>
          </div>
          <span class="badge ${badgeClass}">${badgeLabel}</span>
        </div>
      `;
    }).join("");
  };

  const getLogActionBadgeClass = (actionType) => {
    if (actionType === "created") return "log-chip log-chip--created";
    if (actionType === "deleted") return "log-chip log-chip--deleted";
    if (actionType === "security") return "log-chip log-chip--security";
    if (actionType === "access") return "log-chip log-chip--access";
    return "log-chip log-chip--updated";
  };

  const getLogResultBadgeClass = (resultTone) => {
    if (resultTone === "warning") return "log-chip log-chip--warning";
    if (resultTone === "neutral") return "log-chip log-chip--neutral";
    return "log-chip log-chip--success";
  };
  const getLogActionIconClass = (actionType) => {
    if (actionType === "created") return "bi-plus-circle";
    if (actionType === "deleted") return "bi-trash3";
    if (actionType === "security") return "bi-shield-check";
    if (actionType === "access") return "bi-door-open";
    return "bi-arrow-repeat";
  };
  const getLogResultIconClass = (resultTone) => {
    if (resultTone === "warning") return "bi-exclamation-triangle";
    if (resultTone === "neutral") return "bi-archive";
    return "bi-check-circle";
  };
  const getLogModuleLabel = (log) => {
    const category = keyOf(log.category);
    if (category === "general") return "System";
    if (category === "inventory") return "Inventory";
    if (category === "dispensing") return "Dispensing";
    if (category === "security") return "Security";
    if (category === "access") return "User Access";
    if (category === "bhw") return "BHW Accounts";
    if (category === "settings") return "Settings";
    return text(log.category) || "System";
  };
  const getLogActionDisplayLabel = (log) => {
    const action = keyOf(log.action);
    const type = keyOf(log.actionType);
    if (action.includes("login")) return "Login";
    if (action.includes("logout")) return "Logout";
    if (action.includes("restocked")) return "Restock";
    if (action.includes("disposed")) return "Dispose";
    if (action.includes("dispensed")) return "Dispense";
    if (action.includes("created medicine batch")) return "New Batch";
    if (action.includes("updated stock count")) return "Stock Update";
    if (action.includes("created bhw account")) return "Create Account";
    if (action.includes("updated bhw profile")) return "Edit Account";
    if (action.includes("activated bhw account") || action.includes("deactivated bhw account")) return "Account Status";
    if (action.includes("reset bhw password")) return "Reset Password";
    if (action.includes("changed bhw password")) return "Change Password";
    if (action.includes("credential")) return "Credentials";
    if (type === "created") return "Create";
    if (type === "deleted") return "Remove";
    if (type === "security") return "Security";
    if (type === "access") return "Access";
    return "Update";
  };
  const getLogResultDisplayLabel = (log) => {
    const result = keyOf(log.resultLabel);
    const action = keyOf(log.action);
    if (result === "updated") return "Saved";
    if (result === "dispensed") return "Recorded";
    if (result === "disposed") return "Removed";
    if (result === "archived") return "Archived";
    if (result === "saved") return "Saved";
    if (result === "success") return action.includes("login") || action.includes("logout") ? "Success" : "Done";
    return text(log.resultLabel) || "Done";
  };
  const getLogActionDisplayText = (log) => {
    const action = keyOf(log.action);
    if (action.includes("login")) return "User signed in";
    if (action.includes("logout")) return "User signed out";
    if (action.includes("restocked")) return "Added stock to inventory";
    if (action.includes("disposed")) return "Removed damaged or expired stock";
    if (action.includes("dispensed")) return "Released medicine to patient";
    if (action.includes("created medicine batch")) return "Added a new medicine batch";
    if (action.includes("updated stock count")) return "Adjusted stock balance";
    if (action.includes("archived expired lot")) return "Archived expired batch";
    if (action.includes("created bhw account")) return "Added a BHW account";
    if (action.includes("updated bhw profile")) return "Updated BHW account details";
    if (action.includes("activated bhw account")) return "Activated a BHW account";
    if (action.includes("deactivated bhw account")) return "Deactivated a BHW account";
    if (action.includes("reset bhw password")) return "Issued a temporary password";
    if (action.includes("changed bhw password")) return "Updated account password";
    if (action.includes("credential")) return "Updated admin account details";
    return text(log.action) || "Record updated";
  };

  const setActiveLogFilter = (nextFilter) => {
    const fallback = "all";
    logUiState.actionType = (nextFilter === fallback || LOG_ACTION_LABELS[nextFilter]) ? nextFilter : fallback;
    activityLogFilterButtons.forEach((button) => {
      const isActive = text(button.dataset.activityLogFilter) === logUiState.actionType;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const filteredLogs = () => {
    const query = keyOf(refs.activityLogSearch?.value);
    const actionType = logUiState.actionType || "all";

    return state.logs.filter((log) => {
      const matchesQuery = !query || [
        log.actor,
        log.username,
        log.action,
        log.actionLabel,
        log.category,
        log.target,
        log.details,
        log.resultLabel,
        log.ipAddress
      ].some((value) => keyOf(value).includes(query));

      const matchesActionType = actionType === "all" || log.actionType === actionType;

      return matchesQuery && matchesActionType;
    });
  };

  const renderLogs = () => {
    if (!refs.activityLogTableBody) return;

    const logs = filteredLogs();
    if (refs.activityLogCount) refs.activityLogCount.textContent = `${logs.length} record${logs.length === 1 ? "" : "s"} found`;

    if (!logs.length) {
      refs.activityLogTableBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">No activity logs found.</td></tr>`;
      return;
    }

    refs.activityLogTableBody.innerHTML = logs.map((log) => {
      const moduleLabel = getLogModuleLabel(log);
      const actionLabel = getLogActionDisplayLabel(log);
      const resultLabel = getLogResultDisplayLabel(log);
      return `
        <tr>
          <td>
            <div class="log-datetime">
              <span class="log-date">${esc(formatLogDate(log.createdAt))}</span>
              <span class="log-time">${esc(formatLogTime(log.createdAt))}</span>
              <span class="log-relative">${esc(formatRelativeTime(log.createdAt))}</span>
            </div>
          </td>
          <td>
            <div class="log-user">
              <div class="log-user-copy">
                <div class="log-user-name">${esc(log.actor)}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="log-module-pill" title="${esc(moduleLabel)}">${esc(moduleLabel)}</span>
          </td>
          <td>
            <span class="${getLogActionBadgeClass(log.actionType)}">
              <i class="bi ${getLogActionIconClass(log.actionType)}" aria-hidden="true"></i>
              <span>${esc(actionLabel)}</span>
            </span>
          </td>
          <td>
            <span class="${getLogResultBadgeClass(log.resultTone)}">
              <i class="bi ${getLogResultIconClass(log.resultTone)}" aria-hidden="true"></i>
              <span>${esc(resultLabel)}</span>
            </span>
          </td>
          <td>
            <div class="log-reference" title="${esc(text(log.target) || "System Record")}">
              ${esc(text(log.target) || "System Record")}
            </div>
          </td>
          <td>
            <div class="log-detail" title="${esc(log.details)}">${esc(log.details)}</div>
          </td>
        </tr>
      `;
    }).join("");
  };

  const renderAll = () => {
    renderUsers();
    renderSessions();
    renderLogs();
  };

  const syncEditActionButtons = (user) => {
    if (!user || !refs.editToggleStatusBtn) return;
    const nextStatus = user.status === "Active" ? "Deactivate" : "Activate";
    refs.editToggleStatusBtn.textContent = nextStatus;
    refs.editToggleStatusBtn.className = `btn ${user.status === "Active" ? "btn-outline-danger" : "btn-outline-success"}`;
  };

  const openEditModal = (userId) => {
    const user = findUser(userId);
    if (!user || !editUserModal) return;
    refs.editUserId.value = user.id;
    refs.editFullName.value = user.fullName;
    refs.editUsername.value = user.username;
    refs.editContact.value = user.contact;
    refs.editType.value = user.accountType;
    refs.editRole.value = user.role;
    if (refs.editRoleDisplay) refs.editRoleDisplay.value = roleLabel(user.role);
    syncEditActionButtons(user);
    editUserModal.show();
  };

  const openPasswordModal = (userId) => {
    const user = findUser(userId);
    if (!user || !changePasswordModal) return;
    refs.passwordUserId.value = user.id;
    refs.newPassword.value = "";
    refs.confirmNewPassword.value = "";
    changePasswordModal.show();
  };

  const saveAndRender = () => {
    saveState();
    renderAll();
  };

  const toggleUserStatus = (userId) => {
    const user = findUser(userId);
    if (!user) return;
    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    if (!window.confirm(`Set account "${user.username}" to ${nextStatus}?`)) return;
    user.status = nextStatus;
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    if (nextStatus === "Active") {
      upsertSession(user, { presence: "Online", location: "Settings Module", lastSeenAt: user.updatedAt });
    } else {
      removeSession(user.id);
    }
    addLog({ action: `${nextStatus === "Active" ? "Activated" : "Deactivated"} BHW account`, target: user.fullName, details: `Account @${user.username} was marked as ${nextStatus.toLowerCase()}.`, category: "Access" });
    saveAndRender();
    syncEditActionButtons(user);
    showNotice(`Account ${user.username} is now ${nextStatus}.`);
  };

  const resetUserPassword = (userId) => {
    const user = findUser(userId);
    if (!user) return;
    if (!window.confirm(`Reset password for "${user.username}"?`)) return;
    const temporaryPassword = `MSS-${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
    user.password = temporaryPassword;
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    upsertSession(user, { presence: "Online", location: "Security Controls", lastSeenAt: user.updatedAt });
    addLog({ action: "Reset BHW password", target: user.fullName, details: `Temporary password issued for @${user.username}.`, category: "Security" });
    saveAndRender();
    showNotice(`Temporary password for ${user.username}: ${temporaryPassword}`, "warning");
  };

  const handleCreateAccount = (event) => {
    event.preventDefault();
    const fullName = text(byId("accountFullName")?.value);
    const username = text(byId("accountUsername")?.value);
    const contact = text(byId("accountContact")?.value);
    const accountType = USER_ROLE_BHW;
    const role = normalizeUserRole(text(byId("accountRole")?.value) || USER_ROLE_BHW);
    const password = String(byId("accountPassword")?.value || "");

    if (!fullName || !username || !contact || !password) return void showNotice("Please complete all account fields.", "danger");
    if (password.length < 8) return void showNotice("Password must be at least 8 characters.", "danger");
    if (usernameExists(username)) return void showNotice("Username already exists. Please use another username.", "danger");

    const timestamp = nowIso();
    const user = { id: uid(), fullName, username, contact, accountType, role, status: "Active", password, createdAt: timestamp, createdBy: actorName(), updatedAt: timestamp, updatedBy: actorName() };
    state.users.push(user);
    upsertSession(user, { presence: "Online", location: "BHW Onboarding", deviceLabel: "Android Tablet", lastSeenAt: timestamp, signedInAt: timestamp });
    addLog({ action: "Created BHW account", target: user.fullName, details: `BHW access was provisioned for @${user.username}.`, category: "BHW" });
    saveAndRender();
    refs.createAccountForm?.reset();
    showNotice(`BHW account created successfully for ${user.fullName}.`);
  };

  const handleEditAccount = (event) => {
    event.preventDefault();
    const user = findUser(text(refs.editUserId.value));
    if (!user) return;
    const fullName = text(refs.editFullName.value);
    const username = text(refs.editUsername.value);
    const contact = text(refs.editContact.value);
    const accountType = USER_ROLE_BHW;
    const role = normalizeUserRole(text(refs.editRole.value) || USER_ROLE_BHW);

    if (!fullName || !username || !contact) return void showNotice("Please complete all profile fields.", "danger");
    if (usernameExists(username, user.id)) return void showNotice("Username already exists. Please use another username.", "danger");

    user.fullName = fullName;
    user.username = username;
    user.contact = contact;
    user.accountType = accountType;
    user.role = role;
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    upsertSession(user, { presence: "Online", lastSeenAt: user.updatedAt });
    addLog({ action: "Updated BHW profile", target: user.fullName, details: `Profile details for @${user.username} were updated.`, category: "BHW" });
    saveAndRender();
    editUserModal?.hide();
    showNotice(`Profile updated for ${user.fullName}.`);
  };

  const handleNurseSettingsSave = (event) => {
    event.preventDefault();
    hideNotice();
    const admin = ensureAdminUser();
    const previousName = admin.fullName;
    const fullName = text(refs.nurseFullName?.value);
    const username = text(refs.nurseUsername?.value);
    const contact = text(refs.nurseContact?.value || admin.contact);
    const password = String(refs.nursePassword?.value || "");
    const confirm = String(refs.nurseConfirmPassword?.value || "");
    const hasProfileChange = fullName !== text(admin.fullName) || username !== text(admin.username);
    const hasPasswordChange = Boolean(password || confirm);

    if (!fullName || !username) {
      setNotice(refs.nurseSettingsNotice, "account-helper", "Please complete all required fields.", "danger");
      return;
    }
    if (!hasProfileChange && !hasPasswordChange) {
      setNotice(refs.nurseSettingsNotice, "account-helper", "No changes to save yet.", "danger");
      return;
    }
    if (usernameExists(username, admin.id)) {
      setNotice(refs.nurseSettingsNotice, "account-helper", "Username already exists. Please use another username.", "danger");
      return;
    }
    if (hasPasswordChange) {
      if (!password || !confirm) {
        setNotice(refs.nurseSettingsNotice, "account-helper", "Enter and confirm the new password.", "danger");
        return;
      }
      if (password.length < 8) {
        setNotice(refs.nurseSettingsNotice, "account-helper", "Password must be at least 8 characters.", "danger");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setNotice(refs.nurseSettingsNotice, "account-helper", "Password must include at least 1 special character.", "danger");
        return;
      }
      if (password !== confirm) {
        setNotice(refs.nurseSettingsNotice, "account-helper", "Password and confirmation do not match.", "danger");
        return;
      }
      admin.password = password;
      admin.credentialsUpdatedAt = nowIso();
    }

    admin.fullName = fullName;
    admin.username = username;
    admin.contact = contact;
    admin.accountType = USER_ROLE_ADMIN;
    admin.role = USER_ROLE_ADMIN;
    admin.status = "Active";
    admin.updatedAt = nowIso();
    admin.updatedBy = actorName();
    upsertSession(admin, { presence: "Online", location: "Settings Module", deviceLabel: "Desktop Browser", ipAddress: "192.168.10.15", lastSeenAt: admin.updatedAt });
    addLog({ actor: previousName || "Nurse-in-Charge", action: "Updated Nurse-in-Charge credentials", target: fullName, details: password ? "Primary admin profile and password were updated." : "Primary admin profile details were updated.", category: "Security" });
    saveAndRender();
    syncNurseSettingsForm();
    setNotice(refs.nurseSettingsNotice, "account-helper", "Credentials updated.", "success");
  };

  const handleChangePassword = (event) => {
    event.preventDefault();
    const user = findUser(text(refs.passwordUserId.value));
    if (!user) return;
    const password = String(refs.newPassword.value || "");
    const confirm = String(refs.confirmNewPassword.value || "");
    if (!password || !confirm) return void showNotice("Please fill in both password fields.", "danger");
    if (password.length < 8) return void showNotice("New password must be at least 8 characters.", "danger");
    if (password !== confirm) return void showNotice("Password and confirmation do not match.", "danger");
    user.password = password;
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    upsertSession(user, { presence: "Online", location: "Security Controls", lastSeenAt: user.updatedAt });
    addLog({ action: "Changed BHW password", target: user.fullName, details: `Password was updated for @${user.username}.`, category: "Security" });
    saveAndRender();
    changePasswordModal?.hide();
    showNotice(`Password changed for ${user.username}.`);
  };

  const scrollActivePanelIntoView = () => {
    if (!settingsContent || !window.matchMedia("(max-width: 992px)").matches) return;
    const activePanel = settingsContent.querySelector(".settings-panel.is-active");
    if (!activePanel) return;
    const y = activePanel.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const setActivePanel = (targetId) => {
    if (!settingsNavLinks.length || !settingsPanels.length) return;
    const fallbackId = settingsPanels[0]?.id || "";
    const nextId = settingsPanels.some((panel) => panel.id === targetId) ? targetId : fallbackId;
    if (!nextId) return;

    settingsPanels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.id === nextId);
    });

    settingsNavLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${nextId}`);
    });
  };

  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
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

  refs.sidebarToggle?.addEventListener("click", toggleSidebar);
  refs.sidebarBackdrop?.addEventListener("click", closeMobileSidebar);
  window.addEventListener("resize", () => { if (!isMobile()) closeMobileSidebar(); });
  refs.logoutLink?.addEventListener("click", (event) => { event.preventDefault(); logoutModal?.show(); });
  refs.createAccountForm?.addEventListener("submit", handleCreateAccount);
  refs.editAccountForm?.addEventListener("submit", handleEditAccount);
  refs.changePasswordForm?.addEventListener("submit", handleChangePassword);
  refs.nurseSettingsForm?.addEventListener("submit", handleNurseSettingsSave);
  refs.usersList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-id]");
    if (!button) return;
    if (text(button.dataset.action) === "view") openEditModal(text(button.dataset.id));
  });
  refs.editToggleStatusBtn?.addEventListener("click", () => toggleUserStatus(text(refs.editUserId.value)));
  refs.editResetPasswordBtn?.addEventListener("click", () => resetUserPassword(text(refs.editUserId.value)));
  refs.editChangePasswordBtn?.addEventListener("click", () => openPasswordModal(text(refs.editUserId.value)));
  refs.nurseCredentialsStartBtn?.addEventListener("click", () => {
    hideNotice();
    syncNurseCredentialsVisibility({ forceOpen: true });
  });
  refs.activityLogSearch?.addEventListener("input", renderLogs);
  activityLogFilterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveLogFilter(text(button.dataset.activityLogFilter) || "all");
      renderLogs();
    });
  });
  settingsNavLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = text(link.getAttribute("href")).replace(/^#/, "");
      if (!targetId) return;
      setActivePanel(targetId);
      if (history.replaceState) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${targetId}`);
      }
      window.requestAnimationFrame(scrollActivePanelIntoView);
    });
  });

  window.addEventListener("hashchange", () => {
    setActivePanel(text(window.location.hash).replace(/^#/, ""));
  });

  loadState();
  setActiveLogFilter("all");
  renderAll();
  syncNurseSettingsForm();
  setActivePanel(text(window.location.hash).replace(/^#/, ""));
})();
