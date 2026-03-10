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

  if (yearEl) yearEl.textContent = String(currentYear);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const nextCycleLabel = "Next";

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

  const formatDecimal = (value, digits = 1) => new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(toNumber(value));

  const formatPercent = (value, digits = 0) => `${formatDecimal(value, digits)}%`;
  const formatChange = (value) => `${toNumber(value) >= 0 ? "+" : ""}${formatDecimal(value, 1)}%`;
  const formatCurrency = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0
  }).format(toNumber(value));

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
    "Reorder Now": "status-pill status-pill--danger",
    "Monitor Weekly": "status-pill status-pill--warning",
    "Overstock / Hold": "status-pill status-pill--info",
    Balanced: "status-pill status-pill--success",
    "Early Reorder": "status-pill status-pill--danger",
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
  });

  if (logoutLink && logoutModal) {
    logoutLink.addEventListener("click", (event) => {
      event.preventDefault();
      logoutModal.show();
    });
  }

  const renderDemandPredictionScenario = () => {
    const demandChartEl = document.getElementById("demandForecastChart");
    const palette = {
      green: "#2f8f24",
      greenSoft: "#6cab57",
      gold: "#dcbc45",
      red: "#dc2626",
      teal: "#0d9488",
      blue: "#2563eb",
      slate: "#64748b"
    };

    const demandMedicines = [
      {
        name: "Paracetamol",
        label: "500mg Tablet",
        stockOnHand: 540,
        safetyStock: 210,
        reason: "Tumataas kapag dumarami ang lagnat at trangkaso sa tag-ulan.",
        monthlyDemand: [210, 195, 205, 220, 238, 272, 310, 325, 298, 276, 244, 228]
      },
      {
        name: "Lagundi",
        label: "Syrup",
        stockOnHand: 220,
        safetyStock: 110,
        reason: "Mas mataas ang request kapag laganap ang ubo at sipon.",
        monthlyDemand: [72, 68, 74, 82, 91, 118, 138, 146, 134, 121, 98, 84]
      },
      {
        name: "Cetirizine",
        label: "10mg Tablet",
        stockOnHand: 190,
        safetyStock: 90,
        reason: "Mas maraming kumukuha kapag may allergy at weather-related symptoms.",
        monthlyDemand: [88, 81, 86, 93, 104, 126, 147, 152, 143, 132, 109, 96]
      }
    ];

    const rainyMonthIndexes = [5, 6, 7, 8, 9];
    const dryMonthIndexes = months.map((_, index) => index).filter((index) => !rainyMonthIndexes.includes(index));

    const medicineForecasts = demandMedicines.map((medicine) => {
      const monthlyAverage = average(medicine.monthlyDemand);
      const rainyAverage = average(rainyMonthIndexes.map((index) => medicine.monthlyDemand[index]));
      const dryAverage = average(dryMonthIndexes.map((index) => medicine.monthlyDemand[index]));
      const rainyUplift = dryAverage > 0 ? ((rainyAverage - dryAverage) / dryAverage) * 100 : 0;
      const movingAverage = movingAverageForecast(medicine.monthlyDemand, 3);
      const smoothing = exponentialSmoothingForecast(medicine.monthlyDemand, 0.35);
      const forecast = Math.round((movingAverage + smoothing) / 2);
      const reorderTarget = Math.ceil(forecast + medicine.safetyStock);
      const suggestedOrder = Math.max(0, reorderTarget - medicine.stockOnHand);
      const coverageMonths = monthlyAverage > 0 ? medicine.stockOnHand / monthlyAverage : 0;

      let action = "Ready";
      let actionNote = `Stock cover ${formatDecimal(coverageMonths, 1)} months`;

      if (suggestedOrder > 0) {
        action = "Early Reorder";
        actionNote = `Magdagdag ng ${formatNumber(suggestedOrder)} units bago ang peak month`;
      } else if (rainyUplift >= 20 && medicine.stockOnHand < forecast * 2.4) {
        action = "Build Buffer";
        actionNote = `Maghanda para sa ${formatPercent(rainyUplift, 0)} rainy-season increase`;
      }

      return {
        ...medicine,
        monthlyAverage,
        rainyAverage,
        dryAverage,
        rainyUplift,
        movingAverage,
        smoothing,
        forecast,
        reorderTarget,
        suggestedOrder,
        coverageMonths,
        action,
        actionNote
      };
    });

    const aggregateDemand = months.map((_, monthIndex) => sum(
      medicineForecasts.map((medicine) => medicine.monthlyDemand[monthIndex])
    ));
    const aggregateMovingAverage = movingAverageForecast(aggregateDemand, 3);
    const aggregateSmoothing = exponentialSmoothingForecast(aggregateDemand, 0.35);
    const combinedForecast = Math.round((aggregateMovingAverage + aggregateSmoothing) / 2);
    const totalRainyAverage = average(rainyMonthIndexes.map((index) => aggregateDemand[index]));
    const totalDryAverage = average(dryMonthIndexes.map((index) => aggregateDemand[index]));
    const rainyUplift = totalDryAverage > 0 ? ((totalRainyAverage - totalDryAverage) / totalDryAverage) * 100 : 0;
    const earlyReorderCount = medicineForecasts.filter((medicine) => medicine.action === "Early Reorder").length;
    const sortedMedicines = [...medicineForecasts].sort((left, right) => right.forecast - left.forecast);
    setText("metricDemandForecast", formatNumber(combinedForecast));
    setText("metricDemandUplift", `${rainyUplift >= 0 ? "+" : ""}${formatPercent(rainyUplift, 0)}`);
    setText("metricDemandPriority", formatNumber(medicineForecasts.length));
    setText("metricDemandReorder", formatNumber(earlyReorderCount));
    setText(
      "demandForecastNote",
      `${formatNumber(combinedForecast)} projected next-cycle demand based on the last 12 months.`
    );
    setHTML(
      "seasonalSignalList",
      sortedMedicines
        .map((medicine) => `
        <article class="demand-priority-item">
          <div class="demand-priority-item__left">
            <div class="demand-priority-item__icon demand-priority-item__icon--${medicine.action === "Early Reorder" ? "warning" : "success"}">
              <i class="${medicine.name === "Lagundi" ? "bi bi-capsule-pill" : "bi bi-capsule"}"></i>
            </div>
            <div class="demand-priority-item__copy">
              <strong>${medicine.name}</strong>
              <span>${medicine.action === "Early Reorder" ? "Reorder Soon" : medicine.name === "Paracetamol" ? "High Demand" : "Increasing"}</span>
            </div>
          </div>
          <div class="demand-priority-item__badge demand-priority-item__badge--${medicine.action === "Early Reorder" ? "warning" : "success"}">
            <i class="${medicine.action === "Early Reorder" ? "bi bi-exclamation-lg" : "bi bi-arrow-up"}"></i>
          </div>
        </article>
      `).join("")
    );

    if (demandChartEl && window.Chart) {
      if (window.__demandPredictionChart) window.__demandPredictionChart.destroy();

      window.__demandPredictionChart = new window.Chart(demandChartEl, {
        type: "line",
        data: {
          labels: [...months, nextCycleLabel],
          datasets: [
            {
              label: "Actual Demand",
              data: [...aggregateDemand, null],
              borderColor: "#4c983f",
              backgroundColor: "rgba(76,152,63,0.18)",
              fill: true,
              tension: 0.3,
              borderWidth: 3,
              pointRadius: 4,
              pointHoverRadius: 5
            },
            {
              label: "Predicted Demand",
              data: [...Array(11).fill(null), aggregateDemand[11], combinedForecast],
              borderColor: "#4f95c8",
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
              suggestedMax: 500,
              ticks: {
                precision: 0,
                stepSize: 100
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
    }
  };

  const renderDiseasePatternScenario = () => {
    const diseaseChartEl = document.getElementById("diseasePatternChart");
    const medicineRequestSignals = [
      {
        illness: "Flu / Fever",
        medicine: "Paracetamol",
        requests: 45,
        status: "Possible fever pattern",
        accent: "danger",
        icon: "bi bi-thermometer-half"
      },
      {
        illness: "Cough / Cold",
        medicine: "Lagundi",
        requests: 32,
        status: "Cough-related requests",
        accent: "orange",
        icon: "bi bi-capsule-pill"
      },
      {
        illness: "Allergy",
        medicine: "Cetirizine",
        requests: 18,
        status: "Weather-triggered symptoms",
        accent: "gold",
        icon: "bi bi-stars"
      },
      {
        illness: "Diarrhea",
        medicine: "ORS",
        requests: 12,
        status: "Gastro symptom requests",
        accent: "teal",
        icon: "bi bi-droplet-half"
      }
    ];

    setHTML(
      "diseasePatternList",
      medicineRequestSignals
        .map((signal) => `
        <article class="pattern-case-card pattern-case-card--${signal.accent}">
          <div class="pattern-case-card__icon">
            <i class="${signal.icon}"></i>
          </div>
          <div class="pattern-case-card__copy">
            <strong>${signal.illness}</strong>
            <span>${formatNumber(signal.requests)} new cases</span>
          </div>
          <div class="pattern-case-card__metric">
            <i class="bi bi-arrow-up-right"></i>
            <span>${formatNumber(signal.requests)}</span>
          </div>
        </article>
      `)
        .join("")
    );

    if (diseaseChartEl && window.Chart) {
      if (window.__diseasePatternChart) window.__diseasePatternChart.destroy();

      window.__diseasePatternChart = new window.Chart(diseaseChartEl, {
        type: "bar",
        data: {
          labels: medicineRequestSignals.map((signal) => signal.medicine),
          datasets: [{
            data: medicineRequestSignals.map((signal) => signal.requests),
            backgroundColor: ["#75a85a", "#cba43b", "#7cb7ac", "#6baf63"],
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
              suggestedMax: 50,
              ticks: {
                stepSize: 10,
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

  const renderStockMovementScenario = () => {
    const fastMovingMedicines = [
      { name: "Paracetamol", dispensed: 120, icon: "bi bi-capsule" },
      { name: "Lagundi", dispensed: 85, icon: "bi bi-capsule-pill" },
      { name: "Amoxicillin", dispensed: 73, icon: "bi bi-capsule" },
      { name: "ORS", dispensed: 61, icon: "bi bi-droplet-half" }
    ];

    const slowMovingMedicines = [
      { name: "Vitamin C", dispensed: 15, icon: "bi bi-capsule" },
      { name: "Mefenamic Acid", dispensed: 10, icon: "bi bi-capsule" },
      { name: "Cetirizine", dispensed: 9, icon: "bi bi-capsule" },
      { name: "Ferrous Sulfate", dispensed: 8, icon: "bi bi-capsule-pill" },
      { name: "Multivitamins", dispensed: 6, icon: "bi bi-capsule" },
      { name: "Salbutamol", dispensed: 5, icon: "bi bi-capsule" }
    ];

    const renderMovementItem = (medicine, type) => `
      <article class="movement-item movement-item--${type}">
        <div class="movement-item__icon movement-item__icon--${type}">
          <i class="${medicine.icon}"></i>
        </div>
        <div class="movement-item__copy">
          <strong>${medicine.name}</strong>
          <span>${type === "fast" ? "High stock turnover" : "Low stock turnover"}</span>
        </div>
        <div class="movement-item__meta">
          <div class="movement-item__value">
            <strong>${formatNumber(medicine.dispensed)}</strong>
            <span>Dispensed</span>
          </div>
          <div class="movement-item__status movement-item__status--${type}">
            <i class="bi ${type === "fast" ? "bi-arrow-up-right" : "bi-arrow-down-right"}"></i>
            <span>${type === "fast" ? "Fast Moving" : "Slow Moving"}</span>
          </div>
        </div>
      </article>
    `;

    setText("stockMovementFastCount", `${formatNumber(fastMovingMedicines.length)} items`);
    setText("stockMovementSlowCount", `${formatNumber(slowMovingMedicines.length)} items`);
    setHTML("stockFastList", fastMovingMedicines.map((medicine) => renderMovementItem(medicine, "fast")).join(""));
    setHTML("stockSlowList", slowMovingMedicines.map((medicine) => renderMovementItem(medicine, "slow")).join(""));
  };

  const renderSupplyDeliveryScenario = () => {
    const leadTimeChartEl = document.getElementById("supplyLeadTimeChart");
    const supplyScenario = {
      source: "Ligao City Health Office (RHU)",
      averageLeadTime: 4,
      lastDelivery: "July 8",
      onTimeRate: 92,
      delayedCount: 1,
      leadTimeTrend: [3.2, 3.6, 4.1, 3.5, 4.0, 3.7, 4.2, 4.3, 4.9, 5.0, 4.6, 4.8],
      requests: [
        {
          batch: "Paracetamol + ORS",
          note: "Routine monthly replenishment",
          requested: "June 1",
          expected: "June 5",
          delivered: "June 5",
          status: "Delivered"
        },
        {
          batch: "Lagundi + Amoxicillin",
          note: "Rainy season support batch",
          requested: "June 15",
          expected: "June 18",
          delivered: "June 18",
          status: "Delivered"
        },
        {
          batch: "Cetirizine + Zinc Sulfate",
          note: "Follow-up request with supplier delay",
          requested: "July 2",
          expected: "July 5",
          delivered: "July 8",
          status: "Delayed",
          delayDays: 3
        }
      ]
    };

    const deliveredOnTimeCount = Math.round((supplyScenario.onTimeRate / 100) * 12);

    setText("supplySourceLabel", supplyScenario.source);
    setText("supplyAvgLeadTime", `${formatNumber(supplyScenario.averageLeadTime)} days`);
    setText("supplyLastDelivery", supplyScenario.lastDelivery);
    setText("supplyDeliveryRate", formatPercent(supplyScenario.onTimeRate, 0));
    setText("supplyDelayedCount", formatNumber(supplyScenario.delayedCount));
    setText("supplyReliabilityValue", formatPercent(supplyScenario.onTimeRate, 0));
    setText("supplyReliabilityNote", `${formatNumber(deliveredOnTimeCount)} of 12 deliveries arrived on time this cycle.`);
    setHTML(
      "supplyRequestList",
      supplyScenario.requests
        .map((request) => `
          <article class="supply-request-card">
            <div class="supply-request-card__head">
              <div class="supply-request-card__copy">
                <strong>${request.batch}</strong>
                <span>${request.note}</span>
              </div>
              <div class="supply-request-card__badge supply-request-card__badge--${request.status === "Delayed" ? "delay" : "done"}">
                ${request.status}
              </div>
            </div>
            <div class="supply-request-steps">
              <div class="supply-request-step supply-request-step--done">
                <span class="supply-request-step__dot"></span>
                <small>${request.requested}</small>
                <span>Request Sent</span>
              </div>
              <div class="supply-request-step supply-request-step--done">
                <span class="supply-request-step__dot"></span>
                <small>${request.expected}</small>
                <span>Expected Date</span>
              </div>
              <div class="supply-request-step supply-request-step--${request.status === "Delayed" ? "delay" : "done"}">
                <span class="supply-request-step__dot"></span>
                <small>${request.delivered}</small>
                <span>${request.status === "Delayed" ? "Delivered Late" : "Delivered"}</span>
              </div>
            </div>
          </article>
        `)
        .join("")
    );

    ["supplySummaryReliabilityFill", "supplyReliabilityFill"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.width = `${Math.max(0, Math.min(100, supplyScenario.onTimeRate))}%`;
    });

    if (leadTimeChartEl && window.Chart) {
      if (window.__supplyLeadTimeChart) window.__supplyLeadTimeChart.destroy();

      window.__supplyLeadTimeChart = new window.Chart(leadTimeChartEl, {
        type: "line",
        data: {
          labels: months,
          datasets: [{
            data: supplyScenario.leadTimeTrend,
            borderColor: "#6fa45a",
            backgroundColor: "rgba(111, 164, 90, 0.18)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 5,
            pointBackgroundColor: "#dff0d5",
            pointBorderColor: "#679b53",
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
                color: "rgba(92, 103, 80, 0.08)"
              },
              ticks: {
                color: "#6d756a",
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              suggestedMax: 6,
              ticks: {
                stepSize: 1,
                precision: 0,
                color: "#6d756a",
                font: { size: 11 }
              },
              grid: {
                color: "rgba(92, 103, 80, 0.12)"
              }
            }
          }
        }
      });
    }
  };

  const renderExpiryConsumptionScenario = () => {
    const expiringMedicines = [
      { name: "Amoxicillin", expiry: "Aug 20", daysLeft: 12, tone: "danger", icon: "bi bi-capsule" },
      { name: "ORS", expiry: "Aug 25", daysLeft: 17, tone: "warning", icon: "bi bi-droplet-half" },
      { name: "Vitamin C", expiry: "Sep 1", daysLeft: 24, tone: "watch", icon: "bi bi-capsule" },
      { name: "Amlodipine", expiry: "Sep 8", daysLeft: 31, tone: "watch", icon: "bi bi-capsule" },
      { name: "Salbutamol", expiry: "Sep 16", daysLeft: 39, tone: "watch", icon: "bi bi-capsule" }
    ];

    const consumptionRates = [
      { name: "Paracetamol", dispensed: 120, level: "Fast", tone: "fast", icon: "bi bi-capsule" },
      { name: "Lagundi", dispensed: 60, level: "Moderate", tone: "moderate", icon: "bi bi-capsule-pill" },
      { name: "Vitamin C", dispensed: 15, level: "Slow", tone: "slow", icon: "bi bi-capsule" },
      { name: "Multivitamins", dispensed: 22, level: "Slow", tone: "slow", icon: "bi bi-capsule" }
    ];

    const riskItem = {
      name: "Vitamin C",
      stock: 200,
      consumption: "Slow",
      expiryWindow: "30 Days"
    };

    const inventoryTotalUnits = 2150;
    const slowConsumptionCount = consumptionRates.filter((item) => item.level === "Slow").length;
    const withinThirtyDays = expiringMedicines.filter((item) => item.daysLeft <= 30).length;

    setText("expirySoonCount", `${formatNumber(expiringMedicines.length)} medicines`);
    setText("expiryThirtyCount", `${formatNumber(withinThirtyDays)} medicines`);
    setText("expiryInventoryTotal", `${formatNumber(inventoryTotalUnits)} units`);
    setText("expirySlowCount", `${formatNumber(slowConsumptionCount)} medicines`);
    setText("expiryRiskTitle", riskItem.name);

    setHTML(
      "expiryMedicineList",
      expiringMedicines
        .map((medicine) => `
          <article class="expiry-medicine-item">
            <div class="expiry-medicine-item__icon">
              <i class="${medicine.icon}"></i>
            </div>
            <div class="expiry-medicine-item__copy">
              <strong>${medicine.name}</strong>
              <span>Expiry: ${medicine.expiry}</span>
            </div>
            <div class="expiry-days-pill expiry-days-pill--${medicine.tone}">
              <small>Days Left</small>
              <strong>${formatNumber(medicine.daysLeft)}</strong>
            </div>
          </article>
        `)
        .join("")
    );

    setHTML(
      "expiryConsumptionList",
      consumptionRates
        .map((item) => `
          <article class="expiry-consumption-item">
            <div class="expiry-consumption-item__left">
              <div class="expiry-consumption-item__icon">
                <i class="${item.icon}"></i>
              </div>
              <div class="expiry-consumption-item__copy">
                <strong>${item.name}</strong>
                <span>${formatNumber(item.dispensed)} dispensed / month</span>
              </div>
            </div>
            <div class="expiry-consumption-item__meta">
              <span class="expiry-rate-pill expiry-rate-pill--${item.tone}">${item.level}</span>
              <span class="expiry-consumption-item__value">${formatNumber(item.dispensed)} / month</span>
            </div>
          </article>
        `)
        .join("")
    );

    setHTML(
      "expiryRiskFacts",
      [
        { label: "Stock", value: formatNumber(riskItem.stock) },
        { label: "Consumption", value: riskItem.consumption },
        { label: "Expiry", value: riskItem.expiryWindow }
      ]
        .map((item) => `
          <div class="expiry-risk-fact">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
          </div>
        `)
        .join("")
    );

  };

  const renderInventoryBalanceScenario = () => {
    const stockItems = [
      { name: "Paracetamol", stock: 150, status: "Balanced", tone: "balanced", target: 120, max: 180, icon: "bi bi-capsule" },
      { name: "Cetirizine", stock: 20, status: "Low Stock", tone: "low", target: 80, max: 140, icon: "bi bi-capsule" },
      { name: "Vitamin C", stock: 300, status: "Overstock", tone: "over", target: 180, max: 230, icon: "bi bi-capsule" },
      { name: "Lagundi", stock: 96, status: "Balanced", tone: "balanced", target: 85, max: 130, icon: "bi bi-capsule-pill" },
      { name: "ORS", stock: 72, status: "Balanced", tone: "balanced", target: 70, max: 110, icon: "bi bi-droplet-half" }
    ];

    const totalMedicines = 120;
    const balancedCount = 85;
    const lowCount = 5;
    const overstockCount = 3;
    const focusItem = stockItems[0];
    const scaleMax = 230;
    const currentPercent = Math.min(100, (focusItem.stock / scaleMax) * 100);
    const comparisonItems = stockItems.slice(0, 3);
    setText("balanceTotalMedicines", `${formatNumber(totalMedicines)} items`);
    setText("balanceBalancedCount", `${formatNumber(balancedCount)} medicines`);
    setText("balanceLowCount", `${formatNumber(lowCount)} medicines`);
    setText("balanceOverstockCount", `${formatNumber(overstockCount)} medicines`);
    setText("balanceFocusTitle", `${focusItem.name} Stock Level`);
    setText("balanceFocusValue", `Current Stock: ${formatNumber(focusItem.stock)}`);
    setText("balanceFocusNote", `${focusItem.name} remains within the optimal inventory range for the current cycle.`);

    const focusFill = document.getElementById("balanceFocusFill");
    if (focusFill) focusFill.style.width = `${currentPercent}%`;

    setHTML(
      "balanceStockRows",
      stockItems
        .slice(0, 3)
        .map((item) => `
          <div class="balance-table__row">
            <div class="balance-table__medicine">
              <div class="balance-table__icon">
                <i class="${item.icon}"></i>
              </div>
              <div class="balance-table__copy">
                <strong>${item.name}</strong>
                <span>Stock</span>
              </div>
            </div>
            <div class="balance-table__stock">${formatNumber(item.stock)}</div>
            <div class="balance-table__status">
              <span class="balance-status-pill balance-status-pill--${item.tone}">${item.status}</span>
            </div>
          </div>
        `)
        .join("")
    );

    setHTML(
      "balanceComparisonList",
      comparisonItems
        .map((item) => {
          const currentWidth = Math.min(100, (item.stock / scaleMax) * 100);
          const targetWidth = Math.min(100, (item.target / scaleMax) * 100);
          return `
            <article class="balance-comparison-item">
              <div class="balance-comparison-item__head">
                <strong>${item.name}</strong>
                <span>${item.status}</span>
              </div>
              <div class="balance-comparison-bars">
                <div class="balance-comparison-bar">
                  <small>Current</small>
                  <div class="balance-comparison-bar__track">
                    <span data-tone="current" style="width:${currentWidth}%"></span>
                  </div>
                </div>
                <div class="balance-comparison-bar">
                  <small>Optimal</small>
                  <div class="balance-comparison-bar__track">
                    <span data-tone="target" style="width:${targetWidth}%"></span>
                  </div>
                </div>
              </div>
            </article>
          `;
        })
        .join("")
    );

  };

  if (!document.getElementById("metricTotalMedicines")) {
    if (document.getElementById("demandForecastChart")) renderDemandPredictionScenario();
    if (document.getElementById("diseasePatternList")) renderDiseasePatternScenario();
    if (document.getElementById("stockFastList")) renderStockMovementScenario();
    if (document.getElementById("supplyLeadTimeChart")) renderSupplyDeliveryScenario();
    if (document.getElementById("expiryMedicineList")) renderExpiryConsumptionScenario();
    if (document.getElementById("balanceStockRows")) renderInventoryBalanceScenario();
    return;
  }

  const palette = {
    green: "#2f8f24",
    greenSoft: "#6cab57",
    gold: "#dcbc45",
    red: "#dc2626",
    teal: "#0d9488",
    blue: "#2563eb",
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
      name: "City Health Depot",
      targetLeadTime: 5,
      leadTimeTrend: -0.12,
      monthlyLeadTimes: [4.4, 4.2, 4.8, 4.3, 4.6, 4.5, 4.7, 4.4, 4.8, 4.5, 4.3, 4.4]
    },
    {
      name: "Ligao Pharma Hub",
      targetLeadTime: 6,
      leadTimeTrend: -0.08,
      monthlyLeadTimes: [6.1, 6.4, 6.0, 5.8, 6.5, 6.2, 6.1, 6.6, 6.3, 6.2, 5.9, 6.1]
    },
    {
      name: "Bicol Medline",
      targetLeadTime: 5,
      leadTimeTrend: -0.05,
      monthlyLeadTimes: [6.3, 6.5, 6.0, 5.9, 6.7, 6.8, 6.2, 6.4, 6.5, 6.1, 6.0, 6.4]
    }
  ];

  const medicineTemplates = [
    {
      name: "Paracetamol 500mg",
      category: "Analgesics",
      condition: "URI / Cough-Cold",
      supplier: "City Health Depot",
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
      supplier: "Ligao Pharma Hub",
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
      supplier: "Bicol Medline",
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
      supplier: "City Health Depot",
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
      supplier: "City Health Depot",
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
      supplier: "Bicol Medline",
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
      supplier: "Ligao Pharma Hub",
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
      supplier: "Ligao Pharma Hub",
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
      supplier: "City Health Depot",
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
      supplier: "Ligao Pharma Hub",
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
          action = "Reorder Now";
          priority = 1;
          actionNote = `Suggest +${formatNumber(suggestedQty)} units`;
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
    const understockItems = allReorderRows.filter((row) => row.action === "Reorder Now").length;
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
    const reorderAlert = reorderRows.find((row) => row.action === "Reorder Now");
    if (reorderAlert) {
      alerts.push({
        tone: "danger",
        label: "Shortage Alert",
        icon: "bi bi-exclamation-triangle-fill",
        title: `${reorderAlert.medicine} is below reorder point`,
        body: `${reorderAlert.medicine} is at ${formatNumber(reorderAlert.stockOnHand)} units versus an ROP of ${formatNumber(reorderAlert.reorderPoint)}. ${reorderAlert.actionNote}.`,
        meta: "Reorder point with safety stock logic"
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
      meta: "Medicine request frequency mapped to possible illness groups in Brgy. Cabarian"
    });

    const expiryAlert = expiryRows.find((row) => row.status === "High Risk") || expiryRows[0];
    if (expiryAlert) {
      alerts.push({
        tone: expiryAlert.status === "High Risk" ? "danger" : "warning",
        label: "Expiry Risk",
        icon: "bi bi-hourglass-split",
        title: `${expiryAlert.medicine} ${expiryAlert.batch} may be wasted`,
        body: `${formatNumber(expiryAlert.units)} units expire in ${formatNumber(expiryAlert.daysToExpiry)} days, but projected consumption needs ${formatDecimal(expiryAlert.monthsToClear, 1)} months to clear.`,
        meta: "Expiry date versus consumption rate"
      });
    }

    if (weakestSupplier) {
      alerts.push({
        tone: "success",
        label: "Lead Time Review",
        icon: "bi bi-truck",
        title: `${weakestSupplier.name} needs delivery monitoring`,
        body: `${weakestSupplier.name} averages ${formatDecimal(weakestSupplier.averageLeadTime, 1)} days with an on-time rate of ${formatPercent(weakestSupplier.onTimeRate, 0)}.`,
        meta: "Request module delivery reliability"
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
    window.Chart.defaults.color = "#3f4e2d";
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
              backgroundColor: "rgba(47,143,36,0.16)",
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
              label: "Avg Lead Time (days)",
              data: supplierTemplates.map(() => 0),
              yAxisID: "y",
              backgroundColor: [palette.greenSoft, palette.gold, palette.red],
              borderRadius: 10
            },
            {
              type: "line",
              label: "On-time Rate (%)",
              data: supplierTemplates.map(() => 0),
              yAxisID: "y1",
              borderColor: palette.blue,
              backgroundColor: "rgba(37,99,235,0.14)",
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
                text: "On-time %"
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
            <span class="cell-sub">Stock on hand / reorder point</span>
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
})();
