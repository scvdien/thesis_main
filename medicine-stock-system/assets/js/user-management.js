(() => {
  const STORAGE_USERS = "mss_users_v1";
  const STORAGE_AUDIT = "mss_audit_v1";
  const currentYear = new Date().getFullYear();

  const yearEl = document.getElementById("year");
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const logoutLink = document.getElementById("logoutLink");
  const actorSelect = document.getElementById("actorSelect");
  const moduleAlert = document.getElementById("moduleAlert");

  const createAccountForm = document.getElementById("createAccountForm");
  const usersTableBody = document.getElementById("usersTableBody");
  const auditTableBody = document.getElementById("auditTableBody");
  const searchInput = document.getElementById("searchInput");
  const filterStatus = document.getElementById("filterStatus");
  const filterRole = document.getElementById("filterRole");
  const filterType = document.getElementById("filterType");

  const editAccountForm = document.getElementById("editAccountForm");
  const editUserId = document.getElementById("editUserId");
  const editFullName = document.getElementById("editFullName");
  const editUsername = document.getElementById("editUsername");
  const editContact = document.getElementById("editContact");
  const editType = document.getElementById("editType");
  const editRole = document.getElementById("editRole");

  const changePasswordForm = document.getElementById("changePasswordForm");
  const passwordUserId = document.getElementById("passwordUserId");
  const newPassword = document.getElementById("newPassword");
  const confirmNewPassword = document.getElementById("confirmNewPassword");

  const metricActiveUsers = document.getElementById("metricActiveUsers");
  const metricInactiveUsers = document.getElementById("metricInactiveUsers");
  const metricAdminUsers = document.getElementById("metricAdminUsers");
  const metricStaffUsers = document.getElementById("metricStaffUsers");

  const editUserModalEl = document.getElementById("editUserModal");
  const changePasswordModalEl = document.getElementById("changePasswordModal");
  const logoutModalEl = document.getElementById("logoutModal");

  const editUserModal = editUserModalEl && window.bootstrap ? new window.bootstrap.Modal(editUserModalEl) : null;
  const changePasswordModal = changePasswordModalEl && window.bootstrap ? new window.bootstrap.Modal(changePasswordModalEl) : null;
  const logoutModal = logoutModalEl && window.bootstrap ? new window.bootstrap.Modal(logoutModalEl) : null;

  if (yearEl) yearEl.textContent = String(currentYear);

  const state = {
    users: [],
    audit: []
  };

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const formatDateTime = (iso) => {
    const parsed = new Date(iso);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(parsed);
  };

  const normalizeText = (value) => String(value || "").trim();
  const normalizeKey = (value) => normalizeText(value).toLowerCase();
  const escapeHtml = (value) => String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const getActor = () => normalizeText(actorSelect?.value) || "Admin User";

  const showNotice = (message, type = "success") => {
    if (!moduleAlert) return;
    moduleAlert.className = `alert alert-${type}`;
    moduleAlert.textContent = message;
    moduleAlert.classList.remove("d-none");
    window.setTimeout(() => {
      moduleAlert.classList.add("d-none");
    }, 3200);
  };

  const saveUsers = () => {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(state.users));
  };

  const saveAudit = () => {
    localStorage.setItem(STORAGE_AUDIT, JSON.stringify(state.audit));
  };

  const addAudit = (action, targetAccount, details) => {
    const entry = {
      id: uid(),
      timestamp: nowIso(),
      actor: getActor(),
      action,
      targetAccount,
      details: normalizeText(details)
    };
    state.audit.unshift(entry);
    if (state.audit.length > 300) {
      state.audit = state.audit.slice(0, 300);
    }
    saveAudit();
    renderAudit();
  };

  const generateTempPassword = () => {
    const token = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `MSS-${token}!`;
  };

  const usernameExists = (username, excludeId = "") => {
    const target = normalizeKey(username);
    return state.users.some((user) => normalizeKey(user.username) === target && user.id !== excludeId);
  };

  const getUserById = (id) => state.users.find((user) => user.id === id) || null;

  const saveAndRender = () => {
    saveUsers();
    renderUsers();
    updateMetrics();
  };

  const seedData = () => {
    const seededAt = nowIso();
    state.users = [
      {
        id: uid(),
        fullName: "Maricel Dela Cruz",
        username: "mdelacruz",
        contact: "09171234567",
        accountType: "BHW",
        role: "Staff",
        status: "Active",
        password: "Staff123!",
        createdAt: seededAt,
        createdBy: "System Seed",
        updatedAt: seededAt,
        updatedBy: "System Seed"
      },
      {
        id: uid(),
        fullName: "Rico L. Ramos",
        username: "rramos",
        contact: "09179876543",
        accountType: "Staff",
        role: "Admin",
        status: "Active",
        password: "Admin123!",
        createdAt: seededAt,
        createdBy: "System Seed",
        updatedAt: seededAt,
        updatedBy: "System Seed"
      },
      {
        id: uid(),
        fullName: "Ana Mae Santillan",
        username: "asantillan",
        contact: "09172345678",
        accountType: "BHW",
        role: "Staff",
        status: "Inactive",
        password: "Staff123!",
        createdAt: seededAt,
        createdBy: "System Seed",
        updatedAt: seededAt,
        updatedBy: "System Seed"
      }
    ];

    state.audit = [
      {
        id: uid(),
        timestamp: seededAt,
        actor: "System Seed",
        action: "Seeded Demo Accounts",
        targetAccount: "System",
        details: "Initial demo data loaded for registration module."
      }
    ];
  };

  const loadState = () => {
    try {
      const usersRaw = localStorage.getItem(STORAGE_USERS);
      const auditRaw = localStorage.getItem(STORAGE_AUDIT);
      const usersParsed = usersRaw ? JSON.parse(usersRaw) : null;
      const auditParsed = auditRaw ? JSON.parse(auditRaw) : null;

      if (Array.isArray(usersParsed) && usersParsed.length > 0) {
        state.users = usersParsed;
      }
      if (Array.isArray(auditParsed) && auditParsed.length > 0) {
        state.audit = auditParsed;
      }
    } catch (error) {
      state.users = [];
      state.audit = [];
    }

    if (state.users.length === 0) {
      seedData();
      saveUsers();
      saveAudit();
    }
  };

  const updateMetrics = () => {
    const activeCount = state.users.filter((user) => user.status === "Active").length;
    const inactiveCount = state.users.filter((user) => user.status === "Inactive").length;
    const adminCount = state.users.filter((user) => user.role === "Admin").length;
    const staffCount = state.users.filter((user) => user.role === "Staff").length;

    if (metricActiveUsers) metricActiveUsers.textContent = String(activeCount);
    if (metricInactiveUsers) metricInactiveUsers.textContent = String(inactiveCount);
    if (metricAdminUsers) metricAdminUsers.textContent = String(adminCount);
    if (metricStaffUsers) metricStaffUsers.textContent = String(staffCount);
  };

  const getFilteredUsers = () => {
    const searchTerm = normalizeKey(searchInput?.value);
    const statusValue = normalizeText(filterStatus?.value) || "all";
    const roleValue = normalizeText(filterRole?.value) || "all";
    const typeValue = normalizeText(filterType?.value) || "all";

    return state.users
      .filter((user) => {
        if (statusValue !== "all" && user.status !== statusValue) return false;
        if (roleValue !== "all" && user.role !== roleValue) return false;
        if (typeValue !== "all" && user.accountType !== typeValue) return false;

        if (searchTerm === "") return true;
        const haystack = [
          user.fullName,
          user.username,
          user.contact,
          user.role,
          user.accountType
        ].map((item) => normalizeKey(item)).join(" ");

        return haystack.includes(searchTerm);
      })
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt).getTime();
        const bTime = new Date(b.updatedAt).getTime();
        return bTime - aTime;
      });
  };

  const renderUsers = () => {
    if (!usersTableBody) return;
    const users = getFilteredUsers();

    if (users.length === 0) {
      usersTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">No accounts matched your search/filter.</td>
        </tr>
      `;
      return;
    }

    usersTableBody.innerHTML = users.map((user) => {
      const statusClass = user.status === "Active" ? "status-active" : "status-inactive";
      const roleClass = user.role === "Admin" ? "role-admin" : "role-staff";
      const toggleLabel = user.status === "Active" ? "Deactivate" : "Activate";
      const toggleClass = user.status === "Active" ? "btn-outline-danger" : "btn-outline-success";
      const escapedId = escapeHtml(user.id);

      return `
        <tr>
          <td>
            <div class="account-user">
              <b>${escapeHtml(user.fullName)}</b>
              <span>@${escapeHtml(user.username)}</span>
            </div>
          </td>
          <td>${escapeHtml(user.contact)}</td>
          <td><span class="type-chip">${escapeHtml(user.accountType)}</span></td>
          <td><span class="role-badge ${roleClass}">${escapeHtml(user.role)}</span></td>
          <td><span class="status-badge ${statusClass}">${escapeHtml(user.status)}</span></td>
          <td>
            <div>${formatDateTime(user.updatedAt)}</div>
            <small class="text-muted">${escapeHtml(user.updatedBy || "-")}</small>
          </td>
          <td class="text-end">
            <div class="row-actions">
              <button type="button" class="btn btn-outline-primary" data-action="edit" data-id="${escapedId}" title="Update profile">
                <i class="bi bi-pencil-square"></i>
              </button>
              <button type="button" class="btn ${toggleClass}" data-action="toggle-status" data-id="${escapedId}" title="${toggleLabel} account">
                ${toggleLabel}
              </button>
              <button type="button" class="btn btn-outline-warning" data-action="reset-password" data-id="${escapedId}" title="Reset password">
                Reset
              </button>
              <button type="button" class="btn btn-outline-dark" data-action="change-password" data-id="${escapedId}" title="Change password">
                Change
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  };

  const renderAudit = () => {
    if (!auditTableBody) return;
    const rows = state.audit.slice(0, 120);

    if (rows.length === 0) {
      auditTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state">No audit records yet.</td>
        </tr>
      `;
      return;
    }

    auditTableBody.innerHTML = rows.map((entry) => `
      <tr>
        <td>${formatDateTime(entry.timestamp)}</td>
        <td>${escapeHtml(entry.actor)}</td>
        <td class="audit-action">${escapeHtml(entry.action)}</td>
        <td>${escapeHtml(entry.targetAccount)}</td>
        <td>${escapeHtml(entry.details)}</td>
      </tr>
    `).join("");
  };

  const openEditModal = (userId) => {
    const user = getUserById(userId);
    if (!user || !editUserModal) return;

    editUserId.value = user.id;
    editFullName.value = user.fullName;
    editUsername.value = user.username;
    editContact.value = user.contact;
    editType.value = user.accountType;
    editRole.value = user.role;
    editUserModal.show();
  };

  const openPasswordModal = (userId) => {
    const user = getUserById(userId);
    if (!user || !changePasswordModal) return;

    passwordUserId.value = user.id;
    newPassword.value = "";
    confirmNewPassword.value = "";
    changePasswordModal.show();
  };

  const toggleUserStatus = (userId) => {
    const user = getUserById(userId);
    if (!user) return;

    const nextStatus = user.status === "Active" ? "Inactive" : "Active";
    const proceed = window.confirm(`Set account "${user.username}" to ${nextStatus}?`);
    if (!proceed) return;

    user.status = nextStatus;
    user.updatedAt = nowIso();
    user.updatedBy = getActor();

    const action = nextStatus === "Active" ? "Activate Account" : "Deactivate Account";
    addAudit(action, user.username, `${user.fullName} status changed to ${nextStatus}.`);
    saveAndRender();
    showNotice(`Account ${user.username} is now ${nextStatus}.`, "success");
  };

  const resetUserPassword = (userId) => {
    const user = getUserById(userId);
    if (!user) return;

    const proceed = window.confirm(`Reset password for "${user.username}"?`);
    if (!proceed) return;

    const temporaryPassword = generateTempPassword();
    user.password = temporaryPassword;
    user.updatedAt = nowIso();
    user.updatedBy = getActor();

    addAudit("Reset Password", user.username, `Temporary password issued by ${getActor()}.`);
    saveAndRender();
    showNotice(`Temporary password for ${user.username}: ${temporaryPassword}`, "warning");
  };

  const handleCreateAccount = (event) => {
    event.preventDefault();

    const fullName = normalizeText(document.getElementById("accountFullName")?.value);
    const username = normalizeText(document.getElementById("accountUsername")?.value);
    const contact = normalizeText(document.getElementById("accountContact")?.value);
    const accountType = normalizeText(document.getElementById("accountType")?.value) || "BHW";
    const role = normalizeText(document.getElementById("accountRole")?.value) || "Staff";
    const password = String(document.getElementById("accountPassword")?.value || "");
    const passwordConfirm = String(document.getElementById("accountPasswordConfirm")?.value || "");

    if (!fullName || !username || !contact || !password || !passwordConfirm) {
      showNotice("Please complete all account fields.", "danger");
      return;
    }

    if (password.length < 8) {
      showNotice("Password must be at least 8 characters.", "danger");
      return;
    }

    if (password !== passwordConfirm) {
      showNotice("Password and confirmation do not match.", "danger");
      return;
    }

    if (usernameExists(username)) {
      showNotice("Username already exists. Please use another username.", "danger");
      return;
    }

    const timestamp = nowIso();
    const actor = getActor();
    const user = {
      id: uid(),
      fullName,
      username,
      contact,
      accountType,
      role,
      status: "Active",
      password,
      createdAt: timestamp,
      createdBy: actor,
      updatedAt: timestamp,
      updatedBy: actor
    };

    state.users.push(user);
    addAudit(
      "Create Account",
      user.username,
      `${actor} created ${user.accountType} account (${user.role}) for ${user.fullName}.`
    );
    saveAndRender();
    createAccountForm.reset();
    showNotice(`Account created successfully for ${user.fullName}.`, "success");
  };

  const handleEditAccount = (event) => {
    event.preventDefault();
    const id = normalizeText(editUserId.value);
    const user = getUserById(id);
    if (!user) return;

    const fullName = normalizeText(editFullName.value);
    const username = normalizeText(editUsername.value);
    const contact = normalizeText(editContact.value);
    const accountType = normalizeText(editType.value) || "BHW";
    const role = normalizeText(editRole.value) || "Staff";

    if (!fullName || !username || !contact) {
      showNotice("Please complete all profile fields.", "danger");
      return;
    }

    if (usernameExists(username, user.id)) {
      showNotice("Username already exists. Please use another username.", "danger");
      return;
    }

    const previous = {
      fullName: user.fullName,
      username: user.username,
      contact: user.contact,
      accountType: user.accountType,
      role: user.role
    };

    user.fullName = fullName;
    user.username = username;
    user.contact = contact;
    user.accountType = accountType;
    user.role = role;
    user.updatedAt = nowIso();
    user.updatedBy = getActor();

    const changedFields = Object.keys(previous).filter((key) => previous[key] !== user[key]);
    const details = changedFields.length > 0
      ? `Updated fields: ${changedFields.join(", ")}`
      : "Profile opened and saved without field changes.";

    addAudit("Update Profile", user.username, details);
    saveAndRender();
    if (editUserModal) editUserModal.hide();
    showNotice(`Profile updated for ${user.fullName}.`, "success");
  };

  const handleChangePassword = (event) => {
    event.preventDefault();
    const id = normalizeText(passwordUserId.value);
    const user = getUserById(id);
    if (!user) return;

    const passwordValue = String(newPassword.value || "");
    const confirmValue = String(confirmNewPassword.value || "");

    if (!passwordValue || !confirmValue) {
      showNotice("Please fill in both password fields.", "danger");
      return;
    }

    if (passwordValue.length < 8) {
      showNotice("New password must be at least 8 characters.", "danger");
      return;
    }

    if (passwordValue !== confirmValue) {
      showNotice("Password and confirmation do not match.", "danger");
      return;
    }

    user.password = passwordValue;
    user.updatedAt = nowIso();
    user.updatedBy = getActor();

    addAudit("Change Password", user.username, `Password manually changed by ${getActor()}.`);
    saveAndRender();
    if (changePasswordModal) changePasswordModal.hide();
    showNotice(`Password changed for ${user.username}.`, "success");
  };

  const handleUserActionClick = (event) => {
    const button = event.target.closest("button[data-action][data-id]");
    if (!button) return;

    const userId = normalizeText(button.dataset.id);
    const action = normalizeText(button.dataset.action);

    if (action === "edit") {
      openEditModal(userId);
      return;
    }
    if (action === "toggle-status") {
      toggleUserStatus(userId);
      return;
    }
    if (action === "reset-password") {
      resetUserPassword(userId);
      return;
    }
    if (action === "change-password") {
      openPasswordModal(userId);
    }
  };

  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;

  const closeMobileSidebar = () => {
    if (!sidebar || !sidebarBackdrop) return;
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  };

  const toggleSidebar = () => {
    if (!sidebar || !sidebarBackdrop) return;
    if (isMobile()) {
      sidebar.classList.toggle("open");
      sidebarBackdrop.classList.toggle("show");
      document.body.classList.toggle("sidebar-open");
      return;
    }
    sidebar.classList.toggle("collapsed");
  };

  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
  });

  if (logoutLink && logoutModal) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      logoutModal.show();
    });
  }

  if (createAccountForm) createAccountForm.addEventListener("submit", handleCreateAccount);
  if (editAccountForm) editAccountForm.addEventListener("submit", handleEditAccount);
  if (changePasswordForm) changePasswordForm.addEventListener("submit", handleChangePassword);
  if (usersTableBody) usersTableBody.addEventListener("click", handleUserActionClick);

  [searchInput, filterStatus, filterRole, filterType].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", renderUsers);
    el.addEventListener("change", renderUsers);
  });

  loadState();
  renderUsers();
  renderAudit();
  updateMetrics();
})();
