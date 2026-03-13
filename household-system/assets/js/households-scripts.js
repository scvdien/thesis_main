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

const API_ENDPOINT = 'registration-sync.php';
const HOUSEHOLD_FETCH_LIMIT = 500;

const state = {
  rows: [],
  years: [],
  loading: false,
  error: ''
};

const escapeHtml = (value) => {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const normalizeZoneLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, ' ');
  const namedMatch = compact.match(/^(?:zone|purok)\s*([a-z0-9-]+)$/i);
  if (namedMatch) {
    const suffix = String(namedMatch[1] || '').trim();
    if (!suffix) return 'Zone';
    if (/^\d+$/.test(suffix)) {
      return `Zone ${Number.parseInt(suffix, 10)}`;
    }
    return `Zone ${suffix.toUpperCase()}`;
  }
  if (/^\d+$/.test(compact)) {
    return `Zone ${Number.parseInt(compact, 10)}`;
  }
  return compact;
};

const normalizeZone = (value) => normalizeZoneLabel(value).toLowerCase();

const extractYearFromDate = (value) => {
  if (!value) return 0;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 0;
  return parsed.getFullYear();
};

const extractHouseholdYear = (value) => {
  const match = String(value || '').match(/^HH-(\d{4})-/i);
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const getHouseholdRowYear = (row) => {
  const explicitYear = Number.parseInt(String(row?.record_year || ''), 10);
  if (Number.isInteger(explicitYear) && explicitYear > 0) return explicitYear;
  const fromCode = extractHouseholdYear(row?.household_id);
  if (fromCode > 0) return fromCode;
  const fromUpdated = extractYearFromDate(row?.updated_at);
  if (fromUpdated > 0) return fromUpdated;
  return extractYearFromDate(row?.created_at);
};

const formatUpdatedDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const pageParams = new URLSearchParams(window.location.search);
const normalizeYearFilterValue = (value) => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : '';
};
const currentYear = new Date().getFullYear();
const requestedYear = normalizeYearFilterValue(pageParams.get('year'));
const yearSelect = document.getElementById('yearSelect');
const normalizeAvailableYears = (values = []) => {
  return Array.from(new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => Number.parseInt(String(value || '').trim(), 10))
      .filter((year) => Number.isInteger(year) && year > 0)
  )).sort((a, b) => b - a);
};

const ensureYearOptions = (rows = [], availableYears = state.years) => {
  if (!yearSelect) return;
  const currentValue = String(yearSelect.value || '').trim();
  const yearSet = new Set([currentYear, currentYear - 1]);
  normalizeAvailableYears(availableYears).forEach((year) => yearSet.add(year));
  rows.forEach((row) => {
    const year = getHouseholdRowYear(row);
    if (Number.isInteger(year) && year > 0) {
      yearSet.add(year);
    }
  });
  const years = Array.from(yearSet).sort((a, b) => b - a);
  yearSelect.innerHTML = '';
  years.forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });
  if (currentValue && years.includes(Number.parseInt(currentValue, 10))) {
    yearSelect.value = currentValue;
  } else if (requestedYear && years.includes(Number.parseInt(requestedYear, 10))) {
    yearSelect.value = requestedYear;
  } else {
    yearSelect.value = String(years[0] || currentYear);
  }
};

const getSelectedYear = () => String(yearSelect?.value || currentYear);

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

const refreshBtn = document.getElementById('refreshBtn');
const addHouseholdBtn = document.getElementById('addHouseholdBtn');
const refreshModalEl = document.getElementById('refreshModal');
const refreshModal = refreshModalEl ? new bootstrap.Modal(refreshModalEl) : null;
if (refreshBtn && refreshModal) {
  refreshBtn.addEventListener('click', () => {
    refreshModal.show();
    void loadHouseholds();
  });
}

const logoutBtn = document.querySelector('.menu a.text-danger');
const logoutModalEl = document.getElementById('logoutModal');
if (logoutBtn && logoutModalEl) {
  const logoutModal = new bootstrap.Modal(logoutModalEl);
  logoutBtn.addEventListener('click', (event) => {
    event.preventDefault();
    logoutModal.show();
  });
}

