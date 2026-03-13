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

const pageParams = new URLSearchParams(window.location.search);
const normalizeYearValue = (value, fallback = '') => {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return String(parsed);
  }
  const fallbackParsed = Number.parseInt(String(fallback || '').trim(), 10);
  return Number.isInteger(fallbackParsed) && fallbackParsed > 0 ? String(fallbackParsed) : '';
};
const roleFromQueryRaw = pageParams.get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromBody || roleFromQuery || roleFromStorage || 'captain';
if (roleFromQuery) sessionStorage.setItem('userRole', roleFromQuery);
document.body.dataset.role = resolvedRole;
const canEdit = resolvedRole === 'secretary' || resolvedRole === 'admin';
document.body.classList.toggle('role-can-edit', canEdit);

const backLink = document.querySelector('.hv-back-btn');
const buildHouseholdsListUrl = (yearValue = '') => {
  const params = new URLSearchParams();
  if (canEdit) {
    params.set('role', resolvedRole);
  }
  const normalizedYear = normalizeYearValue(yearValue);
  if (normalizedYear) {
    params.set('year', normalizedYear);
  }
  return `households.php${params.toString() ? `?${params.toString()}` : ''}`;
};
if (backLink) {
  backLink.setAttribute('href', buildHouseholdsListUrl(pageParams.get('year')));
}

let currentRecord = null;
let activeMemberIndex = -1;
const HOUSEHOLD_BASE_DATA_YEAR = String(new Date().getFullYear());
const HOUSEHOLD_API_ENDPOINT = 'registration-sync.php';
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
const REGISTRATION_HEAD_KEY = 'household_head_data';
const REGISTRATION_MEMBERS_KEY = 'household_members';
const REGISTRATION_MEMBER_EDIT_KEY = 'household_member_edit_index';
const REGISTRATION_RECORDS_KEY = 'household_registration_records';
const REGISTRATION_SYNC_QUEUE_KEY = 'household_registration_sync_queue';
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
  if (s.includes('synced') || s.includes('up to date')) return 'verified';
  if (s.includes('verified')) return 'verified';
  if (s.includes('pending')) return 'pending';
  return 'unverified';
};

const statusLabel = (status = '') => {
  const value = String(status || '').trim();
  const normalized = value.toLowerCase();
  if (!value) return '-';
  if (normalized.includes('synced') || normalized.includes('up to date') || normalized.includes('verified')) {
    return 'Updated';
  }
  return value;
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
    partner_name: record.household?.partnerName || ''
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
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {})
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

