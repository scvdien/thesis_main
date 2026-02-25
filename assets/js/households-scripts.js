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
const HOUSEHOLD_BASE_YEAR = '2026';
const HOUSEHOLD_FETCH_LIMIT = 500;

const state = {
  rows: [],
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

const replaceHouseholdIdYear = (value, year) => {
  return String(value || '').replace(/^HH-\d{4}(-\d+)$/i, `HH-${String(year)}$1`);
};

const replaceFirstYearToken = (value, year) => {
  return String(value || '').replace(/\b(19|20)\d{2}\b/, String(year));
};

const normalizeZone = (value) => String(value || '').trim().toLowerCase();

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

const currentYear = new Date().getFullYear();
const previousYear = currentYear - 1;
const yearSelect = document.getElementById('yearSelect');
if (yearSelect) {
  yearSelect.innerHTML = '';
  [previousYear, currentYear].forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    yearSelect.appendChild(option);
  });
  yearSelect.value = String(currentYear);
}

const getDisplayYear = () => String(yearSelect?.value || HOUSEHOLD_BASE_YEAR);

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = '2026';
}

const refreshBtn = document.getElementById('refreshBtn');
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

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
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

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && canEdit) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = canEdit;
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Households | ${dashboardLabel}`;

const reportsLink = document.querySelector('.menu a[href="reports.php"]');
if (reportsLink && isAdminRole) {
  reportsLink.setAttribute('href', 'admin-reports.php');
}

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

const getFilteredRows = (displayYear) => {
  const term = String(householdSearchInput?.value || '').trim().toLowerCase();
  const zone = normalizeZone(householdZoneFilter?.value || 'all');

  return state.rows.filter((row) => {
    const displayHouseholdId = replaceHouseholdIdYear(row.household_id, displayYear);
    const updatedText = replaceFirstYearToken(formatUpdatedDate(row.updated_at), displayYear);
    const searchText = `${displayHouseholdId} ${row.head_name} ${row.zone} ${updatedText}`.toLowerCase();
    const rowZone = normalizeZone(row.zone);

    const matchesSearch = !term || searchText.includes(term);
    const matchesZone = zone === 'all' || rowZone === zone;
    return matchesSearch && matchesZone;
  });
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

  const displayYear = getDisplayYear();
  const filteredRows = getFilteredRows(displayYear);

  const rowsHtml = filteredRows
    .map((row) => {
      const householdId = String(row.household_id || '');
      const displayHouseholdId = replaceHouseholdIdYear(householdId, displayYear);
      const headName = String(row.head_name || '-');
      const zoneLabel = String(row.zone || '-');
      const zoneKey = normalizeZone(zoneLabel);
      const memberCount = Number.isFinite(Number(row.member_count)) ? Number(row.member_count) : 0;
      const baseUpdated = formatUpdatedDate(row.updated_at);
      const displayUpdated = replaceFirstYearToken(baseUpdated, displayYear);

      return `
        <tr data-household-id="${escapeHtml(displayHouseholdId)}" data-base-household-id="${escapeHtml(householdId)}" data-zone="${escapeHtml(zoneKey)}">
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

const fetchHouseholds = async () => {
  const params = new URLSearchParams({
    action: 'list_households',
    limit: String(HOUSEHOLD_FETCH_LIMIT),
    offset: '0'
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
      : `Failed to load households (${response.status}).`;
    throw new Error(message);
  }

  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return items.map((item) => ({
    household_id: String(item?.household_id || ''),
    head_name: String(item?.head_name || ''),
    zone: String(item?.zone || ''),
    member_count: Number(item?.member_count || 0),
    updated_at: String(item?.updated_at || ''),
    source: String(item?.source || '')
  }));
};

async function loadHouseholds() {
  state.loading = true;
  state.error = '';
  renderHouseholdTable();

  try {
    state.rows = await fetchHouseholds();
  } catch (error) {
    state.rows = [];
    state.error = error instanceof Error ? error.message : 'Unable to load households.';
  } finally {
    state.loading = false;
    renderHouseholdTable();
  }
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
yearSelect?.addEventListener('change', renderHouseholdTable);

void loadHouseholds();
