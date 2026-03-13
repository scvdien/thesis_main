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

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
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
const auditActionPills = document.querySelectorAll('.audit-quick-pill[data-audit-action]');
const auditUserFilter = document.getElementById('auditUserFilter');
const auditSortFilter = document.getElementById('auditSortFilter');
const auditClearFiltersBtn = document.getElementById('auditClearFiltersBtn');
const auditRecordCount = document.getElementById('auditRecordCount');
const auditTableBody = document.getElementById('auditTableBody');

const state = {
  loading: false,
  error: '',
  items: [],
  availableYears: [],
  total: 0
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

const formatIpAddress = (value) => {
  const ip = normalizeText(value);
  if (!ip) return '-';
  if (ip === '::1') return '127.0.0.1 (localhost)';
  if (ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return ip;
};

const toTitleLabel = (value) => normalizeText(value)
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const formatRecordDisplay = (recordId, recordType) => {
  const id = normalizeText(recordId);
  const type = toTitleLabel(recordType);
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

const formatDeviceBrowserDisplay = (summary, userAgent) => {
  const display = normalizeText(summary) || (normalizeText(userAgent) ? 'Unknown device/browser' : '-');
  return {
    text: display,
    title: normalizeText(userAgent) || display
  };
};

const setAuditRecordCount = (count) => {
  if (!auditRecordCount) return;
  const numericCount = Number(count);
  const safeCount = Number.isFinite(numericCount) && numericCount >= 0 ? Math.trunc(numericCount) : 0;
  const label = safeCount === 1 ? 'record found' : 'records found';
  auditRecordCount.textContent = `${safeCount} ${label}`;
};

const setActivePillValue = (buttons, attributeName, nextValue) => {
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

const getActivePillValue = (buttons, attributeName, fallback = 'all') => {
  for (const button of buttons) {
    if (button.classList.contains('is-active')) {
      return normalizeText(button?.dataset?.[attributeName]).toLowerCase() || fallback;
    }
  }
  return fallback;
};

const getTimestampValue = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) return 0;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSortedAuditItems = (items) => {
  const rows = Array.isArray(items) ? items.slice() : [];
  const sortValue = normalizeText(auditSortFilter?.value).toLowerCase();
  if (sortValue === 'oldest') {
    rows.sort((a, b) => getTimestampValue(a?.created_at) - getTimestampValue(b?.created_at));
    return rows;
  }
  rows.sort((a, b) => getTimestampValue(b?.created_at) - getTimestampValue(a?.created_at));
  return rows;
};

const ensureYearOptions = (years = []) => {
  if (!yearSelect) return;
  const currentValue = normalizeText(yearSelect.value);
  const currentYear = new Date().getFullYear();
  const fallbackYears = [currentYear];
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
  setAuditRecordCount(0);
  auditTableBody.innerHTML = `
    <tr id="auditLoadingRow">
      <td colspan="8" class="text-center text-muted">Loading activity logs...</td>
    </tr>
    <tr id="auditEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
    </tr>
  `;
};

const renderErrorState = (message) => {
  if (!auditTableBody) return;
  setAuditRecordCount(0);
  const safeMessage = escapeHtml(message || 'Unable to load activity logs.');
  auditTableBody.innerHTML = `
    <tr id="auditErrorRow">
      <td colspan="8" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="auditEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
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

const buildResultBadge = (actionType, actionKey, details) => {
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

  const sortedItems = getSortedAuditItems(state.items);
  const apiTotal = Number(state.total);
  const hasApiTotal = Number.isFinite(apiTotal) && apiTotal >= 0;
  setAuditRecordCount(hasApiTotal ? Math.trunc(apiTotal) : sortedItems.length);

  const rowsHtml = sortedItems.map((item) => {
    const createdAt = formatDateTime(item.created_at);
    const actor = item && typeof item.actor === 'object' ? item.actor : {};
    const role = normalizeText(actor.role).toLowerCase();
    const roleLabel = roleLabelMap[role] || normalizeText(actor.role_label);
    const username = normalizeText(actor.username);
    const isUnknownRole = roleLabel.toLowerCase() === 'unknown';
    const userLabel = username
      ? (roleLabel && !isUnknownRole ? `${roleLabel} (${username})` : username)
      : (roleLabel || '-');
    const actionBadge = buildActionBadge(item.action_type, item.action_key);
    const resultBadge = buildResultBadge(item.action_type, item.action_key, item.details);
    const recordDisplay = formatRecordDisplay(item.record_id, item.record_type);
    const details = normalizeText(item.details) || '-';
    const ipAddress = formatIpAddress(item.public_ip_address || item.ip_address);
    const deviceBrowser = formatDeviceBrowserDisplay(item.device_browser, item.user_agent);
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

  auditTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="auditEmptyRow" class="${sortedItems.length === 0 ? '' : 'd-none'}">
      <td colspan="8" class="text-center text-muted">No activity logs found.</td>
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

  const actionType = getActivePillValue(auditActionPills, 'auditAction', 'all');
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

async function loadAuditLogs() {
  state.loading = true;
  state.error = '';
  renderAuditTable();

  try {
    const data = await fetchAuditLogs();
    state.items = Array.isArray(data.items) ? data.items : [];
    const total = Number(data?.total);
    state.total = Number.isFinite(total) && total >= 0 ? Math.trunc(total) : state.items.length;
    state.availableYears = Array.isArray(data?.filters?.years)
      ? data.filters.years.map((year) => Number(year)).filter((year) => Number.isInteger(year) && year > 0)
      : [];
    ensureYearOptions(state.availableYears);
  } catch (error) {
    state.items = [];
    state.total = 0;
    state.error = error instanceof Error ? error.message : 'Unable to load audit logs.';
  } finally {
    state.loading = false;
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

const resetAuditFilters = () => {
  if (auditSearchInput) {
    auditSearchInput.value = '';
  }
  if (auditUserFilter) {
    auditUserFilter.value = 'all';
  }
  if (yearSelect) {
    yearSelect.value = 'all';
  }
  if (auditSortFilter) {
    auditSortFilter.value = 'latest';
  }
  setActivePillValue(auditActionPills, 'auditAction', 'all');
};

refreshBtn?.addEventListener('click', () => {
  refreshModal?.show();
  void loadAuditLogs();
});

auditSearchInput?.addEventListener('input', triggerLoadWithDebounce);
auditUserFilter?.addEventListener('change', () => { void loadAuditLogs(); });
yearSelect?.addEventListener('change', () => { void loadAuditLogs(); });
auditSortFilter?.addEventListener('change', renderAuditTable);
auditActionPills.forEach((button) => {
  button.addEventListener('click', () => {
    const nextValue = normalizeText(button?.dataset?.auditAction).toLowerCase() || 'all';
    const previousValue = getActivePillValue(auditActionPills, 'auditAction', 'all');
    setActivePillValue(auditActionPills, 'auditAction', nextValue);
    if (nextValue !== previousValue) {
      void loadAuditLogs();
    }
  });
});
auditClearFiltersBtn?.addEventListener('click', () => {
  resetAuditFilters();
  void loadAuditLogs();
});

ensureYearOptions([]);
setActivePillValue(auditActionPills, 'auditAction', 'all');
if (auditUserFilter) {
  auditUserFilter.value = 'all';
}
if (auditSortFilter) {
  auditSortFilter.value = 'latest';
}
setAuditRecordCount(0);
void loadAuditLogs();
