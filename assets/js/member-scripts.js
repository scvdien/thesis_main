(async () => {
  document.getElementById("year").textContent = "2026";

    const params = new URLSearchParams(window.location.search);
    const isHouseholdViewMode = params.get("mode") === "household-view";
    const householdIdFromQuery = params.get("hid") || "";
    const roleFromQuery = params.get("role") || "";
    const editHouseholdIdFromQuery = params.get("edit") || "";
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
    const pregnantWrap = document.getElementById("pregnantWrap");
    const birthdayInput = document.getElementById("birthday");
    const ageInput = document.getElementById("age");
    const pageTitle = document.querySelector(".page-header .title");
    const submitBtn = memberForm.querySelector('button[type="submit"]');

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

    const updatePregnantVisibility = () => {
      const isFemale = sexSelect.value === "Female";
      pregnantWrap.style.display = isFemale ? "block" : "none";
      if (!isFemale) {
        const checked = pregnantWrap.querySelector("input:checked");
        if (checked) checked.checked = false;
      }
    };

    const setValue = (id, value) => {
      const input = document.getElementById(id);
      if (!input || value === undefined || value === null) return;
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
      setValue("num_members", member.num_members);
      setValue("relation_to_head", member.relation_to_head);
      setValue("num_children", member.num_children);
      setValue("partner_name", member.partner_name);
      setValue("health_current_illness", member.health_current_illness);
      setValue("health_illness_type", member.health_illness_type);
      setValue("health_illness_years", member.health_illness_years);
      setCheckedValues("health_chronic_diseases", member.health_chronic_diseases);
      setCheckedValues("health_common_illnesses", member.health_common_illnesses);
      setValue("health_maintenance_meds", member.health_maintenance_meds);
      setValue("health_medicine_name", member.health_medicine_name);
      setValue("health_medicine_frequency", member.health_medicine_frequency);
      setValue("health_medicine_source", member.health_medicine_source);
      setValue("health_maternal_pregnant", member.health_maternal_pregnant);
      setValue("health_months_pregnant", member.health_months_pregnant);
      setValue("health_prenatal_care", member.health_prenatal_care);
      setValue("health_child_immunized", member.health_child_immunized);
      setValue("health_child_malnutrition", member.health_child_malnutrition);
      setValue("health_child_sick_per_year", member.health_child_sick_per_year);
      setValue("health_has_disability", member.health_has_disability);
      setCheckedValues("health_disability_types", member.health_disability_types);
      setValue("health_disability_regular_care", member.health_disability_regular_care);
      setValue("health_smoker", member.health_smoker);
      setValue("health_alcohol_daily", member.health_alcohol_daily);
      setValue("health_malnutrition_present", member.health_malnutrition_present);
      setValue("health_clean_water", member.health_clean_water);
      setValue("health_rhu_visits", member.health_rhu_visits);
      setValue("health_rhu_reason", member.health_rhu_reason);
      setValue("health_has_philhealth", member.health_has_philhealth);
      setValue("health_hospitalized_5yrs", member.health_hospitalized_5yrs);
      setValue("health_hospitalized_reason", member.health_hospitalized_reason);

      sexSelect.value = member.sex || "";
      updatePregnantVisibility();
      if (member.pregnant) {
        const radio = document.querySelector(`input[name="pregnant"][value="${member.pregnant}"]`);
        if (radio) radio.checked = true;
      }
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

    sexSelect.addEventListener("change", updatePregnantVisibility);
    updatePregnantVisibility();

    birthdayInput.addEventListener("change", () => {
      ageInput.value = calculateAge(birthdayInput.value);
    });

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
      setPreserveDraftFlag();
      window.location.href = `registration.php${next.toString() ? `?${next.toString()}` : ""}#members`;
    };

    document.getElementById("backBtn").addEventListener("click", () => { void backToRegistration(); });
    document.getElementById("cancelBtn").addEventListener("click", () => { void backToRegistration(); });

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
        pregnant: document.querySelector("input[name='pregnant']:checked")?.value || "",
        contact: document.getElementById("contact").value.trim(),
        address: document.getElementById("address").value.trim(),
        zone: document.getElementById("zone").value.trim(),
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
        num_members: document.getElementById("num_members").value,
        relation_to_head: document.getElementById("relation_to_head").value.trim(),
        num_children: document.getElementById("num_children").value,
        partner_name: document.getElementById("partner_name").value.trim(),
        health_current_illness: document.getElementById("health_current_illness").value,
        health_illness_type: document.getElementById("health_illness_type").value.trim(),
        health_illness_years: document.getElementById("health_illness_years").value,
        health_chronic_diseases: getCheckedValues("health_chronic_diseases"),
        health_common_illnesses: getCheckedValues("health_common_illnesses"),
        health_maintenance_meds: document.getElementById("health_maintenance_meds").value,
        health_medicine_name: document.getElementById("health_medicine_name").value.trim(),
        health_medicine_frequency: document.getElementById("health_medicine_frequency").value,
        health_medicine_source: document.getElementById("health_medicine_source").value,
        health_maternal_pregnant: document.getElementById("health_maternal_pregnant").value,
        health_months_pregnant: document.getElementById("health_months_pregnant").value,
        health_prenatal_care: document.getElementById("health_prenatal_care").value,
        health_child_immunized: document.getElementById("health_child_immunized").value,
        health_child_malnutrition: document.getElementById("health_child_malnutrition").value,
        health_child_sick_per_year: document.getElementById("health_child_sick_per_year").value,
        health_has_disability: document.getElementById("health_has_disability").value,
        health_disability_types: getCheckedValues("health_disability_types"),
        health_disability_regular_care: document.getElementById("health_disability_regular_care").value,
        health_smoker: document.getElementById("health_smoker").value,
        health_alcohol_daily: document.getElementById("health_alcohol_daily").value,
        health_malnutrition_present: document.getElementById("health_malnutrition_present").value,
        health_clean_water: document.getElementById("health_clean_water").value,
        health_rhu_visits: document.getElementById("health_rhu_visits").value,
        health_rhu_reason: document.getElementById("health_rhu_reason").value.trim(),
        health_has_philhealth: document.getElementById("health_has_philhealth").value,
        health_hospitalized_5yrs: document.getElementById("health_hospitalized_5yrs").value,
        health_hospitalized_reason: document.getElementById("health_hospitalized_reason").value.trim()
      };

      if (memberData.sex !== "Female") {
        memberData.pregnant = "";
        memberData.health_maternal_pregnant = "";
        memberData.health_months_pregnant = "";
        memberData.health_prenatal_care = "";
      }

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
