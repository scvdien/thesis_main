<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['admin']);
$authRole = auth_user_role($authUser);
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reports | Admin Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<!-- Bootstrap CSS -->
<link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
<link rel="stylesheet" href="assets/css/admin-style.css">
</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">
  <div id="content-area">
    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="Barangay Cabarian Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary">Barangay Cabarian</span>
      </div>
      <div class="menu">
        <a href="admin.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php?role=admin"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
        <a href="admin-reports.php" class="active"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="settings.php?role=admin"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger" id="logoutBtn"><i class="bi bi-box-arrow-right"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- MAIN -->
    <main id="main">
      <div class="topbar">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-list toggle-btn" onclick="toggleSidebar()"></i>
          <h4 class="mb-0 text-primary">Reports</h4>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <select id="yearSelect" class="form-select d-inline w-auto"></select>
        </div>
      </div>

      <section class="module reports-module">
        <div class="module-header reports-header">
          <div>
            <h5 class="mb-1 fw-bold">Reports Overview</h5>
            <p class="mb-0 text-muted small">Directory of barangay reports</p>
          </div>
          <div class="reports-header-actions">
            <button class="btn btn-primary report-toolbar-add" id="createReportBtn">
              <i class="bi bi-plus-lg"></i> New Report
            </button>
          </div>
        </div>

        <div class="module-table report-table-wrap table-responsive">
          <table class="table table-hover align-middle mb-0 reports-table">
            <thead>
              <tr>
                <th>Report ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Period</th>
                <th>Last Updated</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody id="reportsTableBody">
              <tr>
                <td>RP-2026-021</td>
                <td>Household Summary</td>
                <td>Households</td>
                <td>Jan 2026</td>
                <td>Feb 08, 2026</td>
                <td class="text-end">
                  <div class="table-actions">
                    <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                            data-id="RP-2026-021"
                            data-title="Household Summary"
                            data-category="Households"
                            data-period="Jan 2026"
                            data-status="Draft"
                            data-updated="Feb 08, 2026"
                            data-summary="Draft report for household registrations and zone distribution."
                            data-document="This draft compiles new household registrations per zone, highlights transfers, and notes verification cases.">
                      <i class="bi bi-eye"></i> View
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>RP-2026-020</td>
                <td>Resident Demographics</td>
                <td>Residents</td>
                <td>Jan 2026</td>
                <td>Feb 07, 2026</td>
                <td class="text-end">
                  <div class="table-actions">
                    <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                            data-id="RP-2026-020"
                            data-title="Resident Demographics"
                            data-category="Residents"
                            data-period="Jan 2026"
                            data-status="Draft"
                            data-updated="Feb 07, 2026"
                            data-summary="Demographic breakdown ready for update."
                            data-document="Includes age distribution, gender ratio, and household size summary for the reporting period.">
                      <i class="bi bi-eye"></i> View
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>RP-2026-019</td>
                <td>Health and Welfare</td>
                <td>Health</td>
                <td>Dec 2026</td>
                <td>Feb 02, 2026</td>
                <td class="text-end">
                  <div class="table-actions">
                    <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                            data-id="RP-2026-019"
                            data-title="Health and Welfare"
                            data-category="Health"
                            data-period="Dec 2026"
                            data-status="Draft"
                            data-updated="Feb 02, 2026"
                            data-summary="Health and welfare metrics for monthly recap."
                            data-document="Draft report on health visits, immunization coverage, and welfare assistance distribution.">
                      <i class="bi bi-eye"></i> View
                    </button>
                  </div>
                </td>
              </tr>
              <tr>
                <td>RP-2026-018</td>
                <td>Employment Snapshot</td>
                <td>Economy</td>
                <td>Dec 2026</td>
                <td>Jan 30, 2026</td>
                <td class="text-end">
                  <div class="table-actions">
                    <button type="button" class="btn btn-outline-primary btn-sm report-view-btn open-report view-report"
                            data-id="RP-2026-018"
                            data-title="Employment Snapshot"
                            data-category="Economy"
                            data-period="Dec 2026"
                            data-status="Draft"
                            data-updated="Jan 30, 2026"
                            data-summary="Employment figures and sector distribution draft."
                            data-document="Initial employment figures and sector breakdown for barangay residents.">
                      <i class="bi bi-eye"></i> View
                    </button>
                  </div>
                </td>
              </tr>
              <tr id="reportsEmptyRow" class="d-none">
                <td colspan="6" class="text-center text-muted">No reports found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <!-- FOOTER -->
  <footer class="footer text-muted">
    &copy; <span id="year"></span> Barangay Cabarian Ligao City Household Information Management System. All rights reserved.
  </footer>

  <!-- REPORT DETAILS MODAL -->
  <div class="modal fade" id="reportModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title mb-0">Report Details</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <ul class="list-unstyled mb-0 d-grid gap-2">
            <li><span class="fw-semibold">&#8226; Report ID:</span> <span id="reportModalId">RP-2026-001</span></li>
            <li><span class="fw-semibold">&#8226; Title:</span> <span id="reportModalTitle">Annual Household Analytics Report</span></li>
            <li><span class="fw-semibold">&#8226; Period:</span> <span id="reportModalPeriod">Year 2026</span></li>
            <li><span class="fw-semibold">&#8226; Generated Date:</span> <span id="reportModalUpdated">Feb 19, 2026</span></li>
          </ul>
        </div>
        <div class="modal-footer border-0 pt-0 d-flex justify-content-end gap-2 flex-wrap">
          <button class="btn btn-outline-primary btn-modern" id="reportModalDownload"><i class="bi bi-file-earmark-pdf"></i> Generate PDF</button>
          <button class="btn btn-outline-success btn-modern" id="reportModalPrint"><i class="bi bi-file-earmark-excel"></i> Generate Excel</button>
          <button class="btn btn-outline-danger btn-modern" id="reportModalDelete"><i class="bi bi-trash"></i> Delete</button>
          <button class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <!-- CREATE REPORT MODAL -->
  <div class="modal fade" id="createReportModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Create Report</h5>
            <p class="text-muted small mb-0">Create a report draft.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <div class="settings-form-grid">
            <div>
              <label class="form-label small">Report Title</label>
              <input type="text" class="form-control" id="createTitle" placeholder="e.g., Household Summary">
            </div>
            <div>
              <label class="form-label small">Reporting Period</label>
              <input type="month" class="form-control" id="createPeriod">
            </div>
            <div class="settings-form-full">
              <label class="form-label small">Document Content</label>
              <textarea class="form-control" id="createDocument" rows="4" placeholder="Enter report content..."></textarea>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-modern" id="createConfirm">Create Draft</button>
        </div>
      </div>
    </div>
  </div>

  <!-- DELETE REPORT CONFIRM MODAL -->
  <div class="modal fade" id="deleteReportModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <h5 class="modal-title mb-0">Confirm Delete</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-2">
          <p class="mb-0" id="deleteReportMessage">Delete this report?</p>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary btn-modern" id="deleteReportConfirmBtn">OK</button>
        </div>
      </div>
    </div>
  </div>

  <!-- LOGOUT MODAL -->
  <div class="modal fade" id="logoutModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-warning">
          <i class="bi bi-exclamation-triangle-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Logout Confirmation</h5>
        <p class="mb-3">Are you sure you want to log out?</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <a href="logout.php" class="btn btn-danger btn-modern">Logout</a>
        </div>
      </div>
    </div>
  </div>

  <!-- Bootstrap JS -->
  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/responsive-table-scripts.js"></script>
  <script src="assets/js/admin-reports-scripts.js"></script>

</body>
</html>


