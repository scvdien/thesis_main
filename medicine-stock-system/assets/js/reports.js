(() => {
  const STORAGE_KEY = "mss_reports_v1";
  const INVENTORY_STORAGE = "mss_inventory_records_v1";
  const ACTIVITY_LOG_STORAGE = "mss_activity_logs_v1";
  const USERS_STORAGE = "mss_users_v1";
  const SESSIONS_STORAGE = "mss_active_sessions_v1";

  const REPORT_TYPES = [
    {
      key: "available",
      label: "Available Medicines",
      title: "Available Medicines Report",
      description: "List of medicines with stock ready for dispensing."
    },
    {
      key: "about-to-expire",
      label: "About to Expire",
      title: "About to Expire Medicines Report",
      description: "Medicines that need immediate expiry review."
    },
    {
      key: "nearly-expired",
      label: "Nearly Expired",
      title: "Nearly Expired Medicines Report",
      description: "Medicines nearing expiry for close monitoring."
    },
    {
      key: "expired",
      label: "Expired",
      title: "Expired Medicines Report",
      description: "Medicines that should no longer be dispensed."
    }
  ];

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    reportTypeSelect: byId("reportTypeSelect"),
    generateReportBtn: byId("generateReportBtn"),
    reportsCount: byId("reportsCount"),
    reportTableBody: byId("reportTableBody"),
    reportPreviewTitle: byId("reportPreviewTitle"),
    reportPreviewMeta: byId("reportPreviewMeta"),
    reportPreviewSheetTitle: byId("reportPreviewSheetTitle"),
    reportPreviewSheetDescription: byId("reportPreviewSheetDescription"),
    reportPreviewGeneratedAt: byId("reportPreviewGeneratedAt"),
    reportPreviewCount: byId("reportPreviewCount"),
    reportPreviewPreparedBy: byId("reportPreviewPreparedBy"),
    reportPreviewTableBody: byId("reportPreviewTableBody"),
    downloadExcelBtn: byId("downloadExcelBtn"),
    savePdfBtn: byId("savePdfBtn")
  };

  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;
  const reportPreviewModal = byId("reportPreviewModal") && window.bootstrap ? new window.bootstrap.Modal(byId("reportPreviewModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    inventory: [],
    reportMeta: {},
    previewSnapshot: null
  };

  const uiState = {
    reportKey: String(refs.reportTypeSelect?.value ?? "").trim() || REPORT_TYPES[0]?.key || "available"
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
    if (!refs.moduleAlert) return;
    refs.moduleAlert.className = `alert alert-${type}`;
    refs.moduleAlert.textContent = message;
    refs.moduleAlert.classList.remove("d-none");
    window.clearTimeout(alertTimer);
    alertTimer = window.setTimeout(() => refs.moduleAlert?.classList.add("d-none"), 3200);
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
      category: text(entry.category) || "General",
      batchNumber: text(entry.batchNumber) || "-",
      stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
      unit: text(entry.unit) || "units",
      expiryDate: safeExpiry,
      location: text(entry.location) || "Main Cabinet"
    };
  };

  const fallbackInventory = () => ([
    {
      name: "Paracetamol",
      genericName: "Acetaminophen",
      strength: "500mg",
      category: "Analgesic",
      batchNumber: "PAR-2026-011",
      stockOnHand: 540,
      unit: "tablets",
      expiryDate: shiftDays(210),
      location: "Cabinet A"
    },
    {
      name: "Amlodipine",
      genericName: "Amlodipine Besylate",
      strength: "5mg",
      category: "Maintenance",
      batchNumber: "AML-2026-008",
      stockOnHand: 154,
      unit: "tablets",
      expiryDate: shiftDays(160),
      location: "Maintenance Cabinet"
    },
    {
      name: "Salbutamol",
      genericName: "Salbutamol Sulfate",
      strength: "2mg",
      category: "Respiratory",
      batchNumber: "SLB-2026-017",
      stockOnHand: 74,
      unit: "tablets",
      expiryDate: shiftDays(18),
      location: "Respiratory Tray"
    },
    {
      name: "Lagundi",
      genericName: "Vitex Negundo",
      strength: "300mg",
      category: "Herbal",
      batchNumber: "LGD-2026-018",
      stockOnHand: 28,
      unit: "capsules",
      expiryDate: shiftDays(56),
      location: "Herbal Shelf"
    },
    {
      name: "ORS",
      genericName: "Oral Rehydration Salts",
      strength: "4.1g",
      category: "Hydration",
      batchNumber: "ORS-2026-009",
      stockOnHand: 62,
      unit: "sachets",
      expiryDate: shiftDays(82),
      location: "Hydration Bin"
    },
    {
      name: "Zinc Sulfate",
      genericName: "Zinc Sulfate",
      strength: "20mg",
      category: "Supplement",
      batchNumber: "ZNC-2025-003",
      stockOnHand: 12,
      unit: "tablets",
      expiryDate: shiftDays(-10),
      location: "Quarantine Shelf"
    }
  ]).map(normalizeInventoryItem);

  const loadInventory = () => {
    state.inventory = readStorageList(INVENTORY_STORAGE).map(normalizeInventoryItem);
    if (!state.inventory.length) {
      state.inventory = fallbackInventory();
    }
  };

  const normalizeReportMeta = (definition, entry = {}) => ({
    reportKey: definition.key,
    title: definition.title,
    generatedAt: text(entry.generatedAt),
    exportedAt: text(entry.exportedAt)
  });

  const saveState = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.values(state.reportMeta)));
  };

  const loadReportMeta = () => {
    const stored = readStorageList(STORAGE_KEY);
    state.reportMeta = Object.fromEntries(REPORT_TYPES.map((definition) => {
      const existing = stored.find((entry) => (
        keyOf(entry.reportKey) === definition.key
        || keyOf(entry.title) === keyOf(definition.title)
        || keyOf(entry.category) === keyOf(definition.label)
      ));
      return [definition.key, normalizeReportMeta(definition, existing)];
    }));
    saveState();
  };

  const currentReportDefinition = () => REPORT_TYPES.find((definition) => definition.key === uiState.reportKey) || REPORT_TYPES[0];

  const medicineLabel = (medicine) => [text(medicine.name), text(medicine.strength)].filter(Boolean).join(" ");
  const reportFileStem = (reportDefinition) => `${reportDefinition.key}-medicines-report-${new Date().toISOString().slice(0, 10)}`;
  const worksheetName = (reportDefinition) => text(reportDefinition.label).replace(/[\\/*?:[\]]/g, "").slice(0, 31) || "Medicine Report";

  const statusLabelForRow = (reportKey, expiryDays) => {
    if (reportKey === "expired") return `${formatNumber(Math.abs(expiryDays))} day${Math.abs(expiryDays) === 1 ? "" : "s"} overdue`;
    if (reportKey === "about-to-expire" || reportKey === "nearly-expired") {
      return `${formatNumber(expiryDays)} day${expiryDays === 1 ? "" : "s"} left`;
    }
    return "Available";
  };

  const statusToneForRow = (reportKey) => {
    if (reportKey === "expired") return "danger";
    if (reportKey === "about-to-expire") return "warning";
    if (reportKey === "nearly-expired") return "olive";
    return "success";
  };

  const matchesReportType = (reportKey, medicine, expiryDays) => {
    if (reportKey === "expired") return expiryDays < 0;
    if (reportKey === "about-to-expire") return expiryDays >= 0 && expiryDays <= 30;
    if (reportKey === "nearly-expired") return expiryDays > 30 && expiryDays <= 90;
    return medicine.stockOnHand > 0 && expiryDays >= 0;
  };

  const buildReportRows = () => {
    const reportDefinition = currentReportDefinition();

    return state.inventory
      .map((medicine) => ({ medicine, expiryDays: daysUntil(medicine.expiryDate) }))
      .filter(({ medicine, expiryDays }) => matchesReportType(reportDefinition.key, medicine, expiryDays))
      .sort((left, right) => {
        if (reportDefinition.key === "available") {
          return medicineLabel(left.medicine).localeCompare(medicineLabel(right.medicine));
        }

        return left.expiryDays - right.expiryDays;
      });
  };

  const reportEmptyMarkup = (message) => `
    <tr>
      <td colspan="6" class="report-empty">${esc(message)}</td>
    </tr>
  `;

  const reportRowsMarkup = (reportDefinition, rows) => rows.map(({ medicine, expiryDays }) => `
    <tr>
      <td>
        <div class="report-medicine-cell">
          <strong>${esc(medicineLabel(medicine))}</strong>
          <small>${esc(medicine.genericName || medicine.location || "Medicine record")}</small>
        </div>
      </td>
      <td>${esc(medicine.category)}</td>
      <td>${esc(medicine.batchNumber)}</td>
      <td>
        <div class="report-stock-cell">
          <strong>${esc(formatNumber(medicine.stockOnHand))}</strong>
          <small>${esc(medicine.unit)}</small>
        </div>
      </td>
      <td>${esc(formatDate(medicine.expiryDate))}</td>
      <td>
        <span class="report-row-status report-row-status--${esc(statusToneForRow(reportDefinition.key))}">
          ${esc(statusLabelForRow(reportDefinition.key, expiryDays))}
        </span>
      </td>
    </tr>
  `).join("");

  const buildReportSnapshot = (generatedAt = "") => {
    const reportDefinition = currentReportDefinition();
    const rows = buildReportRows();
    const reportMeta = state.reportMeta[reportDefinition.key] || normalizeReportMeta(reportDefinition);
    const preparedBy = currentAuditActor();

    return {
      reportDefinition,
      rows,
      generatedAt: generatedAt || reportMeta.generatedAt || nowIso(),
      preparedBy: preparedBy.actor || "Nurse-in-Charge"
    };
  };

  const renderPreview = (snapshot) => {
    if (!snapshot) return;

    if (refs.reportPreviewTitle) refs.reportPreviewTitle.textContent = snapshot.reportDefinition.title;
    if (refs.reportPreviewMeta) refs.reportPreviewMeta.textContent = "Review the selected medicine report before download.";
    if (refs.reportPreviewSheetTitle) refs.reportPreviewSheetTitle.textContent = snapshot.reportDefinition.title;
    if (refs.reportPreviewSheetDescription) refs.reportPreviewSheetDescription.textContent = snapshot.reportDefinition.description;
    if (refs.reportPreviewGeneratedAt) refs.reportPreviewGeneratedAt.textContent = formatDateTime(snapshot.generatedAt);
    if (refs.reportPreviewCount) refs.reportPreviewCount.textContent = pluralize(snapshot.rows.length, "item");
    if (refs.reportPreviewPreparedBy) refs.reportPreviewPreparedBy.textContent = snapshot.preparedBy;
    if (refs.downloadExcelBtn) refs.downloadExcelBtn.disabled = !snapshot.rows.length;
    if (refs.savePdfBtn) refs.savePdfBtn.disabled = !snapshot.rows.length;

    if (refs.reportPreviewTableBody) {
      refs.reportPreviewTableBody.innerHTML = snapshot.rows.length
        ? reportRowsMarkup(snapshot.reportDefinition, snapshot.rows)
        : reportEmptyMarkup(`No medicine records found for ${snapshot.reportDefinition.label.toLowerCase()}.`);
    }
  };

  const buildPrintDocumentHtml = (snapshot) => `
    <!doctype html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${esc(snapshot.reportDefinition.title)}</title>
      <style>
        body {
          font-family: Arial, Helvetica, sans-serif;
          margin: 0;
          padding: 28px;
          color: #1d2f1d;
          background: #ffffff;
        }
        .sheet {
          border: 1px solid #d8e2d3;
          border-radius: 18px;
          padding: 24px;
        }
        .brand span {
          display: block;
          color: #2b5d24;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .brand strong {
          display: block;
          margin-top: 4px;
          font-size: 24px;
        }
        .brand small {
          display: block;
          margin-top: 4px;
          color: #586654;
          font-size: 13px;
        }
        h1 {
          margin: 22px 0 6px;
          font-size: 22px;
        }
        .desc {
          margin: 0;
          color: #5f6d5a;
          font-size: 14px;
          line-height: 1.5;
        }
        .summary {
          display: table;
          width: 100%;
          margin: 20px 0 18px;
          border-collapse: separate;
          border-spacing: 0;
        }
        .summary-item {
          display: table-cell;
          width: 33.333%;
          padding: 12px 14px;
          border: 1px solid #dde7d7;
          vertical-align: top;
        }
        .summary-item + .summary-item {
          border-left: 0;
        }
        .summary-item span {
          display: block;
          color: #6d7b68;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .summary-item strong {
          display: block;
          margin-top: 6px;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th, td {
          border: 1px solid #dde7d7;
          padding: 10px 12px;
          text-align: left;
          vertical-align: top;
          font-size: 13px;
        }
        th {
          background: #f4f8f2;
          color: #546450;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .muted {
          display: block;
          margin-top: 3px;
          color: #6c7967;
          font-size: 11px;
        }
        .status {
          display: inline-block;
          padding: 5px 10px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 11px;
        }
        .status-success { background: #e8f5e4; color: #2f7d20; }
        .status-warning { background: #fff2dd; color: #a97708; }
        .status-olive { background: #edf1e8; color: #506246; }
        .status-danger { background: #fde9e9; color: #b62828; }
        .empty {
          text-align: center;
          color: #6b7765;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="brand">
          <span>Ligao City Coastal Rural Health Unit</span>
          <strong>Medicine Stock Monitoring System</strong>
          <small>Cabarian, Ligao City</small>
        </div>

        <h1>${esc(snapshot.reportDefinition.title)}</h1>
        <p class="desc">${esc(snapshot.reportDefinition.description)}</p>

        <div class="summary">
          <div class="summary-item">
            <span>Generated</span>
            <strong>${esc(formatDateTime(snapshot.generatedAt))}</strong>
          </div>
          <div class="summary-item">
            <span>Total Items</span>
            <strong>${esc(pluralize(snapshot.rows.length, "item"))}</strong>
          </div>
          <div class="summary-item">
            <span>Prepared By</span>
            <strong>${esc(snapshot.preparedBy)}</strong>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Medicine</th>
              <th>Category</th>
              <th>Batch</th>
              <th>Stock</th>
              <th>Expiry Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${snapshot.rows.length ? snapshot.rows.map(({ medicine, expiryDays }) => `
              <tr>
                <td>
                  ${esc(medicineLabel(medicine))}
                  <span class="muted">${esc(medicine.genericName || medicine.location || "Medicine record")}</span>
                </td>
                <td>${esc(medicine.category)}</td>
                <td>${esc(medicine.batchNumber)}</td>
                <td>
                  ${esc(formatNumber(medicine.stockOnHand))}
                  <span class="muted">${esc(medicine.unit)}</span>
                </td>
                <td>${esc(formatDate(medicine.expiryDate))}</td>
                <td>
                  <span class="status status-${esc(statusToneForRow(snapshot.reportDefinition.key))}">
                    ${esc(statusLabelForRow(snapshot.reportDefinition.key, expiryDays))}
                  </span>
                </td>
              </tr>
            `).join("") : `
              <tr>
                <td colspan="6" class="empty">No medicine records found for ${esc(snapshot.reportDefinition.label.toLowerCase())}.</td>
              </tr>
            `}
          </tbody>
        </table>
      </div>
    </body>
    </html>
  `;

  const openPrintWindow = (snapshot) => {
    const printWindow = window.open("", "_blank", "width=980,height=760");
    if (!printWindow) return false;

    printWindow.document.open();
    printWindow.document.write(buildPrintDocumentHtml(snapshot));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 250);
    return true;
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
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
              </x:WorksheetOptions>
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
        .muted { color: #6b7765; font-size: 11px; }
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
        <span>Total Items: ${esc(pluralize(snapshot.rows.length, "item"))}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Medicine</th>
            <th>Generic Name</th>
            <th>Category</th>
            <th>Batch</th>
            <th>Stock</th>
            <th>Unit</th>
            <th>Expiry Date</th>
            <th>Status</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          ${snapshot.rows.map(({ medicine, expiryDays }) => `
            <tr>
              <td>${esc(medicineLabel(medicine))}</td>
              <td>${esc(medicine.genericName || "-")}</td>
              <td>${esc(medicine.category)}</td>
              <td>${esc(medicine.batchNumber)}</td>
              <td>${esc(formatNumber(medicine.stockOnHand))}</td>
              <td>${esc(medicine.unit)}</td>
              <td>${esc(formatDate(medicine.expiryDate))}</td>
              <td>${esc(statusLabelForRow(snapshot.reportDefinition.key, expiryDays))}</td>
              <td>${esc(medicine.location)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </body>
    </html>
  `;

  const downloadExcelReport = (snapshot, exportedAt) => {
    const blob = new Blob([`\uFEFF${buildExcelDocumentHtml(snapshot, exportedAt)}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${reportFileStem(snapshot.reportDefinition)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
  };

  const renderReportSelector = () => {
    if (!refs.reportTypeSelect) return;
    refs.reportTypeSelect.value = uiState.reportKey;
  };

  const renderSummary = () => {
    const rows = buildReportRows();

    if (refs.reportsCount) refs.reportsCount.textContent = pluralize(rows.length, "item");
  };

  const renderActions = () => {
    const rows = buildReportRows();

    if (refs.generateReportBtn) {
      refs.generateReportBtn.disabled = !rows.length;
    }
  };

  const renderTable = () => {
    if (!refs.reportTableBody) return;
    const reportDefinition = currentReportDefinition();
    const rows = buildReportRows();

    if (!rows.length) {
      refs.reportTableBody.innerHTML = reportEmptyMarkup(`No medicine records found for ${reportDefinition.label.toLowerCase()}.`);
      return;
    }

    refs.reportTableBody.innerHTML = reportRowsMarkup(reportDefinition, rows);
  };

  const renderAll = () => {
    renderReportSelector();
    renderSummary();
    renderActions();
    renderTable();
  };

  const generateReport = () => {
    const reportDefinition = currentReportDefinition();
    const rows = buildReportRows();
    if (!rows.length) {
      showNotice("No medicine items are available for this report.", "warning");
      return;
    }

    const generatedAt = nowIso();
    state.reportMeta[reportDefinition.key] = {
      ...(state.reportMeta[reportDefinition.key] || normalizeReportMeta(reportDefinition)),
      generatedAt
    };
    saveState();
    state.previewSnapshot = buildReportSnapshot(generatedAt);
    renderAll();
    renderPreview(state.previewSnapshot);
    reportPreviewModal?.show();

    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: "Generated report",
      actionType: "created",
      target: reportDefinition.title,
      details: `${reportDefinition.title} generated with ${pluralize(rows.length, "item")} in the list.`,
      category: "Reports",
      resultLabel: "Created",
      resultTone: "success",
      createdAt: generatedAt
    });

    showNotice("Report ready.");
  };

  const downloadExcel = () => {
    const reportDefinition = currentReportDefinition();
    const snapshot = state.previewSnapshot || buildReportSnapshot();
    if (!snapshot.rows.length) {
      showNotice("No medicine items are available to export for this report.", "warning");
      return;
    }

    const meta = state.reportMeta[reportDefinition.key] || normalizeReportMeta(reportDefinition);
    const timestamp = nowIso();
    state.reportMeta[reportDefinition.key] = {
      ...meta,
      generatedAt: meta.generatedAt || timestamp,
      exportedAt: timestamp
    };
    saveState();
    state.previewSnapshot = buildReportSnapshot(state.reportMeta[reportDefinition.key].generatedAt);
    renderAll();
    renderPreview(state.previewSnapshot);
    downloadExcelReport(state.previewSnapshot, timestamp);

    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: "Downloaded Excel report",
      actionType: "updated",
      target: reportDefinition.title,
      details: `${reportDefinition.title} downloaded as Excel with ${pluralize(snapshot.rows.length, "item")} in the list.`,
      category: "Reports",
      resultLabel: "Excel",
      resultTone: "success",
      createdAt: timestamp
    });

    showNotice("Excel file downloaded.");
  };

  const savePdfReport = () => {
    const snapshot = state.previewSnapshot || buildReportSnapshot();
    if (!snapshot.rows.length) {
      showNotice("No medicine items are available for this report.", "warning");
      return;
    }

    const printOpened = openPrintWindow(snapshot);
    if (!printOpened) {
      showNotice("Allow pop-ups to save this report as PDF.", "warning");
      return;
    }

    const openedAt = nowIso();
    const audit = currentAuditActor();
    appendActivityLog({
      ...audit,
      action: "Opened PDF dialog",
      actionType: "updated",
      target: snapshot.reportDefinition.title,
      details: `${snapshot.reportDefinition.title} opened in PDF save dialog with ${pluralize(snapshot.rows.length, "item")} in the list.`,
      category: "Reports",
      resultLabel: "PDF",
      resultTone: "success",
      createdAt: openedAt
    });

    showNotice("PDF dialog opened.");
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
    uiState.reportKey = text(event.target.value) || REPORT_TYPES[0]?.key || "available";
    renderAll();
  });

  refs.generateReportBtn?.addEventListener("click", generateReport);
  refs.downloadExcelBtn?.addEventListener("click", downloadExcel);
  refs.savePdfBtn?.addEventListener("click", savePdfReport);

  loadInventory();
  loadReportMeta();
  renderAll();
})();
