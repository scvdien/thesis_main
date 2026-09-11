(() => {
  const supplyMonitoring = window.MSSSupplyMonitoring;
  const currentAuthUser = typeof window.MSS_AUTH_USER === "object" && window.MSS_AUTH_USER
    ? window.MSS_AUTH_USER
    : null;
  const STATE_ENDPOINT = "state-api.php";
  const STORAGE = {
    inventory: "mss_inventory_records_v1",
    movements: "mss_inventory_movements_v1",
    residents: "mss_resident_accounts_v1"
  };

  const HOUSEHOLD_RESIDENT_API = "../household-system/registration-sync.php";
  const STOCK_PENDING_DELIVERY_KEY = "mss_pending_cho_delivery_v1";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    openAddMedicineBtn: byId("openAddMedicineBtn"),
    metricTotalMedicines: byId("metricTotalMedicines"),
    metricUnitsOnHand: byId("metricUnitsOnHand"),
    metricLowStock: byId("metricLowStock"),
    metricExpiringSoon: byId("metricExpiringSoon"),
    inventoryCount: byId("inventoryCount"),
    inventorySearch: byId("inventorySearch"),
    inventorySearchBtn: byId("inventorySearchBtn"),
    categoryFilter: byId("categoryFilter"),
    statusFilter: byId("statusFilter"),
    inventoryTableBody: byId("inventoryTableBody"),
    restockList: byId("restockList"),
    expiryList: byId("expiryList"),
    categorySummaryList: byId("categorySummaryList"),
    reorderPlannerList: byId("reorderPlannerList"),
    medicineModalTitle: byId("medicineModalTitle"),
    medicineModalSubtitle: byId("medicineModalSubtitle"),
    medicineForm: byId("medicineForm"),
    medicineId: byId("medicineId"),
    medicineName: byId("medicineName"),
    genericName: byId("genericName"),
    medicineCategory: byId("medicineCategory"),
    medicineFormType: byId("medicineFormType"),
    medicineStrength: byId("medicineStrength"),
    medicineUnit: byId("medicineUnit"),
    stockOnHand: byId("stockOnHand"),
    stockOnHandDisplay: byId("stockOnHandDisplay"),
    stockOnHandDisplayValue: byId("stockOnHandDisplayValue"),
    reorderLevel: byId("reorderLevel"),
    batchNumber: byId("batchNumber"),
    expiryDate: byId("expiryDate"),
    recordStatusModalTitle: byId("recordStatusModalTitle"),
    recordStatusModalMessage: byId("recordStatusModalMessage"),
    recordStatusModalHint: byId("recordStatusModalHint"),
    recordStatusModalIcon: byId("recordStatusModalIcon"),
    recordStatusModalIconGlyph: byId("recordStatusModalIconGlyph"),
    recordStatusModalConfirmBtn: byId("recordStatusModalConfirmBtn"),
    stockActionForm: byId("stockActionForm"),
    stockMedicineId: byId("stockMedicineId"),
    stockActionModalTitle: byId("stockActionModalTitle"),
    stockActionMedicineLabel: byId("stockActionMedicineLabel"),
    stockCurrentStock: byId("stockCurrentStock"),
    stockActionType: byId("stockActionType"),
    stockActionTypeIcon: byId("stockActionTypeIcon"),
    stockActionQuantity: byId("stockActionQuantity"),
    stockActionQuantityLabel: byId("stockActionQuantityLabel"),
    stockActionQuantityUnit: byId("stockActionQuantityUnit"),
    stockActionDate: byId("stockActionDate"),
    stockActionDateLabel: byId("stockActionDateLabel"),
    stockRestockFlow: byId("stockRestockFlow"),
    stockRestockSourceCho: byId("stockRestockSourceCho"),
    stockRestockSourceManual: byId("stockRestockSourceManual"),
    stockRestockSourceHint: byId("stockRestockSourceHint"),
    stockLinkedRequestGroup: byId("stockLinkedRequestGroup"),
    stockLinkedRequestId: byId("stockLinkedRequestId"),
    stockLinkedRequestHint: byId("stockLinkedRequestHint"),
    stockLinkedRequestCard: byId("stockLinkedRequestCard"),
    stockLinkedRequestCode: byId("stockLinkedRequestCode"),
    stockLinkedRequestStatus: byId("stockLinkedRequestStatus"),
    stockLinkedRequestedQuantity: byId("stockLinkedRequestedQuantity"),
    stockLinkedReceivedQuantity: byId("stockLinkedReceivedQuantity"),
    stockLinkedRemainingQuantity: byId("stockLinkedRemainingQuantity"),
    stockLinkedExpectedDate: byId("stockLinkedExpectedDate"),
    stockActionPreview: byId("stockActionPreview"),
    stockActionPreviewTitle: byId("stockActionPreviewTitle"),
    stockActionPreviewText: byId("stockActionPreviewText"),
    stockActionNoteGroup: byId("stockActionNoteGroup"),
    stockActionNoteLabel: byId("stockActionNoteLabel"),
    stockActionNote: byId("stockActionNote"),
    stockActionQuantityGroup: byId("stockActionQuantityGroup"),
    stockDisposeBatchSection: byId("stockDisposeBatchSection"),
    stockDisposeSelectExpiredBtn: byId("stockDisposeSelectExpiredBtn"),
    stockDisposeSelectAllCheck: byId("stockDisposeSelectAllCheck"),
    stockDisposeBatchTableBody: byId("stockDisposeBatchTableBody"),
    stockDisposeSummary: byId("stockDisposeSummary"),
    stockDisposeTotalCount: byId("stockDisposeTotalCount"),
    stockDisposeTotalUnit: byId("stockDisposeTotalUnit"),
    stockDisposeBatchCountBadge: byId("stockDisposeBatchCountBadge"),
    stockDisposeRemainingStock: byId("stockDisposeRemainingStock"),
    stockActionFeedback: byId("stockActionFeedback"),
    stockActionSubmitBtn: byId("stockActionSubmitBtn"),
    stockActionSubmitLabel: byId("stockActionSubmitLabel"),
    stockActionCloseBtn: byId("stockActionCloseBtn"),
    stockActionCancelBtn: byId("stockActionCancelBtn"),
    stockActionBatchGroup: byId("stockActionBatchGroup"),
    stockActionBatchNumber: byId("stockActionBatchNumber"),
    stockActionBatchNumberLabel: byId("stockActionBatchNumberLabel"),
    stockActionExpiryDate: byId("stockActionExpiryDate"),
    stockActionExpiryDateLabel: byId("stockActionExpiryDateLabel"),
    batchDetailsModal: byId("batchDetailsModal"),
    batchDetailsModalTitle: byId("batchDetailsModalTitle"),
    batchDetailsMedicineName: byId("batchDetailsMedicineName"),
    batchDetailsMedicineMeta: byId("batchDetailsMedicineMeta"),
    batchDetailsTotalStock: byId("batchDetailsTotalStock"),
    batchDetailsTableBody: byId("batchDetailsTableBody"),
    batchHistoryToggleBtn: byId("batchHistoryToggleBtn"),
    batchHistoryToggleIcon: byId("batchHistoryToggleIcon"),
    batchHistoryToggleLabel: byId("batchHistoryToggleLabel"),
    batchDetailsCountHint: byId("batchDetailsCountHint"),
    batchDetailsExhaustedToggleContainer: byId("batchDetailsExhaustedToggleContainer"),
    dispenseResidentSection: byId("dispenseResidentSection"),
    selectedResidentId: byId("selectedResidentId"),
    residentLookupInput: byId("residentLookupInput"),
    residentLookupResults: byId("residentLookupResults"),
    selectedResidentCard: byId("selectedResidentCard"),
    selectedResidentName: byId("selectedResidentName"),
    selectedResidentMeta: byId("selectedResidentMeta"),
    clearSelectedResidentBtn: byId("clearSelectedResidentBtn"),
    toggleQuickResidentBtn: byId("toggleQuickResidentBtn"),
    quickResidentFields: byId("quickResidentFields"),
    quickResidentName: byId("quickResidentName"),
    quickResidentBarangay: byId("quickResidentBarangay"),
    quickResidentCity: byId("quickResidentCity"),
    disposeConfirmModal: byId("disposeConfirmModal"),
    disposeConfirmMedicineName: byId("disposeConfirmMedicineName"),
    disposeConfirmTotalQty: byId("disposeConfirmTotalQty"),
    disposeConfirmBatchList: byId("disposeConfirmBatchList"),
    disposeConfirmReason: byId("disposeConfirmReason"),
    disposeConfirmStockAdjustment: byId("disposeConfirmStockAdjustment"),
    disposeConfirmSubmitBtn: byId("disposeConfirmSubmitBtn"),
    medicineModalBatchNumberGroup: byId("medicineModalBatchNumberGroup"),
    medicineModalExpiryDateGroup: byId("medicineModalExpiryDateGroup"),
    medicineModalMultiBatchBanner: byId("medicineModalMultiBatchBanner"),
    medicineModalBatchCount: byId("medicineModalBatchCount"),
    medicineModalManageBatchesBtn: byId("medicineModalManageBatchesBtn"),
    editBatchModal: byId("editBatchModal"),
    editBatchForm: byId("editBatchForm"),
    editBatchMedicineId: byId("editBatchMedicineId"),
    editBatchId: byId("editBatchId"),
    editBatchMedicineName: byId("editBatchMedicineName"),
    editBatchQuantity: byId("editBatchQuantity"),
    editBatchSource: byId("editBatchSource"),
    editBatchNumber: byId("editBatchNumber"),
    editBatchExpiryDate: byId("editBatchExpiryDate"),
    editBatchFeedback: byId("editBatchFeedback"),
    editBatchCancelBtn: byId("editBatchCancelBtn"),
    editBatchSubmitBtn: byId("editBatchSubmitBtn")
  };

  const medicineModal = byId("medicineModal") && window.bootstrap ? new window.bootstrap.Modal(byId("medicineModal")) : null;
  const stockActionModal = byId("stockActionModal") && window.bootstrap ? new window.bootstrap.Modal(byId("stockActionModal")) : null;
  const batchDetailsModal = byId("batchDetailsModal") && window.bootstrap ? new window.bootstrap.Modal(byId("batchDetailsModal")) : null;
  const recordStatusModalEl = byId("recordStatusModal");
  const recordStatusModal = recordStatusModalEl && window.bootstrap ? new window.bootstrap.Modal(recordStatusModalEl) : null;
  const disposeConfirmModal = byId("disposeConfirmModal") && window.bootstrap ? new window.bootstrap.Modal(byId("disposeConfirmModal")) : null;
  const editBatchModal = byId("editBatchModal") && window.bootstrap ? new window.bootstrap.Modal(byId("editBatchModal")) : null;
  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    inventory: [],
    inventoryBatches: [],
    movements: [],
    residentAccounts: [],
    choRequests: [],
    activityLogs: [],
    users: [],
    sessions: [],
    householdResidentsLoaded: false
  };

  const uiState = {
    search: "",
    category: "all",
    status: "all"
  };

  const dispenseState = {
    residentSearch: "",
    selectedResidentId: "",
    quickResidentOpen: false
  };

  let currentBatchDetailsMedicine = null;
  let batchDetailsViewingHistory = false;
  let currentEditingBatch = null;
  let batchEditSaved = false;

  let alertTimer = 0;
  let inventoryHydrationPromise = null;
  let inventoryExpectedVersions = {};
  let stockActionOperationId = "";
  let stockActionSaving = false;

  const nowIso = () => new Date().toISOString();
  const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();
  const titleCase = (value) => {
    const normalized = text(value).toLowerCase();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "";
  };
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const DOSAGE_FORM_UNIT_MAP = {
    Tablet: "tablets",
    Capsule: "capsules",
    Syrup: "bottles",
    Inhaler: "inhalers",
    Injection: "vials",
    Cream: "tubes",
    Sachet: "sachets"
  };
  const normalizeMedicineCategory = (value) => {
    const normalized = keyOf(value);
    if (!normalized) return "Others";
    if (["vitamin", "vitamins", "supplement", "supplements"].includes(normalized)) return "Vitamins";
    if (["antibiotic", "antibiotics"].includes(normalized)) return "Antibiotics";
    if (["antihistamine", "antihistamines"].includes(normalized)) return "Antihistamine";
    if (["analgesic", "analgesics", "antipyretic"].includes(normalized)) return "Analgesic";
    if (["hydration", "antidiarrheal", "rehydration"].includes(normalized)) return "Hydration";
    if (["gastrointestinal", "antacid"].includes(normalized)) return "Gastrointestinal";
    if (["anthelmintic", "deworming"].includes(normalized)) return "Anthelmintic";
    if (["antihypertensive", "hypertension"].includes(normalized)) return "Antihypertensive";
    if (["antidiabetic", "diabetes"].includes(normalized)) return "Antidiabetic";
    if (["lipid-lowering", "cholesterol"].includes(normalized)) return "Lipid-Lowering";
    if (["maternal", "prenatal"].includes(normalized)) return "Maternal";
    if (["topical", "dermatological", "skin"].includes(normalized)) return "Topical";
    if (["eye & ear", "eye and ear", "ophthalmic", "otic"].includes(normalized)) return "Eye & Ear";
    if (["family planning", "reproductive"].includes(normalized)) return "Family Planning";
    if (["maintenance", "respiratory", "herbal", "others"].includes(normalized)) {
      return titleCase(normalized);
    }
    return text(value) || "Others";
  };
  const normalizeDosageForm = (value) => {
    const normalized = keyOf(value);
    if (!normalized) return "Tablet";
    if (["tablet", "tablets"].includes(normalized)) return "Tablet";
    if (["capsule", "capsules"].includes(normalized)) return "Capsule";
    if (["syrup", "syrups"].includes(normalized)) return "Syrup";
    if (["inhaler", "inhalers"].includes(normalized)) return "Inhaler";
    if (["injection", "injections"].includes(normalized)) return "Injection";
    if (["cream", "creams", "ointment", "ointments"].includes(normalized)) return "Cream";
    if (["sachet", "sachets"].includes(normalized)) return "Sachet";
    if (["other", "others"].includes(normalized)) return "Others";
    return text(value);
  };
  const normalizeRecordStatus = (value) => keyOf(value) === "archived" ? "archived" : "active";
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
  const formatCurrency = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const medicineFormIconMarkup = (value) => {
    const form = normalizeDosageForm(value);
    const iconPaths = {
      Tablet: '<circle cx="12" cy="12" r="7.5"/><path d="M7 12h10"/>',
      Capsule: '<path d="m10.4 4.6-5.8 5.8a5 5 0 0 0 7.1 7.1l5.8-5.8a5 5 0 0 0-7.1-7.1Z"/><path d="m8 8 8 8"/>',
      Syrup: '<path d="M9 3h6v4l2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9l2-2V3Z"/><path d="M9 11h8M10 3h4"/>',
      Inhaler: '<path d="M9 3h6v10H9Z"/><path d="M8 13h8v3h3v5h-9a2 2 0 0 1-2-2Z"/><path d="M11 6h2"/>',
      Injection: '<path d="m15 4 5 5M17.5 1.5l5 5M18 6l2.5-2.5M4 20l5-5"/><path d="m6 13 5 5 7-7-5-5Z"/><path d="m8 11 5 5"/>',
      Cream: '<path d="M8 3h8l1 12-5 6-5-6L8 3Z"/><path d="M8.5 7h7M10 18h4"/>',
      Sachet: '<path d="M7 3h10l1 18H6L7 3Z"/><path d="M8 7h8M9 16h6"/>',
      Others: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'
    };
    const icon = iconPaths[form] || iconPaths.Others;
    return `<svg class="inventory-medicine-icon__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icon}</svg>`;
  };
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const todayInputValue = () => {
    const current = new Date();
    const offset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - offset).toISOString().slice(0, 10);
  };

  if (refs.stockActionDate) refs.stockActionDate.value = todayInputValue();

  const pluralize = (value, singular, plural = `${singular}s`) => `${value} ${value === 1 ? singular : plural}`;

  const daysUntil = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / 86400000);
  };

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
      const message = String(payload.message || "Unable to sync medicine inventory right now.");
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const currentUserRecord = () => {
    const authId = text(currentAuthUser?.id);
    return state.users.find((user) => text(user.id) === authId) || currentAuthUser || null;
  };

  const actorName = () => text(currentUserRecord()?.fullName) || "Nurse-in-Charge";
  const actorUsername = () => text(currentUserRecord()?.username) || "admin";
  const currentActorIp = () => {
    const currentUser = currentUserRecord();
    const session = currentUser
      ? state.sessions.find((entry) => text(entry.userId) === text(currentUser.id))
      : null;
    return text(session?.ipAddress) || "127.0.0.1";
  };

  const emitInventoryNotificationRefresh = () => {
    window.dispatchEvent(new CustomEvent("mss:inventory-updated"));
  };

  const NOTICE_THEME = {
    success: {
      title: "Saved",
      icon: "bi-check2-circle",
      accent: "#2f8f24",
      accentSoft: "rgba(47, 143, 36, 0.16)",
      border: "rgba(171, 214, 164, 0.92)",
      text: "#17331a"
    },
    info: {
      title: "Notice",
      icon: "bi-info-circle",
      accent: "#2f6ea3",
      accentSoft: "rgba(47, 110, 163, 0.16)",
      border: "rgba(153, 198, 230, 0.92)",
      text: "#183b57"
    },
    warning: {
      title: "Warning",
      icon: "bi-exclamation-triangle",
      accent: "#c78712",
      accentSoft: "rgba(199, 135, 18, 0.16)",
      border: "rgba(233, 205, 143, 0.95)",
      text: "#68470c"
    },
    danger: {
      title: "Unable to Save",
      icon: "bi-x-circle",
      accent: "#c63d3d",
      accentSoft: "rgba(198, 61, 61, 0.16)",
      border: "rgba(233, 171, 171, 0.95)",
      text: "#6b1e1e"
    }
  };

  const ensureNoticePortal = () => {
    const host = refs.moduleAlert;
    if (!host) return null;

    if (host.parentElement !== document.body) {
      document.body.appendChild(host);
    }

    if (host.dataset.modalReady === "true") {
      return {
        host,
        card: host.querySelector("[data-notice-card]"),
        icon: host.querySelector("[data-notice-icon]"),
        title: host.querySelector("[data-notice-title]"),
        message: host.querySelector("[data-notice-message]")
      };
    }

    host.dataset.modalReady = "true";
    host.className = "";
    host.textContent = "";
    host.setAttribute("role", "status");
    host.setAttribute("aria-live", "polite");
    Object.assign(host.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2000",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "rgba(16, 33, 18, 0.18)",
      opacity: "0",
      visibility: "hidden",
      pointerEvents: "none",
      transition: "opacity 0.18s ease, visibility 0.18s ease"
    });

    const card = document.createElement("div");
    card.dataset.noticeCard = "true";
    Object.assign(card.style, {
      width: "min(420px, calc(100vw - 32px))",
      padding: "24px 22px",
      borderRadius: "24px",
      background: "rgba(255, 255, 255, 0.98)",
      border: "1px solid rgba(171, 214, 164, 0.92)",
      boxShadow: "0 24px 52px rgba(22, 54, 23, 0.24)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "10px",
      textAlign: "center",
      transform: "translateY(10px) scale(0.96)",
      transition: "transform 0.18s ease"
    });

    const icon = document.createElement("div");
    icon.dataset.noticeIcon = "true";
    icon.setAttribute("aria-hidden", "true");
    Object.assign(icon.style, {
      width: "62px",
      height: "62px",
      borderRadius: "999px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "1.7rem",
      background: "rgba(47, 143, 36, 0.16)",
      color: "#2f8f24"
    });

    const title = document.createElement("h5");
    title.dataset.noticeTitle = "true";
    Object.assign(title.style, {
      margin: "0",
      fontFamily: "'Sora', sans-serif",
      fontSize: "1.08rem",
      fontWeight: "700",
      color: "#17331a"
    });

    const message = document.createElement("p");
    message.dataset.noticeMessage = "true";
    Object.assign(message.style, {
      margin: "0",
      color: "#4d5f4c",
      fontSize: "0.95rem",
      fontWeight: "600",
      lineHeight: "1.5"
    });

    card.append(icon, title, message);
    host.appendChild(card);

    return { host, card, icon, title, message };
  };

  const hideNotice = () => {
    const notice = ensureNoticePortal();
    if (!notice) return;
    notice.host.style.opacity = "0";
    notice.host.style.visibility = "hidden";
    notice.card.style.transform = "translateY(10px) scale(0.96)";
  };

  const showNotice = (message, type = "success") => {
    const notice = ensureNoticePortal();
    if (!notice) return;
    const theme = NOTICE_THEME[type] || NOTICE_THEME.success;

    notice.icon.innerHTML = `<i class="bi ${theme.icon}"></i>`;
    notice.title.textContent = theme.title;
    notice.message.textContent = message;
    notice.card.style.borderColor = theme.border;
    notice.card.style.color = theme.text;
    notice.icon.style.color = theme.accent;
    notice.icon.style.background = theme.accentSoft;
    notice.title.style.color = theme.text;

    window.clearTimeout(alertTimer);
    window.requestAnimationFrame(() => {
      notice.host.style.opacity = "1";
      notice.host.style.visibility = "visible";
      notice.card.style.transform = "translateY(0) scale(1)";
    });
    alertTimer = window.setTimeout(hideNotice, 1800);
  };

  const initializeInventoryActionDropdowns = () => {
    if (!window.bootstrap?.Dropdown || !refs.inventoryTableBody) return;
    refs.inventoryTableBody
      .querySelectorAll(".inventory-action-toggle[data-bs-toggle='dropdown']")
      .forEach((toggle) => {
        window.bootstrap.Dropdown.getOrCreateInstance(toggle, {
          boundary: "viewport",
          popperConfig(defaultConfig) {
            const modifiers = Array.isArray(defaultConfig?.modifiers) ? defaultConfig.modifiers : [];
            return {
              ...defaultConfig,
              strategy: "fixed",
              modifiers: modifiers.map((modifier) => {
                if (modifier.name === "flip" || modifier.name === "preventOverflow") {
                  return {
                    ...modifier,
                    options: {
                      ...(modifier.options || {}),
                      boundary: "viewport"
                    }
                  };
                }
                return modifier;
              })
            };
          }
        });
      });
  };

  const confirmMedicineRecordStatusChange = ({
    title,
    message,
    hint,
    confirmLabel,
    confirmButtonClass,
    iconClass,
    tone,
    fallbackMessage
  }) => {
    if (
      !recordStatusModal
      || !recordStatusModalEl
      || !refs.recordStatusModalTitle
      || !refs.recordStatusModalMessage
      || !refs.recordStatusModalHint
      || !refs.recordStatusModalIcon
      || !refs.recordStatusModalIconGlyph
      || !refs.recordStatusModalConfirmBtn
    ) {
      return Promise.resolve(window.confirm(fallbackMessage || message || "Please confirm this action."));
    }

    refs.recordStatusModalTitle.textContent = text(title) || "Confirm action";
    refs.recordStatusModalMessage.textContent = text(message) || "Please confirm this action.";
    refs.recordStatusModalHint.textContent = text(hint);
    refs.recordStatusModalHint.classList.toggle("d-none", !text(hint));
    refs.recordStatusModalIcon.className = `inventory-confirm-modal__icon inventory-confirm-modal__icon--${text(tone) || "archive"}`;
    refs.recordStatusModalIconGlyph.className = `bi ${text(iconClass) || "bi-question-circle-fill"}`;
    refs.recordStatusModalConfirmBtn.className = `btn btn-modern ${text(confirmButtonClass) || "btn-primary"}`;
    refs.recordStatusModalConfirmBtn.textContent = text(confirmLabel) || "Confirm";

    return new Promise((resolve) => {
      let settled = false;

      const finalize = (value) => {
        if (settled) return;
        settled = true;
        refs.recordStatusModalConfirmBtn.removeEventListener("click", handleConfirm);
        recordStatusModalEl.removeEventListener("hidden.bs.modal", handleHidden);
        recordStatusModalEl.removeEventListener("shown.bs.modal", handleShown);
        resolve(Boolean(value));
      };

      const handleConfirm = () => {
        finalize(true);
        recordStatusModal.hide();
      };

      const handleHidden = () => {
        finalize(false);
      };

      const handleShown = () => {
        refs.recordStatusModalConfirmBtn.focus();
      };

      refs.recordStatusModalConfirmBtn.addEventListener("click", handleConfirm);
      recordStatusModalEl.addEventListener("hidden.bs.modal", handleHidden);
      recordStatusModalEl.addEventListener("shown.bs.modal", handleShown);
      recordStatusModal.show();
    });
  };

  const confirmDisposalAction = ({
    medicine,
    totalQty,
    batchItems = [],
    reason,
    stockBefore,
    stockAfter
  }) => {
    const modalEl = byId("disposeConfirmModal");
    const modalInstance = modalEl && window.bootstrap
      ? (window.bootstrap.Modal.getOrCreateInstance ? window.bootstrap.Modal.getOrCreateInstance(modalEl) : (disposeConfirmModal || new window.bootstrap.Modal(modalEl)))
      : null;

    if (
      !modalInstance
      || !modalEl
      || !refs.disposeConfirmMedicineName
      || !refs.disposeConfirmTotalQty
      || !refs.disposeConfirmBatchList
      || !refs.disposeConfirmReason
      || !refs.disposeConfirmStockAdjustment
      || !refs.disposeConfirmSubmitBtn
    ) {
      return Promise.resolve(window.confirm(`Are you sure you want to dispose ${formatNumber(totalQty)} ${medicine?.unit || "units"} of ${medicineLabel(medicine)}? This action cannot be undone.`));
    }

    refs.disposeConfirmMedicineName.textContent = medicineLabel(medicine);
    refs.disposeConfirmTotalQty.textContent = `${formatNumber(totalQty)} ${medicine?.unit || "units"}`;
    refs.disposeConfirmReason.textContent = reason || "No reason specified";
    refs.disposeConfirmStockAdjustment.textContent = `${formatNumber(stockBefore)} → ${formatNumber(stockAfter)} ${medicine?.unit || "units"}`;

    if (refs.disposeConfirmSubmitBtn) {
      refs.disposeConfirmSubmitBtn.disabled = false;
      refs.disposeConfirmSubmitBtn.innerHTML = `<i class="bi bi-trash3-fill me-1"></i>Confirm Disposal`;
    }

    if (batchItems && batchItems.length > 0) {
      refs.disposeConfirmBatchList.innerHTML = batchItems.map(({ batch, quantity }) => {
        const days = daysUntil(batch.expiryDate);
        const isExpired = days < 0;
        const expiryLabel = isExpired ? `Expired (${Math.abs(days)}d ago)` : `Exp: ${batch.expiryDate}`;
        const badgeClass = isExpired ? "badge bg-danger text-white" : "badge bg-light text-dark border";
        return `
          <div class="dispose-confirm-batch-item">
            <div>
              <span class="fw-bold text-dark">${esc(batch.batchNumber || "No Batch")}</span>
              <span class="${badgeClass} ms-1" style="font-size:0.75rem;">${esc(expiryLabel)}</span>
            </div>
            <span class="fw-bold text-danger">-${formatNumber(quantity)} ${esc(medicine?.unit || "units")}</span>
          </div>
        `;
      }).join("");
    } else {
      refs.disposeConfirmBatchList.innerHTML = `
        <div class="text-muted small fst-italic py-1">
          Stock deduction without batch tracking (${formatNumber(totalQty)} ${esc(medicine?.unit || "units")})
        </div>
      `;
    }

    return new Promise((resolve) => {
      let settled = false;

      const finalize = (value) => {
        if (settled) return;
        settled = true;
        refs.disposeConfirmSubmitBtn?.removeEventListener("click", handleConfirm);
        modalEl.removeEventListener("hidden.bs.modal", handleHidden);
        modalEl.removeEventListener("shown.bs.modal", handleShown);

        if (!value) {
          // If cancelled, re-open stockActionModal so the user returns to the form with all their inputs intact
          setTimeout(() => {
            stockActionModal?.show();
          }, 50);
        }
        resolve(Boolean(value));
      };

      const handleConfirm = () => {
        if (refs.disposeConfirmSubmitBtn) {
          refs.disposeConfirmSubmitBtn.disabled = true;
          refs.disposeConfirmSubmitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Disposing...`;
        }
        finalize(true);
        modalInstance.hide();
      };

      const handleHidden = () => {
        finalize(false);
      };

      const handleShown = () => {
        refs.disposeConfirmSubmitBtn?.focus();
      };

      refs.disposeConfirmSubmitBtn?.addEventListener("click", handleConfirm);
      modalEl.addEventListener("hidden.bs.modal", handleHidden);
      modalEl.addEventListener("shown.bs.modal", handleShown);

      // Hide stockActionModal first, then show disposeConfirmModal once it's completely hidden
      const stockModalEl = byId("stockActionModal");
      if (stockModalEl && stockModalEl.classList.contains("show")) {
        const onStockModalHidden = () => {
          modalInstance.show();
        };
        stockModalEl.addEventListener("hidden.bs.modal", onStockModalHidden, { once: true });
        stockActionModal?.hide();
      } else {
        modalInstance.show();
      }
    });
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

  const normalizeMedicine = (entry = {}) => {
    const parsedExpiry = new Date(text(entry.expiryDate));
    const safeExpiry = Number.isNaN(parsedExpiry.getTime())
      ? new Date(Date.now() + (180 * 86400000)).toISOString().slice(0, 10)
      : parsedExpiry.toISOString().slice(0, 10);
    const normalizedForm = normalizeDosageForm(entry.form);

    return {
      id: text(entry.id) || uid(),
      name: text(entry.name),
      genericName: text(entry.genericName),
      category: normalizeMedicineCategory(entry.category),
      form: normalizedForm,
      strength: text(entry.strength),
      stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
      reorderLevel: Math.max(1, Math.round(numeric(entry.reorderLevel) || 1)),
      unit: text(entry.unit) || DOSAGE_FORM_UNIT_MAP[normalizedForm] || "units",
      batchNumber: text(entry.batchNumber).toUpperCase() || "-",
      expiryDate: safeExpiry,
      unitCost: Number(numeric(entry.unitCost).toFixed(2)),
      recordStatus: normalizeRecordStatus(entry.recordStatus || entry.record_status),
      updatedBy: text(entry.updatedBy) || actorName(),
      lastUpdatedAt: text(entry.lastUpdatedAt) || nowIso(),
      batches: Array.isArray(entry.batches) ? entry.batches.map(normalizeBatch) : [],
      activeBatchesCount: typeof entry.activeBatchesCount === "number" ? entry.activeBatchesCount : 0
    };
  };

  const normalizeBatch = (entry = {}) => ({
    id: text(entry.id) || `batch_${uid()}`,
    medicineId: text(entry.medicineId || entry.medicine_id),
    batchNumber: text(entry.batchNumber || entry.batch_number).toUpperCase() || "-",
    expiryDate: text(entry.expiryDate || entry.expiry_date),
    quantityReceived: Math.max(0, Math.round(numeric(entry.quantityReceived || entry.quantity_received))),
    quantityRemaining: Math.max(0, Math.round(numeric(entry.quantityRemaining || entry.quantity_remaining))),
    receivedDate: text(entry.receivedDate || entry.received_date) || todayInputValue(),
    sourceType: text(entry.sourceType || entry.source_type) || "initial",
    sourceReference: text(entry.sourceReference || entry.source_reference),
    status: text(entry.status) || "active",
    createdAt: text(entry.createdAt || entry.created_at) || nowIso(),
    updatedAt: text(entry.updatedAt || entry.updated_at) || nowIso()
  });

  const normalizeMovement = (entry = {}) => ({
    id: text(entry.id) || uid(),
    medicineId: text(entry.medicineId),
    medicineName: text(entry.medicineName),
    batchId: text(entry.batchId || entry.batch_id),
    batchNumber: text(entry.batchNumber || entry.batch_number),
    batchExpiry: text(entry.batchExpiry || entry.batch_expiry),
    actionType: text(entry.actionType) || "adjusted",
    quantity: Math.max(0, Math.round(numeric(entry.quantity))),
    note: text(entry.note) || "Inventory movement recorded.",
    stockBefore: Math.max(0, Math.round(numeric(entry.stockBefore))),
    stockAfter: Math.max(0, Math.round(numeric(entry.stockAfter))),
    createdAt: text(entry.createdAt) || nowIso(),
    user: text(entry.user) || actorName(),
    recipientId: text(entry.recipientId),
    recipientName: text(entry.recipientName),
    recipientBarangay: text(entry.recipientBarangay),
    releasedByRole: text(entry.releasedByRole),
    releasedByName: text(entry.releasedByName),
    releasedByUserId: text(entry.releasedByUserId),
    linkedRequestId: text(entry.linkedRequestId || entry.requestId || entry.linkedRequestItemId),
    linkedRequestItemId: text(entry.linkedRequestItemId || entry.linkedRequestId || entry.requestId),
    linkedRequestGroupId: text(entry.linkedRequestGroupId || entry.requestGroupId),
    linkedRequestCode: text(entry.linkedRequestCode || entry.requestCode)
  });

  const normalizeResidentAccount = (entry = {}) => ({
    id: text(entry.id) || text(entry.residentId) || text(entry.resident_id) || uid(),
    residentId: text(entry.residentId) || text(entry.resident_id) || `MSR-${new Date().getFullYear()}-${uid().slice(-4).toUpperCase()}`,
    householdId: text(entry.householdId) || text(entry.household_id),
    fullName: text(entry.fullName) || text(entry.full_name) || "Resident Account",
    barangay: text(entry.barangay) || "Cabarian",
    zone: text(entry.zone),
    city: text(entry.city) || "Ligao City",
    province: text(entry.province) || "Albay",
    address: text(entry.address),
    source: text(entry.source) || "medicine-system",
    lastDispensedAt: text(entry.lastDispensedAt),
    lastDispensedMedicine: text(entry.lastDispensedMedicine)
  });

  const normalizeActivityLog = (entry = {}) => ({
    id: text(entry.id) || uid(),
    actor: text(entry.actor) || actorName(),
    username: text(entry.username) || actorUsername(),
    action: text(entry.action) || "Updated inventory",
    actionType: text(entry.actionType) || "updated",
    target: text(entry.target),
    details: text(entry.details),
    category: text(entry.category) || "Inventory",
    resultLabel: text(entry.resultLabel) || "Success",
    resultTone: text(entry.resultTone) || "success",
    ipAddress: text(entry.ipAddress) || currentActorIp(),
    createdAt: text(entry.createdAt) || nowIso()
  });

  const residentAddressLabel = (resident) => [
    text(resident.zone),
    text(resident.barangay),
    text(resident.city)
  ].filter(Boolean).join(", ");

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;
  const isArchivedMedicine = (medicine) => normalizeRecordStatus(medicine?.recordStatus) === "archived";
  const isActiveMedicine = (medicine) => !isArchivedMedicine(medicine);
  const activeInventory = () => state.inventory.filter(isActiveMedicine);
  const inventoryIdentityPart = (value) => text(value).replace(/\s+/g, " ").toLowerCase();
  const inventoryIdentityKey = (medicine = {}) => [
    inventoryIdentityPart(medicine.name),
    inventoryIdentityPart(normalizeDosageForm(medicine.form)),
    inventoryIdentityPart(medicine.strength)
  ].join("|");
  const inventoryIdentityLabel = (medicine = {}) => {
    const label = medicineLabel(medicine) || text(medicine.name) || "This medicine";
    const form = normalizeDosageForm(medicine.form);
    return form ? `${label} (${form})` : label;
  };
  const findDuplicateInventoryMedicine = (candidate) => {
    const candidateKey = inventoryIdentityKey(candidate);
    return state.inventory.find((medicine) => medicine.id !== candidate.id && inventoryIdentityKey(medicine) === candidateKey) || null;
  };
  const LEGACY_SEED_INVENTORY_KEYS = new Set([
    "paracetamol|pcm-2026-041",
    "amoxicillin|amx-2026-013",
    "cetirizine|ctz-2026-020",
    "ors|ors-2026-115",
    "lagundi|lgd-2026-018",
    "zinc sulfate|znc-2026-006",
    "metformin|mtf-2026-044",
    "salbutamol|slb-2026-017",
    "amlodipine|aml-2026-008"
  ]);

  const legacySeedInventoryKey = (medicine) => `${keyOf(medicine?.name)}|${keyOf(medicine?.batchNumber)}`;
  const isLegacySeedInventory = (inventory = []) => inventory.length === LEGACY_SEED_INVENTORY_KEYS.size
    && inventory.every((medicine) => LEGACY_SEED_INVENTORY_KEYS.has(legacySeedInventoryKey(medicine)));

  const saveState = () => {
    if (!supplyMonitoring) return;
    supplyMonitoring.setState({
      inventory: state.inventory,
      movements: state.movements,
      requests: state.choRequests
    });
  };

  const appendActivityLog = ({
    actor = actorName(),
    username = actorUsername(),
    action = "Updated inventory",
    actionType = "updated",
    target = "",
    details = "",
    category = "Inventory",
    resultLabel = "Success",
    resultTone = "success",
    createdAt = nowIso(),
    ipAddress = currentActorIp()
  }) => {
    state.activityLogs.unshift(normalizeActivityLog({
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
    }));
    state.activityLogs = state.activityLogs
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
      .slice(0, 60);
  };

  const syncStateFromServer = (serverState = {}) => {
    state.users = Array.isArray(serverState.users) ? serverState.users : state.users;
    state.sessions = Array.isArray(serverState.sessions) ? serverState.sessions : state.sessions;
    state.activityLogs = Array.isArray(serverState.logs)
      ? serverState.logs.map(normalizeActivityLog).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()).slice(0, 60)
      : state.activityLogs;
    if (Array.isArray(serverState.inventory)) {
      inventoryExpectedVersions = Object.fromEntries(serverState.inventory
        .map((entry) => [text(entry.id), text(entry.lastUpdatedAt || entry.last_updated_at)])
        .filter(([id, version]) => id && version));
      state.inventory = serverState.inventory.map(normalizeMedicine);
    }
    if (Array.isArray(serverState.inventoryBatches)) {
      state.inventoryBatches = serverState.inventoryBatches.map(normalizeBatch);
    }
    if (Array.isArray(state.inventory) && Array.isArray(state.inventoryBatches) && state.inventoryBatches.length) {
      state.inventory.forEach((med) => {
        const medBatches = (med.batches && med.batches.length)
          ? med.batches
          : state.inventoryBatches.filter((b) => b.medicineId === med.id);
        const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
        if (activeBatches.length > 0) {
          med.stockOnHand = activeBatches.reduce((sum, b) => sum + numeric(b.quantityRemaining), 0);
          const validActiveBatches = activeBatches
            .filter((b) => daysUntil(b.expiryDate) >= 0)
            .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
          const primaryBatch = validActiveBatches.length > 0
            ? validActiveBatches[0]
            : [...activeBatches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
          med.batchNumber = primaryBatch.batchNumber;
          med.expiryDate = primaryBatch.expiryDate;
        }
      });
    }
    state.movements = Array.isArray(serverState.movements)
      ? serverState.movements.map(normalizeMovement)
      : state.movements;
    state.residentAccounts = Array.isArray(serverState.residentAccounts)
      ? serverState.residentAccounts.map(normalizeResidentAccount)
      : state.residentAccounts;

    const serverRequests = Array.isArray(serverState.requests) ? serverState.requests : [];
    state.choRequests = supplyMonitoring
      ? serverRequests.map((entry) => supplyMonitoring.normalizeRequest(entry))
      : serverRequests;
    saveState();
  };

  const cloneEntries = (entries = []) => entries.map((entry) => ({ ...entry }));
  const createStateSnapshot = () => ({
    inventory: cloneEntries(state.inventory),
    inventoryBatches: cloneEntries(state.inventoryBatches),
    movements: cloneEntries(state.movements),
    residentAccounts: cloneEntries(state.residentAccounts),
    activityLogs: cloneEntries(state.activityLogs)
  });

  const restoreStateSnapshot = (snapshot) => {
    if (!snapshot) return;
    state.inventory = snapshot.inventory.map(normalizeMedicine);
    state.inventoryBatches = (snapshot.inventoryBatches || []).map(normalizeBatch);
    state.movements = snapshot.movements.map(normalizeMovement);
    state.residentAccounts = snapshot.residentAccounts.map(normalizeResidentAccount);
    state.activityLogs = snapshot.activityLogs.map(normalizeActivityLog);
    saveState();
  };

  const persistInventoryState = async ({ showSyncError = true } = {}) => {
    saveState();

    try {
      const payload = await requestJson(STATE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          state: {
            inventory: state.inventory,
            inventoryExpectedVersions: { ...inventoryExpectedVersions },
            inventoryBatches: state.inventoryBatches || [],
            movements: state.movements,
            residentAccounts: state.residentAccounts,
            logs: state.activityLogs
          }
        })
      });
      syncStateFromServer(payload.state || {});
      return payload;
    } catch (error) {
      saveState();
      if (showSyncError) throw error;
      console.error("Unable to persist medicine inventory state.", error);
      return null;
    }
  };

  const hydrateInventoryState = async () => {
    if (inventoryHydrationPromise) {
      await inventoryHydrationPromise;
      return;
    }

    inventoryHydrationPromise = (async () => {
      try {
        const payload = await requestJson(`${STATE_ENDPOINT}?t=${Date.now()}`);
        syncStateFromServer(payload?.state || {});
      } catch (error) {
        const fallbackState = supplyMonitoring ? supplyMonitoring.getState() : null;
        if (fallbackState && (fallbackState.inventory.length || fallbackState.movements.length || state.activityLogs.length)) {
          state.inventory = fallbackState.inventory.map(normalizeMedicine);
          state.movements = fallbackState.movements.map(normalizeMovement);
          state.choRequests = supplyMonitoring.readRequests();
          saveState();
          showNotice("Unable to refresh backend inventory data right now. Showing the last synced records on this page.", "warning");
          return;
        }

        syncStateFromServer({});
        showNotice("Unable to load backend inventory data right now.", "danger");
      }
    })();

    try {
      await inventoryHydrationPromise;
    } finally {
      inventoryHydrationPromise = null;
    }
  };

  const nextResidentAccountCode = () => {
    const year = new Date().getFullYear();
    const count = state.residentAccounts.filter((resident) => text(resident.residentId).startsWith(`MSR-${year}-`)).length + 1;
    return `MSR-${year}-${String(count).padStart(4, "0")}`;
  };

  const mergeResidentAccounts = (entries = []) => {
    let changed = false;

    entries.forEach((entry) => {
      const incoming = normalizeResidentAccount(entry);
      const existing = state.residentAccounts.find((resident) =>
        text(resident.residentId).toLowerCase() === text(incoming.residentId).toLowerCase()
        || (
          text(resident.fullName).toLowerCase() === text(incoming.fullName).toLowerCase()
          && text(resident.barangay).toLowerCase() === text(incoming.barangay).toLowerCase()
        )
      );

      if (!existing) {
        state.residentAccounts.push(incoming);
        changed = true;
        return;
      }

      const snapshot = JSON.stringify(existing);
      existing.householdId = existing.householdId || incoming.householdId;
      existing.barangay = existing.barangay || incoming.barangay;
      existing.zone = existing.zone || incoming.zone;
      existing.city = existing.city || incoming.city;
      existing.province = existing.province || incoming.province;
      existing.address = existing.address || incoming.address;
      existing.source = existing.source === "medicine-system" ? existing.source : incoming.source;

      if (JSON.stringify(existing) !== snapshot) {
        changed = true;
      }
    });

    state.residentAccounts.sort((left, right) => text(left.fullName).localeCompare(text(right.fullName)));
    return changed;
  };

  const syncHouseholdResidents = async () => {
    if (state.householdResidentsLoaded) return;
    state.householdResidentsLoaded = true;

    try {
      const items = [];
      let offset = 0;
      let pageCount = 0;

      while (pageCount < 6) {
        const params = new URLSearchParams({
          action: "list_residents",
          limit: "250",
          offset: String(offset)
        });

        const response = await fetch(`${HOUSEHOLD_RESIDENT_API}?${params.toString()}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store"
        });

        let payload = null;
        try {
          payload = await response.json();
        } catch (error) {
          payload = null;
        }

        if (!response.ok || !payload || payload.success !== true) break;

        const pageItems = Array.isArray(payload?.data?.items) ? payload.data.items : [];
        items.push(...pageItems);
        pageCount += 1;

        if (pageItems.length < 250) break;
        offset += 250;
      }

      if (!items.length) return;

      const normalized = items.map((entry) => normalizeResidentAccount({
        resident_id: entry?.resident_id,
        household_id: entry?.household_id,
        full_name: entry?.full_name,
        zone: entry?.zone,
        barangay: "Cabarian",
        city: "Ligao City",
        province: "Albay",
        source: "household-system"
      }));

      if (mergeResidentAccounts(normalized)) {
        saveState();
        await persistInventoryState({ showSyncError: false });
      }

      renderResidentSearchResults();
    } catch (error) {
      // Ignore resident sync failures and keep local resident lookup available.
    }
  };

  const getStatus = (medicine) => {
    if (isArchivedMedicine(medicine)) {
      return { key: "archived", label: "Archived", tone: "olive", note: "Hidden from active workflows" };
    }

    const stock = numeric(medicine.stockOnHand);
    const reorderLevel = Math.max(1, numeric(medicine.reorderLevel));

    const medBatches = (medicine.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);

    let effectiveExpiryDate = medicine.expiryDate;
    let safeReserveStock = 0;

    if (activeBatches.length > 0) {
      const validBatches = activeBatches.filter((b) => daysUntil(b.expiryDate) >= 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      if (validBatches.length > 0) {
        effectiveExpiryDate = validBatches[0].expiryDate;
        safeReserveStock = validBatches
          .filter((b) => daysUntil(b.expiryDate) > 90)
          .reduce((sum, b) => sum + numeric(b.quantityRemaining), 0);
      } else {
        const sortedActive = [...activeBatches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        effectiveExpiryDate = sortedActive[0].expiryDate;
      }
    } else {
      if (daysUntil(medicine.expiryDate) > 90) {
        safeReserveStock = stock;
      }
    }

    const expiryDays = daysUntil(effectiveExpiryDate);

    if (stock <= 0) {
      return { key: "out-of-stock", label: "Out of Stock", tone: "danger", note: "No units on hand" };
    }

    if (expiryDays < 0) {
      return { key: "expiring-soon", label: "Expired", tone: "danger", note: `${Math.abs(expiryDays)} days overdue` };
    }

    // Option A: If safe reserve stock is at or below reorder level and earliest batch expires in <= 90 days,
    // the medicine will soon drop below alert level upon expiry -> Expiring Soon.
    // If safe reserve stock is well above reorder level (> reorderLevel), overall status remains Healthy!
    if (expiryDays <= 90 && safeReserveStock <= reorderLevel) {
      return { key: "expiring-soon", label: "Expiring Soon", tone: "warning", note: `${expiryDays} days remaining` };
    }

    if (stock <= Math.max(5, Math.round(reorderLevel * 0.5))) {
      return { key: "critical", label: "Critical", tone: "danger", note: "Below half of request alert level" };
    }

    if (stock <= reorderLevel) {
      return { key: "low-stock", label: "Low Stock", tone: "warning", note: "At or below request alert level" };
    }

    return { key: "healthy", label: "Healthy", tone: "success", note: "Stock within target range" };
  };

  const reorderQuantity = (medicine) => {
    const target = Math.ceil(Math.max(1, numeric(medicine.reorderLevel)) * 1.8);
    return Math.max(0, target - Math.max(0, numeric(medicine.stockOnHand)));
  };

  const findMedicine = (id) => state.inventory.find((medicine) => medicine.id === id) || null;

  const findResidentAccount = (id) => state.residentAccounts.find((resident) =>
    text(resident.id) === text(id) || text(resident.residentId) === text(id)
  ) || null;

  const linkedRequestRowsForMedicine = (medicine) => {
    if (!medicine || !supplyMonitoring) return [];
    return supplyMonitoring.getLinkableRequestsForMedicine({
      medicineId: medicine.id,
      medicineName: medicineLabel(medicine),
      requests: state.choRequests,
      movements: state.movements
    }).sort((left, right) => {
      const expectedDifference = new Date(left.expectedDate).getTime() - new Date(right.expectedDate).getTime();
      return expectedDifference || new Date(left.requestDate).getTime() - new Date(right.requestDate).getTime();
    });
  };

  const stockRestockSource = () => refs.stockRestockSourceCho?.checked ? "cho" : "manual";

  const stockUnitsMatch = (medicine, requestRow) => (
    keyOf(medicine?.unit) !== ""
    && keyOf(medicine?.unit) === keyOf(requestRow?.unit)
  );

  const selectedLinkedRequestForMedicine = (medicine) => {
    const selectedRequestId = text(refs.stockLinkedRequestId?.value);
    if (!selectedRequestId) return null;
    return linkedRequestRowsForMedicine(medicine).find((row) => text(row.id) === selectedRequestId) || null;
  };

  const setStockActionFeedback = (message = "", tone = "danger") => {
    if (!refs.stockActionFeedback) return;
    refs.stockActionFeedback.textContent = message;
    refs.stockActionFeedback.className = `stock-action-feedback${message ? ` stock-action-feedback--${tone}` : " d-none"}`;
  };

  const readPendingStockDelivery = () => {
    try {
      const value = JSON.parse(sessionStorage.getItem(STOCK_PENDING_DELIVERY_KEY) || "null");
      if (!value || typeof value !== "object" || !text(value.operationId)) return null;
      const createdAt = Number(value.createdAt || 0);
      if (createdAt && Date.now() - createdAt > 86400000) {
        sessionStorage.removeItem(STOCK_PENDING_DELIVERY_KEY);
        return null;
      }
      return value;
    } catch (error) {
      return null;
    }
  };

  const writePendingStockDelivery = (payload) => {
    try {
      sessionStorage.setItem(STOCK_PENDING_DELIVERY_KEY, JSON.stringify({
        ...payload,
        createdAt: Date.now()
      }));
    } catch (error) {
      // The server-side idempotency key still protects the current page session.
    }
  };

  const clearPendingStockDelivery = (operationId = "") => {
    try {
      const pending = readPendingStockDelivery();
      if (!operationId || !pending || text(pending.operationId) === text(operationId)) {
        sessionStorage.removeItem(STOCK_PENDING_DELIVERY_KEY);
      }
    } catch (error) {
      // Ignore unavailable session storage.
    }
  };

  const samePendingStockDelivery = (pending, payload) => Boolean(pending)
    && text(pending.requestGroupId) === text(payload.requestGroupId)
    && text(pending.requestItemId) === text(payload.requestItemId)
    && text(pending.medicineId) === text(payload.medicineId)
    && Number(pending.quantity) === Number(payload.quantity)
    && text(pending.actionDate) === text(payload.actionDate);

  const resetStockActionOperationId = () => {
    if (!stockActionSaving) stockActionOperationId = "";
  };

  const setStockActionSavingState = (saving) => {
    stockActionSaving = saving;
    [
      refs.stockActionType,
      refs.stockActionQuantity,
      refs.stockActionDate,
      refs.stockActionNote,
      refs.stockRestockSourceCho,
      refs.stockRestockSourceManual,
      refs.stockLinkedRequestId,
      refs.stockDisposeSelectAllCheck,
      refs.stockDisposeSelectExpiredBtn
    ].forEach((field) => {
      if (field) field.disabled = saving;
    });
    const batchInputs = refs.stockDisposeBatchTableBody?.querySelectorAll("input") || [];
    batchInputs.forEach((input) => {
      if (input) input.disabled = saving;
    });
    if (refs.stockActionCloseBtn) refs.stockActionCloseBtn.disabled = saving;
    if (refs.stockActionCancelBtn) refs.stockActionCancelBtn.disabled = saving;
    refs.stockActionForm?.setAttribute("aria-busy", saving ? "true" : "false");
    if (saving) {
      if (refs.stockActionSubmitBtn) refs.stockActionSubmitBtn.disabled = true;
    } else {
      updateStockActionInterface();
    }
  };

  const renderLinkedRequestDetails = (medicine, { autofillQuantity = false } = {}) => {
    if (!refs.stockLinkedRequestCard || !refs.stockLinkedRequestHint) return null;
    const availableRows = linkedRequestRowsForMedicine(medicine);
    const selectedRow = selectedLinkedRequestForMedicine(medicine);

    refs.stockLinkedRequestCard.classList.toggle("d-none", !selectedRow);
    if (!selectedRow) {
      refs.stockActionQuantity?.removeAttribute("max");
      refs.stockActionDate?.removeAttribute("min");
      if (refs.stockActionQuantityUnit) refs.stockActionQuantityUnit.textContent = text(medicine?.unit) || "units";
      refs.stockLinkedRequestHint.textContent = availableRows.length
        ? "Select the CHO request that this delivery belongs to."
        : "No open CHO request is currently logged for this medicine.";
      return null;
    }

    const statusLabel = text(selectedRow.statusLabel) || (selectedRow.hasDelivery ? "Partially Delivered" : "Pending Request");
    const statusTone = selectedRow.tone === "danger" ? "danger" : selectedRow.hasDelivery ? "warning" : "pending";
    const unit = text(selectedRow.unit) || text(medicine?.unit) || "units";
    const matchingUnits = stockUnitsMatch(medicine, selectedRow);

    if (refs.stockLinkedRequestCode) refs.stockLinkedRequestCode.textContent = text(selectedRow.requestCode) || "CHO Request";
    if (refs.stockLinkedRequestStatus) {
      refs.stockLinkedRequestStatus.textContent = statusLabel;
      refs.stockLinkedRequestStatus.className = `stock-request-status stock-request-status--${statusTone}`;
    }
    if (refs.stockLinkedRequestedQuantity) {
      refs.stockLinkedRequestedQuantity.textContent = `${formatNumber(selectedRow.quantityRequested)} ${unit}`;
    }
    if (refs.stockLinkedReceivedQuantity) {
      refs.stockLinkedReceivedQuantity.textContent = `${formatNumber(selectedRow.receivedQuantity)} ${unit}`;
    }
    if (refs.stockLinkedRemainingQuantity) {
      refs.stockLinkedRemainingQuantity.textContent = `${formatNumber(selectedRow.remainingQuantity)} ${unit}`;
    }
    if (refs.stockLinkedExpectedDate) refs.stockLinkedExpectedDate.textContent = formatDate(selectedRow.expectedDate);

    refs.stockLinkedRequestHint.textContent = matchingUnits
      ? `Enter up to ${formatNumber(selectedRow.remainingQuantity)} ${unit} for this delivery.`
      : `Unit mismatch: this request uses ${unit}, but the inventory record uses ${text(medicine?.unit) || "units"}. Update the record before receiving.`;
    if (refs.stockActionQuantityUnit) refs.stockActionQuantityUnit.textContent = unit;
    if (refs.stockActionDate) refs.stockActionDate.min = text(selectedRow.requestDate);
    if (refs.stockActionQuantity) {
      refs.stockActionQuantity.max = String(Math.max(1, Math.round(numeric(selectedRow.remainingQuantity))));
      if (autofillQuantity && matchingUnits) refs.stockActionQuantity.value = String(Math.round(numeric(selectedRow.remainingQuantity)));
    }

    return selectedRow;
  };

  const populateLinkedRequestOptions = (medicine, { autoSelect = false } = {}) => {
    if (!refs.stockLinkedRequestId) return [];
    const requestRows = linkedRequestRowsForMedicine(medicine);
    const previousRequestId = text(refs.stockLinkedRequestId.value);
    refs.stockLinkedRequestId.innerHTML = [
      '<option value="">Select an open CHO request</option>',
      ...requestRows.map((row) => `
        <option value="${esc(row.id)}">
          ${esc(row.requestCode)} - ${esc(formatNumber(row.remainingQuantity))} ${esc(row.unit)} remaining
        </option>
      `)
    ].join("");
    refs.stockLinkedRequestId.disabled = !requestRows.length;
    const preservedRequest = requestRows.find((row) => text(row.id) === previousRequestId);
    const shouldAutoSelect = autoSelect && requestRows.length === 1;
    refs.stockLinkedRequestId.value = preservedRequest
      ? previousRequestId
      : shouldAutoSelect
        ? text(requestRows[0].id)
        : "";
    renderLinkedRequestDetails(medicine, { autofillQuantity: shouldAutoSelect });
    return requestRows;
  };

  const projectedChoRequestText = (requestRow, quantity, unit) => {
    const itemBalance = Math.max(0, numeric(requestRow.remainingQuantity) - quantity);
    if (itemBalance > 0) {
      return `${requestRow.requestCode} will remain Partially Delivered with ${formatNumber(itemBalance)} ${unit} remaining for this medicine.`;
    }

    const groupId = text(requestRow.requestGroupId);
    const requestCode = text(requestRow.requestCode);
    const otherOpenItems = supplyMonitoring
      ? supplyMonitoring.hydrateRequests(state.choRequests, state.movements)
        .filter((row) => text(row.id) !== text(requestRow.id))
        .filter((row) => (
          (groupId && text(row.requestGroupId) === groupId)
          || (!groupId && requestCode && text(row.requestCode) === requestCode)
        ))
        .filter((row) => !row.isComplete)
      : [];

    return otherOpenItems.length === 0
      ? `All medicine lines in ${requestRow.requestCode} will be fully delivered.`
      : `This medicine line will be completed. ${otherOpenItems.length} other ${otherOpenItems.length === 1 ? "medicine is" : "medicines are"} still open in ${requestRow.requestCode}.`;
  };

  const stockActionDateError = (linkedRequest = null) => {
    const actionDate = text(refs.stockActionDate?.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(actionDate)) return "Select a valid action date.";
    if (actionDate > todayInputValue()) return "The action date cannot be in the future.";
    if (linkedRequest && actionDate < text(linkedRequest.requestDate)) {
      return `The delivery date cannot be earlier than the ${formatDate(linkedRequest.requestDate)} request date.`;
    }
    return "";
  };

  const updateStockActionPreview = () => {
    if (!refs.stockActionPreview || !refs.stockActionSubmitBtn) return;
    const medicine = findMedicine(text(refs.stockMedicineId?.value));
    const actionType = text(refs.stockActionType?.value) || "restock";

    const medBatches = (medicine?.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine?.id);
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
    const hasBatches = activeBatches.length > 0;

    if (actionType === "dispose" && hasBatches) {
      updateDisposeSummary(medicine);
      return;
    }

    const source = stockRestockSource();
    const quantity = Number(text(refs.stockActionQuantity?.value));
    const validQuantity = Number.isInteger(quantity) && quantity > 0;
    const unit = text(medicine?.unit) || "units";
    const currentStock = Math.max(0, Math.round(numeric(medicine?.stockOnHand)));

    refs.stockActionPreview.className = `stock-action-preview${validQuantity ? "" : " d-none"}`;
    refs.stockActionSubmitBtn.disabled = !validQuantity;
    if (!medicine || !validQuantity) return;

    const isRestock = actionType === "restock";
    const stockAfter = isRestock ? currentStock + quantity : currentStock - quantity;
    const linkedRequest = isRestock && source === "cho" ? selectedLinkedRequestForMedicine(medicine) : null;
    const dateError = stockActionDateError(linkedRequest);
    let tone = "success";
    let previewText = isRestock
      ? "Manual restock; no CHO request status will change."
      : `${formatNumber(Math.max(0, stockAfter))} ${unit} will remain in inventory.`;
    let invalid = false;

    if (dateError) {
      tone = "danger";
      invalid = true;
      previewText = dateError;
    } else if (!isRestock && quantity > currentStock) {
      tone = "danger";
      invalid = true;
      previewText = `Only ${formatNumber(currentStock)} ${unit} are available to dispose.`;
    } else if (!isRestock && !text(refs.stockActionNote?.value)) {
      tone = "warning";
      invalid = true;
      previewText = "Enter the disposal reason before continuing.";
    } else if (isRestock && source === "cho") {
      if (!linkedRequest) {
        tone = "warning";
        invalid = true;
        previewText = "Select an open CHO request for this delivery.";
      } else if (!stockUnitsMatch(medicine, linkedRequest)) {
        tone = "danger";
        invalid = true;
        previewText = `Unit mismatch: the request uses ${linkedRequest.unit}, while inventory uses ${unit}.`;
      } else if (quantity > numeric(linkedRequest.remainingQuantity)) {
        tone = "danger";
        invalid = true;
        previewText = `Quantity exceeds the ${formatNumber(linkedRequest.remainingQuantity)} ${unit} remaining in ${linkedRequest.requestCode}.`;
      } else {
        previewText = projectedChoRequestText(linkedRequest, quantity, unit);
      }
    }

    refs.stockActionPreview.classList.add(`stock-action-preview--${tone}`);
    if (refs.stockActionPreviewTitle) {
      const previewTitle = !isRestock
        ? "Stock after disposal"
        : source === "cho"
          ? "Stock after CHO delivery"
          : "Stock after restock";
      refs.stockActionPreviewTitle.textContent = `${previewTitle}: ${formatNumber(Math.max(0, stockAfter))} ${unit}`;
    }
    if (refs.stockActionPreviewText) refs.stockActionPreviewText.textContent = previewText;
    refs.stockActionSubmitBtn.disabled = invalid;
  };

  const clearQuickResidentFields = () => {
    if (refs.quickResidentName) refs.quickResidentName.value = "";
    if (refs.quickResidentBarangay) refs.quickResidentBarangay.value = "";
    if (refs.quickResidentCity) refs.quickResidentCity.value = "Ligao City";
  };

  const filteredResidentAccounts = () => {
    const query = text(dispenseState.residentSearch).toLowerCase();
    const selectedId = text(dispenseState.selectedResidentId);

    return [...state.residentAccounts]
      .filter((resident) => {
        const haystack = [
          resident.residentId,
          resident.householdId,
          resident.fullName,
          resident.barangay,
          resident.zone,
          resident.city
        ].join(" ").toLowerCase();
        return !query || haystack.includes(query);
      })
      .sort((left, right) => {
        if (text(left.id) === selectedId) return -1;
        if (text(right.id) === selectedId) return 1;
        if (text(left.lastDispensedAt) !== text(right.lastDispensedAt)) {
          return new Date(text(right.lastDispensedAt) || 0).getTime() - new Date(text(left.lastDispensedAt) || 0).getTime();
        }
        return text(left.fullName).localeCompare(text(right.fullName));
      })
      .slice(0, 8);
  };

  const renderSelectedResident = () => {
    const resident = findResidentAccount(dispenseState.selectedResidentId);
    const hasResident = Boolean(resident);
    refs.selectedResidentCard?.classList.toggle("d-none", !hasResident);
    if (!hasResident || !resident) {
      if (refs.selectedResidentId) refs.selectedResidentId.value = "";
      return;
    }

    if (refs.selectedResidentId) refs.selectedResidentId.value = resident.id;
    if (refs.selectedResidentName) refs.selectedResidentName.textContent = resident.fullName;
    if (refs.selectedResidentMeta) {
      const meta = [resident.residentId, residentAddressLabel(resident)].filter(Boolean).join(" | ");
      refs.selectedResidentMeta.textContent = meta || "Resident account";
    }
  };

  const renderResidentSearchResults = () => {
    if (!refs.residentLookupResults || refs.dispenseResidentSection?.classList.contains("d-none")) return;
    const results = filteredResidentAccounts();

    if (!results.length) {
      refs.residentLookupResults.innerHTML = '<div class="inventory-empty">No matching resident account.</div>';
      return;
    }

    refs.residentLookupResults.innerHTML = results.map((resident) => {
      const isActive = text(resident.id) === text(dispenseState.selectedResidentId) ? " is-active" : "";
      const location = residentAddressLabel(resident) || resident.barangay || "Resident account";
      return `
        <button type="button" class="inventory-resident-option${isActive}" data-resident-id="${esc(resident.id)}">
          <div>
            <strong>${esc(resident.fullName)}</strong>
            <span>${esc(resident.residentId)}${text(resident.householdId) ? ` | ${esc(resident.householdId)}` : ""}</span>
            <small>${esc(location)}</small>
          </div>
          <span class="inventory-resident-chip">${esc(resident.source === "household-system" ? "Resident" : "Saved")}</span>
        </button>
      `;
    }).join("");
  };

  const setSelectedResident = (resident) => {
    dispenseState.selectedResidentId = resident?.id || "";
    if (refs.residentLookupInput && resident) {
      refs.residentLookupInput.value = resident.fullName;
    }
    renderSelectedResident();
    renderResidentSearchResults();
  };

  const toggleQuickResidentFields = (forceOpen = null) => {
    dispenseState.quickResidentOpen = typeof forceOpen === "boolean" ? forceOpen : !dispenseState.quickResidentOpen;
    refs.quickResidentFields?.classList.toggle("d-none", !dispenseState.quickResidentOpen);
    if (refs.toggleQuickResidentBtn) {
      refs.toggleQuickResidentBtn.textContent = dispenseState.quickResidentOpen ? "Hide Form" : "New Resident";
    }
    if (!dispenseState.quickResidentOpen) clearQuickResidentFields();
  };

  const updateDisposeSummary = (medicine = null) => {
    if (!medicine) {
      medicine = findMedicine(text(refs.stockMedicineId?.value));
    }
    if (!medicine) return;

    let totalDisposeQty = 0;
    let selectedBatchCount = 0;
    let hasInvalidQty = false;

    const rows = refs.stockDisposeBatchTableBody?.querySelectorAll("tr[data-batch-id]") || [];
    rows.forEach((row) => {
      const check = row.querySelector(".stock-dispose-batch-check");
      const qtyInput = row.querySelector(".stock-dispose-qty-input");
      if (check && check.checked && qtyInput) {
        selectedBatchCount++;
        const remaining = Number(check.dataset.remaining) || 0;
        const qty = Number(qtyInput.value) || 0;
        if (qty <= 0 || qty > remaining || !Number.isInteger(qty)) {
          hasInvalidQty = true;
        }
        totalDisposeQty += qty;
        row.classList.add("stock-dispose-batch-row--selected");
      } else {
        row.classList.remove("stock-dispose-batch-row--selected");
      }
    });

    const currentStock = numeric(medicine.stockOnHand);
    const stockAfter = Math.max(0, currentStock - totalDisposeQty);

    if (refs.stockDisposeTotalCount) {
      refs.stockDisposeTotalCount.textContent = formatNumber(totalDisposeQty);
    }
    if (refs.stockDisposeTotalUnit) {
      refs.stockDisposeTotalUnit.textContent = medicine.unit || "units";
    }
    if (refs.stockDisposeBatchCountBadge) {
      refs.stockDisposeBatchCountBadge.textContent = `${formatNumber(selectedBatchCount)} batch${selectedBatchCount === 1 ? "" : "es"}`;
    }
    if (refs.stockDisposeRemainingStock) {
      refs.stockDisposeRemainingStock.textContent = `${formatNumber(stockAfter)} ${medicine.unit || "units"}`;
    }

    if (refs.stockActionSubmitBtn) {
      const hasReason = text(refs.stockActionNote?.value).trim().length > 0;
      const hasValidSelection = selectedBatchCount > 0 && !hasInvalidQty && totalDisposeQty > 0 && totalDisposeQty <= currentStock;
      refs.stockActionSubmitBtn.disabled = !(hasValidSelection && hasReason);
    }
  };

  const renderDisposeBatchList = (medicine) => {
    if (!refs.stockDisposeBatchTableBody || !medicine) return;

    const medBatches = (medicine.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);

    const activeBatches = medBatches
      .filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0)
      .sort((a, b) => (new Date(a.expiryDate).getTime() || 0) - (new Date(b.expiryDate).getTime() || 0));

    if (refs.stockDisposeSelectAllCheck) {
      refs.stockDisposeSelectAllCheck.checked = false;
    }

    if (activeBatches.length === 0) {
      refs.stockDisposeBatchTableBody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center text-muted py-3">
            No active batches recorded for this medicine.
          </td>
        </tr>
      `;
      updateDisposeSummary(medicine);
      return;
    }

    refs.stockDisposeBatchTableBody.innerHTML = activeBatches.map((batch) => {
      const remaining = numeric(batch.quantityRemaining);
      const days = daysUntil(batch.expiryDate);
      const isExpired = days < 0;
      const isNearExpiry = !isExpired && days <= 60;

      let badgeHtml = "";
      if (isExpired) {
        badgeHtml = `<span class="batch-status-badge batch-status-badge--expired"><i class="bi bi-x-circle me-1"></i>Expired (${Math.abs(days)}d ago)</span>`;
      } else if (isNearExpiry) {
        badgeHtml = `<span class="batch-status-badge batch-status-badge--near-expiry"><i class="bi bi-exclamation-circle me-1"></i>${days}d left</span>`;
      } else {
        badgeHtml = `<span class="batch-status-badge batch-status-badge--active"><i class="bi bi-check2 me-1"></i>Active</span>`;
      }

      const rowClass = isExpired ? "stock-dispose-batch-row--expired" : "";

      return `
        <tr class="${rowClass}" data-batch-id="${esc(batch.id)}">
          <td class="text-center">
            <input
              type="checkbox"
              class="form-check-input stock-dispose-batch-check"
              data-batch-id="${esc(batch.id)}"
              data-is-expired="${isExpired ? '1' : '0'}"
              data-remaining="${remaining}"
            >
          </td>
          <td>
            <div class="fw-bold">${esc(batch.batchNumber || "-")}</div>
            <small class="text-muted">${formatDate(batch.receivedDate || "")}</small>
          </td>
          <td>
            ${badgeHtml}
            <div class="small text-muted">${esc(batch.expiryDate)}</div>
          </td>
          <td class="text-end">
            <span class="fw-bold">${formatNumber(remaining)}</span>
            <small class="text-muted d-block">${esc(medicine.unit)}</small>
          </td>
          <td class="text-end">
            <input
              type="number"
              class="form-control form-control-sm stock-dispose-qty-input ms-auto"
              data-batch-id="${esc(batch.id)}"
              min="1"
              max="${remaining}"
              step="1"
              value=""
              placeholder="0"
              disabled
            >
          </td>
        </tr>
      `;
    }).join("");

    updateDisposeSummary(medicine);
  };

  const updateStockActionInterface = ({ autofillRequest = false } = {}) => {
    const actionType = text(refs.stockActionType?.value).toLowerCase();
    const isDispose = actionType === "dispose";
    const isRestock = actionType === "restock";
    const medicine = findMedicine(text(refs.stockMedicineId?.value));
    const requestRows = medicine ? linkedRequestRowsForMedicine(medicine) : [];

    const medBatches = (medicine?.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine?.id);
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
    const hasBatches = activeBatches.length > 0;

    if (refs.stockActionTypeIcon) {
      refs.stockActionTypeIcon.className = `bi ${isDispose ? "bi-trash3" : "bi-box-arrow-in-down"} stock-action-type-icon${isDispose ? " stock-action-type-icon--dispose" : ""}`;
    }

    if (refs.stockRestockSourceCho) {
      refs.stockRestockSourceCho.disabled = requestRows.length === 0;
      if (refs.stockRestockSourceCho.checked && requestRows.length === 0 && refs.stockRestockSourceManual) {
        refs.stockRestockSourceManual.checked = true;
      }
    }

    const source = stockRestockSource();
    const isChoDelivery = isRestock && source === "cho";
    const isManualRestock = isRestock && source === "manual";

    refs.stockRestockFlow?.classList.toggle("d-none", !isRestock);
    refs.stockActionBatchGroup?.classList.toggle("d-none", !isRestock);
    if (refs.stockActionBatchNumber) refs.stockActionBatchNumber.required = false;
    if (refs.stockActionExpiryDate) refs.stockActionExpiryDate.required = isRestock;
    refs.stockLinkedRequestGroup?.classList.toggle("d-none", !isChoDelivery);
    refs.stockActionNoteGroup?.classList.toggle("d-none", !(isDispose || isManualRestock));
    refs.stockLinkedRequestCard?.classList.toggle("d-none", !isChoDelivery || !text(refs.stockLinkedRequestId?.value));

    // Multi-batch dispose view vs restock quantity
    refs.stockDisposeBatchSection?.classList.toggle("d-none", !isDispose || !hasBatches);
    refs.stockActionQuantityGroup?.classList.toggle("d-none", isDispose && hasBatches);
    if (refs.stockActionQuantity) {
      refs.stockActionQuantity.required = isRestock || (isDispose && !hasBatches);
    }

    if (isDispose && hasBatches) {
      renderDisposeBatchList(medicine);
      refs.stockActionPreview?.classList.add("d-none");
    }

    if (refs.stockRestockSourceHint) {
      refs.stockRestockSourceHint.textContent = requestRows.length === 0
        ? "No open CHO request is available for this medicine. Use Manual Restock."
        : isChoDelivery
          ? "Receiving stock here automatically updates the linked CHO request."
          : "Use Manual Restock for stock that is not tied to a CHO request.";
    }

    if (refs.stockLinkedRequestId) {
      refs.stockLinkedRequestId.disabled = !isChoDelivery || requestRows.length === 0;
      refs.stockLinkedRequestId.required = isChoDelivery;
    }

    if (refs.stockActionNoteLabel) {
      refs.stockActionNoteLabel.textContent = isDispose ? "Disposal reason" : "Source / notes (optional)";
    }

    if (refs.stockActionNote) {
      refs.stockActionNote.required = isDispose;
      refs.stockActionNote.placeholder = isDispose
        ? "Reason for disposal (e.g. Expired stock segregation, damaged packaging, COA write-off)"
        : "Supplier, delivery reference, or optional note";
    }

    if (refs.stockActionModalTitle) {
      refs.stockActionModalTitle.textContent = isDispose
        ? "Dispose Stock"
        : isChoDelivery
          ? "Receive CHO Delivery"
          : "Restock Medicine";
    }
    if (refs.stockActionQuantityLabel) {
      refs.stockActionQuantityLabel.textContent = isDispose
        ? "Quantity to dispose"
        : isChoDelivery
          ? "Quantity received"
          : "Restock quantity";
    }
    if (refs.stockActionDateLabel) {
      refs.stockActionDateLabel.textContent = isDispose
        ? "Disposal date"
        : isChoDelivery
          ? "Delivery date"
          : "Restock date";
    }
    if (refs.stockActionSubmitLabel) {
      refs.stockActionSubmitLabel.textContent = isDispose
        ? "Dispose Stock"
        : isChoDelivery
          ? "Receive Stock"
          : "Add Stock";
    }
    if (refs.stockActionQuantityUnit) refs.stockActionQuantityUnit.textContent = text(medicine?.unit) || "units";
    if (refs.stockActionDate) {
      refs.stockActionDate.max = todayInputValue();
      if (!isChoDelivery) refs.stockActionDate.removeAttribute("min");
    }

    if (refs.stockActionQuantity) {
      if (isDispose) {
        refs.stockActionQuantity.max = String(Math.max(1, Math.round(numeric(medicine?.stockOnHand))));
      } else if (!isChoDelivery) {
        refs.stockActionQuantity.removeAttribute("max");
      }
    }

    if (isChoDelivery) {
      renderLinkedRequestDetails(medicine, { autofillQuantity: autofillRequest });
    }

    if (!isDispose || !hasBatches) {
      updateStockActionPreview();
    }
  };

  const createQuickResidentAccount = () => {
    const fullName = text(refs.quickResidentName?.value);
    const barangay = text(refs.quickResidentBarangay?.value);
    const city = text(refs.quickResidentCity?.value) || "Ligao City";

    if (!fullName || !barangay) return null;

    const resident = normalizeResidentAccount({
      id: uid(),
      residentId: nextResidentAccountCode(),
      fullName,
      barangay,
      city,
      province: "Albay",
      source: "medicine-system"
    });

    mergeResidentAccounts([resident]);
    saveState();
    void persistInventoryState({ showSyncError: false });
    clearQuickResidentFields();
    toggleQuickResidentFields(false);
    const savedResident = state.residentAccounts.find((entry) =>
      text(entry.residentId).toLowerCase() === text(resident.residentId).toLowerCase()
      || (
        text(entry.fullName).toLowerCase() === text(resident.fullName).toLowerCase()
        && text(entry.barangay).toLowerCase() === text(resident.barangay).toLowerCase()
      )
    ) || resident;
    setSelectedResident(savedResident);
    return savedResident;
  };

  const resolveDispenseRecipient = () => {
    const selectedResident = findResidentAccount(dispenseState.selectedResidentId);
    if (selectedResident) return selectedResident;

    const quickResident = createQuickResidentAccount();
    if (quickResident) return quickResident;

    return null;
  };

  const sortedInventory = () => {
    const query = text(uiState.search).toLowerCase();
    const baseInventory = uiState.status === "archived" ? state.inventory.filter(isArchivedMedicine) : activeInventory();
    const filtered = baseInventory.filter((medicine) => {
      const status = getStatus(medicine);
      const haystack = [
        medicine.name,
        medicine.genericName,
        medicine.category,
        medicine.batchNumber,
        medicine.form,
        medicine.strength
      ].join(" ").toLowerCase();

      const matchesQuery = !query || haystack.includes(query);
      const matchesCategory = uiState.category === "all" || medicine.category === uiState.category;
      const hasExpiringBatch = () => {
        const medBatches = (medicine.batches && medicine.batches.length)
          ? medicine.batches
          : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);
        return medBatches.some((b) => b.status === "active" && numeric(b.quantityRemaining) > 0 && daysUntil(b.expiryDate) >= 0 && daysUntil(b.expiryDate) <= 90);
      };
      const matchesStatus = uiState.status === "all"
        || uiState.status === "archived"
        || status.key === uiState.status
        || (uiState.status === "expiring-soon" && hasExpiringBatch());
      return matchesQuery && matchesCategory && matchesStatus;
    });

    filtered.sort((left, right) => {
      return medicineLabel(left).localeCompare(medicineLabel(right));
    });

    return filtered;
  };

  const renderCategoryFilter = () => {
    if (!refs.categoryFilter) return;
    const current = refs.categoryFilter.value || uiState.category;
    const sourceInventory = uiState.status === "archived" ? state.inventory.filter(isArchivedMedicine) : activeInventory();
    const categories = Array.from(new Set(sourceInventory.map((medicine) => medicine.category))).sort();
    refs.categoryFilter.innerHTML = [
      '<option value="all">Category</option>',
      ...categories.map((category) => `<option value="${esc(category)}">${esc(category)}</option>`)
    ].join("");
    refs.categoryFilter.value = categories.includes(current) || current === "all" ? current : "all";
    uiState.category = refs.categoryFilter.value;
  };

  const renderMetrics = () => {
    const inventory = activeInventory();
    const totalMedicines = inventory.length;
    const unitsOnHand = inventory.reduce((total, medicine) => total + numeric(medicine.stockOnHand), 0);
    const lowStock = inventory.filter((medicine) => {
      const status = getStatus(medicine).key;
      return status === "low-stock" || status === "critical" || status === "out-of-stock";
    }).length;
    const expiringSoon = inventory.filter((medicine) => daysUntil(medicine.expiryDate) <= 60).length;

    if (refs.metricTotalMedicines) refs.metricTotalMedicines.textContent = formatNumber(totalMedicines);
    if (refs.metricUnitsOnHand) refs.metricUnitsOnHand.textContent = formatNumber(unitsOnHand);
    if (refs.metricLowStock) refs.metricLowStock.textContent = formatNumber(lowStock);
    if (refs.metricExpiringSoon) refs.metricExpiringSoon.textContent = formatNumber(expiringSoon);
  };

  const renderBatchDetailsRows = (medicine, showExhausted = false) => {
    if (!medicine || !refs.batchDetailsTableBody) return;
    const medBatches = (medicine.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);

    const sortedBatches = [...medBatches].sort((a, b) => {
      const timeA = new Date(a.expiryDate).getTime() || 0;
      const timeB = new Date(b.expiryDate).getTime() || 0;
      return timeA - timeB;
    });

    const exhaustedCount = sortedBatches.filter(
      (b) => b.status === "exhausted" || numeric(b.quantityRemaining) <= 0
    ).length;

    batchDetailsViewingHistory = showExhausted;

    if (refs.batchHistoryToggleBtn) {
      refs.batchHistoryToggleBtn.classList.toggle("is-active", showExhausted);
      refs.batchHistoryToggleBtn.disabled = (exhaustedCount === 0 && !showExhausted);
      refs.batchHistoryToggleBtn.title = exhaustedCount === 0
        ? "No batch history available for this medicine"
        : (showExhausted ? "Switch back to active batches" : "View batch history");
    }
    if (refs.batchHistoryToggleIcon) {
      refs.batchHistoryToggleIcon.className = showExhausted ? "bi bi-layers" : "bi bi-clock-history";
    }
    if (refs.batchHistoryToggleLabel) {
      refs.batchHistoryToggleLabel.textContent = showExhausted ? "Active Batches" : "Batch History";
    }

    let displayBatches = [];
    if (showExhausted) {
      displayBatches = sortedBatches.filter(
        (b) => b.status === "exhausted" || numeric(b.quantityRemaining) <= 0
      );
    } else {
      displayBatches = sortedBatches.filter(
        (b) => b.status !== "exhausted" && numeric(b.quantityRemaining) > 0
      );
    }

    if (refs.batchDetailsCountHint) {
      const recordWord = displayBatches.length === 1 ? "Record" : "Records";
      refs.batchDetailsCountHint.innerHTML = showExhausted
        ? `<i class="bi bi-clock-history me-1 text-primary"></i>${recordWord}: <strong>${displayBatches.length} (History)</strong>`
        : `<i class="bi bi-layers me-1 text-success"></i>${recordWord}: <strong>${displayBatches.length} (Active)</strong>`;
    }

    if (!displayBatches.length) {
      if (showExhausted) {
        refs.batchDetailsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-4">
              <i class="bi bi-info-circle me-1 text-secondary"></i>No exhausted batches recorded for this medicine.
            </td>
          </tr>
        `;
      } else if (!sortedBatches.length) {
        refs.batchDetailsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-4">
              No batch records found for this medicine.
            </td>
          </tr>
        `;
      } else {
        refs.batchDetailsTableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-4">
              <i class="bi bi-info-circle me-1 text-secondary"></i>No active batches with remaining stock. (${exhaustedCount} exhausted batch(es) available in history). Toggle the switch above to view history.
            </td>
          </tr>
        `;
      }
      return;
    }

    const firstValidActiveIndex = displayBatches.findIndex((b) => b.status === "active" && numeric(b.quantityRemaining) > 0 && daysUntil(b.expiryDate) >= 0);
    let activeOrderCounter = 0;
    refs.batchDetailsTableBody.innerHTML = displayBatches.map((batch, idx) => {
      const isExhausted = batch.status === "exhausted" || numeric(batch.quantityRemaining) <= 0;
      const expiryDays = daysUntil(batch.expiryDate);
      const isExpired = expiryDays < 0;
      const isValidNextOut = !isExhausted && !isExpired && idx === firstValidActiveIndex;
      if (!isExhausted && !isExpired) activeOrderCounter += 1;

      let expiryClass = "text-muted";
      let expiryText = `${expiryDays}d left`;
      if (isExpired) {
        expiryClass = "text-danger fw-semibold";
        expiryText = `<i class="bi bi-x-circle me-1"></i>Expired`;
      } else if (expiryDays <= 60) {
        expiryClass = "text-warning-emphasis fw-medium";
        expiryText = `<i class="bi bi-clock-history me-1"></i>${expiryDays}d left`;
      }

      let orderBadge = "";
      if (isExpired && !isExhausted) {
        orderBadge = '<span class="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 rounded-pill text-nowrap fw-semibold"><i class="bi bi-exclamation-triangle me-1"></i>For Disposal</span>';
      } else if (isValidNextOut) {
        orderBadge = '<span class="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill text-nowrap fw-semibold"><i class="bi bi-clock-history me-1"></i>Next Out</span>';
      } else if (!isExhausted) {
        orderBadge = '<span class="badge bg-light text-secondary border px-2.5 py-1 rounded-pill text-nowrap fw-medium">Reserve</span>';
      } else {
        orderBadge = '<span class="badge bg-light text-muted border px-2.5 py-1 rounded-pill text-nowrap">Exhausted</span>';
      }

      const qtyRemaining = numeric(batch.quantityRemaining);
      const qtyReceived = Math.max(1, numeric(batch.quantityReceived));
      const percent = Math.min(100, Math.max(0, Math.round((qtyRemaining / qtyReceived) * 100)));
      const fillClass = isExhausted
        ? "batch-progress-fill--exhausted"
        : (isExpired ? "batch-progress-fill--exhausted" : (isValidNextOut ? "batch-progress-fill--primary" : "batch-progress-fill--reserve"));

      let sourceIcon = "bi-truck text-secondary";
      let sourceName = "CHO Delivery";
      if (batch.sourceType === "donation") {
        sourceIcon = "bi-gift text-success";
        sourceName = "Donation";
      } else if (batch.sourceType === "manual_restock") {
        sourceIcon = "bi-box-seam text-secondary";
        sourceName = "Restock";
      } else if (batch.sourceType !== "cho_delivery") {
        sourceIcon = "bi-archive text-secondary";
        sourceName = "Initial Stock";
      }

      const rowHighlightClass = isValidNextOut
        ? "batch-row-active-dispense"
        : (isExpired && !isExhausted ? "table-danger bg-opacity-10" : (isExhausted ? "text-muted opacity-75" : ""));

      return `
        <tr class="${rowHighlightClass}">
          <td class="text-nowrap">
            ${orderBadge}
          </td>
          <td class="text-nowrap">
            <strong class="font-monospace text-dark text-nowrap">${esc(batch.batchNumber)}</strong>
          </td>
          <td class="text-nowrap">
            <div class="fw-semibold text-dark">${esc(formatDate(batch.expiryDate))}</div>
            <small class="${expiryClass}" style="font-size:0.75rem;">${expiryText}</small>
          </td>
          <td>
            <div style="min-width: 130px;">
              <div class="d-flex align-items-baseline justify-content-between gap-2">
                <strong class="${isExhausted ? "text-muted" : "text-dark"}" style="font-size:0.92rem;">${formatNumber(batch.quantityRemaining)}</strong>
                <span class="text-muted text-nowrap" style="font-size: 0.74rem;">/ ${formatNumber(batch.quantityReceived)} ${esc(medicine.unit)}</span>
              </div>
              <div class="batch-progress-bar" title="${percent}% remaining">
                <div class="batch-progress-fill ${fillClass}" style="width: ${percent}%;"></div>
              </div>
            </div>
          </td>
          <td class="text-nowrap">
            <div class="fw-medium text-dark" style="font-size: 0.82rem;"><i class="bi ${sourceIcon} me-1"></i>${sourceName}</div>
            <small class="text-muted" style="font-size: 0.74rem;">${formatDate(batch.receivedDate)}</small>
          </td>
          <td class="text-nowrap">
            ${isExhausted
              ? '<span class="text-muted small"><i class="bi bi-dash-circle me-1"></i>Exhausted</span>'
              : (isExpired
                ? '<span class="text-danger small fw-semibold"><i class="bi bi-exclamation-circle-fill me-1"></i>Expired</span>'
                : '<span class="text-success small fw-semibold"><i class="bi bi-check-circle-fill me-1"></i>Active</span>')
            }
          </td>
          <td class="text-nowrap text-end">
            ${isExhausted
              ? `<button type="button" class="btn btn-sm btn-light border px-2.5 py-1 text-muted rounded-pill opacity-50" disabled style="cursor: not-allowed;" title="Exhausted batches cannot be edited">
                  <i class="bi bi-pencil me-1"></i>Edit
                </button>`
              : `<button type="button" class="btn btn-sm btn-light border px-2.5 py-1 text-secondary rounded-pill batch-edit-btn" data-action="edit-batch" data-batch-id="${esc(batch.id)}" title="Edit batch number or expiration date">
                  <i class="bi bi-pencil me-1"></i>Edit
                </button>`
            }
          </td>
        </tr>
      `;
    }).join("");
  };

  const openBatchDetailsModal = (medicine) => {
    if (!medicine || !refs.batchDetailsModal) return;
    currentBatchDetailsMedicine = medicine;

    if (refs.batchDetailsMedicineName) {
      refs.batchDetailsMedicineName.textContent = medicineLabel(medicine);
    }
    if (refs.batchDetailsMedicineMeta) {
      refs.batchDetailsMedicineMeta.textContent = `${medicine.genericName || ""} | Form: ${medicine.form} | Alert Level: ${formatNumber(medicine.reorderLevel)} ${medicine.unit}`;
    }
    if (refs.batchDetailsTotalStock) {
      refs.batchDetailsTotalStock.textContent = `${formatNumber(medicine.stockOnHand)} ${medicine.unit}`;
    }

    batchDetailsViewingHistory = false;
    renderBatchDetailsRows(medicine, false);
    batchDetailsModal?.show();
  };

  const openEditBatchModal = (batch, medicine) => {
    if (!batch || !medicine || !refs.editBatchModal) return;
    const isExhausted = batch.status === "exhausted" || numeric(batch.quantityRemaining) <= 0;
    if (isExhausted) {
      showNotice("Exhausted batch records are locked for audit integrity and cannot be edited.", "warning");
      return;
    }
    currentEditingBatch = batch;
    batchEditSaved = false;

    if (refs.editBatchFeedback) {
      refs.editBatchFeedback.classList.add("d-none");
      refs.editBatchFeedback.textContent = "";
    }

    if (refs.editBatchMedicineId) refs.editBatchMedicineId.value = medicine.id;
    if (refs.editBatchId) refs.editBatchId.value = batch.id;
    if (refs.editBatchMedicineName) refs.editBatchMedicineName.textContent = medicineLabel(medicine);
    if (refs.editBatchQuantity) refs.editBatchQuantity.textContent = `${formatNumber(batch.quantityRemaining)} / ${formatNumber(batch.quantityReceived)} ${medicine.unit}`;

    const sourceLabel = batch.sourceType === "cho_delivery"
      ? "CHO Delivery"
      : (batch.sourceType === "donation"
        ? "Donation"
        : (batch.sourceType === "manual_restock" ? "Manual Restock" : "Initial Stock"));
    if (refs.editBatchSource) refs.editBatchSource.textContent = `${sourceLabel} (${formatDate(batch.receivedDate)})`;

    if (refs.editBatchNumber) refs.editBatchNumber.value = batch.batchNumber || "";
    if (refs.editBatchExpiryDate) {
      refs.editBatchExpiryDate.value = batch.expiryDate ? batch.expiryDate.slice(0, 10) : "";
    }

    // Hide batchDetailsModal first, then show editBatchModal once fully hidden
    const detailsModalEl = byId("batchDetailsModal");
    if (detailsModalEl && detailsModalEl.classList.contains("show")) {
      detailsModalEl.addEventListener("hidden.bs.modal", () => {
        editBatchModal?.show();
      }, { once: true });
      batchDetailsModal?.hide();
    } else {
      batchDetailsModal?.hide();
      editBatchModal?.show();
    }
  };

  const handleEditBatchSubmit = async (event) => {
    event.preventDefault();
    if (!currentEditingBatch || !currentBatchDetailsMedicine) return;

    const isExhausted = currentEditingBatch.status === "exhausted" || numeric(currentEditingBatch.quantityRemaining) <= 0;
    if (isExhausted) {
      if (refs.editBatchFeedback) {
        refs.editBatchFeedback.textContent = "Exhausted batches cannot be edited.";
        refs.editBatchFeedback.classList.remove("d-none");
      }
      return;
    }

    const newBatchNumber = text(refs.editBatchNumber?.value);
    const newExpiryDate = text(refs.editBatchExpiryDate?.value);

    if (!newBatchNumber) {
      if (refs.editBatchFeedback) {
        refs.editBatchFeedback.textContent = "Please enter a valid batch number.";
        refs.editBatchFeedback.classList.remove("d-none");
      }
      refs.editBatchNumber?.focus();
      return;
    }

    if (!newExpiryDate) {
      if (refs.editBatchFeedback) {
        refs.editBatchFeedback.textContent = "Please select a valid expiration date.";
        refs.editBatchFeedback.classList.remove("d-none");
      }
      refs.editBatchExpiryDate?.focus();
      return;
    }

    const oldBatchNumber = currentEditingBatch.batchNumber;
    const oldExpiryDate = currentEditingBatch.expiryDate;

    if (newBatchNumber === oldBatchNumber && newExpiryDate === oldExpiryDate) {
      batchEditSaved = true;
      editBatchModal?.hide();
      return;
    }

    if (refs.editBatchSubmitBtn) {
      refs.editBatchSubmitBtn.disabled = true;
      refs.editBatchSubmitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Saving...`;
    }

    const snapshot = createStateSnapshot();

    try {
      currentEditingBatch.batchNumber = newBatchNumber;
      currentEditingBatch.expiryDate = newExpiryDate;
      currentEditingBatch.updatedAt = nowIso();

      const globalBatch = (state.inventoryBatches || []).find((b) => String(b.id) === String(currentEditingBatch.id));
      if (globalBatch) {
        globalBatch.batchNumber = newBatchNumber;
        globalBatch.expiryDate = newExpiryDate;
        globalBatch.updatedAt = nowIso();
      }

      if (Array.isArray(currentBatchDetailsMedicine.batches)) {
        const medBatch = currentBatchDetailsMedicine.batches.find((b) => String(b.id) === String(currentEditingBatch.id));
        if (medBatch) {
          medBatch.batchNumber = newBatchNumber;
          medBatch.expiryDate = newExpiryDate;
          medBatch.updatedAt = nowIso();
        }
      }

      const allMedBatches = (currentBatchDetailsMedicine.batches && currentBatchDetailsMedicine.batches.length)
        ? currentBatchDetailsMedicine.batches
        : (state.inventoryBatches || []).filter((b) => b.medicineId === currentBatchDetailsMedicine.id);

      const activeBatches = allMedBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
      if (activeBatches.length > 0) {
        const validActiveBatches = activeBatches
          .filter((b) => daysUntil(b.expiryDate) >= 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        const primaryBatch = validActiveBatches.length > 0
          ? validActiveBatches[0]
          : [...activeBatches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0];
        currentBatchDetailsMedicine.batchNumber = primaryBatch.batchNumber;
        currentBatchDetailsMedicine.expiryDate = primaryBatch.expiryDate;
      }
      currentBatchDetailsMedicine.lastUpdatedAt = nowIso();
      currentBatchDetailsMedicine.updatedBy = actorName();

      const invMed = findMedicine(currentBatchDetailsMedicine.id);
      if (invMed && invMed !== currentBatchDetailsMedicine) {
        invMed.batchNumber = currentBatchDetailsMedicine.batchNumber;
        invMed.expiryDate = currentBatchDetailsMedicine.expiryDate;
        invMed.lastUpdatedAt = currentBatchDetailsMedicine.lastUpdatedAt;
        invMed.updatedBy = currentBatchDetailsMedicine.updatedBy;
      }

      const changes = [];
      if (newBatchNumber !== oldBatchNumber) changes.push(`Batch: "${oldBatchNumber}" → "${newBatchNumber}"`);
      if (newExpiryDate !== oldExpiryDate) changes.push(`Expiry: "${formatDate(oldExpiryDate)}" → "${formatDate(newExpiryDate)}"`);

      logMovement({
        medicine: currentBatchDetailsMedicine,
        actionType: "adjusted",
        quantity: 0,
        stockBefore: currentBatchDetailsMedicine.stockOnHand,
        stockAfter: currentBatchDetailsMedicine.stockOnHand,
        note: `Batch details updated (${changes.join(", ")}).`,
        createdAt: nowIso()
      });

      await persistInventoryState();

      batchEditSaved = true;
      editBatchModal?.hide();
      renderAll();
      showNotice("Batch details updated successfully.", "success");
    } catch (error) {
      restoreStateSnapshot(snapshot);
      renderAll();
      if (refs.editBatchFeedback) {
        refs.editBatchFeedback.textContent = error.message || "Failed to update batch details. Please try again.";
        refs.editBatchFeedback.classList.remove("d-none");
      }
      showNotice(error.message || "Failed to update batch details.", "danger");
    } finally {
      if (refs.editBatchSubmitBtn) {
        refs.editBatchSubmitBtn.disabled = false;
        refs.editBatchSubmitBtn.innerHTML = `<i class="bi bi-check2-circle me-1"></i>Save Batch Changes`;
      }
    }
  };

  const renderInventoryTable = () => {
    if (!refs.inventoryTableBody) return;
    const medicines = sortedInventory();
    if (refs.inventoryCount) {
      refs.inventoryCount.textContent = `${formatNumber(medicines.length)} item${medicines.length === 1 ? "" : "s"}`;
    }

    if (!medicines.length) {
      refs.inventoryTableBody.innerHTML = `
        <tr>
          <td colspan="7" class="inventory-empty">No medicine records match the current filters.</td>
        </tr>
      `;
      return;
    }

    refs.inventoryTableBody.innerHTML = medicines.map((medicine, index) => {
      const medBatches = (medicine.batches && medicine.batches.length)
        ? medicine.batches
        : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);
      const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
      const validActiveBatches = activeBatches
        .filter((b) => daysUntil(b.expiryDate) >= 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
      const expiredActiveBatches = activeBatches.filter((b) => daysUntil(b.expiryDate) < 0);

      const effectiveBatch = validActiveBatches.length > 0
        ? validActiveBatches[0]
        : (activeBatches.length > 0 ? [...activeBatches].sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())[0] : null);

      const displayBatchNumber = effectiveBatch ? effectiveBatch.batchNumber : medicine.batchNumber;
      const displayExpiryDate = effectiveBatch ? effectiveBatch.expiryDate : medicine.expiryDate;

      const status = getStatus(medicine);
      const expiryDays = daysUntil(displayExpiryDate);
      const expiryNote = expiryDays < 0 ? `${Math.abs(expiryDays)} days overdue` : `${expiryDays} days left`;
      const medicineMeta = [text(medicine.strength)].filter(Boolean).join(" | ");
      const shouldOpenUp = medicines.length === 1 || index >= medicines.length - 2;
      const batchHelper = isArchivedMedicine(medicine) ? "Archived record" : "Tracked batch";
      const stockHelper = isArchivedMedicine(medicine)
        ? "Restore this record to return it to active workflows."
        : `Alert at ${formatNumber(medicine.reorderLevel)} ${medicine.unit}`;

      const activeBatchCount = activeBatches.length || (numeric(medicine.stockOnHand) > 0 ? 1 : 0);

      const actionItems = isArchivedMedicine(medicine)
        ? `
                  <button type="button" class="dropdown-item inventory-action-item" data-action="restore" data-id="${esc(medicine.id)}">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                  </button>
                `
        : `
                  <button type="button" class="dropdown-item inventory-action-item" data-action="adjust" data-id="${esc(medicine.id)}">
                    <i class="bi bi-arrow-down-up"></i> Adjust Stock
                  </button>
                  <button type="button" class="dropdown-item inventory-action-item" data-action="archive" data-id="${esc(medicine.id)}">
                    <i class="bi bi-archive"></i> Archive
                  </button>
                `;

      const reserveBatches = validActiveBatches.slice(1);
      const hasReserve = reserveBatches.length > 0;
      const latestReserveBatch = hasReserve ? reserveBatches[reserveBatches.length - 1] : null;
      const reserveTotalQty = reserveBatches.reduce((sum, b) => sum + numeric(b.quantityRemaining), 0);

      let reserveMarkup = "";
      if (hasReserve && latestReserveBatch) {
        const reserveDateLabel = reserveBatches.length > 1
          ? `to ${formatDate(latestReserveBatch.expiryDate)}`
          : formatDate(latestReserveBatch.expiryDate);
        reserveMarkup = `
          <div class="inventory-expiry-reserve text-muted" style="font-size:0.75rem; margin-top:2px;">
            <span class="badge bg-light text-secondary border me-1" style="font-size:0.62rem;">Reserve</span>${esc(reserveDateLabel)} <span class="text-secondary">(${formatNumber(reserveTotalQty)} ${esc(medicine.unit)})</span>
          </div>
        `;
      }

      const isMultiBatch = hasReserve || activeBatchCount > 1;
      let expiryBadgeMarkup = "";
      if (isMultiBatch) {
        if (expiryDays < 0) {
          expiryBadgeMarkup = `<span class="badge bg-danger-subtle text-danger border border-danger-subtle me-1" style="font-size:0.65rem;" title="Batch has expired"><i class="bi bi-exclamation-triangle me-0.5"></i>Expired</span>`;
        } else if (expiryDays <= 90) {
          const batchQtyNote = effectiveBatch ? ` (${formatNumber(effectiveBatch.quantityRemaining)} ${medicine.unit})` : "";
          expiryBadgeMarkup = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle me-1" style="font-size:0.65rem;" title="Batch expiring soon in ${expiryDays} days${batchQtyNote}"><i class="bi bi-clock-history me-0.5"></i>Expiring Soon</span>`;
        } else if (effectiveBatch) {
          expiryBadgeMarkup = `<span class="badge bg-success-subtle text-success border border-success-subtle me-1" style="font-size:0.65rem;" title="Next batch to be dispensed: ${formatNumber(effectiveBatch.quantityRemaining)} ${esc(medicine.unit)}">Next Out</span>`;
        }
      }

      return `
        <tr>
          <td>
            <div class="inventory-medicine-cell">
              <div class="inventory-medicine-icon" title="${esc(normalizeDosageForm(medicine.form))}">${medicineFormIconMarkup(medicine.form)}</div>
              <div class="inventory-medicine-copy">
                <strong>${esc(medicineLabel(medicine))}</strong>
                <span>${esc(medicine.genericName || "No generic name")}</span>
                <small>${esc(medicineMeta || "No strength indicated")}</small>
              </div>
            </div>
          </td>
          <td>
            <div class="inventory-stock">
              <strong>${esc(medicine.form)}</strong>
              <small>${esc(medicine.unit)}</small>
            </div>
          </td>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(displayBatchNumber)}</strong>
              <small>
                ${activeBatchCount > 1
                  ? `<button type="button" class="view-batches-btn" data-action="view-batches" data-id="${esc(medicine.id)}" title="View all batches for this medicine"><i class="bi bi-layers-fill me-1"></i>${activeBatchCount} batches</button>`
                  : (medBatches.length > 0
                    ? `<button type="button" class="btn btn-link p-0 text-decoration-none text-muted" data-action="view-batches" data-id="${esc(medicine.id)}" style="font-size:0.75rem;" title="View batch details"><i class="bi bi-layers me-1"></i>Batch details</button>`
                    : esc(batchHelper))
                }
                ${expiredActiveBatches.length > 0 && validActiveBatches.length > 0
                  ? `<span class="badge bg-danger-subtle text-danger border border-danger-subtle ms-1" style="font-size:0.65rem;" title="${expiredActiveBatches.length} batch(es) expired and queued for disposal"><i class="bi bi-exclamation-circle me-0.5"></i>${expiredActiveBatches.length} expired</span>`
                  : ""
                }
              </small>
            </div>
          </td>
          <td>
            <div class="inventory-stock">
              <strong>${esc(formatNumber(medicine.stockOnHand))}</strong>
              <small>${esc(stockHelper)}</small>
            </div>
          </td>
          <td>
            <div class="inventory-expiry">
              <strong>${esc(formatDate(displayExpiryDate))}</strong>
              <small>${expiryBadgeMarkup}${esc(expiryNote)}${isMultiBatch && effectiveBatch ? ` <span class="text-muted" style="font-size:0.75rem;">(${formatNumber(effectiveBatch.quantityRemaining)} ${esc(medicine.unit)})</span>` : ""}</small>
              ${reserveMarkup}
            </div>
          </td>
          <td><span class="inventory-status inventory-status--${esc(status.tone)}">${esc(status.label)}</span></td>
          <td>
            <div class="inventory-actions">
              <div class="dropdown inventory-action-menu${shouldOpenUp ? " dropup" : ""}">
                <button
                  type="button"
                  class="btn btn-sm btn-light table-action-btn inventory-action-toggle"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  aria-label="Open medicine actions"
                >
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <div class="dropdown-menu dropdown-menu-end inventory-action-dropdown">
                  <button type="button" class="dropdown-item inventory-action-item" data-action="edit" data-id="${esc(medicine.id)}">
                    <i class="bi bi-pencil-square"></i> Edit
                  </button>
${actionItems}
                </div>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    initializeInventoryActionDropdowns();
  };

  const renderRestockList = () => {
    if (!refs.restockList) return;
    const items = activeInventory()
      .map((medicine) => ({ medicine, status: getStatus(medicine), suggested: reorderQuantity(medicine) }))
      .filter(({ status, suggested }) => (status.key === "low-stock" || status.key === "critical" || status.key === "out-of-stock") && suggested > 0)
      .sort((left, right) => right.suggested - left.suggested)
      .slice(0, 5);

    if (!items.length) {
      refs.restockList.innerHTML = '<div class="inventory-empty">No restock priority.</div>';
      return;
    }

    refs.restockList.innerHTML = items.map(({ medicine, status, suggested }) => `
      <article class="inventory-alert-item">
        <div class="inventory-alert-item__head">
          <div>
            <strong>${esc(medicineLabel(medicine))}</strong>
            <span>${esc(formatNumber(medicine.stockOnHand))} / ${esc(formatNumber(medicine.reorderLevel))} ${esc(medicine.unit)}</span>
          </div>
          <span class="inventory-kicker inventory-kicker--${esc(status.tone)}">${esc(status.label)}</span>
        </div>
        <div class="inventory-meta-row">
          <small>Order ${esc(formatNumber(suggested))} ${esc(medicine.unit)}</small>
          <button type="button" class="btn btn-sm btn-outline-primary" data-action="adjust" data-id="${esc(medicine.id)}">Restock</button>
        </div>
      </article>
    `).join("");
  };

  const renderExpiryList = () => {
    if (!refs.expiryList) return;
    const items = [...activeInventory()]
      .sort((left, right) => daysUntil(left.expiryDate) - daysUntil(right.expiryDate))
      .slice(0, 5);

    if (!items.length) {
      refs.expiryList.innerHTML = '<div class="inventory-empty">No expiry priority.</div>';
      return;
    }

    refs.expiryList.innerHTML = items.map((medicine) => {
      const remainingDays = daysUntil(medicine.expiryDate);
      const tone = remainingDays <= 30 ? "danger" : remainingDays <= 60 ? "warning" : "olive";
      const label = remainingDays < 0 ? `${Math.abs(remainingDays)} days overdue` : `${remainingDays} days remaining`;

      return `
        <article class="inventory-alert-item">
          <div class="inventory-alert-item__head">
            <div>
              <strong>${esc(medicineLabel(medicine))}</strong>
              <span>Batch ${esc(medicine.batchNumber)} | ${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)}</span>
            </div>
            <span class="inventory-kicker inventory-kicker--${esc(tone)}">${esc(label)}</span>
          </div>
          <div class="inventory-meta-row">
            <small>${esc(formatDate(medicine.expiryDate))}</small>
            <button type="button" class="btn btn-sm btn-light" data-action="edit" data-id="${esc(medicine.id)}">Open</button>
          </div>
        </article>
      `;
    }).join("");
  };

  const renderCategorySummary = () => {
    if (!refs.categorySummaryList) return;
    const inventory = activeInventory();
    const totalUnits = Math.max(1, inventory.reduce((total, medicine) => total + numeric(medicine.stockOnHand), 0));
    const groups = Array.from(inventory.reduce((map, medicine) => {
      const category = medicine.category;
      const entry = map.get(category) || { category, medicines: 0, units: 0, flagged: 0 };
      entry.medicines += 1;
      entry.units += numeric(medicine.stockOnHand);
      if (["low-stock", "critical", "out-of-stock"].includes(getStatus(medicine).key)) {
        entry.flagged += 1;
      }
      map.set(category, entry);
      return map;
    }, new Map()).values()).sort((left, right) => right.units - left.units);

    refs.categorySummaryList.innerHTML = groups.map((entry) => {
      const share = Math.round((entry.units / totalUnits) * 100);
      return `
        <article class="inventory-category-item">
          <div class="inventory-category-item__head">
            <div>
              <strong>${esc(entry.category)}</strong>
              <span>${esc(pluralize(entry.medicines, "item"))} | ${esc(formatNumber(entry.units))} units</span>
            </div>
            <span class="inventory-kicker inventory-kicker--${entry.flagged > 0 ? "warning" : "success"}">${esc(entry.flagged > 0 ? `${entry.flagged} flagged` : "Stable")}</span>
          </div>
          <div class="inventory-bar" aria-hidden="true"><span style="width:${Math.min(100, Math.max(10, share))}%"></span></div>
        </article>
      `;
    }).join("");
  };

  const renderReorderPlanner = () => {
    if (!refs.reorderPlannerList) return;
    const plans = activeInventory()
      .map((medicine) => ({
        medicine,
        suggested: reorderQuantity(medicine),
        estimatedCost: reorderQuantity(medicine) * numeric(medicine.unitCost),
        status: getStatus(medicine)
      }))
      .filter(({ suggested, status }) => suggested > 0 && status.key !== "healthy")
      .sort((left, right) => right.suggested - left.suggested)
      .slice(0, 5);

    if (!plans.length) {
      refs.reorderPlannerList.innerHTML = '<div class="inventory-empty">Stock levels are covered.</div>';
      return;
    }

      refs.reorderPlannerList.innerHTML = plans.map(({ medicine, suggested, estimatedCost, status }) => `
      <article class="inventory-planner-item">
        <div class="inventory-planner-item__head">
          <div>
            <strong>${esc(medicineLabel(medicine))}</strong>
            <span>Order ${esc(formatNumber(suggested))} ${esc(medicine.unit)}</span>
          </div>
          <span class="inventory-kicker inventory-kicker--${esc(status.tone)}">${esc(status.label)}</span>
        </div>
        <div class="inventory-meta-row">
          <small>${esc(formatCurrency(estimatedCost))}</small>
        </div>
      </article>
    `).join("");
  };

  const renderAll = () => {
    renderMetrics();
    renderCategoryFilter();
    renderInventoryTable();
    renderRestockList();
    renderExpiryList();
    renderCategorySummary();
    renderReorderPlanner();
  };

  const logMovement = ({
    medicine,
    actionType,
    quantity,
    stockBefore,
    stockAfter,
    note,
    createdAt,
    recipientId = "",
    recipientName = "",
    recipientBarangay = "",
    releasedByRole = "",
    releasedByName = "",
    linkedRequestId = "",
    linkedRequestItemId = "",
    linkedRequestGroupId = "",
    linkedRequestCode = ""
  }) => {
    state.movements.unshift(normalizeMovement({
      medicineId: medicine.id,
      medicineName: medicineLabel(medicine),
      actionType,
      quantity,
      stockBefore,
      stockAfter,
      note,
      createdAt,
      user: actorName(),
      recipientId,
      recipientName,
      recipientBarangay,
      releasedByRole,
      releasedByName,
      linkedRequestId,
      linkedRequestItemId,
      linkedRequestGroupId,
      linkedRequestCode
    }));
  };

  const openMedicineModal = (medicine = null) => {
    if (!refs.medicineForm) return;
    refs.medicineForm.reset();
    refs.medicineId.value = medicine?.id || "";
    refs.medicineModalTitle.textContent = medicine ? "Edit Medicine Record" : "Add Medicine Record";
    refs.medicineModalSubtitle.textContent = medicine
      ? "Update category, dosage form, batch, and stock details."
      : "Create a new medicine record with form, category, and batch details.";

    refs.medicineName.value = medicine?.name || "";
    refs.genericName.value = medicine?.genericName || "";
    refs.medicineCategory.value = medicine?.category || "";
    refs.medicineFormType.value = medicine?.form || "";
    refs.medicineStrength.value = medicine?.strength || "";
    refs.medicineUnit.value = medicine?.unit || "";
    refs.stockOnHand.value = "";
    refs.reorderLevel.value = medicine ? String(medicine.reorderLevel) : "";
    refs.batchNumber.value = medicine?.batchNumber === "-" ? "" : (medicine?.batchNumber || "");
    refs.expiryDate.value = medicine?.expiryDate || todayInputValue();

    const medBatches = medicine
      ? (medicine.batches && medicine.batches.length
          ? medicine.batches
          : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id))
      : [];
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
    const isMultiBatch = Boolean(medicine && activeBatches.length > 1);

    const isEdit = Boolean(medicine);
    const calculatedStock = medicine
      ? (activeBatches.length > 0
          ? activeBatches.reduce((sum, b) => sum + numeric(b.quantityRemaining), 0)
          : numeric(medicine.stockOnHand))
      : "";

    if (refs.stockOnHand) {
      refs.stockOnHand.classList.toggle("d-none", isEdit);
      refs.stockOnHand.required = !isEdit;
      refs.stockOnHand.value = isEdit ? String(calculatedStock) : "";
    }

    if (refs.stockOnHandDisplay) {
      refs.stockOnHandDisplay.classList.toggle("d-none", !isEdit);
      if (isEdit && refs.stockOnHandDisplayValue) {
        refs.stockOnHandDisplayValue.textContent = `${formatNumber(calculatedStock)} ${medicine.unit || "units"}`;
      }
    }

    if (refs.medicineModalMultiBatchBanner) {
      refs.medicineModalMultiBatchBanner.classList.toggle("d-none", !isMultiBatch);
      if (isMultiBatch && refs.medicineModalBatchCount) {
        refs.medicineModalBatchCount.textContent = `${activeBatches.length} active batches`;
      }
    }
    if (refs.medicineModalBatchNumberGroup) {
      refs.medicineModalBatchNumberGroup.classList.toggle("d-none", isMultiBatch);
    }
    if (refs.medicineModalExpiryDateGroup) {
      refs.medicineModalExpiryDateGroup.classList.toggle("d-none", isMultiBatch);
    }
    if (refs.batchNumber) {
      refs.batchNumber.required = !isMultiBatch;
    }
    if (refs.expiryDate) {
      refs.expiryDate.required = !isMultiBatch;
    }

    medicineModal?.show();
  };

  const openStockActionModal = (medicine, defaultAction = "restock") => {
    if (!medicine || !refs.stockActionForm) return;
    if (stockActionSaving) return;
    if (isArchivedMedicine(medicine)) {
      showNotice("Restore this medicine record first before updating stock.", "warning");
      return;
    }

    refs.stockActionForm.reset();
    resetStockActionOperationId();
    refs.stockMedicineId.value = medicine.id;
    refs.stockActionMedicineLabel.textContent = medicineLabel(medicine);
    refs.stockCurrentStock.textContent = `${formatNumber(medicine.stockOnHand)} ${medicine.unit}`;
    refs.stockActionType.value = defaultAction;
    refs.stockActionDate.value = todayInputValue();
    if (refs.stockActionBatchNumber) refs.stockActionBatchNumber.value = "";
    if (refs.stockActionExpiryDate) {
      const defExp = new Date();
      defExp.setFullYear(defExp.getFullYear() + 2);
      refs.stockActionExpiryDate.value = defExp.toISOString().slice(0, 10);
      refs.stockActionExpiryDate.min = todayInputValue();
    }
    setStockActionFeedback();

    const requestRows = linkedRequestRowsForMedicine(medicine);
    if (requestRows.length && refs.stockRestockSourceCho) {
      refs.stockRestockSourceCho.checked = true;
    } else if (refs.stockRestockSourceManual) {
      refs.stockRestockSourceManual.checked = true;
    }

    populateLinkedRequestOptions(medicine, { autoSelect: true });
    updateStockActionInterface({ autofillRequest: requestRows.length === 1 && defaultAction === "restock" });
    stockActionModal?.show();
  };

  const handleMedicineSubmit = async (event) => {
    event.preventDefault();
    const existingId = text(refs.medicineId.value);
    const existing = existingId ? findMedicine(existingId) : null;

    if (existingId && !existing) {
      showNotice("Unable to locate the selected medicine record.", "danger");
      return;
    }

    const medBatches = existing
      ? (existing.batches && existing.batches.length
          ? existing.batches
          : (state.inventoryBatches || []).filter((b) => b.medicineId === existing.id))
      : [];
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
    const isMultiBatch = Boolean(existing && activeBatches.length > 1);

    const calculatedExistingStock = existing
      ? (activeBatches.length > 0
          ? activeBatches.reduce((sum, b) => sum + numeric(b.quantityRemaining), 0)
          : numeric(existing.stockOnHand))
      : numeric(refs.stockOnHand.value);

    const payload = normalizeMedicine({
      id: existing?.id || uid(),
      name: refs.medicineName.value,
      genericName: refs.genericName.value,
      category: refs.medicineCategory.value,
      form: refs.medicineFormType.value,
      strength: refs.medicineStrength.value,
      stockOnHand: existing ? calculatedExistingStock : refs.stockOnHand.value,
      reorderLevel: refs.reorderLevel.value,
      unit: refs.medicineUnit.value,
      batchNumber: isMultiBatch ? existing.batchNumber : refs.batchNumber.value,
      expiryDate: isMultiBatch ? existing.expiryDate : refs.expiryDate.value,
      unitCost: existing?.unitCost || 0,
      recordStatus: existing?.recordStatus || "active",
      updatedBy: actorName(),
      lastUpdatedAt: nowIso()
    });

    if (!payload.name || !payload.genericName || !payload.category || !payload.form || !payload.unit || (!isMultiBatch && (payload.batchNumber === "-" || !payload.batchNumber))) {
      showNotice("Please complete the medicine name, category, dosage form, unit, and batch number.", "danger");
      return;
    }

    const duplicateMedicine = findDuplicateInventoryMedicine(payload);
    if (duplicateMedicine) {
      const duplicateGuidance = isArchivedMedicine(duplicateMedicine)
        ? "Restore the archived record instead."
        : "Update the existing record instead.";
      showNotice(`${inventoryIdentityLabel(payload)} is already in the inventory. ${duplicateGuidance}`, "danger");
      return;
    }

    const snapshot = createStateSnapshot();

    if (existing) {
      const previousStock = existing.stockOnHand;
      Object.assign(existing, payload);

      if (!isMultiBatch) {
        const matchingBatches = (existing.batches && existing.batches.length)
          ? existing.batches
          : (state.inventoryBatches || []).filter((b) => b.medicineId === existing.id);
        const singleActiveBatch = matchingBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
        if (singleActiveBatch.length === 1) {
          singleActiveBatch[0].batchNumber = payload.batchNumber;
          singleActiveBatch[0].expiryDate = payload.expiryDate;
          singleActiveBatch[0].updatedAt = payload.lastUpdatedAt;
          const globalBatch = (state.inventoryBatches || []).find((b) => b.id === singleActiveBatch[0].id);
          if (globalBatch) {
            globalBatch.batchNumber = payload.batchNumber;
            globalBatch.expiryDate = payload.expiryDate;
            globalBatch.updatedAt = payload.lastUpdatedAt;
          }
        }
      }

      if (previousStock !== payload.stockOnHand) {
        logMovement({
          medicine: payload,
          actionType: "adjusted",
          quantity: Math.abs(payload.stockOnHand - previousStock),
          stockBefore: previousStock,
          stockAfter: payload.stockOnHand,
          note: "Stock corrected through record update.",
          createdAt: payload.lastUpdatedAt
        });
      }

    } else {
      state.inventory.unshift(payload);
      logMovement({
        medicine: payload,
        actionType: "restock",
        quantity: payload.stockOnHand,
        stockBefore: 0,
        stockAfter: payload.stockOnHand,
        note: "Initial inventory record created.",
        createdAt: payload.lastUpdatedAt
      });
    }

    try {
      await persistInventoryState();
    } catch (error) {
      restoreStateSnapshot(snapshot);
      renderAll();
      showNotice(error.message || "Unable to save the medicine record right now.", "danger");
      return;
    }

    renderAll();
    emitInventoryNotificationRefresh();
    medicineModal?.hide();
  };

  const handleMedicineRecordStatusChange = async (medicine, nextStatus) => {
    if (!medicine) return;

    const normalizedNextStatus = normalizeRecordStatus(nextStatus);
    if (normalizeRecordStatus(medicine.recordStatus) === normalizedNextStatus) {
      return;
    }

    if (normalizedNextStatus === "archived" && numeric(medicine.stockOnHand) > 0) {
      showNotice(`Set ${medicine.name} stock to 0 or dispose the remaining units before archiving this record.`, "warning");
      return;
    }

    const confirmed = await confirmMedicineRecordStatusChange(normalizedNextStatus === "archived"
      ? {
          title: "Archive medicine record?",
          message: `${inventoryIdentityLabel(medicine)} will be hidden from the active inventory list and request workflows.`,
          hint: "You can restore it later from the Archived filter.",
          confirmLabel: "Archive",
          confirmButtonClass: "btn-danger",
          iconClass: "bi-archive-fill",
          tone: "archive",
          fallbackMessage: `Archive ${inventoryIdentityLabel(medicine)}? This hides it from active inventory workflows.`
        }
      : {
          title: "Restore medicine record?",
          message: `${inventoryIdentityLabel(medicine)} will return to the active inventory list and request workflows.`,
          hint: "This only changes visibility. Stock quantities stay the same.",
          confirmLabel: "Restore",
          confirmButtonClass: "btn-success",
          iconClass: "bi-arrow-counterclockwise",
          tone: "restore",
          fallbackMessage: `Restore ${inventoryIdentityLabel(medicine)} to the active inventory list?`
        });
    if (!confirmed) {
      return;
    }

    const snapshot = createStateSnapshot();
    medicine.recordStatus = normalizedNextStatus;
    medicine.updatedBy = actorName();
    medicine.lastUpdatedAt = nowIso();

    appendActivityLog({
      actor: actorName(),
      username: actorUsername(),
      action: normalizedNextStatus === "archived" ? "Archived medicine record" : "Restored medicine record",
      actionType: normalizedNextStatus === "archived" ? "deleted" : "updated",
      target: inventoryIdentityLabel(medicine),
      details: normalizedNextStatus === "archived"
        ? "Medicine record was archived and hidden from active inventory workflows."
        : "Medicine record was restored to the active inventory workflows.",
      category: "Inventory",
      resultLabel: normalizedNextStatus === "archived" ? "Archived" : "Restored",
      resultTone: normalizedNextStatus === "archived" ? "neutral" : "success",
      createdAt: medicine.lastUpdatedAt,
      ipAddress: currentActorIp()
    });

    try {
      await persistInventoryState();
    } catch (error) {
      restoreStateSnapshot(snapshot);
      renderAll();
      showNotice(error.message || "Unable to update the medicine record status right now.", "danger");
      return;
    }

    if (normalizedNextStatus === "active" && refs.statusFilter && text(refs.statusFilter.value) === "archived") {
      refs.statusFilter.value = "all";
      uiState.status = "all";
      uiState.category = "all";
      if (refs.categoryFilter) refs.categoryFilter.value = "all";
    }

    renderAll();
    emitInventoryNotificationRefresh();
  };

  const handleStockActionSubmit = async (event) => {
    event.preventDefault();
    if (stockActionSaving) return;
    setStockActionFeedback();
    const medicine = findMedicine(text(refs.stockMedicineId.value));
    if (!medicine) {
      setStockActionFeedback("Unable to locate the selected medicine record.");
      return;
    }

    if (isArchivedMedicine(medicine)) {
      setStockActionFeedback("Restore this medicine record first before updating stock.", "warning");
      return;
    }

    const actionType = text(refs.stockActionType.value) || "restock";
    const source = actionType === "restock" ? stockRestockSource() : "";
    const note = text(refs.stockActionNote.value).trim();
    const actionDate = text(refs.stockActionDate.value) || todayInputValue();
    const linkedRequest = actionType === "restock" && source === "cho"
      ? selectedLinkedRequestForMedicine(medicine)
      : null;

    const medBatches = (medicine.batches && medicine.batches.length)
      ? medicine.batches
      : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);
    const activeBatches = medBatches.filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0);
    const hasBatches = activeBatches.length > 0;

    const batchesToDispose = [];
    let quantity = 0;

    if (actionType === "dispose" && hasBatches) {
      const rows = refs.stockDisposeBatchTableBody?.querySelectorAll("tr[data-batch-id]") || [];
      let totalQty = 0;
      for (const row of rows) {
        const check = row.querySelector(".stock-dispose-batch-check");
        const qtyInput = row.querySelector(".stock-dispose-qty-input");
        if (check && check.checked) {
          const batchId = row.dataset.batchId;
          const batchObj = activeBatches.find((b) => b.id === batchId);
          const disposeQty = Number(qtyInput?.value);
          if (!Number.isInteger(disposeQty) || disposeQty <= 0) {
            setStockActionFeedback(`Enter a whole-number quantity to dispose for batch ${batchObj?.batchNumber || ""}.`);
            qtyInput?.focus();
            return;
          }
          const remaining = numeric(batchObj?.quantityRemaining);
          if (disposeQty > remaining) {
            setStockActionFeedback(`Disposal quantity for batch ${batchObj?.batchNumber} cannot exceed available stock (${formatNumber(remaining)}).`);
            qtyInput?.focus();
            return;
          }
          batchesToDispose.push({
            batch: batchObj,
            quantity: disposeQty
          });
          totalQty += disposeQty;
        }
      }

      if (batchesToDispose.length === 0) {
        setStockActionFeedback("Please select at least one batch to dispose.");
        return;
      }
      quantity = totalQty;
    } else {
      quantity = Number(text(refs.stockActionQuantity.value));
      if (!Number.isInteger(quantity) || quantity <= 0) {
        setStockActionFeedback("Enter a whole-number quantity greater than zero.");
        refs.stockActionQuantity?.focus();
        return;
      }
    }

    if (actionType === "dispose" && !note) {
      setStockActionFeedback("Enter the disposal reason before continuing.");
      refs.stockActionNote?.focus();
      return;
    }

    if (actionType === "restock" && source === "cho" && !linkedRequest) {
      setStockActionFeedback("Select an open CHO request for this medicine.");
      refs.stockLinkedRequestId?.focus();
      return;
    }

    const dateError = stockActionDateError(linkedRequest);
    if (dateError) {
      setStockActionFeedback(dateError);
      refs.stockActionDate?.focus();
      return;
    }

    if (linkedRequest && !stockUnitsMatch(medicine, linkedRequest)) {
      setStockActionFeedback(`Cannot receive this delivery because the request uses ${linkedRequest.unit}, while inventory uses ${medicine.unit}.`);
      refs.stockLinkedRequestId?.focus();
      return;
    }

    if (linkedRequest && quantity > numeric(linkedRequest.remainingQuantity)) {
      setStockActionFeedback(`Quantity cannot exceed the ${formatNumber(linkedRequest.remainingQuantity)} ${linkedRequest.unit} remaining in ${linkedRequest.requestCode}.`);
      refs.stockActionQuantity?.focus();
      return;
    }

    let batchNumber = text(refs.stockActionBatchNumber?.value);
    const expiryDate = text(refs.stockActionExpiryDate?.value);
    if (actionType === "restock" && !expiryDate) {
      setStockActionFeedback("Please provide the expiration date.");
      refs.stockActionExpiryDate?.focus();
      return;
    }

    if (actionType === "restock" && !batchNumber) {
      const dateCode = (actionDate || nowIso().slice(0, 10)).replace(/-/g, "");
      const isDonation = !note || /donat|regalo|bigay|ngo|mission|rotary|lions/i.test(note);
      const prefix = isDonation ? "DON" : "RESTOCK";
      const existingBatches = (medicine.batches || []).map((b) => b.batchNumber);
      let candidate = `${prefix}-${dateCode}`;
      let seq = 1;
      while (existingBatches.includes(candidate)) {
        seq++;
        candidate = `${prefix}-${dateCode}-${String(seq).padStart(2, "0")}`;
      }
      batchNumber = candidate;
    }

    if (linkedRequest) {
      const deliveryDraft = {
        requestGroupId: linkedRequest.requestGroupId,
        requestItemId: linkedRequest.id,
        medicineId: medicine.id,
        quantity,
        actionDate
      };
      let pendingDelivery = readPendingStockDelivery();
      if (pendingDelivery && state.movements.some((movement) => movement.id === text(pendingDelivery.operationId))) {
        clearPendingStockDelivery(pendingDelivery.operationId);
        pendingDelivery = null;
      }
      if (pendingDelivery && !samePendingStockDelivery(pendingDelivery, deliveryDraft)) {
        setStockActionFeedback("A previous CHO receipt is still being confirmed. Refresh the page before entering a different delivery.", "warning");
        return;
      }

      const operationId = text(pendingDelivery?.operationId) || stockActionOperationId || `delivery_${uid()}`;
      const deliveryPayload = {
        action: "receive_cho_delivery",
        operationId,
        ...deliveryDraft,
        batchNumber,
        expiryDate,
        note: ""
      };
      stockActionOperationId = operationId;
      writePendingStockDelivery(deliveryPayload);
      setStockActionSavingState(true);
      if (refs.stockActionSubmitLabel) refs.stockActionSubmitLabel.textContent = "Receiving...";

      try {
        const payload = await requestJson(STATE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(deliveryPayload)
        });
        syncStateFromServer(payload.state || {});
      } catch (error) {
        await hydrateInventoryState();
        const savedDespiteResponseError = state.movements.some((movement) => movement.id === operationId);
        if (!savedDespiteResponseError) {
          if (Number(error.status) >= 400 && Number(error.status) < 500) {
            clearPendingStockDelivery(operationId);
            if (stockActionOperationId === operationId) stockActionOperationId = "";
          }
          const refreshedMedicine = findMedicine(medicine.id);
          if (refreshedMedicine && refs.stockCurrentStock) {
            refs.stockCurrentStock.textContent = `${formatNumber(refreshedMedicine.stockOnHand)} ${refreshedMedicine.unit}`;
            if (refs.stockActionQuantity) refs.stockActionQuantity.value = "";
            populateLinkedRequestOptions(refreshedMedicine, { autoSelect: false });
          }
          setStockActionSavingState(false);
          setStockActionFeedback(error.message || "Unable to receive the CHO delivery right now.");
          return;
        }
      }

      clearPendingStockDelivery(operationId);
      if (stockActionOperationId === operationId) stockActionOperationId = "";
      setStockActionSavingState(false);
      renderAll();
      emitInventoryNotificationRefresh();
      stockActionModal?.hide();
      showNotice(`${formatNumber(quantity)} ${medicine.unit} received from ${linkedRequest.requestCode} (Batch: ${batchNumber}).`);
      return;
    }

    if (actionType === "dispose") {
      const currentStock = numeric(medicine.stockOnHand);
      if (quantity > currentStock) {
        setStockActionFeedback(`Only ${formatNumber(currentStock)} ${medicine.unit} are available to dispose.`);
        return;
      }
      const targetStockAfter = Math.max(0, currentStock - quantity);

      const confirmed = await confirmDisposalAction({
        medicine,
        totalQty: quantity,
        batchItems: batchesToDispose,
        reason: note,
        stockBefore: currentStock,
        stockAfter: targetStockAfter
      });

      if (!confirmed) {
        return;
      }
    }

    const snapshot = createStateSnapshot();
    const stockBefore = medicine.stockOnHand;
    let stockAfter = stockBefore;
    const recordedAt = nowIso();
    let affectedBatchId = "";

    if (actionType === "restock") {
      stockAfter += quantity;
      affectedBatchId = `batch_${uid()}`;
      const isDonationBatch = batchNumber.startsWith("DON-") || /donat|regalo|bigay|ngo|mission|rotary|lions/i.test(note || "");
      const newBatch = normalizeBatch({
        id: affectedBatchId,
        medicineId: medicine.id,
        batchNumber: batchNumber,
        expiryDate: expiryDate,
        quantityReceived: quantity,
        quantityRemaining: quantity,
        receivedDate: actionDate,
        sourceType: isDonationBatch ? "donation" : "manual_restock",
        sourceReference: note || (isDonationBatch ? "Donated medicine" : "Manual stock replenishment"),
        status: "active",
        createdAt: recordedAt,
        updatedAt: recordedAt
      });
      if (!Array.isArray(state.inventoryBatches)) state.inventoryBatches = [];
      state.inventoryBatches.push(newBatch);
      if (!Array.isArray(medicine.batches)) medicine.batches = [];
      medicine.batches.push(newBatch);
    } else {
      if (quantity > stockBefore) {
        setStockActionFeedback(`Only ${formatNumber(stockBefore)} ${medicine.unit} are available to dispose.`);
        return;
      }
      stockAfter -= quantity;

      if (batchesToDispose.length > 0) {
        for (const item of batchesToDispose) {
          const b = item.batch;
          const deduct = item.quantity;
          b.quantityRemaining = Math.max(0, numeric(b.quantityRemaining) - deduct);
          if (b.quantityRemaining <= 0) {
            b.status = "exhausted";
          }
          b.updatedAt = recordedAt;
          affectedBatchId = b.id;

          const matchingGlobal = (state.inventoryBatches || []).find((gb) => gb.id === b.id);
          if (matchingGlobal) {
            matchingGlobal.quantityRemaining = b.quantityRemaining;
            matchingGlobal.status = b.status;
            matchingGlobal.updatedAt = recordedAt;
          }
        }
      } else {
        let remainingToDispose = quantity;
        const activeBatchesToDeduct = (medicine.batches || [])
          .filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0)
          .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        for (const b of activeBatchesToDeduct) {
          if (remainingToDispose <= 0) break;
          const deduct = Math.min(remainingToDispose, b.quantityRemaining);
          b.quantityRemaining -= deduct;
          if (b.quantityRemaining <= 0) b.status = "exhausted";
          b.updatedAt = recordedAt;
          remainingToDispose -= deduct;
          affectedBatchId = b.id;
          const matchingGlobal = (state.inventoryBatches || []).find((gb) => gb.id === b.id);
          if (matchingGlobal) {
            matchingGlobal.quantityRemaining = b.quantityRemaining;
            matchingGlobal.status = b.status;
            matchingGlobal.updatedAt = recordedAt;
          }
        }
      }
    }

    const activeBatchesAfter = (medicine.batches || [])
      .filter((b) => b.status === "active" && numeric(b.quantityRemaining) > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
    if (activeBatchesAfter.length > 0) {
      const validActiveBatches = activeBatchesAfter.filter((b) => daysUntil(b.expiryDate) >= 0);
      const primaryBatch = validActiveBatches.length > 0 ? validActiveBatches[0] : activeBatchesAfter[0];
      medicine.batchNumber = primaryBatch.batchNumber;
      medicine.expiryDate = primaryBatch.expiryDate;
    }
    medicine.activeBatchesCount = activeBatchesAfter.length;

    const movementCreatedAt = `${actionDate}T08:00:00`;
    medicine.stockOnHand = stockAfter;
    medicine.lastUpdatedAt = recordedAt;
    medicine.updatedBy = actorName();

    const projectedRequestResult = linkedRequest
      ? projectedChoRequestText(linkedRequest, quantity, text(linkedRequest.unit) || text(medicine.unit) || "units")
      : "";
    const isDonatedRestock = actionType === "restock" && !linkedRequest && (batchNumber.startsWith("DON-") || /donat|regalo|bigay|ngo|mission|rotary|lions/i.test(note || ""));
    const defaultNote = actionType === "restock"
      ? (linkedRequest
        ? `CHO delivery received and linked to ${linkedRequest.requestCode}.`
        : (isDonatedRestock ? `Donated stock recorded (Batch: ${batchNumber}).` : "Manual stock replenishment recorded."))
      : "Damaged or expired stock written off.";
    const movementNote = linkedRequest ? defaultNote : (note || defaultNote);

    if (actionType === "dispose" && batchesToDispose.length > 0) {
      let runningStock = stockBefore;
      const batchSummaries = [];

      for (const item of batchesToDispose) {
        const b = item.batch;
        const batchQty = item.quantity;
        const nextStock = runningStock - batchQty;

        const batchDays = daysUntil(b.expiryDate);
        const expiryTag = batchDays < 0 ? ` [Expired ${Math.abs(batchDays)}d ago]` : ` [Exp: ${b.expiryDate}]`;
        const itemNote = `${movementNote} (Batch: ${b.batchNumber}${expiryTag})`;

        logMovement({
          medicine,
          actionType: "dispose",
          quantity: batchQty,
          stockBefore: runningStock,
          stockAfter: nextStock,
          batchId: b.id,
          batchNumber: b.batchNumber,
          batchExpiry: b.expiryDate,
          note: itemNote,
          createdAt: movementCreatedAt
        });

        batchSummaries.push(`${b.batchNumber}: ${formatNumber(batchQty)}`);
        runningStock = nextStock;
      }

      appendActivityLog({
        actor: actorName(),
        username: actorUsername(),
        action: "Disposed medicine",
        actionType: "deleted",
        target: medicineLabel(medicine),
        details: `${formatNumber(quantity)} ${medicine.unit} disposed across ${batchesToDispose.length} batch(es) [${batchSummaries.join(", ")}] for ${medicineLabel(medicine)}. Stock updated from ${formatNumber(stockBefore)} to ${formatNumber(stockAfter)} ${medicine.unit}. Reason: ${movementNote}`,
        category: "Inventory",
        resultLabel: "Disposed",
        resultTone: "neutral",
        createdAt: recordedAt,
        ipAddress: currentActorIp()
      });
    } else {
      logMovement({
        medicine,
        actionType,
        quantity,
        stockBefore,
        stockAfter,
        batchId: affectedBatchId,
        batchNumber: actionType === "restock" ? batchNumber : (medicine.batchNumber || ""),
        batchExpiry: actionType === "restock" ? expiryDate : (medicine.expiryDate || ""),
        note: movementNote,
        createdAt: movementCreatedAt,
        linkedRequestId: linkedRequest?.id || "",
        linkedRequestItemId: linkedRequest?.id || "",
        linkedRequestGroupId: linkedRequest?.requestGroupId || "",
        linkedRequestCode: linkedRequest?.requestCode || ""
      });

      const actionLabel = actionType === "restock"
        ? (linkedRequest ? "Received CHO delivery" : "Restocked medicine")
        : "Disposed medicine";
      const detailParts = [
        `${formatNumber(quantity)} ${medicine.unit} ${linkedRequest ? "received" : "processed"} for ${medicineLabel(medicine)}.`,
        `Stock updated from ${formatNumber(stockBefore)} to ${formatNumber(stockAfter)} ${medicine.unit}.`
      ];

      if (linkedRequest) {
        detailParts.push(`Linked to ${linkedRequest.requestCode}. ${projectedRequestResult}`);
      }

      if (actionType === "restock" && !linkedRequest && note) {
        detailParts.push(`Note: ${note}`);
      }

      if (actionType === "dispose") {
        detailParts.push(`Reason: ${movementNote}`);
      }

      appendActivityLog({
        actor: actorName(),
        username: actorUsername(),
        action: actionLabel,
        actionType: actionType === "restock" ? "updated" : "deleted",
        target: medicineLabel(medicine),
        details: detailParts.join(" "),
        category: "Inventory",
        resultLabel: actionType === "restock" ? "Updated" : "Disposed",
        resultTone: actionType === "restock" ? "success" : "neutral",
        createdAt: recordedAt,
        ipAddress: currentActorIp()
      });
    }

    setStockActionSavingState(true);
    if (refs.stockActionSubmitLabel) {
      refs.stockActionSubmitLabel.textContent = actionType === "dispose"
        ? "Saving..."
        : linkedRequest
          ? "Receiving..."
          : "Adding...";
    }

    try {
      await persistInventoryState();
    } catch (error) {
      restoreStateSnapshot(snapshot);
      await hydrateInventoryState();
      const refreshedMedicine = findMedicine(medicine.id);
      if (refreshedMedicine && refs.stockCurrentStock) {
        refs.stockCurrentStock.textContent = `${formatNumber(refreshedMedicine.stockOnHand)} ${refreshedMedicine.unit}`;
        if (refs.stockActionQuantity) refs.stockActionQuantity.value = "";
        populateLinkedRequestOptions(refreshedMedicine, { autoSelect: false });
      }
      renderAll();
      setStockActionSavingState(false);
      setStockActionFeedback(error.message || "Unable to save the stock action right now.");
      if (actionType === "dispose") stockActionModal?.show();
      return;
    }

    setStockActionSavingState(false);
    renderAll();
    emitInventoryNotificationRefresh();
    stockActionModal?.hide();
    showNotice(linkedRequest
      ? `${formatNumber(quantity)} ${medicine.unit} received from ${linkedRequest.requestCode}.`
      : actionType === "restock"
        ? `${formatNumber(quantity)} ${medicine.unit} added to stock.`
        : (batchesToDispose.length > 0
          ? `${formatNumber(quantity)} ${medicine.unit} disposed across ${batchesToDispose.length} batch(es).`
          : `${formatNumber(quantity)} ${medicine.unit} disposed from stock.`));
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

  refs.openAddMedicineBtn?.addEventListener("click", () => openMedicineModal());
  refs.medicineForm?.addEventListener("submit", (event) => {
    void handleMedicineSubmit(event);
  });
  refs.medicineFormType?.addEventListener("change", () => {
    const suggestedUnit = DOSAGE_FORM_UNIT_MAP[text(refs.medicineFormType?.value)];
    if (!suggestedUnit || !refs.medicineUnit) return;
    if (!text(refs.medicineUnit.value)) {
      refs.medicineUnit.value = suggestedUnit;
    }
  });
  refs.stockActionForm?.addEventListener("submit", (event) => {
    void handleStockActionSubmit(event);
  });
  refs.stockActionType?.addEventListener("change", () => {
    resetStockActionOperationId();
    const medicine = findMedicine(text(refs.stockMedicineId?.value));
    if (refs.stockActionQuantity) refs.stockActionQuantity.value = "";
    setStockActionFeedback();
    if (text(refs.stockActionType?.value) === "restock" && medicine) {
      populateLinkedRequestOptions(medicine, { autoSelect: stockRestockSource() === "cho" });
    }
    updateStockActionInterface({ autofillRequest: stockRestockSource() === "cho" });
  });
  [refs.stockRestockSourceCho, refs.stockRestockSourceManual].forEach((field) => {
    field?.addEventListener("change", () => {
      resetStockActionOperationId();
      const medicine = findMedicine(text(refs.stockMedicineId?.value));
      if (refs.stockActionQuantity) refs.stockActionQuantity.value = "";
      setStockActionFeedback();
      if (stockRestockSource() === "cho" && medicine) {
        populateLinkedRequestOptions(medicine, { autoSelect: true });
      }
      updateStockActionInterface({ autofillRequest: stockRestockSource() === "cho" });
    });
  });
  refs.stockLinkedRequestId?.addEventListener("change", () => {
    resetStockActionOperationId();
    const medicine = findMedicine(text(refs.stockMedicineId?.value));
    setStockActionFeedback();
    renderLinkedRequestDetails(medicine, { autofillQuantity: true });
    updateStockActionPreview();
  });
  refs.stockActionQuantity?.addEventListener("input", () => {
    resetStockActionOperationId();
    setStockActionFeedback();
    updateStockActionPreview();
  });
  refs.stockActionDate?.addEventListener("change", () => {
    resetStockActionOperationId();
    setStockActionFeedback();
    updateStockActionPreview();
  });
  refs.stockActionNote?.addEventListener("input", () => {
    resetStockActionOperationId();
    setStockActionFeedback();
    updateStockActionPreview();
  });

  refs.stockDisposeBatchTableBody?.addEventListener("change", (event) => {
    const target = event.target;
    if (target.classList.contains("stock-dispose-batch-check")) {
      const row = target.closest("tr");
      const qtyInput = row?.querySelector(".stock-dispose-qty-input");
      if (target.checked) {
        if (qtyInput) {
          qtyInput.disabled = false;
          const remaining = Number(target.dataset.remaining) || 0;
          if (!qtyInput.value || Number(qtyInput.value) <= 0) {
            qtyInput.value = String(remaining);
          }
          qtyInput.focus();
        }
      } else {
        if (qtyInput) {
          qtyInput.disabled = true;
          qtyInput.value = "";
        }
      }
      setStockActionFeedback();
      updateDisposeSummary();
    }
  });

  refs.stockDisposeBatchTableBody?.addEventListener("input", (event) => {
    const target = event.target;
    if (target.classList.contains("stock-dispose-qty-input")) {
      const remaining = Number(target.max) || 0;
      let val = Number(target.value) || 0;
      if (val > remaining) {
        target.value = String(remaining);
      }
      setStockActionFeedback();
      updateDisposeSummary();
    }
  });

  refs.stockDisposeSelectExpiredBtn?.addEventListener("click", () => {
    let expiredCount = 0;
    const rows = refs.stockDisposeBatchTableBody?.querySelectorAll("tr[data-batch-id]") || [];
    rows.forEach((row) => {
      const check = row.querySelector(".stock-dispose-batch-check");
      const qtyInput = row.querySelector(".stock-dispose-qty-input");
      if (check && check.dataset.isExpired === "1") {
        check.checked = true;
        if (qtyInput) {
          qtyInput.disabled = false;
          qtyInput.value = String(Number(check.dataset.remaining) || 0);
        }
        expiredCount++;
      }
    });
    setStockActionFeedback();
    updateDisposeSummary();
    if (expiredCount === 0) {
      setStockActionFeedback("No expired batches found for this medicine.", "info");
    }
  });

  refs.stockDisposeSelectAllCheck?.addEventListener("change", (event) => {
    const isChecked = event.target.checked;
    const rows = refs.stockDisposeBatchTableBody?.querySelectorAll("tr[data-batch-id]") || [];
    rows.forEach((row) => {
      const check = row.querySelector(".stock-dispose-batch-check");
      const qtyInput = row.querySelector(".stock-dispose-qty-input");
      if (check) {
        check.checked = isChecked;
        if (qtyInput) {
          qtyInput.disabled = !isChecked;
          qtyInput.value = isChecked ? String(Number(check.dataset.remaining) || 0) : "";
        }
      }
    });
    setStockActionFeedback();
    updateDisposeSummary();
  });

  byId("stockActionModal")?.addEventListener("hidden.bs.modal", () => setStockActionFeedback());

  refs.residentLookupInput?.addEventListener("input", (event) => {
    dispenseState.residentSearch = text(event.target.value);
    renderResidentSearchResults();
  });

  refs.residentLookupResults?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-resident-id]");
    if (!button) return;
    const resident = findResidentAccount(text(button.getAttribute("data-resident-id")));
    if (!resident) return;
    setSelectedResident(resident);
  });

  refs.clearSelectedResidentBtn?.addEventListener("click", () => {
    dispenseState.selectedResidentId = "";
    if (refs.selectedResidentId) refs.selectedResidentId.value = "";
    if (refs.residentLookupInput) refs.residentLookupInput.value = "";
    renderSelectedResident();
    renderResidentSearchResults();
  });

  refs.toggleQuickResidentBtn?.addEventListener("click", () => toggleQuickResidentFields());

  refs.inventorySearch?.addEventListener("input", (event) => {
    uiState.search = text(event.target.value);
    renderInventoryTable();
  });

  refs.inventorySearchBtn?.addEventListener("click", () => {
    uiState.search = text(refs.inventorySearch?.value);
    renderInventoryTable();
  });

  refs.categoryFilter?.addEventListener("change", (event) => {
    uiState.category = text(event.target.value) || "all";
    renderInventoryTable();
  });

  refs.statusFilter?.addEventListener("change", (event) => {
    uiState.status = text(event.target.value) || "all";
    uiState.category = "all";
    if (refs.categoryFilter) refs.categoryFilter.value = "all";
    renderAll();
  });

  refs.medicineModalManageBatchesBtn?.addEventListener("click", () => {
    const existingId = text(refs.medicineId?.value);
    const medicine = existingId ? findMedicine(existingId) : null;
    if (!medicine) return;

    const medModalEl = byId("medicineModal");
    if (medModalEl && medModalEl.classList.contains("show")) {
      medModalEl.addEventListener("hidden.bs.modal", () => {
        openBatchDetailsModal(medicine);
      }, { once: true });
      medicineModal?.hide();
    } else {
      medicineModal?.hide();
      openBatchDetailsModal(medicine);
    }
  });

  refs.editBatchForm?.addEventListener("submit", handleEditBatchSubmit);

  refs.editBatchModal?.addEventListener("hidden.bs.modal", () => {
    if (currentBatchDetailsMedicine) {
      setTimeout(() => {
        if (batchEditSaved) {
          batchEditSaved = false;
          openBatchDetailsModal(currentBatchDetailsMedicine);
        } else {
          batchDetailsModal?.show();
        }
      }, 50);
    } else {
      batchEditSaved = false;
    }
  });

  refs.batchHistoryToggleBtn?.addEventListener("click", () => {
    if (currentBatchDetailsMedicine) {
      renderBatchDetailsRows(currentBatchDetailsMedicine, !batchDetailsViewingHistory);
    }
  });

  document.addEventListener("click", (event) => {
    const editBatchBtn = event.target.closest("[data-action='edit-batch'][data-batch-id]");
    if (editBatchBtn) {
      const batchId = text(editBatchBtn.getAttribute("data-batch-id"));
      const medicine = currentBatchDetailsMedicine;
      if (!medicine || !batchId) return;
      const medBatches = (medicine.batches && medicine.batches.length)
        ? medicine.batches
        : (state.inventoryBatches || []).filter((b) => b.medicineId === medicine.id);
      const batch = medBatches.find((b) => String(b.id) === batchId);
      if (batch) {
        const isExhausted = batch.status === "exhausted" || numeric(batch.quantityRemaining) <= 0;
        if (isExhausted) {
          showNotice("Exhausted batch records are locked for audit integrity and cannot be edited.", "warning");
          return;
        }
        openEditBatchModal(batch, medicine);
      }
      return;
    }

    const actionButton = event.target.closest("[data-action][data-id]");
    if (!actionButton) return;

    const medicine = findMedicine(text(actionButton.getAttribute("data-id")));
    if (!medicine) return;

    const action = text(actionButton.getAttribute("data-action"));
    if (action === "edit") {
      openMedicineModal(medicine);
    } else if (action === "adjust") {
      openStockActionModal(medicine, "restock");
    } else if (action === "dispose") {
      openStockActionModal(medicine, "dispose");
    } else if (action === "view-batches") {
      openBatchDetailsModal(medicine);
    } else if (action === "archive") {
      void handleMedicineRecordStatusChange(medicine, "archived");
    } else if (action === "restore") {
      void handleMedicineRecordStatusChange(medicine, "active");
    }
  });

  window.addEventListener("mss:supply-state-updated", (event) => {
    if (!supplyMonitoring) return;
    const changedKeys = Array.isArray(event.detail?.keys) ? event.detail.keys : [];
    const sharedState = event.detail?.state || supplyMonitoring.getState();
    let shouldRender = false;
    if (changedKeys.includes(supplyMonitoring.STORAGE.inventory) && Array.isArray(sharedState.inventory)) {
      state.inventory = sharedState.inventory.map(normalizeMedicine);
      shouldRender = true;
    }
    if (changedKeys.includes(supplyMonitoring.STORAGE.movements) && Array.isArray(sharedState.movements)) {
      state.movements = sharedState.movements.map(normalizeMovement);
      shouldRender = true;
    }
    if (changedKeys.includes(supplyMonitoring.STORAGE.requests)) {
      state.choRequests = supplyMonitoring.readRequests();
      shouldRender = true;
    }
    if (shouldRender) renderAll();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    void hydrateInventoryState().then(renderAll).catch(() => {});
  });

  const initializeInventory = async () => {
    await hydrateInventoryState();
    const pendingDelivery = readPendingStockDelivery();
    if (pendingDelivery && state.movements.some((movement) => movement.id === text(pendingDelivery.operationId))) {
      clearPendingStockDelivery(pendingDelivery.operationId);
    }
    renderAll();
    void syncHouseholdResidents();
  };

  void initializeInventory();
})();
