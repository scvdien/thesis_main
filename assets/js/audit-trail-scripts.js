function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isMobile = window.matchMedia('(max-width: 992px)').matches;

  if (!sidebar || !backdrop) return;

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
    sidebar?.classList.remove('open');
    backdrop?.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  }
});

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromQuery || roleFromStorage || roleFromBody || 'captain';
if (roleFromQuery) {
  try {
    sessionStorage.setItem('userRole', roleFromQuery);
  } catch (error) {
    // Ignore storage failures.
  }
}
document.body.dataset.role = resolvedRole;

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && (resolvedRole === 'secretary' || resolvedRole === 'admin')) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = resolvedRole === 'secretary' || resolvedRole === 'admin';
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Audit Trail | ${dashboardLabel}`;

const reportsLink = document.querySelector('.menu a[href="reports.php"]');
if (reportsLink && isAdminRole) {
  reportsLink.setAttribute('href', 'admin-reports.php');
}

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = '2026';
}

const refreshBtn = document.getElementById('refreshBtn');
const refreshModalEl = document.getElementById('refreshModal');
const refreshModal = refreshModalEl ? new bootstrap.Modal(refreshModalEl) : null;

const logoutBtn = document.querySelector('.menu a.text-danger');
const logoutModalEl = document.getElementById('logoutModal');
if (logoutBtn && logoutModalEl) {
  const logoutModal = new bootstrap.Modal(logoutModalEl);
  logoutBtn.addEventListener('click', (event) => {
    event.preventDefault();
    logoutModal.show();
  });
}

const API_ENDPOINT = 'audit-trail-api.php';
const FETCH_LIMIT = 200;

const yearSelect = document.getElementById('yearSelect');
const auditSearchInput = document.getElementById('auditSearchInput');
const auditActionFilter = document.getElementById('auditActionFilter');
const auditUserFilter = document.getElementById('auditUserFilter');
const auditTableBody = document.getElementById('auditTableBody');
const auditTotalActions = document.getElementById('auditTotalActions');
const auditCreatedCount = document.getElementById('auditCreatedCount');
const auditUpdatedCount = document.getElementById('auditUpdatedCount');
const auditDeletedCount = document.getElementById('auditDeletedCount');

const state = {
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

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const normalizeText = (value) => String(value ?? '').trim();

const roleLabelMap = {
  captain: 'Barangay Captain',
  admin: 'Admin',
  staff: 'Registration Staff'
};

const actionBadgeMap = {
  created: { className: 'bg-info-subtle text-info', label: 'Created' },
  updated: { className: 'bg-primary-subtle text-primary', label: 'Updated' },
  deleted: { className: 'bg-danger-subtle text-danger', label: 'Deleted' },
  security: { className: 'bg-warning-subtle text-warning', label: 'Security' },
  access: { className: 'bg-success-subtle text-success', label: 'Access' }
};

const formatDateTime = (value) => {
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

const setSummary = (summary) => {
  const safeSummary = summary && typeof summary === 'object' ? summary : {};
  if (auditTotalActions) {
    auditTotalActions.textContent = String(Number(safeSummary.total_actions || 0));
  }
  if (auditCreatedCount) {
    auditCreatedCount.textContent = String(Number(safeSummary.created_count || 0));
  }
  if (auditUpdatedCount) {
    auditUpdatedCount.textContent = String(Number(safeSummary.updated_count || 0));
  }
  if (auditDeletedCount) {
    auditDeletedCount.textContent = String(Number(safeSummary.deleted_count || 0));
  }
};

const ensureYearOptions = (years = []) => {
  if (!yearSelect) return;
  const currentValue = normalizeText(yearSelect.value);
  const currentYear = new Date().getFullYear();
  const fallbackYears = [currentYear - 1, currentYear];
  const merged = [...new Set([...years, ...fallbackYears])]
    .filter((year) => Number.isInteger(year) && year > 0)
    .sort((a, b) => b - a);

  yearSelect.innerHTML = '<option value="all">All Years</option>';
  merged.forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });

  if (currentValue && [...yearSelect.options].some((opt) => opt.value === currentValue)) {
    yearSelect.value = currentValue;
  } else {
    yearSelect.value = 'all';
  }
};

const renderLoadingState = () => {
  if (!auditTableBody) return;
  auditTableBody.innerHTML = `
    <tr id="auditLoadingRow">
      <td colspan="6" class="text-center text-muted">Loading activity logs...</td>
    </tr>
    <tr id="auditEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const renderErrorState = (message) => {
  if (!auditTableBody) return;
  const safeMessage = escapeHtml(message || 'Unable to load activity logs.');
  auditTableBody.innerHTML = `
    <tr id="auditErrorRow">
      <td colspan="6" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="auditEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const buildActionBadge = (actionType, actionKey) => {
  const type = normalizeText(actionType).toLowerCase();
  const config = actionBadgeMap[type] || null;
  if (config) {
    return `<span class="badge ${config.className}">${escapeHtml(config.label)}</span>`;
  }

  const fallbackLabel = normalizeText(actionKey)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Action';
  return `<span class="badge bg-secondary-subtle text-secondary">${escapeHtml(fallbackLabel)}</span>`;
};

const renderAuditTable = () => {
  if (!auditTableBody) return;

  if (state.loading) {
    renderLoadingState();
    return;
  }

  if (state.error) {
    renderErrorState(state.error);
    return;
  }

  const rowsHtml = state.items.map((item) => {
    const createdAt = formatDateTime(item.created_at);
    const actor = item && typeof item.actor === 'object' ? item.actor : {};
    const role = normalizeText(actor.role).toLowerCase();
    const roleLabel = roleLabelMap[role] || normalizeText(actor.role_label) || '-';
    const username = normalizeText(actor.username);
    const userLabel = username ? `${roleLabel} (${username})` : roleLabel;
    const actionBadge = buildActionBadge(item.action_type, item.action_key);
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

  auditTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="auditEmptyRow" class="${state.items.length === 0 ? '' : 'd-none'}">
      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const fetchAuditLogs = async () => {
  const params = new URLSearchParams({
    limit: String(FETCH_LIMIT),
    offset: '0'
  });

  const searchValue = normalizeText(auditSearchInput?.value);
  if (searchValue) params.set('q', searchValue);

  const actionType = normalizeText(auditActionFilter?.value).toLowerCase();
  if (actionType && actionType !== 'all') params.set('action_type', actionType);

  const userRole = normalizeText(auditUserFilter?.value).toLowerCase();
  if (userRole && userRole !== 'all') params.set('user_role', userRole);

  const yearValue = normalizeText(yearSelect?.value);
  if (yearValue && yearValue !== 'all') params.set('year', yearValue);

  const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store'
  });

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

async function loadAuditLogs() {
  state.loading = true;
  state.error = '';
  renderAuditTable();

  try {
    const data = await fetchAuditLogs();
    state.items = Array.isArray(data.items) ? data.items : [];
    state.summary = data.summary && typeof data.summary === 'object'
      ? data.summary
      : {
          total_actions: 0,
          created_count: 0,
          updated_count: 0,
          deleted_count: 0
        };
    state.availableYears = Array.isArray(data?.filters?.years)
      ? data.filters.years.map((year) => Number(year)).filter((year) => Number.isInteger(year) && year > 0)
      : [];
    ensureYearOptions(state.availableYears);
  } catch (error) {
    state.items = [];
    state.summary = {
      total_actions: 0,
      created_count: 0,
      updated_count: 0,
      deleted_count: 0
    };
    state.error = error instanceof Error ? error.message : 'Unable to load audit logs.';
  } finally {
    state.loading = false;
    setSummary(state.summary);
    renderAuditTable();
  }
}

let searchDebounceId = 0;
const triggerLoadWithDebounce = () => {
  if (searchDebounceId) {
    window.clearTimeout(searchDebounceId);
  }
  searchDebounceId = window.setTimeout(() => {
    void loadAuditLogs();
  }, 250);
};

refreshBtn?.addEventListener('click', () => {
  refreshModal?.show();
  void loadAuditLogs();
});

auditSearchInput?.addEventListener('input', triggerLoadWithDebounce);
auditActionFilter?.addEventListener('change', () => { void loadAuditLogs(); });
auditUserFilter?.addEventListener('change', () => { void loadAuditLogs(); });
yearSelect?.addEventListener('change', () => { void loadAuditLogs(); });

ensureYearOptions([]);
setSummary(state.summary);
void loadAuditLogs();
