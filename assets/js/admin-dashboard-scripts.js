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

  const AGE_LABELS = ["0-5", "6-10", "11-15", "16-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71+"];
  const AGE_KEY_TO_ID = {
    "0-5": "age_0_5",
    "6-10": "age_6_10",
    "11-15": "age_11_15",
    "16-20": "age_16_20",
    "21-30": "age_21_30",
    "31-40": "age_31_40",
    "41-50": "age_41_50",
    "51-60": "age_51_60",
    "61-70": "age_61_70",
    "71+": "age_71_plus",
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
      "0-5": 0,
      "6-10": 0,
      "11-15": 0,
      "16-20": 0,
      "21-30": 0,
      "31-40": 0,
      "41-50": 0,
      "51-60": 0,
      "61-70": 0,
      "71+": 0,
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

  const ensureYearOptions = (availableYears, selectedYear) => {
    if (!yearSelect) return;

    const normalized = Array.isArray(availableYears)
      ? availableYears.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item >= 2000 && item <= 2100)
      : [];

    const fallback = [currentYear - 1, currentYear];
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

  const syncPieCardLayout = (legend) => {
    if (!legend) return;
    const card = legend.closest(".card-box.chart-card--pie");
    if (!card) return;

    // Edge can wrap legend text differently; compute card min-height from actual content.
    const chartWrap = card.querySelector(".chart-square-wrap");
    const titleEl = card.querySelector("h6");
    const chartHeight = chartWrap ? chartWrap.getBoundingClientRect().height : 0;
    const titleHeight = titleEl ? titleEl.getBoundingClientRect().height : 0;
    const legendHeight = legend.scrollHeight || legend.getBoundingClientRect().height || 0;
    const computedMinHeight = Math.max(290, Math.ceil(titleHeight + chartHeight + legendHeight + 44));

    card.style.height = "auto";
    card.style.minHeight = `${computedMinHeight}px`;
    card.style.overflow = "visible";
  };

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

    const pieOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: pieTooltipLabel,
          },
        },
      },
    };

    if (genderCanvas) {
      charts.gender = new Chart(genderCanvas, {
        type: "doughnut",
        data: { labels: ["Male", "Female"], datasets: [{ data: [0, 0], backgroundColor: PALETTE.gender, borderWidth: 0 }] },
        options: pieOptions,
      });
    }
    if (civilCanvas) {
      charts.civil = new Chart(civilCanvas, {
        type: "pie",
        data: { labels: CIVIL_LABELS, datasets: [{ data: CIVIL_LABELS.map(() => 0), backgroundColor: PALETTE.civil, borderWidth: 0 }] },
        options: pieOptions,
      });
    }
    if (educationCanvas) {
      charts.education = new Chart(educationCanvas, {
        type: "doughnut",
        data: { labels: [], datasets: [{ data: [], backgroundColor: PALETTE.education, borderWidth: 0 }] },
        options: pieOptions,
      });
    }
    if (employmentCanvas) {
      charts.employment = new Chart(employmentCanvas, {
        type: "doughnut",
        data: { labels: [], datasets: [{ data: [], backgroundColor: PALETTE.employment, borderWidth: 0 }] },
        options: pieOptions,
      });
    }
    if (householdCanvas) {
      charts.household = new Chart(householdCanvas, {
        type: "pie",
        data: {
          labels: HOUSEHOLD_SIZE_LABELS,
          datasets: [{ data: HOUSEHOLD_SIZE_LABELS.map(() => 0), backgroundColor: PALETTE.household, borderWidth: 0 }],
        },
        options: pieOptions,
      });
    }
  };

  const updateCharts = (payload) => {
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
  const loadDashboardData = async (year, showRefreshModal = false) => {
    const localRequestId = ++requestCounter;
    const selectedYear = Number(year) || currentYear;

    try {
      const response = await fetchAnalytics(selectedYear);
      if (localRequestId !== requestCounter) return;

      const payload = { ...defaultPayload(selectedYear), ...(response.data || {}) };
      const payloadYear = Number(payload.year) || selectedYear;

      ensureYearOptions(response?.meta?.available_years, payloadYear);
      updateCards(payload);
      updateCharts(payload);
    } catch (error) {
      if (localRequestId !== requestCounter) return;
      console.error("Unable to load dashboard analytics:", error);
      const fallback = defaultPayload(selectedYear);
      ensureYearOptions([], selectedYear);
      updateCards(fallback);
      updateCharts(fallback);
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
    refreshBtn.addEventListener("click", () => {
      const selectedYear = Number(yearSelect?.value) || currentYear;
      loadDashboardData(selectedYear, true);
    });
  }

  ensureYearOptions([], currentYear);
  initCharts();
  loadDashboardData(currentYear, false);
})();
