(() => {
  const roleFromBody = (document.body?.dataset?.role || "captain").toLowerCase();
  try {
    sessionStorage.setItem("userRole", roleFromBody || "captain");
  } catch (e) {}

  window.toggleSidebar = function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar || !backdrop) return;

    const isMobile = window.matchMedia("(max-width: 992px)").matches;
    if (isMobile) {
      sidebar.classList.toggle("open");
      backdrop.classList.toggle("show");
      document.body.classList.toggle("sidebar-open");
      return;
    }
    sidebar.classList.toggle("collapsed");
  };

  window.addEventListener("resize", () => {
    const isMobile = window.matchMedia("(max-width: 992px)").matches;
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar || !backdrop || isMobile) return;
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
    document.body.classList.remove("sidebar-open");
  });

  const API_ENDPOINT = "dashboard-analytics-api.php";
  const currentYear = new Date().getFullYear();

  const AGE_LABELS = [
    "Under 1",
    "1 to 4",
    "5 to 9",
    "10 to 14",
    "15 to 19",
    "20 to 24",
    "25 to 29",
    "30 to 34",
    "35 to 39",
    "40 to 44",
    "45 to 49",
    "50 to 54",
    "55 to 59",
    "60 to 64",
    "65 to 69",
    "70 to 74",
    "75 to 79",
    "80 and over",
  ];
  const AGE_KEY_TO_ID = {
    "Under 1": "age_under_1",
    "1 to 4": "age_1_4",
    "5 to 9": "age_5_9",
    "10 to 14": "age_10_14",
    "15 to 19": "age_15_19",
    "20 to 24": "age_20_24",
    "25 to 29": "age_25_29",
    "30 to 34": "age_30_34",
    "35 to 39": "age_35_39",
    "40 to 44": "age_40_44",
    "45 to 49": "age_45_49",
    "50 to 54": "age_50_54",
    "55 to 59": "age_55_59",
    "60 to 64": "age_60_64",
    "65 to 69": "age_65_69",
    "70 to 74": "age_70_74",
    "75 to 79": "age_75_79",
    "80 and over": "age_80_over",
  };
  const CIVIL_LABELS = ["Single", "Married", "Widowed", "Separated", "Other"];
  const HOUSEHOLD_SIZE_LABELS = ["1-2 Members", "3-5 Members", "6+ Members"];

  const PALETTE = {
    gender: ["#3b82f6", "#f43f5e", "#94a3b8"],
    civil: ["#3b82f6", "#f43f5e", "#f59e0b", "#10b981", "#94a3b8"],
    education: ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"],
    employment: ["#10b981", "#f97316", "#3b82f6", "#a855f7", "#e11d48"],
    household: ["#3b82f6", "#14b8a6", "#f59e0b", "#94a3b8"],
    ageBar: "#3b82f6",
  };

  const defaultPayload = (year) => ({
    year: Number(year) || currentYear,
    population_summary: {
      total_population: 0,
      male: 0,
      female: 0,
      households: 0,
      average_household_size: 0,
    },
    gender_distribution: {
      Male: 0,
      Female: 0,
      Other: 0,
    },
    age_brackets: {
      "Under 1": 0,
      "1 to 4": 0,
      "5 to 9": 0,
      "10 to 14": 0,
      "15 to 19": 0,
      "20 to 24": 0,
      "25 to 29": 0,
      "30 to 34": 0,
      "35 to 39": 0,
      "40 to 44": 0,
      "45 to 49": 0,
      "50 to 54": 0,
      "55 to 59": 0,
      "60 to 64": 0,
      "65 to 69": 0,
      "70 to 74": 0,
      "75 to 79": 0,
      "80 and over": 0,
    },
    civil_status_distribution: {
      Single: 0,
      Married: 0,
      Widowed: 0,
      Separated: 0,
      Other: 0,
    },
    household_size_distribution: {
      "1-2 Members": 0,
      "3-5 Members": 0,
      "6+ Members": 0,
    },
    socio_economic: {
      employment_status: {
        Employed: 0,
        Unemployed: 0,
        "Self-Employed": 0,
      },
      educational_attainment: {
        Elementary: 0,
        "High School": 0,
        College: 0,
        "Not Finished": 0,
      },
      other_indicators: {
        PWD: 0,
        "Senior Citizens": 0,
        "Solo Parents": 0,
      },
    },
    health_risk: {
      pregnant_women: 0,
      malnourished_children: 0,
      persons_with_illness: 0,
      deaths_by_cause: {},
    },
  });

  const yearSelect = document.getElementById("yearSelect");
  const refreshBtn = document.getElementById("refreshBtn");
  const refreshModalEl = document.getElementById("refreshModal");
  const refreshModal = refreshModalEl ? new bootstrap.Modal(refreshModalEl) : null;
  const logoutBtn = document.querySelector(".menu a.text-danger");
  const logoutModalEl = document.getElementById("logoutModal");
  const logoutModal = logoutModalEl ? new bootstrap.Modal(logoutModalEl) : null;
  const footerYear = document.getElementById("year");

  if (footerYear) {
    footerYear.textContent = String(currentYear);
  }

  if (logoutBtn && logoutModal) {
    logoutBtn.addEventListener("click", (event) => {
      event.preventDefault();
      logoutModal.show();
    });
  }

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(toNumber(value))));
  const sumValues = (values) => (Array.isArray(values) ? values.reduce((total, item) => total + toNumber(item), 0) : 0);
  const percentValue = (value, total) => {
    const safeTotal = toNumber(total);
    if (safeTotal <= 0) return 0;
    return (toNumber(value) / safeTotal) * 100;
  };
  const formatPercent = (value, total) => `${percentValue(value, total).toFixed(1).replace(/\.0$/, "")}%`;
  const pieTooltipLabel = (context) => {
    const data = context?.dataset?.data || [];
    const total = sumValues(data);
    const raw = toNumber(context?.raw);
    const label = String(context?.label || "Value");
    return `${label}: ${formatPercent(raw, total)} (${formatNumber(raw)})`;
  };
  const ageTooltipLabel = (context) => {
    const data = context?.dataset?.data || [];
    const total = sumValues(data);
    const raw = toNumber(context?.raw);
    const label = String(context?.label || "Age Group");
    return `${label}: ${formatPercent(raw, total)} (${formatNumber(raw)})`;
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
  };

  const normalizeAvailableYears = (availableYears) => (
    Array.isArray(availableYears)
      ? availableYears.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 2000 && item <= 2100)
      : []
  );

  const ensureYearOptions = (availableYears, selectedYear) => {
    if (!yearSelect) return;

    const normalized = normalizeAvailableYears(availableYears);
    const fallback = [currentYear];
    const targetYear = Number(selectedYear) || currentYear;
    const years = Array.from(new Set([...normalized, ...fallback, targetYear])).sort((a, b) => a - b);

    yearSelect.innerHTML = "";
    years.forEach((year) => {
      const option = document.createElement("option");
      option.value = String(year);
      option.textContent = String(year);
      yearSelect.appendChild(option);
    });
    yearSelect.value = String(targetYear);
  };

  const hasMeaningfulDemographicData = (payload) => {
    const totalPopulation = toNumber(payload?.population_summary?.total_population);
    const ageTotals = sumValues(Object.values(payload?.age_brackets || {}));
    const genderTotals = sumValues(Object.values(payload?.gender_distribution || {}));
    const householdTotals = sumValues(Object.values(payload?.household_size_distribution || {}));

    return totalPopulation > 0 || ageTotals > 0 || genderTotals > 0 || householdTotals > 0;
  };

  const pickFallbackYear = (availableYears, selectedYear) => {
    const normalized = normalizeAvailableYears(availableYears).sort((a, b) => a - b);
    const targetYear = Number(selectedYear) || currentYear;
    const previousYears = normalized.filter((year) => year < targetYear);

    if (previousYears.length > 0) {
      return previousYears[previousYears.length - 1];
    }

    const otherYears = normalized.filter((year) => year !== targetYear);
    return otherYears.length > 0 ? otherYears[otherYears.length - 1] : null;
  };

  const syncPieCardLayout = (legend) => {
    if (!legend) return;
    const card = legend.closest(".card-box.chart-card--pie");
    if (!card) return;

    // Let the card grow just enough to keep the pie legend readable.
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    const chartWrap = card.querySelector(".chart-square-wrap");
    const titleEl = card.querySelector("h6");
    const chartHeight = chartWrap ? chartWrap.getBoundingClientRect().height : 0;
    const titleHeight = titleEl ? titleEl.getBoundingClientRect().height : 0;
    const legendHeight = legend.scrollHeight || legend.getBoundingClientRect().height || 0;
    const computedMinHeight = Math.max(
      isMobile ? 300 : 320,
      Math.ceil(titleHeight + chartHeight + legendHeight + (isMobile ? 52 : 56))
    );

    card.style.height = "auto";
    card.style.minHeight = `${computedMinHeight}px`;
    card.style.maxHeight = "none";
    card.style.overflow = "hidden";
  };

  window.addEventListener("resize", () => {
    const syncAllPieCards = () => {
      document.querySelectorAll(".chart-legend").forEach((legend) => syncPieCardLayout(legend));
    };

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(syncAllPieCards);
      return;
    }

    syncAllPieCards();
  });

  const renderLegend = (chart, legendId) => {
    const legend = document.getElementById(legendId);
    if (!legend || !chart) return;
    const labels = chart.data.labels || [];
    const colors = chart.data.datasets?.[0]?.backgroundColor || [];
    const values = chart.data.datasets?.[0]?.data || [];
    const total = sumValues(values);
    legend.innerHTML = labels
      .map((label, index) => {
        const color = Array.isArray(colors) ? colors[index] || "#9ca3af" : colors || "#9ca3af";
        const value = Array.isArray(values) ? toNumber(values[index]) : 0;
        return `<span class="legend-item"><i class="legend-swatch" style="background:${color}"></i>${label} (${formatPercent(value, total)})</span>`;
      })
      .join("");

    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => syncPieCardLayout(legend));
    } else {
      syncPieCardLayout(legend);
    }
  };

  const pickEntries = (source, fallbackEntries) => {
    const entries = Object.entries(source || {}).filter(([key]) => String(key || "").trim() !== "");
    if (entries.length === 0) return fallbackEntries;
    return entries.map(([label, value]) => [String(label), toNumber(value)]);
  };

  const mapFixedLabels = (labels, source) => labels.map((label) => toNumber(source?.[label]));

  const charts = {};
  const ageCanvas = document.getElementById("ageChart");
  const genderCanvas = document.getElementById("genderChart");
  const civilCanvas = document.getElementById("civilChart");
  const educationCanvas = document.getElementById("educationChart");
  const employmentCanvas = document.getElementById("employmentChart");
  const householdCanvas = document.getElementById("householdChart");

  const initCharts = () => {
    if (ageCanvas) {
      charts.age = new Chart(ageCanvas, {
        type: "bar",
        data: {
          labels: AGE_LABELS,
          datasets: [{ data: AGE_LABELS.map(() => 0), backgroundColor: PALETTE.ageBar, borderRadius: 6 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ageTooltipLabel,
              },
            },
          },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        },
      });
    }

    const arcDatasetDefaults = {
      borderWidth: 0,
      borderColor: "transparent",
      hoverBorderWidth: 0,
      hoverBorderColor: "transparent",
      hoverOffset: 0,
      offset: 0,
      spacing: 0,
    };

    const arcChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 6,
      },
      elements: {
        arc: {
          borderWidth: 0,
          hoverBorderWidth: 0,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: pieTooltipLabel,
          },
        },
      },
    };

    const doughnutOptions = {
      ...arcChartOptions,
      radius: "90%",
      cutout: "58%",
    };

    const pieOptions = {
      ...arcChartOptions,
      radius: "90%",
      cutout: 0,
    };

    if (genderCanvas) {
      charts.gender = new Chart(genderCanvas, {
        type: "doughnut",
        data: { labels: ["Male", "Female"], datasets: [{ ...arcDatasetDefaults, data: [0, 0], backgroundColor: PALETTE.gender }] },
        options: doughnutOptions,
      });
    }
    if (civilCanvas) {
      charts.civil = new Chart(civilCanvas, {
        type: "pie",
        data: { labels: CIVIL_LABELS, datasets: [{ ...arcDatasetDefaults, data: CIVIL_LABELS.map(() => 0), backgroundColor: PALETTE.civil }] },
        options: pieOptions,
      });
    }
    if (educationCanvas) {
      charts.education = new Chart(educationCanvas, {
        type: "doughnut",
        data: { labels: [], datasets: [{ ...arcDatasetDefaults, data: [], backgroundColor: PALETTE.education }] },
        options: doughnutOptions,
      });
    }
    if (employmentCanvas) {
      charts.employment = new Chart(employmentCanvas, {
        type: "doughnut",
        data: { labels: [], datasets: [{ ...arcDatasetDefaults, data: [], backgroundColor: PALETTE.employment }] },
        options: doughnutOptions,
      });
    }
    if (householdCanvas) {
      charts.household = new Chart(householdCanvas, {
        type: "pie",
        data: {
          labels: HOUSEHOLD_SIZE_LABELS,
          datasets: [{ ...arcDatasetDefaults, data: HOUSEHOLD_SIZE_LABELS.map(() => 0), backgroundColor: PALETTE.household }],
        },
        options: pieOptions,
      });
    }
  };

  const updateCharts = (payload, forceRedraw = false) => {
    const safe = { ...defaultPayload(payload?.year), ...(payload || {}) };

    if (charts.age) {
      charts.age.data.labels = AGE_LABELS;
      charts.age.data.datasets[0].data = AGE_LABELS.map((label) => toNumber(safe?.age_brackets?.[label]));
      charts.age.update();
    }

    if (charts.gender) {
      const genderSource = safe.gender_distribution || {};
      const labels = ["Male", "Female"];
      const values = labels.map((label) => toNumber(genderSource[label]));
      if (toNumber(genderSource.Other) > 0) {
        labels.push("Other");
        values.push(toNumber(genderSource.Other));
      }
      charts.gender.data.labels = labels;
      charts.gender.data.datasets[0].data = values;
      charts.gender.data.datasets[0].backgroundColor = labels.map((_, i) => PALETTE.gender[i % PALETTE.gender.length]);
      charts.gender.update();
      renderLegend(charts.gender, "genderLegend");
    }

    if (charts.civil) {
      const labels = [...CIVIL_LABELS];
      const values = mapFixedLabels(labels, safe.civil_status_distribution);
      charts.civil.data.labels = labels;
      charts.civil.data.datasets[0].data = values;
      charts.civil.data.datasets[0].backgroundColor = labels.map((_, i) => PALETTE.civil[i % PALETTE.civil.length]);
      charts.civil.update();
      renderLegend(charts.civil, "civilLegend");
    }

    if (charts.education) {
      const fallback = [
        ["Elementary", 0],
        ["High School", 0],
        ["College", 0],
        ["Not Finished", 0],
      ];
      const entries = pickEntries(safe?.socio_economic?.educational_attainment, fallback);
      charts.education.data.labels = entries.map(([label]) => label);
      charts.education.data.datasets[0].data = entries.map(([, value]) => value);
      charts.education.data.datasets[0].backgroundColor = entries.map((_, i) => PALETTE.education[i % PALETTE.education.length]);
      charts.education.update();
      renderLegend(charts.education, "educationLegend");
    }

    if (charts.employment) {
      const fallback = [
        ["Employed", 0],
        ["Unemployed", 0],
        ["Self-Employed", 0],
      ];
      const entries = pickEntries(safe?.socio_economic?.employment_status, fallback);
      charts.employment.data.labels = entries.map(([label]) => label);
      charts.employment.data.datasets[0].data = entries.map(([, value]) => value);
      charts.employment.data.datasets[0].backgroundColor = entries.map((_, i) => PALETTE.employment[i % PALETTE.employment.length]);
      charts.employment.update();
      renderLegend(charts.employment, "employmentLegend");
    }

    if (charts.household) {
      const labels = [...HOUSEHOLD_SIZE_LABELS];
      const values = mapFixedLabels(labels, safe.household_size_distribution);
      charts.household.data.labels = labels;
      charts.household.data.datasets[0].data = values;
      charts.household.data.datasets[0].backgroundColor = labels.map((_, i) => PALETTE.household[i % PALETTE.household.length]);
      charts.household.update();
      renderLegend(charts.household, "householdLegend");
    }

    if (forceRedraw) {
      window.requestAnimationFrame(() => {
        Object.values(charts).forEach((chart) => {
          chart.stop();
          chart.resize();
          chart.reset();
          chart.update();
        });
      });
    }
  };

  const updateCards = (payload) => {
    const safe = { ...defaultPayload(payload?.year), ...(payload || {}) };
    const pop = safe.population_summary || {};
    const indicators = safe?.socio_economic?.other_indicators || {};
    const healthRisk = safe?.health_risk || {};

    setText("metricPopulation", formatNumber(pop.total_population));
    setText("metricHouseholds", formatNumber(pop.households));
    setText("metricGender", `M:${formatNumber(pop.male)} | F:${formatNumber(pop.female)}`);
    setText("metricSenior", formatNumber(indicators["Senior Citizens"]));
    setText("metricPwd", formatNumber(indicators.PWD));
    setText("metricPregnant", formatNumber(healthRisk.pregnant_women));

    AGE_LABELS.forEach((ageLabel) => {
      const targetId = AGE_KEY_TO_ID[ageLabel];
      if (!targetId) return;
      setText(targetId, formatNumber(safe?.age_brackets?.[ageLabel]));
    });
  };

  const fetchAnalytics = async (year) => {
    const params = new URLSearchParams();
    params.set("year", String(Number(year) || currentYear));
    params.set("_ts", String(Date.now()));

    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Dashboard API request failed with status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || payload.success !== true || typeof payload.data !== "object") {
      throw new Error(payload?.error || "Dashboard API returned an invalid payload.");
    }
    return payload;
  };

  let requestCounter = 0;
  const loadDashboardData = async (year, showRefreshModal = false, allowEmptyYearFallback = false) => {
    const localRequestId = ++requestCounter;
    const selectedYear = Number(year) || currentYear;

    try {
      const response = await fetchAnalytics(selectedYear);
      if (localRequestId !== requestCounter) return;

      const payload = { ...defaultPayload(selectedYear), ...(response.data || {}) };
      const payloadYear = Number(payload.year) || selectedYear;
      const fallbackYear = allowEmptyYearFallback && !hasMeaningfulDemographicData(payload)
        ? pickFallbackYear(response?.meta?.available_years, payloadYear)
        : null;

      if (fallbackYear && fallbackYear !== payloadYear) {
        await loadDashboardData(fallbackYear, showRefreshModal, false);
        return;
      }

      ensureYearOptions(response?.meta?.available_years, payloadYear);
      updateCards(payload);
      updateCharts(payload, showRefreshModal);
    } catch (error) {
      if (localRequestId !== requestCounter) return;
      console.error("Unable to load dashboard analytics:", error);
      const fallback = defaultPayload(selectedYear);
      ensureYearOptions([], selectedYear);
      updateCards(fallback);
      updateCharts(fallback, showRefreshModal);
    } finally {
      if (showRefreshModal && refreshModal) {
        refreshModal.show();
      }
    }
  };

  if (yearSelect) {
    yearSelect.addEventListener("change", () => {
      loadDashboardData(Number(yearSelect.value) || currentYear, false);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      if (refreshBtn.disabled) return;
      const selectedYear = Number(yearSelect?.value) || currentYear;
      refreshBtn.disabled = true;
      refreshBtn.setAttribute("aria-busy", "true");
      try {
        await loadDashboardData(selectedYear, true);
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.removeAttribute("aria-busy");
      }
    });
  }

  ensureYearOptions([], currentYear);
  initCharts();
  loadDashboardData(currentYear, false, true);
})();
