function toggleSidebar(){
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isMobile = window.matchMedia('(max-width: 992px)').matches;

  if (isMobile) {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('show');
    document.body.classList.toggle('sidebar-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

window.addEventListener('resize', () => {
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!isMobile) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  }
});

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromBody || roleFromQuery || roleFromStorage || 'captain';
if (roleFromQuery) {
  try { sessionStorage.setItem('userRole', roleFromQuery); } catch (e) {}
}
document.body.dataset.role = resolvedRole;

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && (resolvedRole === 'secretary' || resolvedRole === 'admin')) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = resolvedRole === 'secretary' || resolvedRole === 'admin';
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Settings | ${dashboardLabel}`;

const settingsMenuLink = document.querySelector('.menu a[href="settings.php"]');
if (settingsMenuLink) {
  settingsMenuLink.setAttribute('href', `settings.php?role=${isAdminRole ? 'admin' : 'captain'}`);
}

if (isAdminRole) {
  document.querySelectorAll('[data-role="captain-only"]').forEach((el) => el.remove());
} else {
  document.querySelectorAll('[data-role="admin-only"]').forEach((el) => el.remove());
}

const reportsLink = document.querySelector('.menu a[href="reports.php"]');
if (reportsLink && isAdminRole) {
  reportsLink.setAttribute('href', 'admin-reports.php');
}

const currentYear = new Date().getFullYear();
const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = '2026';
}

const logoutBtn = document.querySelector('.menu a.text-danger');
const logoutModalEl = document.getElementById('logoutModal');
const hasBootstrapModal = !!(window.bootstrap && window.bootstrap.Modal);
if (logoutBtn && logoutModalEl && hasBootstrapModal) {
  const logoutModal = new window.bootstrap.Modal(logoutModalEl);
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logoutModal.show();
  });
}

const settingsLinks = document.querySelectorAll('.settings-nav a[href^="#"]');
const settingsPanels = document.querySelectorAll('.settings-panel');
const settingsContent = document.querySelector('.settings-content');
const setActivePanel = (id) => {
  settingsPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.id === id);
  });
  settingsLinks.forEach((link) => {
    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
  });
};
const scrollActivePanelIntoView = () => {
  if (!settingsContent || !window.matchMedia('(max-width: 992px)').matches) return;
  const activePanel = settingsContent.querySelector('.settings-panel.is-active');
  if (!activePanel) return;
  const y = activePanel.getBoundingClientRect().top + window.scrollY - 12;
  window.scrollTo({ top: y, behavior: 'smooth' });
};

if (settingsLinks.length && settingsPanels.length) {
  settingsLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = link.getAttribute('href')?.slice(1);
      if (!target) return;
      setActivePanel(target);
      if (history.replaceState) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${target}`);
      }
      window.requestAnimationFrame(scrollActivePanelIntoView);
    });
  });

  const initialTarget = window.location.hash?.slice(1);
  const hasTarget = initialTarget && document.getElementById(initialTarget);
  setActivePanel(hasTarget ? initialTarget : settingsPanels[0].id);
}

