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
const RESIDENT_BASE_YEAR = '2026';
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

const replaceResidentIdYear = (value, year) => {
  return String(value || '').replace(/^RS-\d{4}(-\d+)$/i, `RS-${String(year)}$1`);
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
let currentResidentDisplayYear = String(yearSelect?.value || currentYear);

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = '2026';
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

const reportsLink = document.querySelector('.menu a[href="reports.php"]');
if (reportsLink && isAdminRole) {
  reportsLink.setAttribute('href', 'admin-reports.php');
}

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

let activeQuickFilter = 'all';

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

  return state.rows.filter((row) => {
    const displayResidentId = replaceResidentIdYear(row.resident_id, displayYear);
    const displayHouseholdId = replaceHouseholdIdYear(row.household_id, displayYear);
    const displayUpdated = replaceFirstYearToken(formatUpdatedDate(row.updated_at), displayYear);
    const searchText = `${displayResidentId} ${row.full_name} ${displayHouseholdId} ${row.zone} ${displayUpdated}`.toLowerCase();
    const rowZone = normalizeZone(row.zone);

    const matchesQuick = rowMatchesQuickFilter(row, activeQuickFilter);
    const matchesSearch = !term || searchText.includes(term);
    const matchesZone = zone === 'all' || rowZone === zone;
    return matchesQuick && matchesSearch && matchesZone;
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
      const displayResidentId = replaceResidentIdYear(residentId, displayYear);
      const displayHouseholdId = replaceHouseholdIdYear(householdId, displayYear);
      const displayUpdated = replaceFirstYearToken(formatUpdatedDate(row.updated_at), displayYear);
      const sex = normalizeText(row.sex) || '-';
      const age = normalizeText(row.age) || '-';
      const fullName = normalizeText(row.full_name) || '-';
      const zone = normalizeText(row.zone) || '-';
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

const fetchResidents = async () => {
  const params = new URLSearchParams({
    action: 'list_residents',
    limit: String(RESIDENT_FETCH_LIMIT),
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
      : `Failed to load residents (${response.status}).`;
    throw new Error(message);
  }

  const items = Array.isArray(payload?.data?.items) ? payload.data.items : [];
  return items.map((item) => {
    const ageText = normalizeText(item?.age);
    const ageNumber = Number.parseInt(ageText, 10);
    return {
      resident_id: normalizeText(item?.resident_id),
      household_id: normalizeText(item?.household_id),
      full_name: normalizeText(item?.full_name),
      relation_to_head: normalizeText(item?.relation_to_head),
      sex: normalizeText(item?.sex),
      age: ageText,
      zone: normalizeText(item?.zone),
      updated_at: normalizeText(item?.updated_at),
      source_type: normalizeText(item?.source_type),
      isSenior: Number.isInteger(ageNumber) && ageNumber >= 60,
      isPwd: false,
      isPregnant: false
    };
  });
};

async function loadResidents() {
  state.loading = true;
  state.error = '';
  renderResidentsTable();

  try {
    state.rows = await fetchResidents();
  } catch (error) {
    state.rows = [];
    state.error = error instanceof Error ? error.message : 'Unable to load residents.';
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

const getRowDetails = (row) => {
  if (!row) return {};
  const cells = row.querySelectorAll('td');
  const residentIdDisplay = normalizeText(row.dataset.residentId || cells[0]?.textContent);
  const householdIdDisplay = normalizeText(cells[4]?.textContent);
  return {
    resident_id: residentIdDisplay,
    base_resident_id: normalizeText(row.dataset.baseResidentId || residentIdDisplay),
    full_name: normalizeText(cells[1]?.textContent),
    age: normalizeText(cells[2]?.textContent),
    sex: normalizeText(cells[3]?.textContent),
    household_id: householdIdDisplay,
    base_household_id: normalizeText(row.dataset.baseHouseholdId || householdIdDisplay),
    zone: normalizeText(cells[5]?.textContent),
    updated: normalizeText(cells[6]?.textContent)
  };
};

const buildResidentDefaults = (rowData = {}) => {
  const zone = normalizeText(rowData.zone) || '-';
  const barangay = 'Cabarian';
  const city = 'Ligao City';
  const province = 'Albay';
  const address = zone && zone !== '-'
    ? `${zone}, Barangay ${barangay}, ${city}, ${province}`
    : `Barangay ${barangay}, ${city}, ${province}`;

  return {
    resident_id: rowData.base_resident_id || rowData.resident_id || '',
    household_id: rowData.base_household_id || rowData.household_id || '',
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
    partner_name: '-',
    health_current_illness: '-',
    health_illness_type: '-',
    health_illness_years: '-',
    health_chronic_diseases: [],
    health_common_illnesses: [],
    health_maintenance_meds: '-',
    health_medicine_name: '-',
    health_medicine_frequency: '-',
    health_medicine_source: '-',
    health_maternal_pregnant: '-',
    health_months_pregnant: '-',
    health_prenatal_care: '-',
    health_child_immunized: '-',
    health_child_malnutrition: '-',
    health_child_sick_per_year: '-',
    health_has_disability: '-',
    health_disability_types: [],
    health_disability_regular_care: '-',
    health_smoker: '-',
    health_alcohol_daily: '-',
    health_malnutrition_present: '-',
    health_clean_water: '-',
    health_rhu_visits: '-',
    health_rhu_reason: '-',
    health_has_philhealth: '-',
    health_hospitalized_5yrs: '-',
    health_hospitalized_reason: '-'
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

  const zone = normalizeText(payload.zone) || normalizeText(profile.zone) || defaults.zone;
  const barangay = normalizeText(profile.barangay) || defaults.barangay;
  const city = normalizeText(profile.city) || defaults.city;
  const province = normalizeText(profile.province) || defaults.province;
  const fallbackAddress = zone && zone !== '-'
    ? `${zone}, Barangay ${barangay}, ${city}, ${province}`
    : `Barangay ${barangay}, ${city}, ${province}`;

  const details = {
    ...defaults,
    ...profile,
    resident_id: normalizeText(payload.resident_id) || defaults.resident_id,
    household_id: normalizeText(payload.household_id) || normalizeText(profile.household_id) || defaults.household_id,
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
    voter: toYesNoOrDash(profile.voter, defaults.voter),
    health_chronic_diseases: Array.isArray(profile.health_chronic_diseases) ? profile.health_chronic_diseases : defaults.health_chronic_diseases,
    health_common_illnesses: Array.isArray(profile.health_common_illnesses) ? profile.health_common_illnesses : defaults.health_common_illnesses,
    health_disability_types: Array.isArray(profile.health_disability_types) ? profile.health_disability_types : defaults.health_disability_types
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
    ['rdPartnerName', 'partner_name'],
    ['rdHealthCurrentIllness', 'health_current_illness'],
    ['rdHealthIllnessType', 'health_illness_type'],
    ['rdHealthIllnessYears', 'health_illness_years'],
    ['rdHealthMaintenanceMeds', 'health_maintenance_meds'],
    ['rdHealthMedicineName', 'health_medicine_name'],
    ['rdHealthMedicineFrequency', 'health_medicine_frequency'],
    ['rdHealthMedicineSource', 'health_medicine_source'],
    ['rdHealthMaternalPregnant', 'health_maternal_pregnant'],
    ['rdHealthMonthsPregnant', 'health_months_pregnant'],
    ['rdHealthPrenatalCare', 'health_prenatal_care'],
    ['rdHealthChildImmunized', 'health_child_immunized'],
    ['rdHealthChildMalnutrition', 'health_child_malnutrition'],
    ['rdHealthChildSickPerYear', 'health_child_sick_per_year'],
    ['rdHealthHasDisability', 'health_has_disability'],
    ['rdHealthDisabilityRegularCare', 'health_disability_regular_care'],
    ['rdHealthSmoker', 'health_smoker'],
    ['rdHealthAlcoholDaily', 'health_alcohol_daily'],
    ['rdHealthMalnutritionPresent', 'health_malnutrition_present'],
    ['rdHealthCleanWater', 'health_clean_water'],
    ['rdHealthRhuVisits', 'health_rhu_visits'],
    ['rdHealthRhuReason', 'health_rhu_reason'],
    ['rdHealthHasPhilhealth', 'health_has_philhealth'],
    ['rdHealthHospitalized5yrs', 'health_hospitalized_5yrs'],
    ['rdHealthHospitalizedReason', 'health_hospitalized_reason']
  ];

  fieldMap.forEach(([elementId, key]) => {
    setResidentText(elementId, details[key]);
  });

  setResidentText('rdHealthChronicDiseases', toResidentListText(details.health_chronic_diseases));
  setResidentText('rdHealthCommonIllnesses', toResidentListText(details.health_common_illnesses));
  setResidentText('rdHealthDisabilityTypes', toResidentListText(details.health_disability_types));
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
  details.resident_id = replaceResidentIdYear(
    details.resident_id || rowData.base_resident_id || rowData.resident_id,
    currentResidentDisplayYear || RESIDENT_BASE_YEAR
  );
  details.household_id = replaceHouseholdIdYear(
    details.household_id || rowData.base_household_id || rowData.household_id,
    currentResidentDisplayYear || RESIDENT_BASE_YEAR
  );

  populateResidentModal(details, loadErrorMessage);
  residentDetailsModal?.show();
};

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

setActiveQuickFilter('all');
void loadResidents();
