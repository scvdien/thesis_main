(function () {
  try {
    const roleFromBody = (document.body?.dataset?.role || 'captain').toLowerCase();
    sessionStorage.setItem('userRole', roleFromBody || 'captain');
  } catch (e) {}

  window.toggleSidebar = function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    const isMobile = window.matchMedia('(max-width: 992px)').matches;

    if (isMobile) {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('show');
      document.body.classList.toggle('sidebar-open');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  };

  window.addEventListener('resize', () => {
    const isMobile = window.matchMedia('(max-width: 992px)').matches;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop) return;
    if (!isMobile) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
      document.body.classList.remove('sidebar-open');
    }
  });

  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    const startYear = currentYear - 6;
    for (let y = startYear; y <= currentYear; y += 1) {
      const option = document.createElement('option');
      option.value = y;
      option.textContent = y;
      yearSelect.appendChild(option);
    }
    yearSelect.value = String(currentYear);
  }

  const footerYear = document.getElementById('year');
  if (footerYear) footerYear.textContent = '2026';

  const reportModalEl = document.getElementById('reportModal');
  const reportModal = reportModalEl ? new bootstrap.Modal(reportModalEl) : null;

  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModalEl = document.getElementById('logoutModal');
  if (logoutBtn && logoutModalEl) {
    const logoutModal = new bootstrap.Modal(logoutModalEl);
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      logoutModal.show();
    });
  }

  const reportModalId = document.getElementById('reportModalId');
  const reportModalTitle = document.getElementById('reportModalTitle');
  const reportModalPeriod = document.getElementById('reportModalPeriod');
  const reportModalUpdated = document.getElementById('reportModalUpdated');
  const reportModalDownload = document.getElementById('reportModalDownload');
  const reportModalPrint = document.getElementById('reportModalPrint');
  const exportEndpoints = [
    'report-export.php',
    'http://localhost/thesis-main/report-export.php',
    'http://127.0.0.1/thesis-main/report-export.php'
  ];

  const reportsTableBody = document.getElementById('reportsTableBody');
  const emptyRow = document.getElementById('reportsEmptyRow');

  let activeModalRow = null;

  const getRows = () => {
    if (!reportsTableBody) return [];
    return Array.from(reportsTableBody.querySelectorAll('tr')).filter((row) => row.id !== 'reportsEmptyRow');
  };

  const updateEmptyState = () => {
    if (!emptyRow) return;
    const hasRows = getRows().length > 0;
    emptyRow.classList.toggle('d-none', hasRows);
  };

  const formatToday = () => {
    return new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const safeFileSlug = (value) => {
    return String(value || 'report').replace(/[^a-zA-Z0-9-_]/g, '_');
  };

  const ANALYTICS_STORAGE_KEY = 'barangay_analytics_payload_by_year';
  const ANALYTICS_CURRENT_KEY = 'barangay_analytics_payload_current';

  const buildDefaultAnalyticsPayload = (selectedYear) => {
    return {
      year: Number(selectedYear),
      population_summary: {
        total_population: 3200,
        male: 1600,
        female: 1600,
        households: 780,
        average_household_size: 4.1
      },
      age_group_distribution: {
        '0-5': 260,
        '6-12': 446,
        '13-17': 360,
        '18-59': 2042,
        '60+': 422
      },
      socio_economic: {
        employment_status: {
          Employed: 1800,
          Unemployed: 600,
          'Self-Employed': 500
        },
        educational_attainment: {
          'No Schooling': 300,
          Elementary: 900,
          'High School': 1400,
          College: 600,
          Vocational: 0
        },
        other_indicators: {
          PWD: 110,
          'Senior Citizens': 420,
          'Solo Parents': 0
        }
      },
      housing_utilities: {
        toilet_type: {
          'Water-sealed (Flush toilet)': 620,
          'Pit Latrine': 120,
          'Shared Toilet': 40
        },
        water_source: {
          'Piped Water': 520,
          'Deep Well': 180,
          'Water Delivery': 80
        },
        electricity_source: {
          'With Electricity': 720,
          'No Electricity': 60
        },
        housing_ownership: {
          Owned: 600,
          Rented: 180
        }
      },
      health_risk: {
        pregnant_women: 68,
        malnourished_children: 60,
        persons_with_illness: 350,
        deaths_by_cause: {
          'Heart Disease': 25,
          Accident: 10,
          'Other Illness': 15
        }
      }
    };
  };

  const getAnalyticsPayloadForYear = (selectedYear) => {
    const normalizedYear = Number(selectedYear) || currentYear;
    const yearKey = String(normalizedYear);
    try {
      const byYear = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) || '{}');
      if (byYear && typeof byYear === 'object' && byYear[yearKey]) {
        return byYear[yearKey];
      }
    } catch (e) {}

    try {
      const currentPayload = JSON.parse(localStorage.getItem(ANALYTICS_CURRENT_KEY) || 'null');
      if (currentPayload && typeof currentPayload === 'object') {
        return currentPayload;
      }
    } catch (e) {}

    return buildDefaultAnalyticsPayload(normalizedYear);
  };

  const fileNameFromDisposition = (contentDisposition, fallbackName) => {
    if (!contentDisposition) return fallbackName;
    const utf8Name = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Name && utf8Name[1]) {
      try {
        return decodeURIComponent(utf8Name[1]);
      } catch (e) {
        return utf8Name[1];
      }
    }
    const asciiName = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (asciiName && asciiName[1]) return asciiName[1];
    return fallbackName;
  };

  const downloadBlobAsFile = (blob, fileName) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const tryDownloadDemoTemplate = async (format, selectedYear, preferredName) => {
    const demoCandidates = [
      'assets/demo/Barangay_Cabarian_Annual_Report_' + selectedYear + '.' + format,
      'assets/demo/Barangay_Cabarian_Annual_Report_2026.' + format,
      'assets/demo/Barangay_Cabarian_Annual_Report_DEMO.' + format
    ];

    for (const path of demoCandidates) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) continue;
        const blob = await response.blob();
        if (!blob || blob.size === 0) continue;
        const fallbackFileName = path.split('/').pop() || ('Barangay_Cabarian_Annual_Report_' + selectedYear + '.' + format);
        downloadBlobAsFile(blob, preferredName || fallbackFileName);
        return true;
      } catch (e) {}
    }

    return false;
  };

  const setExportButtonLoading = (button, isLoading) => {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Processing';
      return;
    }
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  };

  const openRowInModal = (row) => {
    if (!row) return;
    const viewData = row.querySelector('.view-report') ? row.querySelector('.view-report').dataset : {};
    const selectedYear = Number(yearSelect ? yearSelect.value : currentYear) || currentYear;
    activeModalRow = row;

    if (reportModalId) reportModalId.textContent = viewData.id || ('RP-' + currentYear + '-001');
    if (reportModalTitle) reportModalTitle.textContent = viewData.title || 'Annual Household Analytics Report';
    if (reportModalPeriod) reportModalPeriod.textContent = 'Year ' + selectedYear;
    if (reportModalUpdated) reportModalUpdated.textContent = viewData.updated || formatToday();
    if (reportModal) reportModal.show();
  };

  const getActiveModalData = () => {
    return activeModalRow && activeModalRow.querySelector('.view-report')
      ? activeModalRow.querySelector('.view-report').dataset
      : null;
  };

  const exportActiveReport = async (format) => {
    const data = getActiveModalData();
    if (!data) {
      window.alert('Please open a report first before exporting.');
      return;
    }

    const normalizedFormat = format === 'xlsx' ? 'xlsx' : 'pdf';
    const selectedYear = Number(yearSelect ? yearSelect.value : currentYear) || currentYear;
    const analyticsPayload = getAnalyticsPayloadForYear(selectedYear);
    const triggerButton = normalizedFormat === 'pdf' ? reportModalDownload : reportModalPrint;
    const fallbackName = 'Barangay_Cabarian_Annual_Report_' + selectedYear + '.' + normalizedFormat;
    const requestPayload = {
      year: selectedYear,
      format: normalizedFormat,
      analytics: analyticsPayload,
      report: {
        id: data.id || '-',
        title: data.title || '-',
        category: data.category || '-',
        period: 'Year ' + selectedYear,
        year: selectedYear,
        status: 'Draft',
        updated: data.updated || '-',
        summary: data.summary || '-',
        document: data.document || '-'
      }
    };

    setExportButtonLoading(triggerButton, true);
    try {
      let response = null;
      let lastErrorMessage = '';

      for (const endpoint of exportEndpoints) {
        try {
          const candidate = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/json'
            },
            body: JSON.stringify(requestPayload)
          });

          if (candidate.ok) {
            response = candidate;
            break;
          }

          try {
            const errorPayload = await candidate.json();
            if (errorPayload && errorPayload.error) {
              lastErrorMessage = String(errorPayload.error);
            }
          } catch (e) {}
        } catch (e) {
          const message = e instanceof Error ? e.message : '';
          if (message) lastErrorMessage = message;
        }
      }

      if (!response || !response.ok) {
        throw new Error(lastErrorMessage || 'Unable to export this report.');
      }

      const contentType = String(response.headers.get('Content-Type') || '').toLowerCase();
      const expectedType = normalizedFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (contentType.indexOf(expectedType) === -1) {
        throw new Error('Export failed: invalid file response from server.');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const fileName = fileNameFromDisposition(disposition, fallbackName);
      downloadBlobAsFile(blob, fileName);
    } catch (error) {
      const usedDemo = await tryDownloadDemoTemplate(normalizedFormat, selectedYear, fallbackName);
      if (usedDemo) {
        window.alert('Live export is unavailable on this server. Demo template was downloaded instead.');
      } else {
        const message = error instanceof Error ? error.message : 'Unable to export this report.';
        window.alert(message);
      }
    } finally {
      setExportButtonLoading(triggerButton, false);
    }
  };

  document.addEventListener('click', (event) => {
    const openBtn = event.target.closest('.view-report');
    if (openBtn) {
      openRowInModal(openBtn.closest('tr'));
    }
  });

  if (reportModalDownload) {
    reportModalDownload.addEventListener('click', () => {
      exportActiveReport('pdf');
    });
  }

  if (reportModalPrint) {
    reportModalPrint.addEventListener('click', () => {
      exportActiveReport('xlsx');
    });
  }

  if (reportModalEl) {
    reportModalEl.addEventListener('hidden.bs.modal', () => {
      activeModalRow = null;
    });
  }

  updateEmptyState();
})();
