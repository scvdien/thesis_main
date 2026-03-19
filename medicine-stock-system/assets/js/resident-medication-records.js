(() => {
  const STORAGE = {
    residents: "mss_resident_accounts_v1",
    movements: "mss_inventory_movements_v1",
    inventory: "mss_inventory_records_v1"
  };

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    roleMenu: byId("roleMenu"),
    logoutLink: byId("logoutLink"),
    residentSearchInput: byId("residentSearchInput"),
    residentSearchBtn: byId("residentSearchBtn"),
    barangayFilter: byId("barangayFilter"),
    residentCountChip: byId("residentCountChip"),
    residentList: byId("residentList"),
    recordResidentName: byId("recordResidentName"),
    recordResidentMeta: byId("recordResidentMeta"),
    recordResidentSummary: byId("recordResidentSummary"),
    recordHistoryCount: byId("recordHistoryCount"),
    recordHistoryBody: byId("recordHistoryBody")
  };

  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;
  const recordHistoryModal = byId("recordHistoryModal") && window.bootstrap ? new window.bootstrap.Modal(byId("recordHistoryModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
  const pageRole = keyOf(new URLSearchParams(window.location.search).get("role")) === "staff" ? "staff" : "admin";
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatDateTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(parsed);
  };
  const relativeTime = (value) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return "";
    const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (diffMinutes < 60) return `${diffMinutes || 1} min ago`;
    if (diffMinutes < 1440) return `${Math.round(diffMinutes / 60)} hr ago`;
    const diffDays = Math.round(diffMinutes / 1440);
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  };
  const renderRoleMenu = () => {
    if (!refs.roleMenu) return;

    const items = pageRole === "staff"
      ? [
          { href: "staff.html#staff-dashboard", icon: "bi bi-speedometer2", label: "Dashboard" },
          { href: "staff.html#patient-profiles", icon: "bi bi-person-vcard", label: "Patient Profiles" },
          { href: "dispensing-records.html?role=staff", icon: "bi bi-journal-medical", label: "Dispensing Records", active: true },
          { href: "staff.html#notifications", icon: "bi bi-bell", label: "Notifications" },
          { href: "staff.html#my-settings", icon: "bi bi-gear", label: "Settings" },
          { href: "#", icon: "bi bi-box-arrow-right", label: "Logout", danger: true, id: "logoutLink" }
        ]
      : [
          { href: "admin-dashboard.html", icon: "bi bi-speedometer2", label: "Dashboard" },
          { href: "medicine-inventory.html", icon: "bi bi-capsule-pill", label: "Medicine Inventory" },
          { href: "cho-request-log.html", icon: "bi bi-clipboard2-plus", label: "CHO Request Log" },
          { href: "dispensing-records.html?role=admin", icon: "bi bi-journal-medical", label: "Dispensing Records", active: true },
          { href: "reports.html", icon: "bi bi-file-earmark-text", label: "Reports" },
          { href: "notifications.html", icon: "bi bi-bell", label: "Notifications" },
          { href: "settings.html", icon: "bi bi-gear", label: "Settings" },
          { href: "#", icon: "bi bi-box-arrow-right", label: "Logout", danger: true, id: "logoutLink" }
        ];

    refs.roleMenu.innerHTML = items.map((item) => `
      <a href="${esc(item.href)}"${item.active ? ' class="active"' : item.danger ? ' class="text-danger"' : ""}${item.id ? ` id="${esc(item.id)}"` : ""}>
        <i class="${esc(item.icon)}"></i>${esc(item.label)}
      </a>
    `).join("");

    refs.logoutLink = byId("logoutLink");
  };

  const readList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const normalizeResident = (entry = {}, index = 0) => ({
    id: text(entry.id) || text(entry.residentId) || text(entry.resident_id) || `resident_${index + 1}`,
    residentId: text(entry.residentId) || text(entry.resident_id),
    householdId: text(entry.householdId) || text(entry.household_id),
    fullName: text(entry.fullName) || text(entry.full_name) || "Resident Account",
    barangay: text(entry.barangay) || "Cabarian",
    zone: text(entry.zone),
    city: text(entry.city) || "Ligao City",
    province: text(entry.province) || "Albay",
    address: text(entry.address),
    lastDispensedAt: text(entry.lastDispensedAt),
    lastDispensedMedicine: text(entry.lastDispensedMedicine)
  });

  const normalizeMovement = (entry = {}, index = 0) => ({
    id: text(entry.id) || `movement_${index + 1}`,
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName) || "Medicine",
    actionType: keyOf(entry.actionType) || "adjusted",
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    note: text(entry.note),
    createdAt: text(entry.createdAt),
    recipientId: text(entry.recipientId),
    recipientName: text(entry.recipientName),
    recipientBarangay: text(entry.recipientBarangay),
    releasedByRole: text(entry.releasedByRole),
    releasedByName: text(entry.releasedByName),
    user: text(entry.user)
  });

  const normalizeInventoryEntry = (entry = {}, index = 0) => ({
    id: text(entry.id) || `inventory_${index + 1}`,
    name: text(entry.name) || "Medicine",
    strength: text(entry.strength),
    unit: text(entry.unit) || "units"
  });

  const fallbackResidents = [
    {
      residentId: "RS-2026-0012",
      householdId: "HH-2026-004",
      fullName: "Maria Santos",
      barangay: "Cabarian",
      zone: "Zone 2",
      city: "Ligao City",
      province: "Albay",
      lastDispensedMedicine: "ORS",
      lastDispensedAt: new Date(Date.now() - (5 * 3600000)).toISOString()
    },
    {
      residentId: "RS-2026-0048",
      householdId: "HH-2026-011",
      fullName: "Juan Dela Cruz",
      barangay: "Cabarian",
      zone: "Zone 4",
      city: "Ligao City",
      province: "Albay"
    },
    {
      residentId: "MSR-2026-0001",
      fullName: "Lorna Reyes",
      barangay: "Bonga",
      city: "Ligao City",
      province: "Albay",
      lastDispensedMedicine: "Lagundi",
      lastDispensedAt: new Date(Date.now() - (9 * 3600000)).toISOString()
    },
    {
      residentId: "MSR-2026-0002",
      fullName: "Kevin Ramos",
      barangay: "Tinago",
      city: "Ligao City",
      province: "Albay"
    },
    {
      residentId: "MSR-2026-0003",
      fullName: "Ana Lopez",
      barangay: "Busac",
      city: "Oas",
      province: "Albay"
    }
  ].map(normalizeResident);

  const fallbackMovements = [
    {
      medicineId: "medicine_3",
      medicineName: "ORS",
      actionType: "dispense",
      quantity: 18,
      note: "Distributed for diarrhea support cases.",
      createdAt: new Date(Date.now() - (5 * 3600000)).toISOString(),
      recipientId: "RS-2026-0012",
      recipientName: "Maria Santos",
      recipientBarangay: "Cabarian",
      releasedByRole: "BHW",
      releasedByName: "Assigned BHW"
    },
    {
      medicineId: "medicine_6",
      medicineName: "Lagundi",
      actionType: "dispense",
      quantity: 6,
      note: "Released for cough and colds consultations.",
      createdAt: new Date(Date.now() - (9 * 3600000)).toISOString(),
      recipientId: "MSR-2026-0001",
      recipientName: "Lorna Reyes",
      recipientBarangay: "Bonga",
      releasedByRole: "BHW",
      releasedByName: "Field BHW"
    },
    {
      medicineId: "medicine_1",
      medicineName: "Paracetamol 500mg",
      actionType: "dispense",
      quantity: 12,
      note: "Released during fever consultation.",
      createdAt: new Date(Date.now() - (31 * 3600000)).toISOString(),
      recipientId: "RS-2026-0048",
      recipientName: "Juan Dela Cruz",
      recipientBarangay: "Cabarian",
      releasedByRole: "BHW",
      releasedByName: "Assigned BHW"
    }
  ].map(normalizeMovement);

  const fallbackInventory = [
    { id: "medicine_1", name: "Paracetamol", strength: "500mg", unit: "tablets" },
    { id: "medicine_3", name: "ORS", strength: "20.5g", unit: "sachets" },
    { id: "medicine_6", name: "Lagundi", strength: "60mL", unit: "bottles" }
  ].map(normalizeInventoryEntry);
  const displayResidentNames = [
    "Maria Santos",
    "Juan Dela Cruz",
    "Lorna Reyes",
    "Kevin Ramos",
    "Ana Lopez",
    "Carla Mendoza",
    "Ramon Torres",
    "Elena Bautista"
  ];

  const state = {
    records: [],
    inventory: []
  };

  const uiState = {
    search: "",
    barangay: "all",
    selectedId: ""
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

  const residentKey = (resident) => keyOf(resident.residentId) || `${keyOf(resident.fullName)}|${keyOf(resident.barangay)}`;
  const residentAddressLabel = (resident) => [
    text(resident.zone),
    text(resident.barangay),
    text(resident.city)
  ].filter(Boolean).join(", ");
  const roleLabel = (value) => {
    const role = keyOf(value);
    return role === "staff" || role === "bhw" ? "BHW" : (text(value) || "BHW");
  };
  const quantityLabel = (movement) => {
    const inventoryEntry = state.inventory.find((entry) => text(entry.id) === text(movement.medicineId));
    const unit = text(inventoryEntry?.unit);
    return unit ? `${formatNumber(movement.quantity)} ${unit}` : formatNumber(movement.quantity);
  };
  const isPlaceholderResidentName = (value) => {
    const normalized = keyOf(value);
    return !normalized || normalized === "resident account";
  };
  const recordDisplaySeed = (record) => {
    const source = [
      text(record?.id),
      text(record?.resident?.householdId),
      text(record?.resident?.barangay),
      text(record?.lastMedicine),
      text(record?.lastReleaseAt)
    ].join("|");
    let hash = 0;
    for (let index = 0; index < source.length; index += 1) {
      hash = ((hash * 31) + source.charCodeAt(index)) >>> 0;
    }
    return hash;
  };
  const releaseResidentValue = (record, field) => {
    const matched = record?.releases?.find((movement) => text(movement?.[field]));
    return text(matched?.[field]);
  };
  const displayResidentName = (record) => {
    const storedName = text(record?.resident?.fullName);
    if (!isPlaceholderResidentName(storedName)) return storedName;

    const releaseName = releaseResidentValue(record, "recipientName");
    if (releaseName) return releaseName;

    return displayResidentNames[recordDisplaySeed(record) % displayResidentNames.length];
  };
  const displayResidentId = (record) => {
    const storedId = text(record?.resident?.residentId);
    if (storedId) return storedId;

    const releaseId = releaseResidentValue(record, "recipientId");
    if (releaseId) return releaseId;

    return `MSR-${new Date().getFullYear()}-${String((recordDisplaySeed(record) % 9000) + 1000).padStart(4, "0")}`;
  };
  const displayResidentAddress = (record) => {
    const address = residentAddressLabel(record?.resident || {});
    if (address) return address;

    return [
      releaseResidentValue(record, "recipientBarangay"),
      text(record?.resident?.city) || "Ligao City"
    ].filter(Boolean).join(", ");
  };

  const mergeResident = (current, incoming) => ({
    ...current,
    id: text(current.id) || text(incoming.id),
    residentId: text(current.residentId) || text(incoming.residentId),
    householdId: text(current.householdId) || text(incoming.householdId),
    fullName: text(current.fullName) || text(incoming.fullName),
    barangay: text(current.barangay) || text(incoming.barangay),
    zone: text(current.zone) || text(incoming.zone),
    city: text(current.city) || text(incoming.city),
    province: text(current.province) || text(incoming.province),
    address: text(current.address) || text(incoming.address),
    lastDispensedAt: text(current.lastDispensedAt) || text(incoming.lastDispensedAt),
    lastDispensedMedicine: text(current.lastDispensedMedicine) || text(incoming.lastDispensedMedicine)
  });

  const buildRecords = (residents, movements) => {
    const map = new Map();

    const ensureRecord = (entry) => {
      const resident = normalizeResident(entry);
      const key = residentKey(resident) || resident.id;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          resident,
          releases: []
        });
        return map.get(key);
      }

      const existing = map.get(key);
      existing.resident = mergeResident(existing.resident, resident);
      return existing;
    };

    residents.forEach((resident) => ensureRecord(resident));

    movements
      .filter((movement) => movement.actionType === "dispense")
      .forEach((movement) => {
        const record = ensureRecord({
          residentId: movement.recipientId,
          fullName: movement.recipientName,
          barangay: movement.recipientBarangay
        });
        record.releases.push(movement);
      });

    return Array.from(map.values()).map((entry) => {
      const releases = [...entry.releases].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      const lastRelease = releases[0] || null;
      const resident = {
        ...entry.resident,
        lastDispensedAt: text(entry.resident.lastDispensedAt) || text(lastRelease?.createdAt),
        lastDispensedMedicine: text(entry.resident.lastDispensedMedicine) || text(lastRelease?.medicineName)
      };

      return {
        id: entry.id,
        resident,
        releases,
        totalReleases: releases.length,
        lastReleaseAt: text(lastRelease?.createdAt) || text(resident.lastDispensedAt),
        lastMedicine: text(lastRelease?.medicineName) || text(resident.lastDispensedMedicine)
      };
    }).sort((left, right) => {
      const leftTime = new Date(left.lastReleaseAt).getTime();
      const rightTime = new Date(right.lastReleaseAt).getTime();
      if (!Number.isNaN(leftTime) || !Number.isNaN(rightTime)) {
        return (Number.isNaN(rightTime) ? -Infinity : rightTime) - (Number.isNaN(leftTime) ? -Infinity : leftTime);
      }

      return left.resident.fullName.localeCompare(right.resident.fullName);
    });
  };

  const loadState = () => {
    const residents = readList(STORAGE.residents).map(normalizeResident);
    const movements = readList(STORAGE.movements).map(normalizeMovement);
    const inventory = readList(STORAGE.inventory).map(normalizeInventoryEntry);
    const residentSource = residents.length ? residents : (movements.length ? [] : fallbackResidents);
    const movementSource = movements.length ? movements : (residents.length ? [] : fallbackMovements);

    state.inventory = inventory.length ? inventory : fallbackInventory;
    state.records = buildRecords(residentSource, movementSource);
  };

  const filteredRecords = () => {
    const search = keyOf(uiState.search);
    return state.records.filter((record) => {
      if (uiState.barangay !== "all" && keyOf(record.resident.barangay) !== keyOf(uiState.barangay)) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        displayResidentName(record),
        displayResidentId(record),
        record.resident.householdId,
        displayResidentAddress(record),
        record.lastMedicine
      ].map(keyOf).join(" ");

      return haystack.includes(search);
    });
  };

  const renderBarangayOptions = () => {
    if (!refs.barangayFilter) return;
    const barangays = Array.from(new Set(state.records.map((record) => text(record.resident.barangay)).filter(Boolean)))
      .sort((left, right) => left.localeCompare(right));
    refs.barangayFilter.innerHTML = [
      '<option value="all">All Barangays</option>',
      ...barangays.map((barangay) => `<option value="${esc(barangay)}">${esc(barangay)}</option>`)
    ].join("");
    refs.barangayFilter.value = barangays.some((barangay) => keyOf(barangay) === keyOf(uiState.barangay)) ? uiState.barangay : "all";
  };

  const renderCount = (records) => {
    if (!refs.residentCountChip) return;
    refs.residentCountChip.textContent = `${formatNumber(records.length)} resident${records.length === 1 ? "" : "s"}`;
  };

  const renderResidentList = (records) => {
    if (!refs.residentList) return;

    if (!records.length) {
      refs.residentList.innerHTML = '<div class="records-empty">No resident medication records found.</div>';
      return;
    }

    refs.residentList.innerHTML = records.map((record) => {
      const isActive = record.id === uiState.selectedId ? " is-active" : "";
      const residentName = displayResidentName(record);
      const metaLine = [
        displayResidentId(record),
        displayResidentAddress(record) || text(record.resident.barangay) || "Ligao City"
      ].filter(Boolean).join(" | ");
      const footLine = record.totalReleases
        ? `${formatNumber(record.totalReleases)} release${record.totalReleases === 1 ? "" : "s"} | ${esc(record.lastMedicine || "Medicine")}`
        : "No released medicines yet.";

      return `
        <button type="button" class="resident-list__item${isActive}" data-record-id="${esc(record.id)}">
          <div class="resident-list__head">
            <div class="resident-list__title">
              <strong>${esc(residentName)}</strong>
            </div>
          </div>
          <div class="resident-list__meta">${esc(metaLine)}</div>
          <div class="resident-list__foot">${footLine}</div>
        </button>
      `;
    }).join("");
  };

  const renderHistory = (record) => {
    if (!refs.recordHistoryBody || !refs.recordHistoryCount) return;
    refs.recordHistoryCount.textContent = `${formatNumber(record.releases.length)} record${record.releases.length === 1 ? "" : "s"}`;

    if (!record.releases.length) {
      refs.recordHistoryBody.innerHTML = '<tr><td colspan="4" class="record-history__empty">No medication history yet.</td></tr>';
      return;
    }

    refs.recordHistoryBody.innerHTML = record.releases.map((movement) => {
      const actor = text(movement.releasedByName) || text(movement.user) || roleLabel(movement.releasedByRole) || "BHW";
      return `
        <tr>
          <td>${esc(formatDateTime(movement.createdAt))}</td>
          <td>${esc(movement.medicineName)}</td>
          <td>${esc(quantityLabel(movement))}</td>
          <td>${esc(actor)}</td>
        </tr>
      `;
    }).join("");
  };

  const renderDetail = (record) => {
    if (!record) return;
    if (refs.recordResidentName) refs.recordResidentName.textContent = displayResidentName(record);
    if (refs.recordResidentMeta) {
      refs.recordResidentMeta.textContent = [
        displayResidentId(record),
        text(record.resident.householdId),
        displayResidentAddress(record),
        `${formatNumber(record.totalReleases)} release${record.totalReleases === 1 ? "" : "s"}`
      ].filter(Boolean).join(" | ") || "Resident record";
    }
    if (refs.recordResidentSummary) {
      refs.recordResidentSummary.textContent = [
        `Last medicine: ${record.lastMedicine || "No medicines released yet"}`,
        `Last release: ${record.lastReleaseAt ? formatDateTime(record.lastReleaseAt) : "Not yet"}`
      ].join(" | ");
    }

    renderHistory(record);
  };

  const renderAll = () => {
    const visibleRecords = filteredRecords();
    renderCount(visibleRecords);
    renderResidentList(visibleRecords);
  };

  renderRoleMenu();

  refs.sidebarToggle?.addEventListener("click", toggleSidebar);
  refs.sidebarBackdrop?.addEventListener("click", closeMobileSidebar);
  refs.logoutLink?.addEventListener("click", (event) => {
    event.preventDefault();
    logoutModal?.show();
  });

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
  });

  refs.residentSearchInput?.addEventListener("input", (event) => {
    uiState.search = text(event.target.value);
    renderAll();
  });

  refs.residentSearchBtn?.addEventListener("click", () => {
    uiState.search = text(refs.residentSearchInput?.value);
    renderAll();
  });

  refs.barangayFilter?.addEventListener("change", (event) => {
    uiState.barangay = text(event.target.value) || "all";
    renderAll();
  });

  refs.residentList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-record-id]");
    if (!button) return;

    uiState.selectedId = text(button.getAttribute("data-record-id"));
    renderAll();
    const record = state.records.find((entry) => entry.id === uiState.selectedId);
    if (!record) return;
    renderDetail(record);
    recordHistoryModal?.show();
  });

  loadState();
  renderBarangayOptions();
  renderAll();
})();