const householdSearchInput = document.getElementById('householdSearchInput');
const householdZoneFilter = document.getElementById('householdZoneFilter');
const householdsTableBody = document.getElementById('householdsTableBody');

const ensureZoneOptions = (rows = []) => {
  if (!householdZoneFilter) return;
  const currentValue = normalizeZone(householdZoneFilter.value || 'all') || 'all';
  const zoneMap = new Map();

  rows.forEach((row) => {
    const label = normalizeZoneLabel(row?.zone);
    const key = normalizeZone(label);
    if (!key || key === '-') return;
    if (!zoneMap.has(key)) {
      zoneMap.set(key, label);
    }
  });

  const zones = Array.from(zoneMap.entries()).sort((a, b) => {
    return a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' });
  });

  householdZoneFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Zones';
  householdZoneFilter.appendChild(allOption);

  zones.forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    householdZoneFilter.appendChild(option);
  });

  const hasCurrent = currentValue === 'all' || zoneMap.has(currentValue);
  householdZoneFilter.value = hasCurrent ? currentValue : 'all';
};

const roleFromQueryRaw = pageParams.get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromBody || roleFromQuery || roleFromStorage || 'captain';
if (roleFromQuery) {
  sessionStorage.setItem('userRole', roleFromQuery);
}
document.body.dataset.role = resolvedRole;
const canEdit = resolvedRole === 'secretary' || resolvedRole === 'admin';
document.body.classList.toggle('role-can-edit', canEdit);

const buildHouseholdsPageUrl = (yearValue = getSelectedYear()) => {
  const params = new URLSearchParams(window.location.search);
  if (canEdit) {
    params.set('role', resolvedRole);
  } else {
    params.delete('role');
  }
  const normalizedYear = normalizeYearFilterValue(yearValue);
  if (normalizedYear) {
    params.set('year', normalizedYear);
  } else {
    params.delete('year');
  }
  return `households.php${params.toString() ? `?${params.toString()}` : ''}`;
};

