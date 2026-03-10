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
const RESIDENT_FETCH_LIMIT = 1000;

const state = {
  rows: [],
  loading: false,
  error: '',
  detailsCache: new Map()
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

const extractResidentYear = (value) => {
  const match = String(value || '').match(/^RS-(\d{4})-/i);
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const extractHouseholdYear = (value) => {
  const match = String(value || '').match(/^HH-(\d{4})-/i);
  if (!match) return 0;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isInteger(parsed) ? parsed : 0;
};

const getResidentRowYear = (row) => {
  const fromResidentCode = extractResidentYear(row?.resident_id);
  if (fromResidentCode > 0) return fromResidentCode;
  const fromHouseholdCode = extractHouseholdYear(row?.household_id);
  if (fromHouseholdCode > 0) return fromHouseholdCode;
  return extractYearFromDate(row?.updated_at);
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

const normalizeText = (value) => String(value ?? '').trim();

const toYesNoOrDash = (value, fallback = '-') => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const lowered = normalized.toLowerCase();
  if (lowered === 'true') return 'Yes';
  if (lowered === 'false') return 'No';
  return normalized;
};

const isAffirmativeValue = (value) => {
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'yes' || normalized === 'true' || normalized === '1';
};

const joinNameParts = (source) => {
  if (!source || typeof source !== 'object') return '';
  const parts = [
    source.first_name,
    source.middle_name,
    source.last_name,
    source.extension_name
  ].map((part) => normalizeText(part)).filter(Boolean);
  return parts.join(' ');
};

const currentYear = new Date().getFullYear();
const yearSelect = document.getElementById('yearSelect');
const ensureYearOptions = (rows = []) => {
  if (!yearSelect) return;
  const currentValue = String(yearSelect.value || '').trim();
  const yearSet = new Set([currentYear]);
  rows.forEach((row) => {
    const year = getResidentRowYear(row);
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
  } else {
    yearSelect.value = String(currentYear);
  }
};
let currentResidentDisplayYear = String(yearSelect?.value || currentYear);

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromQuery || roleFromStorage || roleFromBody || 'captain';
if (roleFromQuery) {
  try {
    sessionStorage.setItem('userRole', roleFromQuery);
  } catch (error) {
    // Ignore storage access errors.
  }
}
document.body.dataset.role = resolvedRole;

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && (resolvedRole === 'secretary' || resolvedRole === 'admin')) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = resolvedRole === 'secretary' || resolvedRole === 'admin';
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Residents | ${dashboardLabel}`;

const refreshBtn = document.getElementById('refreshBtn');
const refreshModalEl = document.getElementById('refreshModal');
const refreshModal = refreshModalEl ? new bootstrap.Modal(refreshModalEl) : null;
if (refreshBtn && refreshModal) {
  refreshBtn.addEventListener('click', () => {
    refreshModal.show();
    void loadResidents();
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

const quickFilterButtons = document.querySelectorAll('.resident-filter-pill[data-filter]');
const residentsTableBody = document.getElementById('residentsTableBody') || document.querySelector('.module-table tbody');
const residentSearchInput = document.getElementById('residentSearchInput');
const residentZoneFilter = document.getElementById('residentZoneFilter');
const residentVisibleCount = document.getElementById('residentVisibleCount');
const residentDetailsModalEl = document.getElementById('residentDetailsModal');
const residentDetailsModal = residentDetailsModalEl ? new bootstrap.Modal(residentDetailsModalEl) : null;
const residentEditBtn = document.getElementById('residentEditBtn');
const residentDeleteBtn = document.getElementById('residentDeleteBtn');
const residentDeleteConfirmModalEl = document.getElementById('residentDeleteConfirmModal');
const residentDeleteConfirmModal = residentDeleteConfirmModalEl ? new bootstrap.Modal(residentDeleteConfirmModalEl) : null;
const residentDeleteConfirmTitleEl = document.getElementById('residentDeleteConfirmTitle');
const residentDeleteConfirmTargetEl = document.getElementById('residentDeleteConfirmTarget');
const residentDeleteConfirmBtn = document.getElementById('residentDeleteConfirmBtn');

let activeQuickFilter = 'all';
let activeResidentAction = null;

const ensureZoneOptions = (rows = []) => {
  if (!residentZoneFilter) return;
  const currentValue = normalizeZone(residentZoneFilter.value || 'all') || 'all';
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

  residentZoneFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = 'all';
  allOption.textContent = 'All Zones';
  residentZoneFilter.appendChild(allOption);

  zones.forEach(([key, label]) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    residentZoneFilter.appendChild(option);
  });

  const hasCurrent = currentValue === 'all' || zoneMap.has(currentValue);
  residentZoneFilter.value = hasCurrent ? currentValue : 'all';
};

const setVisibleCount = (count, forceText = '') => {
  if (!residentVisibleCount) return;
  if (forceText) {
    residentVisibleCount.textContent = forceText;
    return;
  }
  residentVisibleCount.textContent = `${count} record${count === 1 ? '' : 's'}`;
};

const setActiveQuickFilter = (filter) => {
  activeQuickFilter = filter || 'all';
  quickFilterButtons.forEach((button) => {
    const isActive = (button.dataset.filter || 'all') === activeQuickFilter;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
};

const setResidentActionButtonsState = (enabled) => {
  const allowActions = isAdminRole;
  [residentEditBtn, residentDeleteBtn].forEach((button) => {
    if (!button) return;
    button.disabled = !allowActions || !enabled;
  });
};

const rowMatchesQuickFilter = (row, filter) => {
  const sex = normalizeText(row.sex).toLowerCase();
  if (filter === 'male') return sex === 'male';
  if (filter === 'female') return sex === 'female';
  if (filter === 'senior') return row.isSenior === true;
  if (filter === 'pwd') return row.isPwd === true;
  if (filter === 'pregnant') return row.isPregnant === true;
  return true;
};

const getFilteredRows = (displayYear) => {
  const term = normalizeText(residentSearchInput?.value).toLowerCase();
  const zone = normalizeZone(residentZoneFilter?.value || 'all');
  const yearFilter = String(displayYear || '').trim();

  return state.rows.filter((row) => {
    const displayResidentId = normalizeText(row.resident_id);
    const displayHouseholdId = normalizeText(row.household_id);
    const displayUpdated = formatUpdatedDate(row.updated_at);
    const rowZoneLabel = normalizeZoneLabel(row.zone);
    const searchText = `${displayResidentId} ${row.full_name} ${displayHouseholdId} ${rowZoneLabel} ${displayUpdated}`.toLowerCase();
    const rowZone = normalizeZone(rowZoneLabel);
    const rowYear = String(getResidentRowYear(row) || '');

    const matchesQuick = rowMatchesQuickFilter(row, activeQuickFilter);
    const matchesSearch = !term || searchText.includes(term);
    const matchesZone = zone === 'all' || rowZone === zone;
    const matchesYear = yearFilter === '' || rowYear === yearFilter;
    return matchesQuick && matchesSearch && matchesZone && matchesYear;
  });
};

const setLoadingState = () => {
  if (!residentsTableBody) return;
  residentsTableBody.innerHTML = `
    <tr id="residentsLoadingRow">
      <td colspan="8" class="text-center text-muted">Loading residents...</td>
    </tr>
    <tr id="residentsEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No residents found.</td>
    </tr>
  `;
  setVisibleCount(0, 'Loading...');
};

const setErrorState = (message) => {
  if (!residentsTableBody) return;
  const safeMessage = escapeHtml(message || 'Failed to load residents.');
  residentsTableBody.innerHTML = `
    <tr id="residentsErrorRow">
      <td colspan="8" class="text-center text-danger">${safeMessage}</td>
    </tr>
    <tr id="residentsEmptyRow" class="d-none">
      <td colspan="8" class="text-center text-muted">No residents found.</td>
    </tr>
  `;
  setVisibleCount(0);
};

const renderResidentsTable = () => {
  if (!residentsTableBody) return;

  if (state.loading) {
    setLoadingState();
    return;
  }

  if (state.error) {
    setErrorState(state.error);
    return;
  }

  const displayYear = currentResidentDisplayYear || String(currentYear);
  const filteredRows = getFilteredRows(displayYear);

  const rowsHtml = filteredRows
    .map((row) => {
      const residentId = normalizeText(row.resident_id);
      const householdId = normalizeText(row.household_id);
      const displayResidentId = residentId;
      const displayHouseholdId = householdId;
      const displayUpdated = formatUpdatedDate(row.updated_at);
      const sex = normalizeText(row.sex) || '-';
      const age = normalizeText(row.age) || '-';
      const fullName = normalizeText(row.full_name) || '-';
      const zone = normalizeZoneLabel(row.zone) || '-';
      const zoneKey = normalizeZone(zone);

      return `
        <tr
          data-resident-id="${escapeHtml(displayResidentId)}"
          data-base-resident-id="${escapeHtml(residentId)}"
          data-sex="${escapeHtml(sex)}"
          data-senior="${row.isSenior ? 'true' : 'false'}"
          data-pwd="${row.isPwd ? 'true' : 'false'}"
          data-pregnant="${row.isPregnant ? 'true' : 'false'}"
          data-zone="${escapeHtml(zoneKey)}"
          data-source-type="${escapeHtml(normalizeText(row.source_type).toLowerCase())}"
          data-member-order="${Number.isInteger(row.member_order) ? row.member_order : 0}"
          data-base-household-id="${escapeHtml(householdId)}">
          <td>${escapeHtml(displayResidentId || '-')}</td>
          <td>${escapeHtml(fullName)}</td>
          <td>${escapeHtml(age)}</td>
          <td>${escapeHtml(sex)}</td>
          <td>${escapeHtml(displayHouseholdId || '-')}</td>
          <td>${escapeHtml(zone)}</td>
          <td>${escapeHtml(displayUpdated)}</td>
          <td class="text-end">
            <button class="btn btn-outline-primary btn-sm resident-view-btn"
              data-resident-id="${escapeHtml(displayResidentId)}"
              data-base-resident-id="${escapeHtml(residentId)}">
              <i class="bi bi-eye"></i> View
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  residentsTableBody.innerHTML = `
    ${rowsHtml}
    <tr id="residentsEmptyRow" class="${filteredRows.length === 0 ? '' : 'd-none'}">
      <td colspan="8" class="text-center text-muted">No residents found.</td>
    </tr>
  `;
  setVisibleCount(filteredRows.length);
};

const normalizeResidentListItem = (item) => {
  const ageText = normalizeText(item?.age);
  const ageNumber = Number.parseInt(ageText, 10);
  const memberOrderRaw = Number.parseInt(normalizeText(item?.member_order), 10);
  const memberOrder = Number.isInteger(memberOrderRaw) ? memberOrderRaw : 0;
  const sourceType = normalizeText(item?.source_type).toLowerCase();
  const pwdValue = normalizeText(item?.pwd);
  const pregnantValue = normalizeText(item?.pregnant);

  return {
    resident_id: normalizeText(item?.resident_id),
    household_id: normalizeText(item?.household_id),
    source_type: sourceType || (memberOrder === 0 ? 'head' : 'member'),
    member_order: memberOrder,
    full_name: normalizeText(item?.full_name),
    relation_to_head: normalizeText(item?.relation_to_head),
    sex: normalizeText(item?.sex),
    age: ageText,
    zone: normalizeZoneLabel(item?.zone),
    updated_at: normalizeText(item?.updated_at),
    isSenior: Number.isInteger(ageNumber) && ageNumber >= 60,
    isPwd: isAffirmativeValue(pwdValue),
    isPregnant: isAffirmativeValue(pregnantValue)
  };
};

const fetchResidentsPage = async (offset = 0) => {
  const params = new URLSearchParams({
    action: 'list_residents',
    limit: String(RESIDENT_FETCH_LIMIT),
    offset: String(Math.max(0, Number.parseInt(String(offset), 10) || 0))
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
      : `Failed to load residents (${response.status}).`;
    throw new Error(message);
  }

  return Array.isArray(payload?.data?.items) ? payload.data.items : [];
};

const fetchResidents = async () => {
  const rows = [];
  let offset = 0;
  let pageCount = 0;

  while (pageCount < 50) {
    const items = await fetchResidentsPage(offset);
    rows.push(...items.map(normalizeResidentListItem));
    pageCount += 1;

    if (items.length < RESIDENT_FETCH_LIMIT) {
      break;
    }
    offset += RESIDENT_FETCH_LIMIT;
  }

  return rows;
};

async function loadResidents() {
  state.loading = true;
  state.error = '';
  renderResidentsTable();

  try {
    state.rows = await fetchResidents();
    ensureYearOptions(state.rows);
    ensureZoneOptions(state.rows);
    currentResidentDisplayYear = String(yearSelect?.value || currentYear);
  } catch (error) {
    state.rows = [];
    state.error = error instanceof Error ? error.message : 'Unable to load residents.';
    ensureYearOptions([]);
    ensureZoneOptions([]);
    currentResidentDisplayYear = String(yearSelect?.value || currentYear);
  } finally {
    state.loading = false;
    renderResidentsTable();
  }
}

const setResidentText = (id, value, fallback = '-') => {
  const element = document.getElementById(id);
  if (!element) return;
  if (value === undefined || value === null) {
    element.textContent = fallback;
    return;
  }
  const normalized = normalizeText(value);
  element.textContent = normalized === '' ? fallback : normalized;
};

const joinResidentList = (value) => {
  if (!Array.isArray(value)) return '-';
  const list = value.map((item) => normalizeText(item)).filter(Boolean);
  return list.length > 0 ? list.join(', ') : '-';
};

const toResidentListText = (value) => {
  if (Array.isArray(value)) return joinResidentList(value);
  const normalized = normalizeText(value);
  return normalized || '-';
};

const composeResidentAddress = (zone, barangay, city, province) => {
  const parts = [zone, barangay, city, province]
    .map((value) => normalizeText(value))
    .filter((value) => value && value !== '-');
  return parts.length ? parts.join(', ') : '-';
};

const getRowDetails = (row) => {
  if (!row) return {};
  const cells = row.querySelectorAll('td');
  const residentIdDisplay = normalizeText(row.dataset.residentId || cells[0]?.textContent);
  const householdIdDisplay = normalizeText(cells[4]?.textContent);
  const memberOrderRaw = Number.parseInt(normalizeText(row.dataset.memberOrder), 10);
  return {
    resident_id: residentIdDisplay,
    base_resident_id: normalizeText(row.dataset.baseResidentId || residentIdDisplay),
    full_name: normalizeText(cells[1]?.textContent),
    age: normalizeText(cells[2]?.textContent),
    sex: normalizeText(cells[3]?.textContent),
    household_id: householdIdDisplay,
    base_household_id: normalizeText(row.dataset.baseHouseholdId || householdIdDisplay),
    source_type: normalizeText(row.dataset.sourceType).toLowerCase(),
    member_order: Number.isInteger(memberOrderRaw) ? memberOrderRaw : 0,
    zone: normalizeZoneLabel(cells[5]?.textContent),
    updated: normalizeText(cells[6]?.textContent)
  };
};

const buildResidentDefaults = (rowData = {}) => {
  const zone = normalizeZoneLabel(rowData.zone) || '-';
  const barangay = normalizeText(rowData.barangay) || '-';
  const city = normalizeText(rowData.city) || '-';
  const province = normalizeText(rowData.province) || '-';
  const address = composeResidentAddress(zone, barangay, city, province);

  return {
    resident_id: rowData.base_resident_id || rowData.resident_id || '',
    household_id: rowData.base_household_id || rowData.household_id || '',
    source_type: normalizeText(rowData.source_type).toLowerCase(),
    member_order: Number.isInteger(rowData.member_order) ? rowData.member_order : 0,
    full_name: rowData.full_name || '-',
    relation_to_head: '-',
    birthday: '-',
    age: rowData.age || '-',
    sex: rowData.sex || '-',
    civil_status: '-',
    citizenship: 'Filipino',
    religion: '-',
    blood_type: '-',
    pregnant: 'N/A',
    height: '-',
    weight: '-',
    contact: '-',
    zone,
    barangay,
    city,
    province,
    address,
    education: '-',
    degree: '-',
    school_name: '-',
    school_type: '-',
    dropout: '-',
    osy: '-',
    currently_studying: '-',
    occupation: '-',
    employment_status: '-',
    work_type: '-',
    monthly_income: '-',
    four_ps: '-',
    senior: '-',
    pwd: '-',
    ip: '-',
    voter: '-',
    precinct: '-',
    sss: '-',
    philhealth: '-',
    gsis: '-',
    tin: '-',
    philid: '-',
    driver_license: '-',
    passport: '-',
    num_members: '-',
    num_children: '-',
    partner_name: '-'
  };
};

const normalizeResidentDetails = (rowData, payload) => {
  const defaults = buildResidentDefaults(rowData);
  if (!payload || typeof payload !== 'object') {
    return defaults;
  }

  const residentNode = payload.resident && typeof payload.resident === 'object'
    ? payload.resident
    : {};
  const profile = residentNode.member && typeof residentNode.member === 'object'
    ? residentNode.member
    : residentNode.head && typeof residentNode.head === 'object'
      ? residentNode.head
      : residentNode;

  const fullNameFromProfile = normalizeText(profile.full_name) || joinNameParts(profile);
  const fullName = normalizeText(payload.full_name) || fullNameFromProfile || defaults.full_name;
  const ageValue = normalizeText(payload.age) || normalizeText(profile.age) || defaults.age;
  const ageNumber = Number.parseInt(ageValue, 10);
  const sourceType = (
    normalizeText(payload.source_type)
    || normalizeText(profile.source_type)
    || normalizeText(defaults.source_type)
  ).toLowerCase();
  const payloadMemberOrder = Number.parseInt(normalizeText(payload.member_order), 10);
  const profileMemberOrder = Number.parseInt(normalizeText(profile.member_order), 10);

  const zone = normalizeZoneLabel(payload.zone) || normalizeZoneLabel(profile.zone) || defaults.zone;
  const barangay = normalizeText(profile.barangay) || defaults.barangay;
  const city = normalizeText(profile.city) || defaults.city;
  const province = normalizeText(profile.province) || defaults.province;
  const fallbackAddress = composeResidentAddress(zone, barangay, city, province);

  const details = {
    ...defaults,
    ...profile,
    resident_id: normalizeText(payload.resident_id) || defaults.resident_id,
    household_id: normalizeText(payload.household_id) || normalizeText(profile.household_id) || defaults.household_id,
    source_type: sourceType,
    member_order: Number.isInteger(payloadMemberOrder)
      ? payloadMemberOrder
      : Number.isInteger(profileMemberOrder)
        ? profileMemberOrder
        : defaults.member_order,
    full_name: fullName || defaults.full_name,
    relation_to_head: normalizeText(payload.relation_to_head) || normalizeText(profile.relation_to_head) || defaults.relation_to_head,
    age: ageValue || defaults.age,
    sex: normalizeText(payload.sex) || normalizeText(profile.sex) || defaults.sex,
    zone: zone || defaults.zone,
    barangay,
    city,
    province,
    address: normalizeText(profile.address) || fallbackAddress,
    pregnant: toYesNoOrDash(
      normalizeText(profile.pregnant) || normalizeText(profile.health_maternal_pregnant),
      defaults.pregnant
    ),
    senior: toYesNoOrDash(
      profile.senior !== undefined && profile.senior !== null
        ? profile.senior
        : Number.isInteger(ageNumber) && ageNumber >= 60,
      defaults.senior
    ),
    pwd: toYesNoOrDash(profile.pwd, defaults.pwd),
    ip: toYesNoOrDash(profile.ip, defaults.ip),
    four_ps: toYesNoOrDash(profile.four_ps, defaults.four_ps),
    voter: toYesNoOrDash(profile.voter, defaults.voter)
  };

  return details;
};

const fetchResidentDetails = async (residentId) => {
  const residentCode = normalizeText(residentId);
  if (!residentCode) {
    throw new Error('resident_id is required.');
  }

  const params = new URLSearchParams({
    action: 'get_resident',
    resident_id: residentCode
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

  if (!response.ok || !payload || payload.success !== true || !payload.data || typeof payload.data !== 'object') {
    const message = payload && payload.error
      ? String(payload.error)
      : `Failed to load resident details (${response.status}).`;
    throw new Error(message);
  }

  return payload.data;
};

const postResidentAction = async (payload) => {
  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });

  let result = null;
  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (!response.ok || !result || result.success !== true) {
    const message = result && result.error
      ? String(result.error)
      : `Unable to complete request (${response.status}).`;
    throw new Error(message);
  }

  return result;
};

const resolveResidentActionMode = (context) => {
  const sourceType = normalizeText(context?.sourceType).toLowerCase();
  const memberOrderRaw = Number.parseInt(String(context?.memberOrder ?? ''), 10);
  const memberOrder = Number.isInteger(memberOrderRaw) ? memberOrderRaw : null;

  if (sourceType === 'head') return 'head';
  if (sourceType === 'member') return 'member';
  if (memberOrder === 0) return 'head';
  if (memberOrder !== null && memberOrder > 0) return 'member';
  return 'member';
};

const buildResidentActionContext = (details, rowData) => {
  const memberOrderRaw = Number.parseInt(String(details.member_order ?? rowData.member_order ?? ''), 10);
  return {
    sourceType: normalizeText(details.source_type || rowData.source_type).toLowerCase(),
    memberOrder: Number.isInteger(memberOrderRaw) ? memberOrderRaw : 0,
    residentCode: normalizeText(rowData.base_resident_id || details.resident_id || rowData.resident_id),
    householdCode: normalizeText(rowData.base_household_id || details.household_id || rowData.household_id),
    residentLabel: normalizeText(details.resident_id || rowData.resident_id),
    householdLabel: normalizeText(details.household_id || rowData.household_id)
  };
};

const confirmResidentDelete = (options) => {
  const isHouseholdDelete = options?.isHouseholdDelete === true;
  const targetLabel = normalizeText(options?.targetLabel) || '-';
  const fallbackMessage = isHouseholdDelete
    ? `Delete household ${targetLabel}? This action cannot be undone.`
    : `Delete resident ${targetLabel}? This action cannot be undone.`;

  if (!residentDeleteConfirmModal || !residentDeleteConfirmModalEl || !residentDeleteConfirmTitleEl || !residentDeleteConfirmTargetEl || !residentDeleteConfirmBtn) {
    return Promise.resolve(window.confirm(fallbackMessage));
  }

  residentDeleteConfirmTitleEl.textContent = isHouseholdDelete ? 'Delete Household' : 'Delete Resident';
  residentDeleteConfirmTargetEl.textContent = targetLabel;

  return new Promise((resolve) => {
    let resolved = false;

    const cleanup = () => {
      residentDeleteConfirmBtn.removeEventListener('click', handleConfirm);
      residentDeleteConfirmModalEl.removeEventListener('hidden.bs.modal', handleHidden);
    };

    const handleConfirm = () => {
      resolved = true;
      cleanup();
      residentDeleteConfirmModal.hide();
      resolve(true);
    };

    const handleHidden = () => {
      cleanup();
      if (!resolved) {
        resolve(false);
      }
    };

    residentDeleteConfirmBtn.addEventListener('click', handleConfirm);
    residentDeleteConfirmModalEl.addEventListener('hidden.bs.modal', handleHidden);
    residentDeleteConfirmModal.show();
  });
};

const openResidentEditor = () => {
  if (!isAdminRole || !activeResidentAction) return;
  const householdCode = normalizeText(activeResidentAction.householdCode);
  if (!householdCode) {
    window.alert('Unable to open edit form for this resident.');
    return;
  }

  const mode = resolveResidentActionMode(activeResidentAction);
  const nextUrl = new URL('registration.php', window.location.href);
  nextUrl.searchParams.set('edit', householdCode);
  residentDetailsModal?.hide();
  window.location.href = mode === 'member' ? `${nextUrl.toString()}#members` : nextUrl.toString();
};

const deleteResidentFromModal = async () => {
  if (!isAdminRole || !activeResidentAction) return;
  const mode = resolveResidentActionMode(activeResidentAction);
  const residentCode = normalizeText(activeResidentAction.residentCode);
  const householdCode = normalizeText(activeResidentAction.householdCode);
  const residentLabel = normalizeText(activeResidentAction.residentLabel || residentCode) || 'this resident';
  const householdLabel = normalizeText(activeResidentAction.householdLabel || householdCode) || 'this household';

  const isHeadDelete = mode === 'head';
  if (isHeadDelete && householdCode === '') {
    window.alert('Unable to determine household id for this resident.');
    return;
  }
  if (!isHeadDelete && residentCode === '') {
    window.alert('Unable to determine resident id.');
    return;
  }

  const confirmed = await confirmResidentDelete({
    isHouseholdDelete: isHeadDelete,
    targetLabel: isHeadDelete ? householdLabel : residentLabel
  });
  if (!confirmed) {
    return;
  }

  const payload = isHeadDelete
    ? { action: 'delete_household', household_id: householdCode }
    : { action: 'delete_member', resident_id: residentCode };

  setResidentActionButtonsState(false);
  try {
    await postResidentAction(payload);
    if (isHeadDelete) {
      state.detailsCache.clear();
    } else {
      state.detailsCache.delete(residentCode);
    }
    residentDetailsModal?.hide();
    await loadResidents();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete resident right now.';
    window.alert(message);
  } finally {
    setResidentActionButtonsState(Boolean(activeResidentAction));
  }
};

const populateResidentModal = (details, loadErrorMessage = '') => {
  const relation = normalizeText(details.relation_to_head) || '-';
  const residentLabel = normalizeText(details.resident_id) || '-';
  const householdLabel = normalizeText(details.household_id) || '-';
  const headerLine = `Relation: ${relation} | Resident ID: ${residentLabel} | Household: ${householdLabel}`;
  setResidentText('rdRelation', loadErrorMessage ? `${headerLine} | Limited details` : headerLine);

  const fieldMap = [
    ['rdName', 'full_name'],
    ['rdRelationToHeadValue', 'relation_to_head'],
    ['rdBirthday', 'birthday'],
    ['rdAge', 'age'],
    ['rdSex', 'sex'],
    ['rdCivilStatus', 'civil_status'],
    ['rdCitizenship', 'citizenship'],
    ['rdReligion', 'religion'],
    ['rdBloodType', 'blood_type'],
    ['rdPregnant', 'pregnant'],
    ['rdHeight', 'height'],
    ['rdWeight', 'weight'],
    ['rdContact', 'contact'],
    ['rdZone', 'zone'],
    ['rdBarangay', 'barangay'],
    ['rdCity', 'city'],
    ['rdProvince', 'province'],
    ['rdAddress', 'address'],
    ['rdEducation', 'education'],
    ['rdDegree', 'degree'],
    ['rdSchoolName', 'school_name'],
    ['rdSchoolType', 'school_type'],
    ['rdDropout', 'dropout'],
    ['rdOSY', 'osy'],
    ['rdCurrentlyStudying', 'currently_studying'],
    ['rdOccupation', 'occupation'],
    ['rdEmploymentStatus', 'employment_status'],
    ['rdWorkType', 'work_type'],
    ['rdMonthlyIncome', 'monthly_income'],
    ['rd4ps', 'four_ps'],
    ['rdSenior', 'senior'],
    ['rdPWD', 'pwd'],
    ['rdIP', 'ip'],
    ['rdVoter', 'voter'],
    ['rdPrecinct', 'precinct'],
    ['rdSSS', 'sss'],
    ['rdPhilhealth', 'philhealth'],
    ['rdGSIS', 'gsis'],
    ['rdTIN', 'tin'],
    ['rdPhilID', 'philid'],
    ['rdDriverLicense', 'driver_license'],
    ['rdPassport', 'passport'],
    ['rdNumMembers', 'num_members'],
    ['rdRelationToHead', 'relation_to_head'],
    ['rdNumChildren', 'num_children'],
    ['rdPartnerName', 'partner_name']
  ];

  fieldMap.forEach(([elementId, key]) => {
    setResidentText(elementId, details[key]);
  });

};

const openResidentDetails = async (residentId, row) => {
  const rowData = getRowDetails(row);
  const baseResidentId = normalizeText(residentId) || rowData.base_resident_id;
  let detailsPayload = null;
  let loadErrorMessage = '';

  try {
    if (state.detailsCache.has(baseResidentId)) {
      detailsPayload = state.detailsCache.get(baseResidentId);
    } else {
      detailsPayload = await fetchResidentDetails(baseResidentId);
      state.detailsCache.set(baseResidentId, detailsPayload);
    }
  } catch (error) {
    loadErrorMessage = error instanceof Error ? error.message : 'Unable to load full resident details.';
  }

  const details = normalizeResidentDetails(rowData, detailsPayload);
  details.resident_id = normalizeText(details.resident_id) || rowData.base_resident_id || rowData.resident_id || '';
  details.household_id = normalizeText(details.household_id) || rowData.base_household_id || rowData.household_id || '';

  activeResidentAction = buildResidentActionContext(details, rowData);
  setResidentActionButtonsState(Boolean(activeResidentAction));
  populateResidentModal(details, loadErrorMessage);
  residentDetailsModal?.show();
};

residentEditBtn?.addEventListener('click', openResidentEditor);
residentDeleteBtn?.addEventListener('click', () => {
  void deleteResidentFromModal();
});
residentDetailsModalEl?.addEventListener('hidden.bs.modal', () => {
  activeResidentAction = null;
  setResidentActionButtonsState(false);
});

quickFilterButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setActiveQuickFilter(button.dataset.filter || 'all');
    renderResidentsTable();
  });
});

residentSearchInput?.addEventListener('input', renderResidentsTable);
residentZoneFilter?.addEventListener('change', renderResidentsTable);
yearSelect?.addEventListener('change', () => {
  currentResidentDisplayYear = String(yearSelect?.value || currentYear);
  renderResidentsTable();
});

if (residentsTableBody) {
  residentsTableBody.addEventListener('click', (event) => {
    const viewButton = event.target.closest('.resident-view-btn');
    if (!viewButton) return;

    const row = viewButton.closest('tr');
    if (!row || row.id === 'residentsEmptyRow' || row.id === 'residentsLoadingRow') return;

    const baseResidentId = normalizeText(viewButton.dataset.baseResidentId || row.dataset.baseResidentId);
    if (!baseResidentId) return;

    void openResidentDetails(baseResidentId, row);
  });
}

setResidentActionButtonsState(false);
setActiveQuickFilter('all');
ensureYearOptions([]);
ensureZoneOptions([]);
void loadResidents();
