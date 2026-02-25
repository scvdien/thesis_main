function toggleSidebar(){
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  const isMobile = window.matchMedia('(max-width: 992px)').matches;

  if (isMobile) {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('show');
    document.body.classList.toggle('sidebar-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

window.addEventListener('resize', () => {
  const isMobile = window.matchMedia('(max-width: 992px)').matches;
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!isMobile) {
    sidebar.classList.remove('open');
    backdrop.classList.remove('show');
    document.body.classList.remove('sidebar-open');
  }
});

const roleFromQueryRaw = new URLSearchParams(window.location.search).get('role');
const roleFromQuery = (roleFromQueryRaw || '').toLowerCase();
const roleFromStorage = (sessionStorage.getItem('userRole') || '').toLowerCase();
const roleFromBody = (document.body.dataset.role || '').toLowerCase();
const resolvedRole = roleFromQuery || roleFromStorage || roleFromBody || 'captain';
if (roleFromQuery) {
  try { sessionStorage.setItem('userRole', roleFromQuery); } catch (e) {}
}
document.body.dataset.role = resolvedRole;

const dashboardLink = document.querySelector('.menu a[href="index.php"]');
if (dashboardLink && (resolvedRole === 'secretary' || resolvedRole === 'admin')) {
  dashboardLink.setAttribute('href', 'admin.php');
}

const isAdminRole = resolvedRole === 'secretary' || resolvedRole === 'admin';
const dashboardLabel = isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';
document.title = `Reports | ${dashboardLabel}`;

const reportsLink = document.querySelector('.menu a[href="reports.php"]');
if (reportsLink && isAdminRole) {
  reportsLink.setAttribute('href', 'admin-reports.php');
}

if (isAdminRole) {
  window.location.href = 'admin-reports.php';
  return;
}

const currentYear = new Date().getFullYear();
const previousYear = currentYear - 1;
const yearSelect = document.getElementById('yearSelect');
if (yearSelect) {
  [previousYear, currentYear].forEach((y) => {
    const option = document.createElement('option');
    option.value = y;
    option.textContent = y;
    yearSelect.appendChild(option);
  });
}

const footerYear = document.getElementById('year');
if (footerYear) {
  footerYear.textContent = '2026';
}

const refreshBtn = document.getElementById('refreshBtn');
const refreshModalEl = document.getElementById('refreshModal');
if (refreshBtn && refreshModalEl) {
  const refreshModal = new bootstrap.Modal(refreshModalEl);
  refreshBtn.addEventListener('click', () => refreshModal.show());
}

const logoutBtn = document.querySelector('.menu a.text-danger');
const logoutModalEl = document.getElementById('logoutModal');
if (logoutBtn && logoutModalEl) {
  const logoutModal = new bootstrap.Modal(logoutModalEl);
  logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    logoutModal.show();
  });
}

const reportModalEl = document.getElementById('reportModal');
const reportModal = reportModalEl ? new bootstrap.Modal(reportModalEl) : null;
const reportModalId = document.getElementById('reportModalId');
const reportModalTitle = document.getElementById('reportModalTitle');
const reportModalCategory = document.getElementById('reportModalCategory');
const reportModalPeriod = document.getElementById('reportModalPeriod');
const reportModalGenerated = document.getElementById('reportModalGenerated');
const reportModalStatus = document.getElementById('reportModalStatus');
const reportModalSubmitted = document.getElementById('reportModalSubmitted');
const reportModalSummary = document.getElementById('reportModalSummary');
const reportModalDocument = document.getElementById('reportModalDocument');
const reportModalDoc = document.getElementById('reportModalDoc');

const approveModalEl = document.getElementById('approveModal');
const approveModal = approveModalEl ? new bootstrap.Modal(approveModalEl) : null;
const approveConfirm = document.getElementById('approveConfirm');
let pendingApproveRow = null;

const reportFilterButtons = document.querySelectorAll('.reports-module [data-filter]');
const reportRows = document.querySelectorAll('tbody tr[data-status]');
const reportsEmptyRow = document.getElementById('reportsEmptyRow');

const applyReportFilter = (filter) => {
  let visibleCount = 0;
  reportRows.forEach((row) => {
    const status = String(row.dataset.status || '').toLowerCase();
    const visible = filter === 'all' ? true : status === filter;
    row.classList.toggle('d-none', !visible);
    if (visible) visibleCount += 1;
  });

  if (reportsEmptyRow) {
    reportsEmptyRow.classList.toggle('d-none', visibleCount !== 0);
  }
};

reportFilterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter || 'all';
    reportFilterButtons.forEach((item) => {
      item.classList.remove('is-active');
      item.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
    applyReportFilter(filter);
  });
});

document.addEventListener('click', (event) => {
  const viewBtn = event.target.closest('.view-report');
  if (viewBtn) {
    const {
      id,
      title,
      category,
      period,
      generated,
      status,
      submitted,
      summary,
      document,
      documentName
    } = viewBtn.dataset;

    if (reportModalId) reportModalId.textContent = id || 'RP-';
    if (reportModalTitle) reportModalTitle.textContent = title || '-';
    if (reportModalCategory) reportModalCategory.textContent = category || '-';
    if (reportModalPeriod) reportModalPeriod.textContent = period || '-';
    if (reportModalGenerated) reportModalGenerated.textContent = generated || '-';
    if (reportModalStatus) reportModalStatus.textContent = status || '-';
    if (reportModalSubmitted) reportModalSubmitted.textContent = submitted || '-';
    if (reportModalSummary) reportModalSummary.textContent = summary || '-';
    if (reportModalDocument) {
      reportModalDocument.textContent = documentName || 'Not uploaded';
    }
    if (reportModalDoc) {
      if (document) {
        reportModalDoc.classList.remove('disabled');
        reportModalDoc.setAttribute('href', document);
      } else {
        reportModalDoc.classList.add('disabled');
        reportModalDoc.setAttribute('href', '#');
      }
    }

    reportModal?.show();
    return;
  }

  const approveBtn = event.target.closest('.approve-report');
  if (approveBtn) {
    pendingApproveRow = approveBtn.closest('tr');
    approveModal?.show();
  }
});

if (approveConfirm) {
  approveConfirm.addEventListener('click', () => {
    if (!pendingApproveRow) return;
    const statusBadge = pendingApproveRow.querySelector('.status-badge');
    const approveButton = pendingApproveRow.querySelector('.approve-report');
    if (statusBadge) {
      statusBadge.textContent = 'Approved';
      statusBadge.classList.remove('bg-warning-subtle', 'text-warning');
      statusBadge.classList.add('bg-success-subtle', 'text-success');
    }
    pendingApproveRow.dataset.status = 'approved';
    if (approveButton) {
      approveButton.disabled = true;
      approveButton.classList.add('btn-outline-secondary');
      approveButton.classList.remove('btn-primary');
      approveButton.innerHTML = '<i class=\"bi bi-check\"></i> Approved';
    }
    approveModal?.hide();
    pendingApproveRow = null;
    applyReportFilter(document.querySelector('.reports-module .filter-card.is-active')?.dataset.filter || 'all');
  });
}

applyReportFilter('all');