const syncHouseholdsUrlState = () => {
  if (!window.history?.replaceState) return;
  window.history.replaceState(null, '', buildHouseholdsPageUrl());
};

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && canEdit) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = canEdit;
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Households | ${dashboardLabel}`;

const editModalEl = document.getElementById('editHouseholdModal');
const editModal = editModalEl ? new bootstrap.Modal(editModalEl) : null;
const editHouseholdId = document.getElementById('editHouseholdId');
const editHouseholdHead = document.getElementById('editHouseholdHead');
const editHouseholdZone = document.getElementById('editHouseholdZone');
const editHouseholdMembers = document.getElementById('editHouseholdMembers');
const editHouseholdStatus = document.getElementById('editHouseholdStatus');
const editHouseholdAddress = document.getElementById('editHouseholdAddress');

const householdModalEl = document.getElementById('householdModal');
const householdModal = householdModalEl ? new bootstrap.Modal(householdModalEl) : null;
const hhModalEditBtn = document.getElementById('hhModalEditBtn');
const hhModalDeleteBtn = document.getElementById('hhModalDeleteBtn');

const deleteModalEl = document.getElementById('deleteHouseholdModal');
const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
const deleteHouseholdId = document.getElementById('deleteHouseholdId');

const setLoadingState = () => {
  if (!householdsTableBody) return;
  householdsTableBody.innerHTML = `
    <tr id="householdsLoadingRow">
      <td colspan="6" class="text-center text-muted">Loading households...</td>
    </tr>
    <tr id="householdsEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No households found.</td>
    </tr>
  `;
};

const setErrorState = (message) => {
  if (!householdsTableBody) return;
  const safeMessage = escapeHtml(message || 'Failed to load households.');
  householdsTableBody.innerHTML = `
    <tr id="householdsErrorRow">
      <td colspan="6" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="householdsEmptyRow" class="d-none">
      <td colspan="6" class="text-center text-muted">No households found.</td>
    </tr>
  `;
};

const getFilteredRows = (selectedYear) => {
  const term = String(householdSearchInput?.value || '').trim().toLowerCase();
  const zone = normalizeZone(householdZoneFilter?.value || 'all');
  const yearFilter = String(selectedYear || '').trim();

  return state.rows.filter((row) => {
    const householdId = String(row.household_id || '');
    const updatedText = formatUpdatedDate(row.updated_at);
    const rowZoneLabel = normalizeZoneLabel(row.zone);
    const searchText = `${householdId} ${row.head_name} ${rowZoneLabel} ${updatedText}`.toLowerCase();
    const rowZone = normalizeZone(rowZoneLabel);
    const rowYear = String(getHouseholdRowYear(row) || '');

    const matchesSearch = !term || searchText.includes(term);
    const matchesZone = zone === 'all' || rowZone === zone;
    const matchesYear = yearFilter === '' || rowYear === yearFilter;
    return matchesSearch && matchesZone && matchesYear;
  });
};

const updateAddHouseholdLink = () => {
  if (!addHouseholdBtn) return;
  const selectedYear = Number.parseInt(getSelectedYear(), 10) || currentYear;
  addHouseholdBtn.setAttribute('href', `registration.php?year=${encodeURIComponent(String(selectedYear))}`);
};

const renderHouseholdTable = () => {
  if (!householdsTableBody) return;

  if (state.loading) {
    setLoadingState();
    return;
  }

  if (state.error) {
    setErrorState(state.error);
    return;
  }

  const selectedYear = getSelectedYear();
  const filteredRows = getFilteredRows(selectedYear);

  const rowsHtml = filteredRows
    .map((row) => {
      const householdId = String(row.household_id || '');
      const displayHouseholdId = householdId;
      const headName = String(row.head_name || '-');
      const zoneLabel = normalizeZoneLabel(row.zone) || '-';
      const zoneKey = normalizeZone(zoneLabel);
      const memberCount = Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : 0;
      const baseUpdated = formatUpdatedDate(row.updated_at);
      const displayUpdated = baseUpdated;

      return `
        <tr data-household-id="${escapeHtml(householdId)}" data-base-household-id="${escapeHtml(householdId)}" data-zone="${escapeHtml(zoneKey)}">
          <td>${escapeHtml(displayHouseholdId || '-')}</td>
          <td>${escapeHtml(headName)}</td>
          <td>${escapeHtml(zoneLabel)}</td>
          <td>${escapeHtml(String(memberCount))}</td>
          <td>${escapeHtml(displayUpdated)}</td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-sm view-household"
              data-id="${escapeHtml(displayHouseholdId)}"
              data-base-id="${escapeHtml(householdId)}"
              data-head="${escapeHtml(headName)}"
              data-zone="${escapeHtml(zoneLabel)}"
              data-members="${escapeHtml(String(memberCount))}"
              data-status="Synced"
              data-updated="${escapeHtml(displayUpdated)}"
              data-base-updated="${escapeHtml(baseUpdated)}"
              data-address="${escapeHtml(zoneLabel)}">
              <i class="bi bi-eye"></i> View
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  householdsTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="householdsEmptyRow" class="${filteredRows.length === 0 ? '' : 'd-none'}">
      <td colspan="6" class="text-center text-muted">No households found.</td>
    </tr>
  `;
};

const fetchHouseholdYears = async () => {
  const params = new URLSearchParams({
    action: 'list_household_years'
  });
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

  if (!response.ok || !payload || payload.success !== true) {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to load household years (${response.status}).`;
    throw new Error(message);
  }

  return normalizeAvailableYears(payload?.data?.years);
};