const panelButtons = document.querySelectorAll('[data-panel-target]');
if (panelButtons.length) {
  panelButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const target = button.getAttribute('data-panel-target');
      if (!target) return;
      setActivePanel(target);
      if (history.replaceState) {
        history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${target}`);
      }
      window.requestAnimationFrame(scrollActivePanelIntoView);
    });
  });
}

const adminAccountPanel = document.getElementById('admin-account');
const ADMIN_ACCOUNT_PASSWORD_RULE = /^.{8,}$/;
const ADMIN_CREDENTIALS_PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;
const STAFF_PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;
const STAFF_ACCOUNT_LIMIT = 5;
const USERS_API_ENDPOINT = 'users-api.php';
const SETTINGS_AUDIT_API_ENDPOINT = 'audit-trail-api.php';
const SETTINGS_AUDIT_FETCH_LIMIT = 200;
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const settingsState = {
  currentUser: null,
  adminAccount: null,
  staffAccounts: [],
  activeUsers: []
};

const settingsAuditState = {
  loading: false,
  error: '',
  items: [],
  summary: {
    total_actions: 0,
    created_count: 0,
    updated_count: 0,
    deleted_count: 0
  },
  availableYears: []
};

let isSettingsLoading = false;
let isSettingsMutating = false;

const adminAccountCreateFullName = document.getElementById('adminAccountCreateFullName');
const adminAccountCreateUsername = document.getElementById('adminAccountCreateUsername');
const adminAccountCreatePassword = document.getElementById('adminAccountCreatePassword');
const adminAccountCreatePasswordConfirm = document.getElementById('adminAccountCreatePasswordConfirm');
const adminAccountCreateBtn = document.getElementById('adminAccountCreateBtn');

const adminAccountStatusBadge = document.getElementById('adminAccountStatusBadge');
const adminAccountSummaryName = document.getElementById('adminAccountSummaryName');
const adminAccountSummaryUsername = document.getElementById('adminAccountSummaryUsername');
const adminAccountActionNotice = document.getElementById('adminAccountActionNotice');

const adminAccountResetUsername = document.getElementById('adminAccountResetUsername');
const adminAccountResetPassword = document.getElementById('adminAccountResetPassword');
const adminAccountResetPasswordConfirm = document.getElementById('adminAccountResetPasswordConfirm');
const adminAccountResetStartBtn = document.getElementById('adminAccountResetStartBtn');
const adminAccountResetBtn = document.getElementById('adminAccountResetBtn');
const adminAccountCredentialsEl = document.getElementById('adminAccountCredentials');
const adminAccountResetConfirmModalEl = document.getElementById('adminAccountResetConfirmModal');
const adminAccountResetConfirmBtn = document.getElementById('adminAccountResetConfirmBtn');
const adminAccountResetConfirmModal =
  adminAccountResetConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(adminAccountResetConfirmModalEl)
    : null;
const staffDeleteConfirmModalEl = document.getElementById('staffDeleteConfirmModal');
const staffDeleteConfirmText = document.getElementById('staffDeleteConfirmText');
const staffDeleteConfirmBtn = document.getElementById('staffDeleteConfirmBtn');
const staffDeleteConfirmModal =
  staffDeleteConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(staffDeleteConfirmModalEl)
    : null;
let pendingDeleteStaffId = '';
const staffViewModalEl = document.getElementById('staffViewModal');
const staffViewName = document.getElementById('staffViewName');
const staffViewMeta = document.getElementById('staffViewMeta');
const staffViewStatusBadge = document.getElementById('staffViewStatusBadge');
const staffViewUsername = document.getElementById('staffViewUsername');
const staffViewContact = document.getElementById('staffViewContact');
const staffViewPasswordValue = document.getElementById('staffViewPasswordValue');
const staffViewPasswordToggleBtn = document.getElementById('staffViewPasswordToggleBtn');
const staffViewToggleBtn = document.getElementById('staffViewToggleBtn');
const staffViewDeleteBtn = document.getElementById('staffViewDeleteBtn');
const staffViewModal =
  staffViewModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(staffViewModalEl)
    : null;
let activeStaffViewId = '';

const adminAccountDeactivateToggle = document.getElementById('adminAccountDeactivateToggle');

const captainCredentialsPanel = document.getElementById('change-password');
const captainCredentialsCurrentUsername = document.getElementById('captainCredentialsCurrentUsername');
const captainCredentialsCurrentPassword = document.getElementById('captainCredentialsCurrentPassword');
const captainCredentialsNewUsername = document.getElementById('captainCredentialsNewUsername');
const captainCredentialsNewPassword = document.getElementById('captainCredentialsNewPassword');
const captainCredentialsConfirmPassword = document.getElementById('captainCredentialsConfirmPassword');
const captainCredentialsSaveBtn = document.getElementById('captainCredentialsSaveBtn');
const captainCredentialsNotice = document.getElementById('captainCredentialsNotice');
const captainCredentialsFormEl = document.getElementById('captainCredentialsForm');
const captainCredentialsStartBtn = document.getElementById('captainCredentialsStartBtn');

const adminCredentialsPanel = document.getElementById('admin-credentials');
const adminCredentialsCurrentUsername = document.getElementById('adminCredentialsCurrentUsername');
const adminCredentialsCurrentPassword = document.getElementById('adminCredentialsCurrentPassword');
const adminCredentialsNewUsername = document.getElementById('adminCredentialsNewUsername');
const adminCredentialsNewPassword = document.getElementById('adminCredentialsNewPassword');
const adminCredentialsConfirmPassword = document.getElementById('adminCredentialsConfirmPassword');
const adminCredentialsSaveBtn = document.getElementById('adminCredentialsSaveBtn');
const adminCredentialsNotice = document.getElementById('adminCredentialsNotice');
const adminCredentialsFormEl = document.getElementById('adminCredentialsForm');
const adminCredentialsStartBtn = document.getElementById('adminCredentialsStartBtn');
const adminCredentialsTemporaryHint = document.getElementById('adminCredentialsTemporaryHint');

const staffCreateFullName = document.getElementById('staffCreateFullName');
const staffCreateUsername = document.getElementById('staffCreateUsername');
const staffCreatePassword = document.getElementById('staffCreatePassword');
const staffCreateContactNumber = document.getElementById('staffCreateContactNumber');
const staffCreateBtn = document.getElementById('staffCreateBtn');
const staffCreateForm = document.getElementById('staffCreateForm');
const staffAccountNotice = document.getElementById('staffAccountNotice');
const staffAccountsList = document.getElementById('staffAccountsList');
const activeUsersList = document.getElementById('activeUsersList');
const activeUsersBadge = document.getElementById('activeUsersBadge');
const settingsAuditSearchInput = document.getElementById('settingsAuditSearchInput');
const settingsAuditActionFilter = document.getElementById('settingsAuditActionFilter');
const settingsAuditUserFilter = document.getElementById('settingsAuditUserFilter');
const settingsAuditYearFilter = document.getElementById('settingsAuditYearFilter');
const settingsAuditTableBody = document.getElementById('settingsAuditTableBody');
const settingsAuditTotalActions = document.getElementById('settingsAuditTotalActions');
const settingsAuditCreatedCount = document.getElementById('settingsAuditCreatedCount');
const settingsAuditUpdatedCount = document.getElementById('settingsAuditUpdatedCount');
const settingsAuditDeletedCount = document.getElementById('settingsAuditDeletedCount');

const settingsAuditRoleLabelMap = {
  captain: 'Barangay Captain',
  admin: 'Admin',
  staff: 'Registration Staff',
  secretary: 'Secretary'
};

const settingsAuditActionBadgeMap = {
  created: { className: 'bg-info-subtle text-info', label: 'Created' },
  updated: { className: 'bg-primary-subtle text-primary', label: 'Updated' },
  deleted: { className: 'bg-danger-subtle text-danger', label: 'Deleted' },
  security: { className: 'bg-warning-subtle text-warning', label: 'Security' },
  access: { className: 'bg-success-subtle text-success', label: 'Access' }
};

const normalizeCurrentUser = (user) => {
  if (!user || typeof user !== 'object') return null;
  const id = Number(user.id || 0);
  const username = String(user.username || '').trim();
  const role = String(user.role || '').trim().toLowerCase();
  if (!id || !username || !role) return null;
  return {
    id,
    fullName: String(user.fullName || '').trim(),
    username,
    role,
    status: String(user.status || 'active').toLowerCase() === 'deactivated' ? 'deactivated' : 'active',
    requiresCredentialUpdate: user.requiresCredentialUpdate === true
  };
};

const normalizeAdminAccount = (account) => {
  if (!account || typeof account !== 'object') return null;
  const id = Number(account.id || 0);
  const fullName = String(account.fullName || '').trim();
  const username = String(account.username || '').trim();
  if (!id || !fullName || !username) return null;
  return {
    id: String(id),
    fullName,
    username,
    status: String(account.status || 'active').toLowerCase() === 'deactivated' ? 'deactivated' : 'active',
    requiresCredentialUpdate: account.requiresCredentialUpdate === true,
    createdAt: String(account.createdAt || ''),
    updatedAt: String(account.updatedAt || '')
  };
};

const normalizeStaffAccount = (account) => {
  if (!account || typeof account !== 'object') return null;
  const id = Number(account.id || 0);
  const fullName = String(account.fullName || '').trim();
  const username = String(account.username || '').trim();
  if (!id || !fullName || !username) return null;
  return {
    id: String(id),
    fullName,
    username,
    contactNumber: String(account.contactNumber || '').trim(),
    passwordVisible: String(account.passwordVisible || '').trim(),
    role: String(account.roleLabel || account.role || 'Registration Staff').trim() || 'Registration Staff',
    module: String(account.module || 'Registration Module').trim() || 'Registration Module',
    status: String(account.status || 'active').toLowerCase() === 'deactivated' ? 'deactivated' : 'active',
    createdAt: String(account.createdAt || ''),
    updatedAt: String(account.updatedAt || '')
  };
};

const normalizeActiveUser = (account) => {
  if (!account || typeof account !== 'object') return null;
  const id = Number(account.id || 0);
  const fullName = String(account.fullName || '').trim();
  const username = String(account.username || '').trim();
  const role = String(account.role || '').trim().toLowerCase();
  if (!id || !fullName || !username || !role) return null;
  return {
    id: String(id),
    fullName,
    username,
    role,
    roleLabel: String(account.roleLabel || role).trim(),
    module: String(account.module || '').trim(),
    status: String(account.status || 'active').toLowerCase() === 'deactivated' ? 'deactivated' : 'active'
  };
};

const readCurrentUser = () => settingsState.currentUser;
const readAdminAccount = () => settingsState.adminAccount;
const readStaffAccounts = () => (Array.isArray(settingsState.staffAccounts) ? settingsState.staffAccounts.slice() : []);
const readActiveUsers = () => (Array.isArray(settingsState.activeUsers) ? settingsState.activeUsers.slice() : []);

const hasValidAdminAccount = (account) => !!(account && account.id && account.username && account.fullName);

const applySettingsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    settingsState.currentUser = null;
    settingsState.adminAccount = null;
    settingsState.staffAccounts = [];
    settingsState.activeUsers = [];
    return;
  }
  settingsState.currentUser = normalizeCurrentUser(payload.current_user);
  settingsState.adminAccount = normalizeAdminAccount(payload.admin_account);
  const staffRows = Array.isArray(payload.staff_accounts) ? payload.staff_accounts : [];
  settingsState.staffAccounts = staffRows.map(normalizeStaffAccount).filter(Boolean);
  const activeRows = Array.isArray(payload.active_users) ? payload.active_users : [];
  settingsState.activeUsers = activeRows.map(normalizeActiveUser).filter(Boolean);
};

const usersApiFetch = async (method = 'GET', payload = null) => {
  const upperMethod = String(method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json'
  };
  const options = {
    method: upperMethod,
    credentials: 'same-origin',
    headers,
    cache: 'no-store'
  };

  if (upperMethod !== 'GET') {
    if (!csrfToken) {
      throw new Error('Missing CSRF token. Reload the page and try again.');
    }
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = csrfToken;
    options.body = JSON.stringify(payload || {});
  }

  let response;
  try {
    response = await fetch(USERS_API_ENDPOINT, options);
  } catch (error) {
    throw new Error('Cannot reach user management API right now.');
  }

  let json = null;
  try {
    json = await response.json();
  } catch (error) {
    json = null;
  }

  if (!response.ok || !json || json.success !== true) {
    const message = json && typeof json.error === 'string' && json.error
      ? json.error
      : `Request failed (${response.status}).`;
    throw new Error(message);
  }

  return json;
};

const refreshSettingsState = async () => {
  if (isSettingsLoading) return;
  isSettingsLoading = true;
  try {
    const response = await usersApiFetch('GET');
    applySettingsPayload(response.data);
  } finally {
    isSettingsLoading = false;
  }
};

const runSettingsAction = async (payload) => {
  if (isSettingsMutating) {
    throw new Error('Please wait for the previous action to finish.');
  }
  isSettingsMutating = true;
  try {
    const response = await usersApiFetch('POST', payload);
    applySettingsPayload(response.data);
    return response;
  } finally {
    isSettingsMutating = false;
  }
};

const setAdminAccountNotice = (message, tone = 'muted') => {
  if (!adminAccountActionNotice) return;
  adminAccountActionNotice.textContent = message;
  adminAccountActionNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    adminAccountActionNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    adminAccountActionNotice.classList.add('text-danger');
    return;
  }
  adminAccountActionNotice.classList.add('text-muted');
};

const setCaptainCredentialsNotice = (message, tone = 'muted') => {
  if (!captainCredentialsNotice) return;
  captainCredentialsNotice.textContent = message;
  captainCredentialsNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    captainCredentialsNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    captainCredentialsNotice.classList.add('text-danger');
    return;
  }
  captainCredentialsNotice.classList.add('text-muted');
};

const setAdminCredentialsNotice = (message, tone = 'muted') => {
  if (!adminCredentialsNotice) return;
  adminCredentialsNotice.textContent = message;
  adminCredentialsNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    adminCredentialsNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    adminCredentialsNotice.classList.add('text-danger');
    return;
  }
  adminCredentialsNotice.classList.add('text-muted');
};

const setStaffAccountNotice = (message, tone = 'muted') => {
  if (!staffAccountNotice) return;
  staffAccountNotice.textContent = message;
  staffAccountNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    staffAccountNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    staffAccountNotice.classList.add('text-danger');
    return;
  }
  staffAccountNotice.classList.add('text-muted');
};

const setStaffCreateDisabled = (disabled) => {
  if (staffCreateFullName) staffCreateFullName.disabled = disabled;
  if (staffCreateUsername) staffCreateUsername.disabled = disabled;
  if (staffCreatePassword) staffCreatePassword.disabled = disabled;
  if (staffCreateContactNumber) staffCreateContactNumber.disabled = disabled;
  if (staffCreateBtn) staffCreateBtn.disabled = disabled;
};

const setStaffCreateFormVisible = (visible) => {
  if (!staffCreateForm) return;
  staffCreateForm.classList.toggle('d-none', !visible);
  if (!visible) {
    if (staffCreateFullName) staffCreateFullName.value = '';
    if (staffCreateUsername) staffCreateUsername.value = '';
    if (staffCreatePassword) staffCreatePassword.value = '';
    if (staffCreateContactNumber) staffCreateContactNumber.value = '';
  }
};

const setAdminAccountStatusBadge = (status) => {
  if (!adminAccountStatusBadge) return;
  const isDeactivated = status === 'deactivated';
  adminAccountStatusBadge.textContent = isDeactivated ? 'Deactivated' : 'Active';
  adminAccountStatusBadge.classList.remove('bg-success-subtle', 'text-success', 'bg-danger-subtle', 'text-danger');
  if (isDeactivated) {
    adminAccountStatusBadge.classList.add('bg-danger-subtle', 'text-danger');
    return;
  }
  adminAccountStatusBadge.classList.add('bg-success-subtle', 'text-success');
};

const validateAdminAccountPassword = (value) => ADMIN_ACCOUNT_PASSWORD_RULE.test(String(value || ''));
const validateAdminCredentialsPassword = (value) => ADMIN_CREDENTIALS_PASSWORD_RULE.test(String(value || ''));
const validateStaffPassword = (value) => STAFF_PASSWORD_RULE.test(String(value || ''));
const normalizeText = (value) => String(value ?? '').trim();
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const maskPassword = (password) => {
  const length = Math.max(String(password || '').length, 8);
  return '*'.repeat(length);
};

const renderStaffPasswordVisibility = (password, visible = true) => {
  const plainPassword = String(password || '');
  const hasPassword = plainPassword.length > 0;

  if (staffViewPasswordValue) {
    staffViewPasswordValue.dataset.staffPassword = plainPassword;
    staffViewPasswordValue.dataset.visible = hasPassword && visible ? 'true' : 'false';
    if (!hasPassword) {
      staffViewPasswordValue.textContent = 'Not available';
    } else {
      staffViewPasswordValue.textContent = visible ? plainPassword : maskPassword(plainPassword);
    }
  }

  if (!staffViewPasswordToggleBtn) return;

  staffViewPasswordToggleBtn.disabled = !hasPassword;
  const toggleLabel = staffViewPasswordToggleBtn.querySelector('[data-toggle-label]');
  const icon = staffViewPasswordToggleBtn.querySelector('i');

  if (!hasPassword) {
    if (toggleLabel) toggleLabel.textContent = 'Unavailable';
    if (icon) {
      icon.classList.remove('bi-eye', 'bi-eye-slash');
      icon.classList.add('bi-lock');
    }
    return;
  }

  if (toggleLabel) toggleLabel.textContent = visible ? 'Hide' : 'Show';
  if (icon) {
    icon.classList.remove('bi-lock', 'bi-eye', 'bi-eye-slash');
    icon.classList.add(visible ? 'bi-eye-slash' : 'bi-eye');
  }
};

const renderStaffViewModalAccount = (account) => {
  if (!account) return;
  const isDeactivated = account.status === 'deactivated';

  if (staffViewName) staffViewName.textContent = account.fullName || 'Staff Account';
  if (staffViewMeta) staffViewMeta.textContent = `${account.role || 'Registration Staff'} | ${account.module || 'Registration Module'}`;
  if (staffViewUsername) staffViewUsername.textContent = account.username || '-';
  if (staffViewContact) staffViewContact.textContent = account.contactNumber || 'Not provided';

  renderStaffPasswordVisibility(account.passwordVisible || '', true);

  if (staffViewStatusBadge) {
    staffViewStatusBadge.textContent = isDeactivated ? 'Deactivated' : 'Active';
    staffViewStatusBadge.classList.remove('bg-success-subtle', 'text-success', 'bg-danger-subtle', 'text-danger');
    staffViewStatusBadge.classList.add(
      isDeactivated ? 'bg-danger-subtle' : 'bg-success-subtle',
      isDeactivated ? 'text-danger' : 'text-success'
    );
  }

  if (staffViewToggleBtn) {
    staffViewToggleBtn.classList.remove('btn-outline-success', 'btn-outline-warning');
    staffViewToggleBtn.classList.add(isDeactivated ? 'btn-outline-success' : 'btn-outline-warning');
    staffViewToggleBtn.innerHTML = isDeactivated
      ? '<i class="bi bi-check-circle"></i> Activate'
      : '<i class="bi bi-pause-circle"></i> Deactivate';
  }
};

const rerenderSettingsPanels = () => {
  renderCaptainCredentialsState();
  renderAdminAccountState();
  renderAdminCredentialsState();
  renderStaffAccounts();
  renderActiveUsers();
  syncStaffViewModal();
};

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
};

const toggleStaffAccountStatusById = async (staffId) => {
  const selected = readStaffAccounts().find((account) => account.id === staffId);
  if (!selected) return;
  const nextStatus = selected.status === 'deactivated' ? 'active' : 'deactivated';

  try {
    const response = await runSettingsAction({
      action: 'set_staff_status',
      staff_id: toPositiveInteger(staffId),
      status: nextStatus
    });
    rerenderSettingsPanels();
    const fallbackMessage = nextStatus === 'deactivated'
      ? `Staff account "${selected.fullName}" has been deactivated.`
      : `Staff account "${selected.fullName}" has been activated.`;
    setStaffAccountNotice(response.message || fallbackMessage, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update staff status right now.';
    setStaffAccountNotice(message, 'danger');
    syncStaffViewModal();
  }
};

const deleteStaffAccountById = async (staffId) => {
  const selected = readStaffAccounts().find((account) => account.id === staffId);
  if (!selected) {
    pendingDeleteStaffId = '';
    staffDeleteConfirmModal?.hide();
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'delete_staff',
      staff_id: toPositiveInteger(staffId)
    });
    if (activeStaffViewId === staffId) {
      activeStaffViewId = '';
      staffViewModal?.hide();
    }
    rerenderSettingsPanels();
    setStaffAccountNotice(response.message || `Staff account "${selected.fullName}" has been deleted.`, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete staff account right now.';
    setStaffAccountNotice(message, 'danger');
  } finally {
    pendingDeleteStaffId = '';
    staffDeleteConfirmModal?.hide();
  }
};

const syncStaffViewModal = () => {
  if (!activeStaffViewId) return;
  const account = readStaffAccounts().find((item) => item.id === activeStaffViewId);
  if (!account) {
    activeStaffViewId = '';
    staffViewModal?.hide();
    return;
  }
  renderStaffViewModalAccount(account);
};

const requestStaffDeleteById = (staffId) => {
  const accounts = readStaffAccounts();
  const selected = accounts.find((account) => account.id === staffId);
  if (!selected) return;

  pendingDeleteStaffId = staffId;
  if (staffDeleteConfirmText) {
    staffDeleteConfirmText.textContent = `Delete staff account for ${selected.fullName}? This cannot be undone.`;
  }
  if (staffDeleteConfirmModal) {
    staffDeleteConfirmModal.show();
    return;
  }

  const confirmDelete = window.confirm(`Delete staff account for ${selected.fullName}? This cannot be undone.`);
  if (!confirmDelete) {
    pendingDeleteStaffId = '';
    return;
  }
  void deleteStaffAccountById(staffId);
};

const renderStaffAccounts = () => {
  if (!staffAccountsList) return;
  const accounts = readStaffAccounts();
  const reachedLimit = accounts.length >= STAFF_ACCOUNT_LIMIT;
  setStaffCreateDisabled(reachedLimit);
  setStaffCreateFormVisible(!reachedLimit);

  if (!accounts.length) {
    staffAccountsList.innerHTML = `
      <div class="settings-list-item">
        <div class="item-info">
          <div class="fw-semibold">No staff account yet</div>
          <div class="small">Create a staff account to manage access.</div>
        </div>
      </div>
    `;
    setStaffAccountNotice('No staff account created yet.', 'muted');
    return;
  }

  staffAccountsList.innerHTML = accounts.map((account) => {
    const isDeactivated = account.status === 'deactivated';
    const badgeClass = isDeactivated ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success';
    const badgeText = isDeactivated ? 'Deactivated' : 'Active';
    const accountId = escapeHtml(account.id);
    const fullName = escapeHtml(account.fullName);
    const role = escapeHtml(account.role);
    const moduleName = escapeHtml(account.module);
    const username = escapeHtml(account.username);
    return `
      <div class="settings-list-item staff-account-card">
        <div class="staff-account-main">
          <div class="staff-account-head">
            <div class="item-info">
              <div class="staff-account-name">${fullName}</div>
              <div class="staff-account-meta">${role} | ${moduleName}</div>
              <div class="small">Username: ${username}</div>
            </div>
          </div>
        </div>
        <div class="staff-account-actions">
          <span class="badge ${badgeClass} staff-account-status">${badgeText}</span>
          <button type="button" class="btn btn-sm btn-outline-primary staff-action-btn" data-staff-action="view" data-staff-id="${accountId}">
            <i class="bi bi-eye"></i>View
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (reachedLimit) {
    setStaffAccountNotice(`Staff account limit reached (${STAFF_ACCOUNT_LIMIT}). Delete an existing account before creating a new one.`, 'danger');
    return;
  }
  setStaffAccountNotice('Manage your staff accounts here.', 'muted');
};

const renderActiveUsers = () => {
  if (!activeUsersList) return;
  const users = readActiveUsers().filter((row) => row.status === 'active');
  if (activeUsersBadge) {
    activeUsersBadge.textContent = `${users.length} Active`;
  }

  if (!users.length) {
    activeUsersList.innerHTML = `
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

  activeUsersList.innerHTML = users.map((account) => {
    const fullName = escapeHtml(account.fullName);
    const role = escapeHtml(account.roleLabel || account.role);
    const moduleName = escapeHtml(account.module || 'General Module');
    const username = escapeHtml(account.username);
    return `
      <div class="settings-list-item">
        <div class="item-info">
          <div class="fw-semibold">${fullName}</div>
          <div class="small">Role: ${role}</div>
          <div class="small">Module: ${moduleName}</div>
          <div class="small text-muted">Username: ${username}</div>
        </div>
        <span class="badge bg-success-subtle text-success">Online</span>
      </div>
    `;
  }).join('');
};

const formatSettingsAuditDateTime = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return '-';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const setSettingsAuditSummary = (summary) => {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  if (settingsAuditTotalActions) {
    settingsAuditTotalActions.textContent = String(Number(safeSummary.total_actions || 0));
  }
  if (settingsAuditCreatedCount) {
    settingsAuditCreatedCount.textContent = String(Number(safeSummary.created_count || 0));
  }
  if (settingsAuditUpdatedCount) {
    settingsAuditUpdatedCount.textContent = String(Number(safeSummary.updated_count || 0));
  }
  if (settingsAuditDeletedCount) {
    settingsAuditDeletedCount.textContent = String(Number(safeSummary.deleted_count || 0));
  }
};

const ensureSettingsAuditYearOptions = (years = []) => {
  if (!settingsAuditYearFilter) return;
  const currentValue = normalizeText(settingsAuditYearFilter.value);
  const currentYear = new Date().getFullYear();
  const fallbackYears = [currentYear - 1, currentYear];
  const merged = [...new Set([...years, ...fallbackYears])]
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a);

  settingsAuditYearFilter.innerHTML = '<option value="all">All Years</option>';
  merged.forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    settingsAuditYearFilter.appendChild(option);
  });

  if (currentValue && [...settingsAuditYearFilter.options].some((option) => option.value === currentValue)) {
    settingsAuditYearFilter.value = currentValue;
    return;
  }
  settingsAuditYearFilter.value = 'all';
};

const renderSettingsAuditLoadingState = () => {
  if (!settingsAuditTableBody) return;
  settingsAuditTableBody.innerHTML = `
    <tr id="settingsAuditLoadingRow">
      <td colspan="6" class="text-center text-muted">Loading activity logs...</td>
    </tr>
    <tr id="settingsAuditEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const renderSettingsAuditErrorState = (message) => {
  if (!settingsAuditTableBody) return;
  const safeMessage = escapeHtml(message || 'Unable to load activity logs.');
  settingsAuditTableBody.innerHTML = `
    <tr id="settingsAuditErrorRow">
      <td colspan="6" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="settingsAuditEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const buildSettingsAuditActionBadge = (actionType, actionKey) => {
  const type = normalizeText(actionType).toLowerCase();
  const config = settingsAuditActionBadgeMap[type] || null;
  if (config) {
    return `<span class="badge ${config.className}">${escapeHtml(config.label)}</span>`;
  }
  const fallbackLabel = normalizeText(actionKey)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Action';
  return `<span class="badge bg-secondary-subtle text-secondary">${escapeHtml(fallbackLabel)}</span>`;
};

const renderSettingsAuditTable = () => {
  if (!settingsAuditTableBody) return;

  if (settingsAuditState.loading) {
    renderSettingsAuditLoadingState();
    return;
  }

  if (settingsAuditState.error) {
    renderSettingsAuditErrorState(settingsAuditState.error);
    return;
  }

  const rowsHtml = settingsAuditState.items.map((item) => {
    const createdAt = formatSettingsAuditDateTime(item.created_at);
    const actor = item && typeof item.actor === 'object' ? item.actor : {};
    const role = normalizeText(actor.role).toLowerCase();
    const roleLabel = settingsAuditRoleLabelMap[role] || normalizeText(actor.role_label) || '-';
    const username = normalizeText(actor.username);
    const userLabel = username ? `${roleLabel} (${username})` : roleLabel;
    const actionBadge = buildSettingsAuditActionBadge(item.action_type, item.action_key);
    const recordId = normalizeText(item.record_id) || '-';
    const moduleName = normalizeText(item.module_name) || '-';
    const details = normalizeText(item.details) || '-';

    return `
      <tr>
        <td>${escapeHtml(createdAt)}</td>
        <td>${escapeHtml(userLabel)}</td>
        <td>${actionBadge}</td>
        <td>${escapeHtml(recordId)}</td>
        <td>${escapeHtml(moduleName)}</td>
        <td>${escapeHtml(details)}</td>
      </tr>
    `;
  }).join('');

  settingsAuditTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="settingsAuditEmptyRow" class="${settingsAuditState.items.length === 0 ? '' : 'd-none'}">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const fetchSettingsAuditLogs = async () => {
  const params = new URLSearchParams({
    limit: String(SETTINGS_AUDIT_FETCH_LIMIT),
    offset: '0'
  });

  const searchValue = normalizeText(settingsAuditSearchInput?.value);
  if (searchValue) params.set('q', searchValue);

  const actionType = normalizeText(settingsAuditActionFilter?.value).toLowerCase();
  if (actionType && actionType !== 'all') params.set('action_type', actionType);

  const userRole = normalizeText(settingsAuditUserFilter?.value).toLowerCase();
  if (userRole && userRole !== 'all') params.set('user_role', userRole);

  const yearValue = normalizeText(settingsAuditYearFilter?.value);
  if (yearValue && yearValue !== 'all') params.set('year', yearValue);

  let response;
  try {
    response = await fetch(`${SETTINGS_AUDIT_API_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
  } catch (error) {
    throw new Error('Cannot reach audit trail API right now.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true || !payload.data || typeof payload.data !== 'object') {
    const message = payload && typeof payload.error === 'string' && payload.error
      ? payload.error
      : `Unable to load audit logs (${response.status}).`;
    throw new Error(message);
  }

  return payload.data;
};

const loadSettingsAuditLogs = async () => {
  if (!settingsAuditTableBody) return;
  settingsAuditState.loading = true;
  settingsAuditState.error = '';
  renderSettingsAuditTable();

  try {
    const data = await fetchSettingsAuditLogs();
    settingsAuditState.items = Array.isArray(data.items) ? data.items : [];
    settingsAuditState.summary = data.summary && typeof data.summary === 'object'
      ? data.summary
      : {
          total_actions: 0,
          created_count: 0,
          updated_count: 0,
          deleted_count: 0
        };
    settingsAuditState.availableYears = Array.isArray(data?.filters?.years)
      ? data.filters.years.map((year) => Number(year)).filter((year) => Number.isInteger(year) && year > 0)
      : [];
    ensureSettingsAuditYearOptions(settingsAuditState.availableYears);
  } catch (error) {
    settingsAuditState.items = [];
    settingsAuditState.summary = {
      total_actions: 0,
      created_count: 0,
      updated_count: 0,
      deleted_count: 0
    };
    settingsAuditState.error = error instanceof Error ? error.message : 'Unable to load audit logs.';
  } finally {
    settingsAuditState.loading = false;
    setSettingsAuditSummary(settingsAuditState.summary);
    renderSettingsAuditTable();
  }
};

let settingsAuditSearchDebounceId = 0;
const triggerSettingsAuditLoadWithDebounce = () => {
  if (settingsAuditSearchDebounceId) {
    window.clearTimeout(settingsAuditSearchDebounceId);
  }
  settingsAuditSearchDebounceId = window.setTimeout(() => {
    void loadSettingsAuditLogs();
  }, 250);
};

const initializeSettingsAuditTrail = () => {
  if (!settingsAuditTableBody) return;
  ensureSettingsAuditYearOptions([]);
  setSettingsAuditSummary(settingsAuditState.summary);
  renderSettingsAuditLoadingState();
  void loadSettingsAuditLogs();
};

const openCaptainCredentialsForm = () => {
  if (!captainCredentialsFormEl) return;
  captainCredentialsStartBtn?.classList.add('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(captainCredentialsFormEl, { toggle: false }).show();
    return;
  }
  captainCredentialsFormEl.classList.add('show');
};

const hideCaptainCredentialsForm = () => {
  if (!captainCredentialsFormEl) return;
  captainCredentialsStartBtn?.classList.remove('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(captainCredentialsFormEl, { toggle: false }).hide();
    return;
  }
  captainCredentialsFormEl.classList.remove('show');
};

const clearCaptainCredentialsFields = () => {
  if (captainCredentialsCurrentUsername) captainCredentialsCurrentUsername.value = '';
  if (captainCredentialsCurrentPassword) captainCredentialsCurrentPassword.value = '';
  if (captainCredentialsNewUsername) captainCredentialsNewUsername.value = '';
  if (captainCredentialsNewPassword) captainCredentialsNewPassword.value = '';
  if (captainCredentialsConfirmPassword) captainCredentialsConfirmPassword.value = '';
};

const renderCaptainCredentialsState = () => {
  if (!captainCredentialsPanel) return;
  const currentUser = readCurrentUser();
  const hasAccount = !!(currentUser && currentUser.id && currentUser.username);
  const isDeactivated = !!(hasAccount && currentUser.status === 'deactivated');
  const requiresUpdate = !!(hasAccount && currentUser.requiresCredentialUpdate === true);

  if (captainCredentialsSaveBtn) {
    captainCredentialsSaveBtn.disabled = !hasAccount || isDeactivated;
  }
  if (captainCredentialsStartBtn) {
    captainCredentialsStartBtn.disabled = !hasAccount || isDeactivated;
  }

  if (!hasAccount) {
    openCaptainCredentialsForm();
    captainCredentialsStartBtn?.classList.add('d-none');
    clearCaptainCredentialsFields();
    setCaptainCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }

  if (isDeactivated) {
    openCaptainCredentialsForm();
    captainCredentialsStartBtn?.classList.add('d-none');
    clearCaptainCredentialsFields();
    setCaptainCredentialsNotice('Your account is deactivated.', 'danger');
    return;
  }

  if (requiresUpdate) {
    openCaptainCredentialsForm();
    captainCredentialsStartBtn?.classList.add('d-none');
    clearCaptainCredentialsFields();
    if (captainCredentialsCurrentUsername) {
      captainCredentialsCurrentUsername.value = currentUser.username || '';
    }
    setCaptainCredentialsNotice('Enter your current credentials, then set your new username and password.', 'muted');
    return;
  }

  hideCaptainCredentialsForm();
  setCaptainCredentialsNotice('Credentials updated. Click Change Credentials to update again.', 'muted');
};

const openAdminAccountResetForm = () => {
  if (!adminAccountCredentialsEl) return;
  adminAccountResetStartBtn?.classList.add('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(adminAccountCredentialsEl, { toggle: false }).show();
    return;
  }
  adminAccountCredentialsEl.classList.add('show');
};

const hideAdminAccountResetForm = () => {
  if (!adminAccountCredentialsEl) return;
  adminAccountResetStartBtn?.classList.remove('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(adminAccountCredentialsEl, { toggle: false }).hide();
    return;
  }
  adminAccountCredentialsEl.classList.remove('show');
};

const openAdminCredentialsForm = () => {
  if (!adminCredentialsFormEl) return;
  adminCredentialsStartBtn?.classList.add('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(adminCredentialsFormEl, { toggle: false }).show();
    return;
  }
  adminCredentialsFormEl.classList.add('show');
};

const hideAdminCredentialsForm = () => {
  if (!adminCredentialsFormEl) return;
  adminCredentialsStartBtn?.classList.remove('d-none');
  if (window.bootstrap && window.bootstrap.Collapse) {
    window.bootstrap.Collapse.getOrCreateInstance(adminCredentialsFormEl, { toggle: false }).hide();
    return;
  }
  adminCredentialsFormEl.classList.remove('show');
};

const clearAdminCredentialsFields = () => {
  if (adminCredentialsCurrentUsername) adminCredentialsCurrentUsername.value = '';
  if (adminCredentialsCurrentPassword) adminCredentialsCurrentPassword.value = '';
  if (adminCredentialsNewUsername) adminCredentialsNewUsername.value = '';
  if (adminCredentialsNewPassword) adminCredentialsNewPassword.value = '';
  if (adminCredentialsConfirmPassword) adminCredentialsConfirmPassword.value = '';
};

const attemptAdminAccountCredentialReset = async () => {
  const account = readAdminAccount();
  if (!account) {
    setAdminAccountNotice('Create admin account first before resetting credentials.', 'danger');
    return;
  }

  const username = String(adminAccountResetUsername?.value || '').trim();
  const password = String(adminAccountResetPassword?.value || '');
  const confirmPassword = String(adminAccountResetPasswordConfirm?.value || '');

  if (!username || !password || !confirmPassword) {
    setAdminAccountNotice('Enter new username and password for reset.', 'danger');
    return;
  }
  if (!validateAdminAccountPassword(password)) {
    setAdminAccountNotice('New password must be at least 8 characters.', 'danger');
    return;
  }
  if (password !== confirmPassword) {
    setAdminAccountNotice('New password and confirmation do not match.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'reset_admin_credentials',
      username,
      password
    });
    if (adminAccountResetPassword) adminAccountResetPassword.value = '';
    if (adminAccountResetPasswordConfirm) adminAccountResetPasswordConfirm.value = '';
    hideAdminAccountResetForm();
    rerenderSettingsPanels();
    setAdminAccountNotice(response.message || 'Admin credentials reset successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset admin credentials right now.';
    setAdminAccountNotice(message, 'danger');
  }
};

const renderAdminCredentialsState = () => {
  if (!adminCredentialsPanel) return;
  const currentUser = readCurrentUser();
  const hasAccount = !!(currentUser && currentUser.id && currentUser.username);
  const isDeactivated = !!(hasAccount && currentUser.status === 'deactivated');
  const requiresUpdate = !!(hasAccount && currentUser.requiresCredentialUpdate === true);
  if (adminCredentialsTemporaryHint) {
    adminCredentialsTemporaryHint.classList.toggle('d-none', !requiresUpdate);
  }

  if (adminCredentialsSaveBtn) {
    adminCredentialsSaveBtn.disabled = !hasAccount || isDeactivated;
  }
  if (adminCredentialsStartBtn) {
    adminCredentialsStartBtn.disabled = !hasAccount || isDeactivated;
  }

  if (!hasAccount) {
    openAdminCredentialsForm();
    adminCredentialsStartBtn?.classList.add('d-none');
    clearAdminCredentialsFields();
    setAdminCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }

  if (isDeactivated) {
    openAdminCredentialsForm();
    adminCredentialsStartBtn?.classList.add('d-none');
    clearAdminCredentialsFields();
    setAdminCredentialsNotice('Your account is deactivated. Ask the captain to reactivate it first.', 'danger');
    return;
  }

  if (requiresUpdate) {
    openAdminCredentialsForm();
    adminCredentialsStartBtn?.classList.add('d-none');
    clearAdminCredentialsFields();
    setAdminCredentialsNotice('Enter your temporary credentials, then set your own username and password.', 'muted');
    return;
  }

  hideAdminCredentialsForm();
  setAdminCredentialsNotice('Credentials updated. Click Change Credentials to update again.', 'muted');
};

const renderAdminAccountState = () => {
  if (!adminAccountPanel) return;
  const account = readAdminAccount();
  const hasAccount = hasValidAdminAccount(account);
  adminAccountPanel.classList.toggle('is-created', hasAccount);

  if (!hasAccount) {
    if (adminAccountSummaryName) adminAccountSummaryName.textContent = 'Admin Account';
    if (adminAccountSummaryUsername) adminAccountSummaryUsername.textContent = '-';
    if (adminAccountDeactivateToggle) {
      adminAccountDeactivateToggle.checked = false;
      adminAccountDeactivateToggle.disabled = true;
    }
    setAdminAccountStatusBadge('active');
    setAdminAccountNotice('No admin account created yet.', 'muted');
    return;
  }

  if (adminAccountSummaryName) adminAccountSummaryName.textContent = account.fullName;
  if (adminAccountSummaryUsername) adminAccountSummaryUsername.textContent = account.username;
  if (adminAccountResetUsername) adminAccountResetUsername.value = account.username;

  if (adminAccountDeactivateToggle) {
    adminAccountDeactivateToggle.disabled = false;
    adminAccountDeactivateToggle.checked = account.status === 'deactivated';
  }

  setAdminAccountStatusBadge(account.status);
  if (account.status === 'deactivated') {
    setAdminAccountNotice('Admin account is deactivated.', 'danger');
    return;
  }
  setAdminAccountNotice('Admin account is active.', 'success');
};

adminAccountCreateBtn?.addEventListener('click', async (event) => {
  event.preventDefault();

  const fullName = String(adminAccountCreateFullName?.value || '').trim();
  const username = String(adminAccountCreateUsername?.value || '').trim();
  const password = String(adminAccountCreatePassword?.value || '');
  const confirmPassword = String(adminAccountCreatePasswordConfirm?.value || '');

  if (!fullName || !username || !password || !confirmPassword) {
    setAdminAccountNotice('Complete all admin account fields before creating.', 'danger');
    return;
  }
  if (!validateAdminAccountPassword(password)) {
    setAdminAccountNotice('Temporary password must be at least 8 characters.', 'danger');
    return;
  }
  if (password !== confirmPassword) {
    setAdminAccountNotice('Temporary password and confirmation do not match.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'create_admin_account',
      full_name: fullName,
      username,
      password
    });
    if (adminAccountCreateFullName) adminAccountCreateFullName.value = '';
    if (adminAccountCreateUsername) adminAccountCreateUsername.value = '';
    if (adminAccountCreatePassword) adminAccountCreatePassword.value = '';
    if (adminAccountCreatePasswordConfirm) adminAccountCreatePasswordConfirm.value = '';
    rerenderSettingsPanels();
    setAdminAccountNotice(response.message || 'Admin account created successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create admin account right now.';
    setAdminAccountNotice(message, 'danger');
  }
});

adminAccountResetBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  await attemptAdminAccountCredentialReset();
});

adminAccountResetStartBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  hideAdminAccountResetForm();

  const account = readAdminAccount();
  if (!account) {
    setAdminAccountNotice('Create admin account first before resetting credentials.', 'danger');
    return;
  }

  if (adminAccountResetUsername) {
    adminAccountResetUsername.value = account.username || '';
  }

  if (adminAccountResetConfirmModal) {
    adminAccountResetConfirmModal.show();
    return;
  }

  const proceed = window.confirm('Confirm to reset credentials? It cannot be undone.');
  if (!proceed) {
    setAdminAccountNotice('Credential reset was cancelled.', 'muted');
    return;
  }

  openAdminAccountResetForm();
  setAdminAccountNotice('Enter new username and password, then save new credentials.', 'muted');
});

