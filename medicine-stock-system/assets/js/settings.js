(() => {
  const STATE_ENDPOINT = "state-api.php";
  const AUTH_ENDPOINT = "auth-api.php";
  const PRESENCE_ENDPOINT = `${STATE_ENDPOINT}?scope=presence`;
  const ACTIVE_USERS_REFRESH_MS = 30000;
  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    moduleAlertIcon: byId("moduleAlertIcon"),
    moduleAlertText: byId("moduleAlertText"),
    createAccountForm: byId("createAccountForm"),
    usersList: byId("usersList"),
    usersListNotice: byId("usersListNotice"),
    nurseSettingsForm: byId("nurseSettingsForm"),
    nurseCredentialsSummary: byId("nurseCredentialsSummary"),
    nurseCredentialsPanel: byId("nurseCredentialsPanel"),
    nurseCredentialsStartBtn: byId("nurseCredentialsStartBtn"),
    nurseCredentialsCancelBtn: byId("nurseCredentialsCancelBtn"),
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
    changePasswordForm: byId("changePasswordForm"),
    passwordUserId: byId("passwordUserId"),
    resetFullName: byId("resetFullName"),
    resetUsername: byId("resetUsername"),
    newPassword: byId("newPassword"),
    confirmNewPassword: byId("confirmNewPassword"),
    resetCredentialsNotice: byId("resetCredentialsNotice"),
    confirmAccountActionTitle: byId("confirmAccountActionTitle"),
    confirmAccountActionMessage: byId("confirmAccountActionMessage"),
    confirmAccountActionBtn: byId("confirmAccountActionBtn")
  };

  const settingsNavLinks = Array.from(document.querySelectorAll(".settings-nav a[href^='#']"));
  const settingsPanels = Array.from(document.querySelectorAll(".settings-panel"));
  const settingsContent = document.querySelector(".settings-content");
  const activityLogFilterButtons = Array.from(document.querySelectorAll("[data-activity-log-filter]"));
  const confirmAccountActionModalElement = byId("confirmAccountActionModal");
  const editUserModal = byId("editUserModal") && window.bootstrap ? new window.bootstrap.Modal(byId("editUserModal")) : null;
  const changePasswordModal = byId("changePasswordModal") && window.bootstrap ? new window.bootstrap.Modal(byId("changePasswordModal")) : null;
  const confirmAccountActionModal = confirmAccountActionModalElement && window.bootstrap ? new window.bootstrap.Modal(confirmAccountActionModalElement) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = { users: [], logs: [], sessions: [] };
  const logUiState = { actionType: "all" };
  let pendingAccountAction = null;
  let pendingConfirmedAccountAction = null;
  let activeUsersRefreshHandle = 0;
  let noticeTimer = 0;
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
  const hasSpecialCharacter = (value) => /[^A-Za-z0-9]/.test(String(value || ""));
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
      const message = String(payload.message || "Unable to load settings data right now.");
      const requestError = new Error(message);
      requestError.payload = payload;
      throw requestError;
    }

    return payload;
  };

  const refreshCurrentSession = async ({ rotate = false, locationLabel = "" } = {}) => requestJson(AUTH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "refresh_current_session",
      rotate,
      locationLabel
    })
  });

  const resolveLogActionType = (value = {}) => {
    const explicitType = keyOf(value.actionType || value.type);
    const category = keyOf(value.category);
    const actionText = `${text(value.action)} ${text(value.details)}`.toLowerCase();

    if (category === "security" || /password|credential|security/.test(actionText)) return "security";
    if (/created|added|provisioned|registered/.test(actionText)) return "created";
    if (/deleted|removed|archived|expired batch/.test(actionText)) return "deleted";
    if (category === "access" || /login|logout|activate|deactivate|access/.test(actionText)) return "access";
    if (LOG_ACTION_LABELS[explicitType]) return explicitType;
    return "updated";
  };

  const currentActorUsername = () => getAdminUser()?.username || text(currentAuthUser?.username) || "admin";
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

  const syncStateFromServer = (serverState = {}) => {
    state.users = Array.isArray(serverState.users) ? serverState.users.map(normalizeUser) : [];
    state.logs = Array.isArray(serverState.logs)
      ? serverState.logs.map(normalizeLog).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 60)
      : [];
    state.sessions = Array.isArray(serverState.sessions)
      ? [...serverState.sessions].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      : [];
  };

  const persistState = async () => {
    const payload = await requestJson(STATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        state: {
          users: state.users,
          logs: state.logs
        }
      })
    });
    syncStateFromServer(payload.state || {});
    return payload;
  };

  const setNotice = (element, baseClass, message, tone = "muted") => {
    if (!element) return;
    const toneClass = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-muted";
    element.className = `${baseClass} ${toneClass}`;
    element.textContent = message;
  };

  const showNotice = (message, type = "success") => {
    if (!refs.moduleAlert) return;
    const tone = type === "danger"
      ? "danger"
      : type === "warning"
        ? "warning"
        : type === "info"
          ? "info"
          : "success";
    const iconClass = tone === "danger"
      ? "bi bi-x-octagon-fill"
      : tone === "warning"
        ? "bi bi-exclamation-triangle-fill"
        : tone === "info"
          ? "bi bi-info-circle-fill"
          : "bi bi-check2-circle";

    window.clearTimeout(noticeTimer);
    refs.moduleAlert.dataset.tone = tone;
    refs.moduleAlert.setAttribute("aria-hidden", "false");
    refs.moduleAlert.classList.add("is-visible");
    if (refs.moduleAlertIcon) {
      refs.moduleAlertIcon.innerHTML = `<i class="${iconClass}"></i>`;
    }
    if (refs.moduleAlertText) {
      refs.moduleAlertText.textContent = message;
    } else {
      refs.moduleAlert.textContent = message;
    }
    noticeTimer = window.setTimeout(() => hideNotice(), 2400);
  };

  const hideNotice = () => {
    window.clearTimeout(noticeTimer);
    refs.moduleAlert?.classList.remove("is-visible");
    refs.moduleAlert?.setAttribute("aria-hidden", "true");
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
  const actorName = () => getAdminUser()?.fullName || text(currentAuthUser?.fullName) || "Nurse-in-Charge";
  const roleLabel = (role) => text(role) === USER_ROLE_ADMIN ? "Nurse-in-Charge" : "BHW";
  const findUser = (id) => state.users.find((user) => user.id === id) || null;
  const getUsers = () => state.users
    .filter((user) => text(user.role) !== USER_ROLE_ADMIN)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const usernameExists = (username, excludeId = "") => state.users.some((user) => keyOf(user.username) === keyOf(username) && user.id !== excludeId);
  const accountMeta = (user) => text(user.role) === USER_ROLE_ADMIN
    ? "Nurse-in-Charge | Medicine Stock Module"
    : "BHW Access | Medicine Stock Module";

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

  const loadState = async () => {
    const payload = await requestJson(`${STATE_ENDPOINT}?t=${Date.now()}`);
    syncStateFromServer(payload.state || {});
    syncSessions();
  };

  const refreshActiveUsers = async () => {
    const separator = PRESENCE_ENDPOINT.includes("?") ? "&" : "?";
    const payload = await requestJson(`${PRESENCE_ENDPOINT}${separator}t=${Date.now()}`);
    const presenceState = payload.state || {};
    if (Array.isArray(presenceState.users)) {
      state.users = presenceState.users.map(normalizeUser);
    }
    if (Array.isArray(presenceState.sessions)) {
      state.sessions = [...presenceState.sessions].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
    }
    syncSessions();
    renderSessions();
  };

  const startActiveUsersPolling = () => {
    if (activeUsersRefreshHandle) {
      window.clearInterval(activeUsersRefreshHandle);
    }

    activeUsersRefreshHandle = window.setInterval(() => {
      if (document.hidden) return;
      void refreshActiveUsers().catch(() => {});
    }, ACTIVE_USERS_REFRESH_MS);
  };

  const setNurseCredentialsEditorOpen = (open) => {
    refs.nurseCredentialsSummary?.classList.toggle("d-none", open);
    refs.nurseCredentialsPanel?.classList.toggle("d-none", !open);
  };

  const syncNurseSettingsForm = () => {
    const admin = getAdminUser();
    if (!admin) {
      setNotice(refs.nurseSettingsNotice, "account-helper", "Admin account details are not available right now.", "danger");
      setNurseCredentialsEditorOpen(true);
      return;
    }
    if (refs.nurseFullName) refs.nurseFullName.value = admin.fullName || "";
    if (refs.nurseUsername) refs.nurseUsername.value = admin.username || "";
    if (refs.nurseContact) refs.nurseContact.value = admin.contact || "";
    if (refs.nursePassword) refs.nursePassword.value = "";
    if (refs.nurseConfirmPassword) refs.nurseConfirmPassword.value = "";
    setNotice(refs.nurseSettingsNotice, "account-helper", "Admin account only.");
    setNurseCredentialsEditorOpen(false);
  };

  const renderUsers = () => {
    if (!refs.usersList) return;
    const users = getUsers();
    if (!users.length) {
      refs.usersList.innerHTML = `<div class="account-list-empty"><div class="fw-semibold">No BHW accounts yet.</div><div class="small">Create a new BHW account to get started.</div></div>`;
      setNotice(refs.usersListNotice, "small mt-2", "No BHW accounts created yet.");
      return;
    }

    refs.usersList.innerHTML = users.map((user) => {
      const badgeClass = user.status === "Active" ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger";
      const badgeText = user.status === "Active" ? "Active" : "Inactive";
      const accountId = esc(user.id);
      const fullName = esc(user.fullName);
      const username = esc(user.username);
      const contactNumber = esc(user.contact || "Not provided");
      const accountMetaText = esc(accountMeta(user));
      const toggleAction = user.status === "Active"
        ? { label: "Deactivate", icon: "bi-person-slash", tone: "text-danger" }
        : { label: "Activate", icon: "bi-person-check", tone: "text-success" };

      return `
        <div class="account-list-item settings-list-item staff-account-card">
          <div class="staff-account-main">
            <div class="staff-account-head">
              <div class="item-info">
                <div class="staff-account-name">${fullName}</div>
                <div class="staff-account-meta">${accountMetaText}</div>
                <div class="small">Username: ${username}</div>
                <div class="small text-muted">Mobile: ${contactNumber}</div>
              </div>
            </div>
          </div>
          <div class="staff-account-actions">
            <span class="badge ${badgeClass} staff-account-status">${badgeText}</span>
            <div class="dropdown staff-action-menu">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary staff-action-menu-toggle"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                aria-label="More staff actions"
              >
                <i class="bi bi-three-dots"></i>
              </button>
              <ul class="dropdown-menu dropdown-menu-end staff-action-menu-list">
                <li>
                  <button type="button" class="dropdown-item ${toggleAction.tone}" data-action="toggle" data-id="${accountId}">
                    <i class="bi ${toggleAction.icon}"></i> ${toggleAction.label}
                  </button>
                </li>
                <li>
                  <button type="button" class="dropdown-item" data-action="reset" data-id="${accountId}">
                    <i class="bi bi-key"></i> Reset
                  </button>
                </li>
                <li>
                  <button type="button" class="dropdown-item text-danger" data-action="delete" data-id="${accountId}">
                    <i class="bi bi-trash"></i> Delete
                  </button>
                </li>
              </ul>
            </div>
          </div>
        </div>
      `;
    }).join("");

    setNotice(refs.usersListNotice, "small mt-2", users.length === 1 ? "1 BHW account available in this module." : `${users.length} BHW accounts available in this module.`);
  };

  const renderSessions = () => {
    if (!refs.activeUsersList) return;
    const rows = state.users.map((user) => {
      const session = state.sessions.find((entry) => entry.userId === user.id) || null;
      const isOnline = text(session?.presence) === "Online" && text(user.status) === "Active";
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
    if (resultTone === "danger" || resultTone === "failed") return "log-chip log-chip--danger";
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
    if (resultTone === "danger" || resultTone === "failed") return "bi-x-circle";
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
    if (action.includes("failed login") || action.includes("login failed")) return "Login Failed";
    if (action.includes("login successful")) return "Login";
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
    if (action.includes("reset bhw credentials")) return "Reset Credentials";
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
    if (result === "failed") return "Failed";
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
    if (action.includes("reset bhw credentials")) return "Reset temporary BHW username and password";
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
      refs.activityLogTableBody.innerHTML = `<tr class="logs-empty-row"><td colspan="7" class="text-center text-muted py-4 logs-empty-cell">No activity logs found.</td></tr>`;
      return;
    }

    refs.activityLogTableBody.innerHTML = logs.map((log) => {
      const moduleLabel = getLogModuleLabel(log);
      const actionLabel = getLogActionDisplayLabel(log);
      const resultLabel = getLogResultDisplayLabel(log);
      return `
        <tr class="logs-row">
          <td class="logs-cell logs-cell--datetime" data-label="Date &amp; Time">
            <div class="log-datetime">
              <span class="log-date">${esc(formatLogDate(log.createdAt))}</span>
              <span class="log-time">${esc(formatLogTime(log.createdAt))}</span>
              <span class="log-relative">${esc(formatRelativeTime(log.createdAt))}</span>
            </div>
          </td>
          <td class="logs-cell logs-cell--user" data-label="User">
            <div class="log-user">
              <div class="log-user-copy">
                <div class="log-user-name">${esc(log.actor)}</div>
              </div>
            </div>
          </td>
          <td class="logs-cell logs-cell--module" data-label="Module">
            <span class="log-module-pill" title="${esc(moduleLabel)}">${esc(moduleLabel)}</span>
          </td>
          <td class="logs-cell logs-cell--action" data-label="Action">
            <span class="${getLogActionBadgeClass(log.actionType)}">
              <i class="bi ${getLogActionIconClass(log.actionType)}" aria-hidden="true"></i>
              <span>${esc(actionLabel)}</span>
            </span>
          </td>
          <td class="logs-cell logs-cell--result" data-label="Result">
            <span class="${getLogResultBadgeClass(log.resultTone)}">
              <i class="bi ${getLogResultIconClass(log.resultTone)}" aria-hidden="true"></i>
              <span>${esc(resultLabel)}</span>
            </span>
          </td>
          <td class="logs-cell logs-cell--reference" data-label="Reference">
            <div class="log-reference" title="${esc(text(log.target) || "System Record")}">
              ${esc(text(log.target) || "System Record")}
            </div>
          </td>
          <td class="logs-cell logs-cell--details" data-label="Details">
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
    editUserModal.show();
  };

  const openPasswordModal = (userId) => {
    const user = findUser(userId);
    if (!user || !changePasswordModal) return;
    refs.passwordUserId.value = user.id;
    if (refs.resetFullName) refs.resetFullName.value = user.fullName || "";
    if (refs.resetUsername) refs.resetUsername.value = user.username || "";
    refs.newPassword.value = "";
    refs.confirmNewPassword.value = "";
    setNotice(refs.resetCredentialsNotice, "small text-muted mt-3", "Temporary credentials are never shown again after this reset.");
    changePasswordModal.show();
  };

  const resetAccountActionConfirmation = () => {
    if (refs.confirmAccountActionTitle) refs.confirmAccountActionTitle.textContent = "Confirm Action";
    if (refs.confirmAccountActionMessage) refs.confirmAccountActionMessage.textContent = "Are you sure you want to continue?";
    if (refs.confirmAccountActionBtn) {
      refs.confirmAccountActionBtn.textContent = "Continue";
      refs.confirmAccountActionBtn.className = "btn btn-warning btn-modern";
    }
  };

  const openAccountActionConfirmModal = (action, userId) => {
    const user = findUser(userId);
    if (!user) return;

    if (!confirmAccountActionModal) {
      if (action === "toggle") {
        void toggleUserStatus(userId);
      } else if (action === "reset") {
        editUserModal?.hide();
        openPasswordModal(userId);
      } else if (action === "delete") {
        void deleteUserAccount(userId);
      }
      return;
    }

    pendingAccountAction = { action, userId };

    if (action === "toggle") {
      const nextStatus = user.status === "Active" ? "Inactive" : "Active";
      const isDeactivation = nextStatus !== "Active";
      if (refs.confirmAccountActionTitle) refs.confirmAccountActionTitle.textContent = `Confirm ${isDeactivation ? "Deactivate" : "Activate"} Account`;
      if (refs.confirmAccountActionMessage) refs.confirmAccountActionMessage.textContent = `Set account "${user.username}" to ${nextStatus}?`;
      if (refs.confirmAccountActionBtn) {
        refs.confirmAccountActionBtn.textContent = isDeactivation ? "Deactivate Account" : "Activate Account";
        refs.confirmAccountActionBtn.className = `btn ${isDeactivation ? "btn-danger" : "btn-success"} btn-modern`;
      }
    } else if (action === "reset") {
      if (refs.confirmAccountActionTitle) refs.confirmAccountActionTitle.textContent = "Confirm Reset Credentials";
      if (refs.confirmAccountActionMessage) refs.confirmAccountActionMessage.textContent = `Reset credentials for "${user.fullName}"? You will assign a new temporary username and password in the next step.`;
      if (refs.confirmAccountActionBtn) {
        refs.confirmAccountActionBtn.textContent = "Continue to Reset";
        refs.confirmAccountActionBtn.className = "btn btn-warning btn-modern";
      }
    } else if (action === "delete") {
      if (refs.confirmAccountActionTitle) refs.confirmAccountActionTitle.textContent = "Confirm Delete Account";
      if (refs.confirmAccountActionMessage) refs.confirmAccountActionMessage.textContent = `Delete BHW account "${user.fullName}"? This action cannot be undone.`;
      if (refs.confirmAccountActionBtn) {
        refs.confirmAccountActionBtn.textContent = "Delete Account";
        refs.confirmAccountActionBtn.className = "btn btn-danger btn-modern";
      }
    }

    confirmAccountActionModal.show();
  };

  const runConfirmedAccountAction = () => {
    if (!pendingAccountAction) return;
    const nextAction = pendingAccountAction;

    if (nextAction.action === "toggle") {
      pendingConfirmedAccountAction = () => {
        void toggleUserStatus(nextAction.userId);
      };
    } else if (nextAction.action === "reset") {
      pendingConfirmedAccountAction = () => {
        editUserModal?.hide();
        openPasswordModal(nextAction.userId);
      };
    } else if (nextAction.action === "delete") {
      pendingConfirmedAccountAction = () => {
        void deleteUserAccount(nextAction.userId);
      };
    } else {
      pendingConfirmedAccountAction = null;
    }

    confirmAccountActionModal?.hide();
  };

  const saveAndRender = async () => {
    await persistState();
    renderAll();
    syncNurseSettingsForm();
  };

  const toggleUserStatus = async (userId) => {
    const user = findUser(userId);
    if (!user) return;
    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    user.status = nextStatus;
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    if (nextStatus !== "Active") {
      removeSession(user.id);
    }
    addLog({ action: `${nextStatus === "Active" ? "Activated" : "Deactivated"} BHW account`, actionType: "access", target: user.fullName, details: `Account @${user.username} was marked as ${nextStatus.toLowerCase()}.`, category: "Access" });
    await saveAndRender();
  };

  const deleteUserAccount = async (userId) => {
    const user = findUser(userId);
    if (!user) return;
    state.users = state.users.filter((entry) => entry.id !== user.id);
    removeSession(user.id);
    addLog({ action: "Deleted BHW account", actionType: "deleted", target: user.fullName, details: `BHW account @${user.username} was deleted by admin.`, category: "BHW", resultLabel: "Deleted", resultTone: "neutral" });
    await saveAndRender();
    editUserModal?.hide();
    changePasswordModal?.hide();
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    const fullName = text(byId("accountFullName")?.value);
    const username = text(byId("accountUsername")?.value);
    const contact = text(byId("accountContact")?.value);
    const accountType = USER_ROLE_BHW;
    const role = normalizeUserRole(text(byId("accountRole")?.value) || USER_ROLE_BHW);
    const password = String(byId("accountPassword")?.value || "");
    const confirmPassword = String(byId("accountConfirmPassword")?.value || "");

    if (!fullName || !username || !contact || !password || !confirmPassword) {
      return void showNotice("Please complete all account fields.", "danger");
    }
    if (password.length < 8 || !hasSpecialCharacter(password)) {
      return void showNotice("Temporary password must be at least 8 characters and include 1 special character.", "danger");
    }
    if (password !== confirmPassword) {
      return void showNotice("Password and confirm password do not match.", "danger");
    }
    if (usernameExists(username)) return void showNotice("Username already exists. Please use another username.", "danger");

    const timestamp = nowIso();
    const user = { id: uid(), fullName, username, contact, accountType, role, status: "Active", password, credentialsUpdatedAt: "", createdAt: timestamp, createdBy: actorName(), updatedAt: timestamp, updatedBy: actorName() };
    state.users.push(user);
    addLog({ action: "Created BHW account", actionType: "created", target: user.fullName, details: `Temporary BHW access was provisioned for @${user.username}. Password change is required on first login.`, category: "BHW" });
    await saveAndRender();
    refs.createAccountForm?.reset();
    showNotice(`Temporary BHW account created successfully for ${user.fullName}.`);
  };

  const handleEditAccount = async (event) => {
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
    addLog({ action: "Updated BHW profile", actionType: "updated", target: user.fullName, details: `Profile details for @${user.username} were updated.`, category: "BHW" });
    await saveAndRender();
    editUserModal?.hide();
  };

  const handleNurseSettingsSave = async (event) => {
    event.preventDefault();
    hideNotice();
    const admin = getAdminUser();
    if (!admin) {
      setNotice(refs.nurseSettingsNotice, "account-helper", "Admin account is not available right now.", "danger");
      return;
    }
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
    addLog({ actor: previousName || "Nurse-in-Charge", action: "Updated Nurse-in-Charge credentials", actionType: "security", target: fullName, details: password ? "Primary admin profile and password were updated." : "Primary admin profile details were updated.", category: "Security" });
    try {
      await saveAndRender();
    } catch (error) {
      setNotice(refs.nurseSettingsNotice, "account-helper", error instanceof Error ? error.message : "Unable to save admin credentials right now.", "danger");
      return;
    }
    let sessionRefreshFailed = false;
    try {
      await refreshCurrentSession({
        rotate: hasPasswordChange,
        locationLabel: "Settings Module"
      });
    } catch (error) {
      sessionRefreshFailed = true;
      console.error("Unable to refresh the current admin session after saving credentials.", error);
    }
    syncNurseSettingsForm();
    showNotice(
      sessionRefreshFailed
        ? "Admin credentials updated successfully. Continue using the dashboard with your new credentials."
        : "Admin credentials updated successfully."
    );
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    const user = findUser(text(refs.passwordUserId.value));
    if (!user) return;
    const username = text(refs.resetUsername?.value);
    const password = String(refs.newPassword.value || "");
    const confirm = String(refs.confirmNewPassword.value || "");
    if (!username || !password || !confirm) {
      setNotice(refs.resetCredentialsNotice, "small mt-3", "Please fill in all reset fields.", "danger");
      return;
    }
    if (usernameExists(username, user.id)) {
      setNotice(refs.resetCredentialsNotice, "small mt-3", "Username already exists. Please use another username.", "danger");
      return;
    }
    if (password.length < 8 || !hasSpecialCharacter(password)) {
      setNotice(refs.resetCredentialsNotice, "small mt-3", "Temporary password must be at least 8 characters and include 1 special character.", "danger");
      return;
    }
    if (password !== confirm) {
      setNotice(refs.resetCredentialsNotice, "small mt-3", "Password and confirmation do not match.", "danger");
      return;
    }
    user.username = username;
    user.password = password;
    user.credentialsUpdatedAt = "";
    user.updatedAt = nowIso();
    user.updatedBy = actorName();
    removeSession(user.id);
    addLog({ action: "Reset BHW credentials", actionType: "security", target: user.fullName, details: `Temporary username and password were reset for @${user.username}. Password change is required on next login.`, category: "Security" });
    setNotice(refs.resetCredentialsNotice, "small mt-3", "Temporary credentials updated. BHW must change them on next login.", "success");
    try {
      await saveAndRender();
    } catch (error) {
      setNotice(refs.resetCredentialsNotice, "small mt-3", error instanceof Error ? error.message : "Unable to reset credentials right now.", "danger");
      return;
    }
    changePasswordModal?.hide();
  };

  const scrollActivePanelIntoView = () => {
    if (!settingsContent || !window.matchMedia("(max-width: 992px)").matches) return;
    const activePanel = settingsContent.querySelector(".settings-panel.is-active");
    if (!activePanel) return;
    const y = activePanel.getBoundingClientRect().top + window.scrollY - 12;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const releaseInitialSettingsPanelBootState = () => {
    document.documentElement.classList.remove("settings-panel-booting");
    document.documentElement.removeAttribute("data-settings-initial-panel");
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

    releaseInitialSettingsPanelBootState();
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
  refs.createAccountForm?.addEventListener("submit", (event) => { void handleCreateAccount(event); });
  refs.editAccountForm?.addEventListener("submit", (event) => { void handleEditAccount(event); });
  refs.changePasswordForm?.addEventListener("submit", (event) => { void handleChangePassword(event); });
  refs.nurseSettingsForm?.addEventListener("submit", (event) => { void handleNurseSettingsSave(event); });
  refs.usersList?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action][data-id]");
    if (button) {
      const action = text(button.dataset.action);
      const userId = text(button.dataset.id);
      if (action === "toggle") openAccountActionConfirmModal("toggle", userId);
      if (action === "reset") openAccountActionConfirmModal("reset", userId);
      if (action === "delete") openAccountActionConfirmModal("delete", userId);
      return;
    }
  });
  refs.confirmAccountActionBtn?.addEventListener("click", runConfirmedAccountAction);
  refs.nurseCredentialsStartBtn?.addEventListener("click", () => {
    hideNotice();
    setNurseCredentialsEditorOpen(true);
    window.setTimeout(() => refs.nurseUsername?.focus(), 120);
  });
  refs.nurseCredentialsCancelBtn?.addEventListener("click", () => {
    hideNotice();
    syncNurseSettingsForm();
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

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshActiveUsers().catch(() => {});
    }
  });

  confirmAccountActionModalElement?.addEventListener("hidden.bs.modal", () => {
    const callback = pendingConfirmedAccountAction;
    pendingConfirmedAccountAction = null;
    pendingAccountAction = null;
    resetAccountActionConfirmation();
    if (typeof callback === "function") {
      callback();
    }
  });

  byId("changePasswordModal")?.addEventListener("hidden.bs.modal", () => {
    if (refs.resetFullName) refs.resetFullName.value = "";
    if (refs.resetUsername) refs.resetUsername.value = "";
    if (refs.newPassword) refs.newPassword.value = "";
    if (refs.confirmNewPassword) refs.confirmNewPassword.value = "";
    setNotice(refs.resetCredentialsNotice, "small text-muted mt-3", "Temporary credentials are never shown again after this reset.");
  });

  const init = async () => {
    try {
      await loadState();
      setActiveLogFilter("all");
      renderAll();
      syncNurseSettingsForm();
      startActiveUsersPolling();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Unable to load settings data right now.", "danger");
      setActiveLogFilter("all");
      renderAll();
      startActiveUsersPolling();
    }
    setActivePanel(text(window.location.hash).replace(/^#/, ""));
  };

  void init();
})();
