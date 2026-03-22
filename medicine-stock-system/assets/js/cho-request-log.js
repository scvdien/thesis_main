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
    requestDetailCode: byId("requestDetailCode"),
    requestDetailRequestDate: byId("requestDetailRequestDate"),
    requestDetailExpectedDate: byId("requestDetailExpectedDate"),
    requestDetailStatus: byId("requestDetailStatus"),
    requestDetailTableBody: byId("requestDetailTableBody"),
    requestDeleteMessage: byId("requestDeleteMessage"),
    confirmDeleteRequestBtn: byId("confirmDeleteRequestBtn"),
    requestItemsContainer: byId("requestItemsContainer"),
    addRequestItemBtn: byId("addRequestItemBtn"),
    requestDate: byId("requestDate"),
    requestExpectedDate: byId("requestExpectedDate")
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
    pendingDeleteGroupId: ""
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

  const requestGroups = () => supplyMonitoring.hydrateRequestGroups(state.requests, state.movements);

  const findInventoryMedicine = (medicineId) => state.inventory.find((entry) => text(entry.id) === text(medicineId)) || null;

  const findRequestGroup = (groupId) => requestGroups().find((row) => text(row.requestGroupId) === text(groupId)) || null;

  const requestItemOptions = (selectedId = "") => [
    '<option value="">Select medicine</option>',
    ...(() => {
      const medicines = activeInventoryMedicines().slice();
      const selectedMedicine = findInventoryMedicine(selectedId);
      if (selectedMedicine && !medicines.some((medicine) => text(medicine.id) === text(selectedMedicine.id))) {
        medicines.push(selectedMedicine);
      }
      return medicines;
    })()
      .sort((left, right) => medicineLabel(left).localeCompare(medicineLabel(right)))
      .map((medicine) => `<option value="${esc(medicine.id)}" ${text(selectedId) === text(medicine.id) ? "selected" : ""}>${esc(medicineLabel(medicine))}</option>`)
  ].join("");

  const requestItemMetaText = (medicineId = "") => {
    const medicine = findInventoryMedicine(medicineId);
    if (!medicine) return "";
    const meta = [text(medicine.genericName), text(medicine.unit)];
    return meta.filter(Boolean).join(" | ") || "Inventory-linked medicine";
  };

  const summarizeItemQuantities = (items = [], key = "quantityRequested") => {
    const parts = items
      .slice(0, 2)
      .map((item) => `${formatNumber(item[key])} ${item.unit}`)
      .filter(Boolean);
    if (!parts.length) return "-";
    return `${parts.join(" | ")}${items.length > 2 ? ` +${items.length - 2} more` : ""}`;
  };

  const createRequestItemRowMarkup = (item = {}, readOnly = false) => `
    <div class="request-item-row" data-request-item-id="${esc(item.id || "")}">
      <div class="request-item-control request-item-control--medicine" data-label="Medicine">
        <select class="form-select request-item-medicine" ${readOnly ? "disabled" : ""} aria-label="Select medicine" required>
          ${requestItemOptions(item.medicineId)}
        </select>
        <small class="request-item-meta">${esc(requestItemMetaText(item.medicineId))}</small>
      </div>
      <div class="request-item-control request-item-control--qty" data-label="Quantity">
        <input
          type="number"
          min="1"
          step="1"
          class="form-control request-item-quantity"
          placeholder="Enter quantity"
          value="${item.quantityRequested ? esc(String(item.quantityRequested)) : ""}"
          ${readOnly ? "disabled" : ""}
          aria-label="Quantity requested"
          required
        >
      </div>
      <div class="request-item-control request-item-control--remove" data-label="Action">
        <button type="button" class="btn btn-light request-item-remove" ${readOnly ? "disabled" : ""} aria-label="Remove medicine line" title="Remove medicine line">
          <i class="bi bi-trash3"></i>
          <span class="visually-hidden">Remove</span>
        </button>
      </div>
    </div>
  `;

  const renderRequestItems = (items = [], readOnly = false) => {
    if (!refs.requestItemsContainer) return;
    const safeItems = items.length ? items : [{}];
    refs.requestItemsContainer.innerHTML = safeItems
      .map((item) => createRequestItemRowMarkup(item, readOnly))
      .join("");

    const removeButtons = refs.requestItemsContainer.querySelectorAll(".request-item-remove");
    removeButtons.forEach((button) => {
      button.disabled = readOnly || removeButtons.length === 1;
    });
  };

  const appendRequestItemRow = (item = {}) => {
    if (!refs.requestItemsContainer) return;
    refs.requestItemsContainer.insertAdjacentHTML("beforeend", createRequestItemRowMarkup(item, false));
    const removeButtons = refs.requestItemsContainer.querySelectorAll(".request-item-remove");
    removeButtons.forEach((button) => {
      button.disabled = removeButtons.length === 1;
    });
  };

  const updateRequestItemMeta = (rowEl) => {
    if (!rowEl) return;
    const medicineId = text(rowEl.querySelector(".request-item-medicine")?.value);
    const metaEl = rowEl.querySelector(".request-item-meta");
    if (metaEl) metaEl.textContent = requestItemMetaText(medicineId);
  };

  const collectRequestItems = () => {
    const rows = Array.from(refs.requestItemsContainer?.querySelectorAll(".request-item-row") || []);
    const seenMedicines = new Set();
    const items = [];

    for (const rowEl of rows) {
      const medicineId = text(rowEl.querySelector(".request-item-medicine")?.value);
      const quantityRequested = Math.max(0, Math.round(numeric(rowEl.querySelector(".request-item-quantity")?.value)));
      const medicine = findInventoryMedicine(medicineId);

      if (!medicine) {
        return { error: "Select all medicines in the request list before saving.", focusEl: rowEl.querySelector(".request-item-medicine") };
      }

      if (quantityRequested <= 0) {
        return { error: `Enter a valid quantity for ${medicineLabel(medicine)}.`, focusEl: rowEl.querySelector(".request-item-quantity") };
      }

      if (seenMedicines.has(medicineId)) {
        return { error: `${medicineLabel(medicine)} is already listed in this request.`, focusEl: rowEl.querySelector(".request-item-medicine") };
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
      `
    ];

    if (!requestGroup.hasDelivery) {
      menuItems.push(`
        <button type="button" class="request-action-item" data-action="edit" data-id="${esc(requestGroup.requestGroupId)}">
          <i class="bi bi-pencil-square"></i>
          <span>Edit</span>
        </button>
      `);
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
              ${row.items.map((item) => `
                <div class="request-medicine-line">
                  <strong>${esc(item.medicineName)}</strong>
                  <small>${esc(item.genericName || item.unit)}</small>
                </div>
              `).join("")}
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

    refs.addRequestItemBtn?.classList.toggle("d-none", readOnly);
    refs.requestSubmitBtn?.classList.toggle("d-none", readOnly);

    const rowFields = refs.requestItemsContainer?.querySelectorAll(".request-item-medicine, .request-item-quantity, .request-item-remove") || [];
    rowFields.forEach((field) => {
      field.disabled = readOnly || (field.classList.contains("request-item-remove") && refs.requestItemsContainer?.querySelectorAll(".request-item-row").length === 1);
    });
  };

  const openRequestModal = (requestGroup = null, mode = "edit") => {
    if (!refs.requestForm) return;
    closeActionMenu();
    uiState.requestModalMode = mode;
    refs.requestForm.reset();
    refs.requestId.value = requestGroup?.requestGroupId || "";
    setRequestModalLayout(mode);

    refs.requestModalTitle.textContent = !requestGroup
      ? "New CHO Request"
      : mode === "view"
        ? "CHO Request Details"
        : "Edit CHO Request";
    refs.requestModalSubtitle.textContent = !requestGroup
      ? "Create one CHO request with all required medicines."
      : mode === "view"
        ? "Review the request summary and listed medicines."
        : "Update the request before any delivery is linked.";

    if (mode === "view" && requestGroup) {
      renderRequestDetails(requestGroup);
    } else {
      refs.requestDate.value = requestGroup?.requestDate || supplyMonitoring.todayInputValue();
      refs.requestExpectedDate.value = requestGroup?.expectedDate || supplyMonitoring.addDays(refs.requestDate.value, 5);
      renderRequestItems(requestGroup?.items || [{}], false);
      setRequestFormReadOnly(false);
    }

    requestModal?.show();
  };

  const handleRequestSubmit = async (event) => {
    event.preventDefault();
    if (uiState.requestModalMode === "view") return;

    const requestDate = supplyMonitoring.normalizeInputDate(refs.requestDate?.value);
    const expectedDate = supplyMonitoring.normalizeInputDate(refs.requestExpectedDate?.value, supplyMonitoring.addDays(requestDate, 5));
    if (new Date(expectedDate).getTime() < new Date(requestDate).getTime()) {
      showNotice("Expected delivery date cannot be earlier than the request date.", "danger");
      refs.requestExpectedDate?.focus();
      return;
    }

    const collected = collectRequestItems();
    if (collected.error) {
      showNotice(collected.error, "danger");
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

    try {
      await persistRequestState();
    } catch (error) {
      restoreRequestStateSnapshot(snapshot);
      renderAll();
      showNotice(error.message || "Unable to save the CHO request right now.", "danger");
      return;
    }

    renderAll();
    requestModal?.hide();
  };

  const handleDeleteRequest = (requestGroupId) => {
    closeActionMenu();
    const row = findRequestGroup(requestGroupId);
    if (!row) return;

    if (row.hasDelivery) {
      showNotice("This request already has linked deliveries and cannot be deleted.", "danger");
      return;
    }

    uiState.pendingDeleteGroupId = requestGroupId;
    if (refs.requestDeleteMessage) {
      refs.requestDeleteMessage.textContent = `Delete ${row.requestCode || "this CHO request"} and all listed medicines?`;
    }
    requestDeleteModal?.show();
  };

  const confirmDeleteRequest = async () => {
    const requestGroupId = text(uiState.pendingDeleteGroupId);
    if (!requestGroupId) return;

    const snapshot = createRequestStateSnapshot();
    state.requests = state.requests.filter((entry) => {
      const normalized = supplyMonitoring.normalizeRequest(entry);
      return text(normalized.requestGroupId) !== text(requestGroupId);
    });

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
    if (!state.inventory.length) {
      showNotice("Create medicine inventory records first before logging a CHO request.", "danger");
      return;
    }
    openRequestModal(null, "create");
  });

  refs.addRequestItemBtn?.addEventListener("click", () => appendRequestItemRow({}));
  refs.confirmDeleteRequestBtn?.addEventListener("click", () => {
    void confirmDeleteRequest();
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
  });

  refs.requestItemsContainer?.addEventListener("click", (event) => {
    const removeButton = event.target.closest(".request-item-remove");
    if (!removeButton || uiState.requestModalMode === "view") return;

    const rows = refs.requestItemsContainer.querySelectorAll(".request-item-row");
    if (rows.length <= 1) return;

    removeButton.closest(".request-item-row")?.remove();
    const remainingButtons = refs.requestItemsContainer.querySelectorAll(".request-item-remove");
    remainingButtons.forEach((button) => {
      button.disabled = remainingButtons.length === 1;
    });
  });

  refs.requestItemsContainer?.addEventListener("change", (event) => {
    const row = event.target.closest(".request-item-row");
    if (!row) return;
    updateRequestItemMeta(row);
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

  const initializeRequestLog = async () => {
    await hydrateRequestState();
    renderAll();
  };

  void initializeRequestLog();
})();