adminAccountResetConfirmBtn?.addEventListener('click', () => {
  adminAccountResetConfirmModal?.hide();
  openAdminAccountResetForm();
  setAdminAccountNotice('Enter new username and password, then save new credentials.', 'muted');
});

adminAccountDeactivateToggle?.addEventListener('change', async () => {
  const account = readAdminAccount();
  if (!account) {
    adminAccountDeactivateToggle.checked = false;
    adminAccountDeactivateToggle.disabled = true;
    setAdminAccountNotice('Create admin account first before changing access.', 'danger');
    return;
  }

  const previousChecked = account.status === 'deactivated';
  const status = adminAccountDeactivateToggle.checked ? 'deactivated' : 'active';
  try {
    const response = await runSettingsAction({
      action: 'set_admin_status',
      status
    });
    rerenderSettingsPanels();
    setAdminAccountNotice(response.message || (status === 'active' ? 'Admin account activated.' : 'Admin account deactivated.'), 'success');
  } catch (error) {
    adminAccountDeactivateToggle.checked = previousChecked;
    const message = error instanceof Error ? error.message : 'Unable to update admin status right now.';
    setAdminAccountNotice(message, 'danger');
  }
});

captainCredentialsSaveBtn?.addEventListener('click', async (event) => {
  event.preventDefault();

  const currentUser = readCurrentUser();
  if (!currentUser) {
    setCaptainCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }
  if (currentUser.status === 'deactivated') {
    setCaptainCredentialsNotice('Your account is deactivated.', 'danger');
    return;
  }

  const currentUsername = String(captainCredentialsCurrentUsername?.value || '').trim();
  const currentPassword = String(captainCredentialsCurrentPassword?.value || '');
  const newUsername = String(captainCredentialsNewUsername?.value || '').trim();
  const newPassword = String(captainCredentialsNewPassword?.value || '');
  const confirmPassword = String(captainCredentialsConfirmPassword?.value || '');

  if (!currentUsername || !currentPassword || !newUsername || !newPassword || !confirmPassword) {
    setCaptainCredentialsNotice('Complete all fields before saving your credentials.', 'danger');
    return;
  }
  if (!validateAdminCredentialsPassword(newPassword)) {
    setCaptainCredentialsNotice('New password must be at least 8 characters and include 1 special character.', 'danger');
    return;
  }
  if (newPassword !== confirmPassword) {
    setCaptainCredentialsNotice('New password and confirmation do not match.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'update_own_credentials',
      current_username: currentUsername,
      current_password: currentPassword,
      new_username: newUsername,
      new_password: newPassword
    });
    const nextUser = readCurrentUser();
    if (nextUser) {
      nextUser.requiresCredentialUpdate = false;
    }
    clearCaptainCredentialsFields();
    rerenderSettingsPanels();
    captainCredentialsStartBtn?.classList.remove('d-none');
    setCaptainCredentialsNotice(response.message || 'Credentials updated successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update credentials right now.';
    setCaptainCredentialsNotice(message, 'danger');
  }
});

