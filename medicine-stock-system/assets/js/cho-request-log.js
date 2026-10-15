(() => {
  const supplyMonitoring = window.MSSSupplyMonitoring;
  if (!supplyMonitoring) return;
  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;
  const STATE_ENDPOINT = "state-api.php";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    requestCount: byId("requestCount"),
    requestSearch: byId("requestSearch"),
    requestSearchBtn: byId("requestSearchBtn"),
    requestStatusFilter: byId("requestStatusFilter"),
    requestTableBody: byId("requestTableBody"),
    openRequestModalBtn: byId("openRequestModalBtn"),
    requestModalTitle: byId("requestModalTitle"),
    requestModalSubtitle: byId("requestModalSubtitle"),
    requestForm: byId("requestForm"),
    requestSubmitBtn: byId("requestSubmitBtn"),
    requestId: byId("requestId"),
    requestDetailsView: byId("requestDetailsView"),
    printRequestSlipBtn: byId("printRequestSlipBtn"),
    requestDetailCode: byId("requestDetailCode"),
    requestDetailRequestDate: byId("requestDetailRequestDate"),
    requestDetailExpectedDate: byId("requestDetailExpectedDate"),
    requestDetailStatus: byId("requestDetailStatus"),
    requestDetailTableBody: byId("requestDetailTableBody"),
    requestDeleteMessage: byId("requestDeleteMessage"),
    confirmDeleteRequestBtn: byId("confirmDeleteRequestBtn"),
    requestMedicinePicker: byId("requestMedicinePicker"),
    requestMedicineSearch: byId("requestMedicineSearch"),
    requestMedicineResults: byId("requestMedicineResults"),
    requestItemsContainer: byId("requestItemsContainer"),
    requestItemsEmpty: byId("requestItemsEmpty"),
    requestItemsStatus: byId("requestItemsStatus"),
    requestItemCount: byId("requestItemCount"),
    requestFormFeedback: byId("requestFormFeedback"),
    requestSummaryTitle: byId("requestSummaryTitle"),
    requestSummaryText: byId("requestSummaryText"),
    requestSubmitBtnLabel: byId("requestSubmitBtnLabel"),
    requestDate: byId("requestDate"),
    requestExpectedDate: byId("requestExpectedDate"),
    requestFilterTabs: byId("requestFilterTabs"),
    pickerFilterAllCount: byId("pickerFilterAllCount"),
    pickerFilterLowCount: byId("pickerFilterLowCount"),
    pickerFilterExpCount: byId("pickerFilterExpCount"),
    requestWizardStepper: byId("requestWizardStepper"),
    requestWizardPrevBtn: byId("requestWizardPrevBtn"),
    requestWizardNextBtn: byId("requestWizardNextBtn"),
    requestWizardNextBtnLabel: byId("requestWizardNextBtnLabel"),
    requestChipsContainer: byId("requestChipsContainer"),
    requestChipsCount: byId("requestChipsCount"),
    requestChipsEmpty: byId("requestChipsEmpty"),
    requestReviewSummary: byId("requestReviewSummary"),
    requestReviewItemBadge: byId("requestReviewItemBadge"),
    requestReviewCount: byId("requestReviewCount"),
    requestReviewTotalQty: byId("requestReviewTotalQty"),
    requestReviewDateText: byId("requestReviewDateText"),
    requestReviewList: byId("requestReviewList")
  };

  const requestModal = byId("requestModal") && window.bootstrap ? new window.bootstrap.Modal(byId("requestModal")) : null;
  const requestDeleteModal = byId("requestDeleteModal") && window.bootstrap ? new window.bootstrap.Modal(byId("requestDeleteModal")) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  const state = {
    inventory: [],
    movements: [],
    requests: []
  };

  const uiState = {
    search: "",
    status: "all",
    requestModalMode: "create",
    medicinePickerIndex: -1,
    pendingDeleteGroupId: "",
    medicinePickerFilter: "all",
    wizardStep: 1,
    currentViewRequestGroup: null
  };

  let alertTimer = 0;
  let requestHydrationPromise = null;

  const text = supplyMonitoring.text;
  const numeric = supplyMonitoring.numeric;
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatDecimal = (value, digits = 1) => new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(numeric(value));
  const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }).format(parsed);
  };
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const requesterName = () => text(currentAuthUser?.fullName) || "Nurse-in-Charge";
  const isActiveRequestGroup = (requestGroup) => text(requestGroup?.recordStatus).toLowerCase() !== "archived";

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const requestJson = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
      throw new Error(String(payload.message || "Unable to sync CHO request log right now."));
    }
    return payload;
  };

  const showNotice = (message, type = "success") => {
    if (!refs.moduleAlert) return;
    refs.moduleAlert.className = `alert alert-${type}`;
    refs.moduleAlert.textContent = message;
    refs.moduleAlert.classList.remove("d-none");
    window.clearTimeout(alertTimer);
    alertTimer = window.setTimeout(() => refs.moduleAlert?.classList.add("d-none"), 3200);
  };

  const closeMobileSidebar = () => {
    refs.sidebar?.classList.remove("open");
    refs.sidebarBackdrop?.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  };

  const toggleSidebar = () => {
    if (!refs.sidebar || !refs.sidebarBackdrop) return;
    if (isMobile()) {
      refs.sidebar.classList.toggle("open");
      refs.sidebarBackdrop.classList.toggle("show");
      document.body.classList.toggle("sidebar-open");
      return;
    }

    refs.sidebar.classList.toggle("collapsed");
  };

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;
  const isActiveInventoryMedicine = (medicine) => text(medicine?.recordStatus).toLowerCase() !== "archived";
  const activeInventoryMedicines = () => state.inventory.filter(isActiveInventoryMedicine);

  const requestGroups = () => supplyMonitoring
    .hydrateRequestGroups(state.requests, state.movements)
    .filter(isActiveRequestGroup);

  const findInventoryMedicine = (medicineId) => state.inventory.find((entry) => text(entry.id) === text(medicineId)) || null;

  const findRequestGroup = (groupId) => requestGroups().find((row) => text(row.requestGroupId) === text(groupId)) || null;

  const requestStockInfo = (medicine = {}) => {
    const stock = Math.max(0, Math.round(numeric(medicine.stockOnHand)));
    const reorderLevel = Math.max(0, Math.round(numeric(medicine.reorderLevel)));
    const unit = text(medicine.unit) || "units";
    const detail = `${formatNumber(stock)} ${unit} on hand${reorderLevel ? ` • Reorder level ${formatNumber(reorderLevel)}` : ""}`;

    if (stock === 0) return { label: "Out of stock", tone: "danger", detail };
    if (stock <= reorderLevel) return { label: "Low stock", tone: "warning", detail };
    return { label: "In stock", tone: "success", detail };
  };

  const requestMedicineMeta = (medicine = {}) => {
    const name = text(medicine.name).toLowerCase();
    const genericName = text(medicine.genericName);
    return [
      genericName && genericName.toLowerCase() !== name ? genericName : "",
      text(medicine.form),
      text(medicine.category)
    ].filter(Boolean).join(" • ");
  };

  const selectedRequestMedicineIds = () => new Set(
    Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-medicine") || [])
      .map((field) => text(field.value))
      .filter(Boolean)
  );

  const daysUntilDate = (dateStr) => {
    if (!dateStr) return Infinity;
    const target = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(target.getTime())) return Infinity;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  };

  const isMedicineLowStock = (medicine) => {
    const stock = Math.max(0, Math.round(numeric(medicine?.stockOnHand)));
    const reorder = Math.max(0, Math.round(numeric(medicine?.reorderLevel)));
    return stock <= reorder;
  };

  const getMedicineExpiringBatches = (medicine) => {
    const batches = Array.isArray(medicine?.batches) ? medicine.batches : [];
    return batches.filter((b) => {
      const isAct = text(b.status || "active").toLowerCase() === "active";
      const rem = numeric(b.quantityRemaining);
      return isAct && rem > 0 && daysUntilDate(b.expiryDate) <= 90;
    });
  };

  const isMedicineExpiringOrExpired = (medicine) => {
    const expiringBatches = getMedicineExpiringBatches(medicine);
    if (expiringBatches.length > 0) return true;
    const stock = Math.max(0, Math.round(numeric(medicine?.stockOnHand)));
    return stock > 0 && daysUntilDate(medicine?.expiryDate) <= 90;
  };

  const updateFilterTabCounts = () => {
    const allActive = activeInventoryMedicines();
    const lowCount = allActive.filter(isMedicineLowStock).length;
    const expCount = allActive.filter(isMedicineExpiringOrExpired).length;

    if (refs.pickerFilterAllCount) refs.pickerFilterAllCount.textContent = String(allActive.length);
    if (refs.pickerFilterLowCount) refs.pickerFilterLowCount.textContent = String(lowCount);
    if (refs.pickerFilterExpCount) refs.pickerFilterExpCount.textContent = String(expCount);

    const currentFilter = uiState.medicinePickerFilter || "all";
    refs.requestFilterTabs?.querySelectorAll(".request-filter-tab").forEach((tab) => {
      const tabFilter = tab.getAttribute("data-picker-filter") || "all";
      const isActive = tabFilter === currentFilter;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  };

  const closeMedicineResults = () => {
    // Persistent inline checklist — no hiding needed
  };

  const renderMedicineResults = () => {
    if (!refs.requestMedicineResults || !refs.requestMedicineSearch || uiState.requestModalMode === "view") return;
    updateFilterTabCounts();

    const query = text(refs.requestMedicineSearch.value).toLowerCase();
    const selectedIds = selectedRequestMedicineIds();
    const allActive = activeInventoryMedicines();
    const currentFilter = uiState.medicinePickerFilter || "all";

    const filteredMedicines = allActive.filter((medicine) => {
      if (currentFilter === "low" && !isMedicineLowStock(medicine)) return false;
      if (currentFilter === "expiring" && !isMedicineExpiringOrExpired(medicine)) return false;

      if (!query) return true;
      return [
        medicine.name,
        medicine.genericName,
        medicine.strength,
        medicine.form,
        medicine.category,
        medicine.batchNumber
      ].join(" ").toLowerCase().includes(query);
    });

    const sortedMedicines = filteredMedicines.sort((left, right) => {
      if (!query && currentFilter === "all") {
        const leftLow = isMedicineLowStock(left);
        const rightLow = isMedicineLowStock(right);
        if (leftLow !== rightLow) return Number(rightLow) - Number(leftLow);
      }

      return medicineLabel(left).localeCompare(medicineLabel(right));
    });

    const prevScroll = refs.requestMedicineResults.scrollTop;

    if (!sortedMedicines.length) {
      const filterLabel = currentFilter === "low" ? "low stock" : currentFilter === "expiring" ? "expiring or expired" : "active";
      refs.requestMedicineResults.innerHTML = `
        <div class="request-medicine-results__empty">
          <i class="bi bi-search" aria-hidden="true"></i>
          <span>No ${filterLabel} medicines match${query ? ` "${esc(text(refs.requestMedicineSearch.value))}"` : " the selected filter"}.</span>
        </div>
      `;
    } else {
      refs.requestMedicineResults.innerHTML = sortedMedicines.map((medicine, index) => {
        const stockInfo = requestStockInfo(medicine);
        const isSelected = selectedIds.has(text(medicine.id));
        const expiringBatches = getMedicineExpiringBatches(medicine);
        const isExp = isMedicineExpiringOrExpired(medicine);

        let statusPillsHtml = "";
        if (isExp) {
          const sortedBatches = [...expiringBatches].sort((a, b) => daysUntilDate(a.expiryDate) - daysUntilDate(b.expiryDate));
          const earliest = sortedBatches[0];
          const days = earliest ? daysUntilDate(earliest.expiryDate) : daysUntilDate(medicine.expiryDate);
          const isCriticalExpiry = days <= 30;
          const expLabel = days < 0 ? "Expired" : `${days}d left`;
          const expTone = isCriticalExpiry ? "danger" : "warning";

          statusPillsHtml = `
            <div class="d-flex flex-column align-items-end gap-1">
              ${stockInfo.label !== "In stock" ? `<span class="request-stock-pill request-stock-pill--${esc(stockInfo.tone)}">${esc(stockInfo.label)}</span>` : ""}
              <span class="request-stock-pill request-stock-pill--${expTone}"><i class="bi bi-clock-history"></i> ${esc(expLabel)}</span>
            </div>
          `;
        } else {
          statusPillsHtml = `<span class="request-stock-pill request-stock-pill--${esc(stockInfo.tone)}">${esc(stockInfo.label)}</span>`;
        }

        return `
          <label
            for="medCheck_${index}"
            class="request-checklist-item ${isSelected ? "is-selected" : ""}"
            data-medicine-id="${esc(medicine.id)}"
          >
            <div class="request-checklist-item__check">
              <input
                type="checkbox"
                id="medCheck_${index}"
                class="form-check-input request-medicine-checkbox"
                data-medicine-id="${esc(medicine.id)}"
                ${isSelected ? "checked" : ""}
              >
            </div>
            <div class="request-checklist-item__icon">
              <i class="bi bi-capsule-pill" aria-hidden="true"></i>
            </div>
            <div class="request-checklist-item__details">
              <strong class="request-checklist-item__name">${esc(medicineLabel(medicine))}</strong>
              <span class="request-checklist-item__meta">${esc(requestMedicineMeta(medicine) || "Inventory medicine")}</span>
              <span class="request-checklist-item__stock">${esc(stockInfo.detail)}</span>
            </div>
            <div class="request-checklist-item__status">
              ${statusPillsHtml}
            </div>
          </label>
        `;
      }).join("");
    }

    refs.requestMedicineResults.scrollTop = prevScroll;
  };

  const setRequestFormFeedback = (message = "", tone = "danger") => {
    if (!refs.requestFormFeedback) return;
    refs.requestFormFeedback.textContent = message;
    refs.requestFormFeedback.className = `col-span-2 request-form-feedback${message ? ` request-form-feedback--${tone}` : " d-none"}`;
  };

  const summarizeItemQuantities = (items = [], key = "quantityRequested") => {
    const parts = items
      .slice(0, 2)
      .map((item) => `${formatNumber(item[key])} ${item.unit}`)
      .filter(Boolean);
    if (!parts.length) return "-";
    return `${parts.join(" | ")}${items.length > 2 ? ` +${items.length - 2} more` : ""}`;
  };

  const createRequestItemRowMarkup = (item = {}) => {
    const medicine = findInventoryMedicine(item.medicineId);
    const stockInfo = medicine ? requestStockInfo(medicine) : { tone: "danger", detail: "Medicine is no longer available in inventory." };
    const displayName = medicine ? medicineLabel(medicine) : (text(item.medicineName) || "Unavailable medicine");
    const unit = text(medicine?.unit || item.unit) || "units";
    const quantity = Math.max(0, Math.round(numeric(item.quantityRequested)));

    return `
      <article class="request-item-row" data-request-item-id="${esc(item.id || "")}">
        <input type="hidden" class="request-item-medicine" value="${esc(item.medicineId || "")}">
        <div class="request-item-identity">
          <span class="request-item-icon"><i class="bi bi-capsule-pill" aria-hidden="true"></i></span>
          <div class="request-item-copy">
            <strong>${esc(displayName)}</strong>
            <span>${esc(medicine ? (requestMedicineMeta(medicine) || "Inventory medicine") : "Inventory record unavailable")}</span>
            <small class="request-stock-note request-stock-note--${esc(stockInfo.tone)}">
              <i class="bi bi-box-seam" aria-hidden="true"></i>${esc(stockInfo.detail)}
            </small>
          </div>
        </div>
        <div class="request-item-quantity-block">
          <label>Request quantity</label>
          <div class="request-quantity-line">
            <div class="request-quantity-stepper">
              <button type="button" class="request-quantity-step" data-step="-1" aria-label="Decrease quantity" ${quantity <= 1 ? "disabled" : ""}>
                <i class="bi bi-dash-lg" aria-hidden="true"></i>
              </button>
              <input
                type="number"
                min="1"
                step="1"
                inputmode="numeric"
                class="form-control request-item-quantity"
                placeholder="0"
                value="${quantity > 0 ? esc(String(quantity)) : ""}"
                aria-label="Quantity requested for ${esc(displayName)}"
                required
              >
              <button type="button" class="request-quantity-step" data-step="1" aria-label="Increase quantity">
                <i class="bi bi-plus-lg" aria-hidden="true"></i>
              </button>
            </div>
            <span class="request-item-unit">${esc(unit)}</span>
          </div>
        </div>
        <button type="button" class="request-item-remove" aria-label="Remove ${esc(displayName)}" title="Remove medicine">
          <i class="bi bi-trash3" aria-hidden="true"></i>
          <span>Remove</span>
        </button>
      </article>
    `;
  };

  const hasValidRequestQuantity = (input) => {
    const value = Number(text(input?.value));
    return Number.isInteger(value) && value > 0;
  };

  const collectRequestItems = () => {
    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    const seenMedicines = new Set();
    const items = [];

    if (!rows.length) {
      return { error: "Add at least one medicine before submitting the request.", focusEl: refs.requestMedicineSearch };
    }

    for (const rowEl of rows) {
      const medicineId = text(rowEl.querySelector(".request-item-medicine")?.value);
      const rawQuantity = text(rowEl.querySelector(".request-item-quantity")?.value);
      const quantityRequested = Number(rawQuantity);
      const medicine = findInventoryMedicine(medicineId);

      if (!medicine) {
        return { error: "One selected medicine is no longer available. Remove it before submitting.", focusEl: refs.requestMedicineSearch };
      }

      if (!Number.isInteger(quantityRequested) || quantityRequested <= 0) {
        return { error: `Enter a whole-number quantity for ${medicineLabel(medicine)}.`, focusEl: rowEl.querySelector(".request-item-quantity") };
      }

      if (seenMedicines.has(medicineId)) {
        return { error: `${medicineLabel(medicine)} is already listed in this request.`, focusEl: rowEl.querySelector(".request-item-quantity") };
      }

      seenMedicines.add(medicineId);
      items.push({
        id: text(rowEl.getAttribute("data-request-item-id")),
        medicineId: medicine.id,
        medicineName: medicineLabel(medicine),
        genericName: text(medicine.genericName),
        strength: text(medicine.strength),
        unit: text(medicine.unit) || "units",
        quantityRequested
      });
    }

    return { items };
  };

  const getWizardStepPanes = () => Array.from(refs.requestForm?.querySelectorAll(".request-wizard-pane") || []);
  const getWizardStepButtons = () => Array.from(refs.requestWizardStepper?.querySelectorAll(".request-wizard-step") || []);
  const getWizardStepConnectors = () => Array.from(refs.requestWizardStepper?.querySelectorAll(".request-wizard-step__connector") || []);

  const renderRequestChips = () => {
    if (!refs.requestChipsContainer) return;
    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    const count = rows.length;

    if (refs.requestChipsCount) {
      refs.requestChipsCount.textContent = count === 0
        ? "0 selected"
        : `${count} ${count === 1 ? "medicine" : "medicines"} selected`;
    }

    refs.requestChipsEmpty?.classList.toggle("d-none", count > 0);

    refs.requestChipsContainer.innerHTML = rows.map((row) => {
      const medicineId = text(row.querySelector(".request-item-medicine")?.value);
      const medicine = findInventoryMedicine(medicineId);
      const displayName = medicine ? medicineLabel(medicine) : "Unavailable medicine";
      const meta = medicine ? [medicine.strength, medicine.form].filter(Boolean).join(" • ") : "";

      return `
        <div class="request-chip" data-medicine-id="${esc(medicineId)}">
          <i class="bi bi-capsule-pill request-chip__icon" aria-hidden="true"></i>
          <div class="request-chip__content">
            <strong class="request-chip__name">${esc(displayName)}</strong>
            ${meta ? `<span class="request-chip__meta">${esc(meta)}</span>` : ""}
          </div>
          <button
            type="button"
            class="request-chip__remove"
            data-medicine-id="${esc(medicineId)}"
            aria-label="Remove ${esc(displayName)}"
            title="Remove ${esc(displayName)}"
          >
            <i class="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      `;
    }).join("");
  };

  const renderRequestReviewSummary = () => {
    const collected = collectRequestItems();
    const items = collected.items || [];
    const totalQty = items.reduce((sum, it) => sum + (Number(it.quantityRequested) || 0), 0);
    const expectedDateVal = refs.requestExpectedDate?.value;
    const dateFormatted = expectedDateVal ? formatDate(expectedDateVal) : "-";

    if (refs.requestReviewCount) {
      refs.requestReviewCount.textContent = `${items.length} ${items.length === 1 ? "medicine" : "medicines"}`;
    }
    if (refs.requestReviewTotalQty) {
      refs.requestReviewTotalQty.textContent = `${formatNumber(totalQty)} units`;
    }
    if (refs.requestReviewDateText) {
      refs.requestReviewDateText.textContent = dateFormatted || "Not set";
    }
    if (refs.requestReviewItemBadge) {
      refs.requestReviewItemBadge.textContent = `${items.length} ${items.length === 1 ? "Medicine" : "Medicines"}`;
    }

    if (refs.requestReviewList) {
      if (!items.length) {
        refs.requestReviewList.innerHTML = `<tr><td colspan="2" class="text-muted text-center py-3">No medicines selected.</td></tr>`;
      } else {
        refs.requestReviewList.innerHTML = items.map((item) => `
          <tr>
            <td>
              <div class="request-review-item-identity">
                <span class="request-item-icon sm"><i class="bi bi-capsule-pill" aria-hidden="true"></i></span>
                <div>
                  <strong>${esc(item.medicineName)}</strong>
                  <small class="d-block text-muted">${esc([item.genericName, item.strength].filter(Boolean).join(" • "))}</small>
                </div>
              </div>
            </td>
            <td class="text-end">
              <span class="request-review-qty-badge">${formatNumber(item.quantityRequested)} ${esc(item.unit)}</span>
            </td>
          </tr>
        `).join("");
      }
    }
  };

  const setWizardStep = (step) => {
    const targetStep = Math.max(1, Math.min(3, step));
    uiState.wizardStep = targetStep;

    const panes = getWizardStepPanes();
    panes.forEach((pane) => {
      const paneIndex = Number(pane.getAttribute("data-wizard-pane"));
      pane.classList.toggle("d-none", paneIndex !== targetStep);
      pane.classList.toggle("is-active", paneIndex === targetStep);
    });

    const stepButtons = getWizardStepButtons();
    stepButtons.forEach((btn) => {
      const btnStep = Number(btn.getAttribute("data-wizard-step"));
      btn.classList.toggle("is-active", btnStep === targetStep);
      btn.classList.toggle("is-completed", btnStep < targetStep);
      btn.setAttribute("aria-selected", btnStep === targetStep ? "true" : "false");
    });

    const connectors = getWizardStepConnectors();
    connectors.forEach((conn, index) => {
      conn.classList.toggle("is-completed", index < targetStep - 1);
    });

    if (refs.requestModalSubtitle) {
      if (uiState.requestModalMode === "view") {
        refs.requestModalSubtitle.textContent = "Review the request summary and listed medicines.";
      } else if (targetStep === 1) {
        refs.requestModalSubtitle.textContent = "Step 1 of 3: Select medicines to include in this request.";
      } else if (targetStep === 2) {
        refs.requestModalSubtitle.textContent = "Step 2 of 3: Set the requested quantity for each selected medicine.";
      } else {
        refs.requestModalSubtitle.textContent = "Step 3 of 3: Confirm delivery schedule and review request summary.";
      }
    }

    if (refs.requestWizardPrevBtn) {
      if (targetStep === 1) {
        refs.requestWizardPrevBtn.textContent = "Cancel";
      } else if (targetStep === 2) {
        refs.requestWizardPrevBtn.textContent = "← Back: Medicines";
      } else {
        refs.requestWizardPrevBtn.textContent = "← Back: Quantities";
      }
    }

    if (refs.requestWizardNextBtn && refs.requestSubmitBtn) {
      if (targetStep === 1) {
        refs.requestWizardNextBtn.classList.remove("d-none");
        refs.requestSubmitBtn.classList.add("d-none");
        if (refs.requestWizardNextBtnLabel) refs.requestWizardNextBtnLabel.textContent = "Next: Set Quantities";
      } else if (targetStep === 2) {
        refs.requestWizardNextBtn.classList.remove("d-none");
        refs.requestSubmitBtn.classList.add("d-none");
        if (refs.requestWizardNextBtnLabel) refs.requestWizardNextBtnLabel.textContent = "Next: Review & Schedule";
      } else {
        refs.requestWizardNextBtn.classList.add("d-none");
        refs.requestSubmitBtn.classList.remove("d-none");
        renderRequestReviewSummary();
      }
    }

    updateRequestBuilderState();
    setRequestFormFeedback();

    if (targetStep === 1) {
      renderMedicineResults();
      setTimeout(() => refs.requestMedicineSearch?.focus({ preventScroll: true }), 50);
    } else {
      closeMedicineResults();
      if (targetStep === 2) {
        setTimeout(() => {
          refs.requestItemsContainer?.querySelector(".request-item-quantity")?.focus({ preventScroll: true });
        }, 50);
      }
    }
  };

  const removeMedicineFromRequest = (medicineId) => {
    if (!refs.requestItemsContainer || !medicineId) return;
    const existingRow = Array.from(refs.requestItemsContainer.querySelectorAll(".request-item-row"))
      .find((row) => text(row.querySelector(".request-item-medicine")?.value) === text(medicineId));
    if (existingRow) {
      existingRow.remove();
      renderRequestChips();
      updateRequestBuilderState();

      const checkEl = refs.requestMedicineResults?.querySelector(`.request-medicine-checkbox[data-medicine-id="${medicineId}"]`);
      if (checkEl) {
        checkEl.checked = false;
        checkEl.closest(".request-checklist-item")?.classList.remove("is-selected");
      }
    }
  };

  const updateRequestBuilderState = () => {
    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    const incompleteCount = rows.filter((row) => !hasValidRequestQuantity(row.querySelector(".request-item-quantity"))).length;
    const unavailableCount = rows.filter((row) => !findInventoryMedicine(row.querySelector(".request-item-medicine")?.value)).length;
    const countLabel = `${formatNumber(rows.length)} selected`;
    const medicineLabelText = `${rows.length} medicine${rows.length === 1 ? "" : "s"}`;

    refs.requestItemsEmpty?.classList.toggle("d-none", rows.length > 0);
    if (refs.requestItemCount) refs.requestItemCount.textContent = countLabel;

    if (refs.requestChipsCount) {
      refs.requestChipsCount.textContent = rows.length === 0
        ? "0 selected"
        : `${rows.length} ${rows.length === 1 ? "medicine" : "medicines"} selected`;
    }
    refs.requestChipsEmpty?.classList.toggle("d-none", rows.length > 0);

    if (refs.requestItemsStatus) {
      refs.requestItemsStatus.textContent = rows.length === 0
        ? "Add at least one medicine to continue."
        : unavailableCount > 0
          ? `${unavailableCount} ${unavailableCount === 1 ? "medicine is" : "medicines are"} unavailable. Remove before submitting.`
        : incompleteCount > 0
          ? `${incompleteCount} ${incompleteCount === 1 ? "medicine needs" : "medicines need"} a quantity.`
          : "All medicine quantities are complete.";
    }

    if (refs.requestSummaryTitle) {
      refs.requestSummaryTitle.textContent = rows.length ? `${medicineLabelText} selected` : "No medicines selected";
    }
    if (refs.requestSummaryText) {
      refs.requestSummaryText.textContent = rows.length === 0
        ? "Search and add medicine details to continue."
        : unavailableCount > 0
          ? "Remove unavailable medicine records before submitting."
        : incompleteCount > 0
          ? `Enter the missing ${incompleteCount === 1 ? "quantity" : "quantities"} before submitting.`
          : `${medicineLabelText} ready to submit.`;
    }

    rows.forEach((row) => {
      const quantityInput = row.querySelector(".request-item-quantity");
      const quantity = Number(text(quantityInput?.value));
      const decreaseButton = row.querySelector('.request-quantity-step[data-step="-1"]');
      if (decreaseButton) decreaseButton.disabled = !Number.isInteger(quantity) || quantity <= 1;
    });

    if (refs.requestWizardNextBtn) {
      if (uiState.wizardStep === 1) {
        refs.requestWizardNextBtn.disabled = rows.length === 0 || unavailableCount > 0;
      } else if (uiState.wizardStep === 2) {
        refs.requestWizardNextBtn.disabled = rows.length === 0 || unavailableCount > 0 || incompleteCount > 0;
      }
    }

    if (refs.requestSubmitBtn) {
      refs.requestSubmitBtn.disabled = uiState.requestModalMode === "view" || rows.length === 0 || unavailableCount > 0 || incompleteCount > 0;
    }
  };

  const renderRequestItems = (items = []) => {
    if (!refs.requestItemsContainer) return;
    refs.requestItemsContainer.innerHTML = items
      .map((item) => createRequestItemRowMarkup(item))
      .join("");
    renderRequestChips();
    updateRequestBuilderState();
  };

  const addMedicineToRequest = (medicineId) => {
    if (!refs.requestItemsContainer) return;
    const medicine = findInventoryMedicine(medicineId);
    if (!medicine || !isActiveInventoryMedicine(medicine)) {
      setRequestFormFeedback("This medicine is no longer available in the active inventory.");
      return;
    }

    const existingRow = Array.from(refs.requestItemsContainer.querySelectorAll(".request-item-row"))
      .find((row) => text(row.querySelector(".request-item-medicine")?.value) === text(medicineId));
    if (!existingRow) {
      refs.requestItemsContainer.insertAdjacentHTML("beforeend", createRequestItemRowMarkup({ medicineId }));
    }

    setRequestFormFeedback();
    renderRequestChips();
    updateRequestBuilderState();

    const checkEl = refs.requestMedicineResults?.querySelector(`.request-medicine-checkbox[data-medicine-id="${medicineId}"]`);
    if (checkEl) {
      checkEl.checked = true;
      checkEl.closest(".request-checklist-item")?.classList.add("is-selected");
    }
  };

  const filteredRows = () => {
    const query = text(uiState.search).toLowerCase();

    return requestGroups().filter((row) => {
      if (uiState.status === "pending" && !row.pending) return false;
      if (uiState.status === "incomplete" && !row.incomplete) return false;
      if (uiState.status === "delayed" && !row.delayed) return false;
      if (uiState.status === "on-time" && !row.onTime) return false;

      if (!query) return true;
      const haystack = [
        row.requestCode,
        row.medicineSummary,
        row.source,
        row.statusLabel,
        ...row.items.map((item) => [item.medicineName, item.genericName, item.strength].join(" "))
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  };

  let activeActionMenu = null;
  const canDeleteRequestGroup = (requestGroup) => Boolean(requestGroup) && (!requestGroup.hasDelivery || requestGroup.isComplete);

  const renderActionMenu = (row) => {
    return `
      <div class="request-action-menu">
        <button
          type="button"
          class="btn btn-sm btn-light table-action-btn request-action-toggle"
          data-request-menu-toggle="true"
          data-id="${esc(row.requestGroupId)}"
          aria-expanded="false"
          aria-label="Open request actions"
          title="Open request actions"
        >
          <i class="bi bi-three-dots-vertical"></i>
        </button>
      </div>
    `;
  };

  const buildActionMenuItems = (requestGroup) => {
    if (!requestGroup) return "";

    const menuItems = [
      `
        <button type="button" class="request-action-item" data-action="view" data-id="${esc(requestGroup.requestGroupId)}">
          <i class="bi bi-eye"></i>
          <span>View</span>
        </button>
      `,
      `
        <button type="button" class="request-action-item text-success" data-action="print-slip" data-id="${esc(requestGroup.requestGroupId)}">
          <i class="bi bi-download"></i>
          <span>Export Slip</span>
        </button>
      `
    ];

    if (!requestGroup.hasDelivery) {
      menuItems.push(`
        <button type="button" class="request-action-item" data-action="edit" data-id="${esc(requestGroup.requestGroupId)}">
          <i class="bi bi-pencil-square"></i>
          <span>Edit</span>
        </button>
      `);
    }

    if (canDeleteRequestGroup(requestGroup)) {
      menuItems.push(`
        <button type="button" class="request-action-item text-danger" data-action="delete" data-id="${esc(requestGroup.requestGroupId)}">
          <i class="bi bi-trash3"></i>
          <span>Delete</span>
        </button>
      `);
    }

    return menuItems.join("");
  };

  const closeActionMenu = () => {
    if (!activeActionMenu) return;
    activeActionMenu.toggle?.setAttribute("aria-expanded", "false");
    activeActionMenu.menu?.remove();
    activeActionMenu = null;
  };

  const positionActionMenu = (toggleEl, menuEl) => {
    if (!toggleEl || !menuEl) return;

    const toggleRect = toggleEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuWidth = menuEl.offsetWidth || 168;
    const menuHeight = menuEl.offsetHeight || 0;
    const gap = 8;

    let left = toggleRect.right - menuWidth;
    let top = toggleRect.bottom + gap;

    if (left < gap) left = gap;
    if ((left + menuWidth) > (viewportWidth - gap)) {
      left = Math.max(gap, viewportWidth - menuWidth - gap);
    }

    if ((top + menuHeight) > (viewportHeight - gap)) {
      const upwardTop = toggleRect.top - menuHeight - gap;
      top = upwardTop >= gap ? upwardTop : Math.max(gap, viewportHeight - menuHeight - gap);
    }

    menuEl.style.left = `${Math.round(left)}px`;
    menuEl.style.top = `${Math.round(top)}px`;
  };

  const openActionMenu = (toggleEl, requestGroup) => {
    if (!toggleEl || !requestGroup) return;

    if (activeActionMenu?.toggle === toggleEl) {
      closeActionMenu();
      return;
    }

    closeActionMenu();

    const menuEl = document.createElement("div");
    menuEl.className = "request-action-dropdown";
    menuEl.setAttribute("role", "menu");
    menuEl.innerHTML = buildActionMenuItems(requestGroup);
    document.body.appendChild(menuEl);

    positionActionMenu(toggleEl, menuEl);
    toggleEl.setAttribute("aria-expanded", "true");
    activeActionMenu = {
      toggle: toggleEl,
      menu: menuEl
    };
  };

  const renderTable = () => {
    if (!refs.requestTableBody) return;
    closeActionMenu();

    const rows = filteredRows();
    if (refs.requestCount) {
      refs.requestCount.textContent = `${formatNumber(rows.length)} request${rows.length === 1 ? "" : "s"}`;
    }

    if (!rows.length) {
      refs.requestTableBody.innerHTML = `
        <tr>
          <td colspan="9" class="inventory-empty">No CHO requests match the current filters.</td>
        </tr>
      `;
      return;
    }

    refs.requestTableBody.innerHTML = rows.map((row) => {
      const leadTimeValue = row.isComplete
        ? `${formatNumber(row.leadTimeDays)} days`
        : row.hasDelivery
          ? `${formatNumber(row.elapsedDays)} days so far`
          : "-";
      const leadTimeNote = row.isComplete
        ? `Completed ${formatDate(row.completionDate)}`
        : row.hasDelivery
          ? `${formatNumber(Math.max(0, row.itemCount - row.completedItems))} medicine line(s) still pending`
          : row.isOverdue
            ? `${formatNumber(row.overdueDays)} day(s) overdue`
            : "Waiting for first delivery";

      const receivedNote = row.isComplete
        ? `Completed ${formatNumber(row.completedItems)} of ${formatNumber(row.itemCount)} medicine lines`
        : row.hasDelivery
          ? `${formatNumber(row.deliveredItems)} of ${formatNumber(row.itemCount)} medicine lines received`
          : "Awaiting delivery";

      return `
        <tr>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(row.requestCode || "CHO Request")}</strong>
              <small>${esc(row.source)}</small>
            </div>
          </td>
          <td>
            <div class="request-medicine-list">
              ${row.items.slice(0, 1).map((item) => `
                <div class="request-medicine-line">
                  <strong>${esc(item.medicineName)}</strong>
                  <small>${esc(item.genericName || item.unit)}</small>
                </div>
              `).join("")}
              ${row.items.length > 1 ? `<small class="request-medicine-more">+${esc(formatNumber(row.items.length - 1))} more — View details</small>` : ""}
            </div>
          </td>
          <td>
            <div class="inventory-stock">
              <strong>${esc(formatNumber(row.itemCount))} medicine${row.itemCount === 1 ? "" : "s"}</strong>
              <small>${esc(summarizeItemQuantities(row.items, "quantityRequested"))}</small>
            </div>
          </td>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(formatDate(row.requestDate))}</strong>
              <small>Logged by ${esc(row.requestedBy)}</small>
            </div>
          </td>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(formatDate(row.expectedDate))}</strong>
              <small>${row.delayed || row.isOverdue ? `${esc(formatNumber(row.overdueDays))} day(s) late` : row.incomplete ? "Awaiting remaining delivery" : "Target receiving date"}</small>
            </div>
          </td>
          <td>
            <div class="inventory-stock">
              <strong>${esc(formatNumber(row.completedItems))} / ${esc(formatNumber(row.itemCount))}</strong>
              <small>${esc(receivedNote)}</small>
            </div>
          </td>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(leadTimeValue)}</strong>
              <small>${esc(leadTimeNote)}</small>
            </div>
          </td>
          <td><span class="inventory-status inventory-status--${esc(row.tone)}">${esc(row.statusLabel)}</span></td>
          <td>
            <div class="inventory-actions">
              ${renderActionMenu(row)}
            </div>
          </td>
        </tr>
      `;
    }).join("");
  };

  const renderRequestDetails = (requestGroup) => {
    if (!requestGroup) return;
    uiState.currentViewRequestGroup = requestGroup;

    if (refs.requestDetailCode) refs.requestDetailCode.textContent = requestGroup.requestCode || "-";
    if (refs.requestDetailRequestDate) refs.requestDetailRequestDate.textContent = formatDate(requestGroup.requestDate);
    if (refs.requestDetailExpectedDate) refs.requestDetailExpectedDate.textContent = formatDate(requestGroup.expectedDate);
    if (refs.requestDetailStatus) {
      refs.requestDetailStatus.innerHTML = `<span class="inventory-status inventory-status--${esc(requestGroup.tone)}">${esc(requestGroup.statusLabel)}</span>`;
    }

    if (!refs.requestDetailTableBody) return;
    refs.requestDetailTableBody.innerHTML = (requestGroup.items || []).length
      ? requestGroup.items.map((item) => `
        <tr>
          <td>
            <div class="request-detail-medicine">
              <strong>${esc(item.medicineName)}</strong>
              <small>${esc(item.strength || item.unit)}</small>
            </div>
          </td>
          <td>${esc(item.genericName || "-")}</td>
          <td>
            <div class="request-detail-quantity">
              <strong>${esc(formatNumber(item.quantityRequested))}</strong>
              <small>${esc(item.unit)}</small>
            </div>
          </td>
        </tr>
      `).join("")
      : `
        <tr>
          <td colspan="3" class="inventory-empty">No medicines listed.</td>
        </tr>
      `;
  };

  const setRequestModalLayout = (mode) => {
    const isView = mode === "view";
    refs.requestForm?.classList.toggle("d-none", isView);
    refs.requestDetailsView?.classList.toggle("d-none", !isView);
  };

  const renderAll = () => {
    renderTable();
  };

  const saveState = () => {
    state.requests = supplyMonitoring.prepareRequests(state.requests)
      .sort((left, right) => new Date(right.requestDate).getTime() - new Date(left.requestDate).getTime());
    supplyMonitoring.setState({
      inventory: state.inventory,
      movements: state.movements,
      requests: state.requests
    });
  };

  const syncStateFromServer = (serverState = {}) => {
    if (Array.isArray(serverState.inventory)) {
      state.inventory = serverState.inventory.map((entry) => ({ ...entry }));
    }
    if (Array.isArray(serverState.movements)) {
      state.movements = serverState.movements.map((entry) => ({ ...entry }));
    }
    if (Array.isArray(serverState.requests)) {
      state.requests = serverState.requests.map((entry) => supplyMonitoring.normalizeRequest(entry));
    }
    saveState();
  };

  const loadState = () => {
    const supplyState = supplyMonitoring.getState();
    state.inventory = Array.isArray(supplyState.inventory) ? supplyState.inventory.map((entry) => ({ ...entry })) : [];
    state.movements = Array.isArray(supplyState.movements) ? supplyState.movements.map((entry) => ({ ...entry })) : [];
    state.requests = supplyMonitoring.readRequests();
  };

  const cloneEntries = (entries = []) => entries.map((entry) => ({ ...entry }));
  const createRequestStateSnapshot = () => ({
    requests: cloneEntries(state.requests)
  });
  const restoreRequestStateSnapshot = (snapshot) => {
    if (!snapshot) return;
    state.requests = snapshot.requests.map((entry) => supplyMonitoring.normalizeRequest(entry));
    saveState();
  };

  const persistRequestState = async ({ showSyncError = true } = {}) => {
    saveState();

    try {
      const payload = await requestJson(STATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          state: {
            requests: state.requests
          }
        })
      });
      syncStateFromServer(payload.state || {});
      return payload;
    } catch (error) {
      saveState();
      if (showSyncError) throw error;
      console.error("Unable to persist CHO request log state.", error);
      return null;
    }
  };

  const hydrateRequestState = async () => {
    if (requestHydrationPromise) {
      await requestHydrationPromise;
      return;
    }

    requestHydrationPromise = (async () => {
      try {
        const payload = await requestJson(`${STATE_ENDPOINT}?t=${Date.now()}`);
        syncStateFromServer(payload?.state || {});
      } catch (error) {
        loadState();

        if (state.requests.length || state.inventory.length || state.movements.length) {
          showNotice("Unable to refresh CHO request data right now. Showing the last synced records on this page.", "warning");
          return;
        }

        showNotice("Unable to load backend CHO request data right now.", "danger");
      }
    })();

    try {
      await requestHydrationPromise;
    } finally {
      requestHydrationPromise = null;
    }
  };

  const setRequestFormReadOnly = (readOnly) => {
    [
      refs.requestDate,
      refs.requestExpectedDate
    ].forEach((field) => {
      if (!field) return;
      field.disabled = readOnly;
    });

    refs.requestMedicinePicker?.classList.toggle("d-none", readOnly);
    refs.requestFilterTabs?.classList.toggle("d-none", readOnly);
    refs.requestWizardStepper?.classList.toggle("d-none", readOnly);
    refs.requestWizardPrevBtn?.classList.toggle("d-none", readOnly);
    if (refs.requestMedicineSearch) refs.requestMedicineSearch.disabled = readOnly;

    if (readOnly) {
      refs.requestWizardNextBtn?.classList.add("d-none");
      refs.requestSubmitBtn?.classList.add("d-none");
    }

    const rowFields = refs.requestItemsContainer?.querySelectorAll(".request-item-quantity, .request-item-remove, .request-quantity-step") || [];
    rowFields.forEach((field) => {
      field.disabled = readOnly;
    });

    if (!readOnly) {
      setWizardStep(uiState.wizardStep || 1);
      updateRequestBuilderState();
    }
  };

  const openRequestModal = (requestGroup = null, mode = "edit") => {
    if (!refs.requestForm) return;
    closeActionMenu();
    uiState.requestModalMode = mode;
    uiState.medicinePickerFilter = "all";
    updateFilterTabCounts();
    refs.requestForm.reset();
    refs.requestId.value = requestGroup?.requestGroupId || "";
    if (refs.requestMedicineSearch) refs.requestMedicineSearch.value = "";
    closeMedicineResults();
    setRequestFormFeedback();
    setRequestModalLayout(mode);

    refs.requestModalTitle.textContent = !requestGroup
      ? "New CHO Request"
      : mode === "view"
        ? "CHO Request Details"
        : "Edit CHO Request";
    refs.requestModalSubtitle.textContent = !requestGroup
      ? "Step 1 of 3: Select medicines to include in this request."
      : mode === "view"
        ? "Review the request summary and listed medicines."
        : "Step 1 of 3: Update or add medicines before saving.";
    if (refs.requestSubmitBtnLabel) {
      refs.requestSubmitBtnLabel.textContent = requestGroup ? "Update Request" : "Submit Request";
    }

    if (mode === "view" && requestGroup) {
      renderRequestDetails(requestGroup);
    } else {
      refs.requestDate.value = requestGroup?.requestDate || supplyMonitoring.todayInputValue();
      refs.requestExpectedDate.value = requestGroup?.expectedDate || supplyMonitoring.addDays(refs.requestDate.value, 5);
      renderRequestItems(requestGroup?.items || []);
      setRequestFormReadOnly(false);
      setWizardStep(1);
    }

    requestModal?.show();
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    if (uiState.requestModalMode === "view") return;
    setRequestFormFeedback();

    const requestDate = supplyMonitoring.normalizeInputDate(refs.requestDate?.value);
    const expectedDate = supplyMonitoring.normalizeInputDate(refs.requestExpectedDate?.value, supplyMonitoring.addDays(requestDate, 5));
    if (new Date(expectedDate).getTime() < new Date(requestDate).getTime()) {
      setRequestFormFeedback("Expected delivery date cannot be earlier than the request date.");
      refs.requestExpectedDate?.focus();
      return;
    }

    const collected = collectRequestItems();
    if (collected.error) {
      setRequestFormFeedback(collected.error);
      collected.focusEl?.focus();
      return;
    }

    const existingGroupId = text(refs.requestId?.value);
    const existingGroup = existingGroupId ? findRequestGroup(existingGroupId) : null;
    if (existingGroup?.hasDelivery) {
      showNotice("This request already has linked deliveries and is now view-only.", "danger");
      openRequestModal(existingGroup, "view");
      return;
    }

    const requestGroupId = existingGroup?.requestGroupId || supplyMonitoring.uid();
    const requestCode = existingGroup?.requestCode || supplyMonitoring.nextRequestCode(state.requests);
    const existingItemsByMedicine = new Map((existingGroup?.items || []).map((item) => [text(item.medicineId), item]));
    const source = "City Health Office (CHO)";
    const notes = existingGroup?.notes || "";
    const createdAt = existingGroup?.createdAt || `${requestDate}T08:00:00`;

    const replacementRows = collected.items.map((item) => {
      const existingItem = existingItemsByMedicine.get(text(item.medicineId));
      return supplyMonitoring.normalizeRequest({
        id: existingItem?.id || item.id || supplyMonitoring.uid(),
        requestGroupId,
        requestCode,
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        genericName: item.genericName,
        strength: item.strength,
        unit: item.unit,
        quantityRequested: item.quantityRequested,
        requestDate,
        expectedDate,
        source,
        requestedBy: existingGroup?.requestedBy || requesterName(),
        notes,
        createdAt: existingItem?.createdAt || createdAt,
        updatedAt: supplyMonitoring.nowIso()
      });
    });

    const snapshot = createRequestStateSnapshot();
    state.requests = state.requests.filter((entry) => {
      const normalized = supplyMonitoring.normalizeRequest(entry);
      return text(normalized.requestGroupId) !== text(requestGroupId);
    });
    state.requests.unshift(...replacementRows);
    if (refs.requestSubmitBtn) refs.requestSubmitBtn.disabled = true;
    if (refs.requestSubmitBtnLabel) {
      refs.requestSubmitBtnLabel.textContent = existingGroup ? "Updating..." : "Submitting...";
    }

    try {
      await persistRequestState();
    } catch (error) {
      restoreRequestStateSnapshot(snapshot);
      renderAll();
      if (refs.requestSubmitBtnLabel) {
        refs.requestSubmitBtnLabel.textContent = existingGroup ? "Update Request" : "Submit Request";
      }
      updateRequestBuilderState();
      setRequestFormFeedback(error.message || "Unable to save the CHO request right now.");
      return;
    }

    renderAll();
    requestModal?.hide();
    showNotice(existingGroup ? "CHO request updated successfully." : "CHO request submitted successfully.");
  };

  const handleDeleteRequest = (requestGroupId) => {
    closeActionMenu();
    const row = findRequestGroup(requestGroupId);
    if (!row) return;

    if (!canDeleteRequestGroup(row)) {
      showNotice("Only pending or completed requests can be deleted from the request log.", "danger");
      return;
    }

    uiState.pendingDeleteGroupId = requestGroupId;
    if (refs.requestDeleteMessage) {
      refs.requestDeleteMessage.textContent = row.isComplete
        ? `Remove ${row.requestCode || "this completed CHO request"} from the request log? Dashboard analytics history will stay available.`
        : `Delete ${row.requestCode || "this CHO request"} and all listed medicines?`;
    }
    requestDeleteModal?.show();
  };

  const confirmDeleteRequest = async () => {
    const requestGroupId = text(uiState.pendingDeleteGroupId);
    if (!requestGroupId) return;
    const row = findRequestGroup(requestGroupId);
    if (!row) return;

    const snapshot = createRequestStateSnapshot();
    if (row.isComplete) {
      state.requests = state.requests.map((entry) => {
        const normalized = supplyMonitoring.normalizeRequest(entry);
        if (text(normalized.requestGroupId) !== text(requestGroupId)) {
          return normalized;
        }

        return {
          ...normalized,
          recordStatus: "archived",
          updatedAt: supplyMonitoring.nowIso()
        };
      });
    } else {
      state.requests = state.requests.filter((entry) => {
        const normalized = supplyMonitoring.normalizeRequest(entry);
        return text(normalized.requestGroupId) !== text(requestGroupId);
      });
    }

    try {
      await persistRequestState();
    } catch (error) {
      restoreRequestStateSnapshot(snapshot);
      renderAll();
      showNotice(error.message || "Unable to delete the CHO request right now.", "danger");
      return;
    }

    renderAll();
    uiState.pendingDeleteGroupId = "";
    requestDeleteModal?.hide();
  };

  const PDF_HEADER_LOGOS = [
    "assets/img/CityHealthOffice_LOGO.png",
    "assets/img/ligao-city-logo.png"
  ];

  const loadImageAsDataUrl = (src) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) {
          resolve("");
          return;
        }
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        context.drawImage(image, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        resolve("");
      }
    };
    image.onerror = () => resolve("");
    image.src = src;
  });

  const generateRequestSlipPdf = async (requestGroup) => {
    if (!requestGroup) return false;
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) {
      showNotice("PDF export library is not available. Please check your internet connection or reload the page.", "warning");
      return false;
    }

    const doc = new jsPDFCtor({ orientation: "portrait", unit: "pt", format: "a4" });
    if (typeof doc.autoTable !== "function") {
      showNotice("PDF table generator is not available. Please reload the page.", "warning");
      return false;
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const centerX = pageWidth / 2;

    const logos = await Promise.all(PDF_HEADER_LOGOS.map((src) => loadImageAsDataUrl(src)));
    const [leftLogo, rightLogo] = logos;

    if (leftLogo) doc.addImage(leftLogo, "PNG", margin, 24, 46, 46, undefined, "FAST");
    if (rightLogo) doc.addImage(rightLogo, "PNG", pageWidth - margin - 46, 24, 46, 46, undefined, "FAST");

    let cursorY = 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 115, 95);
    doc.text("Republic of the Philippines", centerX, cursorY, { align: "center" });

    cursorY += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 85, 65);
    doc.text("Province of Albay • City of Ligao", centerX, cursorY, { align: "center" });

    cursorY += 13;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(27, 67, 50);
    doc.text("LIGAO CITY COASTAL RURAL HEALTH UNIT", centerX, cursorY, { align: "center" });

    cursorY += 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 115, 95);
    doc.text("Cabarian, Ligao City, Albay", centerX, cursorY, { align: "center" });

    cursorY += 14;
    doc.setDrawColor(27, 67, 50);
    doc.setLineWidth(1.2);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    doc.setDrawColor(185, 205, 180);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY + 2.5, pageWidth - margin, cursorY + 2.5);

    cursorY += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(27, 67, 50);
    doc.text("OFFICIAL MEDICINE REQUISITION SLIP", centerX, cursorY, { align: "center" });

    cursorY += 16;
    const boxX = margin;
    const boxY = cursorY;
    const boxWidth = pageWidth - (margin * 2);
    const boxHeight = 58;

    doc.setFillColor(250, 252, 248);
    doc.setDrawColor(215, 228, 212);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 3, 3, "FD");

    const col1X = boxX + 14;
    const col2X = boxX + (boxWidth / 2) + 12;
    let metaY = boxY + 16;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(27, 67, 50);
    doc.text("Requisition No.:", col1X, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(18, 48, 38);
    doc.text(String(requestGroup.requestCode || "-"), col1X + 80, metaY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 67, 50);
    doc.text("Issuing Office:", col2X, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 45, 30);
    doc.text(String(requestGroup.source || "City Health Office (CHO)"), col2X + 75, metaY);

    metaY += 15;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 67, 50);
    doc.text("Date Requested:", col1X, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 45, 30);
    doc.text(formatDate(requestGroup.requestDate), col1X + 80, metaY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 67, 50);
    doc.text("Requested By:", col2X, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 45, 30);
    doc.text(String(requestGroup.requestedBy || requesterName()), col2X + 75, metaY);

    metaY += 15;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 67, 50);
    doc.text("Requesting Unit:", col1X, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 45, 30);
    doc.text("Coastal RHU - Cabarian", col1X + 80, metaY);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(27, 67, 50);
    doc.text("Target Delivery:", col2X, metaY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 45, 30);
    doc.text(formatDate(requestGroup.expectedDate), col2X + 75, metaY);

    cursorY = boxY + boxHeight + 14;

    const formatMedicineDescription = (item) => {
      const name = String(item.medicineName || "").trim();
      const str = String(item.strength || "").trim();
      if (!str) return name || "-";
      if (name.toLowerCase().includes(str.toLowerCase())) return name;
      return `${name} (${str})`;
    };

    const items = Array.isArray(requestGroup.items) ? requestGroup.items : [];
    const tableRows = items.map((item, idx) => [
      String(idx + 1),
      formatMedicineDescription(item),
      item.genericName || "-",
      formatNumber(item.quantityRequested || 0),
      item.unit || "units",
      item.notes && item.notes.trim() ? item.notes.trim() : ""
    ]);

    const totalQty = items.reduce((acc, it) => acc + (numeric(it.quantityRequested) || 0), 0);
    const footRow = [
      {
        content: `Total Medicines Requested: ${items.length} item(s)`,
        colSpan: 3,
        styles: { fontStyle: "bold", fontSize: 8.5, textColor: [27, 67, 50], fillColor: [244, 248, 243], halign: "left" }
      },
      {
        content: `${formatNumber(totalQty)}`,
        styles: { fontStyle: "bold", fontSize: 8.5, textColor: [27, 67, 50], fillColor: [244, 248, 243], halign: "center" }
      },
      {
        content: "units total",
        colSpan: 2,
        styles: { fontStyle: "bold", fontSize: 8, textColor: [27, 67, 50], fillColor: [244, 248, 243], halign: "left" }
      }
    ];

    doc.autoTable({
      startY: cursorY,
      head: [["#", "Medicine Description", "Generic Name", "Qty Req.", "Unit", "Remarks"]],
      body: tableRows.length ? tableRows : [["-", "No medicines recorded", "-", "0", "-", ""]],
      foot: [footRow],
      margin: { top: 120, right: margin, bottom: 60, left: margin },
      styles: {
        font: "helvetica",
        fontSize: 8,
        cellPadding: { top: 5.5, right: 6, bottom: 5.5, left: 6 },
        lineColor: [215, 225, 210],
        lineWidth: 0.45,
        textColor: [25, 45, 25],
        valign: "middle"
      },
      headStyles: {
        fillColor: [27, 67, 50],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5
      },
      footStyles: {
        fillColor: [244, 248, 243]
      },
      alternateRowStyles: {
        fillColor: [250, 252, 248]
      },
      columnStyles: {
        0: { cellWidth: 26, halign: "center" },
        1: { cellWidth: 165 },
        2: { cellWidth: 134 },
        3: { cellWidth: 60, halign: "center", fontStyle: "bold" },
        4: { cellWidth: 50, halign: "center" },
        5: { cellWidth: 80 }
      }
    });

    let sigY = (doc.lastAutoTable?.finalY || cursorY) + 28;
    if (sigY > pageHeight - 120) {
      doc.addPage();
      sigY = 60;
    }

    const blockWidth = 195;
    const leftBlockX = margin;
    const rightBlockX = pageWidth - margin - blockWidth;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 100, 80);
    doc.text("REQUESTED & PREPARED BY:", leftBlockX, sigY);

    const leftLineY = sigY + 34;
    doc.setDrawColor(120, 135, 115);
    doc.setLineWidth(0.65);
    doc.line(leftBlockX, leftLineY, leftBlockX + blockWidth, leftLineY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(25, 45, 25);
    doc.text(String(requestGroup.requestedBy || requesterName()).toUpperCase(), leftBlockX + (blockWidth / 2), leftLineY - 4, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(95, 110, 90);
    doc.text("Nurse-in-Charge / Property Custodian", leftBlockX + (blockWidth / 2), leftLineY + 10, { align: "center" });
    doc.text("Ligao City Coastal RHU", leftBlockX + (blockWidth / 2), leftLineY + 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(85, 100, 80);
    doc.text("APPROVED & ALLOCATED BY:", rightBlockX, sigY);

    const rightLineY = sigY + 34;
    doc.line(rightBlockX, rightLineY, rightBlockX + blockWidth, rightLineY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.8);
    doc.setTextColor(95, 110, 90);
    doc.text("City Health Officer / Pharmacist", rightBlockX + (blockWidth / 2), rightLineY + 10, { align: "center" });
    doc.text("City Health Office - Ligao City", rightBlockX + (blockWidth / 2), rightLineY + 20, { align: "center" });
    doc.text("Date: ________________________", rightBlockX + (blockWidth / 2), rightLineY + 30, { align: "center" });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(112, 124, 106);
      doc.text("System-generated Requisition Slip • Ligao City Coastal RHU Medicine Inventory", margin, pageHeight - 16);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: "right" });
    }

    const cleanCode = (requestGroup.requestCode || "CHO-REQ").replace(/[^a-zA-Z0-9-_]/g, "_");
    doc.save(`Requisition_Slip_${cleanCode}.pdf`);
    return true;
  };

  refs.sidebarToggle?.addEventListener("click", toggleSidebar);
  refs.sidebarBackdrop?.addEventListener("click", closeMobileSidebar);
  refs.logoutLink?.addEventListener("click", (event) => {
    event.preventDefault();
    logoutModal?.show();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
  });

  refs.openRequestModalBtn?.addEventListener("click", () => {
    if (!activeInventoryMedicines().length) {
      showNotice("Create medicine inventory records first before logging a CHO request.", "danger");
      return;
    }
    openRequestModal(null, "create");
  });

  refs.confirmDeleteRequestBtn?.addEventListener("click", () => {
    void confirmDeleteRequest();
  });
  refs.printRequestSlipBtn?.addEventListener("click", () => {
    if (uiState.currentViewRequestGroup) {
      void generateRequestSlipPdf(uiState.currentViewRequestGroup);
    }
  });
  refs.requestForm?.addEventListener("submit", (event) => {
    void handleRequestSubmit(event);
  });
  refs.requestDate?.addEventListener("change", () => {
    const requestDate = supplyMonitoring.normalizeInputDate(refs.requestDate?.value);
    const expectedDate = supplyMonitoring.normalizeInputDate(refs.requestExpectedDate?.value, "");
    if (!expectedDate || new Date(expectedDate).getTime() < new Date(requestDate).getTime()) {
      refs.requestExpectedDate.value = supplyMonitoring.addDays(requestDate, 5);
    }
    setRequestFormFeedback();
  });
  refs.requestExpectedDate?.addEventListener("change", () => setRequestFormFeedback());

  refs.requestMedicineSearch?.addEventListener("focus", renderMedicineResults);
  refs.requestMedicineSearch?.addEventListener("input", () => {
    setRequestFormFeedback();
    renderMedicineResults();
  });
  refs.requestMedicineSearch?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!refs.requestMedicineResults?.classList.contains("d-none")) {
        event.preventDefault();
        event.stopPropagation();
        closeMedicineResults();
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const firstCheck = refs.requestMedicineResults?.querySelector(".request-medicine-checkbox");
      if (firstCheck) {
        firstCheck.checked = !firstCheck.checked;
        firstCheck.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  refs.requestFilterTabs?.addEventListener("click", (event) => {
    const tab = event.target.closest(".request-filter-tab[data-picker-filter]");
    if (!tab) return;
    event.preventDefault();
    uiState.medicinePickerFilter = tab.getAttribute("data-picker-filter") || "all";
    updateFilterTabCounts();
    renderMedicineResults();
    refs.requestMedicineSearch?.focus({ preventScroll: true });
  });

  refs.requestMedicineResults?.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".request-medicine-checkbox");
    if (!checkbox) return;
    const medicineId = checkbox.getAttribute("data-medicine-id");
    if (checkbox.checked) {
      addMedicineToRequest(medicineId);
    } else {
      removeMedicineFromRequest(medicineId);
    }
  });

  refs.requestItemsContainer?.addEventListener("click", (event) => {
    const stepButton = event.target.closest(".request-quantity-step[data-step]");
    if (stepButton && uiState.requestModalMode !== "view") {
      const row = stepButton.closest(".request-item-row");
      const quantityInput = row?.querySelector(".request-item-quantity");
      if (!quantityInput) return;

      const step = Number(stepButton.getAttribute("data-step")) || 0;
      const currentQuantity = Math.max(0, Math.round(numeric(quantityInput.value)));
      quantityInput.value = String(Math.max(1, currentQuantity + step));
      setRequestFormFeedback();
      updateRequestBuilderState();
      return;
    }

    const removeButton = event.target.closest(".request-item-remove");
    if (!removeButton || uiState.requestModalMode === "view") return;
    removeButton.closest(".request-item-row")?.remove();
    setRequestFormFeedback();
    renderRequestChips();
    updateRequestBuilderState();
    if (!refs.requestMedicineResults?.classList.contains("d-none")) renderMedicineResults();
  });

  refs.requestItemsContainer?.addEventListener("input", (event) => {
    if (!event.target.matches(".request-item-quantity")) return;
    setRequestFormFeedback();
    updateRequestBuilderState();
  });

  refs.requestWizardStepper?.addEventListener("click", (event) => {
    const stepBtn = event.target.closest(".request-wizard-step[data-wizard-step]");
    if (!stepBtn || uiState.requestModalMode === "view") return;
    const target = Number(stepBtn.getAttribute("data-wizard-step"));
    if (target === uiState.wizardStep) return;

    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    if (target === 1) {
      setWizardStep(1);
    } else if (target === 2) {
      if (!rows.length) {
        setRequestFormFeedback("Please select at least one medicine in Step 1 first.", "warning");
        return;
      }
      setWizardStep(2);
    } else if (target === 3) {
      if (!rows.length) {
        setRequestFormFeedback("Please select medicines before proceeding to Step 3.", "warning");
        return;
      }
      const collected = collectRequestItems();
      if (collected.error) {
        setRequestFormFeedback("Please complete the medicine quantities in Step 2 first.", "warning");
        setWizardStep(2);
        collected.focusEl?.focus();
        return;
      }
      setWizardStep(3);
    }
  });

  refs.requestChipsContainer?.addEventListener("click", (event) => {
    const removeBtn = event.target.closest(".request-chip__remove[data-medicine-id]");
    if (!removeBtn || uiState.requestModalMode === "view") return;
    removeMedicineFromRequest(removeBtn.getAttribute("data-medicine-id"));
  });

  refs.requestWizardPrevBtn?.addEventListener("click", () => {
    if (uiState.wizardStep === 1) {
      requestModal?.hide();
    } else {
      setWizardStep(uiState.wizardStep - 1);
    }
  });

  refs.requestWizardNextBtn?.addEventListener("click", () => {
    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    if (uiState.wizardStep === 1) {
      if (!rows.length) {
        setRequestFormFeedback("Please select at least one medicine before proceeding.", "warning");
        refs.requestMedicineSearch?.focus({ preventScroll: true });
        return;
      }
      setWizardStep(2);
    } else if (uiState.wizardStep === 2) {
      const collected = collectRequestItems();
      if (collected.error) {
        setRequestFormFeedback(collected.error, "warning");
        collected.focusEl?.focus({ preventScroll: true });
        return;
      }
      setWizardStep(3);
    }
  });

  refs.requestDate?.addEventListener("change", () => {
    if (uiState.wizardStep === 3) renderRequestReviewSummary();
  });
  refs.requestExpectedDate?.addEventListener("change", () => {
    if (uiState.wizardStep === 3) renderRequestReviewSummary();
  });

  refs.requestForm?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target.matches("input:not([type=submit])")) {
      if (uiState.wizardStep < 3) {
        event.preventDefault();
      }
    }
  });

  refs.requestSearch?.addEventListener("input", (event) => {
    uiState.search = text(event.target.value);
    renderTable();
  });

  refs.requestSearchBtn?.addEventListener("click", () => {
    uiState.search = text(refs.requestSearch?.value);
    renderTable();
  });

  refs.requestStatusFilter?.addEventListener("change", (event) => {
    uiState.status = text(event.target.value) || "all";
    renderTable();
  });

  document.addEventListener("click", (event) => {
    if (refs.requestMedicinePicker && !refs.requestMedicinePicker.contains(event.target)) {
      closeMedicineResults();
    }

    const toggleButton = event.target.closest("[data-request-menu-toggle][data-id]");
    if (toggleButton) {
      const requestGroupId = text(toggleButton.getAttribute("data-id"));
      const requestGroup = findRequestGroup(requestGroupId);
      if (!requestGroup) {
        closeActionMenu();
        return;
      }

      openActionMenu(toggleButton, requestGroup);
      return;
    }

    const actionButton = event.target.closest(".request-action-item[data-action][data-id]");
    if (actionButton && activeActionMenu?.menu?.contains(actionButton)) {
      closeActionMenu();

      const requestGroupId = text(actionButton.getAttribute("data-id"));
      const action = text(actionButton.getAttribute("data-action"));
      const requestGroup = findRequestGroup(requestGroupId);
      if (!requestGroup) return;

      if (action === "delete") {
        handleDeleteRequest(requestGroupId);
        return;
      }

      if (action === "print-slip") {
        void generateRequestSlipPdf(requestGroup);
        return;
      }

      if (action === "view") {
        openRequestModal(requestGroup, "view");
        return;
      }

      openRequestModal(requestGroup, "edit");
      return;
    }

    if (activeActionMenu && !activeActionMenu.menu?.contains(event.target)) {
      closeActionMenu();
    }
  });

  window.addEventListener("resize", closeActionMenu);
  window.addEventListener("scroll", closeActionMenu, true);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeActionMenu();
  });

  window.addEventListener("mss:supply-state-updated", () => {
    loadState();
    renderAll();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    void hydrateRequestState().then(renderAll).catch(() => {});
  });

  byId("requestDeleteModal")?.addEventListener("hidden.bs.modal", () => {
    uiState.pendingDeleteGroupId = "";
  });
  byId("requestModal")?.addEventListener("hidden.bs.modal", () => {
    closeMedicineResults();
    setRequestFormFeedback();
  });
  byId("requestModal")?.addEventListener("shown.bs.modal", () => {
    const modalBody = byId("requestModal")?.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
    if (uiState.requestModalMode !== "view") {
      refs.requestMedicineSearch?.focus({ preventScroll: true });
    }
  });

  const initializeRequestLog = async () => {
    await hydrateRequestState();
    renderAll();
  };

  void initializeRequestLog();
})();
