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
  if (footerYear) footerYear.textContent = String(currentYear);

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
  const analyticsApiEndpoint = 'dashboard-analytics-api.php';
  const exportEndpoints = [
    'report-export.php'
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

  const escapeHtml = (value) => {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const upsertDefaultReportRow = () => {
    if (!reportsTableBody) return;
    const selectedYear = Number(yearSelect ? yearSelect.value : currentYear) || currentYear;
    const reportId = 'RP-' + selectedYear + '-001';
    const title = 'Annual Household Analytics Report';
    const category = 'Annual';
    const period = 'Year ' + selectedYear;
    const updated = formatToday();
    const summary = 'Generated annual analytics report for barangay households and residents.';
    const documentBody = 'This report summarizes barangay household and resident analytics for the selected year.';

    let row = reportsTableBody.querySelector('tr[data-seed-report="default"]');
    if (!row) {
      row = document.createElement('tr');
      row.dataset.seedReport = 'default';
      if (emptyRow && emptyRow.parentElement === reportsTableBody) {
        reportsTableBody.insertBefore(row, emptyRow);
      } else {
        reportsTableBody.appendChild(row);
      }
    }

    row.innerHTML = `
      <td>${escapeHtml(reportId)}</td>
      <td>${escapeHtml(title)}</td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(period)}</td>
      <td>${escapeHtml(updated)}</td>
      <td class="text-end">
        <div class="table-actions">
          <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                  data-id="${escapeHtml(reportId)}"
                  data-title="${escapeHtml(title)}"
                  data-category="${escapeHtml(category)}"
                  data-period="${escapeHtml(period)}"
                  data-status="Draft"
                  data-updated="${escapeHtml(updated)}"
                  data-summary="${escapeHtml(summary)}"
                  data-document="${escapeHtml(documentBody)}">
            <i class="bi bi-eye"></i> View
          </button>
        </div>
      </td>
    `;
  };

  const ANALYTICS_STORAGE_KEY = 'barangay_analytics_payload_by_year';
  const ANALYTICS_CURRENT_KEY = 'barangay_analytics_payload_current';

  const fetchAnalyticsPayloadForYear = async (selectedYear) => {
    const normalizedYear = Number(selectedYear) || currentYear;
    const requestTime = Date.now();
    const response = await fetch(`${analyticsApiEndpoint}?year=${encodeURIComponent(normalizedYear)}&_ts=${requestTime}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    });

    let result = null;
    try {
      result = await response.json();
    } catch (e) {
      result = null;
    }

    const payload = result && typeof result === 'object' ? result.data : null;
    if (!response.ok || !result || result.success !== true || !payload || typeof payload !== 'object') {
      const message = result && typeof result.error === 'string' && result.error.trim() !== ''
        ? result.error.trim()
        : 'Unable to load the latest analytics data for export.';
      throw new Error(message);
    }

    try {
      const byYear = JSON.parse(localStorage.getItem(ANALYTICS_STORAGE_KEY) || '{}');
      const cacheMap = byYear && typeof byYear === 'object' ? byYear : {};
      cacheMap[String(normalizedYear)] = payload;
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(cacheMap));
      localStorage.setItem(ANALYTICS_CURRENT_KEY, JSON.stringify(payload));
    } catch (e) {}

    return payload;
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

  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      upsertDefaultReportRow();
      updateEmptyState();
      if (activeModalRow && activeModalRow.dataset.seedReport === 'default') {
        openRowInModal(activeModalRow);
      }
    });
  }

  const exportActiveReport = async (format) => {
    const data = getActiveModalData();
    if (!data) {
      window.alert('Please open a report first before exporting.');
      return;
    }

    const normalizedFormat = format === 'xlsx' ? 'xlsx' : 'pdf';
    const selectedYear = Number(yearSelect ? yearSelect.value : currentYear) || currentYear;
    const triggerButton = normalizedFormat === 'pdf' ? reportModalDownload : reportModalPrint;
    const fallbackName = 'Annual_Report_' + selectedYear + '.' + normalizedFormat;

    setExportButtonLoading(triggerButton, true);
    try {
      const analyticsPayload = await fetchAnalyticsPayloadForYear(selectedYear);
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
      const message = error instanceof Error ? error.message : 'Unable to export this report.';
      window.alert(message);
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

  upsertDefaultReportRow();
  updateEmptyState();
})();