captainCredentialsStartBtn?.addEventListener('click', (event) => {
  event.preventDefault();

  const currentUser = readCurrentUser();
  if (!currentUser) {
    setCaptainCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }
  if (currentUser.status === 'deactivated') {
    setCaptainCredentialsNotice('Your account is deactivated.', 'danger');
    return;
  }

  clearCaptainCredentialsFields();
  if (captainCredentialsCurrentUsername) {
    captainCredentialsCurrentUsername.value = currentUser.username || '';
  }
  openCaptainCredentialsForm();
  setCaptainCredentialsNotice('Enter your current username and password, then set your new credentials.', 'muted');
});

adminCredentialsSaveBtn?.addEventListener('click', async (event) => {
  event.preventDefault();

  const currentUser = readCurrentUser();
  if (!currentUser) {
    setAdminCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }
  if (currentUser.status === 'deactivated') {
    setAdminCredentialsNotice('Your account is deactivated. Ask the captain to reactivate it first.', 'danger');
    return;
  }

  const currentUsername = String(adminCredentialsCurrentUsername?.value || '').trim();
  const currentPassword = String(adminCredentialsCurrentPassword?.value || '');
  const newUsername = String(adminCredentialsNewUsername?.value || '').trim();
  const newPassword = String(adminCredentialsNewPassword?.value || '');
  const confirmPassword = String(adminCredentialsConfirmPassword?.value || '');

  if (!currentUsername || !currentPassword || !newUsername || !newPassword || !confirmPassword) {
    setAdminCredentialsNotice('Complete all fields before saving your credentials.', 'danger');
    return;
  }
  if (!validateAdminCredentialsPassword(newPassword)) {
    setAdminCredentialsNotice('New password must be at least 8 characters and include 1 special character.', 'danger');
    return;
  }
  if (newPassword !== confirmPassword) {
    setAdminCredentialsNotice('New password and confirmation do not match.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'update_own_credentials',
      current_username: currentUsername,
      current_password: currentPassword,
      new_username: newUsername,
      new_password: newPassword
    });
    const nextUser = readCurrentUser();
    if (nextUser) {
      nextUser.requiresCredentialUpdate = false;
    }
    clearAdminCredentialsFields();
    rerenderSettingsPanels();
    adminCredentialsStartBtn?.classList.remove('d-none');
    setAdminCredentialsNotice(response.message || 'Credentials updated successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update credentials right now.';
    setAdminCredentialsNotice(message, 'danger');
  }
});

