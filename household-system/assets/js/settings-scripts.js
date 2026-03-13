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

const serverRequiresCredentialUpdate = String(document.body.dataset.requiresCredentialUpdate || '').toLowerCase() === 'true';
const lockAdminCredentialUpdateFlow = isAdminRole && serverRequiresCredentialUpdate;
if (lockAdminCredentialUpdateFlow) {
  document.querySelectorAll('.settings-nav a[href^="#"]').forEach((link) => {
    if (link.getAttribute('href') !== '#admin-credentials') {
      link.remove();
    }
  });
  document.querySelectorAll('.settings-panel').forEach((panel) => {
    if (panel.id !== 'admin-credentials') {
      panel.remove();
    }
  });
  document.querySelectorAll('.settings-nav-group').forEach((group) => {
    if (!group.querySelector('a[href^="#"]')) {
      group.remove();
    }
  });
  if (history.replaceState) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#admin-credentials`);
  }
}

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
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
const USERNAME_RULE = /^[A-Za-z0-9._-]{3,80}$/;
const STAFF_ACCOUNT_LIMIT = 5;
const USERS_API_ENDPOINT = 'users-api.php';
const SETTINGS_ROLLOVER_API_ENDPOINT = 'registration-sync.php';
const SETTINGS_ROLLOVER_FETCH_LIMIT = 500;
const SETTINGS_AUDIT_API_ENDPOINT = 'audit-trail-api.php';
const SETTINGS_AUDIT_FETCH_LIMIT = 200;
const ACTIVE_USERS_REFRESH_INTERVAL_MS = 30000;
const BARANGAY_PROFILE_SEAL_MAX_SIZE_BYTES = 2 * 1024 * 1024;
const BARANGAY_PROFILE_SEAL_ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const BACKUP_RESTORE_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const BACKUP_RESTORE_PRIORITY_NOTICE = 'Run Backup first before restoring. Restoring will overwrite current household and resident records.';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

const settingsState = {
  currentUser: null,
  adminAccount: null,
  staffAccounts: [],
  activeUsers: [],
  barangayProfile: null,
  backupStatus: null,
  backupYearOptions: []
};
const backupSelectionState = {
  mode: 'all',
  year: ''
};

const settingsRolloverState = {
  rows: [],
  statuses: [],
  loading: false,
  error: ''
};

const settingsAuditState = {
  loading: false,
  error: '',
  items: [],
  availableYears: [],
  total: 0
};

let isSettingsLoading = false;
let isSettingsMutating = false;
let isActiveUsersRefreshing = false;
let activeUsersRefreshTimer = null;
let isBackupActionBusy = false;
let isSettingsRolloverBusy = false;
let settingsRolloverBusyAction = '';
let pendingSettingsRolloverRequest = null;
let pendingSettingsRolloverResetRequest = null;

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
const staffResetConfirmModalEl = document.getElementById('staffResetConfirmModal');
const staffResetConfirmText = document.getElementById('staffResetConfirmText');
const staffResetConfirmBtn = document.getElementById('staffResetConfirmBtn');
const staffResetConfirmModal =
  staffResetConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(staffResetConfirmModalEl)
    : null;
const staffResetCredentialsModalEl = document.getElementById('staffResetCredentialsModal');
const staffResetFullName = document.getElementById('staffResetFullName');
const staffResetUsername = document.getElementById('staffResetUsername');
const staffResetPassword = document.getElementById('staffResetPassword');
const staffResetPasswordConfirm = document.getElementById('staffResetPasswordConfirm');
const staffResetNotice = document.getElementById('staffResetNotice');
const staffResetBtn = document.getElementById('staffResetBtn');
const staffResetCredentialsModal =
  staffResetCredentialsModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(staffResetCredentialsModalEl)
    : null;
const backupRestoreConfirmModalEl = document.getElementById('backupRestoreConfirmModal');
const backupRestoreConfirmText = document.getElementById('backupRestoreConfirmText');
const backupRestoreConfirmBtn = document.getElementById('backupRestoreConfirmBtn');
const backupRestoreConfirmModal =
  backupRestoreConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(backupRestoreConfirmModalEl)
    : null;
let resolveBackupRestoreConfirm = null;
let pendingDeleteStaffId = '';
let pendingStaffResetId = '';
let activeStaffResetId = '';

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
const barangayProfilePanel = document.getElementById('barangay-profile');
const barangayProfileNameInput = document.getElementById('barangayProfileName');
const barangayProfileCodeInput = document.getElementById('barangayProfileCode');
const barangayProfileCaptainNameInput = document.getElementById('barangayProfileCaptainName');
const barangayProfileSecretaryNameInput = document.getElementById('barangayProfileSecretaryName');
const barangayProfileSealBrowseBtn = document.getElementById('barangayProfileSealBrowseBtn');
const barangayProfileSealDisplayName = document.getElementById('barangayProfileSealDisplayName');
const barangayProfileSealInput = document.getElementById('barangayProfileSeal');
const barangayProfileSaveBtn = document.getElementById('barangayProfileSaveBtn');
const barangayProfileNotice = document.getElementById('barangayProfileNotice');
const backupRestorePanel = document.getElementById('backup-restore');
const backupHealthBadge = document.getElementById('backupHealthBadge');
const backupScheduleSelect = document.getElementById('backupScheduleSelect');
const backupStorageLocationSelect = document.getElementById('backupStorageLocationSelect');
const backupCoverageSelect = document.getElementById('backupCoverageSelect');
const backupYearSelect = document.getElementById('backupYearSelect');
const backupLastBackupInput = document.getElementById('backupLastBackup');
const backupSizeDisplayInput = document.getElementById('backupSizeDisplay');
const backupRestoreFileInput = document.getElementById('backupRestoreFile');
const backupRestoreFileChooseBtn = document.getElementById('backupRestoreFileChooseBtn');
const backupRestoreFileName = document.getElementById('backupRestoreFileName');
const backupRestorePreview = document.getElementById('backupRestorePreview');
const backupPreviewTriggerFile = document.getElementById('backupPreviewTriggerFile');
const backupPreviewTriggerBadge = document.getElementById('backupPreviewTriggerBadge');
const backupPreviewOpenBtn = document.getElementById('backupPreviewOpenBtn');
const backupPreviewModalEl = document.getElementById('backupPreviewModal');
const backupPreviewModal =
  backupPreviewModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(backupPreviewModalEl)
    : null;
const backupPreviewFileName = document.getElementById('backupPreviewFileName');
const backupPreviewBadge = document.getElementById('backupPreviewBadge');
const backupPreviewMessage = document.getElementById('backupPreviewMessage');
const backupPreviewCreatedAt = document.getElementById('backupPreviewCreatedAt');
const backupPreviewYears = document.getElementById('backupPreviewYears');
const backupPreviewTables = document.getElementById('backupPreviewTables');
const backupPreviewRows = document.getElementById('backupPreviewRows');
const backupPreviewHouseholds = document.getElementById('backupPreviewHouseholds');
const backupPreviewRollovers = document.getElementById('backupPreviewRollovers');
const backupPreviewIncludedTables = document.getElementById('backupPreviewIncludedTables');
const backupRestoreNotice = document.getElementById('backupRestoreNotice');
const backupRunBtn = document.getElementById('backupRunBtn');
const backupDownloadBtn = document.getElementById('backupDownloadBtn');
const backupRestoreBtn = document.getElementById('backupRestoreBtn');
const BACKUP_RESTORE_SUPPORTED_TABLES = [
  'households',
  'household_members',
  'registration_households',
  'registration_members',
  'registration_residents',
  'registration_year_rollovers'
];
const backupRestorePreviewState = {
  loading: false,
  valid: false,
  error: '',
  fileName: '',
  meta: null
};
let backupRestorePreviewRequestId = 0;
const settingsRolloverPanel = document.getElementById('rollover-years');
const settingsRolloverStatusBadge = document.getElementById('settingsRolloverStatusBadge');
const settingsRolloverYearSelect = document.getElementById('settingsRolloverYearSelect');
const settingsRolloverSourceYearInput = document.getElementById('settingsRolloverSourceYear');
const settingsRolloverSourceCountInput = document.getElementById('settingsRolloverSourceCount');
const settingsRolloverTargetCountInput = document.getElementById('settingsRolloverTargetCount');
const settingsRolloverNotice = document.getElementById('settingsRolloverNotice');
const settingsRolloverResetBtn = document.getElementById('settingsRolloverResetBtn');
const settingsRolloverActionBtn = document.getElementById('settingsRolloverActionBtn');
const settingsRolloverConfirmModalEl = document.getElementById('settingsRolloverConfirmModal');
const settingsRolloverConfirmMessage = document.getElementById('settingsRolloverConfirmMessage');
const settingsRolloverConfirmDetails = document.getElementById('settingsRolloverConfirmDetails');
const settingsRolloverConfirmBtn = document.getElementById('settingsRolloverConfirmBtn');
const settingsRolloverConfirmModal =
  settingsRolloverConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(settingsRolloverConfirmModalEl)
    : null;
if (settingsRolloverConfirmModalEl) {
  settingsRolloverConfirmModalEl.addEventListener('hidden.bs.modal', () => {
    pendingSettingsRolloverRequest = null;
    if (settingsRolloverConfirmBtn) {
      settingsRolloverConfirmBtn.disabled = false;
      settingsRolloverConfirmBtn.innerHTML = 'Confirm Rollover';
    }
  });
}
const settingsRolloverResetConfirmModalEl = document.getElementById('settingsRolloverResetConfirmModal');
const settingsRolloverResetConfirmMessage = document.getElementById('settingsRolloverResetConfirmMessage');
const settingsRolloverResetConfirmDetails = document.getElementById('settingsRolloverResetConfirmDetails');
const settingsRolloverResetConfirmBtn = document.getElementById('settingsRolloverResetConfirmBtn');
const settingsRolloverResetConfirmModal =
  settingsRolloverResetConfirmModalEl && window.bootstrap && window.bootstrap.Modal
    ? new window.bootstrap.Modal(settingsRolloverResetConfirmModalEl)
    : null;
if (settingsRolloverResetConfirmModalEl) {
  settingsRolloverResetConfirmModalEl.addEventListener('hidden.bs.modal', () => {
    pendingSettingsRolloverResetRequest = null;
    if (settingsRolloverResetConfirmBtn) {
      settingsRolloverResetConfirmBtn.disabled = false;
      settingsRolloverResetConfirmBtn.innerHTML = 'Reset Rollover';
    }
  });
}
const settingsAuditSearchInput = document.getElementById('settingsAuditSearchInput');
const settingsAuditActionPills = document.querySelectorAll('.audit-quick-pill[data-settings-audit-action]');
const settingsAuditUserFilter = document.getElementById('settingsAuditUserFilter');
const settingsAuditYearFilter = document.getElementById('settingsAuditYearFilter');
const settingsAuditSortFilter = document.getElementById('settingsAuditSortFilter');
const settingsAuditClearFiltersBtn = document.getElementById('settingsAuditClearFiltersBtn');
const settingsAuditRecordCount = document.getElementById('settingsAuditRecordCount');
const settingsAuditTableBody = document.getElementById('settingsAuditTableBody');

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
    requiresCredentialUpdate: account.requiresCredentialUpdate === true,
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
  const rawPresence = String(account.presence || '').trim().toLowerCase();
  const presence = rawPresence === 'online' ? 'online' : 'offline';
  return {
    id: String(id),
    fullName,
    username,
    role,
    roleLabel: String(account.roleLabel || role).trim(),
    module: String(account.module || '').trim(),
    status: String(account.status || 'active').toLowerCase() === 'deactivated' ? 'deactivated' : 'active',
    presence,
    lastSeenAt: String(account.lastSeenAt || '').trim()
  };
};

