(async () => {
  document.getElementById("year").textContent = String(new Date().getFullYear());

    const params = new URLSearchParams(window.location.search);
    const isHouseholdViewMode = params.get("mode") === "household-view";
    const householdIdFromQuery = params.get("hid") || "";
    const roleFromQuery = params.get("role") || "";
    const editHouseholdIdFromQuery = params.get("edit") || "";
    const registrationYearFromQuery = params.get("year") || "";
    const editReturnSourceFromQuery = params.get("from") || "";
    const editReturnIdFromQuery = params.get("return_id") || "";
    const PRESERVE_DRAFT_FLAG_KEY = "registration_preserve_draft";

    const MEMBERS_KEY = isHouseholdViewMode ? "household_view_temp_members" : "household_members";
    const EDIT_KEY = isHouseholdViewMode ? "household_view_temp_edit_index" : "household_member_edit_index";
    const MEMBER_FORM_DRAFT_KEY = isHouseholdViewMode ? "household_view_temp_member_form_draft" : "household_member_form_draft";
    const VIEW_CONTEXT_KEY = "household_view_context";
    const VIEW_RESULT_KEY = "household_view_edit_result";
    const MEMBER_DRAFT_OWNER_KEY = isHouseholdViewMode
      ? "household_view_member_draft_owner"
      : "household_member_draft_owner";
    const REGISTRATION_DRAFT_OWNER_KEY = "household_registration_draft_owner";
    const REGISTRATION_RECORDS_KEY = "household_registration_records";
    const SYNC_QUEUE_KEY = "household_registration_sync_queue";
    const localStorage = window.createIndexedStorageProxy
      ? window.createIndexedStorageProxy([
          MEMBERS_KEY,
          EDIT_KEY,
          MEMBER_FORM_DRAFT_KEY,
          VIEW_CONTEXT_KEY,
          VIEW_RESULT_KEY,
          REGISTRATION_RECORDS_KEY,
          SYNC_QUEUE_KEY
        ])
      : window.localStorage;
    const memberForm = document.getElementById("memberForm");
    const sexSelect = document.getElementById("sex");
    const birthdayInput = document.getElementById("birthday");
    const ageInput = document.getElementById("age");
    const pageTitle = document.querySelector(".page-header .title");
    const backBtn = document.getElementById("backBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const clearBtn = document.getElementById("clearBtn");
    const submitBtn = memberForm.querySelector('button[type="submit"]');
    const educationSelect = document.getElementById("education");
    const memberEducationSubfields = Array.from(document.querySelectorAll(".member-education-subfield"));

    const updateMemberEducationVisibility = () => {
      if (!educationSelect) return;
      const isNoFormal = String(educationSelect.value || "").trim().toLowerCase() === "no formal education";
      memberEducationSubfields.forEach((field) => {
        field.style.display = isNoFormal ? "none" : "";
      });
      if (isNoFormal) {
        const degreeInput = document.getElementById("degree");
        const schoolNameInput = document.getElementById("school_name");
        const schoolTypeSelect = document.getElementById("school_type");
        const dropoutSelect = document.getElementById("dropout");
        const osySelect = document.getElementById("osy");
        const studyingSelect = document.getElementById("currently_studying");

        if (degreeInput) degreeInput.value = "";
        if (schoolNameInput) schoolNameInput.value = "";
        if (schoolTypeSelect) schoolTypeSelect.value = "";
        if (dropoutSelect) dropoutSelect.value = "No";
        if (osySelect) osySelect.value = "No";
        if (studyingSelect) studyingSelect.value = "No";
      }
    };
    const memberProfilePhotoInput = document.getElementById("memberProfilePhotoInput");
    const memberProfilePhotoCaptureBtn = document.getElementById("memberProfilePhotoCaptureBtn");
    const memberProfilePhotoPreview = document.getElementById("memberProfilePhotoPreview");
    const memberProfilePhotoPlaceholder = document.getElementById("memberProfilePhotoPlaceholder");
    const memberProfilePhotoTriggerText = document.getElementById("memberProfilePhotoTriggerText");
    const memberProfilePhotoRemoveBtn = document.getElementById("memberProfilePhotoRemoveBtn");
    const memberProfilePhotoStatus = document.getElementById("memberProfilePhotoStatus");
    const photoStorage = window.registrationPhotoStorage || null;
    const photoCaptureApi = window.HouseholdPhotoCapture || null;
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
    const currentUserId = String(document.body?.dataset.currentUserId || "").trim();
    let suppressMemberFormDraft = false;
    let saveMemberFormDraft = () => {};
    let currentClientMemberId = "";
    let originalSelectedClientMemberId = "";
    let originalSelectedIdentityFingerprint = "";
    let currentProfilePhotoId = "";
    let originalProfilePhotoId = "";
    let currentPreviewObjectUrl = "";
    let profilePhotoPreviewToken = 0;
    let discardPendingCapturedPhoto = false;
    let abandoningMemberForm = false;
    let isSubmittingMember = false;
    let photoStorageUsable = false;
    let indexedStorageResponsive = typeof localStorage.ready !== "function";
    const activePhotoMutations = new Set();
    const stagedProfilePhotoIds = new Set();
    const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const normalizeProfilePhotoId = (value) => {
      const normalized = String(value || "").trim();
      return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : "";
    };
    const normalizeClientMemberId = (value) => {
      const normalized = String(value || "").trim();
      return UUID_PATTERN.test(normalized) ? normalized.toLowerCase() : "";
    };
    const memberIdentityFingerprint = (member) => {
      const parts = [
        member?.first_name,
        member?.middle_name,
        member?.last_name,
        member?.extension_name,
        member?.birthday,
        member?.sex
      ].map((part) => String(part || "").trim().replace(/\s+/g, " ").toLowerCase());
      return parts.some(Boolean) ? parts.join("|") : "";
    };

    const waitWithTimeout = (operation, timeoutMs, timeoutMessage) => new Promise((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(timeoutMessage));
      }, timeoutMs);

      Promise.resolve(operation).then(
        (value) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });

    const settleIndexedStorageOperation = async (operation) => {
      if (!indexedStorageResponsive) {
        void Promise.resolve(operation).catch(() => {});
        return;
      }
      try {
        await waitWithTimeout(operation, 4000, "Offline draft storage did not respond.");
      } catch {
        indexedStorageResponsive = false;
      }
    };

    const createStableClientMemberId = () => {
      if (typeof photoStorage?.createPhotoId === "function") {
        return photoStorage.createPhotoId();
      }
      if (typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
      }

      const bytes = new Uint8Array(16);
      if (typeof window.crypto?.getRandomValues === "function") {
        window.crypto.getRandomValues(bytes);
      } else {
        for (let index = 0; index < bytes.length; index += 1) {
          bytes[index] = Math.floor(Math.random() * 256);
        }
      }
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
      return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    };

    const setMemberPhotoStatus = (message = "", tone = "muted") => {
      if (!memberProfilePhotoStatus) return;
      memberProfilePhotoStatus.textContent = String(message || "");
      memberProfilePhotoStatus.classList.remove("text-muted", "text-success", "text-danger");
      memberProfilePhotoStatus.classList.add(
        tone === "danger" ? "text-danger" : (tone === "success" ? "text-success" : "text-muted")
      );
    };

    const revokeObjectUrl = (value) => {
      const objectUrl = String(value || "");
      if (!objectUrl || typeof window.URL?.revokeObjectURL !== "function") return;
      window.URL.revokeObjectURL(objectUrl);
    };

    const revokeCurrentPreviewObjectUrl = () => {
      if (!currentPreviewObjectUrl) return;
      revokeObjectUrl(currentPreviewObjectUrl);
      currentPreviewObjectUrl = "";
    };

    const removeLocalPhoto = async (photoId) => {
      const normalizedPhotoId = normalizeProfilePhotoId(photoId);
      if (!normalizedPhotoId || !photoStorageUsable || !photoStorage?.remove) return false;
      try {
        await photoStorage.remove(normalizedPhotoId, {
          expectedOwnerUserId: currentUserId
        });
        return true;
      } catch {
        return false;
      }
    };

    const storedMembersReferencePhoto = (photoId) => {
      const normalizedPhotoId = normalizeProfilePhotoId(photoId);
      if (!normalizedPhotoId) return false;
      try {
        const storedMembers = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
        return Array.isArray(storedMembers) && storedMembers.some(
          (member) => normalizeProfilePhotoId(member?.profile_photo_id) === normalizedPhotoId
        );
      } catch {
        return true;
      }
    };

    const persistedRecordsReferencePhoto = (photoId) => {
      const normalizedPhotoId = normalizeProfilePhotoId(photoId);
      if (!normalizedPhotoId) return false;
      const recordReferencesPhoto = (record) => {
        if (!record || typeof record !== "object") return false;
        if (normalizeProfilePhotoId(record.head?.profile_photo_id) === normalizedPhotoId) return true;
        return Array.isArray(record.members) && record.members.some(
          (member) => normalizeProfilePhotoId(member?.profile_photo_id) === normalizedPhotoId
        );
      };

      try {
        return [REGISTRATION_RECORDS_KEY, SYNC_QUEUE_KEY].some((key) => {
          const records = JSON.parse(localStorage.getItem(key) || "[]");
          return Array.isArray(records) && records.some(recordReferencesPhoto);
        });
      } catch {
        return true;
      }
    };

    const removeStagedProfilePhoto = async (photoId) => {
      const normalizedPhotoId = normalizeProfilePhotoId(photoId);
      if (!normalizedPhotoId
        || !stagedProfilePhotoIds.has(normalizedPhotoId)
        || persistedRecordsReferencePhoto(normalizedPhotoId)
        || storedMembersReferencePhoto(normalizedPhotoId)) {
        return;
      }
      if (await removeLocalPhoto(normalizedPhotoId)) {
        stagedProfilePhotoIds.delete(normalizedPhotoId);
      }
    };

    const trackPhotoMutation = (operation) => {
      const trackedOperation = Promise.resolve(operation);
      activePhotoMutations.add(trackedOperation);
      trackedOperation.then(
        () => activePhotoMutations.delete(trackedOperation),
        () => activePhotoMutations.delete(trackedOperation)
      );
      return trackedOperation;
    };

    const waitForPhotoMutations = async () => {
      while (memberProfilePhotoController?.isProcessing() || activePhotoMutations.size > 0) {
        if (activePhotoMutations.size > 0) {
          await Promise.allSettled(Array.from(activePhotoMutations));
          continue;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 25));
      }
    };

    const handleMemberProfilePhotoChange = async (value) => {
      const nextValue = String(value || "").trim();
      const previousPhotoId = currentProfilePhotoId;

      if (nextValue && (abandoningMemberForm || discardPendingCapturedPhoto)) {
        discardPendingCapturedPhoto = false;
        currentProfilePhotoId = "";
        window.setTimeout(() => {
          void memberProfilePhotoController?.setValue("");
          setMemberPhotoStatus("No photo yet");
        }, 0);
        return;
      }

      if (!nextValue) {
        currentProfilePhotoId = "";
        profilePhotoPreviewToken += 1;
        revokeCurrentPreviewObjectUrl();
        saveMemberFormDraft();
        await removeStagedProfilePhoto(previousPhotoId);
        return;
      }

      if (!photoStorageUsable || !photoStorage?.put || !photoStorage?.createPhotoId || !photoCaptureApi?.dataUrlToBlob) {
        throw new Error("Photo storage is unavailable. Close other open system tabs, then reload this page.");
      }

      profilePhotoPreviewToken += 1;
      const blob = photoCaptureApi.dataUrlToBlob(nextValue);
      const photoId = photoStorage.createPhotoId();
      try {
        await photoStorage.put({
          photoId,
          blob,
          subjectType: "member",
          ownerUserId: currentUserId,
          mimeType: blob.type
        });
      } catch (error) {
        if (abandoningMemberForm || discardPendingCapturedPhoto) {
          discardPendingCapturedPhoto = false;
          window.setTimeout(() => {
            void memberProfilePhotoController?.setValue("");
            setMemberPhotoStatus("No photo yet");
          }, 0);
          return;
        }
        throw error;
      }

      if (abandoningMemberForm || discardPendingCapturedPhoto) {
        discardPendingCapturedPhoto = false;
        await removeLocalPhoto(photoId);
        window.setTimeout(() => {
          void memberProfilePhotoController?.setValue("");
        }, 0);
        return;
      }

      stagedProfilePhotoIds.add(photoId);
      currentProfilePhotoId = photoId;
      revokeCurrentPreviewObjectUrl();
      saveMemberFormDraft();
      await removeStagedProfilePhoto(previousPhotoId);
    };

    const photoCaptureFactory = photoCaptureApi?.create;
    const memberProfilePhotoController = typeof photoCaptureFactory === "function"
      ? photoCaptureFactory({
          fileInput: memberProfilePhotoInput,
          triggerButton: memberProfilePhotoCaptureBtn,
          previewImage: memberProfilePhotoPreview,
          placeholder: memberProfilePhotoPlaceholder,
          removeButton: memberProfilePhotoRemoveBtn,
          triggerText: memberProfilePhotoTriggerText,
          status: memberProfilePhotoStatus,
          initialValue: "",
          maxWidth: 640,
          maxHeight: 640,
          maxOutputBytes: 180 * 1024,
          quality: 0.8,
          emptyLabel: "Open Camera",
          filledLabel: "Retake",
          onChange: (value) => trackPhotoMutation(handleMemberProfilePhotoChange(value))
        })
      : null;

    const replaceMemberPhotoPreview = async (value, isObjectUrl = false) => {
      const previousObjectUrl = currentPreviewObjectUrl;
      await memberProfilePhotoController?.setValue(value);
      currentPreviewObjectUrl = isObjectUrl ? String(value || "") : "";
      if (previousObjectUrl && previousObjectUrl !== currentPreviewObjectUrl) {
        revokeObjectUrl(previousObjectUrl);
      }
    };

    const renderMemberProfilePhoto = async (photoId) => {
      const normalizedPhotoId = normalizeProfilePhotoId(photoId);
      const token = ++profilePhotoPreviewToken;
      currentProfilePhotoId = normalizedPhotoId;

      if (!normalizedPhotoId) {
        await replaceMemberPhotoPreview("");
        setMemberPhotoStatus("No photo yet");
        return;
      }

      setMemberPhotoStatus("Processing...");
      let previewSource = null;
      try {
        previewSource = photoStorageUsable
          ? await photoStorage?.getPreviewSource(normalizedPhotoId, {
              expectedOwnerUserId: currentUserId
            })
          : null;
      } catch {
        previewSource = null;
      }

      if (!previewSource?.src) {
        previewSource = {
          src: `registration-photo.php?id=${encodeURIComponent(normalizedPhotoId)}`,
          isObjectUrl: false
        };
      }

      if (token !== profilePhotoPreviewToken) {
        if (previewSource.isObjectUrl) revokeObjectUrl(previewSource.src);
        return;
      }

      await replaceMemberPhotoPreview(previewSource.src, previewSource.isObjectUrl === true);
    };

    if (isHouseholdViewMode) {
      if (backBtn) {
        backBtn.innerHTML = '<i class="bi bi-arrow-left"></i> Back to Household';
      }
      if (cancelBtn) {
        cancelBtn.innerHTML = '<i class="bi bi-arrow-left"></i> Back to Household';
      }
    }

    const getHouseholdViewContext = () => {
      try {
        return JSON.parse(localStorage.getItem(VIEW_CONTEXT_KEY) || "{}");
      } catch (error) {
        return {};
      }
    };

    const hasMemberTempState = () => {
      try {
        const storedMembers = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
        if (Array.isArray(storedMembers) && storedMembers.length > 0) return true;
      } catch {
        return true;
      }
      if (localStorage.getItem(EDIT_KEY) !== null || localStorage.getItem(MEMBER_FORM_DRAFT_KEY)) {
        return true;
      }
      return isHouseholdViewMode
        && Boolean(localStorage.getItem(VIEW_CONTEXT_KEY) || localStorage.getItem(VIEW_RESULT_KEY));
    };

    const clearMemberTempStateWithoutPhotoCleanup = async () => {
      const keys = [MEMBERS_KEY, EDIT_KEY, MEMBER_FORM_DRAFT_KEY];
      if (isHouseholdViewMode) {
        keys.push(VIEW_CONTEXT_KEY, VIEW_RESULT_KEY);
      }
      await Promise.all(keys.map((key) => settleIndexedStorageOperation(localStorage.removeItem(key))));
      if (typeof localStorage.flush === "function") {
        await settleIndexedStorageOperation(localStorage.flush());
      }
    };

    const isTrustedCurrentMemberHandoff = () => {
      if (!currentUserId) return false;
      if (!isHouseholdViewMode) {
        try {
          const referrer = new URL(document.referrer);
          return referrer.origin === window.location.origin
            && /\/registration\.php$/i.test(referrer.pathname)
            && String(window.localStorage.getItem(REGISTRATION_DRAFT_OWNER_KEY) || "").trim()
              === currentUserId;
        } catch {
          return false;
        }
      }

      try {
        const referrer = new URL(document.referrer);
        if (referrer.origin !== window.location.origin || !/\/household-view\.php$/i.test(referrer.pathname)) {
          return false;
        }
        const context = getHouseholdViewContext();
        const expectedHouseholdId = String(householdIdFromQuery || "").trim().toLowerCase();
        const contextHouseholdId = String(context?.householdId || "").trim().toLowerCase();
        const storedMembers = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
        const storedEditIndex = Number(localStorage.getItem(EDIT_KEY));
        return Boolean(expectedHouseholdId)
          && contextHouseholdId === expectedHouseholdId
          && Array.isArray(storedMembers)
          && Number.isInteger(storedEditIndex)
          && storedEditIndex >= 0
          && storedEditIndex < storedMembers.length;
      } catch {
        return false;
      }
    };

    const claimMemberTempStateForCurrentUser = async () => {
      if (!currentUserId) {
        if (hasMemberTempState()) {
          await clearMemberTempStateWithoutPhotoCleanup();
        }
        return;
      }

      let previousOwner = "";
      try {
        previousOwner = String(window.localStorage.getItem(MEMBER_DRAFT_OWNER_KEY) || "").trim();
      } catch {
        if (hasMemberTempState()) {
          await clearMemberTempStateWithoutPhotoCleanup();
        }
        return;
      }

      const canClaimCurrentHandoff = isTrustedCurrentMemberHandoff();
      if (canClaimCurrentHandoff && isHouseholdViewMode && previousOwner !== currentUserId) {
        await settleIndexedStorageOperation(localStorage.removeItem(MEMBER_FORM_DRAFT_KEY));
      }
      if (hasMemberTempState() && previousOwner !== currentUserId && !canClaimCurrentHandoff) {
        await clearMemberTempStateWithoutPhotoCleanup();
      }

      try {
        window.localStorage.setItem(MEMBER_DRAFT_OWNER_KEY, currentUserId);
      } catch {
        // The form still works, but no device-local state is trusted across accounts.
      }
    };

    const releaseMemberTempStateClaim = () => {
      try {
        window.localStorage.removeItem(MEMBER_DRAFT_OWNER_KEY);
      } catch {
        // Ignore browser storage access errors during navigation.
      }
    };

    const setPreserveDraftFlag = () => {
      try {
        sessionStorage.setItem(PRESERVE_DRAFT_FLAG_KEY, "1");
      } catch (error) {
        // Ignore sessionStorage access errors.
      }
    };

    const calculateAge = (dateValue) => {
      if (!dateValue) return "";
      const birthDate = new Date(dateValue);
      if (Number.isNaN(birthDate.getTime())) return "";
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
      return age < 0 ? "" : age;
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

    const buildMemberFullName = (member) => [
      member?.first_name,
      member?.middle_name,
      member?.last_name,
      member?.extension_name
    ].map((part) => String(part || "").trim()).filter(Boolean).join(" ");

    const requestRegistrationJson = async (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 30000);
      const { headers = {}, ...requestOptions } = options;
      try {
        const response = await fetch(url, {
          ...requestOptions,
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            ...headers
          },
          signal: controller.signal
        });
        let payload = null;
        try {
          payload = await response.json();
        } catch {
          payload = null;
        }
        if (!response.ok || payload?.success === false) {
          const message = String(payload?.error || payload?.message || "").trim()
            || `The server could not save this household (HTTP ${response.status}).`;
          const error = new Error(message);
          error.status = response.status;
          throw error;
        }
        return payload;
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("The household save timed out. Check the connection and try again.");
        }
        throw error;
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    const fetchCanonicalHouseholdRecord = async (householdId) => {
      const normalizedHouseholdId = String(householdId || "").trim();
      if (!normalizedHouseholdId) {
        throw new Error("The household ID is missing. Return to the household page and try again.");
      }
      const query = new URLSearchParams({
        action: "get_household",
        household_id: normalizedHouseholdId
      });
      const payload = await requestRegistrationJson(`registration-sync.php?${query.toString()}`);
      const record = payload?.data?.record;
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        throw new Error("The latest household record could not be loaded.");
      }
      const returnedHouseholdId = String(payload?.data?.household_id || record.household_id || "").trim();
      if (returnedHouseholdId
        && returnedHouseholdId.toLowerCase() !== normalizedHouseholdId.toLowerCase()) {
        throw new Error("The server returned a different household record. No changes were saved.");
      }
      return {
        ...record,
        household_id: returnedHouseholdId || normalizedHouseholdId
      };
    };

    const mergeHouseholdViewMemberIntoRecord = (canonicalRecord, memberData, memberIndex, householdId) => {
      if (!Number.isInteger(memberIndex) || memberIndex < 0) {
        throw new Error("The household member selection is no longer valid. Return to the household page and try again.");
      }
      const requestedClientMemberId = normalizeClientMemberId(memberData.client_member_id);
      if (!requestedClientMemberId) {
        throw new Error("A stable member ID could not be verified. Return to the household page and open the member again.");
      }

      const canonicalMembers = Array.isArray(canonicalRecord.members)
        ? canonicalRecord.members.map((member) => (
            member && typeof member === "object" && !Array.isArray(member) ? { ...member } : {}
          ))
        : [];
      const updatedRecord = {
        ...canonicalRecord,
        household_id: String(householdId || canonicalRecord.household_id || "").trim(),
        mode: "update",
        photo_schema_version: 1,
        members: canonicalMembers,
        updated_at: new Date().toISOString()
      };

      if (memberIndex === 0) {
        const existingHead = canonicalRecord.head && typeof canonicalRecord.head === "object"
          && !Array.isArray(canonicalRecord.head)
          ? canonicalRecord.head
          : {};
        const canonicalClientMemberId = normalizeClientMemberId(existingHead.client_member_id);
        if (originalSelectedClientMemberId) {
          if (requestedClientMemberId !== originalSelectedClientMemberId
            || canonicalClientMemberId !== originalSelectedClientMemberId) {
            throw new Error("The household head changed on the server. Return to the household page and open the head again.");
          }
        } else if (canonicalClientMemberId !== requestedClientMemberId) {
          if (canonicalClientMemberId
            || memberIdentityFingerprint(existingHead) !== originalSelectedIdentityFingerprint) {
            throw new Error("The household head changed on the server. Return to the household page and open the head again.");
          }
        }
        const updatedHead = {
          ...existingHead,
          ...memberData,
          relation_to_head: "Head"
        };
        updatedRecord.head = updatedHead;
        updatedRecord.head_name = buildMemberFullName(updatedHead)
          || String(canonicalRecord.head_name || "").trim();
        updatedRecord.zone = normalizeZoneLabel(updatedHead.zone || canonicalRecord.zone || "");
        updatedRecord.member_count = canonicalMembers.length + 1;
        return {
          record: updatedRecord,
          canonicalPhotoId: normalizeProfilePhotoId(existingHead.profile_photo_id)
        };
      } else {
        let matchingIndexes = [];

        if (originalSelectedClientMemberId) {
          if (!requestedClientMemberId || requestedClientMemberId !== originalSelectedClientMemberId) {
            throw new Error("This member's stable ID changed unexpectedly. No household record was updated.");
          }
          matchingIndexes = canonicalMembers.reduce((indexes, member, index) => {
            if (normalizeClientMemberId(member?.client_member_id) === requestedClientMemberId) {
              indexes.push(index);
            }
            return indexes;
          }, []);
        } else {
          if (requestedClientMemberId) {
            matchingIndexes = canonicalMembers.reduce((indexes, member, index) => {
              if (normalizeClientMemberId(member?.client_member_id) === requestedClientMemberId) {
                indexes.push(index);
              }
              return indexes;
            }, []);
          }
          if (matchingIndexes.length === 0 && originalSelectedIdentityFingerprint) {
            matchingIndexes = canonicalMembers.reduce((indexes, member, index) => {
              if (memberIdentityFingerprint(member) === originalSelectedIdentityFingerprint) {
                indexes.push(index);
              }
              return indexes;
            }, []);
          }
        }

        if (matchingIndexes.length !== 1) {
          throw new Error(
            matchingIndexes.length > 1
              ? "More than one server member matches this edit. Return to the household page and select the member again."
              : "This member changed or was removed on the server. Return to the household page and open the member again."
          );
        }

        const canonicalMemberIndex = matchingIndexes[0];
        const existingMember = canonicalMembers[canonicalMemberIndex];
        const canonicalClientMemberId = normalizeClientMemberId(existingMember?.client_member_id);
        if (!originalSelectedClientMemberId
          && canonicalClientMemberId
          && canonicalClientMemberId !== requestedClientMemberId) {
          throw new Error("This legacy member was updated elsewhere. Return to the household page and open the member again.");
        }
        canonicalMembers[canonicalMemberIndex] = {
          ...existingMember,
          ...memberData
        };
        updatedRecord.member_count = canonicalMembers.length + 1;
        return {
          record: updatedRecord,
          canonicalPhotoId: normalizeProfilePhotoId(existingMember?.profile_photo_id)
        };
      }
    };

    const persistHouseholdViewMember = async ({ householdId, memberIndex, memberData }) => {
      if (!csrfToken) {
        throw new Error("Your security token is missing. Reload the page and try again.");
      }
      const canonicalRecord = await fetchCanonicalHouseholdRecord(householdId);
      const mergeResult = mergeHouseholdViewMemberIntoRecord(
        canonicalRecord,
        memberData,
        memberIndex,
        householdId
      );
      const updatedRecord = mergeResult.record;
      const canonicalPhotoId = mergeResult.canonicalPhotoId;
      const photoId = normalizeProfilePhotoId(memberData.profile_photo_id);
      const uploadedPhotoIds = [];
      const photoChangedOnServer = Boolean(photoId) && photoId !== canonicalPhotoId;
      let hasOwnedLocalPhoto = false;
      if (photoId && photoStorageUsable && typeof photoStorage?.get === "function") {
        try {
          const localPhoto = await photoStorage.get(photoId, {
            expectedOwnerUserId: currentUserId
          });
          hasOwnedLocalPhoto = Boolean(localPhoto?.blob);
        } catch (error) {
          if (error?.code !== "photo_owner_mismatch"
            && (stagedProfilePhotoIds.has(photoId) || photoChangedOnServer)) {
            throw error;
          }
        }
      }
      const shouldUploadPhoto = Boolean(photoId)
        && (stagedProfilePhotoIds.has(photoId) || photoChangedOnServer || hasOwnedLocalPhoto);

      if (shouldUploadPhoto
        && photoStorageUsable
        && typeof photoStorage?.upload === "function") {
        let uploadResult = null;
        try {
          uploadResult = await waitWithTimeout(
            photoStorage.upload(photoId, {
              csrfToken,
              subjectType: memberIndex === 0 ? "head" : "member",
              expectedOwnerUserId: currentUserId
            }),
            30000,
            "The photo upload timed out. Check the connection and try again."
          );
        } catch (error) {
          if (error?.code !== "photo_owner_mismatch") {
            throw error;
          }
          uploadResult = { success: true, skipped: true };
        }
        if (!uploadResult || uploadResult.success !== true) {
          throw new Error("The profile photo could not be uploaded.");
        }
        if (uploadResult.skipped !== true) {
          uploadedPhotoIds.push(photoId);
        }
      } else if (shouldUploadPhoto) {
        throw new Error("The new profile photo is not available for upload. Reload the page and try again.");
      }

      await requestRegistrationJson("registration-sync.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken
        },
        body: JSON.stringify({
          action: "upsert",
          record: updatedRecord
        })
      });

      for (const uploadedPhotoId of uploadedPhotoIds) {
        await removeLocalPhoto(uploadedPhotoId);
      }
    };

    const setValue = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value === undefined || value === null) return;
      if (id === "zone") {
        input.value = normalizeZoneLabel(value);
        return;
      }
      if (id === "contact") {
        let rawContact = String(value || "").replace(/\D/g, "");
        if (rawContact.startsWith("0")) rawContact = rawContact.substring(1);
        if (rawContact.startsWith("639")) rawContact = rawContact.substring(2);
        if (rawContact.length > 10) rawContact = rawContact.substring(0, 10);
        if (rawContact.length > 0) {
          let formatted = rawContact.substring(0, 3);
          if (rawContact.length > 3) formatted += "-" + rawContact.substring(3, 6);
          if (rawContact.length > 6) formatted += "-" + rawContact.substring(6, 10);
          input.value = formatted;
        } else {
          input.value = "";
        }
        return;
      }
      if (input.classList.contains("gov-id-mask") && input.dataset.mask) {
        const mask = input.dataset.mask;
        const rawDigits = String(value || "").replace(/\D/g, "");
        if (!rawDigits) {
          input.value = "";
          return;
        }
        let out = "", ri = 0;
        for (let i = 0; i < mask.length && ri < rawDigits.length; i++) {
          if (mask[i] === "-") {
            out += "-";
          } else {
            out += rawDigits[ri];
            ri++;
          }
        }
        input.value = out;
        return;
      }
      if (input.tagName === "SELECT" && value !== "" && !Array.from(input.options).some((option) => option.value === String(value))) {
        const legacyOption = document.createElement("option");
        legacyOption.value = String(value);
        legacyOption.textContent = `${String(value)} (Existing)`;
        legacyOption.dataset.legacyValue = "true";
        input.appendChild(legacyOption);
      }
      input.value = value;
    };

    const getCheckedValues = (name) => {
      return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map((input) => input.value);
    };

    const setCheckedValues = (name, values) => {
      const valueSet = new Set(values || []);
      document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
        input.checked = valueSet.has(input.value);
      });
    };

    const serializeMemberForm = () => ({
      first_name: document.getElementById("first_name").value.trim(),
      middle_name: document.getElementById("middle_name").value.trim(),
      last_name: document.getElementById("last_name").value.trim(),
      extension_name: document.getElementById("extension_name").value.trim(),
      birthday: birthdayInput.value,
      age: ageInput.value,
      sex: sexSelect.value,
      civil_status: document.getElementById("civil_status").value,
      citizenship: document.getElementById("citizenship").value.trim(),
      religion: document.getElementById("religion").value.trim(),
      height: document.getElementById("height").value,
      weight: document.getElementById("weight").value,
      blood_type: document.getElementById("blood_type").value.trim(),
      contact: document.getElementById("contact").value.trim(),
      address: document.getElementById("address").value.trim(),
      zone: normalizeZoneLabel(document.getElementById("zone").value),
      barangay: document.getElementById("barangay").value.trim(),
      city: document.getElementById("city").value.trim(),
      province: document.getElementById("province").value.trim(),
      education: document.getElementById("education").value.trim(),
      degree: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "" : document.getElementById("degree").value.trim(),
      school_name: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "" : document.getElementById("school_name").value.trim(),
      school_type: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "" : document.getElementById("school_type").value,
      dropout: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "No" : document.getElementById("dropout").value,
      osy: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "No" : document.getElementById("osy").value,
      currently_studying: String(document.getElementById("education")?.value || "").trim().toLowerCase() === "no formal education" ? "No" : document.getElementById("currently_studying").value,
      occupation: document.getElementById("occupation").value.trim(),
      employment_status: document.getElementById("employment_status").value,
      work_type: document.getElementById("work_type").value,
      monthly_income: document.getElementById("monthly_income").value.trim(),
      four_ps: document.getElementById("four_ps").value,
      senior: document.getElementById("senior").value,
      pwd: document.getElementById("pwd").value,
      ip: document.getElementById("ip").value,
      voter: document.getElementById("voter").value,
      precinct: document.getElementById("precinct").value.trim(),
      sss: document.getElementById("sss").value.trim(),
      philhealth: document.getElementById("philhealth").value.trim(),
      gsis: document.getElementById("gsis").value.trim(),
      tin: document.getElementById("tin").value.trim(),
      philid: document.getElementById("philid").value.trim(),
      driver_license: document.getElementById("driver_license").value.trim(),
      passport: document.getElementById("passport").value.trim(),
      relation_to_head: document.getElementById("relation_to_head").value.trim(),
      client_member_id: currentClientMemberId,
      profile_photo_id: normalizeProfilePhotoId(currentProfilePhotoId)
    });

    const memberHasDraftData = (member) => Object.values(member || {}).some((value) => String(value || "").trim() !== "");

    const clearMemberFormDraft = async () => {
      await settleIndexedStorageOperation(localStorage.removeItem(MEMBER_FORM_DRAFT_KEY));
    };

    const loadMember = async (member) => {
      const loadedClientMemberId = normalizeClientMemberId(member.client_member_id);
      if (loadedClientMemberId) {
        currentClientMemberId = loadedClientMemberId;
      }
      setValue("first_name", member.first_name);
      setValue("middle_name", member.middle_name);
      setValue("last_name", member.last_name);
      setValue("extension_name", member.extension_name);
      setValue("birthday", member.birthday);
      setValue("civil_status", member.civil_status);
      setValue("citizenship", member.citizenship);
      setValue("religion", member.religion);
      setValue("height", member.height);
      setValue("weight", member.weight);
      setValue("blood_type", member.blood_type);
      setValue("contact", member.contact);
      setValue("address", member.address);
      setValue("zone", member.zone);
      setValue("barangay", member.barangay);
      setValue("city", member.city);
      setValue("province", member.province);
      setValue("education", member.education);
      setValue("degree", member.degree);
      setValue("school_name", member.school_name);
      setValue("school_type", member.school_type);
      setValue("dropout", member.dropout);
      setValue("osy", member.osy);
      setValue("currently_studying", member.currently_studying);
      setValue("occupation", member.occupation);
      setValue("employment_status", member.employment_status);
      setValue("work_type", member.work_type);
      setValue("monthly_income", member.monthly_income);
      setValue("four_ps", member.four_ps);
      setValue("senior", member.senior);
      setValue("pwd", member.pwd);
      setValue("ip", member.ip);
      setValue("voter", member.voter);
      setValue("precinct", member.precinct);
      setValue("sss", member.sss);
      setValue("philhealth", member.philhealth);
      setValue("gsis", member.gsis);
      setValue("tin", member.tin);
      setValue("philid", member.philid);
      setValue("driver_license", member.driver_license);
      setValue("passport", member.passport);
      setValue("relation_to_head", member.relation_to_head);
      sexSelect.value = member.sex || "";
      ageInput.value = member.age || calculateAge(member.birthday);
      if (Object.prototype.hasOwnProperty.call(member, "profile_photo_id")) {
        await renderMemberProfilePhoto(member.profile_photo_id);
      }
      updateMemberEducationVisibility();
    };

    const indexedStorageReadyTask = typeof localStorage.ready === "function"
      ? waitWithTimeout(
          localStorage.ready(),
          5000,
          "Offline draft storage is blocked by another open tab."
        )
      : Promise.resolve();
    const photoStorageReadyTask = typeof photoStorage?.ready === "function"
      ? waitWithTimeout(
          photoStorage.ready(),
          5000,
          "Offline photo storage is blocked by another open tab."
        )
      : Promise.resolve();
    const [indexedStorageReadyResult, photoStorageReadyResult] = await Promise.allSettled([
      indexedStorageReadyTask,
      photoStorageReadyTask
    ]);

    indexedStorageResponsive = indexedStorageReadyResult.status === "fulfilled";
    photoStorageUsable = typeof photoStorage?.ready === "function"
      ? photoStorageReadyResult.status === "fulfilled"
      : Boolean(photoStorage?.put && photoStorage?.getPreviewSource);
    if (!photoStorageUsable) {
      if (memberProfilePhotoInput) memberProfilePhotoInput.disabled = true;
      if (memberProfilePhotoCaptureBtn) memberProfilePhotoCaptureBtn.disabled = true;
      setMemberPhotoStatus(
        "Photo storage is unavailable. Close other open system tabs, then reload this page.",
        "danger"
      );
    }
    await claimMemberTempStateForCurrentUser();
    currentClientMemberId = createStableClientMemberId();

    const members = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    const editIndexRaw = localStorage.getItem(EDIT_KEY);
    let editIndex = null;
    let isEditing = false;

    if (editIndexRaw !== null) {
      const parsedIndex = Number(editIndexRaw);
      if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < members.length) {
        editIndex = parsedIndex;
        isEditing = true;
        const originalSelectedMember = members[editIndex] || {};
        originalSelectedClientMemberId = normalizeClientMemberId(originalSelectedMember.client_member_id);
        originalSelectedIdentityFingerprint = memberIdentityFingerprint(originalSelectedMember);
        currentClientMemberId = originalSelectedClientMemberId
          || currentClientMemberId;
        originalProfilePhotoId = normalizeProfilePhotoId(originalSelectedMember.profile_photo_id);
        const originalPhotoBelongsOnlyToNewDraft = originalProfilePhotoId
          && !isHouseholdViewMode
          && !editHouseholdIdFromQuery
          && !persistedRecordsReferencePhoto(originalProfilePhotoId);
        if (originalPhotoBelongsOnlyToNewDraft) {
          stagedProfilePhotoIds.add(originalProfilePhotoId);
        }
        await loadMember(members[editIndex]);
        if (pageTitle) pageTitle.textContent = "Edit Household Member";
        if (submitBtn) submitBtn.innerHTML = '<i class="bi bi-save"></i> Update Member';
      } else {
        localStorage.removeItem(EDIT_KEY);
      }
    }

    saveMemberFormDraft = () => {
      if (suppressMemberFormDraft) {
        return;
      }
      try {
        const data = serializeMemberForm();
        if (!memberHasDraftData(data)) {
          localStorage.removeItem(MEMBER_FORM_DRAFT_KEY);
          return;
        }
        localStorage.setItem(MEMBER_FORM_DRAFT_KEY, JSON.stringify({
          owner_user_id: currentUserId,
          mode: isEditing ? "edit" : "add",
          editIndex: isEditing ? editIndex : null,
          data
        }));
      } catch (error) {
        // Ignore draft write errors.
      }
    };

    const restoreMemberFormDraft = async () => {
      let draft = null;
      try {
        draft = JSON.parse(localStorage.getItem(MEMBER_FORM_DRAFT_KEY) || "null");
      } catch (error) {
        draft = null;
      }
      if (!draft || typeof draft !== "object" || !draft.data || typeof draft.data !== "object") {
        return;
      }
      const draftOwnerId = String(draft.owner_user_id || "").trim();
      if (draftOwnerId && draftOwnerId !== currentUserId) {
        await clearMemberFormDraft();
        return;
      }
      const expectedMode = isEditing ? "edit" : "add";
      if (String(draft.mode || "") !== expectedMode) {
        return;
      }
      if (isEditing && Number(draft.editIndex) !== editIndex) {
        return;
      }
      if (!memberHasDraftData(draft.data)) {
        return;
      }
      const draftHasPhotoId = Object.prototype.hasOwnProperty.call(draft.data, "profile_photo_id");
      const draftPhotoId = normalizeProfilePhotoId(draft.data.profile_photo_id);
      if (draftHasPhotoId && draftPhotoId !== originalProfilePhotoId) {
        if (draftPhotoId) stagedProfilePhotoIds.add(draftPhotoId);
      }
      await loadMember(draft.data);
    };

    await restoreMemberFormDraft();
    updateMemberEducationVisibility();

    const readStoredMembers = () => {
      try {
        const storedMembers = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
        return Array.isArray(storedMembers) ? storedMembers : [];
      } catch {
        return [];
      }
    };

    const cleanupUnreferencedProfilePhotos = async (membersToKeep = []) => {
      const referencedPhotoIds = new Set(
        (Array.isArray(membersToKeep) ? membersToKeep : [])
          .map((member) => normalizeProfilePhotoId(member?.profile_photo_id))
          .filter(Boolean)
      );
      const candidateIds = Array.from(stagedProfilePhotoIds)
        .filter((photoId) => (
          photoId
          && !referencedPhotoIds.has(photoId)
          && !persistedRecordsReferencePhoto(photoId)
        ));

      if (candidateIds.length > 0 && photoStorageUsable) {
        try {
          if (typeof photoStorage?.removeMany === "function") {
            await photoStorage.removeMany(candidateIds, {
              expectedOwnerUserId: currentUserId
            });
          } else {
            await Promise.all(candidateIds.map((photoId) => removeLocalPhoto(photoId)));
          }
        } catch {
          // Photo cleanup is best-effort and must not block member navigation.
        }
      }
      stagedProfilePhotoIds.clear();
    };

    const clearMemberProfilePhoto = async () => {
      if (memberProfilePhotoController?.isProcessing()) {
        discardPendingCapturedPhoto = true;
      }
      const previousPhotoId = currentProfilePhotoId;
      currentProfilePhotoId = "";
      profilePhotoPreviewToken += 1;
      const previewOperation = replaceMemberPhotoPreview("");
      setMemberPhotoStatus("No photo yet");
      saveMemberFormDraft();
      await removeStagedProfilePhoto(previousPhotoId);
      await previewOperation;
      saveMemberFormDraft();
    };

    const lockMemberFormForNavigation = () => {
      abandoningMemberForm = true;
      memberForm.setAttribute("aria-busy", "true");
      [
        backBtn,
        cancelBtn,
        clearBtn,
        submitBtn,
        memberProfilePhotoInput,
        memberProfilePhotoCaptureBtn,
        memberProfilePhotoRemoveBtn
      ].forEach((control) => {
        if (control) control.disabled = true;
      });
    };

    let memberSavingControlStates = null;
    const setMemberFormSavingState = (saving) => {
      const controls = Array.from(new Set([
        backBtn,
        cancelBtn,
        clearBtn,
        submitBtn,
        memberProfilePhotoInput,
        memberProfilePhotoCaptureBtn,
        memberProfilePhotoRemoveBtn,
        ...Array.from(memberForm.elements || [])
      ].filter(Boolean)));

      if (saving) {
        memberSavingControlStates = new Map(controls.map((control) => [control, control.disabled]));
        controls.forEach((control) => { control.disabled = true; });
        memberForm.setAttribute("aria-busy", "true");
        if (submitBtn) {
          submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span> Saving...';
        }
        return;
      }

      if (memberSavingControlStates) {
        memberSavingControlStates.forEach((wasDisabled, control) => {
          control.disabled = wasDisabled;
        });
      }
      memberSavingControlStates = null;
      memberForm.removeAttribute("aria-busy");
      if (submitBtn) {
        submitBtn.innerHTML = isEditing
          ? '<i class="bi bi-save"></i> Update Member'
          : '<i class="bi bi-save"></i> Save Member';
      }
    };

    birthdayInput.addEventListener("change", () => {
      ageInput.value = calculateAge(birthdayInput.value);
    });

    const zoneInput = document.getElementById("zone");
    if (zoneInput) {
      const normalizeZoneInput = () => {
        const normalized = normalizeZoneLabel(zoneInput.value);
        if (zoneInput.value !== normalized) {
          zoneInput.value = normalized;
        }
      };
      zoneInput.addEventListener("change", normalizeZoneInput);
      zoneInput.addEventListener("blur", () => {
        normalizeZoneInput();
        saveMemberFormDraft();
      });
    }

    if (educationSelect) {
      educationSelect.addEventListener("input", () => {
        updateMemberEducationVisibility();
        saveMemberFormDraft();
      });
      educationSelect.addEventListener("change", () => {
        updateMemberEducationVisibility();
        saveMemberFormDraft();
      });
    }

    memberForm.addEventListener("input", saveMemberFormDraft);
    memberForm.addEventListener("change", saveMemberFormDraft);
    memberForm.addEventListener("reset", () => {
      setTimeout(updateMemberEducationVisibility, 0);
      const operation = trackPhotoMutation(clearMemberProfilePhoto());
      void operation.catch(() => {
        setMemberPhotoStatus("Unable to clear the local photo. Please try again.", "danger");
      });
    });
    window.addEventListener("pagehide", () => {
      saveMemberFormDraft();
      revokeCurrentPreviewObjectUrl();
    });
    window.addEventListener("pageshow", (event) => {
      if (event.persisted && abandoningMemberForm) {
        window.location.reload();
        return;
      }
      if (event.persisted && currentProfilePhotoId) {
        void renderMemberProfilePhoto(currentProfilePhotoId);
      }
    });

    const backToRegistration = async () => {
      if (abandoningMemberForm) return;
      lockMemberFormForNavigation();
      suppressMemberFormDraft = true;
      if (memberProfilePhotoController?.isProcessing()) {
        discardPendingCapturedPhoto = true;
      }
      await waitForPhotoMutations();
      lockMemberFormForNavigation();
      await cleanupUnreferencedProfilePhotos(isHouseholdViewMode ? [] : readStoredMembers());
      await settleIndexedStorageOperation(localStorage.removeItem(EDIT_KEY));
      await clearMemberFormDraft();
      if (isHouseholdViewMode) {
        const context = getHouseholdViewContext();
        const hid = householdIdFromQuery || context.householdId || "";
        const role = roleFromQuery || context.role || "";
        await settleIndexedStorageOperation(localStorage.removeItem(MEMBERS_KEY));
        await settleIndexedStorageOperation(localStorage.removeItem(VIEW_CONTEXT_KEY));
        await settleIndexedStorageOperation(localStorage.removeItem(VIEW_RESULT_KEY));
        releaseMemberTempStateClaim();
        if (typeof localStorage.flush === "function") {
          await settleIndexedStorageOperation(localStorage.flush());
        }
        await waitForPhotoMutations();
        lockMemberFormForNavigation();
        const next = new URLSearchParams();
        if (hid) next.set("id", hid);
        if (role) next.set("role", role);
        window.location.href = `household-view.php${next.toString() ? `?${next.toString()}` : ""}`;
        return;
      }
      const next = new URLSearchParams();
      if (editHouseholdIdFromQuery) {
        next.set("edit", editHouseholdIdFromQuery);
      }
      if (registrationYearFromQuery) {
        next.set("year", registrationYearFromQuery);
      }
      if (editReturnSourceFromQuery) {
        next.set("from", editReturnSourceFromQuery);
      }
      if (editReturnIdFromQuery) {
        next.set("return_id", editReturnIdFromQuery);
      }
      if (roleFromQuery) {
        next.set("role", roleFromQuery);
      }
      await waitForPhotoMutations();
      lockMemberFormForNavigation();
      setPreserveDraftFlag();
      window.location.href = `registration.php${next.toString() ? `?${next.toString()}` : ""}#members`;
    };

    backBtn?.addEventListener("click", () => { void backToRegistration(); });
    cancelBtn?.addEventListener("click", () => { void backToRegistration(); });

    memberForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (isSubmittingMember) return;

      if (memberProfilePhotoController?.isProcessing()) {
        alert("Please wait for the profile photo to finish processing before saving this member.");
        memberProfilePhotoCaptureBtn?.focus();
        return;
      }
      await waitForPhotoMutations();

      const requiredFields = [
        { id: "first_name", label: "First Name" },
        { id: "last_name", label: "Last Name" },
        { id: "birthday", label: "Birthday" },
        { id: "sex", label: "Sex/Gender" },
        { id: "civil_status", label: "Civil Status" },
        { id: "relation_to_head", label: "Relationship to Head" },
        { id: "contact", label: "Contact Number" },
        { id: "address", label: "Complete Address" },
        { id: "zone", label: "Zone" },
        { id: "education", label: "Educational Attainment" },
        { id: "occupation", label: "Occupation" },
        { id: "employment_status", label: "Employment Status" },
        { id: "work_type", label: "Type of Work" }
      ];

      for (const field of requiredFields) {
        const inputEl = document.getElementById(field.id);
        const value = inputEl ? inputEl.value.trim() : "";
        if (!value) {
          alert(`Please enter ${field.label}.`);
          inputEl?.focus();
          return;
        }
      }

      const memberData = serializeMemberForm();
      const members = readStoredMembers();
      if (isHouseholdViewMode && (!isEditing || editIndex === null || editIndex >= members.length)) {
        const message = "This household member selection expired. Return to the household page and open the member again.";
        setMemberPhotoStatus(message, "danger");
        alert(message);
        return;
      }

      isSubmittingMember = true;
      if (isEditing && editIndex !== null && editIndex < members.length) {
        members[editIndex] = memberData;
      } else {
        members.push(memberData);
      }
      if (!isHouseholdViewMode) {
        await settleIndexedStorageOperation(localStorage.setItem(MEMBERS_KEY, JSON.stringify(members)));
      }

      if (isHouseholdViewMode) {
        const context = getHouseholdViewContext();
        const hid = householdIdFromQuery || context.householdId || "";
        const role = roleFromQuery || context.role || "";
        const updatedIndex = editIndex;

        setMemberFormSavingState(true);
        setMemberPhotoStatus("Processing...");
        try {
          await persistHouseholdViewMember({
            householdId: hid,
            memberIndex: updatedIndex,
            memberData
          });
          await cleanupUnreferencedProfilePhotos(members);
        } catch (error) {
          isSubmittingMember = false;
          setMemberFormSavingState(false);
          saveMemberFormDraft();
          const message = String(error?.message || "The household update could not be saved.").trim();
          setMemberPhotoStatus(`Not saved: ${message}`, "danger");
          alert(`Unable to save this household member.\n\n${message}`);
          return;
        }

        lockMemberFormForNavigation();
        suppressMemberFormDraft = true;
        await settleIndexedStorageOperation(localStorage.removeItem(EDIT_KEY));
        await clearMemberFormDraft();
        await settleIndexedStorageOperation(localStorage.removeItem(MEMBERS_KEY));
        await settleIndexedStorageOperation(localStorage.removeItem(VIEW_CONTEXT_KEY));
        await settleIndexedStorageOperation(localStorage.removeItem(VIEW_RESULT_KEY));
        releaseMemberTempStateClaim();
        if (typeof localStorage.flush === "function") {
          await settleIndexedStorageOperation(localStorage.flush());
        }
        await waitForPhotoMutations();
        lockMemberFormForNavigation();

        const next = new URLSearchParams();
        if (hid) next.set("id", hid);
        if (role) next.set("role", role);
        window.location.href = `household-view.php${next.toString() ? `?${next.toString()}` : ""}`;
        return;
      }

      await cleanupUnreferencedProfilePhotos(members);
      await settleIndexedStorageOperation(localStorage.removeItem(EDIT_KEY));
      await clearMemberFormDraft();
      await backToRegistration();
    });
})();