adminCredentialsStartBtn?.addEventListener('click', (event) => {
  event.preventDefault();

  const currentUser = readCurrentUser();
  if (!currentUser) {
    setAdminCredentialsNotice('Unable to load your account details. Try reloading the page.', 'danger');
    return;
  }
  if (currentUser.status === 'deactivated') {
    setAdminCredentialsNotice('Your account is deactivated. Ask the captain to reactivate it first.', 'danger');
    return;
  }

  clearAdminCredentialsFields();

  openAdminCredentialsForm();
  setAdminCredentialsNotice('Enter your current username and password, then set your new credentials.', 'muted');
});

staffCreateBtn?.addEventListener('click', async (event) => {
  event.preventDefault();

  const accounts = readStaffAccounts();
  if (accounts.length >= STAFF_ACCOUNT_LIMIT) {
    setStaffAccountNotice(`Cannot create more than ${STAFF_ACCOUNT_LIMIT} staff accounts.`, 'danger');
    return;
  }

  const fullName = String(staffCreateFullName?.value || '').trim();
  const username = String(staffCreateUsername?.value || '').trim();
  const password = String(staffCreatePassword?.value || '');
  const contactNumber = String(staffCreateContactNumber?.value || '').trim();

  if (!fullName || !username || !password || !contactNumber) {
    setStaffAccountNotice('Complete all staff account fields before creating.', 'danger');
    return;
  }
  if (!validateStaffPassword(password)) {
    setStaffAccountNotice('Password must be at least 8 characters and include 1 special character.', 'danger');
    return;
  }

  const usernameExists = accounts.some((account) => account.username.toLowerCase() === username.toLowerCase());
  if (usernameExists) {
    setStaffAccountNotice('Username already exists. Use a different username.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'create_staff',
      full_name: fullName,
      username,
      password,
      contact_number: contactNumber
    });
    if (staffCreateFullName) staffCreateFullName.value = '';
    if (staffCreateUsername) staffCreateUsername.value = '';
    if (staffCreatePassword) staffCreatePassword.value = '';
    if (staffCreateContactNumber) staffCreateContactNumber.value = '';
    rerenderSettingsPanels();
    setStaffAccountNotice(response.message || 'Staff account created successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create staff account right now.';
    setStaffAccountNotice(message, 'danger');
  }
});