const normalizeBarangayProfile = (profile) => {
  const row = profile && typeof profile === 'object' ? profile : {};
  return {
    regionName: String(row.region_name || row.regionName || '').trim(),
    provinceName: String(row.province_name || row.provinceName || '').trim(),
    cityName: String(row.city_name || row.cityName || '').trim(),
    barangayName: String(row.barangay_name || row.barangayName || '').trim(),
    barangayCode: String(row.barangay_code || row.barangayCode || '').trim(),
    captainName: String(row.captain_name || row.captainName || '').trim(),
    secretaryName: String(row.secretary_name || row.secretaryName || '').trim(),
    officialSealPath: String(row.official_seal_path || row.officialSealPath || '').trim()
  };
};

const normalizeBackupStatus = (status) => {
  const row = status && typeof status === 'object' ? status : {};
  const rawSize = Number(row.last_backup_size_bytes ?? row.lastBackupSizeBytes ?? 0);
  const sizeBytes = Number.isFinite(rawSize) && rawSize > 0 ? Math.trunc(rawSize) : 0;
  const fileName = String(row.last_backup_file_name || row.lastBackupFileName || '').trim();
  const available = row.available === true || sizeBytes > 0 || fileName !== '';
  return {
    available,
    schedule: String(row.schedule || 'Manual Only').trim() || 'Manual Only',
    storageLocation: String(row.storage_location || row.storageLocation || 'Local Server').trim() || 'Local Server',
    lastBackupAt: String(row.last_backup_at || row.lastBackupAt || '').trim(),
    lastBackupSizeBytes: sizeBytes,
    lastBackupSizeLabel: String(row.last_backup_size_label || row.lastBackupSizeLabel || '').trim(),
    lastBackupFileName: fileName
  };
};

const normalizeBackupYearOptions = (years) => {
  if (!Array.isArray(years)) return [];
  const normalized = years
    .map((value) => Number.parseInt(String(value ?? '').trim(), 10))
    .filter((value) => Number.isInteger(value) && value >= 2000 && value <= 2100);
  return Array.from(new Set(normalized)).sort((a, b) => b - a);
};

const readCurrentUser = () => settingsState.currentUser;
const readAdminAccount = () => settingsState.adminAccount;
const readStaffAccounts = () => (Array.isArray(settingsState.staffAccounts) ? settingsState.staffAccounts.slice() : []);
const readActiveUsers = () => (Array.isArray(settingsState.activeUsers) ? settingsState.activeUsers.slice() : []);
const readBarangayProfile = () => settingsState.barangayProfile;
const readBackupStatus = () => settingsState.backupStatus;
const readBackupYearOptions = () => (Array.isArray(settingsState.backupYearOptions) ? settingsState.backupYearOptions.slice() : []);

const hasValidAdminAccount = (account) => !!(account && account.id && account.username && account.fullName);

const applySettingsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    settingsState.currentUser = null;
    settingsState.adminAccount = null;
    settingsState.staffAccounts = [];
    settingsState.activeUsers = [];
    settingsState.barangayProfile = null;
    settingsState.backupStatus = null;
    settingsState.backupYearOptions = [];
    return;
  }
  settingsState.currentUser = normalizeCurrentUser(payload.current_user);
  settingsState.adminAccount = normalizeAdminAccount(payload.admin_account);
  const staffRows = Array.isArray(payload.staff_accounts) ? payload.staff_accounts : [];
  settingsState.staffAccounts = staffRows.map(normalizeStaffAccount).filter(Boolean);
  const activeRows = Array.isArray(payload.active_users) ? payload.active_users : [];
  settingsState.activeUsers = activeRows.map(normalizeActiveUser).filter(Boolean);
  settingsState.barangayProfile = normalizeBarangayProfile(payload.barangay_profile);
  settingsState.backupStatus = normalizeBackupStatus(payload.backup_status);
  settingsState.backupYearOptions = normalizeBackupYearOptions(payload.backup_year_options);
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

const usersApiFetchMultipart = async (formData) => {
  if (!(formData instanceof FormData)) {
    throw new Error('Invalid upload payload.');
  }
  if (!csrfToken) {
    throw new Error('Missing CSRF token. Reload the page and try again.');
  }

  const options = {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: formData
  };

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

const runSettingsMultipartAction = async (formData) => {
  if (isSettingsMutating) {
    throw new Error('Please wait for the previous action to finish.');
  }
  isSettingsMutating = true;
  try {
    const response = await usersApiFetchMultipart(formData);
    applySettingsPayload(response.data);
    return response;
  } finally {
    isSettingsMutating = false;
  }
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  if (!(file instanceof File)) {
    reject(new Error('Invalid file.'));
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = typeof reader.result === 'string' ? reader.result : '';
    if (!result) {
      reject(new Error('Unable to read official seal image.'));
      return;
    }
    resolve(result);
  };
  reader.onerror = () => reject(new Error('Unable to read official seal image.'));
  reader.readAsDataURL(file);
});

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

const refreshActiveUsersState = async () => {
  if (!activeUsersList || isSettingsMutating || isActiveUsersRefreshing) return;
  isActiveUsersRefreshing = true;
  try {
    const response = await usersApiFetch('GET');
    const data = response && typeof response === 'object' ? response.data : null;
    const activeRows = data && typeof data === 'object' && Array.isArray(data.active_users)
      ? data.active_users
      : [];
    settingsState.activeUsers = activeRows.map(normalizeActiveUser).filter(Boolean);
    renderActiveUsers();
  } catch (error) {
    // Keep previous state when auto-refresh fails.
  } finally {
    isActiveUsersRefreshing = false;
  }
};

const startActiveUsersAutoRefresh = () => {
  if (!activeUsersList || activeUsersRefreshTimer !== null) return;
  activeUsersRefreshTimer = window.setInterval(() => {
    if (document.hidden) return;
    void refreshActiveUsersState();
  }, ACTIVE_USERS_REFRESH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void refreshActiveUsersState();
    }
  });

  window.addEventListener('focus', () => {
    void refreshActiveUsersState();
  });
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
  const nextMessage = String(message || '').trim();
  staffAccountNotice.textContent = nextMessage;
  staffAccountNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  staffAccountNotice.classList.toggle('d-none', nextMessage === '');
  if (nextMessage === '') {
    return;
  }
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

const setStaffResetNotice = (message, tone = 'muted') => {
  if (!staffResetNotice) return;
  staffResetNotice.textContent = message;
  staffResetNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    staffResetNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    staffResetNotice.classList.add('text-danger');
    return;
  }
  staffResetNotice.classList.add('text-muted');
};

const setBarangayProfileNotice = (message, tone = 'muted') => {
  if (!barangayProfileNotice) return;
  barangayProfileNotice.textContent = message;
  barangayProfileNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    barangayProfileNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    barangayProfileNotice.classList.add('text-danger');
    return;
  }
  barangayProfileNotice.classList.add('text-muted');
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
const validateUsername = (value) => USERNAME_RULE.test(String(value || '').trim());
const normalizeText = (value) => String(value ?? '').trim();
const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const basenameFromPath = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const fileName = String(segments[segments.length - 1] || '').trim();
  if (!fileName) return '';
  try {
    return decodeURIComponent(fileName);
  } catch (error) {
    return fileName;
  }
};

const formatActiveUserSeenAt = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return 'No recent activity';
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

const setBackupRestoreNotice = (message, tone = 'muted') => {
  if (!backupRestoreNotice) return;
  backupRestoreNotice.textContent = message;
  backupRestoreNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    backupRestoreNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    backupRestoreNotice.classList.add('text-danger');
    return;
  }
  backupRestoreNotice.classList.add('text-muted');
};

