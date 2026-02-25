const sidebar = document.getElementById('sidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
function toggleSidebar() {
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  if (isMobile) {
    sidebar.classList.toggle('open');
    sidebarBackdrop.classList.toggle('show');
    document.body.classList.toggle('sidebar-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}
window.addEventListener('resize', () => {
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  if (!isMobile) {
    sidebar?.classList.remove('open');
    sidebarBackdrop?.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  }
});

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromBody || roleFromQuery || roleFromStorage || 'captain';
if (roleFromQuery) sessionStorage.setItem('userRole', roleFromQuery);
document.body.dataset.role = resolvedRole;
const canEdit = resolvedRole === 'secretary' || resolvedRole === 'admin';
document.body.classList.toggle('role-can-edit', canEdit);

const backLink = document.querySelector('.hv-back-btn');
if (backLink && (resolvedRole === 'secretary' || resolvedRole === 'admin')) {
  backLink.setAttribute('href', `households.php?role=${resolvedRole}`);
}

let currentRecord = null;
let activeMemberIndex = -1;
const HOUSEHOLD_BASE_DATA_YEAR = '2026';
const HOUSEHOLD_API_ENDPOINT = 'registration-sync.php';
const REGISTRATION_HEAD_KEY = 'household_head_data';
const REGISTRATION_MEMBERS_KEY = 'household_members';
const REGISTRATION_MEMBER_EDIT_KEY = 'household_member_edit_index';
let currentDisplayHouseholdId = '';
let currentDisplayYear = HOUSEHOLD_BASE_DATA_YEAR;
const HV_TEMP_MEMBERS_KEY = 'household_view_temp_members';
const HV_TEMP_EDIT_KEY = 'household_view_temp_edit_index';
const HV_CONTEXT_KEY = 'household_view_context';
const HV_RESULT_KEY = 'household_view_edit_result';
const storage = window.createIndexedStorageProxy
  ? window.createIndexedStorageProxy([
      HV_TEMP_MEMBERS_KEY,
      HV_TEMP_EDIT_KEY,
      HV_CONTEXT_KEY,
      HV_RESULT_KEY
    ])
  : window.localStorage;

const memberDetailsModalEl = document.getElementById('memberDetailsModal');
const memberDetailsModal = memberDetailsModalEl ? new bootstrap.Modal(memberDetailsModalEl) : null;

const parseHouseholdId = (value) => {
  const match = String(value || '').match(/^HH-(\d{4})-(\d+)$/i);
  if (!match) return null;
  return { year: match[1], sequence: match[2] };
};

const normalizeHouseholdId = (value) => {
  const parts = parseHouseholdId(value);
  if (!parts) return String(value || '');
  return `HH-${HOUSEHOLD_BASE_DATA_YEAR}-${parts.sequence}`;
};

const applyHouseholdYear = (value, year) => {
  const parts = parseHouseholdId(value);
  if (!parts) return String(value || '');
  return `HH-${String(year || HOUSEHOLD_BASE_DATA_YEAR)}-${parts.sequence}`;
};

const replaceFirstYearToken = (value, year) => {
  return String(value || '').replace(/\b(19|20)\d{2}\b/, String(year || HOUSEHOLD_BASE_DATA_YEAR));
};

// Dummy data (mirrors households-scripts)
const householdData = {
  'HH-2026-118': {
    id: 'HH-2026-118',
    status: 'Verified',
    updated: 'Feb 02, 2026',
    head: {
      name: 'Maria T. Santos',
      age: '42',
      sex: 'Female',
      civilStatus: 'Married',
      birthday: '1984-12-18',
      citizenship: 'Filipino',
      religion: 'Catholic',
      blood: 'O+',
      height: '158 cm',
      weight: '58 kg',
      pregnant: 'No',
      contact: '0917 234 8899',
      address: 'Purok 2, Zone 2',
      zone: 'Zone 2',
      barangay: 'Cabarian',
      city: 'Ligao City',
      province: 'Albay'
    },
    education: {
      attainment: 'College Graduate',
      degree: 'BS Education',
      school: 'Bicol University',
      schoolType: 'Public',
      dropout: 'No',
      osy: 'No',
      studying: 'No'
    },
    employment: {
      occupation: 'Public School Teacher',
      status: 'Employed',
      workType: 'Government',
      income: 'PHP 32,000'
    },
    welfare: { fourPs: 'No', senior: 'No', pwd: 'No', ip: 'No' },
    voter: { registered: 'Yes', precinct: '1234A' },
    ids: {
      sss: '12-3456789-0',
      philhealth: '05-123456789-0',
      gsis: '-',
      tin: '123-456-789',
      philid: 'PN-2026-991122',
      driver: 'N12-34-567890',
      passport: 'P1234567'
    },
    household: {
      numMembers: 5,
      relationToHead: 'Spouse',
      numChildren: 3,
      partnerName: 'Jose P. Santos'
    },
    housing: {
      ownership: 'Owned',
      houseType: 'Concrete',
      toilet: 'Water-sealed (Flush toilet)',
      rooms: '4',
      electricity: 'Yes',
      water: 'Piped water (Direktang linya ng tubig sa bahay)',
      internet: 'Yes'
    },
    health: {
      currentIllness: 'No',
      illnessType: '',
      chronic: ['Hypertension'],
      common: ['Fever'],
      maintenance: 'Yes',
      medicine: 'Losartan 50mg',
      frequency: '1x/day',
      source: 'Pharmacy',
      pregnant: 'No',
      monthsPregnant: '0',
      prenatal: 'N/A',
      childImmunized: 'Yes',
      childMalnutrition: 'No',
      childSick: '1',
      disability: 'No'
    },
    members: [
      { name: 'Maria T. Santos', relation: 'Head', age: 42, sex: 'F' },
      { name: 'Jose P. Santos', relation: 'Spouse', age: 44, sex: 'M' },
      { name: 'Lea T. Santos', relation: 'Child', age: 17, sex: 'F' },
      { name: 'Marco P. Santos', relation: 'Child', age: 14, sex: 'M' },
      { name: 'Miguel P. Santos', relation: 'Child', age: 9, sex: 'M' }
    ]
  },
  'HH-2026-119': {
    id: 'HH-2026-119',
    status: 'Pending',
    updated: 'Jan 28, 2026',
    head: {
      name: 'Rogelio P. Cruz',
      age: '38',
      sex: 'Male',
      civilStatus: 'Married',
      birthday: '1987-03-10',
      citizenship: 'Filipino',
      religion: 'Iglesia ni Cristo',
      blood: 'A+',
      height: '170 cm',
      weight: '70 kg',
      pregnant: 'N/A',
      contact: '0918 556 7788',
      address: 'Purok 1, Zone 1',
      zone: 'Zone 1',
      barangay: 'Cabarian',
      city: 'Ligao City',
      province: 'Albay'
    },
    education: {
      attainment: 'High School Graduate',
      degree: '-',
      school: 'Ligao National HS',
      schoolType: 'Public',
      dropout: 'No',
      osy: 'No',
      studying: 'No'
    },
    employment: {
      occupation: 'Tricycle Driver',
      status: 'Self-employed',
      workType: 'Freelance',
      income: 'PHP 12,000'
    },
    welfare: { fourPs: 'Yes', senior: 'No', pwd: 'No', ip: 'No' },
    voter: { registered: 'Yes', precinct: '2088B' },
    ids: {
      sss: '-',
      philhealth: '08-223344556-1',
      gsis: '-',
      tin: '-',
      philid: 'PN-2026-112233',
      driver: 'N22-11-334455',
      passport: '-'
    },
    household: {
      numMembers: 3,
      relationToHead: 'Spouse',
      numChildren: 1,
      partnerName: 'Ana L. Cruz'
    },
    housing: {
      ownership: 'Rented',
      houseType: 'Mixed',
      toilet: 'Shared toilet',
      rooms: '2',
      electricity: 'Yes',
      water: 'Deep well (Malalim na balon na may pump)',
      internet: 'No'
    },
    health: {
      currentIllness: 'Yes',
      illnessType: 'Type 2 Diabetes',
      chronic: ['Diabetes'],
      common: ['Cough & Cold'],
      maintenance: 'Yes',
      medicine: 'Metformin 500mg',
      frequency: '2x/day',
      source: 'RHU',
      pregnant: 'N/A',
      monthsPregnant: '0',
      prenatal: 'N/A',
      childImmunized: 'Yes',
      childMalnutrition: 'No',
      childSick: '2',
      disability: 'No'
    },
    members: [
      { name: 'Rogelio P. Cruz', relation: 'Head', age: 38, sex: 'M' },
      { name: 'Ana L. Cruz', relation: 'Spouse', age: 36, sex: 'F' },
      { name: 'Leo P. Cruz', relation: 'Child', age: 8, sex: 'M' }
    ]
  },
  'HH-2026-120': {
    id: 'HH-2026-120',
    status: 'Verified',
    updated: 'Jan 21, 2026',
    head: {
      name: 'Lea M. Navarro',
      age: '45',
      sex: 'Female',
      civilStatus: 'Widowed',
      birthday: '1980-08-05',
      citizenship: 'Filipino',
      religion: 'Catholic',
      blood: 'B+',
      height: '156 cm',
      weight: '60 kg',
      pregnant: 'No',
      contact: '0917 998 4411',
      address: 'Purok 4, Zone 4',
      zone: 'Zone 4',
      barangay: 'Cabarian',
      city: 'Ligao City',
      province: 'Albay'
    },
    education: {
      attainment: 'College Graduate',
      degree: 'BS Nursing',
      school: 'Ateneo de Naga',
      schoolType: 'Private',
      dropout: 'No',
      osy: 'No',
      studying: 'No'
    },
    employment: {
      occupation: 'Clinic Nurse',
      status: 'Employed',
      workType: 'Private',
      income: 'PHP 28,000'
    },
    welfare: { fourPs: 'No', senior: 'No', pwd: 'No', ip: 'No' },
    voter: { registered: 'Yes', precinct: '3102C' },
    ids: {
      sss: '34-5566778-9',
      philhealth: '11-556677889-0',
      gsis: '-',
      tin: '456-789-123',
      philid: 'PN-2026-334455',
      driver: 'N33-22-110099',
      passport: 'P7788990'
    },
    household: {
      numMembers: 6,
      relationToHead: 'Children',
      numChildren: 5,
      partnerName: '-'
    },
    housing: {
      ownership: 'Owned',
      houseType: 'Concrete',
      toilet: 'Water-sealed (Flush toilet)',
      rooms: '5',
      electricity: 'Yes',
      water: 'Water refilling station (Binibiling inumin)',
      internet: 'Yes'
    },
    health: {
      currentIllness: 'No',
      illnessType: '',
      chronic: ['Hypertension'],
      common: ['Fever'],
      maintenance: 'Yes',
      medicine: 'Amlodipine 5mg',
      frequency: '1x/day',
      source: 'Pharmacy',
      pregnant: 'No',
      monthsPregnant: '0',
      prenatal: 'N/A',
      childImmunized: 'Yes',
      childMalnutrition: 'No',
      childSick: '1',
      disability: 'No'
    },
    members: [
      { name: 'Lea M. Navarro', relation: 'Head', age: 45, sex: 'F' },
      { name: 'Marco G. Navarro', relation: 'Child', age: 22, sex: 'M' },
      { name: 'Liam Navarro', relation: 'Child', age: 18, sex: 'M' },
      { name: 'Lara M. Navarro', relation: 'Child', age: 16, sex: 'F' },
      { name: 'Liza M. Navarro', relation: 'Child', age: 12, sex: 'F' },
      { name: 'Luis M. Navarro', relation: 'Child', age: 9, sex: 'M' }
    ]
  },
  'HH-2026-121': {
    id: 'HH-2026-121',
    status: 'Unverified',
    updated: 'Jan 18, 2026',
    head: {
      name: 'Jun R. Mateo',
      age: '34',
      sex: 'Male',
      civilStatus: 'Married',
      birthday: '1991-02-14',
      citizenship: 'Filipino',
      religion: 'Catholic',
      blood: 'AB+',
      height: '168 cm',
      weight: '68 kg',
      pregnant: 'N/A',
      contact: '0917 112 3344',
      address: 'Purok 3, Zone 3',
      zone: 'Zone 3',
      barangay: 'Cabarian',
      city: 'Ligao City',
      province: 'Albay'
    },
    education: {
      attainment: 'Vocational Graduate',
      degree: 'Automotive Servicing NCII',
      school: 'TESDA Ligao',
      schoolType: 'Public',
      dropout: 'No',
      osy: 'No',
      studying: 'No'
    },
    employment: {
      occupation: 'Mechanic',
      status: 'Employed',
      workType: 'Private',
      income: 'PHP 18,000'
    },
    welfare: { fourPs: 'Yes', senior: 'No', pwd: 'No', ip: 'No' },
    voter: { registered: 'No', precinct: '' },
    ids: {
      sss: '77-8899001-2',
      philhealth: '15-998877665-4',
      gsis: '-',
      tin: '987-654-321',
      philid: 'PN-2026-556677',
      driver: 'N44-55-667788',
      passport: '-'
    },
    household: {
      numMembers: 4,
      relationToHead: 'Spouse',
      numChildren: 2,
      partnerName: 'Liza P. Mateo'
    },
    housing: {
      ownership: 'Rented',
      houseType: 'Wood',
      toilet: 'Pit latrine',
      rooms: '2',
      electricity: 'Yes',
      water: 'Hand pump / Poso',
      internet: 'No'
    },
    health: {
      currentIllness: 'No',
      illnessType: '',
      chronic: [],
      common: ['Cough & Cold'],
      maintenance: 'No',
      medicine: '',
      frequency: '',
      source: '',
      pregnant: 'N/A',
      monthsPregnant: '0',
      prenatal: 'N/A',
      childImmunized: 'Yes',
      childMalnutrition: 'No',
      childSick: '3',
      disability: 'No'
    },
    members: [
      { name: 'Jun R. Mateo', relation: 'Head', age: 34, sex: 'M' },
      { name: 'Liza P. Mateo', relation: 'Spouse', age: 32, sex: 'F' },
      { name: 'Kurt Mateo', relation: 'Child', age: 10, sex: 'M' },
      { name: 'Kyla Mateo', relation: 'Child', age: 6, sex: 'F' }
    ]
  }
};

const setText = (id, val, fallback = '-') => {
  const el = document.getElementById(id);
  if (!el) return;
  if (val === undefined || val === null) {
    el.textContent = fallback;
    return;
  }
  const normalized = typeof val === 'string' ? val.trim() : val;
  el.textContent = normalized === '' ? fallback : normalized;
};
const joinList = (arr) => (!arr || !arr.length ? '-' : arr.filter(Boolean).join(', '));
const toListText = (value) => {
  if (Array.isArray(value)) return joinList(value);
  if (value === undefined || value === null) return '-';
  const normalized = String(value).trim();
  return normalized || '-';
};
const splitName = (fullName = '') => {
  const chunks = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (!chunks.length) return { first: '', middle: '', last: '' };
  if (chunks.length === 1) return { first: chunks[0], middle: '', last: '' };
  if (chunks.length === 2) return { first: chunks[0], middle: '', last: chunks[1] };
  return {
    first: chunks[0],
    middle: chunks.slice(1, -1).join(' '),
    last: chunks[chunks.length - 1]
  };
};

const buildFullName = (memberData = {}, fallback = '-') => {
  const fullName = [
    memberData.first_name,
    memberData.middle_name,
    memberData.last_name,
    memberData.extension_name
  ].filter(Boolean).join(' ').trim();
  return fullName || fallback;
};

const toFormSex = (sex = '') => {
  const value = String(sex).trim().toUpperCase();
  if (value === 'F') return 'Female';
  if (value === 'M') return 'Male';
  return sex || '';
};

const toMemberSex = (sex = '') => {
  const value = String(sex).trim().toLowerCase();
  if (value === 'female') return 'F';
  if (value === 'male') return 'M';
  if (value === 'f' || value === 'm') return value.toUpperCase();
  return sex || '-';
};

const statusClass = (status = '') => {
  const s = status.toLowerCase();
  if (s.includes('verified')) return 'verified';
  if (s.includes('pending')) return 'pending';
  return 'unverified';
};

const getMemberProfile = (member = {}, record = {}) => {
  const relation = (member.relation || '-').trim();
  const isHead = relation.toLowerCase() === 'head';
  const fallbackCivil = relation.toLowerCase() === 'child' ? 'Single' : '-';

  return {
    name: member.name || '-',
    relation,
    age: member.age ?? '-',
    sex: member.sex || '-',
    civilStatus: member.civilStatus || (isHead ? (record.head?.civilStatus || '-') : fallbackCivil),
    contact: member.contact || (isHead ? (record.head?.contact || '-') : '-'),
    education: member.education || (isHead ? (record.education?.attainment || '-') : '-'),
    occupation: member.occupation || (isHead ? (record.employment?.occupation || '-') : '-'),
    address: member.address || (record.head?.address || '-'),
    healthNotes: member.healthNotes || '-'
  };
};

const toMemberFormData = (member = {}, record = {}) => {
  const profile = getMemberProfile(member, record);
  const existingFormData = (member.formData && typeof member.formData === 'object')
    ? { ...member.formData }
    : null;

  if (existingFormData) {
    const nameParts = splitName(profile.name === '-' ? '' : profile.name);
    existingFormData.first_name = existingFormData.first_name || nameParts.first || 'Member';
    existingFormData.middle_name = existingFormData.middle_name || nameParts.middle || '';
    existingFormData.last_name = existingFormData.last_name || nameParts.last || '';
    existingFormData.age = existingFormData.age || (profile.age === '-' ? '' : String(profile.age));
    existingFormData.sex = existingFormData.sex || toFormSex(profile.sex);
    existingFormData.civil_status = existingFormData.civil_status || (profile.civilStatus === '-' ? '' : profile.civilStatus);
    existingFormData.contact = existingFormData.contact || (profile.contact === '-' ? '' : profile.contact);
    existingFormData.address = existingFormData.address || (profile.address === '-' ? '' : profile.address);
    existingFormData.relation_to_head = existingFormData.relation_to_head || (profile.relation === '-' ? '' : profile.relation);
    existingFormData.zone = existingFormData.zone || record.head?.zone || '';
    existingFormData.barangay = existingFormData.barangay || record.head?.barangay || '';
    existingFormData.city = existingFormData.city || record.head?.city || '';
    existingFormData.province = existingFormData.province || record.head?.province || '';
    return existingFormData;
  }

  const nameParts = splitName(profile.name === '-' ? '' : profile.name);

  return {
    first_name: nameParts.first || 'Member',
    middle_name: nameParts.middle || '',
    last_name: nameParts.last || '',
    extension_name: '',
    birthday: '',
    age: profile.age === '-' ? '' : String(profile.age),
    sex: toFormSex(profile.sex),
    civil_status: profile.civilStatus === '-' ? '' : profile.civilStatus,
    citizenship: record.head?.citizenship || 'Filipino',
    religion: '',
    height: '',
    weight: '',
    blood_type: '',
    pregnant: '',
    contact: profile.contact === '-' ? '' : profile.contact,
    address: profile.address === '-' ? '' : profile.address,
    zone: record.head?.zone || '',
    barangay: record.head?.barangay || '',
    city: record.head?.city || '',
    province: record.head?.province || '',
    education: profile.education === '-' ? '' : profile.education,
    degree: '',
    school_name: '',
    school_type: 'Private',
    dropout: 'No',
    osy: 'No',
    currently_studying: 'No',
    occupation: profile.occupation === '-' ? '' : profile.occupation,
    employment_status: record.employment?.status || 'Employed',
    work_type: record.employment?.workType || 'Private',
    monthly_income: '',
    four_ps: record.welfare?.fourPs || 'No',
    senior: record.welfare?.senior || 'No',
    pwd: record.welfare?.pwd || 'No',
    ip: record.welfare?.ip || 'No',
    voter: record.voter?.registered || 'No',
    precinct: record.voter?.precinct || '',
    sss: '',
    philhealth: '',
    gsis: '',
    tin: '',
    philid: '',
    driver_license: '',
    passport: '',
    num_members: record.household?.numMembers || record.members?.length || '',
    relation_to_head: profile.relation === '-' ? '' : profile.relation,
    num_children: record.household?.numChildren || '',
    partner_name: record.household?.partnerName || '',
    health_current_illness: '',
    health_illness_type: '',
    health_illness_years: '',
    health_chronic_diseases: [],
    health_common_illnesses: [],
    health_maintenance_meds: '',
    health_medicine_name: '',
    health_medicine_frequency: '',
    health_medicine_source: '',
    health_maternal_pregnant: '',
    health_months_pregnant: '',
    health_prenatal_care: '',
    health_child_immunized: '',
    health_child_malnutrition: '',
    health_child_sick_per_year: '',
    health_has_disability: '',
    health_disability_types: [],
    health_disability_regular_care: '',
    health_smoker: '',
    health_alcohol_daily: '',
    health_malnutrition_present: '',
    health_clean_water: '',
    health_rhu_visits: '',
    health_rhu_reason: '',
    health_has_philhealth: '',
    health_hospitalized_5yrs: '',
    health_hospitalized_reason: '',
    _hv_health_notes: profile.healthNotes === '-' ? '' : profile.healthNotes
  };
};

const fromMemberFormData = (memberData = {}) => {
  const normalized = { ...memberData };
  const fullName = [
    normalized.first_name,
    normalized.middle_name,
    normalized.last_name,
    normalized.extension_name
  ].filter(Boolean).join(' ').trim();

  return {
    name: fullName || '-',
    relation: normalized.relation_to_head || '-',
    age: normalized.age || '-',
    sex: toMemberSex(normalized.sex),
    civilStatus: normalized.civil_status || '-',
    contact: normalized.contact || '-',
    education: normalized.education || '-',
    occupation: normalized.occupation || '-',
    address: normalized.address || '-',
    healthNotes: normalized._hv_health_notes || normalized.health_illness_type || '-',
    formData: normalized
  };
};

const toTextOrEmpty = (value) => String(value ?? '').trim();

const toListFromValue = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => toTextOrEmpty(item)).filter(Boolean);
  }
  const text = toTextOrEmpty(value);
  if (!text) return [];
  if (text.includes(',')) {
    return text.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [text];
};

const withUnit = (value, unit) => {
  const text = toTextOrEmpty(value);
  if (!text) return '';
  if (text.toLowerCase().includes(String(unit).toLowerCase())) return text;
  return `${text} ${unit}`;
};

const formatServerDate = (value) => {
  const text = toTextOrEmpty(value);
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
};

const mapMemberFormToViewRow = (memberData = {}, fallbackRelation = 'Member') => {
  const formData = memberData && typeof memberData === 'object' ? { ...memberData } : {};
  const relation = toTextOrEmpty(formData.relation_to_head) || fallbackRelation;
  const fullName = buildFullName(formData, '-');

  return {
    name: fullName,
    relation,
    age: toTextOrEmpty(formData.age) || '-',
    sex: toMemberSex(formData.sex || ''),
    civilStatus: toTextOrEmpty(formData.civil_status) || '-',
    contact: toTextOrEmpty(formData.contact) || '-',
    education: toTextOrEmpty(formData.education) || '-',
    occupation: toTextOrEmpty(formData.occupation) || '-',
    address: toTextOrEmpty(formData.address) || '-',
    healthNotes: toTextOrEmpty(formData.health_illness_type) || '-',
    formData
  };
};

const mapApiHouseholdToViewRecord = (payload) => {
  const apiData = payload?.data;
  if (!apiData || typeof apiData !== 'object') return null;

  const record = (apiData.record && typeof apiData.record === 'object') ? apiData.record : {};
  const head = (record.head && typeof record.head === 'object') ? record.head : {};
  const rawMembers = Array.isArray(record.members)
    ? record.members.filter((member) => member && typeof member === 'object')
    : [];

  const householdId = toTextOrEmpty(apiData.household_id || record.household_id);
  if (!householdId) return null;

  const headName = toTextOrEmpty(apiData.head_name || record.head_name) || buildFullName(head, 'Unnamed household head');
  const headMember = mapMemberFormToViewRow({
    ...head,
    relation_to_head: toTextOrEmpty(head.relation_to_head) || 'Head'
  }, 'Head');
  if (headMember.name === '-') {
    headMember.name = headName;
  }
  headMember.relation = 'Head';

  const memberRows = rawMembers.map((member) => mapMemberFormToViewRow(member, 'Member'));
  const allMembers = [headMember, ...memberRows];
  const memberCountRaw = Number(apiData.member_count ?? record.member_count ?? head.num_members ?? allMembers.length);
  const memberCount = Number.isFinite(memberCountRaw) && memberCountRaw > 0 ? memberCountRaw : allMembers.length;

  return {
    id: householdId,
    status: 'Synced',
    updated: formatServerDate(apiData.updated_at || record.updated_at || apiData.created_at),
    head: {
      name: headName,
      age: head.age,
      sex: head.sex,
      civilStatus: head.civil_status,
      birthday: head.birthday,
      citizenship: head.citizenship,
      religion: head.religion,
      blood: head.blood_type,
      height: withUnit(head.height, 'cm'),
      weight: withUnit(head.weight, 'kg'),
      pregnant: head.pregnant,
      contact: head.contact,
      address: head.address,
      zone: head.zone || apiData.zone || record.zone,
      barangay: head.barangay,
      city: head.city,
      province: head.province
    },
    education: {
      attainment: head.education,
      degree: head.degree,
      school: head.school_name,
      schoolType: head.school_type,
      dropout: head.dropout,
      osy: head.osy,
      studying: head.currently_studying
    },
    employment: {
      occupation: head.occupation,
      status: head.employment_status,
      workType: head.work_type,
      income: head.monthly_income
    },
    welfare: {
      fourPs: head.four_ps,
      senior: head.senior,
      pwd: head.pwd,
      ip: head.ip
    },
    voter: {
      registered: head.voter,
      precinct: head.precinct
    },
    ids: {
      sss: head.sss,
      philhealth: head.philhealth,
      gsis: head.gsis,
      tin: head.tin,
      philid: head.philid,
      driver: head.driver_license,
      passport: head.passport
    },
    household: {
      numMembers: memberCount,
      relationToHead: head.relation_to_head,
      numChildren: head.num_children,
      partnerName: head.partner_name
    },
    housing: {
      ownership: head.ownership,
      houseType: head.house_type,
      toilet: head.toilet,
      rooms: head.num_rooms,
      electricity: head.electricity,
      water: head.water,
      internet: head.internet
    },
    health: {
      currentIllness: head.health_current_illness,
      illnessType: head.health_illness_type,
      chronic: toListFromValue(head.health_chronic_diseases),
      common: toListFromValue(head.health_common_illnesses),
      maintenance: head.health_maintenance_meds,
      medicine: head.health_medicine_name,
      frequency: head.health_medicine_frequency,
      source: head.health_medicine_source,
      pregnant: head.health_maternal_pregnant,
      monthsPregnant: head.health_months_pregnant,
      prenatal: head.health_prenatal_care,
      childImmunized: head.health_child_immunized,
      childMalnutrition: head.health_child_malnutrition,
      childSick: head.health_child_sick_per_year,
      disability: head.health_has_disability
    },
    members: allMembers
  };
};

const fetchHouseholdFromServer = async (householdId) => {
  const candidate = toTextOrEmpty(householdId);
  if (!candidate) return null;

  const params = new URLSearchParams({
    action: 'get_household',
    household_id: candidate
  });
  const response = await fetch(`${HOUSEHOLD_API_ENDPOINT}?${params.toString()}`, {
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
      : `Failed to load household (${response.status}).`;
    throw new Error(message);
  }

  return mapApiHouseholdToViewRecord(payload);
};

const deleteHouseholdFromServer = async (householdId) => {
  const candidate = toTextOrEmpty(householdId);
  if (!candidate) {
    throw new Error('Household ID is required.');
  }

  const response = await fetch(HOUSEHOLD_API_ENDPOINT, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'delete_household',
      household_id: candidate
    })
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
      : `Failed to delete household (${response.status}).`;
    throw new Error(message);
  }

  return payload;
};

const loadHouseholdRecordFromApi = async (requestedId) => {
  const primaryId = toTextOrEmpty(requestedId);
  if (!primaryId) return null;

  const normalizedId = normalizeHouseholdId(primaryId);
  const idsToTry = normalizedId && normalizedId !== primaryId
    ? [primaryId, normalizedId]
    : [primaryId];

  for (const householdId of idsToTry) {
    try {
      const mapped = await fetchHouseholdFromServer(householdId);
      if (mapped && mapped.id) {
        return mapped;
      }
    } catch (error) {
      // Try next fallback id.
    }
  }

  return null;
};

const isHeadMemberRow = (member, headName = '') => {
  const relation = toTextOrEmpty(member?.relation).toLowerCase();
  if (relation === 'head') return true;
  const memberName = toTextOrEmpty(member?.name).toLowerCase();
  return !!(headName && memberName && memberName === headName);
};

const buildRegistrationHeadDraft = (record) => {
  const members = Array.isArray(record?.members) ? record.members : [];
  const headName = toTextOrEmpty(record?.head?.name).toLowerCase();
  const headMember = members.find((member) => isHeadMemberRow(member, headName)) || members[0] || null;
  if (headMember) {
    return toMemberFormData(headMember, record);
  }
  return {
    ...(record?.head && typeof record.head === 'object' ? record.head : {}),
    first_name: '',
    last_name: ''
  };
};

const buildRegistrationMemberDrafts = (record) => {
  const members = Array.isArray(record?.members) ? record.members : [];
  const headName = toTextOrEmpty(record?.head?.name).toLowerCase();
  return members
    .filter((member) => !isHeadMemberRow(member, headName))
    .map((member) => toMemberFormData(member, record));
};

const seedRegistrationEditDraft = async (record) => {
  if (!record) return;

  const headDraft = buildRegistrationHeadDraft(record);
  const memberDrafts = buildRegistrationMemberDrafts(record);

  await storage.setItem(REGISTRATION_HEAD_KEY, JSON.stringify(headDraft));
  await storage.setItem(REGISTRATION_MEMBERS_KEY, JSON.stringify(memberDrafts));
  await storage.removeItem(REGISTRATION_MEMBER_EDIT_KEY);
  if (typeof storage.flush === 'function') {
    await storage.flush();
  }
};

const applyPendingMemberEditResult = async (householdId) => {
  const rawResult = storage.getItem(HV_RESULT_KEY);
  if (!rawResult) return;

  let result = null;
  try {
    result = JSON.parse(rawResult);
  } catch (error) {
    await storage.removeItem(HV_RESULT_KEY);
    return;
  }

  const normalizedTargetId = normalizeHouseholdId(householdId);
  const normalizedResultId = normalizeHouseholdId(result?.householdId);
  if (!result || normalizedResultId !== normalizedTargetId) return;

  const target = householdData[normalizedTargetId];
  if (!target || !Array.isArray(target.members)) {
    await storage.removeItem(HV_RESULT_KEY);
    return;
  }

  const memberIndex = Number(result.memberIndex);
  if (Number.isNaN(memberIndex) || memberIndex < 0 || memberIndex >= target.members.length) {
    await storage.removeItem(HV_RESULT_KEY);
    return;
  }

  const updatedMember = fromMemberFormData(result.memberData || {});
  target.members[memberIndex] = {
    ...target.members[memberIndex],
    ...updatedMember
  };

  if (target.household) {
    target.household.numMembers = target.members.length;
  }

  const updatedRelation = (updatedMember.relation || '').toLowerCase();
  if (updatedRelation === 'head' && target.head) {
    if (updatedMember.name && updatedMember.name !== '-') target.head.name = updatedMember.name;
    if (updatedMember.age && updatedMember.age !== '-') target.head.age = String(updatedMember.age);
    if (updatedMember.sex && updatedMember.sex !== '-') target.head.sex = toFormSex(updatedMember.sex);
    if (updatedMember.civilStatus && updatedMember.civilStatus !== '-') target.head.civilStatus = updatedMember.civilStatus;
    if (updatedMember.contact && updatedMember.contact !== '-') target.head.contact = updatedMember.contact;
    if (updatedMember.address && updatedMember.address !== '-') target.head.address = updatedMember.address;
    if (updatedMember.education && updatedMember.education !== '-' && target.education) target.education.attainment = updatedMember.education;
    if (updatedMember.occupation && updatedMember.occupation !== '-' && target.employment) target.employment.occupation = updatedMember.occupation;
  }

  await storage.removeItem(HV_RESULT_KEY);
  await storage.removeItem(HV_TEMP_MEMBERS_KEY);
  await storage.removeItem(HV_TEMP_EDIT_KEY);
  await storage.removeItem(HV_CONTEXT_KEY);
};

const renderMembersTable = (members) => {
  const tbody = document.getElementById('hvMembersTable');
  const label = document.getElementById('hvMembersLabel');
  const headName = String(currentRecord?.head?.name || '').trim().toLowerCase();
  const visibleMembers = (Array.isArray(members) ? members : [])
    .map((member, originalIndex) => ({ member, originalIndex }))
    .filter(({ member }) => {
      const relation = String(member?.relation || '').trim().toLowerCase();
      if (relation === 'head') return false;
      if (relation) return true;

      const memberName = String(member?.name || '').trim().toLowerCase();
      return !(headName && memberName && memberName === headName);
    });

  if (!tbody) return;
  if (!visibleMembers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">No members listed.</td></tr>';
    if (label) label.textContent = '0 member(s)';
    return;
  }

  tbody.innerHTML = visibleMembers
    .map(({ member: m, originalIndex }, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${m.name || '-'}</td>
        <td>${m.relation || '-'}</td>
        <td>${m.age || '-'}</td>
        <td>${m.sex || '-'}</td>
        <td class="member-action-cell">
          <div class="member-action-wrap">
            <button type="button" class="member-btn member-view-btn" data-member-index="${originalIndex}">
              <i class="bi bi-eye"></i> View Details
            </button>
          </div>
        </td>
      </tr>
    `).join('');

  if (label) label.textContent = `${visibleMembers.length} member(s)`;
};

const hydratePage = (record) => {
  currentRecord = record;

  const head = record.head || {};
  const education = record.education || {};
  const employment = record.employment || {};
  const welfare = record.welfare || {};
  const voter = record.voter || {};
  const ids = record.ids || {};
  const hh = record.household || {};
  const housing = record.housing || {};
  const health = record.health || {};
  const members = record.members || [];

  setText('hvId', currentDisplayHouseholdId || record.id);
  const statusEl = document.getElementById('hvStatus');
  if (statusEl) {
    statusEl.textContent = record.status || '-';
    statusEl.className = `badge status ${statusClass(record.status)}`;
  }
  setText('hvUpdated', replaceFirstYearToken(record.updated, currentDisplayYear));
  setText('hvMembersCount', members.length || hh.numMembers || '-');

  setText('hvHeadName', head.name);
  setText('hvHeadAge', head.age);
  setText('hvHeadSex', head.sex);
  setText('hvHeadCivil', head.civilStatus);
  setText('hvHeadBirthday', head.birthday);
  setText('hvHeadAgeInPersonal', head.age);
  setText('hvHeadCitizenship', head.citizenship);
  setText('hvHeadReligion', head.religion);
  setText('hvHeadBlood', head.blood);
  setText('hvHeadHeight', head.height);
  setText('hvHeadWeight', head.weight);
  setText('hvHeadPregnant', head.pregnant);

  setText('hvHeadContact', head.contact);
  setText('hvHeadAddress', head.address);
  setText('hvHeadZone', head.zone);
  setText('hvHeadBarangay', head.barangay);
  setText('hvHeadCity', head.city);
  setText('hvHeadProvince', head.province);

  setText('hvHeadEducation', education.attainment);
  setText('hvHeadDegree', education.degree);
  setText('hvHeadSchool', education.school);
  setText('hvHeadSchoolType', education.schoolType);
  setText('hvHeadDropout', education.dropout);
  setText('hvHeadOSY', education.osy);
  setText('hvHeadCurrentlyStudying', education.studying);

  setText('hvHeadOccupation', employment.occupation);
  setText('hvHeadEmploymentStatus', employment.status);
  setText('hvHeadWorkType', employment.workType);
  setText('hvHeadIncome', employment.income);

  setText('hvHead4ps', welfare.fourPs);
  setText('hvHeadSenior', welfare.senior);
  setText('hvHeadPWD', welfare.pwd);
  setText('hvHeadIP', welfare.ip);

  setText('hvHeadVoter', voter.registered);
  setText('hvHeadPrecinct', voter.precinct);
  setText('hvHeadSSS', ids.sss);
  setText('hvHeadPhilhealth', ids.philhealth);
  setText('hvHeadGSIS', ids.gsis);
  setText('hvHeadTIN', ids.tin);
  setText('hvHeadPhilID', ids.philid);
  setText('hvHeadDriver', ids.driver);
  setText('hvHeadPassport', ids.passport);

  setText('hvHouseNumMembers', hh.numMembers);
  setText('hvHouseRelationToHead', hh.relationToHead);
  setText('hvHouseNumChildren', hh.numChildren);
  setText('hvHousePartnerName', hh.partnerName);

  setText('hvHouseOwnership', housing.ownership);
  setText('hvHouseType', housing.houseType);
  setText('hvHouseToilet', housing.toilet);
  setText('hvHouseRooms', housing.rooms);
  setText('hvHouseElectricity', housing.electricity);
  setText('hvHouseWater', housing.water);
  setText('hvHouseInternet', housing.internet);

  setText('hvHealthCurrentIllness', health.currentIllness);
  setText('hvHealthIllnessType', health.illnessType);
  setText('hvHealthChronic', joinList(health.chronic));
  setText('hvHealthCommon', joinList(health.common));
  setText('hvHealthMaintenance', health.maintenance);
  setText('hvHealthMedicine', health.medicine);
  setText('hvHealthFrequency', health.frequency);
  setText('hvHealthSource', health.source);
  setText('hvHealthPregnant', health.pregnant);
  setText('hvHealthMonthsPregnant', health.monthsPregnant);
  setText('hvHealthPrenatal', health.prenatal);
  setText('hvHealthChildImmunized', health.childImmunized);
  setText('hvHealthChildMalnutrition', health.childMalnutrition);
  setText('hvHealthChildSick', health.childSick);
  setText('hvHealthDisability', health.disability);

  renderMembersTable(members);
};

const openMemberDetails = (memberIndex) => {
  if (!currentRecord || !currentRecord.members || !currentRecord.members[memberIndex]) return;
  activeMemberIndex = memberIndex;

  const member = currentRecord.members[memberIndex];
  const memberData = toMemberFormData(member, currentRecord);
  const relation = memberData.relation_to_head || member.relation || '-';
  const fullName = buildFullName(memberData, member.name || '-');

  setText('mdName', fullName);
  setText('mdRelation', `Relation: ${relation}`);
  setText('mdRelationToHeadValue', relation);
  setText('mdBirthday', memberData.birthday);
  setText('mdAge', memberData.age);
  setText('mdSex', memberData.sex || member.sex);
  setText('mdCivilStatus', memberData.civil_status);
  setText('mdCitizenship', memberData.citizenship);
  setText('mdReligion', memberData.religion);
  setText('mdBloodType', memberData.blood_type);
  setText('mdPregnant', memberData.pregnant);
  setText('mdHeight', memberData.height);
  setText('mdWeight', memberData.weight);

  setText('mdContact', memberData.contact);
  setText('mdZone', memberData.zone);
  setText('mdBarangay', memberData.barangay);
  setText('mdCity', memberData.city);
  setText('mdProvince', memberData.province);
  setText('mdAddress', memberData.address);

  setText('mdEducation', memberData.education);
  setText('mdDegree', memberData.degree);
  setText('mdSchoolName', memberData.school_name);
  setText('mdSchoolType', memberData.school_type);
  setText('mdDropout', memberData.dropout);
  setText('mdOSY', memberData.osy);
  setText('mdCurrentlyStudying', memberData.currently_studying);
  setText('mdOccupation', memberData.occupation);
  setText('mdEmploymentStatus', memberData.employment_status);
  setText('mdWorkType', memberData.work_type);
  setText('mdMonthlyIncome', memberData.monthly_income);

  setText('md4ps', memberData.four_ps);
  setText('mdSenior', memberData.senior);
  setText('mdPWD', memberData.pwd);
  setText('mdIP', memberData.ip);
  setText('mdVoter', memberData.voter);
  setText('mdPrecinct', memberData.precinct);
  setText('mdSSS', memberData.sss);
  setText('mdPhilhealth', memberData.philhealth);
  setText('mdGSIS', memberData.gsis);
  setText('mdTIN', memberData.tin);
  setText('mdPhilID', memberData.philid);
  setText('mdDriverLicense', memberData.driver_license);
  setText('mdPassport', memberData.passport);

  setText('mdNumMembers', memberData.num_members);
  setText('mdRelationToHead', memberData.relation_to_head || relation);
  setText('mdNumChildren', memberData.num_children);
  setText('mdPartnerName', memberData.partner_name);
  setText('mdHealthCurrentIllness', memberData.health_current_illness);
  setText('mdHealthIllnessType', memberData.health_illness_type);
  setText('mdHealthIllnessYears', memberData.health_illness_years);
  setText('mdHealthChronicDiseases', toListText(memberData.health_chronic_diseases));
  setText('mdHealthCommonIllnesses', toListText(memberData.health_common_illnesses));
  setText('mdHealthMaintenanceMeds', memberData.health_maintenance_meds);
  setText('mdHealthMedicineName', memberData.health_medicine_name);
  setText('mdHealthMedicineFrequency', memberData.health_medicine_frequency);
  setText('mdHealthMedicineSource', memberData.health_medicine_source);
  setText('mdHealthMaternalPregnant', memberData.health_maternal_pregnant);
  setText('mdHealthMonthsPregnant', memberData.health_months_pregnant);
  setText('mdHealthPrenatalCare', memberData.health_prenatal_care);
  setText('mdHealthChildImmunized', memberData.health_child_immunized);
  setText('mdHealthChildMalnutrition', memberData.health_child_malnutrition);
  setText('mdHealthChildSickPerYear', memberData.health_child_sick_per_year);
  setText('mdHealthHasDisability', memberData.health_has_disability);
  setText('mdHealthDisabilityTypes', toListText(memberData.health_disability_types));
  setText('mdHealthDisabilityRegularCare', memberData.health_disability_regular_care);
  setText('mdHealthSmoker', memberData.health_smoker);
  setText('mdHealthAlcoholDaily', memberData.health_alcohol_daily);
  setText('mdHealthMalnutritionPresent', memberData.health_malnutrition_present);
  setText('mdHealthCleanWater', memberData.health_clean_water);
  setText('mdHealthRhuVisits', memberData.health_rhu_visits);
  setText('mdHealthRhuReason', memberData.health_rhu_reason);
  setText('mdHealthHasPhilhealth', memberData.health_has_philhealth);
  setText('mdHealthHospitalized5yrs', memberData.health_hospitalized_5yrs);
  setText('mdHealthHospitalizedReason', memberData.health_hospitalized_reason);

  memberDetailsModal?.show();
};

const openMemberEdit = async (memberIndex) => {
  if (!canEdit || !currentRecord || !currentRecord.members || !currentRecord.members[memberIndex]) return;

  const tempMembers = currentRecord.members.map((member) => toMemberFormData(member, currentRecord));
  const context = {
    householdId: currentDisplayHouseholdId || currentRecord.id,
    role: resolvedRole
  };

  await storage.setItem(HV_TEMP_MEMBERS_KEY, JSON.stringify(tempMembers));
  await storage.setItem(HV_TEMP_EDIT_KEY, String(memberIndex));
  await storage.setItem(HV_CONTEXT_KEY, JSON.stringify(context));
  if (typeof storage.flush === 'function') {
    await storage.flush();
  }

  memberDetailsModal?.hide();

  const params = new URLSearchParams();
  params.set('mode', 'household-view');
  params.set('hid', currentDisplayHouseholdId || currentRecord.id);
  if (resolvedRole) params.set('role', resolvedRole);
  window.location.href = `member.php?${params.toString()}`;
};

const deleteActiveMember = () => {
  if (!canEdit || !currentRecord || !currentRecord.members) return;
  if (activeMemberIndex < 0 || !currentRecord.members[activeMemberIndex]) return;

  const member = currentRecord.members[activeMemberIndex];
  const memberName = member?.name || 'this member';
  const relation = (member?.relation || '').toLowerCase();

  if (relation === 'head') {
    window.alert('Cannot delete the household head. Please assign a new head first.');
    return;
  }

  const confirmed = window.confirm(`Delete ${memberName} from this household?`);
  if (!confirmed) return;

  currentRecord.members.splice(activeMemberIndex, 1);
  if (currentRecord.household) {
    currentRecord.household.numMembers = currentRecord.members.length;
  }

  activeMemberIndex = -1;
  memberDetailsModal?.hide();
  hydratePage(currentRecord);
};

const main = async () => {
  const params = new URLSearchParams(window.location.search);
  const requestedIdFromQuery = params.get('id') || params.get('household_id') || params.get('hid') || '';
  let requestedId = requestedIdFromQuery;
  if (!requestedId) {
    try {
      requestedId = String(sessionStorage.getItem('selectedHouseholdId') || '').trim();
    } catch (error) {
      requestedId = '';
    }
  }
  const requestedIdParts = parseHouseholdId(requestedId);
  const selectedYear = requestedIdParts?.year || HOUSEHOLD_BASE_DATA_YEAR;

  currentDisplayYear = selectedYear;
  if (typeof storage.ready === 'function') {
    await storage.ready();
  }

  if (!requestedId) {
    setText('hvId', '-');
    setText('hvUpdated', '-');
    renderMembersTable([]);
    return;
  }

  let resolvedRecord = await loadHouseholdRecordFromApi(requestedId);

  if (!resolvedRecord) {
    setText('hvId', applyHouseholdYear(requestedId, selectedYear) || requestedId);
    setText('hvUpdated', '-');
    renderMembersTable([]);
    return;
  }

  currentRecord = resolvedRecord;
  try {
    sessionStorage.setItem('selectedHouseholdId', currentRecord.id || requestedId);
  } catch (error) {
    // Ignore storage errors.
  }
  currentDisplayHouseholdId = applyHouseholdYear(currentRecord.id, selectedYear);
  hydratePage(currentRecord);

  const deleteBtn = document.getElementById('viewDeleteBtn');
  const editBtn = document.getElementById('viewEditBtn');
  const deleteModalEl = document.getElementById('viewDeleteModal');
  const deleteModal = deleteModalEl ? new bootstrap.Modal(deleteModalEl) : null;
  const deleteConfirmBtn = document.getElementById('viewDeleteConfirmBtn');
  const memberDetailsEditBtn = document.getElementById('memberDetailsEditBtn');
  const memberDetailsDeleteBtn = document.getElementById('memberDetailsDeleteBtn');
  let isDeletingHousehold = false;

  if (deleteBtn && deleteModal) {
    deleteBtn.addEventListener('click', () => {
      const label = document.getElementById('viewDeleteId');
      if (label && currentRecord) label.textContent = currentDisplayHouseholdId || currentRecord.id;
      deleteModal.show();
    });
  }

  deleteConfirmBtn?.addEventListener('click', async () => {
    if (!canEdit || !currentRecord || isDeletingHousehold) return;

    const householdId = toTextOrEmpty(currentRecord.id);
    if (!householdId) {
      window.alert('Unable to identify the household record to delete.');
      return;
    }

    isDeletingHousehold = true;
    deleteConfirmBtn.disabled = true;
    const originalLabel = deleteConfirmBtn.textContent;
    deleteConfirmBtn.textContent = 'Deleting...';

    try {
      await deleteHouseholdFromServer(householdId);
      try {
        const selected = String(sessionStorage.getItem('selectedHouseholdId') || '').trim();
        if (selected === householdId) {
          sessionStorage.removeItem('selectedHouseholdId');
        }
      } catch (error) {
        // Ignore storage errors.
      }
      deleteModal?.hide();
      const params = new URLSearchParams();
      if (resolvedRole) params.set('role', resolvedRole);
      window.location.href = `households.php${params.toString() ? `?${params.toString()}` : ''}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete household right now.';
      window.alert(message);
    } finally {
      isDeletingHousehold = false;
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = originalLabel;
    }
  });

  if (editBtn) {
    editBtn.addEventListener('click', async () => {
      if (!currentRecord) return;
      try {
        await seedRegistrationEditDraft(currentRecord);
      } catch (error) {
        // Continue to edit page even if draft seeding fails.
      }
      window.location.href = `registration.php?edit=${currentRecord.id}`;
    });
  }

  document.addEventListener('click', (event) => {
    const viewBtn = event.target.closest('.member-view-btn');
    if (viewBtn) {
      const memberIndex = Number(viewBtn.dataset.memberIndex);
      if (!Number.isNaN(memberIndex)) openMemberDetails(memberIndex);
      return;
    }
  });

  memberDetailsEditBtn?.addEventListener('click', async () => {
    if (activeMemberIndex < 0) return;
    memberDetailsModal?.hide();
    await openMemberEdit(activeMemberIndex);
  });

  memberDetailsDeleteBtn?.addEventListener('click', deleteActiveMember);
};

document.addEventListener('DOMContentLoaded', main);
