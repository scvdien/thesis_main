(function () {
  const resolvedRole = String(document.body?.dataset?.role || '').toLowerCase();
  const canManageReports = resolvedRole === 'admin';

  try {
    sessionStorage.setItem('userRole', resolvedRole || 'captain');
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
      return;
    }

    sidebar.classList.toggle('collapsed');
  };

  window.addEventListener('resize', () => {
    const isMobile = window.matchMedia('(max-width: 992px)').matches;
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!sidebar || !backdrop || isMobile) return;
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  });

  const currentYear = new Date().getFullYear();
  const yearSelect = document.getElementById('yearSelect');
  if (yearSelect) {
    const startYear = currentYear - 6;
    for (let y = startYear; y <= currentYear; y += 1) {
      const option = document.createElement('option');
      option.value = String(y);
      option.textContent = String(y);
      yearSelect.appendChild(option);
    }
    yearSelect.value = String(currentYear);
  }

  const footerYear = document.getElementById('year');
  if (footerYear) footerYear.textContent = String(currentYear);

  const reportModalEl = document.getElementById('reportModal');
  const reportModal = reportModalEl ? new bootstrap.Modal(reportModalEl) : null;
  const createModalEl = document.getElementById('createReportModal');
  const createModal = createModalEl ? new bootstrap.Modal(createModalEl) : null;
  const deleteReportModalEl = document.getElementById('deleteReportModal');
  const deleteReportModal = deleteReportModalEl ? new bootstrap.Modal(deleteReportModalEl) : null;

  const logoutBtn = document.getElementById('logoutBtn');
  const logoutModalEl = document.getElementById('logoutModal');
  if (logoutBtn && logoutModalEl) {
    const logoutModal = new bootstrap.Modal(logoutModalEl);
    logoutBtn.addEventListener('click', (event) => {
      event.preventDefault();
      logoutModal.show();
    });
  }

  const reportModalId = document.getElementById('reportModalId');
  const reportModalTitle = document.getElementById('reportModalTitle');
  const reportModalPeriod = document.getElementById('reportModalPeriod');
  const reportModalUpdated = document.getElementById('reportModalUpdated');
  const reportModalDownload = document.getElementById('reportModalDownload');
  const reportModalPrint = document.getElementById('reportModalPrint');
  const reportModalDelete = document.getElementById('reportModalDelete');
  const reportModalDeleteIcon = document.getElementById('reportModalDeleteIcon');
  const deleteReportMessage = document.getElementById('deleteReportMessage');
  const deleteReportConfirmBtn = document.getElementById('deleteReportConfirmBtn');

  const createBtn = document.getElementById('createReportBtn');
  const createConfirm = document.getElementById('createConfirm');
  const createTitle = document.getElementById('createTitle');
  const createPeriod = document.getElementById('createPeriod');
  const createDocument = document.getElementById('createDocument');
  const reportsTableBody = document.getElementById('reportsTableBody');
  const emptyRow = document.getElementById('reportsEmptyRow');

  const reportsApiEndpoint = 'reports-api.php';
  const analyticsApiEndpoint = 'dashboard-analytics-api.php';
  const exportEndpoints = ['report-export.php'];

  if (!canManageReports) {
    if (createBtn) createBtn.classList.add('d-none');
    if (reportModalDelete) reportModalDelete.classList.add('d-none');
  }

  let activeModalRow = null;
  let pendingDeleteRow = null;
  let suppressActiveRowReset = false;
  let reopenReportModalAfterDelete = false;
  let reportsRequestCounter = 0;

  const getRows = () => {
    if (!reportsTableBody) return [];
    return Array.from(reportsTableBody.querySelectorAll('tr')).filter((row) => row.id !== 'reportsEmptyRow');
  };

  const clearRows = () => {
    getRows().forEach((row) => row.remove());
  };

  const updateEmptyState = () => {
    if (!emptyRow) return;
    emptyRow.classList.toggle('d-none', getRows().length > 0);
  };

  const formatPeriod = (value) => {
    if (!value || !value.includes('-')) return '-';
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return '-';
    const date = new Date(year, month - 1, 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatDateLabel = (value) => {
    const date = new Date(String(value || ''));
    if (!Number.isFinite(date.getTime())) {
      return new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return date.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const escapeHtml = (value) => {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const parseApiError = async (response, fallbackMessage) => {
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string' && payload.error.trim() !== '') {
        return payload.error.trim();
      }
    } catch (e) {}
    return `${fallbackMessage} (HTTP ${response.status})`;
  };

  const requestJson = async (url, options, fallbackMessage) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(await parseApiError(response, fallbackMessage));
    }
    let payload = null;
    try {
      payload = await response.json();
    } catch (e) {
      payload = null;
    }
    if (!payload || payload.success !== true) {
      throw new Error((payload && payload.error) || fallbackMessage);
    }
    return payload;
  };

  const fetchReportsForYear = async (year) => {
    const selectedYear = Number(year) || currentYear;
    const url = `${reportsApiEndpoint}?year=${encodeURIComponent(selectedYear)}&_ts=${Date.now()}`;
    const payload = await requestJson(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      }
    }, 'Unable to load reports.');

    const items = payload?.data?.items;
    return Array.isArray(items) ? items : [];
  };

  const createReportOnServer = async (reportPayload) => {
    const payload = await requestJson(reportsApiEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      body: JSON.stringify({
        action: 'create',
        ...reportPayload
      })
    }, 'Unable to create report.');
    return payload?.data?.item || null;
  };

  const deleteReportOnServer = async (reportCode) => {
    await requestJson(reportsApiEndpoint, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      body: JSON.stringify({
        action: 'delete',
        report_code: reportCode
      })
    }, 'Unable to delete report.');
  };

  const upsertDefaultReportRow = () => {};

  const normalizeReportItem = (item, fallbackYear) => {
    const year = Number(item?.year) || Number(fallbackYear) || currentYear;
    const period = String(item?.period || '').trim() || `Year ${year}`;
    const code = String(item?.report_code || '').trim() || `RP-${year}-${Math.floor(100 + Math.random() * 900)}`;
    return {
      id: code,
      title: String(item?.title || '').trim() || 'Untitled Report',
      category: String(item?.category || '').trim() || 'General',
      period,
      updated: String(item?.updated_label || '').trim() || formatDateLabel(item?.updated_at),
      summary: String(item?.summary || '').trim() || 'Report generated from report form.',
      documentBody: String(item?.document || '').trim() || 'No document content provided.'
    };
  };

  const buildReportRow = ({ id, title, category, period, updated, summary, documentBody }) => {
    const row = document.createElement('tr');
    row.dataset.seedReport = 'custom';
    row.dataset.reportId = String(id || '').trim();
    row.innerHTML = `
      <td>${escapeHtml(id)}</td>
      <td>${escapeHtml(title)}</td>
      <td>${escapeHtml(category)}</td>
      <td>${escapeHtml(period)}</td>
      <td>${escapeHtml(updated)}</td>
      <td class="text-end">
        <div class="table-actions">
          <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                  data-id="${escapeHtml(id)}"
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
    return row;
  };

  const findRowByReportId = (reportId) => {
    const targetId = String(reportId || '').trim();
    if (!targetId) return null;
    return getRows().find((row) => {
      const viewData = row.querySelector('.view-report')?.dataset || {};
      return String(viewData.id || '').trim() === targetId;
    }) || null;
  };

  const renderReportsForSelectedYear = async () => {
    if (!reportsTableBody) return;

    const requestId = ++reportsRequestCounter;
    const selectedYear = Number(yearSelect?.value) || currentYear;
    clearRows();

    try {
      const serverItems = await fetchReportsForYear(selectedYear);
      if (requestId !== reportsRequestCounter) return;

      const rows = serverItems.map((item) => normalizeReportItem(item, selectedYear));
      rows.forEach((rowData) => {
        const row = buildReportRow(rowData);
        if (emptyRow && emptyRow.parentElement === reportsTableBody) {
          reportsTableBody.insertBefore(row, emptyRow);
        } else {
          reportsTableBody.appendChild(row);
        }
      });
    } catch (error) {
      if (requestId !== reportsRequestCounter) return;
      console.error('Unable to load reports:', error);
    } finally {
      if (requestId !== reportsRequestCounter) return;
      updateEmptyState();
    }
  };

  const openRowInModal = (row) => {
    if (!row) return;
    const viewData = row.querySelector('.view-report')?.dataset || {};
    activeModalRow = row;

    if (reportModalId) reportModalId.textContent = viewData.id || `RP-${currentYear}-001`;
    if (reportModalTitle) reportModalTitle.textContent = viewData.title || 'Annual Household Analytics Report';
    if (reportModalPeriod) reportModalPeriod.textContent = viewData.period || `Year ${Number(yearSelect?.value) || currentYear}`;
    if (reportModalUpdated) reportModalUpdated.textContent = viewData.updated || formatDateLabel(new Date().toISOString());
    if (reportModalDelete) reportModalDelete.disabled = false;
    reportModal?.show();
  };

  const getActiveModalData = () => {
    return activeModalRow?.querySelector('.view-report')?.dataset || null;
  };

  if (yearSelect) {
    yearSelect.addEventListener('change', () => {
      activeModalRow = null;
      renderReportsForSelectedYear();
    });
  }

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
    if (utf8Name?.[1]) {
      try {
        return decodeURIComponent(utf8Name[1]);
      } catch (e) {
        return utf8Name[1];
      }
    }
    const asciiName = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    if (asciiName?.[1]) return asciiName[1];
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

  const setButtonLoading = (button, isLoading, loadingLabel) => {
    if (!button) return;
    if (isLoading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>${loadingLabel}`;
      return;
    }
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  };

  const exportActiveReport = async (format) => {
    const data = getActiveModalData();
    if (!data) {
      window.alert('Please open a report first before exporting.');
      return;
    }

    const normalizedFormat = format === 'xlsx' ? 'xlsx' : 'pdf';
    const selectedYear = Number(yearSelect?.value) || currentYear;
    const triggerButton = normalizedFormat === 'pdf' ? reportModalDownload : reportModalPrint;
    const fallbackName = `Annual_Report_${selectedYear}.${normalizedFormat}`;

    setButtonLoading(triggerButton, true, 'Processing');
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
          period: data.period || `Year ${selectedYear}`,
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
            if (errorPayload?.error) {
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

      const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
      const expectedType = normalizedFormat === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      if (!contentType.includes(expectedType)) {
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
      setButtonLoading(triggerButton, false, 'Processing');
    }
  };

  const resetCreateForm = () => {
    if (createTitle) createTitle.value = '';
    if (createPeriod) createPeriod.value = '';
    if (createDocument) createDocument.value = '';
  };

  if (createBtn && createModal) {
    createBtn.addEventListener('click', () => {
      if (!canManageReports) return;
      resetCreateForm();
      createModal.show();
    });
  }

  if (createConfirm) {
    createConfirm.addEventListener('click', async () => {
      if (!canManageReports) return;

      const title = String(createTitle?.value || '').trim();
      const periodInput = String(createPeriod?.value || '').trim();
      if (!title) {
        if (createTitle) createTitle.focus();
        return;
      }

      const selectedYear = Number(yearSelect?.value) || currentYear;
      let period = formatPeriod(periodInput);
      if (period === '-') {
        period = `Year ${selectedYear}`;
      }
      const documentBody = String(createDocument?.value || '').trim() || 'No document content provided.';

      setButtonLoading(createConfirm, true, 'Saving');
      try {
        const created = await createReportOnServer({
          title,
          category: 'General',
          period,
          period_input: periodInput,
          year: selectedYear,
          summary: 'Report generated from report form.',
          document: documentBody
        });

        await renderReportsForSelectedYear();
        resetCreateForm();

        const createdCode = String(created?.report_code || '').trim();
        const openCreatedReport = () => {
          const targetRow = findRowByReportId(createdCode);
          if (targetRow) {
            openRowInModal(targetRow);
          }
        };

        if (createModalEl && createModal) {
          createModalEl.addEventListener('hidden.bs.modal', openCreatedReport, { once: true });
          createModal.hide();
        } else {
          openCreatedReport();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to create report.';
        window.alert(message);
      } finally {
        setButtonLoading(createConfirm, false, 'Saving');
      }
    });
  }

  document.addEventListener('click', (event) => {
    const openBtn = event.target.closest('.view-report');
    if (openBtn) {
      openRowInModal(openBtn.closest('tr'));
    }
  });

  if (reportModalDownload) {
    reportModalDownload.addEventListener('click', () => exportActiveReport('pdf'));
  }

  if (reportModalPrint) {
    reportModalPrint.addEventListener('click', () => exportActiveReport('xlsx'));
  }

  const openDeleteReportDialog = () => {
    if (!canManageReports || !activeModalRow) return;

    const viewData = activeModalRow.querySelector('.view-report')?.dataset || {};
    const reportId = viewData.id || activeModalRow.querySelector('td')?.textContent?.trim() || 'this report';
    pendingDeleteRow = activeModalRow;
    if (deleteReportMessage) {
      deleteReportMessage.innerHTML = `This will delete <strong>${escapeHtml(reportId)}</strong>. This action cannot be undone.`;
    }
    reopenReportModalAfterDelete = true;

    if (reportModalEl && reportModal && deleteReportModal) {
      suppressActiveRowReset = true;
      reportModalEl.addEventListener('hidden.bs.modal', () => {
        suppressActiveRowReset = false;
        deleteReportModal.show();
      }, { once: true });
      reportModal.hide();
      return;
    }

    deleteReportModal?.show();
  };

  if (reportModalDelete) {
    reportModalDelete.addEventListener('click', openDeleteReportDialog);
  }

  if (reportModalDeleteIcon) {
    reportModalDeleteIcon.addEventListener('click', openDeleteReportDialog);
  }

  if (deleteReportConfirmBtn) {
    deleteReportConfirmBtn.addEventListener('click', async () => {
      if (!canManageReports || !pendingDeleteRow) return;

      const deletedViewData = pendingDeleteRow.querySelector('.view-report')?.dataset || {};
      const deletedId = String(deletedViewData.id || '').trim();

      setButtonLoading(deleteReportConfirmBtn, true, 'Deleting');
      try {
        await deleteReportOnServer(deletedId);
        pendingDeleteRow = null;
        activeModalRow = null;
        reopenReportModalAfterDelete = false;
        deleteReportModal?.hide();
        await renderReportsForSelectedYear();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to delete report.';
        window.alert(message);
      } finally {
        setButtonLoading(deleteReportConfirmBtn, false, 'Deleting');
      }
    });
  }

  if (deleteReportModalEl) {
    deleteReportModalEl.addEventListener('hidden.bs.modal', () => {
      if (pendingDeleteRow && reopenReportModalAfterDelete) {
        openRowInModal(pendingDeleteRow);
      }
      pendingDeleteRow = null;
      reopenReportModalAfterDelete = false;
    });
  }

  if (reportModalEl) {
    reportModalEl.addEventListener('hidden.bs.modal', () => {
      if (!suppressActiveRowReset) {
        activeModalRow = null;
      }
      if (reportModalDelete) reportModalDelete.disabled = false;
    });
  }

  renderReportsForSelectedYear();
})();