const formatBackupDateTime = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return 'Not available';
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return normalized;
  const datePart = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timePart = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${datePart}, ${timePart}`;
};

const formatBackupSize = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return 'N/A';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let normalized = bytes;
  while (normalized >= 1024 && unitIndex < units.length - 1) {
    normalized /= 1024;
    unitIndex += 1;
  }
  const rounded = unitIndex === 0 ? String(Math.trunc(normalized)) : normalized.toFixed(2).replace(/\.?0+$/, '');
  return `${rounded} ${units[unitIndex]}`;
};

const getSelectedBackupCoverageMode = () => (backupSelectionState.mode === 'year' ? 'year' : 'all');

const getSelectedBackupYear = () => {
  const parsed = Number.parseInt(String(backupSelectionState.year || '').trim(), 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100 ? parsed : 0;
};

const syncBackupSelectionStateFromControls = () => {
  if (backupCoverageSelect) {
    backupSelectionState.mode = backupCoverageSelect.value === 'year' ? 'year' : 'all';
  }
  if (backupYearSelect) {
    backupSelectionState.year = normalizeText(backupYearSelect.value);
  }
};

const ensureBackupYearOptions = (years) => {
  if (!backupYearSelect) return;

  const currentValue = Number.parseInt(String(backupSelectionState.year || backupYearSelect.value || '').trim(), 10);
  if (!years.length) {
    backupYearSelect.innerHTML = '<option value="">No years available</option>';
    backupYearSelect.value = '';
    backupSelectionState.year = '';
    return;
  }

  const resolvedYear = Number.isInteger(currentValue) && years.includes(currentValue)
    ? currentValue
    : years[0];

  backupYearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
  backupYearSelect.value = String(resolvedYear);
  backupSelectionState.year = String(resolvedYear);
};

const describeBackupScopeSelection = () => {
  const mode = getSelectedBackupCoverageMode();
  const year = getSelectedBackupYear();
  if (mode === 'year' && year > 0) {
    return `year ${year}`;
  }
  return 'all years';
};

const buildBackupRunRequestPayload = () => {
  const mode = getSelectedBackupCoverageMode();
  const year = getSelectedBackupYear();
  if (mode === 'year') {
    if (year <= 0) {
      throw new Error('Select a valid backup year first.');
    }
    return {
      action: 'run_backup',
      backup_scope: 'selected_year',
      backup_year: year
    };
  }

  return {
    action: 'run_backup',
    backup_scope: 'all_years'
  };
};

const formatCountLabel = (value, noun) => {
  const count = Number(value);
  const safeCount = Number.isFinite(count) && count >= 0 ? Math.trunc(count) : 0;
  const label = safeCount === 1 ? noun : `${noun}s`;
  return `${safeCount.toLocaleString('en-US')} ${label}`;
};

const resetBackupRestorePreviewState = () => {
  backupRestorePreviewState.loading = false;
  backupRestorePreviewState.valid = false;
  backupRestorePreviewState.error = '';
  backupRestorePreviewState.fileName = '';
  backupRestorePreviewState.meta = null;
};

const cancelBackupRestorePreview = () => {
  backupRestorePreviewRequestId += 1;
  resetBackupRestorePreviewState();
  backupPreviewModal?.hide();
};

const setBackupPreviewText = (element, value, fallback = '-') => {
  if (!element) return;
  const normalized = normalizeText(value);
  element.textContent = normalized || fallback;
};

const formatBackupPreviewTableLabel = (tableName) => normalizeText(tableName)
  .split('_')
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

const renderBackupPreviewPillList = (container, values, formatter = null, emptyLabel = 'None') => {
  if (!container) return;
  container.innerHTML = '';

  const items = Array.isArray(values)
    ? values.map((value) => normalizeText(value)).filter(Boolean)
    : [];

  if (!items.length) {
    const empty = document.createElement('span');
    empty.className = 'backup-preview-pill-empty';
    empty.textContent = emptyLabel;
    container.appendChild(empty);
    return;
  }

  items.forEach((value) => {
    const pill = document.createElement('span');
    pill.className = 'backup-preview-pill';
    pill.textContent = typeof formatter === 'function' ? formatter(value) : value;
    container.appendChild(pill);
  });
};

const parseBackupPreviewYear = (value) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > 2100) return 0;
  return parsed;
};

const getBackupPreviewTableRows = (payload, tableName) => {
  const tablesNode = payload && typeof payload === 'object' ? payload.tables : null;
  if (!tablesNode || typeof tablesNode !== 'object') return [];
  const tableNode = tablesNode[tableName];
  if (!tableNode || typeof tableNode !== 'object' || !Array.isArray(tableNode.rows)) return [];
  return tableNode.rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
};

const getBackupPreviewTableRowCount = (payload, tableName) => {
  const rows = getBackupPreviewTableRows(payload, tableName);
  if (rows.length) return rows.length;
  const tablesNode = payload && typeof payload === 'object' ? payload.tables : null;
  if (!tablesNode || typeof tablesNode !== 'object') return 0;
  const tableNode = tablesNode[tableName];
  const parsed = Number.parseInt(String(tableNode?.row_count ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const summarizeBackupPreview = (payload, fileName) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Selected file is not a valid backup document.');
  }

  const tablesNode = payload.tables;
  if (!tablesNode || typeof tablesNode !== 'object' || Array.isArray(tablesNode)) {
    throw new Error('Selected file does not contain backup table data.');
  }

  const includedTables = Object.keys(tablesNode)
    .filter((name) => BACKUP_RESTORE_SUPPORTED_TABLES.includes(String(name || '').trim()));
  if (!includedTables.length) {
    throw new Error('Selected file does not contain restorable household tables.');
  }

  const yearSet = new Set();
  const addYear = (value) => {
    const parsed = parseBackupPreviewYear(value);
    if (parsed > 0) yearSet.add(parsed);
  };

  ['households', 'registration_households'].forEach((tableName) => {
    getBackupPreviewTableRows(payload, tableName).forEach((row) => {
      addYear(row?.record_year);
      addYear(extractSettingsRolloverHouseholdYear(row?.household_code));
      addYear(extractSettingsRolloverHouseholdYear(row?.household_id));
    });
  });

  const rolloverSet = new Set();
  getBackupPreviewTableRows(payload, 'registration_year_rollovers').forEach((row) => {
    const sourceYear = parseBackupPreviewYear(row?.source_year);
    const targetYear = parseBackupPreviewYear(row?.target_year);
    if (sourceYear > 0 && targetYear > 0) {
      rolloverSet.add(`${sourceYear}->${targetYear}`);
    }
  });

  const years = Array.from(yearSet).sort((a, b) => a - b);
  const rollovers = Array.from(rolloverSet).sort((left, right) => {
    const [leftSource = 0, leftTarget = 0] = String(left).split('->').map((value) => parseBackupPreviewYear(value));
    const [rightSource = 0, rightTarget = 0] = String(right).split('->').map((value) => parseBackupPreviewYear(value));
    if (leftSource !== rightSource) return leftSource - rightSource;
    return leftTarget - rightTarget;
  });
  const totalRows = includedTables.reduce((sum, tableName) => sum + getBackupPreviewTableRowCount(payload, tableName), 0);
  const householdRows = getBackupPreviewTableRowCount(payload, 'households') + getBackupPreviewTableRowCount(payload, 'registration_households');

  return {
    fileName: normalizeText(fileName) || 'Selected backup file',
    createdAt: normalizeText(payload.created_at),
    years,
    includedTables,
    totalRows,
    householdRows,
    rollovers
  };
};

const loadBackupRestorePreview = async (selectedFile) => {
  const requestId = ++backupRestorePreviewRequestId;
  backupRestorePreviewState.loading = true;
  backupRestorePreviewState.valid = false;
  backupRestorePreviewState.error = '';
  backupRestorePreviewState.fileName = normalizeText(selectedFile?.name);
  backupRestorePreviewState.meta = null;
  renderBackupRestoreState();

  try {
    const raw = await selectedFile.text();
    if (requestId !== backupRestorePreviewRequestId) return false;
    const payload = JSON.parse(raw);
    backupRestorePreviewState.meta = summarizeBackupPreview(payload, selectedFile.name);
    backupRestorePreviewState.loading = false;
    backupRestorePreviewState.valid = true;
    backupRestorePreviewState.error = '';
    renderBackupRestoreState();
    return true;
  } catch (error) {
    if (requestId !== backupRestorePreviewRequestId) return false;
    backupRestorePreviewState.loading = false;
    backupRestorePreviewState.valid = false;
    backupRestorePreviewState.meta = null;
    backupRestorePreviewState.error = error instanceof Error
      ? error.message
      : 'Unable to read the selected backup file.';
    renderBackupRestoreState();
    return false;
  }
};

const syncSelectByText = (selectElement, targetLabel) => {
  if (!selectElement) return;
  const target = normalizeText(targetLabel).toLowerCase();
  if (!target) return;
  const options = Array.from(selectElement.options);
  const exact = options.find((option) => normalizeText(option.textContent).toLowerCase() === target);
  if (exact) {
    selectElement.value = exact.value;
    return;
  }
  const partial = options.find((option) => {
    const text = normalizeText(option.textContent).toLowerCase();
    return text.includes(target) || target.includes(text);
  });
  if (partial) {
    selectElement.value = partial.value;
  }
};

const renderBackupRestoreState = () => {
  if (!backupRestorePanel) return;

  const backup = readBackupStatus() || normalizeBackupStatus(null);
  const availableYears = readBackupYearOptions();
  ensureBackupYearOptions(availableYears);
  const selectedCoverageMode = getSelectedBackupCoverageMode();
  const selectedBackupYear = getSelectedBackupYear();
  const yearModeActive = selectedCoverageMode === 'year';
  syncSelectByText(backupScheduleSelect, backup.schedule);
  syncSelectByText(backupStorageLocationSelect, backup.storageLocation);
  if (backupScheduleSelect) backupScheduleSelect.disabled = true;
  if (backupStorageLocationSelect) backupStorageLocationSelect.disabled = true;
  if (backupCoverageSelect) {
    backupCoverageSelect.value = selectedCoverageMode;
    backupCoverageSelect.disabled = isBackupActionBusy || isSettingsMutating;
  }
  if (backupYearSelect) {
    backupYearSelect.disabled = isBackupActionBusy || isSettingsMutating || !yearModeActive || availableYears.length === 0;
    if (!yearModeActive) {
      backupYearSelect.title = 'Enable "Selected Year Only" to choose a year.';
    } else if (availableYears.length === 0) {
      backupYearSelect.title = 'No household years are available for year-specific backup.';
    } else {
      backupYearSelect.title = '';
    }
  }

  if (backupLastBackupInput) {
    const displayValue = backup.available ? formatBackupDateTime(backup.lastBackupAt) : 'Not available';
    backupLastBackupInput.value = displayValue;
    backupLastBackupInput.title = backup.lastBackupAt || '';
  }

  if (backupSizeDisplayInput) {
    const displaySize = backup.lastBackupSizeLabel || formatBackupSize(backup.lastBackupSizeBytes);
    backupSizeDisplayInput.value = backup.available ? displaySize : 'N/A';
    backupSizeDisplayInput.title = backup.available ? displaySize : '';
  }

  if (backupHealthBadge) {
    backupHealthBadge.classList.remove('bg-success-subtle', 'text-success', 'bg-warning-subtle', 'text-warning');
    if (backup.available) {
      backupHealthBadge.textContent = 'Healthy';
      backupHealthBadge.classList.add('bg-success-subtle', 'text-success');
    } else {
      backupHealthBadge.textContent = 'No Backup';
      backupHealthBadge.classList.add('bg-warning-subtle', 'text-warning');
    }
  }

  const hasSelectedRestoreFile = !!backupRestoreFileInput?.files?.[0];
  const previewReady = !hasSelectedRestoreFile
    ? false
    : backupRestorePreviewState.valid && !backupRestorePreviewState.loading;
  if (backupRestoreFileName) {
    const selectedFileName = backupRestorePreviewState.fileName || backupRestoreFileInput?.files?.[0]?.name;
    setBackupPreviewText(backupRestoreFileName, selectedFileName, 'No file chosen');
    backupRestoreFileName.title = normalizeText(selectedFileName);
  }
  if (backupRunBtn) {
    backupRunBtn.disabled = isBackupActionBusy || isSettingsMutating || (yearModeActive && (!selectedBackupYear || availableYears.length === 0));
    if (yearModeActive && availableYears.length === 0) {
      backupRunBtn.title = 'No household years are available for year-specific backup.';
    } else if (yearModeActive && !selectedBackupYear) {
      backupRunBtn.title = 'Select a valid backup year first.';
    } else {
      backupRunBtn.title = '';
    }
  }
  if (backupDownloadBtn) {
    backupDownloadBtn.disabled = isBackupActionBusy || isSettingsMutating || !backup.available;
  }
  if (backupRestoreBtn) {
    backupRestoreBtn.disabled = isBackupActionBusy || isSettingsMutating || !backup.available || !previewReady;
    if (!backup.available) {
      backupRestoreBtn.title = 'Run Backup first to create a current household-data recovery point.';
    } else if (backupRestorePreviewState.loading) {
      backupRestoreBtn.title = 'Analyzing the selected backup file.';
    } else if (hasSelectedRestoreFile && !backupRestorePreviewState.valid) {
      backupRestoreBtn.title = 'Selected backup file is invalid or unreadable.';
    } else {
      backupRestoreBtn.title = '';
    }
  }

  if (backupRestorePreview) {
    const showPreview = hasSelectedRestoreFile
      || backupRestorePreviewState.loading
      || backupRestorePreviewState.valid
      || !!backupRestorePreviewState.error;
    backupRestorePreview.classList.toggle('d-none', !showPreview);
  }

  if (backupPreviewTriggerFile) {
    setBackupPreviewText(
      backupPreviewTriggerFile,
      backupRestorePreviewState.fileName || backupRestoreFileInput?.files?.[0]?.name,
      'No file selected'
    );
  }

  if (backupPreviewFileName) {
    setBackupPreviewText(backupPreviewFileName, backupRestorePreviewState.fileName || backupRestoreFileInput?.files?.[0]?.name, 'No file selected');
  }
  const applyBackupPreviewBadgeState = (element) => {
    if (!element) return;
    element.className = 'badge';
    if (backupRestorePreviewState.loading) {
      element.textContent = 'Analyzing';
      element.classList.add('bg-info-subtle', 'text-info');
    } else if (backupRestorePreviewState.error) {
      element.textContent = 'Invalid';
      element.classList.add('bg-danger-subtle', 'text-danger');
    } else if (backupRestorePreviewState.valid) {
      element.textContent = 'Ready';
      element.classList.add('bg-primary-subtle', 'text-primary');
    } else {
      element.textContent = 'Waiting';
      element.classList.add('bg-secondary-subtle', 'text-secondary');
    }
  };
  applyBackupPreviewBadgeState(backupPreviewTriggerBadge);
  applyBackupPreviewBadgeState(backupPreviewBadge);

  if (backupPreviewOpenBtn) {
    backupPreviewOpenBtn.classList.toggle('d-none', !hasSelectedRestoreFile);
    backupPreviewOpenBtn.disabled = !backupRestorePreviewState.valid || backupRestorePreviewState.loading;
    backupPreviewOpenBtn.title = backupRestorePreviewState.loading
      ? 'Finish analyzing the selected backup file first.'
      : backupRestorePreviewState.valid
        ? ''
        : 'Select a valid backup file first.';
  }

  if (backupPreviewMessage) {
    backupPreviewMessage.classList.remove('text-muted', 'text-danger', 'text-primary');
    if (backupRestorePreviewState.loading) {
      backupPreviewMessage.textContent = 'Reading the selected file and checking its years, tables, and row counts.';
      backupPreviewMessage.classList.add('text-primary');
    } else if (backupRestorePreviewState.error) {
      backupPreviewMessage.textContent = backupRestorePreviewState.error;
      backupPreviewMessage.classList.add('text-danger');
    } else if (backupRestorePreviewState.valid && backupRestorePreviewState.meta) {
      const yearsLabel = backupRestorePreviewState.meta.years.length
        ? backupRestorePreviewState.meta.years.join(', ')
        : 'No household year detected';
      backupPreviewMessage.textContent = `Preview ready. This backup contains data for year(s): ${yearsLabel}.`;
      backupPreviewMessage.classList.add('text-muted');
    } else {
      backupPreviewMessage.textContent = 'Select a backup file to preview the years and contents before restore.';
      backupPreviewMessage.classList.add('text-muted');
    }
  }

  const previewMeta = backupRestorePreviewState.meta;
  if (backupRestorePreviewState.valid && previewMeta) {
    setBackupPreviewText(backupPreviewCreatedAt, formatBackupDateTime(previewMeta.createdAt), 'Not available');
    setBackupPreviewText(backupPreviewYears, previewMeta.years.length ? previewMeta.years.join(', ') : 'No year detected');
    setBackupPreviewText(backupPreviewTables, formatCountLabel(previewMeta.includedTables.length, 'table'));
    setBackupPreviewText(backupPreviewRows, formatCountLabel(previewMeta.totalRows, 'row'));
    setBackupPreviewText(backupPreviewHouseholds, formatCountLabel(previewMeta.householdRows, 'household record'));
    renderBackupPreviewPillList(backupPreviewRollovers, previewMeta.rollovers, null, 'No rollover history saved in this backup');
    renderBackupPreviewPillList(backupPreviewIncludedTables, previewMeta.includedTables, formatBackupPreviewTableLabel, 'No included tables');
  } else {
    setBackupPreviewText(backupPreviewCreatedAt, '');
    setBackupPreviewText(backupPreviewYears, '');
    setBackupPreviewText(backupPreviewTables, '');
    setBackupPreviewText(backupPreviewRows, '');
    setBackupPreviewText(backupPreviewHouseholds, '');
    renderBackupPreviewPillList(backupPreviewRollovers, [], null, 'No rollover history saved in this backup');
    renderBackupPreviewPillList(backupPreviewIncludedTables, [], formatBackupPreviewTableLabel, 'No included tables');
  }
};

const setBackupActionBusy = (busy) => {
  isBackupActionBusy = busy;
  renderBackupRestoreState();
};

const setSettingsRolloverNotice = (message, tone = 'muted') => {
  if (!settingsRolloverNotice) return;
  settingsRolloverNotice.textContent = message;
  settingsRolloverNotice.classList.remove('text-muted', 'text-success', 'text-danger');
  if (tone === 'success') {
    settingsRolloverNotice.classList.add('text-success');
    return;
  }
  if (tone === 'danger') {
    settingsRolloverNotice.classList.add('text-danger');
    return;
  }
  settingsRolloverNotice.classList.add('text-muted');
};

const extractSettingsRolloverYearFromDate = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getFullYear();
};

const extractSettingsRolloverHouseholdYear = (value) => {
  const match = String(value || '').match(/^HH-(\d{4})-/i);
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const getSettingsRolloverRowYear = (row) => {
  const explicitYear = Number.parseInt(String(row?.record_year || ''), 10);
  if (Number.isInteger(explicitYear) && explicitYear > 0) return explicitYear;
  const fromCode = extractSettingsRolloverHouseholdYear(row?.household_id);
  if (fromCode > 0) return fromCode;
  const fromUpdated = extractSettingsRolloverYearFromDate(row?.updated_at);
  if (fromUpdated > 0) return fromUpdated;
  return extractSettingsRolloverYearFromDate(row?.created_at);
};

const getSelectedSettingsRolloverYear = () => {
  const parsed = Number.parseInt(normalizeText(settingsRolloverYearSelect?.value), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return new Date().getFullYear();
};

const ensureSettingsRolloverYearOptions = (rows = []) => {
  if (!settingsRolloverYearSelect) return;
  const currentValue = normalizeText(settingsRolloverYearSelect.value);
  const currentYear = new Date().getFullYear();
  const yearSet = new Set([currentYear, currentYear - 1]);

  rows.forEach((row) => {
    const year = getSettingsRolloverRowYear(row);
    if (Number.isInteger(year) && year > 0) {
      yearSet.add(year);
    }
  });

  const years = Array.from(yearSet).sort((a, b) => b - a);
  settingsRolloverYearSelect.innerHTML = '';
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    settingsRolloverYearSelect.appendChild(option);
  });

  if (currentValue && years.includes(Number.parseInt(currentValue, 10))) {
    settingsRolloverYearSelect.value = currentValue;
    return;
  }
  settingsRolloverYearSelect.value = String(years[0] || currentYear);
};

const getSettingsRolloverAvailableYears = () => {
  const years = settingsRolloverState.rows
    .map((row) => getSettingsRolloverRowYear(row))
    .filter((year) => Number.isInteger(year) && year > 0);
  return Array.from(new Set(years)).sort((a, b) => b - a);
};

const getSettingsRolloverStatusForYear = (targetYear) => {
  return settingsRolloverState.statuses.find((item) => Number(item?.target_year || 0) === Number(targetYear || 0)) || null;
};

const getSettingsRolloverLatestSourceYear = (targetYear) => {
  return getSettingsRolloverAvailableYears().find((year) => year < targetYear) || 0;
};

const countSettingsRolloverRowsForYear = (targetYear) => {
  return settingsRolloverState.rows.filter((row) => getSettingsRolloverRowYear(row) === Number(targetYear || 0)).length;
};

const setSettingsRolloverBadgeState = (label, tone = 'primary') => {
  if (!settingsRolloverStatusBadge) return;
  settingsRolloverStatusBadge.textContent = label;
  settingsRolloverStatusBadge.classList.remove(
    'bg-primary-subtle',
    'text-primary',
    'bg-success-subtle',
    'text-success',
    'bg-warning-subtle',
    'text-warning',
    'bg-danger-subtle',
    'text-danger',
    'bg-secondary-subtle',
    'text-secondary'
  );

  if (tone === 'success') {
    settingsRolloverStatusBadge.classList.add('bg-success-subtle', 'text-success');
    return;
  }
  if (tone === 'warning') {
    settingsRolloverStatusBadge.classList.add('bg-warning-subtle', 'text-warning');
    return;
  }
  if (tone === 'danger') {
    settingsRolloverStatusBadge.classList.add('bg-danger-subtle', 'text-danger');
    return;
  }
  if (tone === 'secondary') {
    settingsRolloverStatusBadge.classList.add('bg-secondary-subtle', 'text-secondary');
    return;
  }
  settingsRolloverStatusBadge.classList.add('bg-primary-subtle', 'text-primary');
};

const renderSettingsRolloverState = () => {
  if (!settingsRolloverPanel) return;

  ensureSettingsRolloverYearOptions(settingsRolloverState.rows);

  const selectedYear = getSelectedSettingsRolloverYear();
  const status = getSettingsRolloverStatusForYear(selectedYear);
  const isCompleted = normalizeText(status?.status).toLowerCase() === 'completed';
  const sourceYear = isCompleted
    ? Number(status?.source_year || 0) || getSettingsRolloverLatestSourceYear(selectedYear)
    : getSettingsRolloverLatestSourceYear(selectedYear);
  const computedSourceCount = countSettingsRolloverRowsForYear(sourceYear);
  const sourceCount = isCompleted
    ? Math.max(Number(status?.source_household_count || 0), computedSourceCount)
    : computedSourceCount;
  const targetCount = countSettingsRolloverRowsForYear(selectedYear);

  if (settingsRolloverSourceYearInput) {
    settingsRolloverSourceYearInput.value = sourceYear > 0 ? String(sourceYear) : 'Not available';
  }
  if (settingsRolloverSourceCountInput) {
    settingsRolloverSourceCountInput.value = String(sourceCount);
  }
  if (settingsRolloverTargetCountInput) {
    settingsRolloverTargetCountInput.value = String(targetCount);
  }
  if (settingsRolloverResetBtn) {
    settingsRolloverResetBtn.classList.toggle('d-none', !isCompleted && settingsRolloverBusyAction !== 'reset');
    settingsRolloverResetBtn.disabled = true;
    settingsRolloverResetBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset Rollover';
  }

  if (settingsRolloverState.loading) {
    setSettingsRolloverBadgeState('Checking', 'primary');
    setSettingsRolloverNotice('Loading rollover status...', 'muted');
    if (settingsRolloverActionBtn) {
        settingsRolloverActionBtn.disabled = true;
        settingsRolloverActionBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Checking...';
      }
    if (settingsRolloverResetBtn) {
      settingsRolloverResetBtn.disabled = true;
    }
    if (settingsRolloverYearSelect) {
      settingsRolloverYearSelect.disabled = true;
    }
    return;
  }

  if (settingsRolloverState.error) {
    setSettingsRolloverBadgeState('Error', 'danger');
    setSettingsRolloverNotice(settingsRolloverState.error, 'danger');
    if (settingsRolloverActionBtn) {
        settingsRolloverActionBtn.disabled = true;
        settingsRolloverActionBtn.innerHTML = '<i class="bi bi-copy"></i> Roll Over Selected Year';
      }
    if (settingsRolloverResetBtn) {
      settingsRolloverResetBtn.disabled = true;
    }
    if (settingsRolloverYearSelect) {
      settingsRolloverYearSelect.disabled = false;
    }
    return;
  }

  if (settingsRolloverYearSelect) {
    settingsRolloverYearSelect.disabled = isSettingsRolloverBusy || isSettingsMutating;
  }

  if (isSettingsRolloverBusy) {
    setSettingsRolloverBadgeState('Running', 'warning');
    setSettingsRolloverNotice(
      settingsRolloverBusyAction === 'reset'
        ? `Resetting rolled-over records for ${selectedYear}. Please wait...`
        : `Rolling over household records into ${selectedYear}. Please wait...`,
      'muted'
    );
    if (settingsRolloverActionBtn) {
      settingsRolloverActionBtn.disabled = true;
      settingsRolloverActionBtn.innerHTML = settingsRolloverBusyAction === 'run'
        ? '<i class="bi bi-hourglass-split"></i> Rolling Over...'
        : '<i class="bi bi-copy"></i> Roll Over Selected Year';
    }
    if (settingsRolloverResetBtn) {
      settingsRolloverResetBtn.classList.toggle('d-none', settingsRolloverBusyAction !== 'reset');
      settingsRolloverResetBtn.disabled = true;
      settingsRolloverResetBtn.innerHTML = settingsRolloverBusyAction === 'reset'
        ? '<i class="bi bi-hourglass-split"></i> Resetting...'
        : '<i class="bi bi-arrow-counterclockwise"></i> Reset Rollover';
    }
    return;
  }

  if (isCompleted) {
    const completedAt = formatBackupDateTime(status?.completed_at || '');
    setSettingsRolloverBadgeState('Completed', 'success');
    setSettingsRolloverNotice(
      completedAt !== 'Not available'
        ? `Rollover for ${selectedYear} completed on ${completedAt}. Use Reset Rollover if you need to clear this year and run it again.`
        : `Rollover for ${selectedYear} has already been completed. Use Reset Rollover if you need to clear this year and run it again.`,
      'success'
    );
    if (settingsRolloverActionBtn) {
      settingsRolloverActionBtn.disabled = true;
      settingsRolloverActionBtn.innerHTML = '<i class="bi bi-check2-circle"></i> Rollover Completed';
    }
    if (settingsRolloverResetBtn) {
      settingsRolloverResetBtn.classList.toggle('d-none', false);
      settingsRolloverResetBtn.disabled = isSettingsMutating;
      settingsRolloverResetBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset Rollover';
    }
    return;
  }

  if (!sourceYear) {
    setSettingsRolloverBadgeState('Unavailable', 'secondary');
    setSettingsRolloverNotice(`No previous household year is available to roll over into ${selectedYear}.`, 'muted');
    if (settingsRolloverActionBtn) {
      settingsRolloverActionBtn.disabled = true;
      settingsRolloverActionBtn.innerHTML = '<i class="bi bi-copy"></i> Roll Over Selected Year';
    }
    return;
  }

  setSettingsRolloverBadgeState('Ready', 'primary');
  setSettingsRolloverNotice(
    targetCount > 0
      ? `Ready to copy ${sourceCount} household record${sourceCount === 1 ? '' : 's'} from ${sourceYear} to ${selectedYear}. Existing ${selectedYear} households will stay as-is.`
      : `Ready to copy ${sourceCount} household record${sourceCount === 1 ? '' : 's'} from ${sourceYear} to ${selectedYear}.`,
    'muted'
  );
  if (settingsRolloverActionBtn) {
    settingsRolloverActionBtn.disabled = isSettingsMutating;
    settingsRolloverActionBtn.innerHTML = '<i class="bi bi-copy"></i> Roll Over Selected Year';
  }
  if (settingsRolloverResetBtn) {
    settingsRolloverResetBtn.classList.toggle('d-none', true);
    settingsRolloverResetBtn.disabled = true;
    settingsRolloverResetBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i> Reset Rollover';
  }
};

const fetchSettingsRolloverState = async () => {
  const params = new URLSearchParams({
    action: 'list_households',
    include_rollover_statuses: '1',
    limit: String(SETTINGS_ROLLOVER_FETCH_LIMIT),
    offset: '0'
  });
  let response;
  try {
    response = await fetch(`${SETTINGS_ROLLOVER_API_ENDPOINT}?${params.toString()}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store'
    });
  } catch (error) {
    throw new Error('Cannot reach household rollover data right now.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true) {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to load rollover data (${response.status}).`;
    throw new Error(message);
  }

  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  const statuses = Array.isArray(payload?.data?.rollover_statuses) ? payload.data.rollover_statuses : [];
  return {
    rows: items.map((item) => ({
      household_id: String(item?.household_id || ''),
      record_year: Number(item?.record_year || 0),
      updated_at: String(item?.updated_at || ''),
      created_at: String(item?.created_at || '')
    })),
    statuses: statuses.map((item) => ({
      target_year: Number(item?.target_year || 0),
      source_year: Number(item?.source_year || 0),
      status: String(item?.status || ''),
      source_household_count: Number(item?.source_household_count || 0),
      created_household_count: Number(item?.created_household_count || 0),
      skipped_household_count: Number(item?.skipped_household_count || 0),
      completed_at: String(item?.completed_at || '')
    }))
  };
};

