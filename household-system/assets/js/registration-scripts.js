document.getElementById("year").textContent = String(new Date().getFullYear());

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const editHouseholdId = (urlParams.get("edit") || "").trim();
  const isEditMode = editHouseholdId.length > 0;
  const editReturnSource = (urlParams.get("from") || "").trim().toLowerCase();
  const editReturnId = (urlParams.get("return_id") || editHouseholdId).trim();
  const isValidRecordYear = (year) => Number.isInteger(year) && year >= 2000 && year <= 2100;
  const requestedRecordYear = Number.parseInt((urlParams.get("year") || "").trim(), 10);
  const editYearMatch = editHouseholdId.match(/^HH-(\d{4})-/i);
  const editRecordYear = editYearMatch ? Number.parseInt(editYearMatch[1] || "", 10) : 0;
  const targetRecordYear = isValidRecordYear(editRecordYear)
    ? editRecordYear
    : (isValidRecordYear(requestedRecordYear) ? requestedRecordYear : new Date().getFullYear());
  const MEMBERS_KEY = "household_members";
  const EDIT_KEY = "household_member_edit_index";
  const HEAD_KEY = "household_head_data";
  const PRESERVE_DRAFT_FLAG_KEY = "registration_preserve_draft";
  const REGISTRATION_RECORDS_KEY = "household_registration_records";
  const SYNC_QUEUE_KEY = "household_registration_sync_queue";
  const DUPLICATE_INDEX_CACHE_KEY = "household_registration_duplicate_index";
  const LAST_SYNC_KEY = "household_registration_last_sync_at";
  const LAST_SYNC_ERROR_KEY = "household_registration_last_sync_error";
  const PRESENCE_ENDPOINT = "auth-presence.php";
  const CONNECTIVITY_PROBE_TTL_MS = 15000;
  const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);
  const isLocalhostOrigin = LOCALHOST_NAMES.has(window.location.hostname);
  const CONNECTIVITY_REFRESH_INTERVAL_MS = isLocalhostOrigin ? 3000 : 8000;
  const localStorage = window.createIndexedStorageProxy
    ? window.createIndexedStorageProxy([
        MEMBERS_KEY,
        EDIT_KEY,
        HEAD_KEY,
        REGISTRATION_RECORDS_KEY,
        SYNC_QUEUE_KEY,
        DUPLICATE_INDEX_CACHE_KEY,
        LAST_SYNC_KEY,
        LAST_SYNC_ERROR_KEY
      ])
    : window.localStorage;
  const SYNC_ENDPOINT = "registration-sync.php";
  const DUPLICATE_INDEX_PAGE_SIZE = 250;
  const DUPLICATE_INDEX_CACHE_TTL_MS = 5 * 60 * 1000;
  const USERS_API_ENDPOINT = "users-api.php";
  const USERNAME_RULE = /^[A-Za-z0-9._-]{3,80}$/;
  const CREDENTIAL_PASSWORD_RULE = /^(?=.*[^A-Za-z0-9]).{8,}$/;
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
  let requiresCredentialUpdate = String(document.body.dataset.requiresCredentialUpdate || "").toLowerCase() === "true";
  let currentSessionUsername = String(document.body.dataset.currentUsername || "").trim();
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
  const clearBtn = document.getElementById("clearBtn");
  const birthdayInput = document.getElementById("birthday");
  const ageInput = document.getElementById("age");
  const sexInput = document.getElementById("sex");
  const pregnantWrap = document.getElementById("pregnantWrap");
  const pregnantRadios = Array.from(document.querySelectorAll('input[name="pregnant"]'));
  const numMembersInput = document.querySelector('input[name="num_members"]');
  const numChildrenInput = document.querySelector('input[name="num_children"]');
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
  const openStaffAccountSettingsBtn = document.getElementById("openStaffAccountSettingsBtn");
  const staffCredentialsModalEl = document.getElementById("staffCredentialsModal");
  const staffCredentialsModal = staffCredentialsModalEl
    ? new bootstrap.Modal(staffCredentialsModalEl, { backdrop: "static", keyboard: false })
    : null;
  const staffCredentialsModeBadge = document.getElementById("staffCredentialsModeBadge");
  const staffCredentialsModalTitle = document.getElementById("staffCredentialsModalTitle");
  const staffCredentialsModalDescription = document.getElementById("staffCredentialsModalDescription");
  const staffCredentialsCurrentUsername = document.getElementById("staffCredentialsCurrentUsername");
  const staffCredentialsCurrentPassword = document.getElementById("staffCredentialsCurrentPassword");
  const staffCredentialsNewUsername = document.getElementById("staffCredentialsNewUsername");
  const staffCredentialsNewPassword = document.getElementById("staffCredentialsNewPassword");
  const staffCredentialsConfirmPassword = document.getElementById("staffCredentialsConfirmPassword");
  const staffCredentialsNotice = document.getElementById("staffCredentialsNotice");
  const staffCredentialsCancelBtn = document.getElementById("staffCredentialsCancelBtn");
  const staffCredentialsLogoutBtn = document.getElementById("staffCredentialsLogoutBtn");
  const staffCredentialsSaveBtn = document.getElementById("staffCredentialsSaveBtn");
  const clearModalEl = document.getElementById("clearModal");
  const clearModal = clearModalEl ? new bootstrap.Modal(clearModalEl) : null;
  const clearConfirm = document.getElementById("clearConfirm");
  const saveModalEl = document.getElementById("saveModal");
  const saveModal = saveModalEl ? new bootstrap.Modal(saveModalEl) : null;
  const saveModalTitle = saveModalEl ? saveModalEl.querySelector(".modal-title") : null;
  const saveModalDescription = saveModalEl ? saveModalEl.querySelector("p") : null;
  const saveConfirm = document.getElementById("saveConfirm");
  const savingHouseholdModalEl = document.getElementById("savingHouseholdModal");
  const savingHouseholdModalTitle = document.getElementById("savingHouseholdModalTitle");
  const savingHouseholdModalMessage = document.getElementById("savingHouseholdModalMessage");
  const duplicateHouseholdModalEl = document.getElementById("duplicateHouseholdModal");
  const duplicateHouseholdModal = duplicateHouseholdModalEl ? new bootstrap.Modal(duplicateHouseholdModalEl) : null;
  const duplicateHouseholdModalTitle = document.getElementById("duplicateHouseholdModalTitle");
  const duplicateHouseholdModalMessage = document.getElementById("duplicateHouseholdModalMessage");
  const loadExistingBtn = document.getElementById("loadExistingBtn");
  const loadHouseholdModalEl = document.getElementById("loadHouseholdModal");
  const loadHouseholdModal = loadHouseholdModalEl ? new bootstrap.Modal(loadHouseholdModalEl) : null;
  const loadHouseholdYear = document.getElementById("loadHouseholdYear");
  const loadHouseholdSearch = document.getElementById("loadHouseholdSearch");
  const loadHouseholdSearchBtn = document.getElementById("loadHouseholdSearchBtn");
  const loadHouseholdStatus = document.getElementById("loadHouseholdStatus");
  const loadHouseholdResults = document.getElementById("loadHouseholdResults");
  const loadHouseholdEmpty = document.getElementById("loadHouseholdEmpty");
  const loadHouseholdEmptyTitle = document.getElementById("loadHouseholdEmptyTitle");
  const loadHouseholdEmptyText = document.getElementById("loadHouseholdEmptyText");
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
  const currentRole = String(document.body.dataset.role || "").trim().toLowerCase();
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
  let savingHouseholdHideTimerId = null;
  let pendingActionBusy = false;
  let loadHouseholdRequestToken = 0;
  let staffCredentialSaveBusy = false;
  const duplicateIndexRefreshPromises = new Map();
  const LOAD_HOUSEHOLD_MIN_QUERY_LENGTH = 2;

  const buildEditModeReturnUrl = () => {
    if (editReturnSource === "household-view") {
      const nextUrl = new URL("household-view.php", window.location.href);
      if (editReturnId) {
        nextUrl.searchParams.set("id", editReturnId);
      }
      if (targetRecordYear) {
        nextUrl.searchParams.set("year", String(targetRecordYear));
      }
      if (currentRole) {
        nextUrl.searchParams.set("role", currentRole);
      }
      return nextUrl.toString();
    }

    const nextUrl = new URL("registration.php", window.location.href);
    nextUrl.searchParams.set("year", String(targetRecordYear));
    return nextUrl.toString();
  };

  const canDeleteMembersInCurrentFlow = () => !(isEditMode && currentRole === "staff");

  const syncMemberActionButtons = (members = getMembers()) => {
    const canDeleteMembers = canDeleteMembersInCurrentFlow();

    if (editMemberBtn) {
      editMemberBtn.disabled = members.length === 0;
    }

    if (deleteMemberBtn) {
      deleteMemberBtn.classList.toggle("d-none", !canDeleteMembers);
      deleteMemberBtn.disabled = !canDeleteMembers || members.length === 0;
    }
  };

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
    if (loadExistingBtn) {
      loadExistingBtn.innerHTML = editReturnSource === "household-view"
        ? '<i class="bi bi-arrow-left"></i> Back to Household'
        : '<i class="bi bi-arrow-left"></i> Back to Registration';
    }
  } else if (targetRecordYear !== new Date().getFullYear()) {
    if (contentSubtitle) {
      contentSubtitle.textContent = `Registration year: ${targetRecordYear}`;
    }
    if (contentSubtitleMobile) {
      contentSubtitleMobile.textContent = `Year ${targetRecordYear}`;
    }
  }

  let serverReachable = window.navigator.onLine ? true : null;
  let connectivityProbePromise = null;
  let lastConnectivityProbeAt = 0;

  const isAppOnline = () => {
    if (isLocalhostOrigin) {
      return window.navigator.onLine !== false;
    }
    if (window.navigator.onLine === true) return true;
    if (serverReachable === true) return true;
    if (serverReachable === false) return false;
    return window.navigator.onLine !== false;
  };

  const syncConnectivityState = async ({ force = false } = {}) => {
    if (isLocalhostOrigin) {
      serverReachable = null;
      lastConnectivityProbeAt = Date.now();
      return isAppOnline();
    }

    const now = Date.now();
    if (!force && lastConnectivityProbeAt > 0 && (now - lastConnectivityProbeAt) < CONNECTIVITY_PROBE_TTL_MS) {
      return isAppOnline();
    }
    if (connectivityProbePromise) {
      return connectivityProbePromise;
    }

    connectivityProbePromise = (async () => {
      try {
        const response = await fetch(`${PRESENCE_ENDPOINT}?_=${now}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "X-Requested-With": "XMLHttpRequest"
          }
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        serverReachable = Boolean(
          response.ok
          && payload
          && payload.success === true
          && String(payload.status || "").trim().toLowerCase() === "online"
        );
      } catch {
        serverReachable = false;
      } finally {
        lastConnectivityProbeAt = Date.now();
        connectivityProbePromise = null;
      }
      return isAppOnline();
    })();

    return connectivityProbePromise;
  };

  const updateLoadExistingButtonVisibility = () => {
    if (!loadExistingBtn) return;

    const shouldHideLoadExisting = !isEditMode && !isAppOnline();
    loadExistingBtn.classList.toggle("d-none", shouldHideLoadExisting);
    loadExistingBtn.setAttribute("aria-hidden", shouldHideLoadExisting ? "true" : "false");

    if (shouldHideLoadExisting && loadHouseholdModalEl?.classList.contains("show")) {
      loadHouseholdModal?.hide();
    }
  };

  const setSidebarOpen = (open) => {
    document.body.classList.toggle("sidebar-open", open);
    if (sidebarToggle) sidebarToggle.setAttribute("aria-expanded", String(open));
    if (sidebarOverlay) sidebarOverlay.setAttribute("aria-hidden", String(!open));

    if (!open) {
      return;
    }

    void syncConnectivityState({ force: true }).then(() => {
      updateSyncStatus();
      updateLoadExistingButtonVisibility();
      if (isAppOnline()) {
        warmDuplicateIndexForYear(targetRecordYear);
        flushSyncQueue({ showSuccessState: true });
      }
    });
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
    const yearValue = String(value.year || value.record_year || "").trim();
    const source = String(value.source || "").trim().toLowerCase();
    return {
      household_id: householdId,
      head_name: String(value.head_name || "").trim(),
      zone: String(value.zone || "").trim(),
      year: yearValue,
      source,
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

  const setStaffCredentialsNotice = (message, tone = "muted") => {
    if (!staffCredentialsNotice) return;
    const text = String(message || "").trim();
    staffCredentialsNotice.textContent = text;
    staffCredentialsNotice.classList.remove("text-muted", "text-success", "text-danger");
    if (!text) {
      staffCredentialsNotice.hidden = true;
      staffCredentialsNotice.classList.add("text-muted");
      return;
    }
    staffCredentialsNotice.hidden = false;
    if (tone === "success") {
      staffCredentialsNotice.classList.add("text-success");
      return;
    }
    if (tone === "danger") {
      staffCredentialsNotice.classList.add("text-danger");
      return;
    }
    staffCredentialsNotice.classList.add("text-muted");
  };

  const setStaffCredentialsMode = (mode = "optional") => {
    const isRequiredMode = mode === "required";

    if (staffCredentialsModeBadge) {
      staffCredentialsModeBadge.textContent = isRequiredMode ? "Required" : "";
      staffCredentialsModeBadge.hidden = !isRequiredMode;
    }
    if (staffCredentialsModalTitle) {
      staffCredentialsModalTitle.textContent = "Change Credentials";
    }
    if (staffCredentialsModalDescription) {
      staffCredentialsModalDescription.textContent = isRequiredMode
        ? "Update your username or password to continue."
        : "Update your username or password.";
    }
    if (staffCredentialsSaveBtn) {
      staffCredentialsSaveBtn.textContent = "Save Changes";
    }
    staffCredentialsCancelBtn?.classList.toggle("d-none", isRequiredMode);
    staffCredentialsLogoutBtn?.classList.toggle("d-none", !isRequiredMode);
  };

  const resetStaffCredentialFields = () => {
    if (staffCredentialsCurrentUsername) {
      staffCredentialsCurrentUsername.value = currentSessionUsername;
    }
    if (staffCredentialsCurrentPassword) {
      staffCredentialsCurrentPassword.value = "";
    }
    if (staffCredentialsNewUsername) {
      staffCredentialsNewUsername.value = currentSessionUsername;
    }
    if (staffCredentialsNewPassword) {
      staffCredentialsNewPassword.value = "";
    }
    if (staffCredentialsConfirmPassword) {
      staffCredentialsConfirmPassword.value = "";
    }
    setStaffCredentialsNotice("");
  };

  const openStaffCredentialsModal = (mode = "optional") => {
    setStaffCredentialsMode(mode);
    resetStaffCredentialFields();
    staffCredentialsModal?.show();
  };

  const submitStaffCredentialUpdate = async () => {
    const currentUsername = String(staffCredentialsCurrentUsername?.value || "").trim();
    const currentPassword = String(staffCredentialsCurrentPassword?.value || "");
    const newUsername = String(staffCredentialsNewUsername?.value || "").trim();
    const newPassword = String(staffCredentialsNewPassword?.value || "");
    const confirmPassword = String(staffCredentialsConfirmPassword?.value || "");

    if (!currentUsername || !currentPassword || !newUsername || !newPassword || !confirmPassword) {
      throw new Error("Complete all credential fields before saving.");
    }
    if (!USERNAME_RULE.test(newUsername)) {
      throw new Error("New username must be 3-80 characters and use only letters, numbers, dot, underscore, or dash.");
    }
    if (!CREDENTIAL_PASSWORD_RULE.test(newPassword)) {
      throw new Error("New password must be at least 8 characters and include 1 special character.");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("New password and confirmation do not match.");
    }
    if (!csrfToken) {
      throw new Error("Missing CSRF token. Reload the page and sign in again.");
    }

    const response = await fetch(USERS_API_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({
        action: "update_own_credentials",
        current_username: currentUsername,
        current_password: currentPassword,
        new_username: newUsername,
        new_password: newPassword
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
        : `Unable to update credentials (${response.status}).`;
      throw new Error(message);
    }

    return {
      payload,
      newUsername
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
      message = "Household already exists in database. Duplicate entries are not allowed.";
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
    if (data.sex !== "Female" && Object.prototype.hasOwnProperty.call(data, "pregnant")) {
      data.pregnant = "";
    }
    return data;
  };

  const updatePregnantVisibility = () => {
    if (!pregnantWrap || !sexInput) return;
    const show = sexInput.value === "Female";
    pregnantWrap.style.display = show ? "" : "none";
    if (!show) {
      pregnantRadios.forEach((radio) => {
        radio.checked = false;
      });
    }
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
    updatePregnantVisibility();
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

  const readObjectFromStorage = (key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeObjectToStorage = (key, value) => {
    try {
      const normalized = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      localStorage.setItem(key, JSON.stringify(normalized));
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
    const prefix = `HH-${targetRecordYear}-`;
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
      record_year: targetRecordYear,
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

  const normalizeIdentityBirthdayPart = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    const monthFirstMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (monthFirstMatch) {
      const month = Number.parseInt(monthFirstMatch[1] || "", 10);
      const day = Number.parseInt(monthFirstMatch[2] || "", 10);
      let year = Number.parseInt(monthFirstMatch[3] || "", 10);
      if (Number.isFinite(year) && year >= 0 && year < 100) {
        year += year >= 70 ? 1900 : 2000;
      }
      if (
        Number.isInteger(month)
        && Number.isInteger(day)
        && Number.isInteger(year)
        && month >= 1
        && month <= 12
        && day >= 1
        && day <= 31
        && year >= 1900
        && year <= 2100
      ) {
        return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }

    const parsedTimestamp = Date.parse(raw);
    if (Number.isFinite(parsedTimestamp)) {
      return new Date(parsedTimestamp).toISOString().slice(0, 10);
    }

    return normalizeIdentityPart(raw);
  };

  const getHouseholdYearFromId = (householdId) => {
    const match = String(householdId || "").trim().match(/^HH-(\d{4})-\d+$/i);
    return match ? String(match[1] || "") : "";
  };

  const getRecordTimestamp = (record) => {
    const parsed = Date.parse(String(record?.updated_at || record?.created_at || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const buildHeadNameFromRecord = (record) => {
    if (!record || typeof record !== "object") return "";
    const directName = String(record.head_name || "").trim();
    if (directName) return directName;
    const head = record.head && typeof record.head === "object" ? record.head : {};
    return [
      head.first_name,
      head.middle_name,
      head.last_name,
      head.extension_name
    ]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  };

  const buildCachedHouseholdRecord = (source = {}, sourceRecord = null) => {
    const record = sourceRecord && typeof sourceRecord === "object"
      ? sourceRecord
      : (source?.record && typeof source.record === "object" ? source.record : null);
    if (!record || typeof record !== "object") {
      return null;
    }

    return normalizeLookupHouseholdRecord({
      ...record,
      household_id: String(source?.household_id || record.household_id || "").trim(),
      record_year: Number.parseInt(String(source?.record_year || record.record_year || ""), 10),
      rollover_source_household_id: String(source?.rollover_source_household_id || record.rollover_source_household_id || "").trim(),
      head_name: String(source?.head_name || record.head_name || "").trim(),
      zone: String(source?.zone || record.zone || "").trim(),
      member_count: Number.parseInt(String(source?.member_count || record.member_count || ""), 10) || 0,
      source: String(source?.source || record.source || "registration-module").trim() || "registration-module",
      created_at: String(source?.created_at || record.created_at || "").trim(),
      updated_at: String(source?.updated_at || record.updated_at || "").trim()
    });
  };

  const normalizeLookupHouseholdRecord = (record) => {
    if (!record || typeof record !== "object") return null;
    const cleanedRecord = stripClientSyncMeta(record);
    const householdId = String(cleanedRecord.household_id || "").trim();
    if (!householdId) return null;

    const head = cleanedRecord.head && typeof cleanedRecord.head === "object"
      ? { ...cleanedRecord.head }
      : {};
    const recordYearRaw = Number.parseInt(
      String(cleanedRecord.record_year || getHouseholdYearFromId(householdId)),
      10
    );
    const recordYear = isValidRecordYear(recordYearRaw) ? recordYearRaw : 0;
    const zone = normalizeZoneLabel(cleanedRecord.zone || head.zone);
    const members = Array.isArray(cleanedRecord.members)
      ? cleanedRecord.members
        .filter((member) => member && typeof member === "object")
        .map((member) => ({
          ...member,
          zone: normalizeZoneLabel(member.zone || zone)
        }))
      : [];
    const headName = buildHeadNameFromRecord(cleanedRecord) || "Unnamed household head";
    const memberCount = Math.max(
      Number.parseInt(String(cleanedRecord.member_count || ""), 10) || 0,
      members.length + 1
    );

    return {
      ...cleanedRecord,
      household_id: householdId,
      record_year: recordYear,
      rollover_source_household_id: String(cleanedRecord.rollover_source_household_id || "").trim(),
      source: String(cleanedRecord.source || "registration-module").trim() || "registration-module",
      head_name: headName,
      zone,
      head: {
        ...head,
        zone
      },
      members,
      member_count: memberCount,
      created_at: String(cleanedRecord.created_at || "").trim(),
      updated_at: String(cleanedRecord.updated_at || cleanedRecord.created_at || "").trim()
    };
  };

  const sortHouseholdLookupRecords = (records = []) => {
    return [...records].sort((left, right) => {
      const timestampDiff = getRecordTimestamp(right) - getRecordTimestamp(left);
      if (timestampDiff !== 0) return timestampDiff;
      return String(right?.household_id || "").localeCompare(String(left?.household_id || ""));
    });
  };

  const getStoredHouseholdRecord = (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return null;

    const candidates = [
      ...getRegistrationRecords().filter((item) => String(item?.household_id || "").trim() === targetId),
      ...getSyncQueue().filter((item) => String(item?.household_id || "").trim() === targetId)
    ]
      .map((item) => normalizeLookupHouseholdRecord(item))
      .filter(Boolean);

    if (!candidates.length) {
      return null;
    }

    return candidates.sort((left, right) => getRecordTimestamp(right) - getRecordTimestamp(left))[0] || null;
  };

  const getHouseholdIdentityCore = (head = {}) => {
    const firstName = normalizeIdentityPart(head.first_name);
    const lastName = normalizeIdentityPart(head.last_name);
    const birthday = normalizeIdentityBirthdayPart(head.birthday);
    if (!firstName || !lastName || !birthday) {
      return "";
    }
    return [firstName, lastName, birthday].join("|");
  };

  const getHouseholdIdentityFull = (head = {}) => {
    const firstName = normalizeIdentityPart(head.first_name);
    const lastName = normalizeIdentityPart(head.last_name);
    const birthday = normalizeIdentityBirthdayPart(head.birthday);
    if (!firstName || !lastName || !birthday) {
      return "";
    }
    const middleName = normalizeIdentityPart(head.middle_name);
    const extensionName = normalizeIdentityPart(head.extension_name);
    return [firstName, middleName, lastName, extensionName, birthday].join("|");
  };

  const uniqueNonEmptyStrings = (values = []) => {
    const seen = new Set();
    return values.filter((value) => {
      const text = String(value || "").trim();
      if (!text || seen.has(text)) {
        return false;
      }
      seen.add(text);
      return true;
    });
  };

  const getHouseholdDuplicateKeys = (record = {}) => {
    if (!record || typeof record !== "object") return [];
    const head = record.head && typeof record.head === "object" ? record.head : {};
    const identityCore = getHouseholdIdentityCore(head);
    const identityFull = getHouseholdIdentityFull(head);
    const headName = normalizeIdentityPart(buildHeadNameFromRecord(record));
    const zone = normalizeIdentityPart(normalizeZoneLabel(record.zone || head.zone));
    const address = normalizeIdentityPart(record.address || head.address);
    const firstName = normalizeIdentityPart(head.first_name);
    const lastName = normalizeIdentityPart(head.last_name);
    const keys = [];

    if (identityCore) {
      keys.push(`identity_core|${identityCore}`);
      if (identityFull && identityFull !== identityCore) {
        keys.push(`identity_full|${identityFull}`);
      }
      if (address) {
        keys.push(`identity_address|${identityCore}|${address}|${zone}`);
      } else if (zone) {
        keys.push(`identity_zone|${identityCore}|${zone}`);
      }
    }

    if (firstName && lastName) {
      if (address) {
        keys.push(`name_address|${firstName}|${lastName}|${address}|${zone}`);
      }
      if (zone) {
        keys.push(`name_zone|${firstName}|${lastName}|${zone}`);
      }
    }

    if (headName && address) {
      keys.push(`head_address|${headName}|${address}|${zone}`);
    }

    if (headName && zone) {
      keys.push(`head_zone|${headName}|${zone}`);
    }

    return uniqueNonEmptyStrings(keys);
  };

  const getHouseholdDuplicateKey = (record = {}) => {
    const keys = getHouseholdDuplicateKeys(record);
    return keys[0] || "";
  };

  const recordsShareDuplicateKey = (leftRecord, rightRecord) => {
    const leftKeys = getHouseholdDuplicateKeys(leftRecord);
    const rightKeys = getHouseholdDuplicateKeys(rightRecord);
    if (leftKeys.length === 0 || rightKeys.length === 0) {
      return false;
    }
    const rightLookup = new Set(rightKeys);
    return leftKeys.some((key) => rightLookup.has(key));
  };

  const findDuplicateHouseholdRecord = (record) => {
    const duplicateKeys = getHouseholdDuplicateKeys(record);
    if (duplicateKeys.length === 0) {
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
      return recordsShareDuplicateKey(item, record);
    }) || null;
  };

  const findDuplicatePendingSyncRecord = (record) => {
    const duplicateKeys = getHouseholdDuplicateKeys(record);
    if (duplicateKeys.length === 0) {
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
      return recordsShareDuplicateKey(item, record);
    }) || null;
  };

  const normalizeDuplicateIndexItem = (item = {}) => {
    if (!item || typeof item !== "object") return null;
    const householdId = String(item.household_id || "").trim();
    if (!householdId) return null;
    const recordYearRaw = Number.parseInt(String(item.record_year || getHouseholdYearFromId(householdId)), 10);
    const recordYear = isValidRecordYear(recordYearRaw) ? recordYearRaw : 0;
    const duplicateKeys = uniqueNonEmptyStrings(Array.isArray(item.duplicate_keys) ? item.duplicate_keys : []);
    if (duplicateKeys.length === 0) {
      return null;
    }
    return {
      household_id: householdId,
      record_year: recordYear,
      head_name: String(item.head_name || "").trim(),
      zone: normalizeZoneLabel(item.zone || ""),
      created_at: String(item.created_at || "").trim(),
      updated_at: String(item.updated_at || "").trim(),
      duplicate_keys: duplicateKeys
    };
  };

  const normalizeDuplicateIndexCache = (value = {}) => {
    const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
    const sourceYears = source.years && typeof source.years === "object" && !Array.isArray(source.years)
      ? source.years
      : {};
    const years = {};

    Object.entries(sourceYears).forEach(([yearKey, entry]) => {
      const normalizedYear = Number.parseInt(String(yearKey || "").trim(), 10);
      if (!isValidRecordYear(normalizedYear)) {
        return;
      }
      const sourceEntry = entry && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
      const items = Array.isArray(sourceEntry.items)
        ? sourceEntry.items.map((item) => normalizeDuplicateIndexItem(item)).filter(Boolean)
        : [];
      years[String(normalizedYear)] = {
        synced_at: String(sourceEntry.synced_at || "").trim(),
        items
      };
    });

    return { years };
  };

  const getDuplicateIndexCache = () => normalizeDuplicateIndexCache(readObjectFromStorage(DUPLICATE_INDEX_CACHE_KEY));
  const setDuplicateIndexCache = (value) => writeObjectToStorage(DUPLICATE_INDEX_CACHE_KEY, normalizeDuplicateIndexCache(value));

  const getDuplicateIndexCacheEntry = (year) => {
    const safeYear = Number.parseInt(String(year || ""), 10);
    if (!isValidRecordYear(safeYear)) {
      return { synced_at: "", items: [] };
    }
    const cache = getDuplicateIndexCache();
    const entry = cache.years[String(safeYear)];
    if (!entry || typeof entry !== "object") {
      return { synced_at: "", items: [] };
    }
    return {
      synced_at: String(entry.synced_at || "").trim(),
      items: Array.isArray(entry.items) ? entry.items : []
    };
  };

  const setDuplicateIndexCacheEntry = (year, items = []) => {
    const safeYear = Number.parseInt(String(year || ""), 10);
    if (!isValidRecordYear(safeYear)) {
      return;
    }
    const cache = getDuplicateIndexCache();
    cache.years[String(safeYear)] = {
      synced_at: new Date().toISOString(),
      items: Array.isArray(items)
        ? items.map((item) => normalizeDuplicateIndexItem(item)).filter(Boolean)
        : []
    };
    setDuplicateIndexCache(cache);
  };

  const upsertDuplicateIndexCacheRecord = (record = {}) => {
    const normalizedRecord = normalizeDuplicateIndexItem(record);
    if (!normalizedRecord) {
      return;
    }
    const existingEntry = getDuplicateIndexCacheEntry(normalizedRecord.record_year);
    const items = Array.isArray(existingEntry.items) ? [...existingEntry.items] : [];
    const index = items.findIndex((item) => String(item?.household_id || "").trim() === normalizedRecord.household_id);
    if (index >= 0) {
      items[index] = normalizedRecord;
    } else {
      items.unshift(normalizedRecord);
    }
    setDuplicateIndexCacheEntry(normalizedRecord.record_year, items);
  };

  const getDuplicateIndexKeysFromRecord = (record = {}) => {
    if (record && typeof record === "object" && Array.isArray(record.duplicate_keys)) {
      return uniqueNonEmptyStrings(record.duplicate_keys);
    }
    return getHouseholdDuplicateKeys(record);
  };

  const duplicateIndexItemsShareKey = (leftRecord, rightRecord) => {
    const leftKeys = getDuplicateIndexKeysFromRecord(leftRecord);
    const rightKeys = getDuplicateIndexKeysFromRecord(rightRecord);
    if (leftKeys.length === 0 || rightKeys.length === 0) {
      return false;
    }
    const rightLookup = new Set(rightKeys);
    return leftKeys.some((key) => rightLookup.has(key));
  };

  const findDuplicateCachedHouseholdRecord = (record) => {
    const currentId = String(record?.household_id || "").trim();
    const recordYear = Number.parseInt(String(record?.record_year || getHouseholdYearFromId(currentId)), 10);
    if (!isValidRecordYear(recordYear)) {
      return null;
    }
    const cacheEntry = getDuplicateIndexCacheEntry(recordYear);
    return cacheEntry.items.find((item) => {
      const itemId = String(item?.household_id || "").trim();
      if (itemId && currentId && itemId === currentId) return false;
      return duplicateIndexItemsShareKey(item, record);
    }) || null;
  };

  const fetchDuplicateIndexPage = async ({ year, limit = DUPLICATE_INDEX_PAGE_SIZE, offset = 0 } = {}) => {
    const safeYear = Number.parseInt(String(year || ""), 10);
    if (!isValidRecordYear(safeYear)) {
      return { items: [], count: 0, limit, offset, has_more: false };
    }

    const params = new URLSearchParams({
      action: "list_household_duplicate_index",
      year: String(safeYear),
      limit: String(limit),
      offset: String(offset)
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
      const message = payload && payload.error
        ? String(payload.error)
        : `Unable to load household duplicate index (${response.status}).`;
      throw new Error(message);
    }

    return payload.data && typeof payload.data === "object"
      ? payload.data
      : { items: [], count: 0, limit, offset, has_more: false };
  };

  const refreshDuplicateIndexForYear = async (year, { force = false } = {}) => {
    const safeYear = Number.parseInt(String(year || ""), 10);
    if (!isValidRecordYear(safeYear) || !isAppOnline()) {
      return getDuplicateIndexCacheEntry(safeYear).items;
    }

    const cacheEntry = getDuplicateIndexCacheEntry(safeYear);
    const cachedAt = Date.parse(String(cacheEntry.synced_at || ""));
    if (!force && cacheEntry.synced_at && Number.isFinite(cachedAt) && (Date.now() - cachedAt) < DUPLICATE_INDEX_CACHE_TTL_MS) {
      return cacheEntry.items;
    }

    const cacheKey = String(safeYear);
    if (duplicateIndexRefreshPromises.has(cacheKey)) {
      return duplicateIndexRefreshPromises.get(cacheKey);
    }

    const refreshPromise = (async () => {
      let offset = 0;
      let keepLoading = true;
      const collected = [];

      while (keepLoading) {
        const data = await fetchDuplicateIndexPage({
          year: safeYear,
          limit: DUPLICATE_INDEX_PAGE_SIZE,
          offset
        });
        const pageItems = Array.isArray(data?.items)
          ? data.items.map((item) => normalizeDuplicateIndexItem(item)).filter(Boolean)
          : [];
        collected.push(...pageItems);

        const count = Number.parseInt(String(data?.count || pageItems.length), 10) || pageItems.length;
        keepLoading = Boolean(data?.has_more) && count > 0;
        offset += count;
      }

      setDuplicateIndexCacheEntry(safeYear, collected);
      return getDuplicateIndexCacheEntry(safeYear).items;
    })().finally(() => {
      duplicateIndexRefreshPromises.delete(cacheKey);
    });

    duplicateIndexRefreshPromises.set(cacheKey, refreshPromise);
    return refreshPromise;
  };

  const warmDuplicateIndexForYear = (year, options = {}) => {
    void refreshDuplicateIndexForYear(year, options).catch(() => {});
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

  const showSavingHouseholdModal = ({ updating = false } = {}) => {
    if (!savingHouseholdModalEl) return;
    if (savingHouseholdHideTimerId) {
      window.clearTimeout(savingHouseholdHideTimerId);
      savingHouseholdHideTimerId = null;
    }
    if (savingHouseholdModalTitle) {
      savingHouseholdModalTitle.textContent = updating ? "Updating Household" : "Saving Household";
    }
    if (savingHouseholdModalMessage) {
      savingHouseholdModalMessage.textContent = updating
        ? "Please wait while we update this household record."
        : "Please wait while we save this household record.";
    }
    savingHouseholdModalEl.hidden = false;
    savingHouseholdModalEl.setAttribute("aria-hidden", "false");
    savingHouseholdModalEl.classList.add("is-visible");
    document.body.classList.add("saving-household-open");
  };

  const hideSavingHouseholdModal = async () => {
    if (!savingHouseholdModalEl) {
      return;
    }
    if (savingHouseholdHideTimerId) {
      window.clearTimeout(savingHouseholdHideTimerId);
      savingHouseholdHideTimerId = null;
    }
    const isVisible = savingHouseholdModalEl.classList.contains("is-visible") || !savingHouseholdModalEl.hidden;
    savingHouseholdModalEl.classList.remove("is-visible");
    savingHouseholdModalEl.setAttribute("aria-hidden", "true");
    document.body.classList.remove("saving-household-open");
    if (!isVisible) {
      savingHouseholdModalEl.hidden = true;
      return;
    }
    await new Promise((resolve) => {
      savingHouseholdHideTimerId = window.setTimeout(() => {
        savingHouseholdModalEl.hidden = true;
        savingHouseholdHideTimerId = null;
        resolve();
      }, 180);
    });
  };

  const showDuplicateHouseholdModal = (duplicate = {}) => {
    const duplicateId = String(duplicate?.household_id || "").trim();
    const duplicateHeadName = String(duplicate?.head_name || "").trim() || "this household";
    const duplicateYear = String(duplicate?.year || "").trim();
    const duplicateSource = String(duplicate?.source || "").trim().toLowerCase();
    const yearText = duplicateYear ? ` for ${duplicateYear}` : "";
    const idText = duplicateId ? ` (${duplicateId})` : "";
    const isPendingDuplicate = duplicateSource === "pending_queue";
    const titleText = isPendingDuplicate ? "Household Already Pending" : "Household Already Exists";
    const messageText = isPendingDuplicate
      ? (duplicateId
        ? `Household record for ${duplicateHeadName}${idText}${yearText} is already in the pending sync queue. Review the pending item instead of saving a duplicate.`
        : `Household record for ${duplicateHeadName}${yearText} is already in the pending sync queue. Review the pending item instead of saving a duplicate.`)
      : (duplicateId
        ? `Household record for ${duplicateHeadName}${idText}${yearText} already exists. Please check the existing household instead of saving a duplicate.`
        : `Household record for ${duplicateHeadName}${yearText} already exists. Please check the existing household instead of saving a duplicate.`);

    if (!duplicateHouseholdModal || !duplicateHouseholdModalEl) {
      showSyncToast(
        isPendingDuplicate
          ? (duplicateId
            ? `Household record for ${duplicateHeadName}${idText} is already pending sync.`
            : `Household record for ${duplicateHeadName}${yearText} is already pending sync.`)
          : (duplicateId
            ? `Household record for ${duplicateHeadName}${idText} already exists.`
            : `Household record for ${duplicateHeadName}${yearText} already exists.`),
        "warning",
        titleText
      );
      return;
    }

    if (duplicateHouseholdModalTitle) {
      duplicateHouseholdModalTitle.textContent = titleText;
    }
    if (duplicateHouseholdModalMessage) {
      duplicateHouseholdModalMessage.textContent = messageText;
    }
    duplicateHouseholdModal.show();
  };

  const cleanupModalArtifactsIfIdle = () => {
    if (document.querySelector(".modal.show")) {
      return;
    }
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => backdrop.remove());
    document.body.classList.remove("modal-open");
    if (!savingHouseholdModalEl || savingHouseholdModalEl.hidden || !savingHouseholdModalEl.classList.contains("is-visible")) {
      document.body.classList.remove("saving-household-open");
    }
    document.body.style.removeProperty("padding-right");
  };

  duplicateHouseholdModalEl?.addEventListener("hidden.bs.modal", cleanupModalArtifactsIfIdle);

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
    const isOffline = !isAppOnline();
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
    updateLoadExistingButtonVisibility();
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

    if (!isAppOnline()) {
      await syncConnectivityState({ force: true });
    }

    if (!isAppOnline()) {
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
      const duplicateMessage = isAppOnline()
        ? (duplicateHouseholdId
          ? `Duplicate found: ${duplicateHouseholdId}. Use Load Existing Household to re-encode changes or delete this pending record.`
          : "Duplicate found. Use Load Existing Household to re-encode changes or delete this pending record.")
        : (duplicateHouseholdId
          ? `Duplicate found: ${duplicateHouseholdId}. Go online, then use Load Existing Household to re-encode changes or delete this pending record.`
          : "Duplicate found. Go online, then use Load Existing Household to re-encode changes or delete this pending record.");
      const errorText = issueCode === "duplicate_household"
        ? duplicateMessage
        : (issueMessage || "Waiting to sync once internet/server is available.");
      const errorClass = issueMessage ? "" : " is-waiting";

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

  const saveRegistration = async () => {
    let record = buildRegistrationRecord();
    let duplicateNotice = null;
    clearSyncSuccessState();
    if (!ensureMemberRequirementForSave(Array.isArray(record.members) ? record.members.length : 0, { closeSaveModal: true })) {
      return false;
    }

    showSavingHouseholdModal({ updating: isEditMode });
    try {
      await syncConnectivityState({ force: true });

      if (!isEditMode) {
        if (isAppOnline()) {
          warmDuplicateIndexForYear(record.record_year);
        }

        const pendingDuplicate = findDuplicatePendingSyncRecord(record);
        if (pendingDuplicate) {
          duplicateNotice = normalizeDuplicateMeta({
            ...pendingDuplicate,
            source: "pending_queue"
          }) || {
            household_id: String(pendingDuplicate?.household_id || "").trim(),
            head_name: String(pendingDuplicate?.head_name || "").trim(),
            year: String(pendingDuplicate?.year || "").trim(),
            source: "pending_queue"
          };
          return false;
        }
      }

      upsertRegistrationRecord(record);
      let queuedByOffline = false;
      let queuedByError = false;
      let syncErrorMessage = "";

      if (isAppOnline()) {
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

            if (statusCode === 409 && errorCode === "duplicate_household") {
              if (!isEditMode) {
                removeRegistrationRecord(record.household_id);
                removeSyncRecord(record.household_id);
              }
              duplicateNotice = normalizeDuplicateMeta({
                ...(duplicate && typeof duplicate === "object" ? duplicate : {}),
                source: "database"
              }) || {
                household_id: String(duplicate?.household_id || "").trim(),
                head_name: String(duplicate?.head_name || "").trim(),
                year: String(duplicate?.year || "").trim(),
                source: "database"
              };
              return false;
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
          upsertDuplicateIndexCacheRecord({
            household_id: String(record.household_id || "").trim(),
            record_year: Number.parseInt(String(record.record_year || ""), 10) || targetRecordYear,
            head_name: String(record.head_name || buildHeadNameFromRecord(record) || "").trim(),
            zone: normalizeZoneLabel(record.zone || record?.head?.zone || ""),
            created_at: String(record.created_at || "").trim(),
            updated_at: String(record.updated_at || new Date().toISOString()).trim(),
            duplicate_keys: getHouseholdDuplicateKeys(record)
          });
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

      if (isAppOnline() && !queuedByError) {
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
    } finally {
      await hideSavingHouseholdModal();
      if (duplicateNotice) {
        showDuplicateHouseholdModal(duplicateNotice);
      }
    }
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
      ])
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

  const countChildrenFromMembers = (members) => members.filter((member) => {
    const relation = String(member?.relation_to_head || "").trim().toLowerCase();
    return relation === "son" || relation === "daughter";
  }).length;

  const syncHouseholdCounts = (members) => {
    let changed = false;

    if (numMembersInput) {
      const nextValue = String(members.length + 1);
      if (numMembersInput.value !== nextValue) {
        numMembersInput.value = nextValue;
        changed = true;
      }
    }

    if (numChildrenInput) {
      const nextValue = String(countChildrenFromMembers(members));
      if (numChildrenInput.value !== nextValue) {
        numChildrenInput.value = nextValue;
        changed = true;
      }
    }

    if (changed) {
      saveHeadData();
    }
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

  const hasLocalDraftState = () => {
    return hasHeadDraft() || getMembers().length > 0;
  };

  const clearRegistrationDraftState = async () => {
    await localStorage.removeItem(HEAD_KEY);
    await localStorage.removeItem(MEMBERS_KEY);
    await localStorage.removeItem(EDIT_KEY);
    try {
      sessionStorage.removeItem(PRESERVE_DRAFT_FLAG_KEY);
    } catch {
      // Ignore session storage errors.
    }
    if (typeof localStorage.flush === "function") {
      await localStorage.flush();
    }
  };

  const setLoadHouseholdLookupEnabled = (enabled) => {
    if (loadHouseholdYear) {
      loadHouseholdYear.disabled = !enabled;
    }
    if (loadHouseholdSearch) {
      loadHouseholdSearch.disabled = !enabled;
    }
    if (loadHouseholdSearchBtn) {
      loadHouseholdSearchBtn.disabled = !enabled;
    }
  };

  const applyLoadHouseholdYearOptions = (years = [], selectedYear = targetRecordYear) => {
    if (!loadHouseholdYear) return 0;
    const options = Array.isArray(years)
      ? years
        .map((value) => Number.parseInt(String(value || ""), 10))
        .filter((year) => isValidRecordYear(year))
      : [];

    if (options.length === 0) {
      loadHouseholdYear.innerHTML = '<option value="">No registered years</option>';
      loadHouseholdYear.value = "";
      return 0;
    }

    const preferredYear = isValidRecordYear(Number(selectedYear)) ? Number(selectedYear) : options[0];
    loadHouseholdYear.innerHTML = options
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
    loadHouseholdYear.value = String(options.includes(preferredYear) ? preferredYear : options[0]);
    return Number.parseInt(String(loadHouseholdYear.value || ""), 10) || 0;
  };

  const fetchLoadHouseholdYears = async () => {
    const response = await fetch(`${SYNC_ENDPOINT}?action=list_household_years`, {
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
      const message = payload && payload.error
        ? String(payload.error)
        : `Unable to load household years (${response.status}).`;
      throw new Error(message);
    }

    return Array.isArray(payload?.data?.years)
      ? payload.data.years
      : [];
  };

  const syncLoadHouseholdYearOptions = async (selectedYear = targetRecordYear) => {
    if (!loadHouseholdYear) return [];

    setLoadHouseholdLookupEnabled(false);
    loadHouseholdYear.innerHTML = '<option value="">Loading years...</option>';
    clearLoadHouseholdResults({ hideEmpty: false });
    setLoadHouseholdEmptyState(
      "Loading years",
      "Checking which household record years are available in the database."
    );
    setLoadHouseholdStatus("");

    try {
      const years = await fetchLoadHouseholdYears();
      const activeYear = applyLoadHouseholdYearOptions(years, selectedYear);

      if (!activeYear) {
        setLoadHouseholdLookupEnabled(false);
        clearLoadHouseholdResults({ hideEmpty: false });
        setLoadHouseholdEmptyState("No registered years", "No household record years are available in the database yet.");
        return [];
      }

      setLoadHouseholdLookupEnabled(true);
      setLoadHouseholdPrompt(`Select year ${activeYear}, enter at least ${LOAD_HOUSEHOLD_MIN_QUERY_LENGTH} characters, then click Search.`);
      return years;
    } catch (error) {
      loadHouseholdYear.innerHTML = '<option value="">Unavailable</option>';
      loadHouseholdYear.value = "";
      setLoadHouseholdLookupEnabled(false);
      clearLoadHouseholdResults({ hideEmpty: false });
      setLoadHouseholdEmptyState("Year lookup unavailable", "The system could not load registered household years right now. Try again in a moment.");
      const message = error instanceof Error ? error.message : "Unable to load household years right now.";
      setLoadHouseholdStatus(message, "danger");
      return [];
    }
  };

  const setLoadHouseholdStatus = (message, tone = "muted") => {
    if (!loadHouseholdStatus) return;
    const text = String(message || "").trim();
    loadHouseholdStatus.textContent = text;
    loadHouseholdStatus.classList.remove("status-danger", "status-success");
    loadHouseholdStatus.classList.toggle("d-none", text.length === 0);
    if (text.length === 0) {
      return;
    }
    if (tone === "danger") {
      loadHouseholdStatus.classList.add("status-danger");
    } else if (tone === "success") {
      loadHouseholdStatus.classList.add("status-success");
    }
  };

  const clearLoadHouseholdResults = ({ hideEmpty = true } = {}) => {
    if (loadHouseholdResults) {
      loadHouseholdResults.innerHTML = "";
    }
    if (loadHouseholdEmpty) {
      loadHouseholdEmpty.classList.toggle("d-none", hideEmpty);
    }
  };

  const setLoadHouseholdEmptyState = (title, message) => {
    if (loadHouseholdEmptyTitle) {
      loadHouseholdEmptyTitle.textContent = String(title || "").trim() || "Ready to search";
    }
    if (loadHouseholdEmptyText) {
      loadHouseholdEmptyText.textContent = String(message || "").trim() || "Select a year, enter a search term, then click Search.";
    }
    if (loadHouseholdEmpty) {
      loadHouseholdEmpty.classList.remove("d-none");
    }
  };

  const setLoadHouseholdPrompt = (message = "") => {
    const year = Number.parseInt(String(loadHouseholdYear?.value || ""), 10);
    const safeYear = isValidRecordYear(year) ? year : targetRecordYear;
    const promptMessage = String(message || "").trim()
      || `Select year ${safeYear}, enter at least ${LOAD_HOUSEHOLD_MIN_QUERY_LENGTH} characters, then click Search.`;
    clearLoadHouseholdResults({ hideEmpty: true });
    setLoadHouseholdEmptyState("Ready to search", promptMessage);
    setLoadHouseholdStatus("");
  };

  const renderLoadHouseholdResults = (items = []) => {
    if (!loadHouseholdResults || !loadHouseholdEmpty) return;
    const rows = Array.isArray(items) ? items : [];
    if (rows.length === 0) {
      loadHouseholdResults.innerHTML = "";
      setLoadHouseholdEmptyState(
        "No households found",
        "Try a different household ID, head name, or year to find a matching record."
      );
      return;
    }

    loadHouseholdEmpty.classList.add("d-none");
    loadHouseholdResults.innerHTML = rows.map((item) => {
      const householdId = String(item?.household_id || "").trim();
      const recordYear = Number(item?.record_year || 0);
      const memberCount = Number(item?.member_count || 0);
      const updatedAt = formatSyncDate(item?.updated_at || item?.created_at || "");
      const rolloverSourceId = String(item?.rollover_source_household_id || "").trim();
      const isCurrentRecord = isEditMode && householdId === editHouseholdId;
      const metaParts = [
        String(item?.zone || "").trim(),
        `${memberCount} member${memberCount === 1 ? "" : "s"}`,
        updatedAt ? `Updated ${updatedAt}` : ""
      ].filter(Boolean);
      const note = rolloverSourceId
        ? `Rolled over from ${rolloverSourceId}`
        : `Source: ${String(item?.source || "registration-module").replace(/-/g, " ")}`;
      const currentTag = isCurrentRecord
        ? '<span class="load-household-result-tag is-current"><i class="bi bi-pencil-square"></i> Current Edit</span>'
        : '<span class="load-household-result-action">Load record <i class="bi bi-chevron-right"></i></span>';

      return `
        <button type="button" class="load-household-result" data-household-id="${escapeHtml(householdId)}" data-record-year="${recordYear}" ${isCurrentRecord ? "disabled" : ""}>
          <div class="load-household-result-head">
            <div class="load-household-result-id">
              <span class="load-household-year-pill">${escapeHtml(recordYear)}</span>
              <span class="load-household-result-code">${escapeHtml(householdId)}</span>
            </div>
            ${currentTag}
          </div>
          <div class="load-household-result-name">${escapeHtml(String(item?.head_name || "Unnamed household head").trim() || "Unnamed household head")}</div>
          <div class="load-household-result-meta">${metaParts.map((part) => `<span>${escapeHtml(part)}</span>`).join("")}</div>
          <div class="load-household-result-note">${escapeHtml(note)}</div>
        </button>
      `;
    }).join("");
  };

  const fetchHouseholdsForLookup = async ({ year, query } = {}) => {
    const safeYear = isValidRecordYear(Number(year)) ? Number(year) : targetRecordYear;
    const trimmedQuery = String(query || "").trim();

    const params = new URLSearchParams({
      action: "list_households",
      limit: "15",
      offset: "0",
      year: String(safeYear)
    });
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    try {
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
        const message = payload && payload.error
          ? String(payload.error)
          : `Unable to load households (${response.status}).`;
        throw new Error(message);
      }

      return Array.isArray(payload?.data?.items) ? payload.data.items : [];
    } catch (error) {
      throw error instanceof Error ? error : new Error("Unable to load households right now.");
    }
  };

  const runLoadHouseholdSearch = async ({ preserveSearch = true } = {}) => {
    if (!loadHouseholdResults || !loadHouseholdYear) return;
    const year = Number.parseInt(String(loadHouseholdYear.value || ""), 10);
    if (!isValidRecordYear(year)) {
      clearLoadHouseholdResults({ hideEmpty: false });
      setLoadHouseholdEmptyState(
        "Select a registered year",
        "Choose a year with household records in the database before searching."
      );
      setLoadHouseholdStatus("Select a registered year first.", "danger");
      return;
    }
    const query = preserveSearch && loadHouseholdSearch
      ? String(loadHouseholdSearch.value || "").trim()
      : "";
    const safeYear = year;
    if (query.length < LOAD_HOUSEHOLD_MIN_QUERY_LENGTH) {
      setLoadHouseholdPrompt(`Enter at least ${LOAD_HOUSEHOLD_MIN_QUERY_LENGTH} characters to search households in ${safeYear}.`);
      return;
    }
    const token = ++loadHouseholdRequestToken;

    clearLoadHouseholdResults({ hideEmpty: true });
    setLoadHouseholdStatus(`Searching ${safeYear} households for "${query}"...`);

    try {
      const items = await fetchHouseholdsForLookup({ year: safeYear, query });
      if (token !== loadHouseholdRequestToken) return;
      renderLoadHouseholdResults(items);
      if (items.length === 0) {
        setLoadHouseholdStatus(`No households matched "${query}" in ${safeYear}.`);
        return;
      }

      setLoadHouseholdStatus(
        `Found ${items.length} household record${items.length === 1 ? "" : "s"} in ${safeYear}.`,
        "success"
      );
    } catch (error) {
      if (token !== loadHouseholdRequestToken) return;
      clearLoadHouseholdResults({ hideEmpty: true });
      const message = error instanceof Error ? error.message : "Unable to load households right now.";
      setLoadHouseholdEmptyState("Search unavailable", "The household lookup could not complete right now. Try again in a moment.");
      setLoadHouseholdStatus(message, "danger");
    }
  };

  const openExistingHouseholdForEdit = async (householdId, recordYear) => {
    const targetHouseholdId = String(householdId || "").trim();
    const safeYear = Number.parseInt(String(recordYear || ""), 10);
    if (!targetHouseholdId) return;

    if (isEditMode && targetHouseholdId === editHouseholdId) {
      loadHouseholdModal?.hide();
      showSyncToast(`You are already editing ${targetHouseholdId}.`, "info", "Load Household");
      return;
    }

    if (hasLocalDraftState()) {
      const shouldLoad = await askPendingActionConfirm({
        title: "Discard Current Draft?",
        message: `Loading ${targetHouseholdId} will replace the household currently in the registration form.`,
        confirmLabel: "Load Household",
        confirmTone: "warning"
      });
      if (!shouldLoad) {
        return;
      }
    }

    await clearRegistrationDraftState();
    loadHouseholdModal?.hide();

    const nextUrl = new URL("registration.php", window.location.href);
    nextUrl.searchParams.set("edit", targetHouseholdId);
    if (isValidRecordYear(safeYear)) {
      nextUrl.searchParams.set("year", String(safeYear));
    }
    window.location.href = nextUrl.toString();
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

  const buildCachedHouseholdRecordFromPayload = (payload) => {
    const data = payload?.data;
    return buildCachedHouseholdRecord(data, data?.record);
  };

  const hydrateDraftFromHouseholdRecord = async (sourceRecord, { cacheRecord = false } = {}) => {
    const record = normalizeLookupHouseholdRecord(sourceRecord);
    if (!record) {
      return false;
    }

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

    if (cacheRecord) {
      upsertRegistrationRecord({
        ...record,
        head,
        members,
        zone: householdZone,
        head_name: buildHeadNameFromRecord({ ...record, head }) || "Unnamed household head",
        member_count: Math.max(Number(record.member_count || 0), members.length + 1)
      });
    }

    if (typeof localStorage.flush === "function") {
      await localStorage.flush();
    }

    return true;
  };

  const hydrateEditModeFromServerIfNeeded = async () => {
    if (!isEditMode || !editHouseholdId) return;
    if (getMembers().length > 0 || hasHeadDraft()) return;

    const storedRecord = getStoredHouseholdRecord(editHouseholdId);
    if (storedRecord) {
      await hydrateDraftFromHouseholdRecord(storedRecord);
      return;
    }

    try {
      const payload = await fetchHouseholdRecordFromServer(editHouseholdId);
      const serverRecord = buildCachedHouseholdRecordFromPayload(payload);
      if (serverRecord) {
        await hydrateDraftFromHouseholdRecord(serverRecord, { cacheRecord: true });
        return;
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
    updatePregnantVisibility();
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

  if (sexInput) {
    sexInput.addEventListener("input", updatePregnantVisibility);
    sexInput.addEventListener("change", updatePregnantVisibility);
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
      nextUrl.searchParams.set("year", String(targetRecordYear));
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
      { label: "Relationship to Head", value: member.relation_to_head }
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
    syncHouseholdCounts(members);

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

    syncMemberActionButtons(members);

    if (!members.length) {
      return;
    }

    if (membersContainer) {
      membersContainer.innerHTML = members.map((member, index) => {
      const canDeleteMembers = canDeleteMembersInCurrentFlow();
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
            ${canDeleteMembers ? `
            <button type="button" class="btn btn-sm btn-danger remove-member" data-index="${index}">
              <i class="bi bi-trash"></i> Delete
            </button>
            ` : ""}
          </div>
        </div>
      `;
      }).join("");
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
        syncMemberActionButtons(members);
        renderMemberModal(member);
        memberModal?.show();
        return;
      }

      if (!canDeleteMembersInCurrentFlow()) {
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
      syncMemberActionButtons(members);
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

  window.addEventListener("online", async () => {
    clearSyncSuccessState();
    serverReachable = true;
    updateSyncStatus();
    updateLoadExistingButtonVisibility();
    await syncConnectivityState({ force: true });
    updateSyncStatus();
    warmDuplicateIndexForYear(targetRecordYear, { force: true });
    flushSyncQueue({ showSuccessState: true });
  });

  window.addEventListener("offline", async () => {
    clearSyncSuccessState();
    await syncConnectivityState({ force: true });
    updateSyncStatus();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    void syncConnectivityState({ force: true }).then(() => {
      updateSyncStatus();
      if (isAppOnline()) {
        warmDuplicateIndexForYear(targetRecordYear);
      }
    });
  });

  window.addEventListener("focus", () => {
    void syncConnectivityState({ force: true }).then(() => {
      updateSyncStatus();
      if (isAppOnline()) {
        warmDuplicateIndexForYear(targetRecordYear);
      }
    });
  });

  window.setInterval(() => {
    if (document.hidden) {
      return;
    }

    void syncConnectivityState({ force: true }).then(() => {
      updateSyncStatus();
      updateLoadExistingButtonVisibility();
    });
  }, CONNECTIVITY_REFRESH_INTERVAL_MS);

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
      } finally {
        pendingActionBusy = false;
        renderPendingSyncModal();
      }
    });
  }

  if (loadExistingBtn) {
    loadExistingBtn.addEventListener("click", async () => {
      if (isEditMode) {
        window.location.href = buildEditModeReturnUrl();
        return;
      }
      await syncConnectivityState({ force: true });
      if (!isAppOnline()) {
        updateLoadExistingButtonVisibility();
        return;
      }
      if (loadHouseholdSearch) {
        loadHouseholdSearch.value = "";
      }
      loadHouseholdModal?.show();
    });
  }

  if (loadHouseholdModalEl) {
    loadHouseholdModalEl.addEventListener("show.bs.modal", () => {
      if (loadHouseholdSearch) {
        loadHouseholdSearch.value = "";
      }
      void syncLoadHouseholdYearOptions(targetRecordYear);
    });

    loadHouseholdModalEl.addEventListener("shown.bs.modal", () => {
      loadHouseholdSearch?.focus();
    });

    loadHouseholdModalEl.addEventListener("hidden.bs.modal", () => {
      loadHouseholdRequestToken += 1;
    });
  }

  if (loadHouseholdYear) {
    loadHouseholdYear.addEventListener("change", () => {
      setLoadHouseholdPrompt();
    });
  }

  if (loadHouseholdSearchBtn) {
    loadHouseholdSearchBtn.addEventListener("click", () => {
      runLoadHouseholdSearch();
    });
  }

  if (loadHouseholdSearch) {
    loadHouseholdSearch.addEventListener("input", () => {
      const query = String(loadHouseholdSearch.value || "").trim();
      if (query.length === 0) {
        setLoadHouseholdPrompt();
        return;
      }
      clearLoadHouseholdResults({ hideEmpty: true });
      setLoadHouseholdEmptyState(
        "Search ready",
        `Press Search to find matching households in ${loadHouseholdYear?.value || targetRecordYear}.`
      );
      setLoadHouseholdStatus("");
    });

    loadHouseholdSearch.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      runLoadHouseholdSearch();
    });
  }

  if (loadHouseholdResults) {
    loadHouseholdResults.addEventListener("click", async (event) => {
      const resultButton = event.target.closest(".load-household-result");
      if (!resultButton || resultButton.disabled) return;
      const householdId = String(resultButton.dataset.householdId || "").trim();
      const recordYear = Number.parseInt(String(resultButton.dataset.recordYear || ""), 10);
      await openExistingHouseholdForEdit(householdId, recordYear);
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
  await syncConnectivityState({ force: true });
  updateSyncStatus();
  if (isAppOnline()) {
    warmDuplicateIndexForYear(targetRecordYear, { force: true });
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
      if (!canDeleteMembersInCurrentFlow()) return;
      if (currentMemberIndex === null) return;
      deleteMemberModal?.show();
    });
  }

  if (deleteMemberConfirm) {
    deleteMemberConfirm.addEventListener("click", () => {
      if (!canDeleteMembersInCurrentFlow()) return;
      if (currentMemberIndex === null) return;
      const members = getMembers();
      if (!members[currentMemberIndex]) return;
      members.splice(currentMemberIndex, 1);
      setMembers(members);
      renderMembers();
      currentMemberIndex = null;
      syncMemberActionButtons(members);
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
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      clearModal?.show();
    });
  }
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
  if (staffCredentialsModalEl) {
    staffCredentialsModalEl.addEventListener("shown.bs.modal", () => {
      staffCredentialsCurrentPassword?.focus();
    });
    staffCredentialsModalEl.addEventListener("hidden.bs.modal", () => {
      if (!requiresCredentialUpdate) {
        resetStaffCredentialFields();
        setStaffCredentialsMode("optional");
      }
    });
  }
  if (openStaffAccountSettingsBtn) {
    openStaffAccountSettingsBtn.addEventListener("click", () => {
      openStaffCredentialsModal("optional");
    });
  }
  if (staffCredentialsSaveBtn) {
    staffCredentialsSaveBtn.addEventListener("click", async () => {
      if (staffCredentialSaveBusy) {
        return;
      }

      const originalText = staffCredentialsSaveBtn.textContent;
      staffCredentialSaveBusy = true;
      staffCredentialsSaveBtn.disabled = true;
      staffCredentialsSaveBtn.textContent = "Saving...";
      try {
        const result = await submitStaffCredentialUpdate();
        requiresCredentialUpdate = false;
        currentSessionUsername = result.newUsername;
        document.body.dataset.requiresCredentialUpdate = "false";
        document.body.dataset.currentUsername = result.newUsername;
        setStaffCredentialsNotice(
          result.payload?.message || "Credentials updated successfully. Reloading registration...",
          "success"
        );
        window.setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to update credentials right now.";
        setStaffCredentialsNotice(message, "danger");
      } finally {
        staffCredentialSaveBusy = false;
        staffCredentialsSaveBtn.disabled = false;
        staffCredentialsSaveBtn.textContent = originalText || "Save Changes";
      }
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

  if (requiresCredentialUpdate) {
    window.setTimeout(() => {
      openStaffCredentialsModal("required");
    }, 0);
  }
});
