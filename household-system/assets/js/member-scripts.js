(async () => {
  document.getElementById("year").textContent = String(new Date().getFullYear());

    const params = new URLSearchParams(window.location.search);
    const isHouseholdViewMode = params.get("mode") === "household-view";
    const householdIdFromQuery = params.get("hid") || "";
    const roleFromQuery = params.get("role") || "";
    const editHouseholdIdFromQuery = params.get("edit") || "";
    const registrationYearFromQuery = params.get("year") || "";
    const PRESERVE_DRAFT_FLAG_KEY = "registration_preserve_draft";

    const MEMBERS_KEY = isHouseholdViewMode ? "household_view_temp_members" : "household_members";
    const EDIT_KEY = isHouseholdViewMode ? "household_view_temp_edit_index" : "household_member_edit_index";
    const VIEW_CONTEXT_KEY = "household_view_context";
    const VIEW_RESULT_KEY = "household_view_edit_result";
    const localStorage = window.createIndexedStorageProxy
      ? window.createIndexedStorageProxy([
          MEMBERS_KEY,
          EDIT_KEY,
          VIEW_CONTEXT_KEY,
          VIEW_RESULT_KEY
        ])
      : window.localStorage;
    const memberForm = document.getElementById("memberForm");
    const sexSelect = document.getElementById("sex");
    const birthdayInput = document.getElementById("birthday");
    const ageInput = document.getElementById("age");
    const pageTitle = document.querySelector(".page-header .title");
    const backBtn = document.getElementById("backBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const submitBtn = memberForm.querySelector('button[type="submit"]');

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

    const setValue = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value === undefined || value === null) return;
      if (id === "zone") {
        input.value = normalizeZoneLabel(value);
        return;
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

    const loadMember = (member) => {
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
    };

    if (typeof localStorage.ready === "function") {
      await localStorage.ready();
    }

    const members = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
    const editIndexRaw = localStorage.getItem(EDIT_KEY);
    let editIndex = null;
    let isEditing = false;

    if (editIndexRaw !== null) {
      const parsedIndex = Number(editIndexRaw);
      if (Number.isInteger(parsedIndex) && parsedIndex >= 0 && parsedIndex < members.length) {
        editIndex = parsedIndex;
        isEditing = true;
        loadMember(members[editIndex]);
        if (pageTitle) pageTitle.textContent = "Edit Household Member";
        if (submitBtn) submitBtn.innerHTML = '<i class="bi bi-save"></i> Update Member';
      } else {
        localStorage.removeItem(EDIT_KEY);
      }
    }

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
      zoneInput.addEventListener("blur", normalizeZoneInput);
    }

    const backToRegistration = async () => {
      await localStorage.removeItem(EDIT_KEY);
      if (isHouseholdViewMode) {
        const context = getHouseholdViewContext();
        const hid = householdIdFromQuery || context.householdId || "";
        const role = roleFromQuery || context.role || "";
        await localStorage.removeItem(MEMBERS_KEY);
        await localStorage.removeItem(VIEW_CONTEXT_KEY);
        if (typeof localStorage.flush === "function") {
          await localStorage.flush();
        }
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
      setPreserveDraftFlag();
      window.location.href = `registration.php${next.toString() ? `?${next.toString()}` : ""}#members`;
    };

    backBtn?.addEventListener("click", () => { void backToRegistration(); });
    cancelBtn?.addEventListener("click", () => { void backToRegistration(); });

    memberForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const requiredFields = [
        { id: "first_name", label: "First Name" },
        { id: "last_name", label: "Last Name" },
        { id: "sex", label: "Sex/Gender" }
      ];

      for (const field of requiredFields) {
        const value = document.getElementById(field.id).value.trim();
        if (!value) {
          alert(`Please enter ${field.label}.`);
          document.getElementById(field.id).focus();
          return;
        }
      }

      const memberData = {
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
        degree: document.getElementById("degree").value.trim(),
        school_name: document.getElementById("school_name").value.trim(),
        school_type: document.getElementById("school_type").value,
        dropout: document.getElementById("dropout").value,
        osy: document.getElementById("osy").value,
        currently_studying: document.getElementById("currently_studying").value,
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
        relation_to_head: document.getElementById("relation_to_head").value.trim()
      };

      const members = JSON.parse(localStorage.getItem(MEMBERS_KEY) || "[]");
      if (isEditing && editIndex !== null && editIndex < members.length) {
        members[editIndex] = memberData;
      } else {
        members.push(memberData);
      }
      await localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));

      if (isHouseholdViewMode) {
        const context = getHouseholdViewContext();
        const hid = householdIdFromQuery || context.householdId || "";
        const role = roleFromQuery || context.role || "";
        const updatedIndex = (isEditing && editIndex !== null) ? editIndex : (members.length - 1);

        await localStorage.setItem(VIEW_RESULT_KEY, JSON.stringify({
          householdId: hid,
          role,
          memberIndex: updatedIndex,
          memberData
        }));

        await localStorage.removeItem(EDIT_KEY);
        await localStorage.removeItem(MEMBERS_KEY);
        await localStorage.removeItem(VIEW_CONTEXT_KEY);
        if (typeof localStorage.flush === "function") {
          await localStorage.flush();
        }

        const next = new URLSearchParams();
        if (hid) next.set("id", hid);
        if (role) next.set("role", role);
        window.location.href = `household-view.php${next.toString() ? `?${next.toString()}` : ""}`;
        return;
      }

      await localStorage.removeItem(EDIT_KEY);
      await backToRegistration();
    });
})();