const loadSettingsRolloverState = async () => {
  if (!settingsRolloverPanel || settingsRolloverState.loading) return;
  settingsRolloverState.loading = true;
  settingsRolloverState.error = '';
  renderSettingsRolloverState();

  try {
    const payload = await fetchSettingsRolloverState();
    settingsRolloverState.rows = Array.isArray(payload?.rows) ? payload.rows : [];
    settingsRolloverState.statuses = Array.isArray(payload?.statuses) ? payload.statuses : [];
  } catch (error) {
    settingsRolloverState.rows = [];
    settingsRolloverState.statuses = [];
    settingsRolloverState.error = error instanceof Error ? error.message : 'Unable to load rollover data.';
  } finally {
    settingsRolloverState.loading = false;
    renderSettingsRolloverState();
  }
};

const requestSettingsYearRollover = async (targetYear, sourceYear) => {
  let response;
  try {
    response = await fetch(SETTINGS_ROLLOVER_API_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      body: JSON.stringify({
        action: 'rollover_households',
        target_year: targetYear,
        source_year: sourceYear
      })
    });
  } catch (error) {
    throw new Error('Cannot reach household rollover action right now.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true) {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to roll over households (${response.status}).`;
    throw new Error(message);
  }

  return payload;
};

const requestSettingsYearRolloverReset = async (targetYear) => {
  let response;
  try {
    response = await fetch(SETTINGS_ROLLOVER_API_ENDPOINT, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
      },
      body: JSON.stringify({
        action: 'reset_rollover_households',
        target_year: targetYear
      })
    });
  } catch (error) {
    throw new Error('Cannot reach rollover reset action right now.');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || payload.success !== true) {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to reset rollover data (${response.status}).`;
    throw new Error(message);
  }

  return payload;
};

const executeSettingsYearRollover = async () => {
  if (!pendingSettingsRolloverRequest) return;

  const { targetYear, sourceYear } = pendingSettingsRolloverRequest;
  const confirmButtonOriginalHtml = settingsRolloverConfirmBtn?.innerHTML || 'Confirm Rollover';
  let successMessage = '';
  let errorMessage = '';

  if (settingsRolloverConfirmBtn) {
    settingsRolloverConfirmBtn.disabled = true;
    settingsRolloverConfirmBtn.innerHTML = 'Rolling Over...';
  }

  isSettingsRolloverBusy = true;
  settingsRolloverBusyAction = 'run';
  renderSettingsRolloverState();

  try {
    const payload = await requestSettingsYearRollover(targetYear, sourceYear);
    settingsRolloverConfirmModal?.hide();
    pendingSettingsRolloverRequest = null;
    await loadSettingsRolloverState();
    if (settingsRolloverYearSelect) {
      settingsRolloverYearSelect.value = String(targetYear);
    }
    renderSettingsRolloverState();

    const created = Number(payload?.created || 0);
    const skipped = Number(payload?.skipped || 0);
    successMessage = `Rollover completed for ${payload?.target_year || targetYear}. Created ${created} household record${created === 1 ? '' : 's'} and skipped ${skipped}.`;
  } catch (error) {
    settingsRolloverConfirmModal?.hide();
    errorMessage = error instanceof Error ? error.message : 'Unable to roll over households right now.';
  } finally {
    isSettingsRolloverBusy = false;
    settingsRolloverBusyAction = '';
    renderSettingsRolloverState();
    pendingSettingsRolloverRequest = null;
    if (settingsRolloverConfirmBtn) {
      settingsRolloverConfirmBtn.disabled = false;
      settingsRolloverConfirmBtn.innerHTML = confirmButtonOriginalHtml;
    }
    if (successMessage) {
      setSettingsRolloverNotice(successMessage, 'success');
    } else if (errorMessage) {
      setSettingsRolloverNotice(errorMessage, 'danger');
    }
  }
};

const executeSettingsYearRolloverReset = async () => {
  if (!pendingSettingsRolloverResetRequest) return;

  const { targetYear } = pendingSettingsRolloverResetRequest;
  const confirmButtonOriginalHtml = settingsRolloverResetConfirmBtn?.innerHTML || 'Reset Rollover';
  let successMessage = '';
  let errorMessage = '';

  if (settingsRolloverResetConfirmBtn) {
    settingsRolloverResetConfirmBtn.disabled = true;
    settingsRolloverResetConfirmBtn.innerHTML = 'Resetting...';
  }

  isSettingsRolloverBusy = true;
  settingsRolloverBusyAction = 'reset';
  renderSettingsRolloverState();

  try {
    const payload = await requestSettingsYearRolloverReset(targetYear);
    settingsRolloverResetConfirmModal?.hide();
    pendingSettingsRolloverResetRequest = null;
    await loadSettingsRolloverState();
    if (settingsRolloverYearSelect) {
      settingsRolloverYearSelect.value = String(targetYear);
    }
    renderSettingsRolloverState();

    const deletedHouseholds = Number(payload?.deleted_households || 0);
    const deletedMembers = Number(payload?.deleted_members || 0);
    successMessage = `Rollover reset for ${targetYear}. Removed ${deletedHouseholds} rolled-over household record${deletedHouseholds === 1 ? '' : 's'} and ${deletedMembers} member record${deletedMembers === 1 ? '' : 's'}.`;
  } catch (error) {
    settingsRolloverResetConfirmModal?.hide();
    errorMessage = error instanceof Error ? error.message : 'Unable to reset rollover data right now.';
  } finally {
    isSettingsRolloverBusy = false;
    settingsRolloverBusyAction = '';
    renderSettingsRolloverState();
    pendingSettingsRolloverResetRequest = null;
    if (settingsRolloverResetConfirmBtn) {
      settingsRolloverResetConfirmBtn.disabled = false;
      settingsRolloverResetConfirmBtn.innerHTML = confirmButtonOriginalHtml;
    }
    if (successMessage) {
      setSettingsRolloverNotice(successMessage, 'success');
    } else if (errorMessage) {
      setSettingsRolloverNotice(errorMessage, 'danger');
    }
  }
};

const resolveBackupRestoreConfirmRequest = (confirmed) => {
  if (typeof resolveBackupRestoreConfirm !== 'function') return;
  const settle = resolveBackupRestoreConfirm;
  resolveBackupRestoreConfirm = null;
  settle(confirmed);
};

const requestBackupRestoreConfirm = (fileName = '') => {
  const safeFileName = normalizeText(fileName);
  const message = safeFileName
    ? `Restore from "${safeFileName}" backup file? This will overwrite current household and resident records.`
    : 'Restore from this backup file? This will overwrite current household and resident records.';

  if (backupRestoreConfirmText) {
    backupRestoreConfirmText.textContent = message;
  }

  if (!backupRestoreConfirmModal) {
    return Promise.resolve(window.confirm(message));
  }

  resolveBackupRestoreConfirmRequest(false);
  return new Promise((resolve) => {
    resolveBackupRestoreConfirm = resolve;
    backupRestoreConfirmModal.show();
  });
};

const decodeBackupBase64ToBlob = (base64Value, mimeType = 'application/json') => {
  const normalized = String(base64Value || '').trim();
  if (!normalized) {
    throw new Error('Downloaded backup content is empty.');
  }

  let binary = '';
  try {
    binary = window.atob(normalized);
  } catch (error) {
    throw new Error('Downloaded backup content is invalid.');
  }

  const length = binary.length;
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: String(mimeType || 'application/json') });
};

const triggerBackupFileDownload = (blob, fileName) => {
  if (!(blob instanceof Blob)) {
    throw new Error('Downloaded backup file is invalid.');
  }

  const safeName = normalizeText(fileName) || `hims-backup-${Date.now()}.json`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = safeName;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

const renderBarangayProfileState = () => {
  if (!barangayProfilePanel) return;
  const profile = readBarangayProfile() || normalizeBarangayProfile(null);

  if (barangayProfileNameInput) {
    barangayProfileNameInput.value = profile.barangayName || '';
  }
  if (barangayProfileCodeInput) {
    barangayProfileCodeInput.value = profile.barangayCode || '';
  }
  if (barangayProfileCaptainNameInput) {
    barangayProfileCaptainNameInput.value = profile.captainName || '';
  }
  if (barangayProfileSecretaryNameInput) {
    barangayProfileSecretaryNameInput.value = profile.secretaryName || '';
  }
  if (barangayProfileSealDisplayName) {
    const selectedName = String(barangayProfileSealInput?.files?.[0]?.name || '').trim();
    const savedName = basenameFromPath(profile.officialSealPath || '');
    const displayName = selectedName || savedName;
    barangayProfileSealDisplayName.value = displayName || 'No file chosen';
    barangayProfileSealDisplayName.title = displayName || '';
  }
  if (barangayProfileSaveBtn) {
    barangayProfileSaveBtn.disabled = false;
  }
};

const rerenderSettingsPanels = () => {
  renderCaptainCredentialsState();
  renderAdminAccountState();
  renderAdminCredentialsState();
  renderStaffAccounts();
  renderActiveUsers();
  renderBarangayProfileState();
  renderBackupRestoreState();
  renderSettingsRolloverState();
  if (typeof syncStaffViewModal === 'function') {
    syncStaffViewModal();
  }
};

const toPositiveInteger = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.trunc(parsed);
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

const clearStaffResetFields = () => {
  if (staffResetFullName) staffResetFullName.value = '';
  if (staffResetUsername) staffResetUsername.value = '';
  if (staffResetPassword) staffResetPassword.value = '';
  if (staffResetPasswordConfirm) staffResetPasswordConfirm.value = '';
};

const openStaffResetCredentialsModalById = (staffId) => {
  const selected = readStaffAccounts().find((account) => account.id === staffId);
  if (!selected) {
    setStaffAccountNotice('Staff account not found.', 'danger');
    return;
  }

  activeStaffResetId = staffId;
  clearStaffResetFields();
  if (staffResetFullName) staffResetFullName.value = selected.fullName || '';
  if (staffResetUsername) staffResetUsername.value = selected.username || '';
  setStaffResetNotice(
    `Set a new temporary username and password for ${selected.fullName}. Staff must change them on the next login.`,
    'muted'
  );
  staffResetCredentialsModal?.show();
};

const promptStaffCredentialResetById = (staffId) => {
  const selected = readStaffAccounts().find((account) => account.id === staffId);
  if (!selected) {
    setStaffAccountNotice('Staff account not found.', 'danger');
    return;
  }

  pendingStaffResetId = staffId;
  if (staffResetConfirmText) {
    staffResetConfirmText.textContent = `You are about to reset the credentials for ${selected.fullName}. Continue to open the reset form.`;
  }

  if (staffResetConfirmModal) {
    staffResetConfirmModal.show();
    return;
  }

  const proceed = window.confirm(`Reset credentials for ${selected.fullName}? This will open the reset form.`);
  if (!proceed) {
    pendingStaffResetId = '';
    setStaffAccountNotice('Staff credential reset was cancelled.', 'muted');
    return;
  }

  openStaffResetCredentialsModalById(staffId);
  setStaffResetNotice('Enter new username and password, then save new credentials.', 'muted');
};

const attemptStaffCredentialReset = async () => {
  const selected = readStaffAccounts().find((account) => account.id === activeStaffResetId);
  if (!selected) {
    setStaffResetNotice('Staff account not found.', 'danger');
    return;
  }

  const username = String(staffResetUsername?.value || '').trim();
  const password = String(staffResetPassword?.value || '');
  const confirmPassword = String(staffResetPasswordConfirm?.value || '');

  if (!username || !password || !confirmPassword) {
    setStaffResetNotice('Complete all reset fields before saving.', 'danger');
    return;
  }
  if (!validateUsername(username)) {
    setStaffResetNotice('Username must be 3-80 characters and use only letters, numbers, dot, underscore, or dash.', 'danger');
    return;
  }
  if (!validateStaffPassword(password)) {
    setStaffResetNotice('Temporary password must be at least 8 characters and include 1 special character.', 'danger');
    return;
  }
  if (password !== confirmPassword) {
    setStaffResetNotice('Temporary password and confirmation do not match.', 'danger');
    return;
  }

  try {
    const response = await runSettingsAction({
      action: 'reset_staff_credentials',
      staff_id: toPositiveInteger(activeStaffResetId),
      username,
      password
    });
    rerenderSettingsPanels();
    setStaffAccountNotice(response.message || `Staff credentials for "${selected.fullName}" were reset successfully.`, 'success');
    staffResetCredentialsModal?.hide();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset staff credentials right now.';
    setStaffResetNotice(message, 'danger');
  }
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
    setStaffAccountNotice('', 'muted');
    return;
  }

  staffAccountsList.innerHTML = accounts.map((account) => {
    const isDeactivated = account.status === 'deactivated';
    const requiresCredentialUpdate = account.requiresCredentialUpdate === true;
    const badgeClass = isDeactivated ? 'bg-danger-subtle text-danger' : 'bg-success-subtle text-success';
    const badgeText = isDeactivated ? 'Deactivated' : 'Active';
    const accountId = escapeHtml(account.id);
    const fullName = escapeHtml(account.fullName);
    const role = escapeHtml(account.role);
    const moduleName = escapeHtml(account.module);
    const username = escapeHtml(account.username);
    const contactNumber = escapeHtml(account.contactNumber || 'Not provided');
    const credentialBadge = requiresCredentialUpdate
      ? '<span class="badge bg-warning-subtle text-warning staff-account-status">Needs Update</span>'
      : '';
    const credentialNote = requiresCredentialUpdate
      ? '<div class="small text-warning">Temporary credentials pending staff update</div>'
      : '';
    return `
      <div class="settings-list-item staff-account-card">
        <div class="staff-account-main">
          <div class="staff-account-head">
            <div class="item-info">
              <div class="staff-account-name">${fullName}</div>
              <div class="staff-account-meta">${role} | ${moduleName}</div>
              <div class="small">Username: ${username}</div>
              <div class="small text-muted">Mobile: ${contactNumber}</div>
              ${credentialNote}
            </div>
          </div>
        </div>
        <div class="staff-account-actions">
          <span class="badge ${badgeClass} staff-account-status">${badgeText}</span>
          ${credentialBadge}
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
                <button type="button" class="dropdown-item" data-staff-action="reset" data-staff-id="${accountId}">
                  <i class="bi bi-key"></i> Reset
                </button>
              </li>
              <li>
                <button type="button" class="dropdown-item text-danger" data-staff-action="delete" data-staff-id="${accountId}">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (reachedLimit) {
    setStaffAccountNotice(`Staff account limit reached (${STAFF_ACCOUNT_LIMIT}). Delete an existing account before creating a new one.`, 'danger');
    return;
  }
  setStaffAccountNotice('', 'muted');
};