const fetchHouseholds = async () => {
  const params = new URLSearchParams({
    action: 'list_households',
    limit: String(HOUSEHOLD_FETCH_LIMIT),
    offset: '0'
  });
  const selectedYear = normalizeYearFilterValue(getSelectedYear());
  if (selectedYear) {
    params.set('year', selectedYear);
  }
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

  if (!response.ok || !payload || payload.success !== true) {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to load households (${response.status}).`;
    throw new Error(message);
  }

  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return {
    items: items.map((item) => ({
      household_id: String(item?.household_id || ''),
      record_year: Number(item?.record_year || 0),
      head_name: String(item?.head_name || ''),
      zone: normalizeZoneLabel(item?.zone),
      member_count: Number(item?.member_count || 0),
      updated_at: String(item?.updated_at || ''),
      source: String(item?.source || '')
    }))
  };
};

async function loadHouseholds() {
  state.loading = true;
  state.error = '';
  renderHouseholdTable();

  try {
    const payload = await fetchHouseholds();
    state.rows = Array.isArray(payload?.items) ? payload.items : [];
    ensureYearOptions(state.rows, state.years);
    ensureZoneOptions(state.rows);
    updateAddHouseholdLink();
    syncHouseholdsUrlState();
  } catch (error) {
    state.rows = [];
    state.error = error instanceof Error ? error.message : 'Unable to load households.';
    ensureYearOptions([], state.years);
    ensureZoneOptions([]);
    updateAddHouseholdLink();
  } finally {
    state.loading = false;
    renderHouseholdTable();
  }
}

async function initializeHouseholds() {
  try {
    state.years = await fetchHouseholdYears();
  } catch (error) {
    state.years = [];
  }

  ensureYearOptions([], state.years);
  ensureZoneOptions([]);
  updateAddHouseholdLink();
  syncHouseholdsUrlState();
  await loadHouseholds();
}

const populateEditModal = (dataset) => {
  if (!editModal || !canEdit) return;
  const { id, head, zone, members, status, address } = dataset || {};
  if (editHouseholdId) editHouseholdId.textContent = id || 'HH-';
  if (editHouseholdHead) editHouseholdHead.value = head || '';
  if (editHouseholdZone) editHouseholdZone.value = zone || '';
  if (editHouseholdMembers) editHouseholdMembers.value = members || '';
  if (editHouseholdStatus) editHouseholdStatus.value = status || 'Pending';
  if (editHouseholdAddress) editHouseholdAddress.value = address || '';
  householdModal?.hide();
  editModal.show();
};

const triggerDeleteModal = (dataset) => {
  if (!deleteModal || !canEdit) return;
  const { id } = dataset || {};
  if (deleteHouseholdId) deleteHouseholdId.textContent = id || 'HH-';
  householdModal?.hide();
  deleteModal.show();
};

document.addEventListener('click', (event) => {
  const viewBtn = event.target.closest('.view-household');
  if (viewBtn) {
    const baseId = viewBtn.dataset.baseId || viewBtn.dataset.id || '';
    if (baseId) {
      try {
        sessionStorage.setItem('selectedHouseholdId', baseId);
      } catch (error) {
        // Ignore storage errors.
      }
    }
    const params = new URLSearchParams();
    if (baseId) params.set('id', baseId);
    if (resolvedRole) params.set('role', resolvedRole);
    const selectedYear = normalizeYearFilterValue(getSelectedYear());
    if (selectedYear) params.set('year', selectedYear);
    window.location.href = `household-view.php${params.toString() ? `?${params.toString()}` : ''}`;
    return;
  }

  const editBtn = event.target.closest('.edit-household');
  if (editBtn) {
    if (!canEdit) return;
    const { id, head, zone, members, status, address } = editBtn.dataset;
    if (editHouseholdId) editHouseholdId.textContent = id || 'HH-';
    if (editHouseholdHead) editHouseholdHead.value = head || '';
    if (editHouseholdZone) editHouseholdZone.value = zone || '';
    if (editHouseholdMembers) editHouseholdMembers.value = members || '';
    if (editHouseholdStatus) editHouseholdStatus.value = status || 'Pending';
    if (editHouseholdAddress) editHouseholdAddress.value = address || '';
    editModal?.show();
    return;
  }

  const deleteBtn = event.target.closest('.delete-household');
  if (deleteBtn) {
    if (!canEdit) return;
    const { id } = deleteBtn.dataset;
    if (deleteHouseholdId) deleteHouseholdId.textContent = id || 'HH-';
    deleteModal?.show();
  }
});

hhModalEditBtn?.addEventListener('click', () => {
  populateEditModal(hhModalEditBtn.dataset);
});

hhModalDeleteBtn?.addEventListener('click', () => {
  triggerDeleteModal(hhModalDeleteBtn.dataset);
});

householdSearchInput?.addEventListener('input', renderHouseholdTable);
householdZoneFilter?.addEventListener('change', renderHouseholdTable);
yearSelect?.addEventListener('change', () => {
  void loadHouseholds();
});

void initializeHouseholds();
