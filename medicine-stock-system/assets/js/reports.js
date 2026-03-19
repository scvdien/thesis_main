(() => {
  const REPORT_HISTORY_STORAGE_KEY = "mss_report_history_v1";
  const INVENTORY_STORAGE = "mss_inventory_records_v1";
  const MOVEMENTS_STORAGE = "mss_inventory_movements_v1";
  const ACTIVITY_LOG_STORAGE = "mss_activity_logs_v1";
  const USERS_STORAGE = "mss_users_v1";
  const SESSIONS_STORAGE = "mss_active_sessions_v1";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    reportNoticePopup: byId("reportNoticePopup"),
    reportNoticeIcon: byId("reportNoticeIcon"),
    reportNoticeText: byId("reportNoticeText"),
    reportTypeSelect: byId("reportTypeSelect"),
    generateReportBtn: byId("generateReportBtn"),
    reportHistoryToggleBtn: byId("reportHistoryToggleBtn"),
    reportHistoryToggleIcon: byId("reportHistoryToggleIcon"),
    reportHistoryToggleLabel: byId("reportHistoryToggleLabel"),
    reportsCount: byId("reportsCount"),
    reportTableView: byId("reportTableView"),
    reportTableHeadRow: byId("reportTableHeadRow"),
    reportTableBody: byId("reportTableBody"),
    reportHistoryCount: byId("reportHistoryCount"),
    reportHistoryView: byId("reportHistoryView"),
    reportHistoryTableBody: byId("reportHistoryTableBody"),
    generateExcelBtn: byId("generateExcelBtn"),
    generatePdfBtn: byId("generatePdfBtn"),
    reportActionModalIconWrap: byId("reportActionModalIconWrap"),
    reportActionModalIcon: byId("reportActionModalIcon"),
    reportActionModalTitle: byId("reportActionModalTitle"),
    reportActionModalText: byId("reportActionModalText"),
    reportActionConfirmBtn: byId("reportActionConfirmBtn")
  };

  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;
  const reportFormatModal = byId("reportFormatModal") && window.bootstrap ? new window.bootstrap.Modal(byId("reportFormatModal")) : null;
  const reportActionModal = byId("reportActionModal") && window.bootstrap ? new window.bootstrap.Modal(byId("reportActionModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    inventory: [],
    movements: [],
    reportHistory: []
  };

  const uiState = {
    reportKey: "available-medicines",
    workspaceView: "report"
  };

  const actionConfirmState = {
    handler: null
  };

  let alertTimer = 0;

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
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
  const titleCase = (value) => text(value)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const pluralize = (count, singular, plural = `${singular}s`) => `${formatNumber(count)} ${count === 1 ? singular : plural}`;
  const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }).format(parsed);
  };
  const formatTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(parsed);
  };
  const formatDateTime = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not yet";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(parsed);
  };
  const daysUntil = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / 86400000);
  };
  const shiftDays = (days) => new Date(Date.now() + (days * 86400000)).toISOString().slice(0, 10);

  const showNotice = (message, type = "success") => {
    if (!refs.reportNoticePopup || !refs.reportNoticeText || !refs.reportNoticeIcon) return;
    const tone = ["success", "warning", "danger", "info"].includes(type) ? type : "success";
    const iconByTone = {
      success: "bi-check-circle-fill",
      warning: "bi-exclamation-triangle-fill",
      danger: "bi-x-circle-fill",
      info: "bi-info-circle-fill"
    };

    refs.reportNoticePopup.className = `report-notice-popup report-notice-popup--${tone}`;
    refs.reportNoticeText.textContent = message;
    refs.reportNoticeIcon.className = `bi ${iconByTone[tone]} report-notice-popup__icon`;
    window.clearTimeout(alertTimer);
    refs.reportNoticePopup.classList.remove("is-visible");
    window.requestAnimationFrame(() => refs.reportNoticePopup?.classList.add("is-visible"));
    alertTimer = window.setTimeout(() => refs.reportNoticePopup?.classList.remove("is-visible"), 2200);
  };

  const readStorageList = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
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

  const findAdminUser = () => {
    const users = readStorageList(USERS_STORAGE);
    return users.find((user) => keyOf(user.role) === "admin") || null;
  };

  const resolveSessionIp = (userId, fallbackIp = "192.168.10.15") => {
    if (!userId) return fallbackIp;
    const sessions = readStorageList(SESSIONS_STORAGE);
    const activeSession = sessions.find((session) => text(session.userId) === text(userId));
    return text(activeSession?.ipAddress) || fallbackIp;
  };

  const appendActivityLog = ({
    actor = "Nurse-in-Charge",
    username = "nurse.incharge",
    action = "Updated report",
    actionType = "updated",
    target = "",
    details = "",
    category = "Reports",
    resultLabel = "Success",
    resultTone = "success",
    createdAt = nowIso(),
    ipAddress = "192.168.10.15"
  }) => {
    const logs = readStorageList(ACTIVITY_LOG_STORAGE);
    logs.unshift({
      id: uid(),
      actor,
      username,
      action,
      actionType,
      target,
      details,
      category,
      resultLabel,
      resultTone,
      ipAddress,
      createdAt
    });
    logs.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    localStorage.setItem(ACTIVITY_LOG_STORAGE, JSON.stringify(logs.slice(0, 60)));
  };

  const currentAuditActor = () => {
    const adminUser = findAdminUser();
    return {
      actor: text(adminUser?.fullName) || "Nurse-in-Charge",
      username: text(adminUser?.username) || "nurse.incharge",
      ipAddress: resolveSessionIp(adminUser?.id, "192.168.10.15")
    };
  };

  const normalizeMedicineCategory = (value) => {
    const normalized = keyOf(value);
    if (!normalized) return "Others";
    if (["vitamin", "vitamins", "supplement", "supplements"].includes(normalized)) return "Vitamins";
    if (["antibiotic", "antibiotics"].includes(normalized)) return "Antibiotics";
    if (["fluid & electrolytes", "fluid and electrolytes", "hydration"].includes(normalized)) return "Hydration";
    if (["others", "other"].includes(normalized)) return "Others";
    return titleCase(normalized);
  };

  const normalizeDosageForm = (value) => {
    const normalized = keyOf(value);
    if (!normalized) return "Tablet";
    if (["tablet", "tablets"].includes(normalized)) return "Tablet";
    if (["capsule", "capsules"].includes(normalized)) return "Capsule";
    if (["syrup", "suspension"].includes(normalized)) return "Syrup";
    if (["injection", "injectable", "vial"].includes(normalized)) return "Injection";
    if (["sachet", "powder"].includes(normalized)) return "Sachet";
    if (["drops", "drop"].includes(normalized)) return "Drops";
    return titleCase(normalized);
  };

  const normalizeInventoryItem = (entry = {}) => {
    const parsedExpiry = new Date(text(entry.expiryDate));
    const safeExpiry = Number.isNaN(parsedExpiry.getTime())
      ? shiftDays(180)
      : parsedExpiry.toISOString().slice(0, 10);

    return {
      id: text(entry.id) || uid(),
      name: text(entry.name) || "Medicine",
      genericName: text(entry.genericName),
      strength: text(entry.strength),
      category: normalizeMedicineCategory(entry.category),
      form: normalizeDosageForm(entry.form),
      batchNumber: text(entry.batchNumber).toUpperCase() || "-",
      stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
      reorderLevel: Math.max(1, Math.round(numeric(entry.reorderLevel) || 1)),
      unit: text(entry.unit) || "units",
      expiryDate: safeExpiry,
      updatedBy: text(entry.updatedBy) || "Nurse-in-Charge",
      lastUpdatedAt: text(entry.lastUpdatedAt) || nowIso()
    };
  };

  const normalizeMovement = (entry = {}) => ({
    id: text(entry.id) || uid(),
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName),
    actionType: text(entry.actionType) || "adjusted",
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    note: text(entry.note) || "Inventory movement recorded.",
    stockBefore: Math.max(0, Math.round(numeric(entry.stockBefore))),
    stockAfter: Math.max(0, Math.round(numeric(entry.stockAfter))),
    createdAt: text(entry.createdAt) || nowIso(),
    user: text(entry.user) || "Nurse-in-Charge",
    recipientId: text(entry.recipientId),
    recipientName: text(entry.recipientName),
    recipientBarangay: text(entry.recipientBarangay),
    releasedByRole: text(entry.releasedByRole),
    releasedByName: text(entry.releasedByName)
  });

  const fallbackInventory = () => ([
    { name: "Paracetamol", genericName: "Acetaminophen", category: "Analgesic", form: "Tablet", strength: "500mg", stockOnHand: 540, reorderLevel: 220, unit: "tablets", batchNumber: "PCM-2026-041", expiryDate: "2026-09-14" },
    { name: "Amoxicillin", genericName: "Amoxicillin Trihydrate", category: "Antibiotics", form: "Capsule", strength: "500mg", stockOnHand: 95, reorderLevel: 160, unit: "capsules", batchNumber: "AMX-2026-013", expiryDate: "2026-05-22" },
    { name: "Cetirizine", genericName: "Cetirizine Hydrochloride", category: "Antihistamine", form: "Tablet", strength: "10mg", stockOnHand: 132, reorderLevel: 120, unit: "tablets", batchNumber: "CTZ-2026-020", expiryDate: "2026-08-09" },
    { name: "ORS", genericName: "Oral Rehydration Salts", category: "Hydration", form: "Sachet", strength: "20.5g", stockOnHand: 62, reorderLevel: 120, unit: "sachets", batchNumber: "ORS-2026-115", expiryDate: "2026-04-30" },
    { name: "Lagundi", genericName: "Vitex Negundo", category: "Herbal", form: "Syrup", strength: "60mL", stockOnHand: 28, reorderLevel: 40, unit: "bottles", batchNumber: "LGD-2026-018", expiryDate: "2026-04-16" },
    { name: "Zinc Sulfate", genericName: "Zinc Sulfate", category: "Vitamins", form: "Tablet", strength: "20mg", stockOnHand: 0, reorderLevel: 90, unit: "tablets", batchNumber: "ZNC-2026-006", expiryDate: "2026-07-20" },
    { name: "Metformin", genericName: "Metformin Hydrochloride", category: "Maintenance", form: "Tablet", strength: "500mg", stockOnHand: 186, reorderLevel: 140, unit: "tablets", batchNumber: "MTF-2026-044", expiryDate: "2026-11-03" },
    { name: "Salbutamol", genericName: "Salbutamol Sulfate", category: "Respiratory", form: "Tablet", strength: "2mg", stockOnHand: 74, reorderLevel: 110, unit: "tablets", batchNumber: "SLB-2026-017", expiryDate: "2026-06-18" },
    { name: "Amlodipine", genericName: "Amlodipine Besylate", category: "Maintenance", form: "Tablet", strength: "5mg", stockOnHand: 154, reorderLevel: 100, unit: "tablets", batchNumber: "AML-2026-008", expiryDate: "2026-10-01" }
  ]).map((entry, index) => normalizeInventoryItem({
    ...entry,
    lastUpdatedAt: new Date(Date.now() - ((index + 1) * 3600000)).toISOString()
  }));

  const fallbackMovements = (inventory) => {
    const findByName = (name) => inventory.find((medicine) => keyOf(medicine.name) === keyOf(name));

    return [
      { medicineName: "Paracetamol", actionType: "restock", quantity: 180, stockBefore: 360, stockAfter: 540, createdAt: new Date(Date.now() - (5 * 86400000)).toISOString(), note: "CHO allocation received for fever medicines.", user: "Nurse-in-Charge" },
      { medicineName: "Salbutamol", actionType: "restock", quantity: 40, stockBefore: 34, stockAfter: 74, createdAt: new Date(Date.now() - (4 * 86400000)).toISOString(), note: "Urgent CHO follow-up delivery for respiratory cases.", user: "Nurse-in-Charge" },
      { medicineName: "Amoxicillin", actionType: "dispense", quantity: 24, stockBefore: 119, stockAfter: 95, createdAt: new Date(Date.now() - (3 * 86400000)).toISOString(), note: "Released after consultation for suspected bacterial infection.", recipientId: "RS-2026-0048", recipientName: "Juan Dela Cruz", recipientBarangay: "Cabarian", releasedByRole: "BHW", releasedByName: "Aiza Mendoza", user: "Aiza Mendoza" },
      { medicineName: "ORS", actionType: "dispense", quantity: 18, stockBefore: 80, stockAfter: 62, createdAt: new Date(Date.now() - (2 * 86400000)).toISOString(), note: "Distributed for diarrhea support cases.", recipientId: "RS-2026-0012", recipientName: "Maria Santos", recipientBarangay: "Cabarian", releasedByRole: "Nurse", releasedByName: "Nurse-in-Charge", user: "Nurse-in-Charge" },
      { medicineName: "Amlodipine", actionType: "dispense", quantity: 12, stockBefore: 166, stockAfter: 154, createdAt: new Date(Date.now() - (36 * 3600000)).toISOString(), note: "Maintenance medicine released for follow-up blood pressure monitoring.", recipientId: "RS-2026-0091", recipientName: "Leonora Ramos", recipientBarangay: "Tinago", releasedByRole: "Nurse", releasedByName: "Nurse-in-Charge", user: "Nurse-in-Charge" },
      { medicineName: "Lagundi", actionType: "dispense", quantity: 6, stockBefore: 34, stockAfter: 28, createdAt: new Date(Date.now() - (24 * 3600000)).toISOString(), note: "Released for cough and colds consultations.", recipientId: "MSR-2026-0001", recipientName: "Lorna Reyes", recipientBarangay: "Cabarian", releasedByRole: "BHW", releasedByName: "Jessa Belleza", user: "Jessa Belleza" },
      { medicineName: "Zinc Sulfate", actionType: "dispose", quantity: 20, stockBefore: 20, stockAfter: 0, createdAt: new Date(Date.now() - (18 * 3600000)).toISOString(), note: "Expired batch removed from active shelf and transferred for quarantine.", user: "Nurse-in-Charge" }
    ].map((entry) => {
      const medicine = findByName(entry.medicineName);
      return normalizeMovement({ ...entry, medicineId: medicine?.id || "" });
    });
  };

  const loadInventory = () => {
    state.inventory = readStorageList(INVENTORY_STORAGE).map(normalizeInventoryItem);
    if (!state.inventory.length) state.inventory = fallbackInventory();
  };

  const loadMovements = () => {
    state.movements = readStorageList(MOVEMENTS_STORAGE).map(normalizeMovement);
    if (!state.movements.length) state.movements = fallbackMovements(state.inventory);
  };

  const medicineLabel = (medicine) => [text(medicine.name), text(medicine.strength)].filter(Boolean).join(" ");

  const findMedicineForMovement = (movement) => state.inventory.find((medicine) => (
    text(medicine.id) === text(movement.medicineId) || keyOf(medicine.name) === keyOf(movement.medicineName)
  )) || null;

  const inventoryStatus = (medicine) => {
    const stock = Math.max(0, numeric(medicine.stockOnHand));
    const requestAlertLevel = Math.max(1, numeric(medicine.reorderLevel));
    const expiryDays = daysUntil(medicine.expiryDate);

    if (stock <= 0) return { key: "out-of-stock", label: "Out of Stock", tone: "danger", note: "No stock on hand" };
    if (expiryDays < 0) return { key: "expired", label: "Expired", tone: "danger", note: `${Math.abs(expiryDays)} days overdue` };
    if (stock <= Math.max(5, Math.round(requestAlertLevel * 0.5))) return { key: "critical", label: "Critical", tone: "danger", note: "Below half of request alert level" };
    if (stock <= requestAlertLevel) return { key: "low-stock", label: "Low Stock", tone: "warning", note: "At or below request alert level" };
    if (expiryDays <= 60) return { key: "expiring-soon", label: "Expiring Soon", tone: "olive", note: `${expiryDays} days left` };
    return { key: "healthy", label: "Healthy", tone: "success", note: "Stock within target range" };
  };

  const estimateMonthlyUse = (medicine) => {
    const matchingDispenses = state.movements.filter((movement) => (
      keyOf(movement.actionType) === "dispense"
      && (text(movement.medicineId) === text(medicine.id) || keyOf(movement.medicineName) === keyOf(medicine.name))
    ));
    const dispensedQuantity = matchingDispenses.reduce((total, movement) => total + numeric(movement.quantity), 0);
    const fallbackUsage = Math.max(1, Math.round(numeric(medicine.reorderLevel) * 0.65));
    if (!dispensedQuantity) return fallbackUsage;
    return Math.max(dispensedQuantity, Math.round((dispensedQuantity + fallbackUsage) / 2));
  };

  const targetStockForRequest = (medicine, estimatedMonthlyUse) => Math.max(
    Math.round(numeric(medicine.reorderLevel) * 2),
    Math.round(estimatedMonthlyUse + numeric(medicine.reorderLevel))
  );

  const movementLabel = (actionType) => {
    const normalized = keyOf(actionType);
    if (normalized === "restock" || normalized === "receive") return "Received";
    if (normalized === "dispense" || normalized === "issue") return "Issued";
    if (normalized === "dispose") return "Removed";
    if (normalized === "adjust") return "Adjusted";
    return titleCase(normalized || "recorded");
  };

  const countLabelForReport = (definition, count) => pluralize(count, definition.recordSingular, definition.recordPlural);
  const reportDateStamp = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  };
  const reportFileStem = (definition, generatedAt = nowIso()) => `${definition.key}-report-${reportDateStamp(generatedAt)}`;
  const worksheetName = (definition) => text(definition.label).replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Medicine Report";
  const safeExport = (value) => text(value) || "-";
  const PDF_HEADER_LOGOS = [
    "assets/img/CityHealthOffice_LOGO.png",
    "assets/img/ligao-city-logo.png"
  ];
  const renderTextCell = (value) => esc(safeExport(value));
  const renderDetailCell = (primary, secondary = "", className = "report-stock-cell") => `
    <div class="${className}">
      <strong>${esc(safeExport(primary))}</strong>
      ${text(secondary) ? `<small>${esc(secondary)}</small>` : ""}
    </div>
  `;
  const renderStatusCell = (label, tone) => `<span class="report-row-status report-row-status--${esc(tone || "olive")}">${esc(safeExport(label))}</span>`;
  const textColumn = (label, key) => ({ label, render: (row) => renderTextCell(row[key]), export: (row) => safeExport(row[key]) });
  const detailColumn = (label, key, subKey, className = "report-stock-cell") => ({
    label,
    render: (row) => renderDetailCell(row[key], row[subKey], className),
    export: (row) => [safeExport(row[key]), text(row[subKey])].filter(Boolean).join(" | ")
  });
  const statusColumn = (label, key = "statusLabel", toneKey = "statusTone") => ({
    label,
    render: (row) => renderStatusCell(row[key], row[toneKey]),
    export: (row) => safeExport(row[key])
  });

  const buildChoRequestRows = () => state.inventory.map((medicine) => {
    const status = inventoryStatus(medicine);
    const monthlyUse = estimateMonthlyUse(medicine);
    const disposedQuantity = state.movements
      .filter((movement) => keyOf(movement.actionType) === "dispose")
      .filter((movement) => text(movement.medicineId) === text(medicine.id) || keyOf(movement.medicineName) === keyOf(medicine.name))
      .reduce((total, movement) => total + numeric(movement.quantity), 0);
    const pendingExpiredQuantity = daysUntil(medicine.expiryDate) < 0 ? numeric(medicine.stockOnHand) : 0;
    const damagedExpiredQuantity = disposedQuantity + pendingExpiredQuantity;
    const usableStock = Math.max(0, numeric(medicine.stockOnHand) - pendingExpiredQuantity);
    const stockRequired = targetStockForRequest(medicine, monthlyUse);
    const qtyToRequest = Math.max(stockRequired - usableStock, 0);
    return {
      medicine: medicineLabel(medicine),
      medicineSubtext: medicine.genericName || medicine.category,
      form: medicine.form,
      strength: medicine.strength || "-",
      unit: medicine.unit,
      stockOnHand: formatNumber(medicine.stockOnHand),
      stockOnHandSubtext: damagedExpiredQuantity > 0 ? `${formatNumber(usableStock)} usable ${medicine.unit}` : `${medicine.unit} available`,
      consumptionIssued: formatNumber(monthlyUse),
      consumptionIssuedSubtext: "recent or estimated use",
      damagedExpired: formatNumber(damagedExpiredQuantity),
      damagedExpiredSubtext: medicine.unit,
      stockRequired: formatNumber(stockRequired),
      stockRequiredSubtext: "target before next CHO cycle",
      qtyToRequest: `${formatNumber(qtyToRequest)} ${medicine.unit}`,
      statusKey: status.key,
      qtyRaw: qtyToRequest
    };
  }).filter((row) => row.qtyRaw > 0 && ["low-stock", "critical", "out-of-stock", "expired"].includes(row.statusKey)).sort((left, right) => right.qtyRaw - left.qtyRaw || left.medicine.localeCompare(right.medicine));

  const buildCurrentInventoryRows = () => state.inventory.slice().sort((left, right) => medicineLabel(left).localeCompare(medicineLabel(right))).map((medicine) => {
    const status = inventoryStatus(medicine);
    const expiryDays = daysUntil(medicine.expiryDate);
    return {
      medicine: medicineLabel(medicine),
      medicineSubtext: medicine.genericName || "No generic name",
      category: medicine.category,
      form: medicine.form,
      batch: medicine.batchNumber,
      stockOnHand: formatNumber(medicine.stockOnHand),
      stockOnHandSubtext: `${medicine.unit} on hand`,
      alertLevel: formatNumber(medicine.reorderLevel),
      alertLevelSubtext: `${medicine.unit} alert level`,
      expiryDate: formatDate(medicine.expiryDate),
      expiryDateSubtext: expiryDays < 0 ? `${Math.abs(expiryDays)} days overdue` : `${expiryDays} days left`,
      statusLabel: status.label,
      statusTone: status.tone
    };
  });

  const buildInventoryListRows = ({ filter, statusLabel, statusTone }) => state.inventory
    .filter((medicine) => filter(medicine, daysUntil(medicine.expiryDate)))
    .sort((left, right) => medicineLabel(left).localeCompare(medicineLabel(right)))
    .map((medicine) => {
      const expiryDays = daysUntil(medicine.expiryDate);
      const expirySubtext = expiryDays < 0
        ? `${Math.abs(expiryDays)} days overdue`
        : `${expiryDays} days left`;

      return {
        medicine: medicineLabel(medicine),
        medicineSubtext: medicine.genericName || "No generic name",
        category: medicine.category,
        form: medicine.form,
        batch: medicine.batchNumber,
        stockOnHand: formatNumber(medicine.stockOnHand),
        stockOnHandSubtext: `${medicine.unit} on hand`,
        expiryDate: formatDate(medicine.expiryDate),
        expiryDateSubtext: expirySubtext,
        statusLabel,
        statusTone
      };
    });

  const buildAvailableMedicinesRows = () => buildInventoryListRows({
    filter: (medicine, expiryDays) => numeric(medicine.stockOnHand) > 0 && expiryDays > 60,
    statusLabel: "Available",
    statusTone: "success"
  });

  const buildAboutToExpireRows = () => buildInventoryListRows({
    filter: (medicine, expiryDays) => numeric(medicine.stockOnHand) > 0 && expiryDays > 30 && expiryDays <= 60,
    statusLabel: "About to Expire",
    statusTone: "olive"
  });

  const buildNearlyExpiredRows = () => buildInventoryListRows({
    filter: (medicine, expiryDays) => numeric(medicine.stockOnHand) > 0 && expiryDays >= 0 && expiryDays <= 30,
    statusLabel: "Nearly Expired",
    statusTone: "warning"
  });

  const buildExpiredRows = () => buildInventoryListRows({
    filter: (_medicine, expiryDays) => expiryDays < 0,
    statusLabel: "Expired",
    statusTone: "danger"
  });

  const buildStockMovementRows = () => state.movements.slice().sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).map((movement) => {
    const medicine = findMedicineForMovement(movement);
    const unit = medicine?.unit || "units";
    return {
      movementDate: formatDate(movement.createdAt),
      movementDateSubtext: `${formatTime(movement.createdAt)} | ${movement.user || "Nurse-in-Charge"}`,
      medicine: medicine ? medicineLabel(medicine) : (movement.medicineName || "Medicine record"),
      medicineSubtext: medicine?.genericName || medicine?.form || "Stock movement",
      movementType: movementLabel(movement.actionType),
      quantity: formatNumber(movement.quantity),
      quantitySubtext: unit,
      balanceAfter: formatNumber(movement.stockAfter),
      balanceAfterSubtext: unit,
      batch: medicine?.batchNumber || "-",
      reference: movement.note || "Inventory movement recorded."
    };
  });

  const buildDispensingSummaryRows = () => state.movements.filter((movement) => keyOf(movement.actionType) === "dispense").sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).map((movement) => {
    const medicine = findMedicineForMovement(movement);
    return {
      dispenseDate: formatDate(movement.createdAt),
      dispenseDateSubtext: formatTime(movement.createdAt),
      resident: movement.recipientName || "Walk-in resident",
      barangay: movement.recipientBarangay || "Cabarian",
      medicine: medicine ? medicineLabel(medicine) : (movement.medicineName || "Medicine record"),
      medicineSubtext: medicine?.form ? `${medicine.form} | ${medicine.batchNumber}` : "Dispensing record",
      quantityReleased: formatNumber(movement.quantity),
      quantityReleasedSubtext: medicine?.unit || "units",
      releasedBy: movement.releasedByName || movement.user || "Nurse-in-Charge",
      releasedBySubtext: movement.releasedByRole || "Staff",
      notes: movement.note || "Dispensing record"
    };
  });

  const buildDeliveryReceivingRows = () => state.movements.filter((movement) => {
    const action = keyOf(movement.actionType);
    return action === "restock" || action === "receive";
  }).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).map((movement) => {
    const medicine = findMedicineForMovement(movement);
    return {
      receivedDate: formatDate(movement.createdAt),
      receivedDateSubtext: formatTime(movement.createdAt),
      medicine: medicine ? medicineLabel(medicine) : (movement.medicineName || "Medicine record"),
      medicineSubtext: medicine?.genericName || medicine?.form || "Receiving entry",
      batch: medicine?.batchNumber || "-",
      quantityReceived: formatNumber(movement.quantity),
      quantityReceivedSubtext: medicine?.unit || "units",
      expiryDate: formatDate(medicine?.expiryDate),
      receivedBy: movement.user || "Nurse-in-Charge",
      remarks: movement.note || "CHO delivery received."
    };
  });

  const buildExpiredDamagedRows = () => {
    const removedRows = state.movements.filter((movement) => keyOf(movement.actionType) === "dispose").map((movement) => {
      const medicine = findMedicineForMovement(movement);
      return {
        sortKey: new Date(movement.createdAt).getTime(),
        recordedDate: formatDate(movement.createdAt),
        recordedDateSubtext: formatTime(movement.createdAt),
        medicine: medicine ? medicineLabel(medicine) : (movement.medicineName || "Medicine record"),
        medicineSubtext: medicine?.genericName || "Wastage entry",
        batch: medicine?.batchNumber || "-",
        expiryDate: formatDate(medicine?.expiryDate),
        quantityRemoved: formatNumber(movement.quantity),
        quantityRemovedSubtext: medicine?.unit || "units",
        reason: daysUntil(medicine?.expiryDate) < 0 ? "Expired batch" : "Damaged or unusable stock",
        actionTaken: movement.note || "Removed from active stock"
      };
    });

    const trackedKeys = new Set(removedRows.map((row) => `${keyOf(row.medicine)}|${keyOf(row.batch)}`));
    const pendingExpiredRows = state.inventory.filter((medicine) => daysUntil(medicine.expiryDate) < 0).filter((medicine) => !trackedKeys.has(`${keyOf(medicineLabel(medicine))}|${keyOf(medicine.batchNumber)}`)).map((medicine) => ({
      sortKey: new Date(medicine.lastUpdatedAt || nowIso()).getTime(),
      recordedDate: formatDate(medicine.lastUpdatedAt || nowIso()),
      recordedDateSubtext: "Pending segregation",
      medicine: medicineLabel(medicine),
      medicineSubtext: medicine.genericName || "Expired stock",
      batch: medicine.batchNumber,
      expiryDate: formatDate(medicine.expiryDate),
      quantityRemoved: formatNumber(medicine.stockOnHand),
      quantityRemovedSubtext: medicine.unit,
      reason: "Expired stock pending documentation",
      actionTaken: "Isolate item and prepare wastage report"
    }));

    return [...removedRows, ...pendingExpiredRows].sort((left, right) => right.sortKey - left.sortKey);
  };

  const REPORT_TYPES = [
    {
      key: "available-medicines",
      label: "Available Medicines",
      title: "Available Medicines Report",
      description: "List of medicines that are available and not yet close to expiry.",
      purpose: "Review medicines that are currently available for routine dispensing.",
      submission: "Internal RHU reference",
      frequency: "Daily stock review",
      dataSource: "Medicine inventory records",
      tag: "Available List",
      recordSingular: "medicine",
      recordPlural: "medicines",
      emptyMessage: "No available medicines are listed right now.",
      columns: [
        detailColumn("Medicine", "medicine", "medicineSubtext", "report-medicine-cell"),
        textColumn("Category", "category"),
        textColumn("Form", "form"),
        textColumn("Batch", "batch"),
        detailColumn("Stock On Hand", "stockOnHand", "stockOnHandSubtext"),
        detailColumn("Expiry Date", "expiryDate", "expiryDateSubtext"),
        statusColumn("Status")
      ],
      buildRows: buildAvailableMedicinesRows
    },
    {
      key: "about-to-expire",
      label: "About to Expire",
      title: "About to Expire Medicines Report",
      description: "List of medicines that will expire soon and need monitoring.",
      purpose: "Monitor medicines that are approaching expiry and may need prioritization.",
      submission: "Internal RHU monitoring",
      frequency: "Weekly expiry review",
      dataSource: "Medicine inventory records",
      tag: "Expiry Monitoring",
      recordSingular: "medicine",
      recordPlural: "medicines",
      emptyMessage: "No medicines are currently in the about-to-expire list.",
      columns: [
        detailColumn("Medicine", "medicine", "medicineSubtext", "report-medicine-cell"),
        textColumn("Category", "category"),
        textColumn("Form", "form"),
        textColumn("Batch", "batch"),
        detailColumn("Stock On Hand", "stockOnHand", "stockOnHandSubtext"),
        detailColumn("Expiry Date", "expiryDate", "expiryDateSubtext"),
        statusColumn("Status")
      ],
      buildRows: buildAboutToExpireRows
    },
    {
      key: "nearly-expired",
      label: "Nearly Expired",
      title: "Nearly Expired Medicines Report",
      description: "List of medicines that are very close to expiry.",
      purpose: "Flag medicines that need urgent review before they expire.",
      submission: "Internal RHU monitoring",
      frequency: "Daily expiry review",
      dataSource: "Medicine inventory records",
      tag: "Expiry Monitoring",
      recordSingular: "medicine",
      recordPlural: "medicines",
      emptyMessage: "No medicines are currently in the nearly expired list.",
      columns: [
        detailColumn("Medicine", "medicine", "medicineSubtext", "report-medicine-cell"),
        textColumn("Category", "category"),
        textColumn("Form", "form"),
        textColumn("Batch", "batch"),
        detailColumn("Stock On Hand", "stockOnHand", "stockOnHandSubtext"),
        detailColumn("Expiry Date", "expiryDate", "expiryDateSubtext"),
        statusColumn("Status")
      ],
      buildRows: buildNearlyExpiredRows
    },
    {
      key: "expired",
      label: "Expired",
      title: "Expired Medicines Report",
      description: "List of medicines that are already expired.",
      purpose: "Document expired medicines for segregation and non-dispensing review.",
      submission: "Internal RHU monitoring",
      frequency: "As needed during expiry review",
      dataSource: "Medicine inventory records",
      tag: "Expired List",
      recordSingular: "medicine",
      recordPlural: "medicines",
      emptyMessage: "No expired medicines are listed right now.",
      columns: [
        detailColumn("Medicine", "medicine", "medicineSubtext", "report-medicine-cell"),
        textColumn("Category", "category"),
        textColumn("Form", "form"),
        textColumn("Batch", "batch"),
        detailColumn("Stock On Hand", "stockOnHand", "stockOnHandSubtext"),
        detailColumn("Expiry Date", "expiryDate", "expiryDateSubtext"),
        statusColumn("Status")
      ],
      buildRows: buildExpiredRows
    }
  ];

  const normalizeReportSnapshot = (entry = {}) => {
    const definition = entry.reportDefinition || {};
    const matchingDefinition = REPORT_TYPES.find((item) => item.key === text(definition.key)) || null;
    const columns = Array.isArray(definition.columns) && definition.columns.length
      ? definition.columns.map((column) => ({ label: text(column?.label) || "Column" }))
      : (matchingDefinition?.columns || []).map((column) => ({ label: text(column.label) || "Column" }));
    const tableRows = Array.isArray(entry.tableRows)
      ? entry.tableRows.map((row) => Array.isArray(row) ? row.map((value) => safeExport(value)) : [])
      : [];
    return {
      id: text(entry.id) || uid(),
      format: keyOf(entry.format) === "pdf" ? "pdf" : "excel",
      generatedAt: text(entry.generatedAt) || nowIso(),
      preparedBy: text(entry.preparedBy) || "Nurse-in-Charge",
      rowCount: Math.max(0, Math.round(numeric(entry.rowCount || tableRows.length))),
      reportDefinition: {
        key: text(definition.key) || "report",
        label: text(definition.label) || text(definition.title) || "Report",
        title: text(definition.title) || "Generated Report",
        description: text(definition.description) || "Generated RHU report.",
        submission: text(definition.submission) || "Internal RHU reference",
        dataSource: text(definition.dataSource) || "System records",
        recordSingular: text(definition.recordSingular) || "record",
        recordPlural: text(definition.recordPlural) || "records",
        columns
      },
      tableRows
    };
  };

  const buildReportSnapshot = (generatedAt = "", definition = currentReportDefinition()) => {
    const rows = definition.buildRows();
    const preparedBy = currentAuditActor();
    return normalizeReportSnapshot({
      id: uid(),
      format: "pdf",
      generatedAt: generatedAt || nowIso(),
      preparedBy: preparedBy.actor || "Nurse-in-Charge",
      rowCount: rows.length,
      reportDefinition: {
        key: definition.key,
        label: definition.label,
        title: definition.title,
        description: definition.description,
        submission: definition.submission,
        dataSource: definition.dataSource,
        recordSingular: definition.recordSingular,
        recordPlural: definition.recordPlural,
        columns: definition.columns.map((column) => ({ label: column.label }))
      },
      tableRows: rows.map((row) => definition.columns.map((column) => safeExport(column.export(row))))
    });
  };

  const saveReportHistory = () => {
    localStorage.setItem(REPORT_HISTORY_STORAGE_KEY, JSON.stringify(state.reportHistory));
  };

  const loadReportHistory = () => {
    state.reportHistory = readStorageList(REPORT_HISTORY_STORAGE_KEY)
      .map((entry) => normalizeReportSnapshot(entry))
      .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime());
  };

  const addReportHistoryEntry = (snapshot, format) => {
    const entry = normalizeReportSnapshot({ ...snapshot, id: uid(), format });
    state.reportHistory.unshift(entry);
    state.reportHistory = state.reportHistory
      .sort((left, right) => new Date(right.generatedAt).getTime() - new Date(left.generatedAt).getTime())
      .slice(0, 30);
    saveReportHistory();
    return entry;
  };

  const removeReportHistoryEntry = (historyId) => {
    state.reportHistory = state.reportHistory.filter((entry) => text(entry.id) !== text(historyId));
    saveReportHistory();
  };

  const currentReportDefinition = () => REPORT_TYPES.find((definition) => definition.key === uiState.reportKey) || REPORT_TYPES[0];
  const reportEmptyMarkup = (definition, message) => `<tr><td colspan="${definition.columns.length}" class="report-empty">${esc(message)}</td></tr>`;
  const reportRowsMarkup = (definition, rows) => rows.map((row) => `<tr>${definition.columns.map((column) => `<td>${column.render(row)}</td>`).join("")}</tr>`).join("");

  const renderTableHead = (target, definition) => {
    if (!target) return;
    target.innerHTML = definition.columns.map((column) => `<th scope="col">${esc(column.label)}</th>`).join("");
  };

  const buildReportRows = () => currentReportDefinition().buildRows();

  const renderReportSelector = () => {
    if (!refs.reportTypeSelect) return;
    refs.reportTypeSelect.innerHTML = REPORT_TYPES.map((definition) => `<option value="${esc(definition.key)}">${esc(definition.label)}</option>`).join("");
    refs.reportTypeSelect.value = REPORT_TYPES.some((definition) => definition.key === uiState.reportKey) ? uiState.reportKey : REPORT_TYPES[0].key;
    uiState.reportKey = refs.reportTypeSelect.value;
  };

  const renderSummary = () => {
    if (!refs.reportsCount) return;
    if (uiState.workspaceView === "history") {
      refs.reportsCount.textContent = pluralize(state.reportHistory.length, "saved report");
      return;
    }
    const reportDefinition = currentReportDefinition();
    const rows = buildReportRows();
    refs.reportsCount.textContent = countLabelForReport(reportDefinition, rows.length);
  };

  const renderActions = () => {
    if (refs.generateReportBtn) refs.generateReportBtn.disabled = false;
    if (refs.reportHistoryToggleBtn) {
      refs.reportHistoryToggleBtn.classList.toggle("is-active", uiState.workspaceView === "history");
      refs.reportHistoryToggleBtn.setAttribute("aria-pressed", uiState.workspaceView === "history" ? "true" : "false");
    }
    if (refs.reportHistoryToggleIcon) refs.reportHistoryToggleIcon.className = `bi ${uiState.workspaceView === "history" ? "bi-file-earmark-plus" : "bi-clock-history"}`;
    if (refs.reportHistoryToggleLabel) refs.reportHistoryToggleLabel.textContent = uiState.workspaceView === "history" ? "Report Creation" : "Report History";
    if (refs.generateExcelBtn) refs.generateExcelBtn.disabled = false;
    if (refs.generatePdfBtn) refs.generatePdfBtn.disabled = false;
  };

  const renderWorkspaceView = () => {
    refs.reportTableView?.classList.toggle("d-none", uiState.workspaceView === "history");
    refs.reportHistoryView?.classList.toggle("d-none", uiState.workspaceView !== "history");
  };

  const openActionConfirm = ({
    title = "Confirm Action",
    message = "Please confirm this report action.",
    confirmLabel = "Continue",
    confirmTone = "success",
    iconClass = "bi-question-circle-fill",
    iconTone = "text-warning",
    onConfirm = null
  }) => {
    if (!reportActionModal || !refs.reportActionModalTitle || !refs.reportActionModalText || !refs.reportActionConfirmBtn) {
      return typeof onConfirm === "function" ? Promise.resolve(onConfirm()) : Promise.resolve();
    }

    actionConfirmState.handler = onConfirm;
    refs.reportActionModalTitle.textContent = title;
    refs.reportActionModalText.textContent = message;
    refs.reportActionConfirmBtn.textContent = confirmLabel;
    refs.reportActionConfirmBtn.className = `btn btn-${confirmTone} btn-modern`;
    if (refs.reportActionModalIconWrap) refs.reportActionModalIconWrap.className = `modal-icon mb-3 ${iconTone}`;
    if (refs.reportActionModalIcon) refs.reportActionModalIcon.className = `bi ${iconClass} fs-1`;
    reportActionModal.show();
    return Promise.resolve();
  };

  const renderTable = () => {
    if (!refs.reportTableBody) return;
    const reportDefinition = currentReportDefinition();
    const rows = buildReportRows();
    renderTableHead(refs.reportTableHeadRow, reportDefinition);
    refs.reportTableBody.innerHTML = rows.length ? reportRowsMarkup(reportDefinition, rows) : reportEmptyMarkup(reportDefinition, reportDefinition.emptyMessage);
  };

  const formatLabelForHistory = (format) => keyOf(format) === "pdf" ? "PDF" : "Excel";

  const historyRowMarkup = (entry) => `
    <tr>
      <td>
        <div class="report-medicine-cell">
          <strong>${esc(entry.reportDefinition.title)}</strong>
          <small>${esc(safeExport(entry.reportDefinition.submission))}</small>
        </div>
      </td>
      <td><span class="report-chip report-chip--${esc(entry.format)}">${esc(formatLabelForHistory(entry.format))}</span></td>
      <td>
        <div class="report-stock-cell">
          <strong>${esc(formatDate(entry.generatedAt))}</strong>
          <small>${esc(formatTime(entry.generatedAt))}</small>
        </div>
      </td>
      <td>${esc(safeExport(entry.preparedBy))}</td>
      <td>${esc(countLabelForReport(entry.reportDefinition, entry.rowCount))}</td>
      <td>
        <div class="report-history-actions dropdown">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary dropdown-toggle"
            data-bs-toggle="dropdown"
            data-bs-display="static"
            aria-expanded="false"
            aria-label="More report actions"
          >
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <button type="button" class="dropdown-item" data-history-action="download" data-history-id="${esc(entry.id)}">
                <i class="bi bi-download me-2"></i>Download
              </button>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li>
              <button type="button" class="dropdown-item text-danger" data-history-action="delete" data-history-id="${esc(entry.id)}">
                <i class="bi bi-trash3 me-2"></i>Delete
              </button>
            </li>
          </ul>
        </div>
      </td>
    </tr>
  `;

  const renderHistory = () => {
    if (refs.reportHistoryCount) refs.reportHistoryCount.textContent = pluralize(state.reportHistory.length, "report");
    if (!refs.reportHistoryTableBody) return;
    refs.reportHistoryTableBody.innerHTML = state.reportHistory.length
      ? state.reportHistory.map((entry) => historyRowMarkup(entry)).join("")
      : '<tr><td colspan="6" class="report-empty">No reports generated yet.</td></tr>';
  };

  const buildExcelDocumentHtml = (snapshot, exportedAt) => `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${worksheetName(snapshot.reportDefinition)}</x:Name>
              <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: Arial, Helvetica, sans-serif; margin: 20px; color: #1d2f1d; }
        .meta { margin-bottom: 18px; }
        .meta strong { display: block; font-size: 22px; margin-bottom: 4px; }
        .meta span { display: block; font-size: 13px; color: #5f6d5a; margin-bottom: 2px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d9e4d4; padding: 10px 12px; text-align: left; vertical-align: top; }
        th { background: #f4f8f2; color: #546450; font-size: 12px; text-transform: uppercase; }
        .empty { text-align: center; color: #6b7765; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="meta">
        <strong>${esc(snapshot.reportDefinition.title)}</strong>
        <span>Ligao City Coastal Rural Health Unit</span>
        <span>Cabarian, Ligao City</span>
        <span>Generated: ${esc(formatDateTime(snapshot.generatedAt))}</span>
        <span>Exported: ${esc(formatDateTime(exportedAt))}</span>
        <span>Prepared By: ${esc(snapshot.preparedBy)}</span>
        <span>Submission: ${esc(snapshot.reportDefinition.submission)}</span>
        <span>Total Records: ${esc(countLabelForReport(snapshot.reportDefinition, snapshot.rowCount))}</span>
      </div>
      <table>
        <thead>
          <tr>${snapshot.reportDefinition.columns.map((column) => `<th>${esc(column.label)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${snapshot.tableRows.length ? snapshot.tableRows.map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${snapshot.reportDefinition.columns.length}" class="empty">No records available.</td></tr>`}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const downloadExcelReport = (snapshot, exportedAt) => {
    const blob = new Blob([`\uFEFF${buildExcelDocumentHtml(snapshot, exportedAt)}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${reportFileStem(snapshot.reportDefinition, snapshot.generatedAt)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

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

  const loadPdfHeaderLogos = () => Promise.all(PDF_HEADER_LOGOS.map((src) => loadImageAsDataUrl(src)));

  const drawPdfPageHeader = (doc, pageWidth, margin, logos, snapshot) => {
    const centerX = pageWidth / 2;
    const [leftLogo, rightLogo] = logos;

    if (leftLogo) doc.addImage(leftLogo, "PNG", margin, 28, 50, 50, undefined, "FAST");
    if (rightLogo) doc.addImage(rightLogo, "PNG", pageWidth - margin - 50, 28, 50, 50, undefined, "FAST");

    let cursorY = 42;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(92, 103, 88);
    doc.text("Republic of the Philippines", centerX, cursorY, { align: "center" });

    cursorY += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Ligao City Coastal Rural Health Unit", centerX, cursorY, { align: "center" });

    cursorY += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(29, 47, 29);
    doc.text("MEDICINE STOCK MONITORING SYSTEM", centerX, cursorY, { align: "center" });

    cursorY += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(92, 103, 88);
    doc.text("Cabarian, Ligao City", centerX, cursorY, { align: "center" });

    cursorY += 24;
    doc.setDrawColor(112, 131, 109);
    doc.setLineWidth(0.8);
    doc.line(margin, cursorY, pageWidth - margin, cursorY);

    cursorY += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(23, 48, 26);
    doc.text(String(snapshot.reportDefinition.title || "").toUpperCase(), centerX, cursorY, { align: "center" });

    return cursorY + 22;
  };

  const drawPdfMetadataBlock = (doc, pageWidth, margin, startY, snapshot) => {
    const blockWidth = pageWidth - (margin * 2);
    const halfWidth = (blockWidth - 16) / 2;
    const leftX = margin;
    const rightX = margin + halfWidth + 16;
    const blockTop = startY;
    const leftLines = [
      `Generated On: ${formatDate(snapshot.generatedAt)}`,
      `Generated At: ${formatTime(snapshot.generatedAt)}`,
      `Total Records: ${countLabelForReport(snapshot.reportDefinition, snapshot.rowCount)}`
    ];
    const rightLines = [
      `Prepared By: ${snapshot.preparedBy}`,
      `Submission: ${snapshot.reportDefinition.submission}`,
      `Data Source: ${snapshot.reportDefinition.dataSource}`
    ];
    const lineHeight = 12;
    const measureColumnHeight = (lines) => lines.reduce((total, line) => {
      const wrapped = doc.splitTextToSize(line, halfWidth - 28);
      return total + (wrapped.length * lineHeight) + 2;
    }, 0);
    const contentHeight = Math.max(measureColumnHeight(leftLines), measureColumnHeight(rightLines));
    const blockHeight = Math.max(76, 42 + contentHeight);

    doc.setDrawColor(210, 220, 205);
    doc.setFillColor(252, 253, 251);
    doc.roundedRect(leftX, blockTop, halfWidth, blockHeight, 10, 10, "FD");
    doc.roundedRect(rightX, blockTop, halfWidth, blockHeight, 10, 10, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(97, 112, 91);
    doc.text("REPORT DETAILS", leftX + 14, blockTop + 18);
    doc.text("ADMINISTRATIVE DETAILS", rightX + 14, blockTop + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(41, 57, 35);
    let leftY = blockTop + 36;
    let rightY = blockTop + 36;
    leftLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, halfWidth - 28);
      doc.text(wrapped, leftX + 14, leftY);
      leftY += (wrapped.length * lineHeight) + 2;
    });
    rightLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, halfWidth - 28);
      doc.text(wrapped, rightX + 14, rightY);
      rightY += (wrapped.length * lineHeight) + 2;
    });

    return blockTop + blockHeight + 18;
  };

  const drawPdfSignatureSection = (doc, pageWidth, pageHeight, margin, logos, snapshot) => {
    const sectionWidth = pageWidth - (margin * 2);
    const signatureWidth = (sectionWidth - 36) / 3;
    let currentY = (doc.lastAutoTable?.finalY || 0) + 44;

    if (currentY > pageHeight - 110) {
      doc.addPage();
      const freshPageWidth = doc.internal.pageSize.getWidth();
      drawPdfPageHeader(doc, freshPageWidth, margin, logos, snapshot);
      currentY = 160;
    }

    currentY = Math.max(currentY, 140);
    const labels = [
      { role: "Prepared by", name: snapshot.preparedBy },
      { role: "Checked by", name: "" },
      { role: "Approved by", name: "" }
    ];

    labels.forEach((item, index) => {
      const x = margin + (index * (signatureWidth + 18));
      const lineY = currentY + 20;
      doc.setDrawColor(125, 137, 119);
      doc.setLineWidth(0.7);
      doc.line(x, lineY, x + signatureWidth, lineY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(35, 54, 31);
      if (item.name) doc.text(item.name, x + (signatureWidth / 2), lineY - 6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(99, 111, 94);
      doc.text(item.role, x + (signatureWidth / 2), lineY + 14, { align: "center" });
    });
  };

  const drawPdfPageNumbers = (doc, margin) => {
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(112, 124, 106);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: "right" });
      doc.text("System-generated RHU report", margin, pageHeight - 18);
    }
  };

  const downloadPdfReport = async (snapshot) => {
    const jsPDFCtor = window.jspdf?.jsPDF;
    if (!jsPDFCtor) return false;

    const orientation = snapshot.reportDefinition.columns.length > 6 ? "landscape" : "portrait";
    const doc = new jsPDFCtor({ orientation, unit: "pt", format: "a4" });
    if (typeof doc.autoTable !== "function") return false;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 36;
    const logos = await loadPdfHeaderLogos();
    const headerBottomY = drawPdfPageHeader(doc, pageWidth, margin, logos, snapshot);
    let cursorY = drawPdfMetadataBlock(doc, pageWidth, margin, headerBottomY, snapshot);

    doc.autoTable({
      startY: cursorY,
      head: [snapshot.reportDefinition.columns.map((column) => safeExport(column.label))],
      body: snapshot.tableRows,
      margin: { top: 150, right: margin, bottom: 52, left: margin },
      styles: {
        font: "helvetica",
        fontSize: 8.2,
        cellPadding: 5.5,
        lineColor: [210, 220, 205],
        lineWidth: 0.45,
        textColor: [29, 47, 29],
        valign: "top"
      },
      headStyles: {
        fillColor: [242, 245, 240],
        textColor: [73, 88, 68],
        fontStyle: "bold"
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [250, 252, 248]
      },
      didDrawPage: () => {
        drawPdfPageHeader(doc, doc.internal.pageSize.getWidth(), margin, logos, snapshot);
      }
    });

    drawPdfSignatureSection(doc, pageWidth, pageHeight, margin, logos, snapshot);
    drawPdfPageNumbers(doc, margin);
    doc.save(`${reportFileStem(snapshot.reportDefinition, snapshot.generatedAt)}.pdf`);
    return true;
  };

  const renderAll = () => {
    renderReportSelector();
    renderSummary();
    renderActions();
    renderWorkspaceView();
    renderTable();
    renderHistory();
  };

  const generateAndDownloadReport = async (format) => {
    const reportDefinition = currentReportDefinition();
    const timestamp = nowIso();
    const snapshot = buildReportSnapshot(timestamp, reportDefinition);
    const historyEntry = addReportHistoryEntry(snapshot, format);
    renderAll();
    reportFormatModal?.hide();

    const downloaded = format === "pdf"
      ? await downloadPdfReport(historyEntry)
      : (downloadExcelReport(historyEntry, historyEntry.generatedAt), true);

    if (!downloaded) {
      showNotice(`${formatLabelForHistory(format)} download is unavailable right now.`, "warning");
      return;
    }

    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: `Generated ${formatLabelForHistory(format)} report`,
      actionType: "created",
      target: reportDefinition.title,
      details: `${reportDefinition.title} generated as ${formatLabelForHistory(format)} with ${countLabelForReport(reportDefinition, historyEntry.rowCount)}.`,
      category: "Reports",
      resultLabel: formatLabelForHistory(format),
      resultTone: "success",
      createdAt: historyEntry.generatedAt
    });

    showNotice(`${formatLabelForHistory(format)} report generated and saved to history.`);
  };

  const redownloadHistoryEntry = async (historyId) => {
    const entry = state.reportHistory.find((item) => text(item.id) === text(historyId));
    if (!entry) return;

    const downloaded = entry.format === "pdf"
      ? await downloadPdfReport(entry)
      : (downloadExcelReport(entry, nowIso()), true);
    if (!downloaded) {
      showNotice(`${formatLabelForHistory(entry.format)} download is unavailable right now.`, "warning");
      return;
    }

    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: `Downloaded saved ${formatLabelForHistory(entry.format)} report`,
      actionType: "updated",
      target: entry.reportDefinition.title,
      details: `${entry.reportDefinition.title} downloaded again as ${formatLabelForHistory(entry.format)} with ${countLabelForReport(entry.reportDefinition, entry.rowCount)}.`,
      category: "Reports",
      resultLabel: formatLabelForHistory(entry.format),
      resultTone: "success",
      createdAt: nowIso()
    });

    showNotice(`${formatLabelForHistory(entry.format)} file downloaded.`);
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

  refs.reportTypeSelect?.addEventListener("change", (event) => {
    uiState.reportKey = text(event.target.value) || REPORT_TYPES[0].key;
    uiState.workspaceView = "report";
    renderAll();
  });

  refs.reportHistoryToggleBtn?.addEventListener("click", () => {
    uiState.workspaceView = uiState.workspaceView === "history" ? "report" : "history";
    renderAll();
  });

  refs.generateReportBtn?.addEventListener("click", () => {
    if (!reportFormatModal) {
      showNotice("Report format options are unavailable right now.", "warning");
      return;
    }
    reportFormatModal.show();
  });

  refs.generateExcelBtn?.addEventListener("click", async () => {
    refs.generateExcelBtn.disabled = true;
    refs.generatePdfBtn && (refs.generatePdfBtn.disabled = true);
    try {
      await generateAndDownloadReport("excel");
    } finally {
      renderActions();
    }
  });

  refs.generatePdfBtn?.addEventListener("click", async () => {
    refs.generatePdfBtn.disabled = true;
    refs.generateExcelBtn && (refs.generateExcelBtn.disabled = true);
    try {
      await generateAndDownloadReport("pdf");
    } finally {
      renderActions();
    }
  });

  byId("reportActionModal")?.addEventListener("hidden.bs.modal", () => {
    actionConfirmState.handler = null;
    if (refs.reportActionConfirmBtn) refs.reportActionConfirmBtn.disabled = false;
  });

  refs.reportActionConfirmBtn?.addEventListener("click", async () => {
    const handler = actionConfirmState.handler;
    if (typeof handler !== "function") {
      reportActionModal?.hide();
      return;
    }

    refs.reportActionConfirmBtn.disabled = true;
    reportActionModal?.hide();
    try {
      await handler();
    } finally {
      refs.reportActionConfirmBtn.disabled = false;
      actionConfirmState.handler = null;
    }
  });

  refs.reportHistoryTableBody?.addEventListener("click", async (event) => {
    const actionButton = event.target.closest("[data-history-action][data-history-id]");
    if (!actionButton) return;
    const historyId = text(actionButton.getAttribute("data-history-id"));
    const action = text(actionButton.getAttribute("data-history-action"));
    if (!historyId || !action) return;

    if (action === "delete") {
      const entry = state.reportHistory.find((item) => text(item.id) === historyId);
      if (!entry) return;
      await openActionConfirm({
        title: "Delete Report",
        message: `Are you sure you want to remove ${entry.reportDefinition.title} from report history?`,
        confirmLabel: "Delete",
        confirmTone: "danger",
        iconClass: "bi-trash3-fill",
        iconTone: "text-danger",
        onConfirm: async () => {
          removeReportHistoryEntry(historyId);
          renderAll();
          const audit = currentAuditActor();
          appendActivityLog({
            ...audit,
            action: "Deleted saved report",
            actionType: "updated",
            target: entry.reportDefinition.title,
            details: `${entry.reportDefinition.title} removed from local report history.`,
            category: "Reports",
            resultLabel: "Deleted",
            resultTone: "warning",
            createdAt: nowIso()
          });
          showNotice("Report removed from history.");
        }
      });
      return;
    }

    if (action === "download") {
      const entry = state.reportHistory.find((item) => text(item.id) === historyId);
      if (!entry) return;
      await openActionConfirm({
        title: "Download Report",
        message: `Download ${entry.reportDefinition.title} as ${formatLabelForHistory(entry.format)}?`,
        confirmLabel: "Download",
        confirmTone: "success",
        iconClass: "bi-download",
        iconTone: "text-success",
        onConfirm: async () => {
          await redownloadHistoryEntry(historyId);
        }
      });
    }
  });

  loadInventory();
  loadMovements();
  loadReportHistory();
  uiState.reportKey = REPORT_TYPES[0].key;
  renderAll();
})();
