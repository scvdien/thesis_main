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

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatNumber = (value) => new Intl.NumberFormat("en-US").format(Math.round(Math.max(0, toNumber(value))));

  const percent = (value, total) => {
    const safeTotal = toNumber(total);
    if (safeTotal <= 0) return 0;
    return (toNumber(value) / safeTotal) * 100;
  };

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = String(value);
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

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const categoryLabels = [
    "Antibiotics",
    "Analgesics",
    "Antihypertensives",
    "Vitamins",
    "Pediatric Syrups",
    "Diabetes"
  ];

  const topMedicineLabels = [
    "Paracetamol 500mg",
    "Amoxicillin 500mg",
    "Losartan 50mg",
    "Cetirizine 10mg",
    "Metformin 500mg",
    "ORS Sachet",
    "Multivitamins",
    "Amlodipine 5mg"
  ];

  const makeYearData = (year) => {
    const drift = year - currentYear;
    const adj = (base, step) => Math.max(0, Math.round(base + drift * step));

    return {
      metrics: {
        totalMedicines: adj(162, 6),
        totalUnits: adj(24550, 2100),
        lowStock: adj(19, -2),
        outOfStock: adj(6, -1),
        expiringSoon: adj(24, -3),
        inventoryValue: adj(1980000, 120000)
      },
      snapshot: {
        fastMoving: adj(44, 3),
        slowMoving: adj(38, -1),
        nearExpiry: adj(24, -3),
        expired: adj(5, -1),
        newBatches: adj(18, 2),
        pendingOrders: adj(13, -1)
      },
      categoryStock: [
        adj(5100, 320),
        adj(4800, 240),
        adj(3950, 220),
        adj(5200, 300),
        adj(2900, 180),
        adj(2600, 160)
      ],
      stockStatus: {
        "In Stock": adj(129, 6),
        "Low Stock": adj(27, -2),
        "Out of Stock": adj(6, -1)
      },
      monthlyMovement: {
        restocked: [1500, 1380, 1650, 1720, 1800, 1760, 1900, 1840, 1780, 1880, 1940, 2010].map((v) => adj(v, 90)),
        dispensed: [1320, 1280, 1420, 1510, 1600, 1670, 1700, 1730, 1680, 1760, 1820, 1900].map((v) => adj(v, 80))
      },
      topMedicines: [1240, 980, 860, 790, 760, 710, 690, 640].map((v) => adj(v, 45)),
      storageCondition: {
        "Room Temp": adj(102, 4),
        "Cold Chain": adj(31, 2),
        Controlled: adj(29, 1)
      },
      supplierReliability: {
        "On-time": adj(76, 3),
        Delayed: adj(18, -1),
        "Critical Delay": adj(6, -1)
      }
    };
  };

  const availableYears = Array.from({ length: 5 }, (_, idx) => currentYear - 4 + idx);
  const dashboardData = {};
  availableYears.forEach((year) => {
    dashboardData[year] = makeYearData(year);
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
  const palette = {
    green: "#2f8f24",
    greenSoft: "#6cab57",
    gold: "#dcbc45",
    red: "#dc2626",
    teal: "#0d9488",
    blue: "#2563eb",
    purple: "#7c3aed",
    gray: "#94a3b8"
  };

  const pieTooltipLabel = (context) => {
    const values = context?.dataset?.data || [];
    const total = values.reduce((sum, value) => sum + toNumber(value), 0);
    const value = toNumber(context?.raw);
    const label = String(context?.label || "Value");
    const pct = percent(value, total).toFixed(1).replace(/\.0$/, "");
    return `${label}: ${pct}% (${formatNumber(value)})`;
  };

  const renderLegend = (legendId, labels, values, colors) => {
    const legend = document.getElementById(legendId);
    if (!legend) return;

    const total = values.reduce((sum, value) => sum + toNumber(value), 0);
    legend.innerHTML = labels
      .map((label, idx) => {
        const color = colors[idx] || palette.gray;
        const value = toNumber(values[idx]);
        const pct = percent(value, total).toFixed(1).replace(/\.0$/, "");
        return `<span class="legend-item"><i class="legend-swatch" style="background:${color}"></i>${label} (${pct}%)</span>`;
      })
      .join("");
  };

  const initCharts = () => {
    if (!window.Chart) return;

    const categoryCanvas = document.getElementById("categoryChart");
    const statusCanvas = document.getElementById("statusChart");
    const movementCanvas = document.getElementById("movementChart");
    const topCanvas = document.getElementById("topMedicinesChart");
    const storageCanvas = document.getElementById("storageChart");
    const supplierCanvas = document.getElementById("supplierChart");

    if (categoryCanvas) {
      charts.category = new window.Chart(categoryCanvas, {
        type: "bar",
        data: {
          labels: categoryLabels,
          datasets: [{
            label: "Units",
            data: categoryLabels.map(() => 0),
            backgroundColor: [palette.green, palette.greenSoft, palette.teal, palette.blue, palette.gold, palette.purple],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    if (statusCanvas) {
      charts.status = new window.Chart(statusCanvas, {
        type: "doughnut",
        data: {
          labels: ["In Stock", "Low Stock", "Out of Stock"],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [palette.green, palette.gold, palette.red],
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

    if (movementCanvas) {
      charts.movement = new window.Chart(movementCanvas, {
        type: "line",
        data: {
          labels: months,
          datasets: [
            {
              label: "Restocked",
              data: months.map(() => 0),
              borderColor: palette.green,
              backgroundColor: "rgba(47,143,36,0.16)",
              fill: true,
              tension: 0.3
            },
            {
              label: "Dispensed",
              data: months.map(() => 0),
              borderColor: palette.blue,
              backgroundColor: "rgba(37,99,235,0.12)",
              fill: true,
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 } }
          }
        }
      });
    }

    if (topCanvas) {
      charts.topMedicines = new window.Chart(topCanvas, {
        type: "bar",
        data: {
          labels: topMedicineLabels,
          datasets: [{
            label: "Dispense Count",
            data: topMedicineLabels.map(() => 0),
            backgroundColor: palette.teal,
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 } },
            y: { ticks: { autoSkip: false } }
          }
        }
      });
    }

    if (storageCanvas) {
      charts.storage = new window.Chart(storageCanvas, {
        type: "pie",
        data: {
          labels: ["Room Temp", "Cold Chain", "Controlled"],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [palette.green, palette.blue, palette.gold],
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

    if (supplierCanvas) {
      charts.supplier = new window.Chart(supplierCanvas, {
        type: "doughnut",
        data: {
          labels: ["On-time", "Delayed", "Critical Delay"],
          datasets: [{
            data: [0, 0, 0],
            backgroundColor: [palette.green, palette.gold, palette.red],
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
  };

  const updateCards = (data) => {
    setText("metricTotalMedicines", formatNumber(data.metrics.totalMedicines));
    setText("metricTotalUnits", formatNumber(data.metrics.totalUnits));
    setText("metricLowStock", formatNumber(data.metrics.lowStock));
    setText("metricOutOfStock", formatNumber(data.metrics.outOfStock));
    setText("metricExpiringSoon", formatNumber(data.metrics.expiringSoon));
    setText("metricInventoryValue", formatNumber(data.metrics.inventoryValue));

    setText("snapshotFastMoving", formatNumber(data.snapshot.fastMoving));
    setText("snapshotSlowMoving", formatNumber(data.snapshot.slowMoving));
    setText("snapshotNearExpiry", formatNumber(data.snapshot.nearExpiry));
    setText("snapshotExpired", formatNumber(data.snapshot.expired));
    setText("snapshotNewBatches", formatNumber(data.snapshot.newBatches));
    setText("snapshotPendingOrders", formatNumber(data.snapshot.pendingOrders));
  };

  const updateCharts = (data) => {
    if (charts.category) {
      charts.category.data.labels = categoryLabels;
      charts.category.data.datasets[0].data = data.categoryStock;
      charts.category.update();
    }

    if (charts.status) {
      const labels = ["In Stock", "Low Stock", "Out of Stock"];
      const values = labels.map((label) => toNumber(data.stockStatus[label]));
      const colors = [palette.green, palette.gold, palette.red];
      charts.status.data.labels = labels;
      charts.status.data.datasets[0].data = values;
      charts.status.data.datasets[0].backgroundColor = colors;
      charts.status.update();
      renderLegend("statusLegend", labels, values, colors);
    }

    if (charts.movement) {
      charts.movement.data.labels = months;
      charts.movement.data.datasets[0].data = data.monthlyMovement.restocked;
      charts.movement.data.datasets[1].data = data.monthlyMovement.dispensed;
      charts.movement.update();
    }

    if (charts.topMedicines) {
      charts.topMedicines.data.labels = topMedicineLabels;
      charts.topMedicines.data.datasets[0].data = data.topMedicines;
      charts.topMedicines.update();
    }

    if (charts.storage) {
      const labels = ["Room Temp", "Cold Chain", "Controlled"];
      const values = labels.map((label) => toNumber(data.storageCondition[label]));
      const colors = [palette.green, palette.blue, palette.gold];
      charts.storage.data.labels = labels;
      charts.storage.data.datasets[0].data = values;
      charts.storage.data.datasets[0].backgroundColor = colors;
      charts.storage.update();
      renderLegend("storageLegend", labels, values, colors);
    }

    if (charts.supplier) {
      const labels = ["On-time", "Delayed", "Critical Delay"];
      const values = labels.map((label) => toNumber(data.supplierReliability[label]));
      const colors = [palette.green, palette.gold, palette.red];
      charts.supplier.data.labels = labels;
      charts.supplier.data.datasets[0].data = values;
      charts.supplier.data.datasets[0].backgroundColor = colors;
      charts.supplier.update();
      renderLegend("supplierLegend", labels, values, colors);
    }
  };

  const loadDashboard = (year) => {
    const selectedYear = Number(year) || currentYear;
    const data = dashboardData[selectedYear] || makeYearData(selectedYear);
    updateCards(data);
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
        loadDashboard(selectedYear);
        refreshBtn.disabled = false;
        if (refreshModal) refreshModal.hide();
      }, 700);
    });
  }

  initCharts();
  loadDashboard(Number(yearSelect?.value) || currentYear);
})();