staffAccountsList?.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const actionBtn = target.closest('[data-staff-action]');
  if (!actionBtn) return;

  const action = actionBtn.getAttribute('data-staff-action');
  const staffId = actionBtn.getAttribute('data-staff-id');
  if (!action || !staffId) return;

  if (action === 'view') {
    activeStaffViewId = staffId;
    syncStaffViewModal();
    if (activeStaffViewId) {
      staffViewModal?.show();
    }
    return;
  }

  if (action === 'toggle') {
    void toggleStaffAccountStatusById(staffId);
    return;
  }

  if (action === 'delete') {
    requestStaffDeleteById(staffId);
  }
});

staffViewPasswordToggleBtn?.addEventListener('click', () => {
  const plainPassword = String(staffViewPasswordValue?.dataset.staffPassword || '');
  if (!plainPassword) return;
  const isVisible = String(staffViewPasswordValue?.dataset.visible || 'false') === 'true';
  renderStaffPasswordVisibility(plainPassword, !isVisible);
});

staffViewToggleBtn?.addEventListener('click', async () => {
  if (!activeStaffViewId) return;
  await toggleStaffAccountStatusById(activeStaffViewId);
});

staffViewDeleteBtn?.addEventListener('click', () => {
  if (!activeStaffViewId) return;
  requestStaffDeleteById(activeStaffViewId);
});