const removeHouseholdFromRegistrationCache = (householdId) => {
  const targetId = toTextOrEmpty(householdId);
  if (!targetId) return;

  try {
    const records = JSON.parse(window.localStorage.getItem(REGISTRATION_RECORDS_KEY) || '[]');
    if (Array.isArray(records)) {
      const filtered = records.filter((item) => String(item?.household_id || '').trim() !== targetId);
      window.localStorage.setItem(REGISTRATION_RECORDS_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    // Ignore cache cleanup issues.
  }

  try {
    const queue = JSON.parse(window.localStorage.getItem(REGISTRATION_SYNC_QUEUE_KEY) || '[]');
    if (Array.isArray(queue)) {
      const filtered = queue.filter((item) => String(item?.household_id || '').trim() !== targetId);
      window.localStorage.setItem(REGISTRATION_SYNC_QUEUE_KEY, JSON.stringify(filtered));
    }
  } catch (error) {
    // Ignore cache cleanup issues.
  }
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

const applyPendingMemberEditResult = async (record, householdId) => {
  if (!record || !Array.isArray(record.members)) {
    return;
  }

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

  const memberIndex = Number(result.memberIndex);
  if (Number.isNaN(memberIndex) || memberIndex < 0 || memberIndex >= record.members.length) {
    await storage.removeItem(HV_RESULT_KEY);
    return;
  }

  const updatedMember = fromMemberFormData(result.memberData || {});
  record.members[memberIndex] = {
    ...record.members[memberIndex],
    ...updatedMember
  };

  if (record.household) {
    record.household.numMembers = record.members.length;
  }

  const updatedRelation = (updatedMember.relation || '').toLowerCase();
  if (updatedRelation === 'head' && record.head) {
    if (updatedMember.name && updatedMember.name !== '-') record.head.name = updatedMember.name;
    if (updatedMember.age && updatedMember.age !== '-') record.head.age = String(updatedMember.age);
    if (updatedMember.sex && updatedMember.sex !== '-') record.head.sex = toFormSex(updatedMember.sex);
    if (updatedMember.civilStatus && updatedMember.civilStatus !== '-') record.head.civilStatus = updatedMember.civilStatus;
    if (updatedMember.contact && updatedMember.contact !== '-') record.head.contact = updatedMember.contact;
    if (updatedMember.address && updatedMember.address !== '-') record.head.address = updatedMember.address;
    if (updatedMember.education && updatedMember.education !== '-' && record.education) record.education.attainment = updatedMember.education;
    if (updatedMember.occupation && updatedMember.occupation !== '-' && record.employment) record.employment.occupation = updatedMember.occupation;
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
    statusEl.textContent = statusLabel(record.status);
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
  setText('hvPrimaryOccupation', employment.occupation);
  setText('hvPrimaryChildren', hh.numChildren);
  setText('hvPrimaryOwnership', housing.ownership);
  setText('hvPrimaryHouseType', housing.houseType);

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

  renderMembersTable(members);
};

const openMemberDetails = (memberIndex) => {
  if (!currentRecord || !currentRecord.members || !currentRecord.members[memberIndex]) return;
  activeMemberIndex = memberIndex;

  const member = currentRecord.members[memberIndex];
  const memberData = toMemberFormData(member, currentRecord);
  const relation = memberData.relation_to_head || member.relation || '-';
  const fullName = buildFullName(memberData, member.name || '-');
  const residentId = toTextOrEmpty(memberData.resident_id || memberData.resident_code || member.resident_id || member.resident_code) || '-';
  const householdId = toTextOrEmpty(currentDisplayHouseholdId || currentRecord.id || memberData.household_id || memberData.household_code) || '-';

  setText('mdName', fullName);
  setText('mdRelation', `Relation: ${relation} | Resident ID: ${residentId} | Household: ${householdId}`);
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
  const selectedYear = normalizeYearValue(params.get('year'), requestedIdParts?.year || HOUSEHOLD_BASE_DATA_YEAR);

  currentDisplayYear = selectedYear;
  if (backLink) {
    backLink.setAttribute('href', buildHouseholdsListUrl(selectedYear));
  }
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

  await applyPendingMemberEditResult(resolvedRecord, resolvedRecord.id || requestedId);
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
      removeHouseholdFromRegistrationCache(householdId);
      try {
        const selected = String(sessionStorage.getItem('selectedHouseholdId') || '').trim();
        if (selected === householdId) {
          sessionStorage.removeItem('selectedHouseholdId');
        }
      } catch (error) {
        // Ignore storage errors.
      }
      deleteModal?.hide();
      window.location.href = buildHouseholdsListUrl(currentDisplayYear);
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
      const nextUrl = new URL('registration.php', window.location.href);
      nextUrl.searchParams.set('edit', currentRecord.id);
      nextUrl.searchParams.set('from', 'household-view');
      nextUrl.searchParams.set('return_id', currentRecord.id);
      const targetYear = normalizeYearValue(pageParams.get('year') || currentDisplayYear);
      if (targetYear) {
        nextUrl.searchParams.set('year', targetYear);
      }
      if (resolvedRole) {
        nextUrl.searchParams.set('role', resolvedRole);
      }
      window.location.href = nextUrl.toString();
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
