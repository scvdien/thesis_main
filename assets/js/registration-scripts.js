document.getElementById("year").textContent = "2026";

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
  const localStorage = window.createIndexedStorageProxy
    ? window.createIndexedStorageProxy([
        MEMBERS_KEY,
        EDIT_KEY,
        HEAD_KEY,
        REGISTRATION_RECORDS_KEY,
        SYNC_QUEUE_KEY,
        LAST_SYNC_KEY
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
  const sidebarMembersToggle = document.getElementById("sidebarMembersToggle");
  const sidebarMembersSection = document.querySelector(".sidebar-members");
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
  const replaceHouseholdModalEl = document.getElementById("replaceHouseholdModal");
  const replaceHouseholdModal = replaceHouseholdModalEl ? new bootstrap.Modal(replaceHouseholdModalEl) : null;
  const replaceHouseholdMessage = document.getElementById("replaceHouseholdMessage");
  const replaceHouseholdConfirm = document.getElementById("replaceHouseholdConfirm");
  const syncToastEl = document.getElementById("syncToast");
  const syncToastTitle = document.getElementById("syncToastTitle");
  const syncToastBody = document.getElementById("syncToastBody");
  const syncToastIcon = document.getElementById("syncToastIcon");
  const syncToast = syncToastEl
    ? bootstrap.Toast.getOrCreateInstance(syncToastEl, { autohide: false })
    : null;
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

  const setMembersCollapsed = (collapsed) => {
    if (!sidebarMembersSection) return;
    sidebarMembersSection.classList.toggle("is-collapsed", collapsed);
    if (sidebarMembersToggle) {
      sidebarMembersToggle.setAttribute("aria-expanded", String(!collapsed));
    }
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
    const head = serializeHeadData();
    const members = getMembers();
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
      zone: String(head.zone || "").trim(),
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

  const askReplaceExistingHousehold = (duplicateLabel, duplicateId) => {
    const message = `A household record already exists for ${duplicateLabel}${duplicateId ? ` (${duplicateId})` : ""}. Do you want to replace the existing household?`;

    if (!replaceHouseholdModal || !replaceHouseholdModalEl || !replaceHouseholdConfirm) {
      return Promise.resolve(window.confirm(message));
    }

    if (replaceHouseholdMessage) {
      replaceHouseholdMessage.textContent = message;
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const onConfirm = () => {
        finish(true);
        replaceHouseholdModal.hide();
      };

      const onHidden = () => {
        replaceHouseholdConfirm.removeEventListener("click", onConfirm);
        finish(false);
      };

      replaceHouseholdConfirm.addEventListener("click", onConfirm, { once: true });
      replaceHouseholdModalEl.addEventListener("hidden.bs.modal", onHidden, { once: true });
      replaceHouseholdModal.show();
    });
  };

  const upsertRegistrationRecord = (record) => {
    const records = getRegistrationRecords();
    const targetId = String(record?.household_id || "");
    const index = records.findIndex((item) => String(item?.household_id || "") === targetId);
    if (index >= 0) {
      records[index] = {
        ...records[index],
        ...record
      };
    } else {
      records.unshift(record);
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
    const targetId = String(record?.household_id || "");
    const index = queue.findIndex((item) => String(item?.household_id || "") === targetId);
    if (index >= 0) {
      queue[index] = {
        ...queue[index],
        ...record
      };
    } else {
      queue.push(record);
    }
    setSyncQueue(queue);
    return queue.length;
  };

  const removeSyncRecord = (householdId) => {
    const targetId = String(householdId || "").trim();
    if (!targetId) return getSyncQueue().length;
    const nextQueue = getSyncQueue().filter((item) => String(item?.household_id || "") !== targetId);
    setSyncQueue(nextQueue);
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
    const suffix = pendingCount === 1 ? "" : "s";
    const successActive = !isOffline
      && !syncInProgress
      && pendingCount === 0
      && Boolean(syncSuccessMessage)
      && Date.now() < syncSuccessExpiresAt;
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
      badgeText = "Syncing";
      badgeTone = "syncing";
      description = `Syncing data (${pendingCount} household${suffix})...`;
    } else if (lastSyncedAt) {
      const formatted = formatSyncDate(lastSyncedAt);
      description = formatted ? `Last synced ${formatted}.` : description;
    }

    if (syncStatusBadge) {
      syncStatusBadge.className = `sync-badge sync-badge-${badgeTone}`;
      syncStatusBadge.textContent = badgeText;
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
  };

  const syncRecordToServer = async (record) => {
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
          record
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

    while (queue.length) {
      const nextRecord = queue[0];
      try {
        await syncRecordToServer(nextRecord);
        queue.shift();
        setSyncQueue(queue);
        syncedCount += 1;
      } catch (error) {
        syncError = error instanceof Error ? error.message : "Unable to sync right now.";
        break;
      }
    }

    syncInProgress = false;

    if (syncedCount > 0 && queue.length === 0) {
      setLastSyncedAt(new Date().toISOString());
    }

    if (!syncError && syncedCount > 0 && queue.length === 0 && showSuccessState) {
      const suffix = syncedCount === 1 ? "" : "s";
      showSyncSuccessState(`Sync successfully. ${syncedCount} household${suffix} uploaded.`);
    } else {
      updateSyncStatus();
    }

    if (showFeedback) {
      if (syncError) {
        showSyncToast(`Sync stopped: ${syncError}`, "danger", "Sync Failed");
        return;
      }
      showSyncToast(`Sync complete. ${syncedCount} household${syncedCount === 1 ? "" : "s"} uploaded.`, "success", "Sync Complete");
    }
  };

  const saveRegistration = async () => {
    let record = buildRegistrationRecord();
    const initialHouseholdId = String(record.household_id || "").trim();
    clearSyncSuccessState();
    if (!ensureMemberRequirementForSave(Array.isArray(record.members) ? record.members.length : 0, { closeSaveModal: true })) {
      return false;
    }

    if (!isEditMode) {
      const duplicate = findDuplicateHouseholdRecord(record);
      if (duplicate) {
        const duplicateLabel = duplicate.head_name || "existing household";
        const shouldReplace = await askReplaceExistingHousehold(duplicateLabel, duplicate.household_id);
        if (!shouldReplace) {
          return false;
        }
        record.household_id = String(duplicate.household_id || record.household_id);
        record.created_at = duplicate.created_at || record.created_at;
        record.mode = "replace";
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
            const shouldReplace = await askReplaceExistingHousehold(
              String(duplicate?.head_name || "existing household"),
              duplicateHouseholdId
            );

            if (!shouldReplace) {
              if (!isEditMode) {
                removeRegistrationRecord(initialHouseholdId);
                removeSyncRecord(initialHouseholdId);
              }
              syncInProgress = false;
              updateSyncStatus();
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
      } catch (error) {
        queuedByError = true;
        syncErrorMessage = error instanceof Error ? error.message : "Unable to sync right now.";
        upsertSyncRecord(record);
      } finally {
        syncInProgress = false;
        updateSyncStatus();
      }
    } else {
      queuedByOffline = true;
      upsertSyncRecord(record);
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
        { label: "Zone/Purok", value: valueOf("zone") },
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

      const head = record.head && typeof record.head === "object" ? record.head : {};
      const members = Array.isArray(record.members) ? record.members.filter((row) => row && typeof row === "object") : [];

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

  const headFields = [
    document.querySelector('input[name="first_name"]'),
    document.querySelector('input[name="last_name"]'),
    document.getElementById("sex"),
    document.getElementById("birthday"),
    document.querySelector('select[name="civil_status"]'),
    document.querySelector('input[name="contact"]'),
    document.querySelector('input[name="address"]')
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
      { label: "Zone/Purok", value: member.zone },
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
      try {
        saveModal?.hide();
        saved = await saveRegistration();
      } finally {
        saveConfirm.disabled = false;
        saveConfirm.textContent = originalText || (isEditMode ? "Update" : "Save");
        if (!saved) {
          saveModal?.show();
        }
      }
    });
  }
});
