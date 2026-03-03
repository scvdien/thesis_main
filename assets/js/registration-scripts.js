document.getElementById("year").textContent = String(new Date().getFullYear());

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const editHouseholdId = (urlParams.get("edit") || "").trim();
  const isEditMode = editHouseholdId.length > 0;
  const MEMBERS_KEY = "household_members";
  const EDIT_KEY = "household_member_edit_index";
  const HEAD_KEY = "household_head_data";
  const PRESERVE_DRAFT_FLAG_KEY = "registration_preserve_draft";
  const REGISTRATION_RECORDS_KEY = "household_registration_records";
  const SYNC_QUEUE_KEY = "household_registration_sync_queue";
  const LAST_SYNC_KEY = "household_registration_last_sync_at";
  const LAST_SYNC_ERROR_KEY = "household_registration_last_sync_error";
  const localStorage = window.createIndexedStorageProxy
    ? window.createIndexedStorageProxy([
        MEMBERS_KEY,
        EDIT_KEY,
        HEAD_KEY,
        REGISTRATION_RECORDS_KEY,
        SYNC_QUEUE_KEY,
        LAST_SYNC_KEY,
        LAST_SYNC_ERROR_KEY
      ])
    : window.localStorage;
  const SYNC_ENDPOINT = "registration-sync.php";
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  const contentTitle = document.querySelector(".content-title");
  const contentSubtitle = document.querySelector(".content-subtitle:not(.content-subtitle-mobile)");
  const contentSubtitleMobile = document.querySelector(".content-subtitle-mobile");
  const syncCenterCard = document.getElementById("syncCenterCard");
  const saveBtn = document.getElementById("saveBtn");
  const addMemberBtn = document.getElementById("addMemberBtn");
  const membersContainer = document.getElementById("membersContainer");
  const memberCount = document.getElementById("memberCount");
  const sidebarMembersList = document.getElementById("sidebarMembersList");
  const sidebarMemberCount = document.getElementById("sidebarMemberCount");
  const memberModalEl = document.getElementById("memberModal");
  const memberModalBody = document.getElementById("memberModalBody");
  const previewBody = document.getElementById("previewBody");
  const censusForm = document.getElementById("censusForm");
  const previewBtn = document.getElementById("previewBtn");
  const birthdayInput = document.getElementById("birthday");
  const ageInput = document.getElementById("age");
  const numMembersInput = document.querySelector('input[name="num_members"]');
  const memberModal = memberModalEl ? new bootstrap.Modal(memberModalEl) : null;
  const addMemberBlockedEl = document.getElementById("addMemberBlockedModal");
  const addMemberBlockedModal = addMemberBlockedEl ? new bootstrap.Modal(addMemberBlockedEl) : null;
  const memberRequiredModalEl = document.getElementById("memberRequiredModal");
  const memberRequiredModal = memberRequiredModalEl ? new bootstrap.Modal(memberRequiredModalEl) : null;
  const logoutLinks = document.querySelectorAll('a[href="logout.php"]');
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const sidebar = document.getElementById("sidebar");
  const logoutModalEl = document.getElementById("logoutModal");
  const logoutModal = logoutModalEl ? new bootstrap.Modal(logoutModalEl) : null;
  const logoutConfirm = document.getElementById("logoutConfirm");
  const clearModalEl = document.getElementById("clearModal");
  const clearModal = clearModalEl ? new bootstrap.Modal(clearModalEl) : null;
  const clearConfirm = document.getElementById("clearConfirm");
  const saveModalEl = document.getElementById("saveModal");
  const saveModal = saveModalEl ? new bootstrap.Modal(saveModalEl) : null;
  const saveModalTitle = saveModalEl ? saveModalEl.querySelector(".modal-title") : null;
  const saveModalDescription = saveModalEl ? saveModalEl.querySelector("p") : null;
  const saveConfirm = document.getElementById("saveConfirm");
  const pendingSyncModalEl = document.getElementById("pendingSyncModal");
  const pendingSyncModal = pendingSyncModalEl ? new bootstrap.Modal(pendingSyncModalEl) : null;
  const pendingSyncList = document.getElementById("pendingSyncList");
  const pendingSyncEmpty = document.getElementById("pendingSyncEmpty");
  const pendingSyncTitleCount = document.getElementById("pendingSyncTitleCount");
  const pendingActionModalEl = document.getElementById("pendingActionModal");
  const pendingActionModal = pendingActionModalEl ? new bootstrap.Modal(pendingActionModalEl) : null;
  const pendingActionModalTitle = document.getElementById("pendingActionModalTitle");
  const pendingActionModalMessage = document.getElementById("pendingActionModalMessage");
  const pendingActionConfirm = document.getElementById("pendingActionConfirm");
  const syncToastEl = document.getElementById("syncToast");
  const syncToastTitle = document.getElementById("syncToastTitle");
  const syncToastBody = document.getElementById("syncToastBody");
  const syncToastIcon = document.getElementById("syncToastIcon");
  const syncToast = syncToastEl
    ? bootstrap.Toast.getOrCreateInstance(syncToastEl, { autohide: false })
    : null;
  const syncStatusWrap = document.getElementById("syncStatusWrap");
  const syncStatusBadge = document.getElementById("syncStatusBadge");
  const syncStatusText = document.getElementById("syncStatusText");
  const offlinePendingLine = document.getElementById("offlinePendingLine");
  const offlinePendingCount = document.getElementById("offlinePendingCount");
  const editMemberBtn = document.getElementById("editMemberBtn");
  const deleteMemberBtn = document.getElementById("deleteMemberBtn");
  const deleteMemberModalEl = document.getElementById("deleteMemberModal");
  const deleteMemberModal = deleteMemberModalEl ? new bootstrap.Modal(deleteMemberModalEl) : null;
  const deleteMemberConfirm = document.getElementById("deleteMemberConfirm");
  let currentMemberIndex = null;
  let syncInProgress = false;
  let syncSuccessMessage = "";
  let syncSuccessExpiresAt = 0;
  let syncSuccessTimerId = null;
  let syncToastHideTimerId = null;
  let pendingActionBusy = false;

  if (isEditMode) {
    document.title = "Update Household";
    if (contentTitle) contentTitle.textContent = "Update Household";
    if (contentSubtitle) {
      contentSubtitle.textContent = editHouseholdId
        ? `Editing household record: ${editHouseholdId}`
        : "Editing household record";
    }
    if (contentSubtitleMobile) contentSubtitleMobile.textContent = "Edit Mode";
    if (saveBtn) saveBtn.innerHTML = '<i class="bi bi-save"></i> Update Household';
    if (saveModalTitle) saveModalTitle.textContent = "Update Household";
    if (saveModalDescription) saveModalDescription.textContent = "Ready to update this household record?";
    if (saveConfirm) saveConfirm.textContent = "Update";
  }

  const setSidebarOpen = (open) => {
    document.body.classList.toggle("sidebar-open", open);
    if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", String(open));
    if (sidebarOverlay) sidebarOverlay.setAttribute("aria-hidden", String(!open));
  };

  if (editMemberBtn) {
    editMemberBtn.disabled = true;
  }
  if (deleteMemberBtn) {
    deleteMemberBtn.disabled = true;
  }

  const escapeHtml = (value) => {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  const normalizeZoneLabel = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const compact = raw.replace(/\s+/g, " ");
    const namedMatch = compact.match(/^(?:zone|purok)\s*([a-z0-9-]+)$/i);
    if (namedMatch) {
      const suffix = String(namedMatch[1] || "").trim();
      if (!suffix) return "Zone";
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

  const parseSyncErrorMessage = (message) => {
    const text = String(message || "").trim();
    if (!text) {
      return { householdId: "", message: "" };
    }
    const match = text.match(/^(HH-\d{4}-\d+)\s*:\s*(.+)$/i);
    if (match) {
      return {
        householdId: String(match[1] || "").trim(),
        message: String(match[2] || "").trim()
      };
    }
    return { householdId: "", message: text };
  };

  const normalizeDuplicateMeta = (value) => {
    if (!value || typeof value !== "object") return null;
    const householdId = String(value.household_id || "").trim();
    if (!householdId) return null;
    return {
      household_id: householdId,
      head_name: String(value.head_name || "").trim(),
      zone: String(value.zone || "").trim(),
      year: String(value.year || "").trim(),
      created_at: String(value.created_at || "").trim(),
      updated_at: String(value.updated_at || "").trim()
    };
  };

  const buildSyncIssue = (issue = null) => {
    if (!issue || typeof issue !== "object") return null;
    const message = String(issue.message || "").trim();
    const code = String(issue.code || "").trim();
    const status = Number(issue.status || 0);
    const duplicate = normalizeDuplicateMeta(issue.duplicate);
    if (!message && !code && !status && !duplicate) {
      return null;
    }
    return {
      message: message || "Unable to sync right now.",
      code,
      status: Number.isFinite(status) ? status : 0,
      duplicate,
      at: new Date().toISOString()
    };
  };

  const withSyncIssue = (record, issue = null) => {
    const source = record && typeof record === "object" ? record : {};
    return {
      ...source,
      sync_issue: buildSyncIssue(issue)
    };
  };

  const getSyncIssueFromRecord = (record) => {
    if (!record || typeof record !== "object") return null;
    if (typeof record.sync_issue === "string") {
      const issueFromString = buildSyncIssue({ message: record.sync_issue });
      if (issueFromString) return issueFromString;
    }
    const directIssue = buildSyncIssue(record.sync_issue);
    if (directIssue) return directIssue;
    const legacyMessage = String(record._sync_error || "").trim();
    if (!legacyMessage) return null;
    return buildSyncIssue({
      message: legacyMessage,
      code: String(record._sync_error_code || "").trim(),
      status: Number(record._sync_error_status || 0),
      duplicate: record._sync_duplicate
    });
  };

  const stripClientSyncMeta = (record) => {
    if (!record || typeof record !== "object") return {};
    const cleaned = { ...record };
    delete cleaned.sync_issue;
    delete cleaned._sync_error;
    delete cleaned._sync_error_code;
    delete cleaned._sync_error_status;
    delete cleaned._sync_error_at;
    delete cleaned._sync_duplicate;
    return cleaned;
  };

  const getRecordDisplayName = (record) =>
    String(record?.head_name || "").trim() || "Unnamed household head";

  const clearResolvedLastSyncError = () => {
    const parsed = parseSyncErrorMessage(getLastSyncError());
    if (!parsed.message) return;
    if (!parsed.householdId) {
      if (getSyncQueue().length === 0) {
        setLastSyncError("");
      }
      return;
    }
    const stillQueued = getSyncQueue().some(
      (item) => String(item?.household_id || "").trim() === parsed.householdId
    );
    if (!stillQueued) {
      setLastSyncError("");
    }
  };

  const buildSyncIssueFromError = (error, fallbackMessage = "") => {
    const code = String(error?.code || error?.payload?.code || "").trim().toLowerCase();
    const duplicate = error?.payload?.duplicate && typeof error.payload.duplicate === "object"
      ? error.payload.duplicate
      : null;
    let message = error instanceof Error
      ? String(error.message || "").trim()
      : String(fallbackMessage || "").trim();
    if (code === "duplicate_household") {
      message = "Household already exists in database. Resolve this in Sync Center Pending.";
    }
    return buildSyncIssue({
      message: message || "Unable to sync right now.",
      code,
      status: Number(error?.status || 0),
      duplicate
    });
  };

  const getAgeFromBirthday = (value) => {
    if (!value) return "";
    const birthDate = new Date(value);
    if (Number.isNaN(birthDate.getTime())) return "";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : "";
  };

  const updateAgeField = () => {
    if (!ageInput) return;
    const age = getAgeFromBirthday(birthdayInput ? birthdayInput.value : "");
    ageInput.value = age === "" ? "" : String(age);
  };

  const serializeHeadData = () => {
    if (!censusForm) return {};
    const data = {};
    const radioNames = new Set();
    const elements = Array.from(censusForm.elements);
    elements.forEach((el) => {
      if (!el.name) return;
      if (el.type === "checkbox") {
        if (!data[el.name]) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
        return;
      }
      if (el.type === "radio") {
        radioNames.add(el.name);
        if (el.checked) data[el.name] = el.value;
        return;
      }
      data[el.name] = el.value;
    });
    radioNames.forEach((name) => {
      if (data[name] === undefined) data[name] = "";
    });
    if (Object.prototype.hasOwnProperty.call(data, "zone")) {
      data.zone = normalizeZoneLabel(data.zone);
    }
    return data;
  };

  const saveHeadData = () => {
    if (!censusForm) return;
    try {
      localStorage.setItem(HEAD_KEY, JSON.stringify(serializeHeadData()));
    } catch {
      // ignore storage errors
    }
  };

  const loadHeadData = () => {
    if (!censusForm) return;
    let stored = {};
    try {
      stored = JSON.parse(localStorage.getItem(HEAD_KEY) || "{}");
    } catch {
      stored = {};
    }
    const elements = Array.from(censusForm.elements);
    elements.forEach((el) => {
      if (!el.name || stored[el.name] === undefined) return;
      const value = stored[el.name];
      if (el.type === "checkbox") {
        const list = Array.isArray(value) ? value : [];
        el.checked = list.includes(el.value);
        return;
      }
      if (el.type === "radio") {
        el.checked = value !== "" && el.value === value;
        return;
      }
      if (el.name === "zone") {
        el.value = normalizeZoneLabel(value);
        return;
      }
      el.value = value;
    });
  };

  const consumePreserveDraftFlag = () => {
    try {
      const shouldPreserve = sessionStorage.getItem(PRESERVE_DRAFT_FLAG_KEY) === "1";
      sessionStorage.removeItem(PRESERVE_DRAFT_FLAG_KEY);
      return shouldPreserve;
    } catch {
      return false;
    }
  };

  const readArrayFromStorage = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeArrayToStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
    } catch {
      // ignore storage errors
    }
  };

  const getRegistrationRecords = () => readArrayFromStorage(REGISTRATION_RECORDS_KEY);
  const setRegistrationRecords = (records) => writeArrayToStorage(REGISTRATION_RECORDS_KEY, records);
  const getSyncQueue = () => readArrayFromStorage(SYNC_QUEUE_KEY);
  const setSyncQueue = (queue) => writeArrayToStorage(SYNC_QUEUE_KEY, queue);

  const getLastSyncedAt = () => {
    try {
      return String(localStorage.getItem(LAST_SYNC_KEY) || "").trim();
    } catch {
      return "";
    }
  };

  const getLastSyncError = () => {
    try {
      return String(localStorage.getItem(LAST_SYNC_ERROR_KEY) || "").trim();
    } catch {
      return "";
    }
  };

  const setLastSyncedAt = (value) => {
    try {
      if (value) {
        localStorage.setItem(LAST_SYNC_KEY, String(value));
        return;
      }
      localStorage.removeItem(LAST_SYNC_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const setLastSyncError = (value) => {
    try {
      if (value) {
        localStorage.setItem(LAST_SYNC_ERROR_KEY, String(value));
        return;
      }
      localStorage.removeItem(LAST_SYNC_ERROR_KEY);
    } catch {
      // ignore storage errors
    }
  };

  const formatSyncDate = (value) => {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) return "";
    return parsedDate.toLocaleString([], {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  };

  const getNextHouseholdId = () => {
    const currentYear = new Date().getFullYear();
    const prefix = `HH-${currentYear}-`;
    const allIds = [
      ...getRegistrationRecords().map((item) => String(item?.household_id || "")),
      ...getSyncQueue().map((item) => String(item?.household_id || "")),
      editHouseholdId
    ];
    let maxSequence = 0;
    allIds.forEach((id) => {
      if (!id.startsWith(prefix)) return;
      const numberPart = Number(id.slice(prefix.length));
      if (Number.isFinite(numberPart) && numberPart > maxSequence) {
        maxSequence = numberPart;
      }
    });
    return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
  };

  const buildRegistrationRecord = () => {
    const headDraft = serializeHeadData();
    const normalizedZone = normalizeZoneLabel(headDraft.zone);
    const head = {
      ...headDraft,
      zone: normalizedZone
    };
    const members = getMembers().map((member) => ({
      ...member,
      zone: normalizeZoneLabel(member?.zone || normalizedZone)
    }));
    const records = getRegistrationRecords();
    const existingRecord = isEditMode
      ? records.find((item) => String(item?.household_id || "") === editHouseholdId)
      : null;
    const now = new Date().toISOString();
    const householdId = (isEditMode && editHouseholdId) || existingRecord?.household_id || getNextHouseholdId();
    const headName = [
      head.first_name,
      head.middle_name,
      head.last_name,
      head.extension_name
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");

    return {
      household_id: householdId,
      mode: isEditMode ? "update" : "create",
      source: "registration-module",
      head,
      members,
      head_name: headName || "Unnamed household head",
      zone: normalizedZone,
      member_count: members.length + 1,
      created_at: existingRecord?.created_at || now,
      updated_at: now
    };
  };

  const normalizeIdentityPart = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");

  const getHouseholdYearFromId = (householdId) => {
    const match = String(householdId || "").trim().match(/^HH-(\d{4})-\d+$/i);
    return match ? String(match[1] || "") : "";
  };

  const getHouseholdIdentity = (head = {}) => {
    const firstName = normalizeIdentityPart(head.first_name);
    const lastName = normalizeIdentityPart(head.last_name);
    const birthday = normalizeIdentityPart(head.birthday);
    if (!firstName || !lastName || !birthday) {
      return "";
    }
    const middleName = normalizeIdentityPart(head.middle_name);
    const extensionName = normalizeIdentityPart(head.extension_name);
    return [firstName, middleName, lastName, extensionName, birthday].join("|");
  };

  const findDuplicateHouseholdRecord = (record) => {
    const identity = getHouseholdIdentity(record?.head || {});
    if (!identity) {
      return null;
    }
    const currentId = String(record?.household_id || "").trim();
    const currentYear = getHouseholdYearFromId(currentId);
    if (!currentYear) {
      return null;
    }
    const records = getRegistrationRecords();
    return records.find((item) => {
      if (!item || typeof item !== "object") return false;
      const itemId = String(item.household_id || "").trim();
      if (itemId && currentId && itemId === currentId) return false;
      const itemYear = getHouseholdYearFromId(itemId);
      if (!itemYear || itemYear !== currentYear) return false;
      return getHouseholdIdentity(item.head || {}) === identity;
    }) || null;
  };

  const findDuplicatePendingSyncRecord = (record) => {
    const identity = getHouseholdIdentity(record?.head || {});
    if (!identity) {
      return null;
    }
    const currentId = String(record?.household_id || "").trim();
    const currentYear = getHouseholdYearFromId(currentId);
    if (!currentYear) {
      return null;
    }
    const queue = getSyncQueue();
    return queue.find((item) => {
      if (!item || typeof item !== "object") return false;
      const itemId = String(item.household_id || "").trim();
      if (itemId && currentId && itemId === currentId) return false;
      const itemYear = getHouseholdYearFromId(itemId);
      if (!itemYear || itemYear !== currentYear) return false;
      return getHouseholdIdentity(item.head || {}) === identity;
    }) || null;
  };

  const upsertRegistrationRecord = (record) => {
    const normalizedRecord = stripClientSyncMeta(record);
    const records = getRegistrationRecords();
    const targetId = String(normalizedRecord?.household_id || "");
    const index = records.findIndex((item) => String(item?.household_id || "") === targetId);
    if (index >= 0) {
      records[index] = {
        ...records[index],
        ...normalizedRecord
      };
    } else {
      records.unshift(normalizedRecord);
    }
    setRegistrationRecords(records);
  };

  const removeRegistrationRecord = (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return;
    const nextRecords = getRegistrationRecords().filter(
      (item) => String(item?.household_id || "").trim() !== targetId
    );
    setRegistrationRecords(nextRecords);
  };

  const upsertSyncRecord = (record) => {
    const queue = getSyncQueue();
    const sourceRecord = record && typeof record === "object" ? record : {};
    const targetId = String(sourceRecord?.household_id || "");
    const normalizedRecord = {
      ...sourceRecord,
      sync_issue: buildSyncIssue(sourceRecord.sync_issue)
    };
    const index = queue.findIndex((item) => String(item?.household_id || "") === targetId);
    if (index >= 0) {
      queue[index] = normalizedRecord;
    } else {
      queue.push(normalizedRecord);
    }
    setSyncQueue(queue);
    return queue.length;
  };

  const removeSyncRecord = (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return getSyncQueue().length;
    const nextQueue = getSyncQueue().filter((item) => String(item?.household_id || "") !== targetId);
    setSyncQueue(nextQueue);
    if (nextQueue.length === 0) {
      setLastSyncError("");
    } else {
      clearResolvedLastSyncError();
    }
    return nextQueue.length;
  };

  const clearSyncSuccessState = () => {
    syncSuccessMessage = "";
    syncSuccessExpiresAt = 0;
    if (syncSuccessTimerId) {
      window.clearTimeout(syncSuccessTimerId);
      syncSuccessTimerId = null;
    }
  };

  const showSyncToast = (message, tone = "info", title = "") => {
    if (!syncToastEl || !syncToast) return;

    const safeTone = ["success", "warning", "danger", "info"].includes(tone) ? tone : "info";
    const toneMeta = {
      info: { title: "Sync Update", icon: "bi-info-circle-fill" },
      success: { title: "Sync Complete", icon: "bi-check-circle-fill" },
      warning: { title: "Saved Offline", icon: "bi-cloud-slash-fill" },
      danger: { title: "Sync Issue", icon: "bi-exclamation-octagon-fill" }
    };
    const meta = toneMeta[safeTone];

    syncToastEl.classList.remove("toast-tone-info", "toast-tone-success", "toast-tone-warning", "toast-tone-danger");
    syncToastEl.classList.add(`toast-tone-${safeTone}`);

    if (syncToastTitle) {
      syncToastTitle.textContent = title || meta.title;
    }
    if (syncToastBody) {
      syncToastBody.textContent = String(message || "");
    }
    if (syncToastIcon) {
      syncToastIcon.className = `bi ${meta.icon} me-2`;
    }

    if (syncToastHideTimerId) {
      window.clearTimeout(syncToastHideTimerId);
      syncToastHideTimerId = null;
    }
    syncToast.show();
    syncToastHideTimerId = window.setTimeout(() => {
      syncToast.hide();
      syncToastHideTimerId = null;
    }, 2000);
  };

  const ensureMemberRequirementForSave = (memberCount, { closeSaveModal = false } = {}) => {
    if (Number(memberCount) > 0) {
      return true;
    }
    if (closeSaveModal) {
      saveModal?.hide();
    }
    if (memberRequiredModal) {
      memberRequiredModal.show();
      return false;
    }
    showSyncToast("Add at least one household member before saving this registration.", "warning", "Member Required");
    return false;
  };

  const showSyncSuccessState = (message) => {
    syncSuccessMessage = String(message || "Sync successful.");
    syncSuccessExpiresAt = Date.now() + 4200;
    if (syncSuccessTimerId) {
      window.clearTimeout(syncSuccessTimerId);
    }
    syncSuccessTimerId = window.setTimeout(() => {
      syncSuccessMessage = "";
      syncSuccessExpiresAt = 0;
      syncSuccessTimerId = null;
      updateSyncStatus();
    }, 4300);
    updateSyncStatus();
  };

  const updateSyncStatus = () => {
    const pendingCount = getSyncQueue().length;
    const isOffline = !window.navigator.onLine;
    const lastSyncedAt = getLastSyncedAt();
    const lastSyncError = getLastSyncError();
    const suffix = pendingCount === 1 ? "" : "s";
    const successActive = !isOffline
      && !syncInProgress
      && pendingCount === 0
      && Boolean(syncSuccessMessage)
      && Date.now() < syncSuccessExpiresAt;
    const pendingClickable = pendingCount > 0 && Boolean(pendingSyncModal);
    const shouldShowSyncCenter = isOffline || pendingCount > 0 || successActive;

    let badgeText = "Synced";
    let badgeTone = "synced";
    let description = "All household records are synced.";

    if (successActive) {
      badgeText = "Synced";
      badgeTone = "synced";
      description = syncSuccessMessage;
    } else if (syncInProgress) {
      badgeText = "Syncing";
      badgeTone = "syncing";
      description = pendingCount > 0
        ? `Syncing data (${pendingCount} household${suffix})...`
        : "Syncing data...";
    } else if (isOffline) {
      badgeText = "Offline";
      badgeTone = "offline";
      description = pendingCount > 0
        ? `${pendingCount} household${suffix} queued. Auto-sync starts when internet returns.`
        : "Offline mode. New saves stay local until internet returns.";
    } else if (pendingCount > 0) {
      badgeText = "Pending";
      badgeTone = "pending";
      description = lastSyncError
        ? `Pending sync (${pendingCount} household${suffix}). Last error: ${lastSyncError}`
        : `Pending sync (${pendingCount} household${suffix}).`;
    } else if (lastSyncedAt) {
      const formatted = formatSyncDate(lastSyncedAt);
      description = formatted ? `Last synced ${formatted}.` : description;
    }

    if (syncStatusBadge) {
      syncStatusBadge.className = `sync-badge sync-badge-${badgeTone}`;
      syncStatusBadge.textContent = badgeText;
      syncStatusBadge.classList.toggle("sync-badge-clickable", pendingClickable);
      if (pendingClickable) {
        syncStatusBadge.setAttribute("role", "button");
        syncStatusBadge.setAttribute("tabindex", "0");
        syncStatusBadge.setAttribute("aria-haspopup", "dialog");
        syncStatusBadge.setAttribute("aria-controls", "pendingSyncModal");
        syncStatusBadge.setAttribute("aria-label", `Open pending sync list (${pendingCount})`);
      } else {
        syncStatusBadge.removeAttribute("role");
        syncStatusBadge.removeAttribute("tabindex");
        syncStatusBadge.removeAttribute("aria-haspopup");
        syncStatusBadge.removeAttribute("aria-controls");
        syncStatusBadge.removeAttribute("aria-label");
      }
    }
    if (syncStatusWrap) {
      syncStatusWrap.classList.toggle("sync-status-clickable", pendingClickable);
      if (pendingClickable) {
        syncStatusWrap.setAttribute("role", "button");
        syncStatusWrap.setAttribute("tabindex", "0");
        syncStatusWrap.setAttribute("aria-haspopup", "dialog");
        syncStatusWrap.setAttribute("aria-controls", "pendingSyncModal");
        syncStatusWrap.setAttribute("aria-label", `Open pending sync list (${pendingCount})`);
      } else {
        syncStatusWrap.removeAttribute("role");
        syncStatusWrap.removeAttribute("tabindex");
        syncStatusWrap.removeAttribute("aria-haspopup");
        syncStatusWrap.removeAttribute("aria-controls");
        syncStatusWrap.removeAttribute("aria-label");
      }
    }
    if (syncStatusText) {
      syncStatusText.textContent = description;
    }
    if (syncCenterCard) {
      syncCenterCard.classList.toggle("d-none", !shouldShowSyncCenter);
    }
    if (offlinePendingCount) {
      offlinePendingCount.textContent = String(pendingCount);
    }
    if (offlinePendingLine) {
      offlinePendingLine.classList.toggle("d-none", !isOffline);
    }
    if (pendingSyncModalEl && pendingSyncModalEl.classList.contains("show")) {
      renderPendingSyncModal();
    }
  };

  const syncRecordToServer = async (record) => {
    const cleanRecord = stripClientSyncMeta(record);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 12000);
    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
      const response = await fetch(SYNC_ENDPOINT, {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({
          action: "upsert",
          record: cleanRecord
        }),
        signal: controller.signal
      });
      let payload = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok || payload.success !== true) {
        const message = payload?.error ? String(payload.error) : `Sync failed (HTTP ${response.status})`;
        const error = new Error(message);
        error.status = response.status;
        error.code = String(payload?.code || "");
        error.payload = payload;
        throw error;
      }
      return payload;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const flushSyncQueue = async ({ showFeedback = false, showSuccessState = false } = {}) => {
    if (syncInProgress) return;

    if (!window.navigator.onLine) {
      updateSyncStatus();
      if (showFeedback) {
        showSyncToast("You are offline. Pending households will sync automatically once online.", "warning", "Offline");
      }
      return;
    }

    let queue = getSyncQueue();
    if (!queue.length) {
      setLastSyncError("");
      updateSyncStatus();
      if (showFeedback) {
        showSyncToast("No pending households to sync.", "info", "Sync Update");
      }
      return;
    }

    clearSyncSuccessState();
    syncInProgress = true;
    updateSyncStatus();

    let syncedCount = 0;
    let syncError = "";

    for (let index = 0; index < queue.length;) {
      const nextRecord = withSyncIssue(queue[index], null);
      queue[index] = nextRecord;
      setSyncQueue(queue);
      try {
        await syncRecordToServer(nextRecord);
        queue.splice(index, 1);
        setSyncQueue(queue);
        syncedCount += 1;
        continue;
      } catch (error) {
        const statusCode = Number(error?.status || 0);
        const errorCode = String(error?.code || error?.payload?.code || "").toLowerCase();
        const duplicate = error?.payload?.duplicate && typeof error.payload.duplicate === "object"
          ? error.payload.duplicate
          : null;
        const duplicateHouseholdId = String(duplicate?.household_id || "").trim();

        if (statusCode === 409 && errorCode === "duplicate_household" && duplicateHouseholdId) {
          const duplicateIssue = buildSyncIssueFromError(error, "Household already exists in database.");
          const duplicateErrorMessage = String(
            duplicateIssue?.message || "Household already exists in database."
          ).trim();
          const pendingId = String(nextRecord?.household_id || "").trim();
          const duplicateSyncError = pendingId
            ? `${pendingId}: ${duplicateErrorMessage}`
            : duplicateErrorMessage;
          if (!syncError) {
            syncError = duplicateSyncError;
          }
          queue[index] = withSyncIssue(nextRecord, duplicateIssue || {
            message: duplicateErrorMessage,
            code: "duplicate_household",
            status: 409,
            duplicate
          });
          setSyncQueue(queue);
          index += 1;
          continue;
        }

        const errorMessage = error instanceof Error ? error.message : "Unable to sync right now.";
        const failedId = String(nextRecord?.household_id || "").trim();
        const genericSyncError = failedId ? `${failedId}: ${errorMessage}` : errorMessage;
        if (!syncError) {
          syncError = genericSyncError;
        }
        queue[index] = withSyncIssue(
          nextRecord,
          buildSyncIssueFromError(error, errorMessage)
        );
        setSyncQueue(queue);
        index += 1;
      }
    }

    syncInProgress = false;

    if (syncedCount > 0) {
      setLastSyncedAt(new Date().toISOString());
    }
    if (queue.length === 0) {
      setLastSyncError("");
    } else if (syncError) {
      setLastSyncError(syncError);
    }

    if (!syncError && syncedCount > 0 && queue.length === 0 && showSuccessState) {
      const suffix = syncedCount === 1 ? "" : "s";
      showSyncSuccessState(`Sync successfully. ${syncedCount} household${suffix} uploaded.`);
    } else {
      updateSyncStatus();
    }

    if (showFeedback) {
      if (queue.length > 0) {
        if (syncedCount > 0) {
          const syncedSuffix = syncedCount === 1 ? "" : "s";
          const pendingSuffix = queue.length === 1 ? "" : "s";
          const details = syncError ? ` Last issue: ${syncError}` : "";
          showSyncToast(
            `Partial sync complete. ${syncedCount} household${syncedSuffix} uploaded, ${queue.length} household${pendingSuffix} still pending.${details}`,
            "warning",
            "Sync Partial"
          );
          return;
        }
        showSyncToast(`Sync pending: ${syncError || "Unable to sync pending households right now."}`, "danger", "Sync Failed");
        return;
      }
      showSyncToast(`Sync complete. ${syncedCount} household${syncedCount === 1 ? "" : "s"} uploaded.`, "success", "Sync Complete");
      return;
    }

    if (queue.length > 0 && syncError) {
      const tone = syncedCount > 0 ? "warning" : "danger";
      const title = syncedCount > 0 ? "Sync Partial" : "Sync Failed";
      if (syncedCount > 0) {
        const suffix = syncedCount === 1 ? "" : "s";
        showSyncToast(`Synced ${syncedCount} household${suffix}. Remaining pending: ${queue.length}. Last issue: ${syncError}`, tone, title);
        return;
      }
      showSyncToast(`Sync pending: ${syncError}`, tone, title);
    }
  };

  const getQueueIssue = (record, index, parsedLastSyncError = parseSyncErrorMessage(getLastSyncError())) => {
    const recordIssue = getSyncIssueFromRecord(record);
    if (recordIssue) {
      return recordIssue;
    }
    if (!parsedLastSyncError.message) {
      return null;
    }
    const householdId = String(record?.household_id || "").trim();
    if (parsedLastSyncError.householdId) {
      if (parsedLastSyncError.householdId === householdId) {
        return buildSyncIssue({ message: parsedLastSyncError.message });
      }
      return null;
    }
    if (index === 0) {
      return buildSyncIssue({ message: parsedLastSyncError.message });
    }
    return null;
  };

  const renderPendingSyncModal = () => {
    if (!pendingSyncList) return;
    const queue = getSyncQueue();
    const isOffline = !window.navigator.onLine;
    if (pendingSyncTitleCount) {
      pendingSyncTitleCount.textContent = `(${queue.length})`;
    }
    if (!queue.length) {
      pendingSyncList.innerHTML = "";
      pendingSyncEmpty?.classList.remove("d-none");
      return;
    }
    pendingSyncEmpty?.classList.add("d-none");

    const parsedLastSyncError = parseSyncErrorMessage(getLastSyncError());
    pendingSyncList.innerHTML = queue.map((record, index) => {
      const householdId = String(record?.household_id || "").trim() || "No Household ID";
      const issue = getQueueIssue(record, index, parsedLastSyncError);
      const issueMessage = String(issue?.message || "").trim();
      const issueCode = String(issue?.code || "").trim().toLowerCase();
      const duplicateHouseholdId = String(issue?.duplicate?.household_id || "").trim();
      const duplicateHint = duplicateHouseholdId
        ? `Existing record: ${duplicateHouseholdId}`
        : "";
      const duplicateMessage = isOffline
        ? (duplicateHouseholdId
          ? `Duplicate found: ${duplicateHouseholdId}. Go online to enable Replace.`
          : "Duplicate found. Go online to enable Replace.")
        : (duplicateHouseholdId
          ? `Duplicate found: ${duplicateHouseholdId}. Click Replace to overwrite existing record.`
          : "Duplicate found. Click Replace to overwrite existing record.");
      const errorText = issueCode === "duplicate_household"
        ? duplicateMessage
        : (issueMessage || "Waiting to sync once internet/server is available.");
      const errorClass = issueMessage ? "" : " is-waiting";
      const replaceDisabledAttr = duplicateHouseholdId ? "" : 'disabled data-force-disabled="1"';
      const replaceButtonHtml = isOffline
        ? ""
        : `<button type="button" class="btn btn-sm btn-primary" data-pending-action="replace" data-household-id="${escapeHtml(householdId)}" ${replaceDisabledAttr}>
             Replace
           </button>`;

      return `
        <div class="pending-sync-item">
          <div class="pending-sync-item-head">
            <div>
              <div class="pending-sync-item-id">${escapeHtml(householdId)}</div>
              <div class="pending-sync-item-name">${escapeHtml(getRecordDisplayName(record))}</div>
              <div class="pending-sync-item-zone">${escapeHtml(String(record?.zone || "").trim())}</div>
            </div>
            ${duplicateHint ? `<span class="pending-sync-duplicate-chip">${escapeHtml(duplicateHint)}</span>` : ""}
          </div>
          <div class="pending-sync-item-error${errorClass}">
            ${escapeHtml(errorText)}
          </div>
          <div class="pending-sync-item-actions">
            <button type="button" class="btn btn-sm btn-outline-danger" data-pending-action="delete" data-household-id="${escapeHtml(householdId)}">
              Delete
            </button>
            ${replaceButtonHtml}
          </div>
        </div>
      `;
    }).join("");

    if (pendingActionBusy) {
      pendingSyncList.querySelectorAll("button[data-pending-action]").forEach((button) => {
        button.disabled = true;
      });
    }
  };

  const openPendingSyncModal = () => {
    if (!pendingSyncModal) return;
    if (getSyncQueue().length === 0) return;
    renderPendingSyncModal();
    pendingSyncModal.show();
  };

  const askPendingActionConfirm = ({
    title = "Confirm Action",
    message = "Are you sure you want to continue?",
    confirmLabel = "Confirm",
    confirmTone = "primary"
  } = {}) => {
    const promptMessage = String(message || "").trim() || "Are you sure you want to continue?";
    if (!pendingActionModal || !pendingActionModalEl || !pendingActionConfirm) {
      return Promise.resolve(window.confirm(promptMessage));
    }

    if (pendingActionModalTitle) {
      pendingActionModalTitle.textContent = String(title || "Confirm Action");
    }
    if (pendingActionModalMessage) {
      pendingActionModalMessage.textContent = promptMessage;
    }
    pendingActionConfirm.textContent = String(confirmLabel || "Confirm");

    const tone = ["primary", "danger", "warning", "success", "secondary"].includes(confirmTone)
      ? confirmTone
      : "primary";
    pendingActionConfirm.classList.remove(
      "btn-primary",
      "btn-danger",
      "btn-warning",
      "btn-success",
      "btn-secondary"
    );
    pendingActionConfirm.classList.add(`btn-${tone}`);

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(Boolean(value));
      };

      const onConfirm = () => {
        finish(true);
        pendingActionModal.hide();
      };

      const onHidden = () => {
        pendingActionConfirm.removeEventListener("click", onConfirm);
        finish(false);
      };

      pendingActionConfirm.addEventListener("click", onConfirm, { once: true });
      pendingActionModalEl.addEventListener("hidden.bs.modal", onHidden, { once: true });
      pendingActionModal.show();
    });
  };

  const deletePendingRecord = async (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return;
    const exists = getSyncQueue().some((item) => String(item?.household_id || "").trim() === targetId);
    if (!exists) {
      renderPendingSyncModal();
      return;
    }
    const shouldDelete = await askPendingActionConfirm({
      title: "Delete Pending Household?",
      message: `Delete pending household ${targetId}?`,
      confirmLabel: "Delete",
      confirmTone: "danger"
    });
    if (!shouldDelete) {
      return;
    }
    removeSyncRecord(targetId);
    removeRegistrationRecord(targetId);
    clearResolvedLastSyncError();
    updateSyncStatus();
    renderPendingSyncModal();
    if (getSyncQueue().length === 0) {
      pendingSyncModal?.hide();
    }
    showSyncToast(`Pending household ${targetId} deleted.`, "info", "Pending Updated");
  };

  const replacePendingRecord = async (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return;
    const queue = getSyncQueue();
    const index = queue.findIndex((item) => String(item?.household_id || "").trim() === targetId);
    if (index < 0) {
      renderPendingSyncModal();
      return;
    }

    const pendingRecord = queue[index];
    const parsedLastSyncError = parseSyncErrorMessage(getLastSyncError());
    const issue = getQueueIssue(pendingRecord, index, parsedLastSyncError);
    const duplicateHouseholdId = String(issue?.duplicate?.household_id || "").trim();
    if (!duplicateHouseholdId) {
      showSyncToast("Replace is only available for duplicate conflicts.", "warning", "Replace Unavailable");
      return;
    }

    const shouldReplace = await askPendingActionConfirm({
      title: "Replace Existing Household?",
      message: `Replace existing household ${duplicateHouseholdId} using pending record ${targetId}?`,
      confirmLabel: "Replace",
      confirmTone: "primary"
    });
    if (!shouldReplace) {
      return;
    }

    const replacementRecord = withSyncIssue({
      ...pendingRecord,
      household_id: duplicateHouseholdId,
      mode: "replace",
      created_at: String(issue?.duplicate?.created_at || pendingRecord?.created_at || "")
    }, null);

    if (targetId !== duplicateHouseholdId) {
      removeRegistrationRecord(targetId);
    }
    upsertRegistrationRecord(replacementRecord);

    const before = queue
      .slice(0, index)
      .filter((item) => String(item?.household_id || "").trim() !== duplicateHouseholdId);
    const after = queue
      .slice(index + 1)
      .filter((item) => String(item?.household_id || "").trim() !== duplicateHouseholdId);
    const nextQueue = [...before, replacementRecord, ...after];
    setSyncQueue(nextQueue);
    clearResolvedLastSyncError();
    updateSyncStatus();
    renderPendingSyncModal();

    if (window.navigator.onLine) {
      await flushSyncQueue({ showFeedback: true, showSuccessState: true });
      renderPendingSyncModal();
      return;
    }
    showSyncToast(
      `Replacement prepared for ${duplicateHouseholdId}. It will sync once internet returns.`,
      "info",
      "Pending Updated"
    );
  };

  const saveRegistration = async () => {
    let record = buildRegistrationRecord();
    clearSyncSuccessState();
    if (!ensureMemberRequirementForSave(Array.isArray(record.members) ? record.members.length : 0, { closeSaveModal: true })) {
      return false;
    }

    if (!isEditMode && !window.navigator.onLine) {
      const duplicatePending = findDuplicatePendingSyncRecord(record);
      if (duplicatePending) {
        const duplicateId = String(duplicatePending?.household_id || "").trim();
        const duplicateLabel = String(duplicatePending?.head_name || "").trim() || "this household";
        const shouldReplaceOffline = await askPendingActionConfirm({
          title: "Offline Household Already Exists",
          message: duplicateId
            ? `A matching offline household already exists for ${duplicateLabel} (${duplicateId}). Do you want to replace that offline household with this new data?`
            : `A matching offline household already exists for ${duplicateLabel}. Do you want to replace that offline household with this new data?`,
          confirmLabel: "Replace",
          confirmTone: "primary"
        });
        if (!shouldReplaceOffline) {
          showSyncToast("Save cancelled. Existing offline household retained.", "info", "Cancelled");
          return false;
        }

        const previousHouseholdId = String(record.household_id || "").trim();
        const targetHouseholdId = duplicateId || previousHouseholdId;
        record = {
          ...record,
          household_id: targetHouseholdId,
          mode: "replace",
          created_at: String(duplicatePending?.created_at || record.created_at || ""),
          updated_at: new Date().toISOString()
        };

        if (previousHouseholdId && targetHouseholdId && previousHouseholdId !== targetHouseholdId) {
          removeRegistrationRecord(previousHouseholdId);
          removeSyncRecord(previousHouseholdId);
        }
      }
    }

    upsertRegistrationRecord(record);
    let queuedByOffline = false;
    let queuedByError = false;
    let syncErrorMessage = "";

    if (window.navigator.onLine) {
      syncInProgress = true;
      updateSyncStatus();
      try {
        let syncPayload = null;
        try {
          syncPayload = await syncRecordToServer(record);
        } catch (error) {
          const statusCode = Number(error?.status || 0);
          const errorCode = String(error?.code || error?.payload?.code || "").toLowerCase();
          const duplicate = error?.payload?.duplicate && typeof error.payload.duplicate === "object"
            ? error.payload.duplicate
            : null;
          const duplicateHouseholdId = String(duplicate?.household_id || "").trim();

          if (statusCode === 409 && errorCode === "duplicate_household" && duplicateHouseholdId) {
            const duplicateLabel = String(duplicate?.head_name || "existing household").trim() || "existing household";
            const shouldReplace = await askPendingActionConfirm({
              title: "Replace Existing Household?",
              message: `A household record already exists for ${duplicateLabel} (${duplicateHouseholdId}). Do you want to replace the existing household?`,
              confirmLabel: "Replace",
              confirmTone: "primary"
            });
            if (!shouldReplace) {
              if (!isEditMode) {
                removeRegistrationRecord(record.household_id);
                removeSyncRecord(record.household_id);
              }
              showSyncToast("Save cancelled. Existing household retained.", "info", "Cancelled");
              return false;
            }

            const previousHouseholdId = String(record.household_id || "").trim();
            record = {
              ...record,
              household_id: duplicateHouseholdId,
              mode: "replace",
              created_at: String(duplicate?.created_at || record.created_at || "")
            };
            if (previousHouseholdId && previousHouseholdId !== duplicateHouseholdId) {
              removeRegistrationRecord(previousHouseholdId);
              removeSyncRecord(previousHouseholdId);
            }
            upsertRegistrationRecord(record);
            syncPayload = await syncRecordToServer(record);
          } else {
            throw error;
          }
        }

        const syncedHouseholdId = String(syncPayload?.household_id || "").trim();
        if (syncedHouseholdId && syncedHouseholdId !== String(record.household_id || "").trim()) {
          const previousHouseholdId = String(record.household_id || "").trim();
          record = {
            ...record,
            household_id: syncedHouseholdId
          };
          removeRegistrationRecord(previousHouseholdId);
          removeSyncRecord(previousHouseholdId);
          upsertRegistrationRecord(record);
        }

        removeSyncRecord(record.household_id);
        setLastSyncedAt(new Date().toISOString());
        setLastSyncError("");
      } catch (error) {
        queuedByError = true;
        const syncIssue = buildSyncIssueFromError(error, "Unable to sync right now.");
        syncErrorMessage = String(syncIssue?.message || "Unable to sync right now.").trim();
        const failedId = String(record?.household_id || "").trim();
        setLastSyncError(failedId ? `${failedId}: ${syncErrorMessage}` : syncErrorMessage);
        upsertSyncRecord(
          withSyncIssue(
            record,
            syncIssue
          )
        );
      } finally {
        syncInProgress = false;
        updateSyncStatus();
      }
    } else {
      queuedByOffline = true;
      upsertSyncRecord(withSyncIssue(record, null));
      updateSyncStatus();
    }

    if (!isEditMode) {
      clearRegistration();
    } else {
      saveHeadData();
      renderMembers();
    }

    if (window.navigator.onLine && !queuedByError) {
      await flushSyncQueue({ showSuccessState: true });
    }

    const pendingCount = getSyncQueue().length;
    if (!queuedByOffline && !queuedByError && pendingCount === 0 && !syncSuccessMessage) {
      showSyncSuccessState("Sync successfully.");
    }
    if (queuedByOffline) {
      showSyncToast(`Saved locally as ${record.household_id}. Offline mode is active; data will sync when online.`, "warning", "Saved Offline");
      return true;
    }
    if (queuedByError) {
      showSyncToast(`Saved locally as ${record.household_id}. Sync failed (${syncErrorMessage}) so this household was queued.`, "danger", "Sync Failed");
      return true;
    }
    if (pendingCount > 0) {
      showSyncToast(`${isEditMode ? "Household updated" : "Registration saved"} and synced. ${pendingCount} other pending household${pendingCount === 1 ? "" : "s"} remain in queue.`, "info", "Saved");
      return true;
    }
    showSyncToast(`${isEditMode ? "Household updated" : "Registration saved"} and synced. Household ID: ${record.household_id}.`, "success", "Saved");
    return true;
  };

  const renderPreview = () => {
    if (!censusForm || !previewBody) return;
    const formData = new FormData(censusForm);
    const valueOf = (name) => String(formData.get(name) ?? "").trim();
    const listOf = (name) =>
      formData
        .getAll(name)
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .join(", ");
    const withUnit = (value, unit) => (value ? `${value} ${unit}` : "");

    const buildRows = (rows) =>
      rows
        .filter((row) => row.value)
        .map(
          (row) => `
            <div class="member-detail-row">
              <span class="member-detail-label">${escapeHtml(row.label)}</span>
              <span class="member-detail-value">${escapeHtml(row.value)}</span>
            </div>
          `
        )
        .join("");

    const buildSection = (title, rows, alwaysShow = false) => {
      const content = buildRows(rows);
      if (!content && !alwaysShow) return "";
      return `
        <div class="member-section-title">${escapeHtml(title)}</div>
        ${content || '<p class="text-muted text-center">No details provided.</p>'}
      `;
    };

    const sections = [
      buildSection("A. Household Head Information", [
        { label: "First Name", value: valueOf("first_name") },
        { label: "Middle Name", value: valueOf("middle_name") },
        { label: "Last Name", value: valueOf("last_name") },
        { label: "Extension Name", value: valueOf("extension_name") },
        { label: "Birthday", value: valueOf("birthday") },
        { label: "Sex/Gender", value: valueOf("sex") },
        { label: "Civil Status", value: valueOf("civil_status") },
        { label: "Nationality/Citizenship", value: valueOf("citizenship") },
        { label: "Religion", value: valueOf("religion") },
        { label: "Height", value: withUnit(valueOf("height"), "cm") },
        { label: "Weight", value: withUnit(valueOf("weight"), "kg") },
        { label: "Blood Type", value: valueOf("blood_type") },
        { label: "Age", value: valueOf("age") },
        { label: "Pregnant", value: valueOf("pregnant") }
      ]),
      buildSection("B. Contact & Location", [
        { label: "Contact Number", value: valueOf("contact") },
        { label: "Complete Address", value: valueOf("address") },
        { label: "Zone", value: valueOf("zone") },
        { label: "Barangay", value: valueOf("barangay") },
        { label: "City/Municipality", value: valueOf("city") },
        { label: "Province", value: valueOf("province") }
      ]),
      buildSection("C. Education", [
        { label: "Educational Attainment", value: valueOf("education") },
        { label: "Degree/Course", value: valueOf("degree") },
        { label: "School Name", value: valueOf("school_name") },
        { label: "School Type", value: valueOf("school_type") },
        { label: "Drop Out?", value: valueOf("dropout") },
        { label: "Out of School Youth?", value: valueOf("osy") },
        { label: "Currently Studying?", value: valueOf("currently_studying") }
      ]),
      buildSection("D. Employment", [
        { label: "Occupation", value: valueOf("occupation") },
        { label: "Employment Status", value: valueOf("employment_status") },
        { label: "Type of Work", value: valueOf("work_type") },
        { label: "Monthly Income", value: valueOf("monthly_income") }
      ]),
      buildSection("E. Social Welfare", [
        { label: "4Ps Member?", value: valueOf("4ps") },
        { label: "Senior Citizen?", value: valueOf("senior") },
        { label: "PWD?", value: valueOf("pwd") },
        { label: "Indigenous People (IP)?", value: valueOf("ip") }
      ]),
      buildSection("F. Voter Information", [
        { label: "Registered Voter?", value: valueOf("voter") },
        { label: "Precinct Number", value: valueOf("precinct") }
      ]),
      buildSection("G. Government IDs", [
        { label: "SSS Number", value: valueOf("sss") },
        { label: "PhilHealth Number", value: valueOf("philhealth") },
        { label: "GSIS Number", value: valueOf("gsis") },
        { label: "TIN Number", value: valueOf("tin") },
        { label: "PhilSys National ID", value: valueOf("philid") },
        { label: "Driver's License", value: valueOf("driver_license") },
        { label: "Passport Number", value: valueOf("passport") }
      ]),
      buildSection("H. Household Data", [
        { label: "Number of Household Members", value: valueOf("num_members") },
        { label: "Relationship to Head", value: valueOf("relation_to_head") },
        { label: "Number of Children", value: valueOf("num_children") },
        { label: "Marital Partner Name", value: valueOf("partner_name") }
      ]),
      buildSection("I. Housing & Utilities", [
        { label: "House Ownership", value: valueOf("ownership") },
        { label: "House Type", value: valueOf("house_type") },
        { label: "Toilet Type", value: valueOf("toilet") },
        { label: "Number of Rooms", value: valueOf("num_rooms") },
        { label: "Electricity?", value: valueOf("electricity") },
        { label: "Water Source", value: valueOf("water") },
        { label: "Internet Access?", value: valueOf("internet") }
      ]),
      buildSection("J. Health Information", [
        { label: "Currently has illness?", value: valueOf("health_current_illness") },
        { label: "Type of illness", value: valueOf("health_illness_type") },
        { label: "Years with illness", value: valueOf("health_illness_years") },
        { label: "Chronic diseases", value: listOf("health_chronic_diseases") },
        { label: "Common/Recent illness", value: listOf("health_common_illnesses") },
        { label: "Taking maintenance medicine?", value: valueOf("health_maintenance_meds") },
        { label: "Medicine name", value: valueOf("health_medicine_name") },
        { label: "Frequency per day", value: valueOf("health_medicine_frequency") },
        { label: "Medicine source", value: valueOf("health_medicine_source") },
        { label: "Maternal: Pregnant", value: valueOf("health_maternal_pregnant") },
        { label: "Months pregnant", value: valueOf("health_months_pregnant") },
        { label: "With prenatal care", value: valueOf("health_prenatal_care") },
        { label: "Child: Fully immunized", value: valueOf("health_child_immunized") },
        { label: "Child: Malnutrition", value: valueOf("health_child_malnutrition") },
        { label: "Times sick per year", value: valueOf("health_child_sick_per_year") },
        { label: "Has disability?", value: valueOf("health_has_disability") },
        { label: "Disability types", value: listOf("health_disability_types") },
        { label: "Needs regular medication or therapy", value: valueOf("health_disability_regular_care") },
        { label: "Smoker in household", value: valueOf("health_smoker") },
        { label: "Alcohol intake daily", value: valueOf("health_alcohol_daily") },
        { label: "Malnutrition present", value: valueOf("health_malnutrition_present") },
        { label: "Clean water source", value: valueOf("health_clean_water") },
        { label: "RHU visits in past year", value: valueOf("health_rhu_visits") },
        { label: "Common reason for visit", value: valueOf("health_rhu_reason") },
        { label: "Has PhilHealth?", value: valueOf("health_has_philhealth") },
        { label: "Hospitalized in last 5 years?", value: valueOf("health_hospitalized_5yrs") },
        { label: "Reason for hospitalization", value: valueOf("health_hospitalized_reason") }
      ], true)
    ]
      .filter(Boolean)
      .join("");

    previewBody.innerHTML = sections || '<p class="text-muted text-center">No details provided.</p>';
  };

  const getMembers = () => {
    try {
      return JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const setMembers = (members) => {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  };

  const readHeadDraft = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(HEAD_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const hasHeadDraft = () => {
    const draft = readHeadDraft();
    return Object.values(draft).some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return String(value || "").trim() !== "";
    });
  };

  const fetchHouseholdRecordFromServer = async (householdId) => {
    const params = new URLSearchParams({
      action: "get_household",
      household_id: String(householdId || "")
    });
    const response = await fetch(`${SYNC_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok || !payload || payload.success !== true) {
      const message = payload && payload.error ? String(payload.error) : `Failed to load household (${response.status}).`;
      throw new Error(message);
    }
    return payload;
  };

  const hydrateEditModeFromServerIfNeeded = async () => {
    if (!isEditMode || !editHouseholdId) return;
    if (getMembers().length > 0 || hasHeadDraft()) return;

    try {
      const payload = await fetchHouseholdRecordFromServer(editHouseholdId);
      const record = payload?.data?.record;
      if (!record || typeof record !== "object") return;

      const headRaw = record.head && typeof record.head === "object" ? record.head : {};
      const householdZone = normalizeZoneLabel(record.zone || headRaw.zone);
      const head = {
        ...headRaw,
        zone: householdZone
      };
      const members = Array.isArray(record.members)
        ? record.members
          .filter((row) => row && typeof row === "object")
          .map((row) => ({
            ...row,
            zone: normalizeZoneLabel(row.zone || householdZone)
          }))
        : [];

      await localStorage.setItem(HEAD_KEY, JSON.stringify(head));
      setMembers(members);
      if (typeof localStorage.flush === "function") {
        await localStorage.flush();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load edit record from server.";
      showSyncToast(message, "warning", "Load Warning");
    }
  };

  const clearRegistration = () => {
    document.getElementById("censusForm").reset();
    localStorage.removeItem(HEAD_KEY);
    setMembers([]);
    renderMembers();
    updateAddMemberState();
    updateAgeField();
  };

  const zoneInput = document.querySelector('input[name="zone"]');
  const headFields = [
    document.querySelector('input[name="first_name"]'),
    document.querySelector('input[name="last_name"]'),
    document.getElementById("sex"),
    document.getElementById("birthday"),
    document.querySelector('select[name="civil_status"]'),
    document.querySelector('input[name="contact"]'),
    document.querySelector('input[name="address"]'),
    zoneInput
  ].filter(Boolean);

  const isHeadComplete = () => {
    return headFields.every((field) => String(field.value || "").trim() !== "");
  };

  const updateAddMemberState = () => {
    if (!addMemberBtn) return;
    const enabled = isHeadComplete();
    addMemberBtn.setAttribute("aria-disabled", String(!enabled));
    addMemberBtn.classList.toggle("is-disabled", !enabled);
  };

  headFields.forEach((field) => {
    field.addEventListener("input", updateAddMemberState);
    field.addEventListener("change", updateAddMemberState);
  });

  if (zoneInput) {
    const normalizeZoneInputValue = () => {
      const normalized = normalizeZoneLabel(zoneInput.value);
      if (zoneInput.value !== normalized) {
        zoneInput.value = normalized;
      }
    };
    zoneInput.addEventListener("change", () => {
      normalizeZoneInputValue();
      saveHeadData();
    });
    zoneInput.addEventListener("blur", () => {
      normalizeZoneInputValue();
      saveHeadData();
    });
  }

  if (birthdayInput) {
    birthdayInput.addEventListener("input", updateAgeField);
    birthdayInput.addEventListener("change", updateAgeField);
  }

  if (censusForm) {
    censusForm.addEventListener("input", saveHeadData);
    censusForm.addEventListener("change", saveHeadData);
  }

  if (addMemberBtn) {
    addMemberBtn.addEventListener("click", async (event) => {
      if (!isHeadComplete()) {
        event.preventDefault();
        addMemberBlockedModal?.show();
        return;
      }

      event.preventDefault();
      saveHeadData();
      if (typeof localStorage.flush === "function") {
        await localStorage.flush();
      }
      const nextUrl = new URL(addMemberBtn.getAttribute("href") || "member.php", window.location.href);
      if (isEditMode && editHouseholdId) {
        nextUrl.searchParams.set("edit", editHouseholdId);
      }
      window.location.href = nextUrl.toString();
    });
  }

  const renderMemberModal = (member) => {
    const listValue = (value) => {
      if (Array.isArray(value)) return value.join(", ");
      return value || "";
    };

    const chronicList = listValue(member.health_chronic_diseases);
    const commonList = listValue(member.health_common_illnesses);
    const disabilityList = listValue(member.health_disability_types);

    const rows = [
      { label: "Name", value: `${member.first_name || ""} ${member.middle_name || ""} ${member.last_name || ""} ${member.extension_name || ""}` },
      { label: "Birthday", value: member.birthday },
      { label: "Age", value: member.age },
      { label: "Sex/Gender", value: member.sex },
      { label: "Civil Status", value: member.civil_status },
      { label: "Citizenship", value: member.citizenship },
      { label: "Religion", value: member.religion },
      { label: "Height", value: member.height ? `${member.height} cm` : "" },
      { label: "Weight", value: member.weight ? `${member.weight} kg` : "" },
      { label: "Blood Type", value: member.blood_type },
      { label: "Pregnant", value: member.pregnant },
      { label: "Contact", value: member.contact },
      { label: "Address", value: member.address },
      { label: "Zone", value: member.zone },
      { label: "Barangay", value: member.barangay },
      { label: "City", value: member.city },
      { label: "Province", value: member.province },
      { label: "Education", value: member.education },
      { label: "Degree/Course", value: member.degree },
      { label: "School Name", value: member.school_name },
      { label: "School Type", value: member.school_type },
      { label: "Drop Out", value: member.dropout },
      { label: "Out of School Youth", value: member.osy },
      { label: "Currently Studying", value: member.currently_studying },
      { label: "Occupation", value: member.occupation },
      { label: "Employment Status", value: member.employment_status },
      { label: "Work Type", value: member.work_type },
      { label: "Monthly Income", value: member.monthly_income },
      { label: "4Ps", value: member.four_ps },
      { label: "Senior Citizen", value: member.senior },
      { label: "PWD", value: member.pwd },
      { label: "IP", value: member.ip },
      { label: "Registered Voter", value: member.voter },
      { label: "Precinct", value: member.precinct },
      { label: "SSS", value: member.sss },
      { label: "PhilHealth", value: member.philhealth },
      { label: "GSIS", value: member.gsis },
      { label: "TIN", value: member.tin },
      { label: "PhilSys ID", value: member.philid },
      { label: "Driver's License", value: member.driver_license },
      { label: "Passport", value: member.passport },
      { label: "Household Members", value: member.num_members },
      { label: "Relationship to Head", value: member.relation_to_head },
      { label: "Number of Children", value: member.num_children },
      { label: "Marital Partner", value: member.partner_name },
      { label: "Currently has illness", value: member.health_current_illness },
      { label: "Type of illness", value: member.health_illness_type },
      { label: "Years with illness", value: member.health_illness_years },
      { label: "Chronic diseases", value: chronicList },
      { label: "Common/Recent illness", value: commonList },
      { label: "Taking maintenance medicine", value: member.health_maintenance_meds },
      { label: "Medicine name", value: member.health_medicine_name },
      { label: "Frequency per day", value: member.health_medicine_frequency },
      { label: "Medicine source", value: member.health_medicine_source },
      { label: "Maternal: Pregnant", value: member.health_maternal_pregnant },
      { label: "Months pregnant", value: member.health_months_pregnant },
      { label: "With prenatal care", value: member.health_prenatal_care },
      { label: "Child: Fully immunized", value: member.health_child_immunized },
      { label: "Child: Malnutrition", value: member.health_child_malnutrition },
      { label: "Times sick per year", value: member.health_child_sick_per_year },
      { label: "Has disability", value: member.health_has_disability },
      { label: "Disability types", value: disabilityList },
      { label: "Needs regular medication/therapy", value: member.health_disability_regular_care },
      { label: "Smoker in household", value: member.health_smoker },
      { label: "Alcohol intake daily", value: member.health_alcohol_daily },
      { label: "Malnutrition present", value: member.health_malnutrition_present },
      { label: "Clean water source", value: member.health_clean_water },
      { label: "RHU visits (past year)", value: member.health_rhu_visits },
      { label: "Common reason for visit", value: member.health_rhu_reason },
      { label: "Has PhilHealth", value: member.health_has_philhealth },
      { label: "Hospitalized in last 5 years", value: member.health_hospitalized_5yrs },
      { label: "Reason for hospitalization", value: member.health_hospitalized_reason }
    ];

    const list = rows
      .filter(row => row.value)
      .map(row => `
        <div class="member-detail-row">
          <span class="member-detail-label">${escapeHtml(row.label)}</span>
          <span class="member-detail-value">${escapeHtml(row.value)}</span>
        </div>
      `)
      .join("");

    memberModalBody.innerHTML = list || "<p class=\"text-muted\">No details provided.</p>";
  };

  const renderMembers = () => {
    const members = getMembers();
    if (memberCount) memberCount.textContent = members.length;
    if (sidebarMemberCount) sidebarMemberCount.textContent = members.length;
    if (numMembersInput) {
      const computedCount = members.length + 1;
      const nextValue = String(computedCount);
      if (numMembersInput.value !== nextValue) {
        numMembersInput.value = nextValue;
        saveHeadData();
      }
    }

    if (membersContainer) {
      if (!members.length) {
        membersContainer.innerHTML = '<p class="text-muted member-empty">No members added yet.</p>';
      }
    }

    if (sidebarMembersList) {
      if (!members.length) {
        sidebarMembersList.innerHTML = '<p class="sidebar-member-empty">No members yet.</p>';
      } else {
        sidebarMembersList.innerHTML = members.map((member, index) => {
          const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
          const metaParts = [
            member.sex,
            member.age ? `${member.age} yrs` : "",
            member.relation_to_head
          ].filter(Boolean);
          const label = `Member ${index + 1}`;
          const displayName = name ? `${label} - ${name}` : label;
          return `
            <button type="button" class="sidebar-member-item" data-index="${index}">
              <span class="sidebar-member-name">${escapeHtml(displayName)}</span>
              <span class="sidebar-member-meta">${escapeHtml(metaParts.join(" | ") || "Details saved")}</span>
            </button>
          `;
        }).join("");
      }
    }

    if (!members.length) {
      return;
    }

    if (membersContainer) {
      membersContainer.innerHTML = members.map((member, index) => {
      const name = `${member.first_name || ""} ${member.last_name || ""}`.trim() || `Member ${index + 1}`;
      const metaParts = [
        member.sex,
        member.age ? `${member.age} yrs` : "",
        member.relation_to_head
      ].filter(Boolean);
      return `
        <div class="member-summary">
          <div>
            <div class="member-name">${escapeHtml(name)}</div>
            <div class="member-meta">${escapeHtml(metaParts.join(" • ") || "Details saved")}</div>
          </div>
          <div class="member-summary-actions">
            <button type="button" class="btn btn-sm btn-outline-primary view-member" data-index="${index}">
              <i class="bi bi-eye"></i> View
            </button>
            <button type="button" class="btn btn-sm btn-danger remove-member" data-index="${index}">
              <i class="bi bi-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
      }).join("");
    }

    if (editMemberBtn) {
      editMemberBtn.disabled = members.length === 0;
    }
    if (deleteMemberBtn) {
      deleteMemberBtn.disabled = members.length === 0;
    }
  };

  if (membersContainer) {
    membersContainer.addEventListener("click", (event) => {
      const viewBtn = event.target.closest(".view-member");
      const removeBtn = event.target.closest(".remove-member");
      if (!viewBtn && !removeBtn) return;

      const members = getMembers();
      const index = Number((viewBtn || removeBtn).dataset.index);
      const member = members[index];
      if (!member) return;

      if (viewBtn) {
        currentMemberIndex = index;
        if (editMemberBtn) {
          editMemberBtn.disabled = false;
        }
        if (deleteMemberBtn) {
          deleteMemberBtn.disabled = false;
        }
        renderMemberModal(member);
        memberModal?.show();
        return;
      }

      members.splice(index, 1);
      setMembers(members);
      renderMembers();
    });
  }

  if (sidebarMembersList) {
    sidebarMembersList.addEventListener("click", (event) => {
      const item = event.target.closest(".sidebar-member-item");
      if (!item) return;

      const members = getMembers();
      const index = Number(item.dataset.index);
      const member = members[index];
      if (!member) return;

      currentMemberIndex = index;
      if (editMemberBtn) {
        editMemberBtn.disabled = false;
      }
      if (deleteMemberBtn) {
        deleteMemberBtn.disabled = false;
      }
      renderMemberModal(member);
      memberModal?.show();
    });
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener("click", () => {
      const isOpen = document.body.classList.contains("sidebar-open");
      setSidebarOpen(!isOpen);
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener("click", () => {
      setSidebarOpen(false);
    });
  }

  if (sidebar) {
    sidebar.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (!link) return;
      if (window.matchMedia("(max-width: 768px)").matches) {
        setSidebarOpen(false);
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setSidebarOpen(false);
    }
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 768px)").matches) {
      setSidebarOpen(false);
    }
  });

  window.addEventListener("online", () => {
    clearSyncSuccessState();
    flushSyncQueue({ showSuccessState: true });
  });

  window.addEventListener("offline", () => {
    clearSyncSuccessState();
    updateSyncStatus();
  });

  if (syncStatusBadge) {
    syncStatusBadge.addEventListener("click", () => {
      if (!syncStatusBadge.classList.contains("sync-badge-clickable")) return;
      openPendingSyncModal();
    });
    syncStatusBadge.addEventListener("keydown", (event) => {
      if (!syncStatusBadge.classList.contains("sync-badge-clickable")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openPendingSyncModal();
    });
  }

  if (syncStatusWrap) {
    syncStatusWrap.addEventListener("click", (event) => {
      const actionButton = event.target.closest("button[data-pending-action]");
      if (actionButton) return;
      if (!syncStatusWrap.classList.contains("sync-status-clickable")) return;
      openPendingSyncModal();
    });
    syncStatusWrap.addEventListener("keydown", (event) => {
      if (!syncStatusWrap.classList.contains("sync-status-clickable")) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openPendingSyncModal();
    });
  }

  if (pendingSyncModalEl) {
    pendingSyncModalEl.addEventListener("show.bs.modal", () => {
      renderPendingSyncModal();
    });
  }

  if (pendingSyncList) {
    pendingSyncList.addEventListener("click", async (event) => {
      const actionButton = event.target.closest("button[data-pending-action]");
      if (!actionButton) return;
      if (actionButton.disabled || pendingActionBusy) return;
      const action = String(actionButton.dataset.pendingAction || "").trim();
      const householdId = String(actionButton.dataset.householdId || "").trim();
      if (!action || !householdId) return;

      pendingActionBusy = true;
      renderPendingSyncModal();
      try {
        if (action === "delete") {
          await deletePendingRecord(householdId);
          return;
        }
        if (action === "replace") {
          await replacePendingRecord(householdId);
        }
      } finally {
        pendingActionBusy = false;
        renderPendingSyncModal();
      }
    });
  }

  if (typeof localStorage.ready === "function") {
    await localStorage.ready();
  }

  if (!isEditMode && !consumePreserveDraftFlag()) {
    await localStorage.removeItem(HEAD_KEY);
    await localStorage.removeItem(MEMBERS_KEY);
    await localStorage.removeItem(EDIT_KEY);
    if (typeof localStorage.flush === "function") {
      await localStorage.flush();
    }
  }

  await hydrateEditModeFromServerIfNeeded();
  loadHeadData();
  updateAgeField();
  renderMembers();
  updateAddMemberState();
  updateSyncStatus();
  if (window.navigator.onLine) {
    flushSyncQueue({ showSuccessState: true });
  }

  if (editMemberBtn) {
    editMemberBtn.addEventListener("click", async () => {
      if (currentMemberIndex === null) return;
      await localStorage.setItem(EDIT_KEY, String(currentMemberIndex));
      if (typeof localStorage.flush === "function") {
        await localStorage.flush();
      }
      window.location.href = "member.php";
    });
  }

  if (deleteMemberBtn) {
    deleteMemberBtn.addEventListener("click", () => {
      if (currentMemberIndex === null) return;
      deleteMemberModal?.show();
    });
  }

  if (deleteMemberConfirm) {
    deleteMemberConfirm.addEventListener("click", () => {
      if (currentMemberIndex === null) return;
      const members = getMembers();
      if (!members[currentMemberIndex]) return;
      members.splice(currentMemberIndex, 1);
      setMembers(members);
      renderMembers();
      currentMemberIndex = null;
      if (deleteMemberBtn) {
        deleteMemberBtn.disabled = true;
      }
      if (editMemberBtn) {
        editMemberBtn.disabled = true;
      }
      deleteMemberModal?.hide();
      memberModal?.hide();
    });
  }

  if (previewBtn) {
    previewBtn.addEventListener("click", () => {
      renderPreview();
      new bootstrap.Modal(document.getElementById("previewModal")).show();
    });
  }
  document.getElementById("clearBtn").addEventListener("click", () => {
    clearModal?.show();
  });
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (censusForm && !censusForm.reportValidity()) {
        return;
      }
      if (!ensureMemberRequirementForSave(getMembers().length, { closeSaveModal: true })) {
        return;
      }
      saveModal?.show();
    });
  }

  if (logoutLinks.length) {
    logoutLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        logoutModal?.show();
      });
    });
  }
  if (logoutConfirm) {
    logoutConfirm.addEventListener("click", () => {
      window.location.href = "logout.php";
    });
  }
  if (clearConfirm) {
    clearConfirm.addEventListener("click", () => {
      clearRegistration();
      clearModal?.hide();
    });
  }
  if (saveConfirm) {
    saveConfirm.addEventListener("click", async () => {
      if (censusForm && !censusForm.reportValidity()) {
        return;
      }
      if (!ensureMemberRequirementForSave(getMembers().length, { closeSaveModal: true })) {
        return;
      }
      if (saveConfirm.disabled) {
        return;
      }
      const originalText = saveConfirm.textContent;
      saveConfirm.disabled = true;
      saveConfirm.textContent = isEditMode ? "Updating..." : "Saving...";
      let saved = false;
      let reopenSaveModal = false;
      try {
        saveModal?.hide();
        saved = await saveRegistration();
      } catch (error) {
        reopenSaveModal = true;
        throw error;
      } finally {
        saveConfirm.disabled = false;
        saveConfirm.textContent = originalText || (isEditMode ? "Update" : "Save");
        if (!saved && reopenSaveModal) {
          saveModal?.show();
        }
      }
    });
  }
});
