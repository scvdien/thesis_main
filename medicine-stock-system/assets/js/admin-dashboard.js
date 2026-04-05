(() => {
  const currentYear = new Date().getFullYear();
  const yearEl = document.getElementById("year");
  const yearSelect = document.getElementById("yearSelect");
  const refreshBtn = document.getElementById("refreshBtn");
  const sidebar = document.getElementById("sidebar");
  const sidebarBackdrop = document.getElementById("sidebarBackdrop");
  const sidebarToggle = document.getElementById("sidebarToggle");
  const logoutLink = document.getElementById("logoutLink");
  const refreshModalEl = document.getElementById("refreshModal");
  const logoutModalEl = document.getElementById("logoutModal");

  const refreshModal = refreshModalEl && window.bootstrap ? new window.bootstrap.Modal(refreshModalEl) : null;
  const logoutModal = logoutModalEl && window.bootstrap ? new window.bootstrap.Modal(logoutModalEl) : null;
  const supplyMonitoring = window.MSSSupplyMonitoring;

  if (yearEl) yearEl.textContent = String(currentYear);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nextCycleLabel = "Next";
  const DASHBOARD_ANALYTICS_ENDPOINT = "dashboard-analytics-api.php";

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sum = (values) => values.reduce((total, value) => total + toNumber(value), 0);

  const average = (values) => {
    const safeValues = Array.isArray(values) ? values.map(toNumber) : [];
    return safeValues.length ? sum(safeValues) / safeValues.length : 0;
  };

  const percent = (value, total) => {
    const safeTotal = toNumber(total);
    if (safeTotal <= 0) return 0;
    return (toNumber(value) / safeTotal) * 100;
  };

  const formatNumber = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(toNumber(value)));
  const text = (value) => String(value ?? "").trim();
  const keyOf = (value) => text(value).toLowerCase();

  const formatDecimal = (value, digits = 1) => new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(toNumber(value));

  const formatPercent = (value, digits = 0) => `${formatDecimal(value, digits)}%`;
  const formatSignedPercent = (value, digits = 0) => `${toNumber(value) > 0 ? "+" : ""}${formatPercent(value, digits)}`;
  const formatChange = (value) => `${toNumber(value) >= 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
  const formatCurrency = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(toNumber(value));
  const formatDate = (value) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "2-digit",
      year: "numeric"
    }).format(parsed);
  };
  const esc = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  const seasonDefinitions = [
    {
      key: "dry",
      label: "Dry Season",
      months: [11, 0, 1, 2, 3, 4],
      icon: "bi bi-brightness-high-fill"
    },
    {
      key: "rainy",
      label: "Rainy Season",
      months: [5, 6, 7, 8, 9, 10],
      icon: "bi bi-cloud-rain-heavy-fill"
    }
  ];
  const getSeasonDefinition = (monthIndex) => (
    seasonDefinitions.find((season) => season.months.includes(monthIndex)) || seasonDefinitions[0]
  );
  const getNextSeasonDefinition = (seasonKey) => {
    const currentIndex = seasonDefinitions.findIndex((season) => season.key === seasonKey);
    if (currentIndex < 0) return seasonDefinitions[0];
    return seasonDefinitions[(currentIndex + 1) % seasonDefinitions.length];
  };
  const seasonLabelLower = (season) => String(season?.label || "season").toLowerCase();

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
  };

  const setHTML = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = value;
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
      throw new Error(String(payload.message || payload.error || "Unable to load dashboard analytics right now."));
    }
    return payload;
  };
  const buildEmptyMonitoringSnapshot = () => ({
    generatedAt: new Date().toISOString(),
    movement: {
      fast: [],
      slow: []
    },
    expiry: {
      soonCount: 0,
      withinThirtyCount: 0,
      inventoryTotalUnits: 0,
      slowConsumptionCount: 0,
      medicines: [],
      slowConsumption: [],
      riskItem: null
    },
    balance: {
      totalMedicines: 0,
      balancedCount: 0,
      lowCount: 0,
      overstockCount: 0,
      rows: [],
      focusItem: null,
      comparisonItems: []
    }
  });
  const balanceTone = (item) => (item?.isLow ? "low" : item?.isOverstock ? "over" : "balanced");
  const balanceLabel = (item) => (item?.isLow ? "Low Stock" : item?.isOverstock ? "Overstock" : "Balanced");
  const stockNote = (item) => {
    if (!item) return "Monitoring snapshot will appear here.";
    if (item.isLow) {
      return `${item.shortName} is below its request point and needs a CHO request soon.`;
    }
    if (item.isOverstock) {
      return `${item.shortName} is above the monitored stock ceiling and should be watched for slow movement.`;
    }
    return `${item.shortName} remains within the monitored stock range for the current cycle.`;
  };

  const renderBalanceBucketItems = (items, type) => {
    if (!Array.isArray(items) || !items.length) {
      const emptyLabels = {
        low: "No understock medicines right now.",
        balanced: "No balanced medicines yet.",
        over: "No overstock medicines right now."
      };
      return `<div class="text-muted small">${emptyLabels[type] || "No medicines to show."}</div>`;
    }

    return items
      .map((item) => {
        const tone = type === "low" ? "low" : type === "over" ? "over" : "balanced";
        const icon = item.icon || (type === "over" ? "bi bi-arrow-up-circle" : type === "low" ? "bi bi-arrow-down-circle" : "bi bi-check2-circle");
        const metaLabel = type === "low"
          ? "Request Point"
          : type === "over"
            ? "Stock Ceiling"
            : "Safe Range";
        const metaValue = type === "balanced"
          ? `${formatNumber(item.reorderLevel || 0)}-${formatNumber(item.overstockThreshold || 0)}`
          : formatNumber(type === "low" ? (item.reorderLevel || 0) : (item.overstockThreshold || 0));
        const helperText = type === "low"
          ? `Current stock: ${formatNumber(item.stock || 0)}`
          : type === "over"
            ? `Current stock: ${formatNumber(item.stock || 0)}`
            : `Current stock: ${formatNumber(item.stock || 0)}`;

        return `
          <article class="balance-bucket-item balance-bucket-item--${tone}">
            <div class="balance-bucket-item__icon">
              <i class="${icon}"></i>
            </div>
            <div class="balance-bucket-item__copy">
              <strong>${item.shortName || item.name}</strong>
              <span>${helperText}</span>
            </div>
            <div class="balance-bucket-item__meta">
              <small>${metaLabel}</small>
              <strong>${metaValue}</strong>
            </div>
          </article>
        `;
      })
      .join("");
  };

  const renderMovementSnapshotItem = (medicine, type) => `
    <article class="movement-item movement-item--${medicine.movementTone || type}">
      <div class="movement-item__icon movement-item__icon--${medicine.movementTone || type}">
        <i class="${medicine.icon || "bi bi-capsule"}"></i>
      </div>
      <div class="movement-item__copy">
        <strong>${medicine.shortName || medicine.name}</strong>
        <span>${medicine.movementHelper || (type === "fast" ? "High stock turnover" : "Low stock turnover")}</span>
      </div>
      <div class="movement-item__meta">
        <div class="movement-item__value">
          <strong>${formatNumber(medicine.monthlyUsage)}</strong>
          <span>Dispensed in 30d</span>
        </div>
        <div class="movement-item__status movement-item__status--${medicine.movementTone || type}">
          <i class="bi ${
            medicine.movementTone === "fast"
              ? "bi-arrow-up-right"
              : medicine.movementLabel === "No Recent Dispense"
                ? "bi-dash-circle"
                : "bi-arrow-down-right"
          }"></i>
          <span>${medicine.movementLabel || (type === "fast" ? "Fast Moving" : "Slow Moving")}</span>
        </div>
      </div>
    </article>
  `;

  const syncExpiryPanelHeights = () => {
    const medicineList = document.getElementById("expiryMedicineList");
    const consumptionList = document.getElementById("expiryConsumptionList");
    const riskPanel = document.querySelector(".expiry-panel--risk");

    if (!medicineList || !consumptionList || !riskPanel) return;

    const medicinePanel = medicineList.closest(".expiry-panel");
    const consumptionPanel = consumptionList.closest(".expiry-panel");
    const compactLayout = window.matchMedia("(max-width: 1200px)").matches;

    [medicinePanel, consumptionPanel].forEach((panel) => {
      if (!panel) return;
      panel.style.height = "";
      panel.style.minHeight = "";
    });

    [medicineList, consumptionList].forEach((list) => {
      list.style.height = "";
      list.style.maxHeight = "";
    });

    if (compactLayout || !medicinePanel || !consumptionPanel) return;

    const targetHeight = Math.ceil(riskPanel.getBoundingClientRect().height);

    [medicinePanel, consumptionPanel].forEach((panel) => {
      panel.style.height = `${targetHeight}px`;
      panel.style.minHeight = `${targetHeight}px`;
    });

    [medicineList, consumptionList].forEach((list) => {
      const panel = list.closest(".expiry-panel");
      const head = panel?.querySelector(".expiry-panel__head");
      const panelStyles = panel ? window.getComputedStyle(panel) : null;
      const headStyles = head ? window.getComputedStyle(head) : null;
      const availableHeight = targetHeight
        - (parseFloat(panelStyles?.paddingTop || "0") + parseFloat(panelStyles?.paddingBottom || "0"))
        - (head ? head.getBoundingClientRect().height : 0)
        - (parseFloat(headStyles?.marginBottom || "0"));

      const viewportHeight = Math.max(120, Math.floor(availableHeight));
      list.style.height = `${viewportHeight}px`;
      list.style.maxHeight = `${viewportHeight}px`;
    });
  };

  const syncExpiryPanelHeightsDeferred = () => {
    window.requestAnimationFrame(syncExpiryPanelHeights);
  };

  const syncSupplyPanelHeights = () => {
    const grid = document.querySelector(".supply-content-grid");
    const timelinePanel = document.querySelector(".supply-panel--timeline");
    const chartPanel = document.querySelector(".supply-panel--chart");
    const reliabilityPanel = document.querySelector(".supply-panel--reliability");
    const requestList = document.getElementById("supplyRequestList");

    if (!grid || !timelinePanel || !chartPanel || !reliabilityPanel || !requestList) return;

    const compactLayout = window.matchMedia("(max-width: 1200px)").matches;
    timelinePanel.style.height = "";
    timelinePanel.style.minHeight = "";
    requestList.style.height = "";
    requestList.style.maxHeight = "";

    if (compactLayout) return;

    const gridStyles = window.getComputedStyle(grid);
    const gapValue = parseFloat(gridStyles.rowGap || gridStyles.gap || "0");
    const targetHeight = Math.ceil(
      chartPanel.getBoundingClientRect().height
      + reliabilityPanel.getBoundingClientRect().height
      + gapValue
    );

    timelinePanel.style.height = `${targetHeight}px`;
    timelinePanel.style.minHeight = `${targetHeight}px`;

    const panelStyles = window.getComputedStyle(timelinePanel);
    const head = timelinePanel.querySelector(".supply-panel__head");
    const headStyles = head ? window.getComputedStyle(head) : null;
    const availableHeight = targetHeight
      - (parseFloat(panelStyles.paddingTop || "0") + parseFloat(panelStyles.paddingBottom || "0"))
      - (head ? head.getBoundingClientRect().height : 0)
      - (parseFloat(headStyles?.marginBottom || "0"));

    const viewportHeight = Math.max(140, Math.floor(availableHeight));
    requestList.style.height = `${viewportHeight}px`;
    requestList.style.maxHeight = `${viewportHeight}px`;
  };

  const syncSupplyPanelHeightsDeferred = () => {
    window.requestAnimationFrame(syncSupplyPanelHeights);
  };

  const syncBalancePanelHeights = () => {
    const focusPanel = document.querySelector(".balance-side .balance-panel");
    const stockPanel = document.querySelector(".balance-main .balance-panel:first-child");
    const comparisonPanel = document.querySelector(".balance-main .balance-panel:last-child");
    const stockBody = document.getElementById("balanceStockRows");
    const comparisonList = document.getElementById("balanceComparisonList");

    if (!focusPanel || !stockPanel || !comparisonPanel || !stockBody || !comparisonList) return;

    const compactLayout = window.matchMedia("(max-width: 1200px)").matches;

    [stockPanel, comparisonPanel, focusPanel].forEach((panel) => {
      panel.style.height = "";
      panel.style.minHeight = "";
    });
    stockBody.style.height = "";
    stockBody.style.maxHeight = "";
    comparisonList.style.height = "";
    comparisonList.style.maxHeight = "";

    if (compactLayout) return;

    const targetHeight = Math.max(
      Math.ceil(stockPanel.getBoundingClientRect().height),
      Math.ceil(comparisonPanel.getBoundingClientRect().height),
      Math.ceil(focusPanel.getBoundingClientRect().height)
    );

    [stockPanel, comparisonPanel, focusPanel].forEach((panel) => {
      panel.style.height = `${targetHeight}px`;
      panel.style.minHeight = `${targetHeight}px`;
    });
  };

  const syncBalancePanelHeightsDeferred = () => {
    window.requestAnimationFrame(syncBalancePanelHeights);
  };

  const applyLiveMonitoringSnapshot = (snapshot = buildEmptyMonitoringSnapshot()) => {
    if (!snapshot) return;

    const fastMovement = Array.isArray(snapshot.movement?.fast) ? snapshot.movement.fast : [];
    const slowMovement = Array.isArray(snapshot.movement?.slow) ? snapshot.movement.slow : [];
    if (document.getElementById("stockFastList")) {
      setText("stockMovementFastCount", `${formatNumber(fastMovement.length)} items`);
      setText("stockMovementSlowCount", `${formatNumber(slowMovement.length)} items`);
      setHTML(
        "stockFastList",
        fastMovement.length
          ? fastMovement.map((medicine) => renderMovementSnapshotItem(medicine, "fast")).join("")
          : '<div class="text-muted small">No dispensing movement yet.</div>'
      );
      setHTML(
        "stockSlowList",
        slowMovement.length
          ? slowMovement.map((medicine) => renderMovementSnapshotItem(medicine, "slow")).join("")
          : '<div class="text-muted small">No slow-moving items yet.</div>'
      );
    }

    const expiringMedicines = Array.isArray(snapshot.expiry?.medicines) ? snapshot.expiry.medicines : [];
    const slowConsumption = Array.isArray(snapshot.expiry?.slowConsumption) ? snapshot.expiry.slowConsumption : [];
    const riskItem = snapshot.expiry?.riskItem || null;
    if (document.getElementById("expiryMedicineList")) {
      setText("expirySoonCount", `${formatNumber(snapshot.expiry?.soonCount || 0)} medicines`);
      setText("expiryThirtyCount", `${formatNumber(snapshot.expiry?.withinThirtyCount || 0)} medicines`);
      setText("expiryInventoryTotal", `${formatNumber(snapshot.expiry?.inventoryTotalUnits || 0)} units`);
      setText("expirySlowCount", `${formatNumber(snapshot.expiry?.slowConsumptionCount || 0)} medicines`);
      setText("expiryRiskTitle", riskItem?.shortName || riskItem?.name || "No expiry risk");
      setHTML(
        "expiryMedicineList",
        expiringMedicines.length
          ? expiringMedicines.map((medicine) => `
              <article class="expiry-medicine-item">
                <div class="expiry-medicine-item__icon">
                  <i class="${medicine.icon || "bi bi-capsule"}"></i>
                </div>
                <div class="expiry-medicine-item__copy">
                  <strong>${medicine.shortName || medicine.name}</strong>
                  <span>Expiry: ${medicine.expiryLabel || "-"}</span>
                </div>
                <div class="expiry-days-pill expiry-days-pill--${medicine.expiryTone || "watch"}">
                  <small>${medicine.daysLeft < 0 ? "Expired" : "Days Left"}</small>
                  <strong>${formatNumber(Math.abs(medicine.daysLeft))}</strong>
                </div>
              </article>
            `).join("")
          : '<div class="text-muted small">No expiring medicines within the watch window.</div>'
      );
      setHTML(
        "expiryConsumptionList",
        slowConsumption.length
          ? slowConsumption.map((item) => `
              <article class="expiry-consumption-item">
                <div class="expiry-consumption-item__left">
                  <div class="expiry-consumption-item__icon">
                    <i class="${item.icon || "bi bi-capsule"}"></i>
                  </div>
                  <div class="expiry-consumption-item__copy">
                    <strong>${item.shortName || item.name}</strong>
                    <span>${formatNumber(item.monthlyUsage)} dispensed / month</span>
                  </div>
                </div>
                <div class="expiry-consumption-item__meta">
                  <span class="expiry-rate-pill expiry-rate-pill--${item.consumptionTone || "moderate"}">${item.consumptionLevel || "Moderate"}</span>
                  <span class="expiry-consumption-item__value">${formatNumber(item.monthlyUsage)} / month</span>
                </div>
              </article>
            `).join("")
          : '<div class="text-muted small">No recent consumption history yet.</div>'
      );
      setHTML(
        "expiryRiskFacts",
        riskItem
          ? [
              { label: "Stock", value: formatNumber(riskItem.stock) },
              { label: "Consumption", value: riskItem.consumptionLevel || "Moderate" },
              { label: "Expiry", value: riskItem.daysLeft < 0 ? `Expired ${formatNumber(Math.abs(riskItem.daysLeft))} days ago` : `${formatNumber(riskItem.daysLeft)} days` }
            ].map((item) => `
              <div class="expiry-risk-fact">
                <span>${item.label}</span>
                <strong>${item.value}</strong>
              </div>
            `).join("")
          : '<div class="text-muted small">No expiry risk detected.</div>'
      );
      syncExpiryPanelHeightsDeferred();
    }

    const balance = snapshot.balance || {};
    const balanceRows = Array.isArray(balance.rows) ? balance.rows : [];
    if (document.getElementById("balanceLowList")) {
      const lowItems = balanceRows.filter((item) => item?.isLow);
      const overstockItems = balanceRows.filter((item) => item?.isOverstock);
      const balancedItems = balanceRows.filter((item) => !item?.isLow && !item?.isOverstock);
      setText("balanceTotalMedicines", `${formatNumber(balance.totalMedicines || balanceRows.length)} items`);
      setText("balanceBalancedCount", `${formatNumber(balance.balancedCount || balancedItems.length)} medicines`);
      setText("balanceLowCount", `${formatNumber(balance.lowCount || lowItems.length)} medicines`);
      setText("balanceOverstockCount", `${formatNumber(balance.overstockCount || overstockItems.length)} medicines`);
      setHTML("balanceLowList", renderBalanceBucketItems(lowItems, "low"));
      setHTML("balanceBalancedList", renderBalanceBucketItems(balancedItems, "balanced"));
      setHTML("balanceOverstockList", renderBalanceBucketItems(overstockItems, "over"));
      syncBalancePanelHeightsDeferred();
    }
  };

  const movingAverageForecast = (series, windowSize = 3) => {
    const safeSeries = Array.isArray(series) ? series.map(toNumber) : [];
    if (!safeSeries.length) return 0;
    return average(safeSeries.slice(-windowSize));
  };

  const exponentialSmoothingForecast = (series, alpha = 0.35) => {
    const safeSeries = Array.isArray(series) ? series.map(toNumber) : [];
    if (!safeSeries.length) return 0;
    let level = safeSeries[0];
    for (let idx = 1; idx < safeSeries.length; idx += 1) {
      level = alpha * safeSeries[idx] + (1 - alpha) * level;
    }
    return level;
  };

  const statusClassMap = {
    "High Risk": "status-pill status-pill--danger",
    Watch: "status-pill status-pill--warning",
    Healthy: "status-pill status-pill--success",
    "Request Now": "status-pill status-pill--danger",
    "Monitor Weekly": "status-pill status-pill--warning",
    "Overstock / Hold": "status-pill status-pill--info",
    Balanced: "status-pill status-pill--success",
    "Early Request": "status-pill status-pill--danger",
    "Build Buffer": "status-pill status-pill--warning",
    Ready: "status-pill status-pill--success"
  };

  const isMobile = () => window.matchMedia("(max-width: 992px)").matches;

  const closeMobileSidebar = () => {
    if (!sidebar || !sidebarBackdrop) return;
    sidebar.classList.remove("open");
    sidebarBackdrop.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  };

  const toggleSidebar = () => {
    if (!sidebar || !sidebarBackdrop) return;
    if (isMobile()) {
      sidebar.classList.toggle("open");
      sidebarBackdrop.classList.toggle("show");
      document.body.classList.toggle("sidebar-open");
      return;
    }
    sidebar.classList.toggle("collapsed");
  };

  if (sidebarToggle) sidebarToggle.addEventListener("click", toggleSidebar);
  if (sidebarBackdrop) sidebarBackdrop.addEventListener("click", closeMobileSidebar);

  window.addEventListener("resize", () => {
    if (!isMobile()) closeMobileSidebar();
    syncExpiryPanelHeightsDeferred();
    syncSupplyPanelHeightsDeferred();
    syncBalancePanelHeightsDeferred();
  });

  if (logoutLink && logoutModal) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      logoutModal.show();
    });
  }

  const renderDemandPredictionScenario = async (prefetchedAnalytics = null) => {
    const demandChartEl = document.getElementById("demandForecastChart");
    const demandSignalList = document.getElementById("seasonalSignalList");
    const metricDemandSeasonLabel = document.getElementById("metricDemandSeasonLabel");
    const metricDemandSeasonIcon = document.getElementById("metricDemandSeasonIcon");
    const fallbackNextSeason = getNextSeasonDefinition(getSeasonDefinition(new Date().getMonth()).key);
    const palette = {
      green: "#18a957",
      greenSoft: "#34c779",
      gold: "#f1b200",
      red: "#e45a5a",
      teal: "#0f9f96",
      blue: "#2f80ed",
      slate: "#64748b"
    };
    const destroyDemandChart = () => {
      if (!window.__demandPredictionChart) return;
      window.__demandPredictionChart.destroy();
      window.__demandPredictionChart = null;
    };

    const renderDemandList = (medicines, emptyMessage) => {
      if (!demandSignalList) return;
      if (!Array.isArray(medicines) || !medicines.length) {
        demandSignalList.innerHTML = `<div class="text-muted small">${esc(emptyMessage || "No demand prediction signals available yet.")}</div>`;
        return;
      }

      demandSignalList.innerHTML = medicines
        .slice(0, 8)
        .map((medicine) => {
          const tone = medicine.actionTone || (["Early Request", "Build Buffer"].includes(text(medicine.action)) ? "warning" : "success");
          const badgeIcon = tone === "warning" ? "bi bi-exclamation-lg" : "bi bi-arrow-up";
          return `
            <article class="demand-priority-item" title="${esc(medicine.actionNote || "")}">
              <div class="demand-priority-item__left">
                <div class="demand-priority-item__icon demand-priority-item__icon--${esc(tone)}">
                  <i class="${esc(medicine.iconClass || "bi bi-capsule")}"></i>
                </div>
                <div class="demand-priority-item__copy">
                  <strong>${esc(medicine.displayName || medicine.name || "Medicine")}</strong>
                  <span>${esc(medicine.actionLabel || "Watch Demand")}</span>
                </div>
              </div>
              <div class="demand-priority-item__badge demand-priority-item__badge--${esc(tone)}">
                <i class="${esc(badgeIcon)}"></i>
              </div>
            </article>
          `;
        })
        .join("");
    };

    const renderDemandChart = (labels, actualDemand, predictedDemand) => {
      if (!demandChartEl || !window.Chart) return;

      destroyDemandChart();

      const safeLabels = Array.isArray(labels) && labels.length ? labels : [...months, nextCycleLabel];
      const safeActualDemand = Array.isArray(actualDemand) ? actualDemand : Array.from({ length: safeLabels.length }, () => null);
      const safePredictedDemand = Array.isArray(predictedDemand) ? predictedDemand : Array.from({ length: safeLabels.length }, () => null);
      const chartValues = [...safeActualDemand, ...safePredictedDemand]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const highestValue = chartValues.length ? Math.max(...chartValues) : 0;
      const suggestedMax = highestValue > 0 ? Math.ceil(highestValue / 50) * 50 : 100;
      const stepSize = suggestedMax <= 100 ? 20 : suggestedMax <= 300 ? 50 : 100;

      window.__demandPredictionChart = new window.Chart(demandChartEl, {
        type: "line",
        data: {
          labels: safeLabels,
          datasets: [
            {
              label: "Actual Demand",
              data: safeActualDemand,
              borderColor: palette.green,
              backgroundColor: "rgba(24,169,87,0.22)",
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointRadius: 4,
              pointHoverRadius: 5
            },
            {
              label: "Predicted Demand",
              data: safePredictedDemand,
              borderColor: palette.blue,
              borderDash: [6, 5],
              borderWidth: 3,
              tension: 0.25,
              pointRadius: 4,
              pointHoverRadius: 5,
              pointBackgroundColor: "#ffffff",
              pointBorderWidth: 3,
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                usePointStyle: true,
                boxWidth: 10,
                padding: 18
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              suggestedMax,
              ticks: {
                precision: 0,
                stepSize
              },
              grid: {
                color: "rgba(92, 103, 80, 0.12)"
              }
            },
            x: {
              grid: {
                color: "rgba(92, 103, 80, 0.08)"
              }
            }
          }
        }
      });
    };

    const applyDemandFallbackState = (message) => {
      setText("metricDemandForecast", "0");
      setText("metricDemandUplift", "0%");
      setText("metricDemandPriority", "0");
      setText("metricDemandReorder", "0");
      if (metricDemandSeasonLabel) metricDemandSeasonLabel.textContent = "Expected Next Season Change";
      if (metricDemandSeasonIcon) metricDemandSeasonIcon.className = fallbackNextSeason.icon;
      renderDemandList([], message);
      renderDemandChart([...months, nextCycleLabel], Array.from({ length: 13 }, () => null), Array.from({ length: 13 }, () => null));
    };

    if (metricDemandSeasonIcon) metricDemandSeasonIcon.className = fallbackNextSeason.icon;

    try {
      let analytics = prefetchedAnalytics && typeof prefetchedAnalytics === "object"
        ? prefetchedAnalytics
        : null;
      if (!analytics) {
        const url = new URL(DASHBOARD_ANALYTICS_ENDPOINT, window.location.href);
        url.searchParams.set("scope", "demand_prediction");

        const payload = await requestJson(url.toString());
        analytics = payload && typeof payload.analytics === "object" && payload.analytics
          ? payload.analytics
          : {};
      }
      const summary = analytics && typeof analytics.summary === "object" && analytics.summary
        ? analytics.summary
        : {};
      const nextSeason = analytics && typeof analytics.nextSeason === "object" && analytics.nextSeason
        ? analytics.nextSeason
        : {};
      const chart = analytics && typeof analytics.chart === "object" && analytics.chart
        ? analytics.chart
        : {};
      const watchList = Array.isArray(analytics.watchList) ? analytics.watchList : [];
      const hasData = Boolean(analytics.hasData);

      setText("metricDemandForecast", formatNumber(summary.predictedNextDemand || 0));
      setText("metricDemandUplift", formatSignedPercent(summary.seasonalShiftPercent || 0, 0));
      setText("metricDemandPriority", formatNumber(summary.medicinesToWatch || watchList.length));
      setText("metricDemandReorder", formatNumber(summary.medicinesToRequestSoon || 0));
      if (metricDemandSeasonLabel) {
        metricDemandSeasonLabel.textContent = String(summary.seasonalSummaryLabel || "Expected Next Season Change");
      }
      if (metricDemandSeasonIcon) {
        metricDemandSeasonIcon.className = String(nextSeason.iconClass || fallbackNextSeason.icon);
      }

      renderDemandList(watchList, analytics.emptyMessage || "No demand prediction signals available yet.");
      renderDemandChart(chart.labels, chart.actualDemand, chart.predictedDemand);

      if (!hasData) {
        setText("metricDemandUplift", "0%");
      }
    } catch (error) {
      console.error("Demand prediction analytics request failed.", error);
      applyDemandFallbackState(
        error instanceof Error && error.message
          ? error.message
          : "Unable to load demand prediction analytics right now."
      );
    }
  };

  const renderDiseasePatternScenario = (prefetchedAnalytics = null) => {
    const diseaseChartEl = document.getElementById("diseasePatternChart");
    const accentOrder = ["danger", "orange", "gold", "teal"];
    const chartColors = ["#75a85a", "#cba43b", "#7cb7ac", "#6baf63", "#eb8b5a", "#79a4d8"];
    const diseaseVisuals = [
      { match: /(fever|flu|lagnat)/i, accent: "danger", icon: "bi bi-thermometer-half" },
      { match: /(cough|cold|ubo|sipon|uri)/i, accent: "orange", icon: "bi bi-capsule-pill" },
      { match: /(diarrhea|diarrhoe|gastro|ors)/i, accent: "teal", icon: "bi bi-droplet-half" },
      { match: /(allergy|skin)/i, accent: "gold", icon: "bi bi-stars" },
      { match: /(hypertension|bp|heart)/i, accent: "danger", icon: "bi bi-heart-pulse" },
      { match: /(respiratory|asthma|lungs)/i, accent: "teal", icon: "bi bi-lungs" },
      { match: /(diabetes|sugar)/i, accent: "orange", icon: "bi bi-activity" },
      { match: /(pain|inflammation)/i, accent: "gold", icon: "bi bi-bandaid" },
      { match: /(vitamin|supplement|wellness)/i, accent: "gold", icon: "bi bi-capsule" }
    ];
    const resolvePatternVisual = (label, index) => {
      const matched = diseaseVisuals.find((visual) => visual.match.test(label));
      if (matched) return matched;
      return {
        accent: accentOrder[index % accentOrder.length],
        icon: "bi bi-clipboard2-pulse"
      };
    };
    const analytics = prefetchedAnalytics && typeof prefetchedAnalytics === "object"
      ? prefetchedAnalytics
      : null;
    const mode = text(analytics?.mode) || "recorded";
    const panelNote = text(analytics?.panelNote);
    const diseaseSignals = analytics
      ? (Array.isArray(analytics.patterns) ? analytics.patterns : [])
      : [];
    const medicineSignals = analytics
      ? (Array.isArray(analytics.medicines) ? analytics.medicines : [])
      : [];
    const inferredMode = mode === "inferred";

    setText(
      "diseasePatternSubtitle",
      inferredMode
        ? "Cabarian, Ligao City - Possible illness signals from medicine activity"
        : "Cabarian, Ligao City - Common Illness Trend"
    );
    setText(
      "diseasePatternChartCaption",
      inferredMode
        ? "Recent medicines contributing to the current signal"
        : "Series and request frequency"
    );

    if (!diseaseSignals.length) {
      const emptyParts = [
        text(analytics?.emptyMessage || "No disease pattern data yet. Start recording dispense cases to build this analysis.")
      ];
      if (panelNote && keyOf(panelNote) !== keyOf(emptyParts[0])) {
        emptyParts.push(panelNote);
      }
      setHTML(
        "diseasePatternList",
        `<div class="text-muted small">${esc(emptyParts.join(" "))}</div>`
      );
    } else {
      setHTML(
        "diseasePatternList",
        diseaseSignals
          .map((signal, index) => {
            const visual = resolvePatternVisual(signal.illness, index);
            const signalRequests = Math.max(1, Math.round(toNumber(signal.requests)));
            const confidence = Math.max(0, Math.round(toNumber(signal.confidence)));
            const growthPercent = toNumber(signal.growthPercent);
            const trend = keyOf(signal.trend);
            const supportSummary = text(signal.supportingMedicineSummary);
            const detailParts = inferredMode
              ? [
                `${formatNumber(signalRequests)} mapped request${signalRequests === 1 ? "" : "s"}`,
                trend === "new"
                  ? "New signal this 30d"
                  : `${formatChange(growthPercent)} vs prev 30d`,
                supportSummary ? `Support: ${supportSummary}` : ""
              ].filter(Boolean)
              : [`${formatNumber(signalRequests)} recorded case${signalRequests === 1 ? "" : "s"}`];
            const metricIcon = inferredMode
              ? (trend === "easing" ? "bi bi-arrow-down-right" : trend === "steady" ? "bi bi-arrow-left-right" : "bi bi-arrow-up-right")
              : "bi bi-arrow-up-right";
            const metricValue = inferredMode ? `${formatNumber(confidence)}%` : formatNumber(signalRequests);
            return `
              <article class="pattern-case-card pattern-case-card--${visual.accent}">
                <div class="pattern-case-card__icon">
                  <i class="${visual.icon}"></i>
                </div>
                <div class="pattern-case-card__copy">
                  <strong>${esc(signal.illness)}</strong>
                  <span>${esc(detailParts.join(" | "))}</span>
                </div>
                <div class="pattern-case-card__metric">
                  <i class="${metricIcon}"></i>
                  <span>${esc(metricValue)}</span>
                </div>
              </article>
            `;
          })
          .join("")
      );
    }

    const chartSignals = medicineSignals.slice(0, 6);
    const chartLabels = chartSignals.length ? chartSignals.map((signal) => signal.medicine) : ["No data"];
    const chartValues = chartSignals.length ? chartSignals.map((signal) => signal.requests) : [0];

    if (diseaseChartEl && window.Chart) {
      if (window.__diseasePatternChart) window.__diseasePatternChart.destroy();

      window.__diseasePatternChart = new window.Chart(diseaseChartEl, {
        type: "bar",
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartValues,
            backgroundColor: chartLabels.map((_, index) => chartColors[index % chartColors.length]),
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 34
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: "#6b705f",
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              suggestedMax: Math.max(5, ...chartValues) + 2,
              ticks: {
                stepSize: Math.max(1, Math.ceil(Math.max(...chartValues, 1) / 5)),
                precision: 0,
                color: "#7b806f",
                font: { size: 10 }
              },
              grid: {
                color: "rgba(96, 107, 86, 0.1)"
              }
            }
          }
        }
      });
    }
  };

  const renderStockMovementScenario = (snapshot = null) => {
    applyLiveMonitoringSnapshot(snapshot || buildEmptyMonitoringSnapshot());
  };

  const renderSupplyDeliveryScenario = (prefetchedAnalytics = null) => {
    const leadTimeChartEl = document.getElementById("supplyLeadTimeChart");
    const analytics = prefetchedAnalytics && typeof prefetchedAnalytics === "object"
      ? prefetchedAnalytics
      : supplyMonitoring ? supplyMonitoring.buildSupplyAnalytics() : {
      rows: [],
      recentRows: [],
      monthlyLeadTimes: Array(12).fill(0),
      summary: {
        averageLeadTime: 0,
        onTimeCount: 0,
        delayedCount: 0,
        incompleteCount: 0,
        pendingCount: 0,
        completedCount: 0,
        onTimeRate: 0
      }
    };

    const summary = analytics && typeof analytics.summary === "object" && analytics.summary
      ? analytics.summary
      : {
        averageLeadTime: 0,
        onTimeCount: 0,
        delayedCount: 0,
        incompleteCount: 0,
        pendingCount: 0,
        completedCount: 0,
        onTimeRate: 0
      };
    const recentRows = Array.isArray(analytics?.recentRows) ? analytics.recentRows : [];
    const monthlyLeadTimes = Array.isArray(analytics?.monthlyLeadTimes) ? analytics.monthlyLeadTimes : Array(12).fill(0);
    const sourceLabel = "Monitor supply lead times and delivery reliability.";

    const chartPalette = {
      green: "#18a957",
      greenSoft: "#d9f5e5",
      textSoft: "#527061",
      gridSoft: "rgba(82, 112, 97, 0.1)"
    };

    setText("supplySourceLabel", sourceLabel);
    setText(
      "supplyAvgLeadTime",
      summary.completedCount ? `${formatDecimal(summary.averageLeadTime, 1)} days` : "No data yet"
    );
    setText("supplyOnTimeCount", formatNumber(summary.onTimeCount));
    setText("supplyDelayedCount", formatNumber(summary.delayedCount));
    setText("supplyIncompleteCount", formatNumber(summary.incompleteCount));
    setText("supplyPendingCount", formatNumber(summary.pendingCount));
    setText("supplyReliabilityValue", formatPercent(summary.onTimeRate, 0));
    setText(
      "supplyReliabilityNote",
      summary.completedCount
        ? `${formatNumber(summary.onTimeCount)} of ${formatNumber(summary.completedCount)} completed CHO requests were fulfilled on or before target date.`
        : "No completed CHO requests yet. Generate a request first, then link the received delivery from Medicine Inventory."
    );

    setHTML(
      "supplyRequestList",
      recentRows.length
        ? recentRows
          .map((request) => {
            const badgeTone = request.onTime
              ? "done"
              : request.delayed || request.statusKey === "overdue"
                ? "delay"
                : request.incomplete || request.statusKey === "partial" || request.statusKey === "incomplete"
                  ? "warning"
                  : "pending";
            const targetStepTone = request.delayed || request.isOverdue
              ? "delay"
              : (request.isComplete || request.hasDelivery ? "done" : "pending");
            const deliveryStepTone = request.onTime
              ? "done"
              : request.delayed || request.statusKey === "overdue"
                ? "delay"
                  : request.incomplete || request.statusKey === "partial" || request.statusKey === "incomplete"
                    ? "warning"
                    : "pending";
            const medicinePreview = Array.isArray(request.items) && request.items.length
              ? `${request.items.slice(0, 2).map((item) => item.medicineName).join(", ")}${request.items.length > 2 ? ` +${request.items.length - 2} more` : ""}`
              : request.medicineSummary || "No medicines listed";
            const requestNote = [
              `${formatNumber(request.itemCount || 0)} medicine line${request.itemCount === 1 ? "" : "s"}`,
              request.completedItems > 0
                ? `${formatNumber(request.completedItems)} completed`
                : request.isOverdue
                  ? `${formatNumber(request.overdueDays)} day(s) overdue`
                : "Awaiting delivery"
            ].join(" | ");
            const deliveryDate = request.completionDate || request.lastReceivedDate || "";
            const deliveryDateLabel = deliveryDate
              ? formatDate(deliveryDate)
              : (request.delayed || request.isOverdue ? `Overdue ${formatNumber(request.overdueDays)} day(s)` : "Waiting");
            const deliveryStatusLabel = request.onTime
              ? "Completed"
              : request.delayed
                ? "Completed Late"
                : request.incomplete || request.statusKey === "partial" || request.statusKey === "incomplete"
                  ? "Partially Received"
                  : request.isOverdue
                    ? "Overdue"
                    : "Pending";

            return `
              <article class="supply-request-card">
                <div class="supply-request-card__head">
                  <div class="supply-request-card__copy">
                    <strong>${esc(request.requestCode)} - ${esc(formatNumber(request.itemCount || 0))} medicine${request.itemCount === 1 ? "" : "s"}</strong>
                    <span>${esc(medicinePreview)}</span>
                    <span>${esc(requestNote)}</span>
                  </div>
                  <div class="supply-request-card__badge supply-request-card__badge--${badgeTone}">
                    ${esc(request.statusLabel)}
                  </div>
                </div>
                <div class="supply-request-steps">
                  <div class="supply-request-step supply-request-step--done">
                    <span class="supply-request-step__dot"></span>
                    <small>${esc(formatDate(request.requestDate))}</small>
                    <span>Request Logged</span>
                  </div>
                  <div class="supply-request-step supply-request-step--${targetStepTone}">
                    <span class="supply-request-step__dot"></span>
                    <small>${esc(formatDate(request.expectedDate))}</small>
                    <span>Target Date</span>
                  </div>
                  <div class="supply-request-step supply-request-step--${deliveryStepTone}">
                    <span class="supply-request-step__dot"></span>
                    <small>${esc(deliveryDateLabel)}</small>
                    <span>${esc(deliveryStatusLabel)}</span>
                  </div>
                </div>
              </article>
            `;
          })
          .join("")
        : '<div class="text-muted small">No CHO requests logged yet.</div>'
    );

    ["supplySummaryReliabilityFill", "supplyReliabilityFill"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.width = `${Math.max(0, Math.min(100, summary.onTimeRate))}%`;
    });

    if (leadTimeChartEl && window.Chart) {
      if (window.__supplyLeadTimeChart) window.__supplyLeadTimeChart.destroy();

      window.__supplyLeadTimeChart = new window.Chart(leadTimeChartEl, {
        type: "line",
        data: {
          labels: months,
          datasets: [{
            data: monthlyLeadTimes,
            borderColor: chartPalette.green,
            backgroundColor: "rgba(24, 169, 87, 0.18)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: chartPalette.greenSoft,
            pointBorderColor: chartPalette.green,
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: {
                color: chartPalette.gridSoft
              },
              ticks: {
                color: chartPalette.textSoft,
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              suggestedMax: Math.max(6, ...monthlyLeadTimes.map((value) => Math.ceil(value || 0))),
              ticks: {
                stepSize: 1,
                precision: 0,
                color: chartPalette.textSoft,
                font: { size: 11 }
              },
              grid: {
                color: chartPalette.gridSoft
              }
            }
          }
        }
      });
    }

    syncSupplyPanelHeightsDeferred();
  };

  const renderExpiryConsumptionScenario = (snapshot = null) => {
    applyLiveMonitoringSnapshot(snapshot || buildEmptyMonitoringSnapshot());
  };

  const renderInventoryBalanceScenario = (snapshot = null) => {
    applyLiveMonitoringSnapshot(snapshot || buildEmptyMonitoringSnapshot());
  };

  let adminOverviewRequest = null;
  const loadAdminDashboardOverview = async () => {
    if (adminOverviewRequest) return adminOverviewRequest;

    adminOverviewRequest = (async () => {
      const emptySupplyAnalytics = {
        rows: [],
        recentRows: [],
        monthlyLeadTimes: Array(12).fill(0),
        summary: {
          averageLeadTime: 0,
          onTimeCount: 0,
          delayedCount: 0,
          incompleteCount: 0,
          pendingCount: 0,
          completedCount: 0,
          onTimeRate: 0
        }
      };
      const fallbackDemandMessage = "Unable to load demand prediction analytics right now.";
      const fallbackDiseaseMessage = "Unable to load disease pattern analytics right now.";
      const emptySnapshot = buildEmptyMonitoringSnapshot();

      try {
        const url = new URL(DASHBOARD_ANALYTICS_ENDPOINT, window.location.href);
        url.searchParams.set("scope", "admin_overview");

        const payload = await requestJson(url.toString());
        const analytics = payload && typeof payload.analytics === "object" && payload.analytics
          ? payload.analytics
          : {};
        const demandAnalytics = analytics.demand && typeof analytics.demand === "object"
          ? analytics.demand
          : { hasData: false, emptyMessage: fallbackDemandMessage };
        const diseaseAnalytics = analytics.diseasePattern && typeof analytics.diseasePattern === "object"
          ? analytics.diseasePattern
          : { patterns: [], medicines: [], emptyMessage: fallbackDiseaseMessage };
        const monitoringSnapshot = analytics.monitoringSnapshot && typeof analytics.monitoringSnapshot === "object"
          ? analytics.monitoringSnapshot
          : emptySnapshot;
        const supplyAnalytics = analytics.supply && typeof analytics.supply === "object"
          ? analytics.supply
          : emptySupplyAnalytics;

        await renderDemandPredictionScenario(demandAnalytics);
        renderDiseasePatternScenario(diseaseAnalytics);
        applyLiveMonitoringSnapshot(monitoringSnapshot);
        renderSupplyDeliveryScenario(supplyAnalytics);
      } catch (error) {
        console.error("Admin dashboard overview request failed.", error);
        const message = error instanceof Error && error.message
          ? error.message
          : "Unable to load dashboard analytics right now.";

        await renderDemandPredictionScenario({
          hasData: false,
          emptyMessage: message
        });
        renderDiseasePatternScenario({
          patterns: [],
          medicines: [],
          emptyMessage: message
        });
        applyLiveMonitoringSnapshot(emptySnapshot);
        renderSupplyDeliveryScenario(emptySupplyAnalytics);
      }
    })().finally(() => {
      adminOverviewRequest = null;
    });

    return adminOverviewRequest;
  };

  if (!document.getElementById("metricTotalMedicines")) {
    loadAdminDashboardOverview();
    window.addEventListener("mss:notifications-synced", () => {
      loadAdminDashboardOverview();
    });
    window.addEventListener("mss:inventory-updated", () => {
      loadAdminDashboardOverview();
    });
    window.addEventListener("mss:supply-state-updated", () => {
      loadAdminDashboardOverview();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      loadAdminDashboardOverview();
    });
    return;
  }

  const palette = {
    green: "#18a957",
    greenSoft: "#34c779",
    gold: "#f1b200",
    red: "#e45a5a",
    teal: "#0f9f96",
    blue: "#2f80ed",
    purple: "#7c3aed",
    slate: "#64748b",
    gray: "#94a3b8"
  };

  const conditionLabels = [
    "URI / Cough-Cold",
    "Hypertension",
    "Diarrheal Disease",
    "Diabetes",
    "Respiratory / Asthma",
    "Wellness Support"
  ];

  const supplierTemplates = [
    {
      name: "Routine CHO Request",
      targetLeadTime: 5,
      leadTimeTrend: -0.12,
      monthlyLeadTimes: [4.6, 4.4, 4.8, 4.5, 4.7, 4.9, 4.8, 4.6, 5.0, 4.8, 4.5, 4.7]
    },
    {
      name: "Urgent CHO Follow-up",
      targetLeadTime: 4,
      leadTimeTrend: -0.08,
      monthlyLeadTimes: [4.2, 4.6, 4.1, 4.0, 4.8, 4.5, 4.4, 4.9, 4.6, 4.5, 4.2, 4.4]
    },
    {
      name: "Program Allocation",
      targetLeadTime: 7,
      leadTimeTrend: -0.05,
      monthlyLeadTimes: [6.6, 6.9, 6.4, 6.2, 7.1, 7.0, 6.8, 7.2, 7.0, 6.7, 6.5, 6.8]
    }
  ];

  const medicineTemplates = [
    {
      name: "Paracetamol 500mg",
      category: "Analgesics",
      condition: "URI / Cough-Cold",
      supplier: "Routine CHO Request",
      unitCost: 2.2,
      safetyStock: 180,
      stockOnHand: 210,
      stockShift: 10,
      usageShift: 7,
      requestMultiplier: 1.08,
      q4RequestBoost: 16,
      monthlyDispensed: [280, 260, 275, 290, 310, 325, 340, 330, 320, 315, 335, 350],
      expiryBatches: [
        { label: "Lot A", units: 80, daysToExpiry: 42 },
        { label: "Lot B", units: 130, daysToExpiry: 165 }
      ]
    },
    {
      name: "Amoxicillin 500mg",
      category: "Antibiotics",
      condition: "URI / Cough-Cold",
      supplier: "Urgent CHO Follow-up",
      unitCost: 6.5,
      safetyStock: 120,
      stockOnHand: 180,
      stockShift: 9,
      usageShift: 5,
      requestMultiplier: 1.07,
      q4RequestBoost: 10,
      monthlyDispensed: [110, 105, 118, 130, 145, 152, 168, 162, 150, 148, 158, 166],
      expiryBatches: [
        { label: "Lot A", units: 90, daysToExpiry: 75 },
        { label: "Lot B", units: 90, daysToExpiry: 210 }
      ]
    },
    {
      name: "Cetirizine 10mg",
      category: "Antihistamines",
      condition: "URI / Cough-Cold",
      supplier: "Urgent CHO Follow-up",
      unitCost: 4.4,
      safetyStock: 90,
      stockOnHand: 140,
      stockShift: 8,
      usageShift: 5,
      requestMultiplier: 1.1,
      q4RequestBoost: 14,
      monthlyDispensed: [120, 118, 125, 140, 155, 165, 170, 168, 162, 158, 160, 170],
      expiryBatches: [
        { label: "Lot A", units: 50, daysToExpiry: 58 },
        { label: "Lot B", units: 90, daysToExpiry: 190 }
      ]
    },
    {
      name: "ORS Sachet",
      category: "Rehydration",
      condition: "Diarrheal Disease",
      supplier: "Routine CHO Request",
      unitCost: 7.5,
      safetyStock: 70,
      stockOnHand: 480,
      stockShift: 16,
      usageShift: 3,
      requestMultiplier: 1.05,
      q4RequestBoost: 2,
      monthlyDispensed: [45, 42, 48, 52, 60, 64, 72, 70, 65, 58, 56, 60],
      expiryBatches: [
        { label: "Lot A", units: 180, daysToExpiry: 32 },
        { label: "Lot B", units: 300, daysToExpiry: 160 }
      ]
    },
    {
      name: "Zinc Sulfate",
      category: "Pediatric Support",
      condition: "Diarrheal Disease",
      supplier: "Routine CHO Request",
      unitCost: 3.6,
      safetyStock: 55,
      stockOnHand: 82,
      stockShift: 4,
      usageShift: 2,
      requestMultiplier: 1.04,
      q4RequestBoost: 1,
      monthlyDispensed: [32, 30, 34, 38, 42, 44, 48, 46, 43, 40, 38, 39],
      expiryBatches: [
        { label: "Lot A", units: 32, daysToExpiry: 84 },
        { label: "Lot B", units: 50, daysToExpiry: 190 }
      ]
    },
    {
      name: "Salbutamol Syrup",
      category: "Respiratory",
      condition: "Respiratory / Asthma",
      supplier: "Urgent CHO Follow-up",
      unitCost: 18.5,
      safetyStock: 50,
      stockOnHand: 52,
      stockShift: 3,
      usageShift: 2,
      requestMultiplier: 1.06,
      q4RequestBoost: 4,
      monthlyDispensed: [28, 26, 30, 33, 40, 44, 48, 46, 42, 39, 38, 41],
      expiryBatches: [
        { label: "Lot A", units: 40, daysToExpiry: 27 },
        { label: "Lot B", units: 12, daysToExpiry: 120 }
      ]
    },
    {
      name: "Losartan 50mg",
      category: "Maintenance",
      condition: "Hypertension",
      supplier: "Program Allocation",
      unitCost: 5.2,
      safetyStock: 140,
      stockOnHand: 720,
      stockShift: 12,
      usageShift: 4,
      requestMultiplier: 1.02,
      q4RequestBoost: 2,
      monthlyDispensed: [135, 138, 140, 145, 148, 150, 152, 154, 155, 158, 160, 162],
      expiryBatches: [
        { label: "Lot A", units: 180, daysToExpiry: 115 },
        { label: "Lot B", units: 540, daysToExpiry: 260 }
      ]
    },
    {
      name: "Amlodipine 5mg",
      category: "Maintenance",
      condition: "Hypertension",
      supplier: "Program Allocation",
      unitCost: 4.8,
      safetyStock: 110,
      stockOnHand: 150,
      stockShift: 8,
      usageShift: 3,
      requestMultiplier: 1.02,
      q4RequestBoost: 2,
      monthlyDispensed: [98, 100, 102, 105, 108, 112, 115, 118, 120, 122, 125, 128],
      expiryBatches: [
        { label: "Lot A", units: 60, daysToExpiry: 48 },
        { label: "Lot B", units: 90, daysToExpiry: 210 }
      ]
    },
    {
      name: "Metformin 500mg",
      category: "Maintenance",
      condition: "Diabetes",
      supplier: "Routine CHO Request",
      unitCost: 6.0,
      safetyStock: 95,
      stockOnHand: 90,
      stockShift: 5,
      usageShift: 3,
      requestMultiplier: 1.02,
      q4RequestBoost: 2,
      monthlyDispensed: [88, 90, 92, 94, 96, 98, 100, 102, 104, 106, 108, 110],
      expiryBatches: [
        { label: "Lot A", units: 36, daysToExpiry: 88 },
        { label: "Lot B", units: 54, daysToExpiry: 205 }
      ]
    },
    {
      name: "Multivitamins",
      category: "Wellness",
      condition: "Wellness Support",
      supplier: "Program Allocation",
      unitCost: 3.0,
      safetyStock: 80,
      stockOnHand: 530,
      stockShift: 14,
      usageShift: 1,
      requestMultiplier: 1.01,
      q4RequestBoost: 0,
      monthlyDispensed: [24, 22, 25, 26, 28, 30, 32, 30, 29, 28, 27, 29],
      expiryBatches: [
        { label: "Lot A", units: 240, daysToExpiry: 55 },
        { label: "Lot B", units: 290, daysToExpiry: 230 }
      ]
    }
  ];

  const availableYears = Array.from({ length: 5 }, (_, index) => currentYear - 4 + index);
  const dashboardData = {};

  const buildSupplierData = (year) => {
    const drift = year - currentYear;

    return supplierTemplates.map((template) => {
      const leadTimes = template.monthlyLeadTimes.map((value) => Number(Math.max(2, (value + drift * template.leadTimeTrend).toFixed(1))));
      const delayedCount = leadTimes.filter((value) => value > template.targetLeadTime).length;
      const averageLeadTime = average(leadTimes);
      const onTimeRate = percent(leadTimes.length - delayedCount, leadTimes.length);

      return {
        ...template,
        leadTimes,
        averageLeadTime,
        delayedCount,
        onTimeRate
      };
    });
  };

  const buildMedicineData = (year, supplierMap) => {
    const drift = year - currentYear;

    return medicineTemplates.map((template) => {
      const monthlyDispensed = template.monthlyDispensed.map((value) => Math.max(0, Math.round(value + drift * template.usageShift)));
      const monthlyRequested = monthlyDispensed.map((value, index) => {
        const seasonalBoost = index >= 9 ? template.q4RequestBoost : index >= 6 ? Math.round(template.q4RequestBoost * 0.4) : 0;
        return Math.max(0, Math.round(value * template.requestMultiplier + seasonalBoost));
      });
      const stockOnHand = Math.max(0, Math.round(template.stockOnHand + drift * template.stockShift));
      const supplier = supplierMap[template.supplier];

      return {
        ...template,
        stockOnHand,
        monthlyDispensed,
        monthlyRequested,
        supplierAverageLeadTime: supplier ? supplier.averageLeadTime : 5,
        expiryBatches: template.expiryBatches.map((batch) => ({
          ...batch,
          units: Math.max(10, Math.round(batch.units + drift * 4))
        }))
      };
    });
  };

  const classifyFsn = (averageMonthlyUsage) => {
    if (averageMonthlyUsage >= 130) return "Fast";
    if (averageMonthlyUsage >= 60) return "Slow";
    return "Non-moving";
  };

  const buildDashboardData = (year) => {
    const suppliers = buildSupplierData(year);
    const supplierMap = Object.fromEntries(suppliers.map((supplier) => [supplier.name, supplier]));
    const medicines = buildMedicineData(year, supplierMap);

    const totalMonthlyDispensed = months.map((_, monthIndex) => sum(medicines.map((medicine) => medicine.monthlyDispensed[monthIndex])));
    const movingAverage = movingAverageForecast(totalMonthlyDispensed, 3);
    const exponentialSmoothing = exponentialSmoothingForecast(totalMonthlyDispensed, 0.35);
    const combinedForecast = Math.round((movingAverage + exponentialSmoothing) / 2);

    const forecastChartData = {
      actual: [...totalMonthlyDispensed, null],
      movingAverageSeries: [...Array(11).fill(null), totalMonthlyDispensed[11], Math.round(movingAverage)],
      smoothingSeries: [...Array(11).fill(null), totalMonthlyDispensed[11], Math.round(exponentialSmoothing)]
    };

    const conditionSeriesMap = conditionLabels.reduce((accumulator, label) => {
      accumulator[label] = months.map((_, monthIndex) => sum(
        medicines
          .filter((medicine) => medicine.condition === label)
          .map((medicine) => medicine.monthlyRequested[monthIndex])
      ));
      return accumulator;
    }, {});

    const illnessRanked = conditionLabels
      .map((label) => {
        const monthlyRequests = conditionSeriesMap[label];
        const annualRequests = sum(monthlyRequests);
        const previousQuarter = sum(monthlyRequests.slice(6, 9));
        const currentQuarter = sum(monthlyRequests.slice(9, 12));
        const growthPercent = previousQuarter > 0 ? ((currentQuarter - previousQuarter) / previousQuarter) * 100 : 0;

        return {
          label,
          annualRequests,
          growthPercent
        };
      })
      .sort((left, right) => right.annualRequests - left.annualRequests);

    const dominantTrend = illnessRanked[0] || {
      label: "No data",
      annualRequests: 0,
      growthPercent: 0
    };

    const fsnItems = medicines.map((medicine) => {
      const averageMonthlyUsage = average(medicine.monthlyDispensed);
      return {
        name: medicine.name,
        status: classifyFsn(averageMonthlyUsage),
        averageMonthlyUsage
      };
    });

    const fsnCounts = {
      Fast: fsnItems.filter((item) => item.status === "Fast").length,
      Slow: fsnItems.filter((item) => item.status === "Slow").length,
      "Non-moving": fsnItems.filter((item) => item.status === "Non-moving").length
    };

    const fastMovers = fsnItems
      .filter((item) => item.status === "Fast")
      .sort((left, right) => right.averageMonthlyUsage - left.averageMonthlyUsage)
      .slice(0, 3);

    const watchList = fsnItems
      .filter((item) => item.status !== "Fast")
      .sort((left, right) => left.averageMonthlyUsage - right.averageMonthlyUsage)
      .slice(0, 4);

    const allExpiryRows = medicines
      .flatMap((medicine) => {
        const averageMonthlyUsage = average(medicine.monthlyDispensed);

        return medicine.expiryBatches.map((batch) => {
          const monthsToExpire = batch.daysToExpiry / 30;
          const monthsToClear = averageMonthlyUsage > 0 ? batch.units / averageMonthlyUsage : 99;
          const severityScore = monthsToClear - monthsToExpire;

          let status = "Healthy";
          if (severityScore >= 0.4) status = "High Risk";
          else if (severityScore >= -0.2) status = "Watch";

          return {
            medicine: medicine.name,
            batch: batch.label,
            units: batch.units,
            daysToExpiry: batch.daysToExpiry,
            averageMonthlyUsage,
            monthsToExpire,
            monthsToClear,
            status,
            severityScore
          };
        });
      });

    const expiryRows = [...allExpiryRows]
      .sort((left, right) => right.severityScore - left.severityScore)
      .slice(0, 6);

    const expiryRiskCount = allExpiryRows.filter((row) => row.status !== "Healthy").length;
    const expiryRiskUnits = sum(allExpiryRows.filter((row) => row.status !== "Healthy").map((row) => row.units));
    const soonestExpiryDays = allExpiryRows.length ? Math.min(...allExpiryRows.map((row) => row.daysToExpiry)) : 0;

    const allReorderRows = medicines
      .map((medicine) => {
        const averageMonthlyUsage = average(medicine.monthlyDispensed);
        const averageDailyUsage = averageMonthlyUsage / 30;
        const leadTime = medicine.supplierAverageLeadTime;
        const reorderPoint = Math.ceil(averageDailyUsage * leadTime + medicine.safetyStock);
        const maxStockLevel = Math.ceil(averageMonthlyUsage * 4);
        const coverageMonths = averageMonthlyUsage > 0 ? medicine.stockOnHand / averageMonthlyUsage : 0;
        const suggestedQty = Math.max(0, Math.ceil(averageMonthlyUsage * 2 + medicine.safetyStock - medicine.stockOnHand));
        const excessUnits = Math.max(0, medicine.stockOnHand - maxStockLevel);

        let action = "Balanced";
        let priority = 3;
        let actionNote = `Coverage ${formatDecimal(coverageMonths, 1)} months`;

        if (medicine.stockOnHand <= reorderPoint) {
          action = "Request Now";
          priority = 1;
          actionNote = `Suggest CHO request of ${formatNumber(suggestedQty)} units`;
        } else if (medicine.stockOnHand >= maxStockLevel) {
          action = "Overstock / Hold";
          priority = 2;
          actionNote = `Coverage ${formatDecimal(coverageMonths, 1)} months`;
        } else if (coverageMonths <= 1.5) {
          action = "Monitor Weekly";
          priority = 2;
          actionNote = `Coverage ${formatDecimal(coverageMonths, 1)} months`;
        }

        return {
          medicine: medicine.name,
          stockOnHand: medicine.stockOnHand,
          averageMonthlyUsage,
          reorderPoint,
          coverageMonths,
          action,
          priority,
          actionNote,
          capitalAtRisk: excessUnits * medicine.unitCost
        };
      })
      .sort((left, right) => left.priority - right.priority || right.reorderPoint - left.reorderPoint);

    const reorderRows = allReorderRows.slice(0, 6);
    const understockItems = allReorderRows.filter((row) => row.action === "Request Now").length;
    const monitorItems = allReorderRows.filter((row) => row.action === "Monitor Weekly").length;
    const balancedItems = allReorderRows.filter((row) => row.action === "Balanced").length;
    const overstockItems = allReorderRows.filter((row) => row.action === "Overstock / Hold").length;
    const averageCoverageMonths = average(allReorderRows.map((row) => row.coverageMonths));
    const capitalAtRisk = sum(allReorderRows.map((row) => row.capitalAtRisk));

    const averageLeadTime = average(suppliers.map((supplier) => supplier.averageLeadTime));
    const totalDeliveries = sum(suppliers.map((supplier) => supplier.leadTimes.length));
    const onTimeDeliveries = sum(suppliers.map((supplier) => supplier.leadTimes.length - supplier.delayedCount));
    const overallOnTimeRate = percent(onTimeDeliveries, totalDeliveries);
    const delayedRequests = totalDeliveries - onTimeDeliveries;
    const weakestSupplier = [...suppliers].sort((left, right) => left.onTimeRate - right.onTimeRate)[0];

    const dominantShare = percent(dominantTrend.annualRequests, sum(illnessRanked.map((item) => item.annualRequests)));
    const forecastNote = `MA ${formatNumber(movingAverage)} | ES ${formatNumber(exponentialSmoothing)} from the last 12 months of dispensing and prescription demand`;

    const alerts = [];
    const reorderAlert = reorderRows.find((row) => row.action === "Request Now");
    if (reorderAlert) {
      alerts.push({
        tone: "danger",
        label: "Shortage Alert",
        icon: "bi bi-exclamation-triangle-fill",
        title: `${reorderAlert.medicine} needs a CHO request`,
        body: `${reorderAlert.medicine} is at ${formatNumber(reorderAlert.stockOnHand)} units versus a request point of ${formatNumber(reorderAlert.reorderPoint)}. ${reorderAlert.actionNote}.`,
        meta: "Request point with safety stock logic"
      });
    }

    alerts.push({
      tone: "info",
      label: "Demand Forecast",
      icon: "bi bi-graph-up-arrow",
      title: `${formatNumber(combinedForecast)} units projected next cycle`,
      body: `Historical sales, dispensing, and prescription activity suggest the next cycle demand will stay near ${formatNumber(combinedForecast)} units. ${forecastNote}.`,
      meta: "Moving average and exponential smoothing"
    });

    alerts.push({
      tone: "warning",
      label: "Disease Trend",
      icon: "bi bi-activity",
      title: `${dominantTrend.label} shows the strongest signal`,
      body: `${dominantTrend.label} accounts for ${formatPercent(dominantShare, 0)} of mapped medicine requests and moved ${formatChange(dominantTrend.growthPercent)} versus the previous quarter.`,
      meta: "Medicine request frequency mapped to possible illness groups in Cabarian, Ligao City"
    });

    const expiryAlert = expiryRows.find((row) => row.status === "High Risk") || expiryRows[0];
    if (expiryAlert) {
      alerts.push({
        tone: expiryAlert.status === "High Risk" ? "danger" : "warning",
        label: "Medicine at Risk",
        icon: "bi bi-hourglass-split",
        title: `${expiryAlert.medicine} ${expiryAlert.batch} may be wasted`,
        body: `${formatNumber(expiryAlert.units)} units expire in ${formatNumber(expiryAlert.daysToExpiry)} days, but projected consumption needs ${formatDecimal(expiryAlert.monthsToClear, 1)} months to clear.`,
        meta: "Expiry date versus consumption rate"
      });
    }

    if (weakestSupplier) {
      alerts.push({
        tone: "success",
        label: "Fulfillment Review",
        icon: "bi bi-truck",
        title: `${weakestSupplier.name} needs follow-up`,
        body: `${weakestSupplier.name} averages ${formatDecimal(weakestSupplier.averageLeadTime, 1)} days with an on-time fulfillment rate of ${formatPercent(weakestSupplier.onTimeRate, 0)}.`,
        meta: "CHO request turnaround monitoring"
      });
    }

    return {
      metrics: {
        totalMedicines: medicines.length,
        totalStockUnits: sum(medicines.map((medicine) => medicine.stockOnHand)),
        forecastDemand: combinedForecast,
        averageLeadTime,
        expiryRiskCount,
        reorderNowCount: understockItems
      },
      forecast: {
        combinedForecast,
        movingAverage,
        exponentialSmoothing,
        note: forecastNote,
        labels: [...months, nextCycleLabel],
        series: forecastChartData
      },
      illness: {
        ranked: illnessRanked,
        dominant: dominantTrend,
        dominantShare
      },
      stock: {
        lowCount: understockItems,
        balancedCount: balancedItems,
        overstockCount: overstockItems,
        averageCoverageMonths
      },
      fsn: {
        counts: fsnCounts,
        fastMovers,
        watchList
      },
      leadTime: {
        suppliers,
        averageLeadTime,
        onTimeRate: overallOnTimeRate,
        delayedRequests
      },
      expiry: {
        rows: expiryRows,
        riskCount: expiryRiskCount,
        riskUnits: expiryRiskUnits,
        soonestExpiryDays
      },
      reorder: {
        rows: reorderRows,
        understockItems,
        monitorItems,
        balancedItems,
        overstockItems,
        capitalAtRisk
      },
      alerts
    };
  };

  availableYears.forEach((year) => {
    dashboardData[year] = buildDashboardData(year);
  });

  if (yearSelect) {
    availableYears.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    });
    yearSelect.value = String(currentYear);
  }
  if (window.Chart) {
    window.Chart.defaults.color = "#335a46";
    window.Chart.defaults.font.family = "Manrope, sans-serif";
  }

  const charts = {};

  const pieTooltipLabel = (context) => {
    const values = context?.dataset?.data || [];
    const total = sum(values);
    const value = toNumber(context?.raw);
    const label = String(context?.label || "Value");
    return `${label}: ${formatPercent(percent(value, total), 1)} (${formatNumber(value)})`;
  };

  const renderLegend = (legendId, labels, values, colors) => {
    const legend = document.getElementById(legendId);
    if (!legend) return;

    const total = sum(values);
    legend.innerHTML = labels
      .map((label, index) => {
        const color = colors[index] || palette.gray;
        const value = toNumber(values[index]);
        return `<span class="legend-item"><i class="legend-swatch" style="background:${color}"></i>${label} (${formatPercent(percent(value, total), 0)})</span>`;
      })
      .join("");
  };

  const initCharts = () => {
    if (!window.Chart) return;

    const forecastCanvas = document.getElementById("forecastChart");
    const illnessCanvas = document.getElementById("illnessTrendChart");
    const fsnCanvas = document.getElementById("fsnChart");
    const leadTimeCanvas = document.getElementById("leadTimeChart");

    if (forecastCanvas) {
      charts.forecast = new window.Chart(forecastCanvas, {
        type: "line",
        data: {
          labels: [...months, nextCycleLabel],
          datasets: [
            {
              label: "Actual Dispensed",
              data: [...Array(13).fill(null)],
              borderColor: palette.green,
              backgroundColor: "rgba(24,169,87,0.2)",
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointRadius: 4
            },
            {
              label: "Moving Average Forecast",
              data: [...Array(13).fill(null)],
              borderColor: palette.gold,
              borderDash: [6, 4],
              borderWidth: 2,
              tension: 0.2,
              pointRadius: 4,
              spanGaps: true
            },
            {
              label: "Exponential Smoothing",
              data: [...Array(13).fill(null)],
              borderColor: palette.blue,
              borderDash: [6, 4],
              borderWidth: 2,
              tension: 0.2,
              pointRadius: 4,
              spanGaps: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 }
            }
          }
        }
      });
    }

    if (illnessCanvas) {
      charts.illness = new window.Chart(illnessCanvas, {
        type: "bar",
        data: {
          labels: conditionLabels,
          datasets: [{
            label: "Mapped Request Count",
            data: conditionLabels.map(() => 0),
            backgroundColor: [palette.green, palette.blue, palette.gold, palette.purple, palette.teal, palette.slate],
            borderRadius: 10
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { precision: 0 }
            },
            y: {
              ticks: { autoSkip: false }
            }
          }
        }
      });
    }

    if (fsnCanvas) {
      charts.fsn = new window.Chart(fsnCanvas, {
        type: "doughnut",
        data: {
          labels: ["Fast", "Slow", "Non-moving"],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [palette.green, palette.gold, palette.slate],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: pieTooltipLabel } }
          }
        }
      });
    }

    if (leadTimeCanvas) {
      charts.leadTime = new window.Chart(leadTimeCanvas, {
        data: {
          labels: supplierTemplates.map((supplier) => supplier.name),
          datasets: [
            {
              type: "bar",
              label: "Avg Response Lead Time (days)",
              data: supplierTemplates.map(() => 0),
              yAxisID: "y",
              backgroundColor: [palette.greenSoft, palette.gold, palette.red],
              borderRadius: 10
            },
            {
              type: "line",
              label: "On-time Fulfillment (%)",
              data: supplierTemplates.map(() => 0),
              yAxisID: "y1",
              borderColor: palette.blue,
              backgroundColor: "rgba(47,128,237,0.16)",
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: palette.blue
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = String(context.dataset.label || "Value");
                  const value = toNumber(context.raw);
                  if (context.dataset.yAxisID === "y1") return `${label}: ${formatPercent(value, 0)}`;
                  return `${label}: ${formatDecimal(value, 1)} days`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Days"
              }
            },
            y1: {
              beginAtZero: true,
              suggestedMax: 100,
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: {
                callback: (value) => `${value}%`
              },
              title: {
                display: true,
                 text: "Fulfillment %"
              }
            }
          }
        }
      });
    }
  };

  const renderNotifications = (alerts) => {
    const html = alerts
      .map((alert) => `
        <article class="alert-card alert-card--${alert.tone}">
          <div class="alert-label"><i class="${alert.icon}"></i>${alert.label}</div>
          <div class="alert-title">${alert.title}</div>
          <div class="alert-body">${alert.body}</div>
          <div class="alert-meta">${alert.meta}</div>
        </article>
      `)
      .join("");

    setHTML("analyticsAlerts", html);
  };

  const renderList = (id, items, formatter) => {
    const html = items
      .map((item) => `<li>${formatter(item)}</li>`)
      .join("");

    setHTML(id, html);
  };

  const renderExpiryTable = (rows) => {
    const html = rows
      .map((row) => `
        <tr>
          <td>
            <span class="cell-title">${row.medicine}</span>
            <span class="cell-sub">${row.batch} - ${formatNumber(row.units)} units</span>
          </td>
          <td>
            <span class="cell-title">${formatNumber(row.daysToExpiry)} days</span>
            <span class="cell-sub">${formatDecimal(row.monthsToExpire, 1)} months left</span>
          </td>
          <td>
            <span class="cell-title">${formatNumber(row.averageMonthlyUsage)}/mo</span>
            <span class="cell-sub">Average monthly issue</span>
          </td>
          <td>
            <span class="cell-title">${formatDecimal(row.monthsToClear, 1)} months</span>
            <span class="cell-sub">Consumption-based clearance</span>
          </td>
          <td><span class="${statusClassMap[row.status] || "status-pill"}">${row.status}</span></td>
        </tr>
      `)
      .join("");

    setHTML("expiryRiskTable", html);
  };

  const renderReorderTable = (rows) => {
    const html = rows
      .map((row) => `
        <tr>
          <td>
            <span class="cell-title">${row.medicine}</span>
            <span class="cell-sub">${formatNumber(row.averageMonthlyUsage)}/mo average use</span>
          </td>
          <td>
            <span class="cell-title">${formatNumber(row.stockOnHand)} / ${formatNumber(row.reorderPoint)}</span>
            <span class="cell-sub">Stock on hand / request point</span>
          </td>
          <td>
            <span class="cell-title">${formatDecimal(row.coverageMonths, 1)} months</span>
            <span class="cell-sub">Available stock cover</span>
          </td>
          <td>
            <span class="${statusClassMap[row.action] || "status-pill"}">${row.action}</span>
            <span class="cell-sub">${row.actionNote}</span>
          </td>
        </tr>
      `)
      .join("");

    setHTML("reorderSuggestionTable", html);
  };

  const updateCards = (data) => {
    setText("metricTotalMedicines", formatNumber(data.metrics.totalMedicines));
    setText("metricTotalUnits", formatNumber(data.metrics.totalStockUnits));
    setText("metricForecastDemand", formatNumber(data.metrics.forecastDemand));
    setText("metricAvgLeadTime", `${formatDecimal(data.metrics.averageLeadTime, 1)} d`);
    setText("metricExpiryRisk", formatNumber(data.metrics.expiryRiskCount));
    setText("metricReorderNow", formatNumber(data.metrics.reorderNowCount));

    setText("forecastDemandValue", `${formatNumber(data.forecast.combinedForecast)} units`);
    setText("forecastMovingAverage", formatNumber(data.forecast.movingAverage));
    setText("forecastExponential", formatNumber(data.forecast.exponentialSmoothing));
    setText("forecastDemandNote", data.forecast.note);

    setText("illnessTrendPrimary", data.illness.dominant.label);
    setText(
      "illnessTrendNote",
      `${formatPercent(data.illness.dominantShare, 0)} of mapped requests - ${formatChange(data.illness.dominant.growthPercent)} vs previous quarter`
    );

    setText("stockLowCount", formatNumber(data.stock.lowCount));
    setText("stockBalancedCount", formatNumber(data.stock.balancedCount));
    setText("stockOverCount", formatNumber(data.stock.overstockCount));
    setText("stockCoverageAverage", `${formatDecimal(data.stock.averageCoverageMonths, 1)} mo`);

    setText("fsnFastCount", formatNumber(data.fsn.counts.Fast));
    setText("fsnSlowCount", formatNumber(data.fsn.counts.Slow));
    setText("fsnNonCount", formatNumber(data.fsn.counts["Non-moving"]));

    setText("leadTimeAverage", `${formatDecimal(data.leadTime.averageLeadTime, 1)} d`);
    setText("leadTimeOnTimeRate", formatPercent(data.leadTime.onTimeRate, 0));
    setText("leadTimeDelayedCount", formatNumber(data.leadTime.delayedRequests));

    setText("expiryLotRiskCount", formatNumber(data.expiry.riskCount));
    setText("expiryRiskUnits", formatNumber(data.expiry.riskUnits));
    setText("expirySoonestDays", `${formatNumber(data.expiry.soonestExpiryDays)} d`);

    setText("reorderUnderstockCount", formatNumber(data.reorder.understockItems));
    setText("reorderMonitorCount", formatNumber(data.reorder.monitorItems));
    setText("reorderOverstockCount", formatNumber(data.reorder.overstockItems));
    setText("reorderCapitalRisk", formatCurrency(data.reorder.capitalAtRisk));
  };

  const updateListsAndTables = (data) => {
    renderNotifications(data.alerts);

    renderList("fsnFastList", data.fsn.fastMovers, (item) => `
      <div>
        <span class="cell-title">${item.name}</span>
        <small>${item.status} classification</small>
      </div>
      <strong>${formatNumber(item.averageMonthlyUsage)}/mo</strong>
    `);

    renderList("fsnWatchList", data.fsn.watchList, (item) => `
      <div>
        <span class="cell-title">${item.name}</span>
        <small>${item.status}</small>
      </div>
      <strong>${formatNumber(item.averageMonthlyUsage)}/mo</strong>
    `);

    renderExpiryTable(data.expiry.rows);
    renderReorderTable(data.reorder.rows);
  };

  const updateCharts = (data) => {
    if (charts.forecast) {
      charts.forecast.data.labels = data.forecast.labels;
      charts.forecast.data.datasets[0].data = data.forecast.series.actual;
      charts.forecast.data.datasets[1].data = data.forecast.series.movingAverageSeries;
      charts.forecast.data.datasets[2].data = data.forecast.series.smoothingSeries;
      charts.forecast.update();
    }

    if (charts.illness) {
      charts.illness.data.labels = data.illness.ranked.map((item) => item.label);
      charts.illness.data.datasets[0].data = data.illness.ranked.map((item) => item.annualRequests);
      charts.illness.update();
    }

    if (charts.fsn) {
      const labels = ["Fast", "Slow", "Non-moving"];
      const values = labels.map((label) => toNumber(data.fsn.counts[label]));
      const colors = [palette.green, palette.gold, palette.slate];

      charts.fsn.data.labels = labels;
      charts.fsn.data.datasets[0].data = values;
      charts.fsn.data.datasets[0].backgroundColor = colors;
      charts.fsn.update();
      renderLegend("fsnLegend", labels, values, colors);
    }

    if (charts.leadTime) {
      charts.leadTime.data.labels = data.leadTime.suppliers.map((supplier) => supplier.name);
      charts.leadTime.data.datasets[0].data = data.leadTime.suppliers.map((supplier) => Number(supplier.averageLeadTime.toFixed(1)));
      charts.leadTime.data.datasets[1].data = data.leadTime.suppliers.map((supplier) => Number(supplier.onTimeRate.toFixed(0)));
      charts.leadTime.update();
    }
  };

  const loadDashboard = (year) => {
    const selectedYear = Number(year) || currentYear;
    const data = dashboardData[selectedYear] || buildDashboardData(selectedYear);
    updateCards(data);
    updateListsAndTables(data);
    updateCharts(data);
    if (document.getElementById("supplyLeadTimeChart")) renderSupplyDeliveryScenario();
  };

  if (yearSelect) {
    yearSelect.addEventListener("change", () => {
      loadDashboard(Number(yearSelect.value) || currentYear);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      const selectedYear = Number(yearSelect?.value) || currentYear;
      refreshBtn.disabled = true;
      if (refreshModal) refreshModal.show();

      window.setTimeout(() => {
        dashboardData[selectedYear] = buildDashboardData(selectedYear);
        loadDashboard(selectedYear);
        refreshBtn.disabled = false;
        if (refreshModal) refreshModal.hide();
      }, 700);
    });
  }

  initCharts();
  loadDashboard(Number(yearSelect?.value) || currentYear);
  window.addEventListener("mss:supply-state-updated", () => {
    renderSupplyDeliveryScenario();
  });
})();