staffDeleteConfirmBtn?.addEventListener('click', async () => {
  if (!pendingDeleteStaffId) {
    staffDeleteConfirmModal?.hide();
    return;
  }
  await deleteStaffAccountById(pendingDeleteStaffId);
});

staffDeleteConfirmModalEl?.addEventListener('hidden.bs.modal', () => {
  pendingDeleteStaffId = '';
});

staffViewModalEl?.addEventListener('hidden.bs.modal', () => {
  activeStaffViewId = '';
});

settingsAuditSearchInput?.addEventListener('input', triggerSettingsAuditLoadWithDebounce);
settingsAuditActionFilter?.addEventListener('change', () => { void loadSettingsAuditLogs(); });
settingsAuditUserFilter?.addEventListener('change', () => { void loadSettingsAuditLogs(); });
settingsAuditYearFilter?.addEventListener('change', () => { void loadSettingsAuditLogs(); });

const initializeSettingsState = async () => {
  if (adminAccountPanel) {
    setAdminAccountNotice('Loading admin account...', 'muted');
    setAdminAccountStatusBadge('active');
    hideAdminAccountResetForm();
  }
  if (captainCredentialsPanel) {
    setCaptainCredentialsNotice('Loading account credentials...', 'muted');
  }
  if (adminCredentialsPanel) {
    setAdminCredentialsNotice('Loading account credentials...', 'muted');
  }
  if (staffAccountsList) {
    setStaffAccountNotice('Loading staff accounts...', 'muted');
    setStaffCreateDisabled(true);
  }
  if (activeUsersList) {
    activeUsersList.innerHTML = `
      <div class="settings-list-item">
        <div class="item-info">
          <div class="fw-semibold">Loading users...</div>
          <div class="small text-muted">Fetching active account list.</div>
        </div>
        <span class="badge bg-secondary-subtle text-secondary">Syncing</span>
      </div>
    `;
  }

  try {
    await refreshSettingsState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load user management settings.';
    if (adminAccountPanel) setAdminAccountNotice(message, 'danger');
    if (captainCredentialsPanel) setCaptainCredentialsNotice(message, 'danger');
    if (adminCredentialsPanel) setAdminCredentialsNotice(message, 'danger');
    if (staffAccountsList) setStaffAccountNotice(message, 'danger');
    if (activeUsersList) {
      activeUsersList.innerHTML = `
        <div class="settings-list-item">
          <div class="item-info">
            <div class="fw-semibold">Unable to load active users</div>
            <div class="small text-muted">${escapeHtml(message)}</div>
          </div>
          <span class="badge bg-danger-subtle text-danger">Error</span>
        </div>
      `;
    }
    return;
  }

  rerenderSettingsPanels();
};

void initializeSettingsState();
initializeSettingsAuditTrail();