const renderActiveUsers = () => {
  if (!activeUsersList) return;
  const users = readActiveUsers();
  const onlineCount = users.filter((row) => row.presence === 'online').length;
  if (activeUsersBadge) {
    activeUsersBadge.textContent = `${onlineCount} Online`;
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
    const isOnline = account.presence === 'online';
    const badgeClass = isOnline
      ? 'bg-success-subtle text-success'
      : 'bg-secondary-subtle text-secondary';
    const badgeLabel = isOnline ? 'Online' : 'Offline';
    const presenceText = isOnline
      ? 'Currently active'
      : `Last seen: ${formatActiveUserSeenAt(account.lastSeenAt)}`;
    return `
      <div class="settings-list-item">
        <div class="item-info">
          <div class="fw-semibold">${fullName}</div>
          <div class="small">Role: ${role}</div>
          <div class="small">Module: ${moduleName}</div>
          <div class="small text-muted">Username: ${username}</div>
          <div class="small text-muted">${escapeHtml(presenceText)}</div>
        </div>
        <span class="badge ${badgeClass}">${badgeLabel}</span>
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

const formatSettingsAuditIpAddress = (value) => {
  const ip = normalizeText(value);
  if (!ip) return '-';
  if (ip === '::1') return '127.0.0.1 (localhost)';
  if (ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return ip;
};

const formatSettingsAuditTitleLabel = (value) => normalizeText(value)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatSettingsAuditRecordDisplay = (recordId, recordType) => {
  const id = normalizeText(recordId);
  const type = formatSettingsAuditTitleLabel(recordType);
  if (id) {
    return {
      text: id,
      title: type ? `${type}: ${id}` : id
    };
  }
  if (type) {
    return {
      text: type,
      title: type
    };
  }
  return {
    text: '-',
    title: ''
  };
};

const formatSettingsAuditDeviceBrowserDisplay = (summary, userAgent) => {
  const display = normalizeText(summary) || (normalizeText(userAgent) ? 'Unknown device/browser' : '-');
  return {
    text: display,
    title: normalizeText(userAgent) || display
  };
};

const setActiveSettingsAuditPill = (buttons, attributeName, nextValue) => {
  const targetValue = normalizeText(nextValue).toLowerCase() || 'all';
  let hasMatch = false;
  buttons.forEach((button) => {
    const buttonValue = normalizeText(button?.dataset?.[attributeName]).toLowerCase();
    const isActive = buttonValue === targetValue;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    if (isActive) hasMatch = true;
  });
  if (hasMatch) return targetValue;
  const fallbackButton = buttons[0];
  if (!fallbackButton) return 'all';
  fallbackButton.classList.add('is-active');
  fallbackButton.setAttribute('aria-pressed', 'true');
  return normalizeText(fallbackButton.dataset?.[attributeName]).toLowerCase() || 'all';
};

const getActiveSettingsAuditPillValue = (buttons, attributeName, fallback = 'all') => {
  for (const button of buttons) {
    if (button.classList.contains('is-active')) {
      return normalizeText(button?.dataset?.[attributeName]).toLowerCase() || fallback;
    }
  }
  return fallback;
};

const setSettingsAuditRecordCount = (count) => {
  if (!settingsAuditRecordCount) return;
  const numericCount = Number(count);
  const safeCount = Number.isFinite(numericCount) && numericCount >= 0 ? Math.trunc(numericCount) : 0;
  const label = safeCount === 1 ? 'record found' : 'records found';
  settingsAuditRecordCount.textContent = `${safeCount} ${label}`;
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
  setSettingsAuditRecordCount(0);
  settingsAuditTableBody.innerHTML = `
    <tr id="settingsAuditLoadingRow">
      <td colspan="8" class="text-center text-muted">Loading activity logs...</td>
    </tr>
    <tr id="settingsAuditEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const renderSettingsAuditErrorState = (message) => {
  if (!settingsAuditTableBody) return;
  const safeMessage = escapeHtml(message || 'Unable to load activity logs.');
  settingsAuditTableBody.innerHTML = `
    <tr id="settingsAuditErrorRow">
      <td colspan="8" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="settingsAuditEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
  setSettingsAuditRecordCount(0);
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

const buildSettingsAuditResultBadge = (actionType, actionKey, details) => {
  const type = normalizeText(actionType).toLowerCase();
  const key = normalizeText(actionKey).toLowerCase();
  const detailText = normalizeText(details).toLowerCase();

  const isFailed = key.includes('failed') || detailText.includes('failed');
  const isSuccess = key.includes('success') || detailText.includes('successful');

  if (isFailed || type === 'security') {
    return '<span class="badge bg-danger-subtle text-danger">Failed</span>';
  }
  if (isSuccess || ['access', 'created', 'updated', 'deleted'].includes(type)) {
    return '<span class="badge bg-success-subtle text-success">Success</span>';
  }
  return '<span class="badge bg-secondary-subtle text-secondary">N/A</span>';
};

const getSettingsAuditTimestampValue = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSortedSettingsAuditItems = (items) => {
  const rows = Array.isArray(items) ? items.slice() : [];
  const sortValue = normalizeText(settingsAuditSortFilter?.value).toLowerCase();

  if (sortValue === 'oldest') {
    rows.sort((a, b) => getSettingsAuditTimestampValue(a?.created_at) - getSettingsAuditTimestampValue(b?.created_at));
    return rows;
  }

  rows.sort((a, b) => getSettingsAuditTimestampValue(b?.created_at) - getSettingsAuditTimestampValue(a?.created_at));
  return rows;
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

  const sortedItems = getSortedSettingsAuditItems(settingsAuditState.items);
  const apiTotal = Number(settingsAuditState.total);
  const hasApiTotal = Number.isFinite(apiTotal) && apiTotal >= 0;
  setSettingsAuditRecordCount(hasApiTotal ? Math.trunc(apiTotal) : sortedItems.length);
  const rowsHtml = sortedItems.map((item) => {
    const createdAt = formatSettingsAuditDateTime(item.created_at);
    const actor = item && typeof item.actor === 'object' ? item.actor : {};
    const role = normalizeText(actor.role).toLowerCase();
    const roleLabel = settingsAuditRoleLabelMap[role] || normalizeText(actor.role_label);
    const username = normalizeText(actor.username);
    const isUnknownRole = roleLabel.toLowerCase() === 'unknown';
    const userLabel = username
      ? (roleLabel && !isUnknownRole ? `${roleLabel} (${username})` : username)
      : (roleLabel || '-');
    const actionBadge = buildSettingsAuditActionBadge(item.action_type, item.action_key);
    const resultBadge = buildSettingsAuditResultBadge(item.action_type, item.action_key, item.details);
    const recordDisplay = formatSettingsAuditRecordDisplay(item.record_id, item.record_type);
    const details = normalizeText(item.details) || '-';
    const ipAddress = formatSettingsAuditIpAddress(item.public_ip_address || item.ip_address);
    const deviceBrowser = formatSettingsAuditDeviceBrowserDisplay(item.device_browser, item.user_agent);
    return `
      <tr>
        <td>${escapeHtml(createdAt)}</td>
        <td>${escapeHtml(userLabel)}</td>
        <td>${actionBadge}</td>
        <td>${resultBadge}</td>
        <td class="audit-record-id-cell"><span class="audit-record-id-text" title="${escapeHtml(recordDisplay.title)}">${escapeHtml(recordDisplay.text)}</span></td>
        <td class="audit-details-cell">${escapeHtml(details)}</td>
        <td class="audit-ip-cell"><span class="audit-ip-text" title="${escapeHtml(ipAddress)}">${escapeHtml(ipAddress)}</span></td>
        <td class="audit-device-cell"><span class="audit-device-text" title="${escapeHtml(deviceBrowser.title)}">${escapeHtml(deviceBrowser.text)}</span></td>
      </tr>
    `;
  }).join('');

  settingsAuditTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="settingsAuditEmptyRow" class="${sortedItems.length === 0 ? '' : 'd-none'}">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
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

  const actionType = getActiveSettingsAuditPillValue(settingsAuditActionPills, 'settingsAuditAction', 'all');
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
  let rawText = '';
  try {
    rawText = await response.text();
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (error) {
    payload = null;
  }
  if (!payload && rawText) {
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        payload = JSON.parse(rawText.slice(firstBrace, lastBrace + 1));
      } catch (error) {
        payload = null;
      }
    }
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
    const total = Number(data?.total);
    settingsAuditState.total = Number.isFinite(total) && total >= 0 ? Math.trunc(total) : settingsAuditState.items.length;
    settingsAuditState.availableYears = Array.isArray(data?.filters?.years)
      ? data.filters.years.map((year) => Number(year)).filter((year) => Number.isInteger(year) && year > 0)
      : [];
    ensureSettingsAuditYearOptions(settingsAuditState.availableYears);
  } catch (error) {
    settingsAuditState.items = [];
    settingsAuditState.total = 0;
    settingsAuditState.error = error instanceof Error ? error.message : 'Unable to load audit logs.';
  } finally {
    settingsAuditState.loading = false;
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
  setActiveSettingsAuditPill(settingsAuditActionPills, 'settingsAuditAction', 'all');
  if (settingsAuditUserFilter) {
    settingsAuditUserFilter.value = 'all';
  }
  if (settingsAuditSortFilter) {
    settingsAuditSortFilter.value = 'latest';
  }
  setSettingsAuditRecordCount(0);
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
    if (adminCredentialsCurrentUsername) {
      adminCredentialsCurrentUsername.value = currentUser.username || '';
    }
    setAdminCredentialsNotice('Temporary admin credentials are still active. Update them before accessing other admin tools.', 'muted');
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
  const requiresUpdate = currentUser.requiresCredentialUpdate === true;

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
    if (requiresUpdate) {
      setAdminCredentialsNotice(response.message || 'Credentials updated successfully. Redirecting to admin dashboard...', 'success');
      window.setTimeout(() => {
        window.location.href = 'admin.php';
      }, 700);
      return;
    }
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
  if (adminCredentialsCurrentUsername) {
    adminCredentialsCurrentUsername.value = currentUser.username || '';
  }

  openAdminCredentialsForm();
  setAdminCredentialsNotice('Enter your current username and password, then set your new credentials.', 'muted');
});

barangayProfileSaveBtn?.addEventListener('click', async (event) => {
  event.preventDefault();

  const barangayName = String(barangayProfileNameInput?.value || '').trim();
  const barangayCode = String(barangayProfileCodeInput?.value || '').trim();
  const captainName = String(barangayProfileCaptainNameInput?.value || '').trim();
  const secretaryName = String(barangayProfileSecretaryNameInput?.value || '').trim();
  const selectedSealFile = barangayProfileSealInput?.files?.[0] || null;

  const currentProfile = readBarangayProfile() || normalizeBarangayProfile(null);
  const hasChanges =
    barangayName !== currentProfile.barangayName ||
    barangayCode !== currentProfile.barangayCode ||
    captainName !== currentProfile.captainName ||
    secretaryName !== currentProfile.secretaryName;
  const hasSealChange = !!selectedSealFile;

  if (!hasChanges && !hasSealChange) {
    setBarangayProfileNotice('No changes to save.', 'muted');
    return;
  }

  if (hasSealChange && selectedSealFile) {
    const fileType = String(selectedSealFile.type || '').toLowerCase();
    if (!fileType || !BARANGAY_PROFILE_SEAL_ALLOWED_TYPES.includes(fileType)) {
      setBarangayProfileNotice('Official seal must be a PNG, JPG, or WEBP image.', 'danger');
      return;
    }
    if (selectedSealFile.size > BARANGAY_PROFILE_SEAL_MAX_SIZE_BYTES) {
      setBarangayProfileNotice('Official seal image must be 2MB or less.', 'danger');
      return;
    }
  }

  try {
    let response;
    if (hasSealChange && selectedSealFile) {
      try {
        const formData = new FormData();
        formData.set('action', 'save_barangay_profile');
        formData.set('barangay_name', barangayName);
        formData.set('barangay_code', barangayCode);
        formData.set('captain_name', captainName);
        formData.set('secretary_name', secretaryName);
        formData.set('official_seal_file', selectedSealFile);
        response = await runSettingsMultipartAction(formData);
      } catch (uploadError) {
        const sealDataUrl = await readFileAsDataUrl(selectedSealFile);
        response = await runSettingsAction({
          action: 'save_barangay_profile',
          barangay_name: barangayName,
          barangay_code: barangayCode,
          captain_name: captainName,
          secretary_name: secretaryName,
          official_seal_data: sealDataUrl
        });
      }
    } else {
      const payload = {
        action: 'save_barangay_profile',
        barangay_name: barangayName,
        barangay_code: barangayCode,
        captain_name: captainName,
        secretary_name: secretaryName
      };
      response = await runSettingsAction(payload);
    }
    if (barangayProfileSealInput) {
      barangayProfileSealInput.value = '';
    }
    rerenderSettingsPanels();
    setBarangayProfileNotice(response.message || 'Barangay profile saved successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save barangay profile right now.';
    setBarangayProfileNotice(message, 'danger');
  }
});

barangayProfileSealInput?.addEventListener('change', () => {
  renderBarangayProfileState();
});

barangayProfileSealBrowseBtn?.addEventListener('click', (event) => {
  event.preventDefault();
  barangayProfileSealInput?.click();
});

settingsRolloverYearSelect?.addEventListener('change', () => {
  renderSettingsRolloverState();
});

settingsRolloverActionBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!settingsRolloverPanel || isSettingsRolloverBusy || isSettingsMutating) return;

  const targetYear = getSelectedSettingsRolloverYear();
  const existingStatus = getSettingsRolloverStatusForYear(targetYear);
  if (normalizeText(existingStatus?.status).toLowerCase() === 'completed') {
    renderSettingsRolloverState();
    return;
  }

  const sourceYear = getSettingsRolloverLatestSourceYear(targetYear);
  if (!sourceYear) {
    renderSettingsRolloverState();
    setSettingsRolloverNotice(`No previous household year is available to roll over into ${targetYear}.`, 'danger');
    return;
  }

  const sourceCount = countSettingsRolloverRowsForYear(sourceYear);
  const targetCount = countSettingsRolloverRowsForYear(targetYear);
  pendingSettingsRolloverRequest = { targetYear, sourceYear, sourceCount, targetCount };

  const confirmMessage = targetCount > 0
    ? `Copy ${sourceCount} household record${sourceCount === 1 ? '' : 's'} from ${sourceYear} to ${targetYear}? Existing ${targetYear} records will stay as-is and only missing households will be created.`
    : `Copy ${sourceCount} household record${sourceCount === 1 ? '' : 's'} from ${sourceYear} to ${targetYear}?`;
  const confirmDetails = `This will mark ${targetYear} as rolled over after the copy is completed.`;

  if (settingsRolloverConfirmMessage) {
    settingsRolloverConfirmMessage.textContent = confirmMessage;
  }
  if (settingsRolloverConfirmDetails) {
    settingsRolloverConfirmDetails.textContent = confirmDetails;
  }

  if (settingsRolloverConfirmModal) {
    settingsRolloverConfirmModal.show();
    return;
  }

  const confirmed = window.confirm(`${confirmMessage}\n\n${confirmDetails}`);
  if (!confirmed) {
    pendingSettingsRolloverRequest = null;
    setSettingsRolloverNotice('Rollover was cancelled.', 'muted');
    return;
  }

  await executeSettingsYearRollover();
});

settingsRolloverConfirmBtn?.addEventListener('click', async () => {
  await executeSettingsYearRollover();
});

settingsRolloverResetConfirmBtn?.addEventListener('click', async () => {
  await executeSettingsYearRolloverReset();
});

settingsRolloverResetBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!settingsRolloverPanel || isSettingsRolloverBusy || isSettingsMutating) return;

  const targetYear = getSelectedSettingsRolloverYear();
  const existingStatus = getSettingsRolloverStatusForYear(targetYear);
  if (normalizeText(existingStatus?.status).toLowerCase() !== 'completed') {
    renderSettingsRolloverState();
    return;
  }

  const targetCount = countSettingsRolloverRowsForYear(targetYear);
  const confirmMessage = `Reset rollover for ${targetYear}?`;
  const confirmDetails = `This will remove rolled-over household records for ${targetYear} and allow you to run the rollover again.${targetCount > 0 ? ` Current target-year households: ${targetCount}.` : ''}`;

  pendingSettingsRolloverResetRequest = { targetYear, targetCount };

  if (settingsRolloverResetConfirmMessage) {
    settingsRolloverResetConfirmMessage.textContent = confirmMessage;
  }
  if (settingsRolloverResetConfirmDetails) {
    settingsRolloverResetConfirmDetails.textContent = confirmDetails;
  }

  if (settingsRolloverResetConfirmModal) {
    settingsRolloverResetConfirmModal.show();
    return;
  }

  const confirmed = window.confirm(`${confirmMessage}\n\n${confirmDetails}`);
  if (!confirmed) {
    pendingSettingsRolloverResetRequest = null;
    setSettingsRolloverNotice('Rollover reset was cancelled.', 'muted');
    return;
  }

  await executeSettingsYearRolloverReset();
});

backupCoverageSelect?.addEventListener('change', () => {
  syncBackupSelectionStateFromControls();
  renderBackupRestoreState();

  const availableYears = readBackupYearOptions();
  if (getSelectedBackupCoverageMode() === 'year') {
    if (!availableYears.length) {
      setBackupRestoreNotice('No household years are available yet for a year-specific backup.', 'danger');
      return;
    }
    const selectedYear = getSelectedBackupYear();
    setBackupRestoreNotice(
      selectedYear > 0
        ? `Backup coverage set to selected year: ${selectedYear}.`
        : 'Select a backup year to continue.',
      'muted'
    );
    return;
  }

  setBackupRestoreNotice('Backup coverage set to all years.', 'muted');
});

backupYearSelect?.addEventListener('change', () => {
  syncBackupSelectionStateFromControls();
  renderBackupRestoreState();

  if (getSelectedBackupCoverageMode() !== 'year') return;
  const selectedYear = getSelectedBackupYear();
  setBackupRestoreNotice(
    selectedYear > 0
      ? `Selected backup year: ${selectedYear}.`
      : 'Select a valid backup year to continue.',
    selectedYear > 0 ? 'muted' : 'danger'
  );
});

backupPreviewOpenBtn?.addEventListener('click', () => {
  if (!backupRestorePreviewState.valid || backupRestorePreviewState.loading) return;
  backupPreviewModal?.show();
});

backupRestoreFileChooseBtn?.addEventListener('click', () => {
  backupRestoreFileInput?.click();
});

backupRestoreFileInput?.addEventListener('change', async () => {
  const selectedFile = backupRestoreFileInput.files?.[0] || null;
  if (!selectedFile) {
    cancelBackupRestorePreview();
    setBackupRestoreNotice(BACKUP_RESTORE_PRIORITY_NOTICE, 'muted');
    renderBackupRestoreState();
    return;
  }

  if (selectedFile.size > BACKUP_RESTORE_MAX_FILE_SIZE_BYTES) {
    cancelBackupRestorePreview();
    backupRestoreFileInput.value = '';
    setBackupRestoreNotice('Backup file must be 25MB or less.', 'danger');
    renderBackupRestoreState();
    return;
  }

  const backup = readBackupStatus() || normalizeBackupStatus(null);
  setBackupRestoreNotice(`Analyzing backup file: ${selectedFile.name}`, 'muted');
  const previewReady = await loadBackupRestorePreview(selectedFile);
  if (!previewReady) {
    setBackupRestoreNotice(backupRestorePreviewState.error || 'Unable to inspect the selected backup file.', 'danger');
    return;
  }
  if (!backup.available) {
    setBackupRestoreNotice('Preview ready. Run Backup first before restore so current data has a recovery point.', 'danger');
    return;
  }
  setBackupRestoreNotice(`Preview ready: ${selectedFile.name}`, 'muted');
});

backupRunBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!backupRestorePanel || isBackupActionBusy) return;

  let requestPayload;
  try {
    syncBackupSelectionStateFromControls();
    requestPayload = buildBackupRunRequestPayload();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to prepare backup request.';
    setBackupRestoreNotice(message, 'danger');
    renderBackupRestoreState();
    return;
  }

  const scopeLabel = describeBackupScopeSelection();
  setBackupActionBusy(true);
  setBackupRestoreNotice(`Creating household backup for ${scopeLabel}...`, 'muted');
  try {
    const response = await runSettingsAction(requestPayload);
    rerenderSettingsPanels();
    const backup = response && typeof response === 'object' && response.backup && typeof response.backup === 'object'
      ? response.backup
      : null;
    const backupName = String(backup?.file_name || '').trim();
    const message = response?.message || (backupName ? `Household backup created for ${scopeLabel}: ${backupName}` : `Household backup for ${scopeLabel} completed successfully.`);
    setBackupRestoreNotice(message, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run backup right now.';
    setBackupRestoreNotice(message, 'danger');
  } finally {
    setBackupActionBusy(false);
  }
});

backupDownloadBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!backupRestorePanel || isBackupActionBusy) return;

  setBackupActionBusy(true);
  setBackupRestoreNotice('Preparing household backup download...', 'muted');
  try {
    const response = await runSettingsAction({ action: 'download_backup' });
    const download = response && typeof response === 'object' && response.download && typeof response.download === 'object'
      ? response.download
      : null;
    if (!download) {
      throw new Error('Backup download payload is missing.');
    }

    const blob = decodeBackupBase64ToBlob(download.content_base64, download.mime_type);
    triggerBackupFileDownload(blob, download.file_name);
    rerenderSettingsPanels();
    setBackupRestoreNotice(response?.message || 'Household backup download started.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to download backup right now.';
    setBackupRestoreNotice(message, 'danger');
  } finally {
    setBackupActionBusy(false);
  }
});

backupRestoreBtn?.addEventListener('click', async (event) => {
  event.preventDefault();
  if (!backupRestorePanel || isBackupActionBusy) return;

  const backup = readBackupStatus() || normalizeBackupStatus(null);
  if (!backup.available) {
    setBackupRestoreNotice('Run Backup first before restoring current household and resident records.', 'danger');
    renderBackupRestoreState();
    return;
  }

  const selectedFile = backupRestoreFileInput?.files?.[0] || null;
  if (!selectedFile) {
    setBackupRestoreNotice('Select a backup file first before restoring.', 'danger');
    renderBackupRestoreState();
    return;
  }
  if (selectedFile.size > BACKUP_RESTORE_MAX_FILE_SIZE_BYTES) {
    setBackupRestoreNotice('Backup file must be 25MB or less.', 'danger');
    renderBackupRestoreState();
    return;
  }

  const confirmed = await requestBackupRestoreConfirm(selectedFile.name);
  if (!confirmed) {
    setBackupRestoreNotice('Restore was cancelled.', 'muted');
    return;
  }

  const formData = new FormData();
  formData.set('action', 'restore_backup');
  formData.set('backup_file', selectedFile);

  setBackupActionBusy(true);
  setBackupRestoreNotice('Restoring household records. Please wait...', 'muted');
  try {
    const response = await runSettingsMultipartAction(formData);
    if (backupRestoreFileInput) {
      backupRestoreFileInput.value = '';
    }
    cancelBackupRestorePreview();
    rerenderSettingsPanels();
    setBackupRestoreNotice(response?.message || 'Household backup restore completed successfully.', 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to restore backup right now.';
    setBackupRestoreNotice(message, 'danger');
  } finally {
    setBackupActionBusy(false);
  }
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

  if (action === 'reset') {
    promptStaffCredentialResetById(staffId);
    return;
  }

  if (action === 'delete') {
    requestStaffDeleteById(staffId);
  }
});

backupRestoreConfirmBtn?.addEventListener('click', () => {
  resolveBackupRestoreConfirmRequest(true);
  backupRestoreConfirmModal?.hide();
});

backupRestoreConfirmModalEl?.addEventListener('hidden.bs.modal', () => {
  resolveBackupRestoreConfirmRequest(false);
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

staffResetConfirmBtn?.addEventListener('click', () => {
  const staffId = pendingStaffResetId;
  staffResetConfirmModal?.hide();
  if (!staffId) return;
  window.setTimeout(() => {
    openStaffResetCredentialsModalById(staffId);
    setStaffResetNotice('Enter new username and password, then save new credentials.', 'muted');
  }, 140);
});

staffResetConfirmModalEl?.addEventListener('hidden.bs.modal', () => {
  pendingStaffResetId = '';
});

staffResetBtn?.addEventListener('click', async () => {
  await attemptStaffCredentialReset();
});

staffResetCredentialsModalEl?.addEventListener('hidden.bs.modal', () => {
  activeStaffResetId = '';
  clearStaffResetFields();
  setStaffResetNotice('Temporary credentials are never shown again after this reset.', 'muted');
});

const resetSettingsAuditFilters = () => {
  if (settingsAuditSearchInput) {
    settingsAuditSearchInput.value = '';
  }
  if (settingsAuditUserFilter) {
    settingsAuditUserFilter.value = 'all';
  }
  if (settingsAuditYearFilter) {
    settingsAuditYearFilter.value = 'all';
  }
  if (settingsAuditSortFilter) {
    settingsAuditSortFilter.value = 'latest';
  }
  setActiveSettingsAuditPill(settingsAuditActionPills, 'settingsAuditAction', 'all');
};

settingsAuditSearchInput?.addEventListener('input', triggerSettingsAuditLoadWithDebounce);
settingsAuditActionPills.forEach((button) => {
  button.addEventListener('click', () => {
    const nextValue = normalizeText(button?.dataset?.settingsAuditAction).toLowerCase() || 'all';
    const previousValue = getActiveSettingsAuditPillValue(settingsAuditActionPills, 'settingsAuditAction', 'all');
    setActiveSettingsAuditPill(settingsAuditActionPills, 'settingsAuditAction', nextValue);
    if (nextValue !== previousValue) {
      void loadSettingsAuditLogs();
    }
  });
});
settingsAuditUserFilter?.addEventListener('change', () => { void loadSettingsAuditLogs(); });
settingsAuditYearFilter?.addEventListener('change', () => { void loadSettingsAuditLogs(); });
settingsAuditSortFilter?.addEventListener('change', renderSettingsAuditTable);
settingsAuditClearFiltersBtn?.addEventListener('click', () => {
  resetSettingsAuditFilters();
  void loadSettingsAuditLogs();
});

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
  if (barangayProfilePanel) {
    if (barangayProfileSaveBtn) {
      barangayProfileSaveBtn.disabled = true;
    }
    setBarangayProfileNotice('Loading barangay profile...', 'muted');
  }
  if (backupRestorePanel) {
    setBackupActionBusy(false);
    setBackupRestoreNotice('Loading backup status...', 'muted');
  }
  if (settingsRolloverPanel) {
    isSettingsRolloverBusy = false;
    settingsRolloverBusyAction = '';
    setSettingsRolloverBadgeState('Checking', 'primary');
    setSettingsRolloverNotice('Loading rollover status...', 'muted');
    if (settingsRolloverActionBtn) {
      settingsRolloverActionBtn.disabled = true;
    }
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
    await loadSettingsRolloverState();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load user management settings.';
    if (adminAccountPanel) setAdminAccountNotice(message, 'danger');
    if (captainCredentialsPanel) setCaptainCredentialsNotice(message, 'danger');
    if (adminCredentialsPanel) setAdminCredentialsNotice(message, 'danger');
    if (staffAccountsList) setStaffAccountNotice(message, 'danger');
    if (barangayProfilePanel) setBarangayProfileNotice(message, 'danger');
    if (backupRestorePanel) setBackupRestoreNotice(message, 'danger');
    if (settingsRolloverPanel) setSettingsRolloverNotice(message, 'danger');
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
  if (barangayProfilePanel) {
    setBarangayProfileNotice('These details will appear on official documents and reports.', 'muted');
  }
  if (backupRestorePanel) {
    setBackupRestoreNotice(BACKUP_RESTORE_PRIORITY_NOTICE, 'muted');
  }
};

void initializeSettingsState();
initializeSettingsAuditTrail();
startActiveUsersAutoRefresh();
