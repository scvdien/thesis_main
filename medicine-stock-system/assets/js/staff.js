(() => {
  const STORAGE = {
    inventory: "mss_inventory_records_v1",
    movements: "mss_inventory_movements_v1",
    residents: "mss_resident_accounts_v1"
  };
  const ACTIVITY_LOG_STORAGE = "mss_activity_logs_v1";
  const USERS_STORAGE = "mss_users_v1";
  const SESSIONS_STORAGE = "mss_active_sessions_v1";

  const HOUSEHOLD_RESIDENT_API = "../household-system/registration-sync.php";

  const byId = (id) => document.getElementById(id);
  const refs = {
    year: byId("year"),
    sidebar: byId("sidebar"),
    sidebarBackdrop: byId("sidebarBackdrop"),
    sidebarToggle: byId("sidebarToggle"),
    logoutLink: byId("logoutLink"),
    moduleAlert: byId("moduleAlert"),
    residentSearchInput: byId("residentSearchInput"),
    residentLookupResults: byId("residentLookupResults"),
    selectedResidentCard: byId("selectedResidentCard"),
    selectedResidentName: byId("selectedResidentName"),
    selectedResidentMeta: byId("selectedResidentMeta"),
    selectedResidentLast: byId("selectedResidentLast"),
    clearSelectedResidentBtn: byId("clearSelectedResidentBtn"),
    toggleResidentFormBtn: byId("toggleResidentFormBtn"),
    closeResidentFormBtn: byId("closeResidentFormBtn"),
    residentFormPanel: byId("residentFormPanel"),
    residentForm: byId("residentForm"),
    quickResidentName: byId("quickResidentName"),
    quickResidentBarangay: byId("quickResidentBarangay"),
    quickResidentZone: byId("quickResidentZone"),
    quickResidentCity: byId("quickResidentCity"),
    dispenseForm: byId("dispenseForm"),
    dispenseResidentHint: byId("dispenseResidentHint"),
    dispenseRole: byId("dispenseRole"),
    dispenseUser: byId("dispenseUser"),
    dispenseMedicine: byId("dispenseMedicine"),
    dispenseStockPreview: byId("dispenseStockPreview"),
    dispenseQuantity: byId("dispenseQuantity"),
    dispenseDate: byId("dispenseDate"),
    dispenseNote: byId("dispenseNote"),
    dispenseSubmitBtn: byId("dispenseSubmitBtn"),
    historyTitle: byId("historyTitle"),
    historySubtitle: byId("historySubtitle"),
    historyCount: byId("historyCount"),
    historyList: byId("historyList"),
    settingsForm: byId("settingsForm"),
    settingsProfileCard: byId("settingsProfileCard"),
    settingsProfileName: byId("settingsProfileName"),
    settingsProfileMeta: byId("settingsProfileMeta"),
    settingsRoleChip: byId("settingsRoleChip"),
    settingsSessionChip: byId("settingsSessionChip"),
    settingsStatusChip: byId("settingsStatusChip"),
    settingsFullName: byId("settingsFullName"),
    settingsContact: byId("settingsContact"),
    settingsUsername: byId("settingsUsername"),
    settingsRole: byId("settingsRole"),
    settingsPassword: byId("settingsPassword"),
    settingsConfirmPassword: byId("settingsConfirmPassword"),
    settingsHelperText: byId("settingsHelperText"),
    settingsSubmitBtn: byId("settingsSubmitBtn")
  };
  const staffNavLinks = Array.from(document.querySelectorAll("#sidebar .menu a[href^='#']"));
  const staffSections = Array.from(document.querySelectorAll("[data-staff-section]"));

  const logoutModal = byId("logoutModal") && window.bootstrap ? new window.bootstrap.Modal(byId("logoutModal")) : null;

  if (refs.year) refs.year.textContent = String(new Date().getFullYear());

  const state = {
    inventory: [],
    movements: [],
    residentAccounts: [],
    residentSearch: "",
    selectedResidentId: "",
    currentUserId: "",
    residentFormOpen: false,
    householdResidentsLoaded: false
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
  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(numeric(value)));
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
  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;
  const todayInputValue = () => {
    const current = new Date();
    const offset = current.getTimezoneOffset() * 60000;
    return new Date(current.getTime() - offset).toISOString().slice(0, 10);
  };

  if (refs.dispenseDate) refs.dispenseDate.value = todayInputValue();

  const daysUntil = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    parsed.setHours(0, 0, 0, 0);
    return Math.round((parsed.getTime() - today.getTime()) / 86400000);
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

  const USER_ROLE_ADMIN = "Admin";
  const USER_ROLE_BHW = "BHW";
  const parseTimestamp = (value) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  };
  const normalizeUserRole = (value) => text(value) === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW;
  const normalizeModuleUser = (entry = {}) => {
    const role = normalizeUserRole(text(entry.role) || text(entry.accountType));
    return {
      ...entry,
      id: text(entry.id) || uid(),
      fullName: text(entry.fullName),
      username: text(entry.username),
      contact: text(entry.contact),
      role,
      accountType: role === USER_ROLE_ADMIN ? USER_ROLE_ADMIN : USER_ROLE_BHW,
      status: text(entry.status) || "Active",
      password: String(entry.password || ""),
      createdAt: text(entry.createdAt) || nowIso(),
      updatedAt: text(entry.updatedAt) || text(entry.createdAt) || nowIso(),
      updatedBy: text(entry.updatedBy) || "System Seed"
    };
  };
  const getStoredUsers = () => readList(USERS_STORAGE).map(normalizeModuleUser);
  const getStoredSessions = () => readList(SESSIONS_STORAGE)
    .sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
  const writeStoredUsers = (users) => localStorage.setItem(USERS_STORAGE, JSON.stringify(users));
  const writeStoredSessions = (sessions) => localStorage.setItem(SESSIONS_STORAGE, JSON.stringify(sessions));
  const roleName = (value) => keyOf(value) === "staff" ? "Staff" : "BHW";
  const defaultUsernameForRole = (role) => keyOf(role) === "staff" ? "staff.user" : "bhw.user";
  const defaultIpForRole = (role) => keyOf(role) === "staff" ? "192.168.10.24" : "192.168.10.31";

  const makeUsername = (value, fallback = "bhw.user") => {
    const slug = keyOf(value)
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "");
    return slug || fallback;
  };

  const findStoredUser = ({ fullName = "", accountType = "" } = {}) => {
    const users = readList(USERS_STORAGE);
    if (!fullName) return null;

    return users.find((user) => {
      const sameName = keyOf(user.fullName) === keyOf(fullName);
      if (!sameName) return false;
      if (!accountType) return true;
      return keyOf(user.accountType) === keyOf(accountType) || keyOf(user.role) === keyOf(accountType);
    }) || null;
  };

  const resolveSessionIp = (userId, fallbackIp) => {
    if (!userId) return fallbackIp;
    const sessions = readList(SESSIONS_STORAGE);
    const activeSession = sessions.find((session) => text(session.userId) === text(userId));
    return text(activeSession?.ipAddress) || fallbackIp;
  };

  const getCurrentBhwUser = () => {
    const users = getStoredUsers();
    const selected = users.find((user) => text(user.id) === text(state.currentUserId) && text(user.role) !== USER_ROLE_ADMIN);
    if (selected) return selected;

    const sessions = getStoredSessions();
    const fromSession = sessions
      .map((session) => users.find((user) => text(user.id) === text(session.userId)))
      .find((user) => user && text(user.role) !== USER_ROLE_ADMIN && text(user.status) === "Active");

    const fallback = fromSession
      || users.find((user) => text(user.role) !== USER_ROLE_ADMIN && text(user.status) === "Active")
      || users.find((user) => text(user.role) !== USER_ROLE_ADMIN)
      || null;

    state.currentUserId = fallback?.id || "";
    return fallback;
  };

  const getCurrentBhwSession = (userId) => getStoredSessions().find((session) => text(session.userId) === text(userId)) || null;

  const setSettingsDisabled = (disabled) => {
    if (!refs.settingsForm) return;
    refs.settingsForm.querySelectorAll("input, button").forEach((field) => {
      field.disabled = disabled;
    });
    if (!disabled) {
      if (refs.settingsUsername) refs.settingsUsername.disabled = false;
      if (refs.settingsRole) refs.settingsRole.disabled = false;
    }
  };

  const appendActivityLog = ({
    actor = "BHW",
    username = "bhw.user",
    action = "Updated medicine release",
    actionType = "updated",
    target = "",
    details = "",
    category = "Dispensing",
    resultLabel = "Success",
    resultTone = "success",
    createdAt = nowIso(),
    ipAddress = "192.168.10.31"
  }) => {
    const logs = readList(ACTIVITY_LOG_STORAGE);
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

  const saveState = () => {
    localStorage.setItem(STORAGE.inventory, JSON.stringify(state.inventory));
    localStorage.setItem(STORAGE.movements, JSON.stringify(state.movements));
    localStorage.setItem(STORAGE.residents, JSON.stringify(state.residentAccounts));
  };
  const emitInventoryNotificationRefresh = () => {
    window.dispatchEvent(new CustomEvent("mss:inventory-updated"));
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

  const setActiveSection = (sectionId) => {
    const fallbackId = staffSections[0]?.id || "";
    const nextId = staffSections.some((section) => section.id === sectionId) ? sectionId : fallbackId;
    if (!nextId) return;

    staffSections.forEach((section) => {
      section.classList.toggle("is-active", section.id === nextId);
    });

    staffNavLinks.forEach((link) => {
      link.classList.toggle("active", text(link.getAttribute("href")).replace(/^#/, "") === nextId);
    });
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

    return {
      id: text(entry.id) || uid(),
      name: text(entry.name),
      genericName: text(entry.genericName),
      category: text(entry.category) || "General",
      form: text(entry.form) || "Tablet",
      strength: text(entry.strength),
      stockOnHand: Math.max(0, Math.round(numeric(entry.stockOnHand))),
      reorderLevel: Math.max(1, Math.round(numeric(entry.reorderLevel) || 1)),
      unit: text(entry.unit) || "units",
      batchNumber: text(entry.batchNumber) || "-",
      expiryDate: safeExpiry,
      supplier: text(entry.supplier) || "Ligao City Coastal RHU Supply",
      location: text(entry.location) || "Main Cabinet",
      unitCost: Number(numeric(entry.unitCost).toFixed(2)),
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

  const residentAddressLabel = (resident) => [
    text(resident.zone),
    text(resident.barangay),
    text(resident.city)
  ].filter(Boolean).join(", ");

  const medicineLabel = (medicine) => `${text(medicine.name)}${text(medicine.strength) ? ` ${text(medicine.strength)}` : ""}`;

  const seedInventory = () => ([
    {
      name: "Paracetamol",
      genericName: "Acetaminophen",
      category: "Analgesic",
      form: "Tablet",
      strength: "500mg",
      stockOnHand: 540,
      reorderLevel: 220,
      unit: "tablets",
      batchNumber: "PCM-2026-041",
      expiryDate: "2026-09-14",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Main Cabinet A",
      unitCost: 2.15
    },
    {
      name: "Amoxicillin",
      genericName: "Amoxicillin Trihydrate",
      category: "Antibiotic",
      form: "Capsule",
      strength: "500mg",
      stockOnHand: 95,
      reorderLevel: 160,
      unit: "capsules",
      batchNumber: "AMX-2026-013",
      expiryDate: "2026-05-22",
      supplier: "DOH Provincial Supply",
      location: "Antibiotic Shelf",
      unitCost: 5.4
    },
    {
      name: "Cetirizine",
      genericName: "Cetirizine Hydrochloride",
      category: "Antihistamine",
      form: "Tablet",
      strength: "10mg",
      stockOnHand: 132,
      reorderLevel: 120,
      unit: "tablets",
      batchNumber: "CTZ-2026-020",
      expiryDate: "2026-08-09",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Allergy Drawer",
      unitCost: 3.8
    },
    {
      name: "ORS",
      genericName: "Oral Rehydration Salts",
      category: "Hydration",
      form: "Sachet",
      strength: "20.5g",
      stockOnHand: 62,
      reorderLevel: 120,
      unit: "sachets",
      batchNumber: "ORS-2026-115",
      expiryDate: "2026-04-30",
      supplier: "DOH Provincial Supply",
      location: "Emergency Rack",
      unitCost: 7.25
    },
    {
      name: "Lagundi",
      genericName: "Vitex negundo",
      category: "Herbal",
      form: "Syrup",
      strength: "60mL",
      stockOnHand: 28,
      reorderLevel: 40,
      unit: "bottles",
      batchNumber: "LGD-2026-018",
      expiryDate: "2026-04-16",
      supplier: "LGU Herbal Procurement",
      location: "Liquid Cabinet",
      unitCost: 68
    },
    {
      name: "Zinc Sulfate",
      genericName: "Zinc Sulfate",
      category: "Supplement",
      form: "Tablet",
      strength: "20mg",
      stockOnHand: 0,
      reorderLevel: 90,
      unit: "tablets",
      batchNumber: "ZNC-2026-006",
      expiryDate: "2026-07-20",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Supplement Shelf",
      unitCost: 1.9
    },
    {
      name: "Metformin",
      genericName: "Metformin Hydrochloride",
      category: "Maintenance",
      form: "Tablet",
      strength: "500mg",
      stockOnHand: 186,
      reorderLevel: 140,
      unit: "tablets",
      batchNumber: "MTF-2026-044",
      expiryDate: "2026-11-03",
      supplier: "City Medical Depot",
      location: "Maintenance Cabinet",
      unitCost: 4.3
    },
    {
      name: "Salbutamol",
      genericName: "Salbutamol Sulfate",
      category: "Respiratory",
      form: "Tablet",
      strength: "2mg",
      stockOnHand: 74,
      reorderLevel: 110,
      unit: "tablets",
      batchNumber: "SLB-2026-017",
      expiryDate: "2026-06-18",
      supplier: "City Medical Depot",
      location: "Respiratory Tray",
      unitCost: 3.15
    },
    {
      name: "Amlodipine",
      genericName: "Amlodipine Besylate",
      category: "Maintenance",
      form: "Tablet",
      strength: "5mg",
      stockOnHand: 154,
      reorderLevel: 100,
      unit: "tablets",
      batchNumber: "AML-2026-008",
      expiryDate: "2026-10-01",
      supplier: "Ligao City Coastal RHU Supply",
      location: "Maintenance Cabinet",
      unitCost: 6.1
    }
  ]).map((entry, index) => normalizeMedicine({
    ...entry,
    lastUpdatedAt: new Date(Date.now() - ((index + 1) * 3600000)).toISOString()
  }));

  const seedResidentAccounts = () => ([
    {
      residentId: "RS-2026-0012",
      householdId: "HH-2026-004",
      fullName: "Maria Santos",
      barangay: "Cabarian",
      zone: "Zone 2",
      city: "Ligao City",
      province: "Albay",
      source: "household-system"
    },
    {
      residentId: "RS-2026-0048",
      householdId: "HH-2026-011",
      fullName: "Juan Dela Cruz",
      barangay: "Cabarian",
      zone: "Zone 4",
      city: "Ligao City",
      province: "Albay",
      source: "household-system"
    },
    {
      residentId: "MSR-2026-0001",
      fullName: "Lorna Reyes",
      barangay: "Bonga",
      city: "Ligao City",
      province: "Albay",
      source: "medicine-system"
    },
    {
      residentId: "MSR-2026-0002",
      fullName: "Kevin Ramos",
      barangay: "Tinago",
      city: "Ligao City",
      province: "Albay",
      source: "medicine-system"
    },
    {
      residentId: "MSR-2026-0003",
      fullName: "Ana Lopez",
      barangay: "Busac",
      city: "Oas",
      province: "Albay",
      source: "medicine-system"
    }
  ]).map(normalizeResidentAccount);

  const seedMovements = (inventory) => {
    const findByName = (name) => inventory.find((medicine) => medicine.name === name);
    return [
      {
        medicineName: "Paracetamol",
        actionType: "restock",
        quantity: 180,
        stockBefore: 360,
        stockAfter: 540,
        createdAt: new Date(Date.now() - (2 * 3600000)).toISOString(),
        note: "Monthly replenishment from RHU supply."
      },
      {
        medicineName: "ORS",
        actionType: "dispense",
        quantity: 18,
        stockBefore: 80,
        stockAfter: 62,
        createdAt: new Date(Date.now() - (5 * 3600000)).toISOString(),
        note: "Distributed for diarrhea support cases.",
        recipientId: "RS-2026-0012",
        recipientName: "Maria Santos",
        recipientBarangay: "Cabarian",
        releasedByRole: "BHW",
        releasedByName: "Assigned BHW"
      },
      {
        medicineName: "Lagundi",
        actionType: "dispense",
        quantity: 6,
        stockBefore: 34,
        stockAfter: 28,
        createdAt: new Date(Date.now() - (9 * 3600000)).toISOString(),
        note: "Released for cough and colds consultations.",
        recipientId: "MSR-2026-0001",
        recipientName: "Lorna Reyes",
        recipientBarangay: "Bonga",
        releasedByRole: "BHW",
        releasedByName: "Field BHW"
      },
      {
        medicineName: "Zinc Sulfate",
        actionType: "dispose",
        quantity: 20,
        stockBefore: 20,
        stockAfter: 0,
        createdAt: new Date(Date.now() - (26 * 3600000)).toISOString(),
        note: "Expired batch removed from shelf."
      },
      {
        medicineName: "Salbutamol",
        actionType: "restock",
        quantity: 40,
        stockBefore: 34,
        stockAfter: 74,
        createdAt: new Date(Date.now() - (34 * 3600000)).toISOString(),
        note: "Supplemental request delivered by city medical depot."
      }
    ].map((entry) => {
      const medicine = findByName(entry.medicineName);
      return normalizeMovement({
        ...entry,
        medicineId: medicine?.id || "",
        user: entry.releasedByName || "Nurse-in-Charge"
      });
    });
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
      existing.lastDispensedAt = existing.lastDispensedAt || incoming.lastDispensedAt;
      existing.lastDispensedMedicine = existing.lastDispensedMedicine || incoming.lastDispensedMedicine;

      if (JSON.stringify(existing) !== snapshot) {
        changed = true;
      }
    });

    state.residentAccounts.sort((left, right) => text(left.fullName).localeCompare(text(right.fullName)));
    return changed;
  };

  const ensureSeedData = () => {
    state.inventory = readList(STORAGE.inventory).map(normalizeMedicine);
    state.movements = readList(STORAGE.movements).map(normalizeMovement);
    state.residentAccounts = readList(STORAGE.residents).map(normalizeResidentAccount);

    if (!state.inventory.length) {
      state.inventory = seedInventory();
    }

    if (!state.residentAccounts.length) {
      state.residentAccounts = seedResidentAccounts();
    }

    if (!state.movements.length) {
      state.movements = seedMovements(state.inventory);
    }

    saveState();
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
        renderResidentSearchResults();
      }
    } catch (error) {
      // Keep local resident lookup available even if sync fails.
    }
  };

  const getStatus = (medicine) => {
    const stock = numeric(medicine.stockOnHand);
    const reorderLevel = Math.max(1, numeric(medicine.reorderLevel));
    const expiryDays = daysUntil(medicine.expiryDate);

    if (stock <= 0) {
      return { key: "out-of-stock", label: "Out of Stock", tone: "danger", note: "No units on hand" };
    }

    if (expiryDays < 0) {
      return { key: "expired", label: "Expired", tone: "danger", note: `${Math.abs(expiryDays)} days overdue` };
    }

    if (expiryDays <= 30) {
      return { key: "expiring-soon", label: "Expiring Soon", tone: "warning", note: `${expiryDays} days remaining` };
    }

    if (stock <= Math.max(5, Math.round(reorderLevel * 0.5))) {
      return { key: "critical", label: "Critical", tone: "danger", note: "Below half of reorder level" };
    }

    if (stock <= reorderLevel) {
      return { key: "low-stock", label: "Low Stock", tone: "warning", note: "At or below reorder level" };
    }

    return { key: "healthy", label: "Healthy", tone: "success", note: "Stock within target range" };
  };

  const findMedicine = (id) => state.inventory.find((medicine) => medicine.id === id) || null;
  const findResidentAccount = (id) => state.residentAccounts.find((resident) =>
    text(resident.id) === text(id) || text(resident.residentId) === text(id)
  ) || null;

  const clearResidentForm = () => {
    refs.residentForm?.reset();
    if (refs.quickResidentCity) refs.quickResidentCity.value = "Ligao City";
  };

  const toggleResidentForm = (forceOpen = null) => {
    state.residentFormOpen = typeof forceOpen === "boolean" ? forceOpen : !state.residentFormOpen;
    refs.residentFormPanel?.classList.toggle("d-none", !state.residentFormOpen);
    if (refs.toggleResidentFormBtn) {
      refs.toggleResidentFormBtn.textContent = state.residentFormOpen ? "Hide Form" : "New Account";
    }
    if (!state.residentFormOpen) clearResidentForm();
  };

  const setSelectedResident = (resident) => {
    state.selectedResidentId = resident?.id || "";
    if (refs.residentSearchInput && resident) {
      refs.residentSearchInput.value = resident.fullName;
      state.residentSearch = resident.fullName;
    }
    toggleResidentForm(false);
    renderSelectedResident();
    renderResidentSearchResults();
    renderHistory();
  };

  const sortedResidentAccounts = () => {
    const query = text(state.residentSearch).toLowerCase();
    const selectedId = text(state.selectedResidentId);

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

  const updateDispenseFormState = () => {
    const resident = findResidentAccount(state.selectedResidentId);
    const hasResident = Boolean(resident);
    if (refs.dispenseSubmitBtn) refs.dispenseSubmitBtn.disabled = !hasResident;

    if (!refs.dispenseResidentHint) return;
    if (!resident) {
      refs.dispenseResidentHint.innerHTML = "<strong>No resident selected</strong><span>Select a resident account first.</span>";
      return;
    }

    const meta = [resident.residentId, residentAddressLabel(resident)].filter(Boolean).join(" | ");
    refs.dispenseResidentHint.innerHTML = `<strong>${esc(resident.fullName)}</strong><span>${esc(meta || "Resident account")}</span>`;
  };

  const renderSelectedResident = () => {
    const resident = findResidentAccount(state.selectedResidentId);
    const hasResident = Boolean(resident);
    refs.selectedResidentCard?.classList.toggle("d-none", !hasResident);

    if (!hasResident || !resident) {
      updateDispenseFormState();
      return;
    }

    if (refs.selectedResidentName) refs.selectedResidentName.textContent = resident.fullName;
    if (refs.selectedResidentMeta) {
      refs.selectedResidentMeta.textContent = [resident.residentId, residentAddressLabel(resident)].filter(Boolean).join(" | ");
    }
    if (refs.selectedResidentLast) {
      refs.selectedResidentLast.textContent = resident.lastDispensedAt
        ? `Last release: ${resident.lastDispensedMedicine || "Medicine"} on ${formatDateTime(resident.lastDispensedAt)}`
        : "No release history yet.";
    }

    updateDispenseFormState();
  };

  const renderResidentSearchResults = () => {
    if (!refs.residentLookupResults) return;
    const results = sortedResidentAccounts();

    if (!results.length) {
      refs.residentLookupResults.innerHTML = '<div class="staff-empty">No matching resident account.</div>';
      return;
    }

    refs.residentLookupResults.innerHTML = results.map((resident) => {
      const isActive = text(resident.id) === text(state.selectedResidentId) ? " is-active" : "";
      const location = residentAddressLabel(resident) || resident.barangay || "Resident account";
      const sourceLabel = resident.source === "household-system" ? "Resident" : "Saved";

      return `
        <button type="button" class="staff-resident-option${isActive}" data-resident-id="${esc(resident.id)}">
          <div>
            <strong>${esc(resident.fullName)}</strong>
            <span>${esc(resident.residentId)}${text(resident.householdId) ? ` | ${esc(resident.householdId)}` : ""}</span>
            <small>${esc(location)}</small>
          </div>
          <span class="staff-chip">${esc(sourceLabel)}</span>
        </button>
      `;
    }).join("");
  };

  const renderMedicineOptions = () => {
    if (!refs.dispenseMedicine) return;
    const current = text(refs.dispenseMedicine.value);
    const medicines = [...state.inventory].sort((left, right) => medicineLabel(left).localeCompare(medicineLabel(right)));

    refs.dispenseMedicine.innerHTML = [
      '<option value="">Select medicine</option>',
      ...medicines.map((medicine) => {
        const status = getStatus(medicine);
        return `<option value="${esc(medicine.id)}">${esc(medicineLabel(medicine))} | ${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)} | ${esc(status.label)}</option>`;
      })
    ].join("");

    const hasCurrent = medicines.some((medicine) => medicine.id === current);
    refs.dispenseMedicine.value = hasCurrent ? current : "";
    renderStockPreview();
  };

  const renderStockPreview = () => {
    if (!refs.dispenseStockPreview) return;
    const medicine = findMedicine(text(refs.dispenseMedicine?.value));

    if (!medicine) {
      refs.dispenseStockPreview.className = "staff-stock-preview";
      refs.dispenseStockPreview.innerHTML = "<strong>No medicine selected</strong><span>Choose a medicine to view stock details.</span>";
      return;
    }

    const status = getStatus(medicine);
    refs.dispenseStockPreview.className = `staff-stock-preview staff-stock-preview--${status.tone}`;
    refs.dispenseStockPreview.innerHTML = `
      <strong>${esc(formatNumber(medicine.stockOnHand))} ${esc(medicine.unit)} available</strong>
      <span>${esc(status.label)} | Exp ${esc(formatDate(medicine.expiryDate))} | ${esc(medicine.location || "Main Cabinet")}</span>
    `;
  };

  const syncDispenseUserPlaceholder = ({ previousName = "", force = false } = {}) => {
    if (!refs.dispenseUser) return;
    refs.dispenseUser.placeholder = roleName(refs.dispenseRole?.value) === "Staff"
      ? "Assigned staff name"
      : "Assigned BHW name";

    if (roleName(refs.dispenseRole?.value) !== "BHW") return;
    const user = getCurrentBhwUser();
    if (!user) return;

    const currentValue = text(refs.dispenseUser.value);
    if (force || !currentValue || (previousName && keyOf(currentValue) === keyOf(previousName))) {
      refs.dispenseUser.value = user.fullName;
    }
  };

  const renderSettings = () => {
    const user = getCurrentBhwUser();
    const session = user ? getCurrentBhwSession(user.id) : null;

    if (!user) {
      if (refs.settingsProfileName) refs.settingsProfileName.textContent = "No BHW account linked";
      if (refs.settingsProfileMeta) refs.settingsProfileMeta.textContent = "Admin needs to create a BHW account before personal settings can be updated.";
      if (refs.settingsRoleChip) refs.settingsRoleChip.textContent = "BHW";
      if (refs.settingsSessionChip) refs.settingsSessionChip.textContent = "Not linked";
      if (refs.settingsStatusChip) refs.settingsStatusChip.textContent = "Pending";
      if (refs.settingsHelperText) refs.settingsHelperText.textContent = "Ask the Nurse-in-Charge to create your BHW account first.";
      refs.settingsForm?.reset();
      if (refs.settingsUsername) refs.settingsUsername.value = "";
      if (refs.settingsRole) refs.settingsRole.value = "BHW";
      setSettingsDisabled(true);
      return;
    }

    const statusLabel = text(user.status) || "Active";
    const presenceLabel = text(session?.presence) || statusLabel;
    const meta = [
      user.username ? `@${user.username}` : "",
      user.contact || "No contact number",
      text(session?.location) ? `Current module: ${text(session.location)}` : ""
    ].filter(Boolean).join(" | ");

    if (refs.settingsProfileName) refs.settingsProfileName.textContent = user.fullName || "Assigned BHW";
    if (refs.settingsProfileMeta) refs.settingsProfileMeta.textContent = meta || "BHW account is ready.";
    if (refs.settingsRoleChip) refs.settingsRoleChip.textContent = roleName(user.role);
    if (refs.settingsSessionChip) refs.settingsSessionChip.textContent = text(user.status) === "Active" ? presenceLabel : statusLabel;
    if (refs.settingsStatusChip) refs.settingsStatusChip.textContent = "Personal";
    if (refs.settingsFullName) refs.settingsFullName.value = user.fullName || "";
    if (refs.settingsContact) refs.settingsContact.value = user.contact || "";
    if (refs.settingsUsername) refs.settingsUsername.value = user.username || "";
    if (refs.settingsRole) refs.settingsRole.value = roleName(user.role);
    if (refs.settingsPassword) refs.settingsPassword.value = "";
    if (refs.settingsConfirmPassword) refs.settingsConfirmPassword.value = "";
    if (refs.settingsHelperText) refs.settingsHelperText.textContent = "You can update your own profile and password here.";

    setSettingsDisabled(false);
    syncDispenseUserPlaceholder();
  };

  const renderHistory = () => {
    if (!refs.historyList) return;
    const resident = findResidentAccount(state.selectedResidentId);
    const allDispense = state.movements
      .filter((movement) => text(movement.actionType).toLowerCase() === "dispense")
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

    const filtered = resident
      ? allDispense.filter((movement) =>
        text(movement.recipientId).toLowerCase() === text(resident.residentId).toLowerCase()
        || (
          !text(movement.recipientId)
          && text(movement.recipientName).toLowerCase() === text(resident.fullName).toLowerCase()
        )
      )
      : allDispense;

    const items = filtered.slice(0, 8);
    if (refs.historyTitle) refs.historyTitle.textContent = resident ? "Resident History" : "Recent Releases";
    if (refs.historySubtitle) {
      refs.historySubtitle.textContent = resident
        ? `Latest releases recorded for ${resident.fullName}.`
        : "Latest medicine releases recorded by BHW.";
    }
    if (refs.historyCount) refs.historyCount.textContent = `${formatNumber(filtered.length)} entr${filtered.length === 1 ? "y" : "ies"}`;

    if (!items.length) {
      refs.historyList.innerHTML = '<div class="staff-empty">No dispensing records found.</div>';
      return;
    }

    refs.historyList.innerHTML = items.map((movement) => {
      const actor = [roleName(movement.releasedByRole), text(movement.releasedByName) || text(movement.user)]
        .filter(Boolean)
        .join(" | ");
      const residentMeta = [text(movement.recipientName), text(movement.recipientBarangay)].filter(Boolean).join(" | ");
      return `
        <article class="staff-history-item">
          <div class="staff-history-item__meta">
            <strong>${esc(movement.medicineName || "Medicine Release")}</strong>
            <span>${esc(formatNumber(movement.quantity))} unit${numeric(movement.quantity) === 1 ? "" : "s"} dispensed</span>
            <small>${esc(residentMeta || "Resident account")}</small>
            <small>${esc(movement.note || "Dispensing record saved.")}</small>
          </div>
          <div class="staff-history-item__tail">
            <span class="staff-chip staff-chip--neutral">${esc(actor || "BHW")}</span>
            <small>${esc(formatDateTime(movement.createdAt))}</small>
            <small>${esc(formatNumber(movement.stockBefore))} to ${esc(formatNumber(movement.stockAfter))}</small>
          </div>
        </article>
      `;
    }).join("");
  };

  const createResidentAccount = () => {
    const fullName = text(refs.quickResidentName?.value);
    const barangay = text(refs.quickResidentBarangay?.value);
    const zone = text(refs.quickResidentZone?.value);
    const city = text(refs.quickResidentCity?.value) || "Ligao City";

    if (!fullName || !barangay) {
      showNotice("Complete the resident name and barangay to save the account.", "danger");
      return null;
    }

    const resident = normalizeResidentAccount({
      id: uid(),
      residentId: nextResidentAccountCode(),
      fullName,
      barangay,
      zone,
      city,
      province: "Albay",
      source: "medicine-system"
    });

    mergeResidentAccounts([resident]);
    saveState();
    clearResidentForm();
    renderResidentSearchResults();
    setSelectedResident(resident);
    showNotice(`${resident.fullName} was added to resident accounts.`);
    return resident;
  };

  const handleResidentFormSubmit = (event) => {
    event.preventDefault();
    void createResidentAccount();
  };

  const handleDispenseSubmit = (event) => {
    event.preventDefault();
    const resident = findResidentAccount(state.selectedResidentId);
    const medicine = findMedicine(text(refs.dispenseMedicine?.value));
    const quantity = Math.max(0, Math.round(numeric(refs.dispenseQuantity?.value)));
    const releasedByRole = roleName(refs.dispenseRole?.value);
    const releasedByName = text(refs.dispenseUser?.value);
    const actionDate = text(refs.dispenseDate?.value) || todayInputValue();
    const note = text(refs.dispenseNote?.value);

    if (!resident) {
      showNotice("Select or create a resident account before releasing medicine.", "danger");
      return;
    }

    if (!medicine) {
      showNotice("Select a medicine to release.", "danger");
      return;
    }

    if (!releasedByName) {
      showNotice(`Enter the assigned ${releasedByRole === "Staff" ? "staff" : "BHW"} name.`, "danger");
      return;
    }

    if (quantity <= 0) {
      showNotice("Enter a valid quantity to release.", "danger");
      return;
    }

    if (quantity > medicine.stockOnHand) {
      showNotice("Release quantity cannot be greater than available stock.", "danger");
      return;
    }

    const stockBefore = medicine.stockOnHand;
    const stockAfter = stockBefore - quantity;
    const createdAt = `${actionDate}T08:00:00`;

    medicine.stockOnHand = stockAfter;
    medicine.lastUpdatedAt = createdAt;
    medicine.updatedBy = `${releasedByRole}: ${releasedByName}`;

    resident.lastDispensedAt = createdAt;
    resident.lastDispensedMedicine = medicineLabel(medicine);

    state.movements.unshift(normalizeMovement({
      medicineId: medicine.id,
      medicineName: medicineLabel(medicine),
      actionType: "dispense",
      quantity,
      stockBefore,
      stockAfter,
      note: note || `Dispensed to ${resident.fullName}${resident.residentId ? ` (${resident.residentId})` : ""}.`,
      createdAt,
      user: releasedByName,
      recipientId: resident.residentId,
      recipientName: resident.fullName,
      recipientBarangay: resident.barangay,
      releasedByRole,
      releasedByName
    }));

    const storedUser = findStoredUser({ fullName: releasedByName, accountType: releasedByRole });
    const username = text(storedUser?.username) || makeUsername(releasedByName, defaultUsernameForRole(releasedByRole));
    const ipAddress = resolveSessionIp(storedUser?.id, defaultIpForRole(releasedByRole));
    const residentLabel = resident.residentId ? `${resident.fullName} (${resident.residentId})` : resident.fullName;
    const detailParts = [
      `${formatNumber(quantity)} ${medicine.unit} dispensed to ${residentLabel}.`,
      `Released by ${releasedByRole}: ${releasedByName}.`,
      `Stock updated from ${formatNumber(stockBefore)} to ${formatNumber(stockAfter)} ${medicine.unit}.`
    ];

    if (note) {
      detailParts.push(`Note: ${note}`);
    }

    appendActivityLog({
      actor: releasedByName,
      username,
      action: "Dispensed medicine",
      actionType: "updated",
      target: medicineLabel(medicine),
      details: detailParts.join(" "),
      category: "Dispensing",
      resultLabel: "Released",
      resultTone: "success",
      createdAt,
      ipAddress
    });

    saveState();
    renderSelectedResident();
    renderResidentSearchResults();
    renderMedicineOptions();
    renderHistory();
    emitInventoryNotificationRefresh();

    if (refs.dispenseQuantity) refs.dispenseQuantity.value = "";
    if (refs.dispenseNote) refs.dispenseNote.value = "";
    if (refs.dispenseDate) refs.dispenseDate.value = todayInputValue();
    renderStockPreview();

    showNotice(`${medicine.name} released to ${resident.fullName}.`);
  };

  const handleSettingsSubmit = (event) => {
    event.preventDefault();

    const users = getStoredUsers();
    const userIndex = users.findIndex((user) => text(user.id) === text(state.currentUserId) && text(user.role) !== USER_ROLE_ADMIN);
    if (userIndex < 0) {
      showNotice("No active BHW account is available for this module.", "danger");
      renderSettings();
      return;
    }

    const currentUser = users[userIndex];
    const previousName = currentUser.fullName;
    const fullName = text(refs.settingsFullName?.value);
    const contact = text(refs.settingsContact?.value);
    const password = String(refs.settingsPassword?.value || "");
    const confirm = String(refs.settingsConfirmPassword?.value || "");
    const profileChanged = fullName !== text(currentUser.fullName) || contact !== text(currentUser.contact);
    const passwordChanged = Boolean(password || confirm);

    if (!fullName || !contact) {
      showNotice("Complete your full name and contact number first.", "danger");
      return;
    }

    if (!profileChanged && !passwordChanged) {
      showNotice("No changes to save yet.", "danger");
      return;
    }

    if (passwordChanged) {
      if (!password || !confirm) {
        showNotice("Enter and confirm the new password.", "danger");
        return;
      }
      if (password.length < 8) {
        showNotice("New password must be at least 8 characters.", "danger");
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        showNotice("Password must include at least 1 special character.", "danger");
        return;
      }
      if (password !== confirm) {
        showNotice("Password and confirmation do not match.", "danger");
        return;
      }
    }

    const updatedAt = nowIso();
    const nextUser = {
      ...currentUser,
      fullName,
      contact,
      updatedAt,
      updatedBy: previousName || "BHW Self-Service"
    };

    if (passwordChanged) {
      nextUser.password = password;
    }

    users[userIndex] = nextUser;
    writeStoredUsers(users);

    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex((session) => text(session.userId) === text(nextUser.id));
    if (sessionIndex >= 0) {
      sessions[sessionIndex] = {
        ...sessions[sessionIndex],
        fullName: nextUser.fullName,
        username: nextUser.username,
        role: nextUser.role,
        accountType: nextUser.accountType,
        presence: text(sessions[sessionIndex].presence) || "Online",
        location: "BHW Settings",
        lastSeenAt: updatedAt
      };
    } else {
      sessions.unshift({
        id: uid(),
        userId: nextUser.id,
        fullName: nextUser.fullName,
        username: nextUser.username,
        role: nextUser.role,
        accountType: nextUser.accountType,
        presence: "Online",
        location: "BHW Settings",
        deviceLabel: "Android Tablet",
        ipAddress: defaultIpForRole(nextUser.role),
        signedInAt: updatedAt,
        lastSeenAt: updatedAt
      });
    }
    sessions.sort((left, right) => parseTimestamp(right.lastSeenAt) - parseTimestamp(left.lastSeenAt));
    writeStoredSessions(sessions);

    const detailParts = [];
    if (profileChanged) detailParts.push("Profile details were updated from My Settings.");
    if (passwordChanged) detailParts.push("Password was changed from My Settings.");

    appendActivityLog({
      actor: nextUser.fullName,
      username: nextUser.username || makeUsername(nextUser.fullName, defaultUsernameForRole(nextUser.role)),
      action: passwordChanged && profileChanged
        ? "Updated BHW profile and password"
        : passwordChanged
          ? "Changed BHW password"
          : "Updated BHW profile",
      actionType: passwordChanged ? "security" : "updated",
      target: nextUser.fullName,
      details: detailParts.join(" "),
      category: passwordChanged ? "Security" : "BHW Settings",
      resultLabel: "Saved",
      resultTone: "success",
      createdAt: updatedAt,
      ipAddress: resolveSessionIp(nextUser.id, defaultIpForRole(nextUser.role))
    });

    state.currentUserId = nextUser.id;
    syncDispenseUserPlaceholder({ previousName, force: true });
    renderSettings();
    showNotice("My settings updated successfully.");
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

  refs.residentSearchInput?.addEventListener("input", (event) => {
    state.residentSearch = text(event.target.value);
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
    state.selectedResidentId = "";
    state.residentSearch = "";
    if (refs.residentSearchInput) refs.residentSearchInput.value = "";
    renderSelectedResident();
    renderResidentSearchResults();
    renderHistory();
  });

  refs.toggleResidentFormBtn?.addEventListener("click", () => toggleResidentForm());
  refs.closeResidentFormBtn?.addEventListener("click", () => toggleResidentForm(false));
  refs.residentForm?.addEventListener("submit", handleResidentFormSubmit);
  refs.dispenseMedicine?.addEventListener("change", renderStockPreview);
  refs.dispenseRole?.addEventListener("change", syncDispenseUserPlaceholder);
  refs.dispenseForm?.addEventListener("submit", handleDispenseSubmit);
  refs.settingsForm?.addEventListener("submit", handleSettingsSubmit);
  staffNavLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = text(link.getAttribute("href")).replace(/^#/, "");
      if (!targetId) return;
      setActiveSection(targetId);
      if (history.replaceState) {
        history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${targetId}`);
      }
      closeMobileSidebar();
    });
  });

  window.addEventListener("hashchange", () => {
    setActiveSection(text(window.location.hash).replace(/^#/, ""));
  });

  ensureSeedData();
  renderMedicineOptions();
  renderSettings();
  syncDispenseUserPlaceholder();
  renderSelectedResident();
  renderResidentSearchResults();
  renderHistory();
  setActiveSection(text(window.location.hash).replace(/^#/, "") || "resident-account");
  void syncHouseholdResidents();
})();
