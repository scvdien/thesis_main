<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
$authRole = auth_user_role($authUser);
$csrfToken = auth_csrf_token();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
$assetCacheNonce = (string) (@filemtime(__FILE__) ?: time());
$adminStyleVersion = ((string) (@filemtime(__DIR__ . '/assets/css/admin-style.css') ?: '1')) . '-' . $assetCacheNonce;
$responsiveTableScriptVersion = ((string) (@filemtime(__DIR__ . '/assets/js/responsive-table-scripts.js') ?: '1')) . '-' . $assetCacheNonce;
$reportsScriptVersion = ((string) (@filemtime(__DIR__ . '/assets/js/admin-reports-scripts.js') ?: '1')) . '-' . $assetCacheNonce;

$isAdminRole = $authRole === AUTH_ROLE_ADMIN;
$dashboardHref = $isAdminRole ? 'admin.php' : 'index.php';
$householdsHref = $isAdminRole ? 'households.php?role=admin' : 'households.php';
$settingsHref = $isAdminRole ? 'settings.php?role=admin' : 'settings.php';
$dashboardLabel = $isAdminRole ? 'Admin Dashboard' : 'Barangay Captain Dashboard';

$barangayName = auth_env(['BARANGAY_NAME'], 'Barangay');
$barangayCity = auth_env(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], '');
try {
  $profilePdo = auth_db();
  $profileStmt = $profilePdo->query('SELECT `barangay_name`, `city_name` FROM `barangay_profile` WHERE `id` = 1 LIMIT 1');
  $profileRow = $profileStmt instanceof PDOStatement ? $profileStmt->fetch(PDO::FETCH_ASSOC) : null;
  if (is_array($profileRow)) {
    $profileBarangay = trim((string) ($profileRow['barangay_name'] ?? ''));
    $profileCity = trim((string) ($profileRow['city_name'] ?? ''));
    if ($profileBarangay !== '') {
      $barangayName = $profileBarangay;
    }
    if ($profileCity !== '') {
      $barangayCity = $profileCity;
    }
  }
} catch (Throwable $exception) {
  // Fall back to environment defaults when profile data is unavailable.
}

$brandLabel = trim($barangayName) !== '' ? trim($barangayName) : 'Barangay';
$footerPlace = trim($barangayCity);
$brandCoreCandidate = preg_replace('/^\s*barangay\b[\s,]*/i', '', $brandLabel);
$brandCore = trim((string) ($brandCoreCandidate ?? $brandLabel));
if ($brandCore === '') {
  $brandCore = trim($brandLabel);
}
$footerLabel = $brandCore !== '' ? 'Barangay ' . $brandCore : 'Barangay';
if ($footerPlace !== '' && stripos($footerLabel, $footerPlace) === false) {
  $footerLabel = trim($footerLabel . ', ' . $footerPlace);
}
$brandSidebarLabel = $brandCore;
if ($footerPlace !== '' && stripos($brandSidebarLabel, $footerPlace) === false) {
  $brandSidebarLabel = trim($brandSidebarLabel . ' ' . $footerPlace);
}
if ($brandSidebarLabel === '') {
  $brandSidebarLabel = $footerLabel;
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Reports | <?= htmlspecialchars($dashboardLabel, ENT_QUOTES, 'UTF-8') ?></title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

<!-- Bootstrap CSS -->
<link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
<link rel="stylesheet" href="assets/css/admin-style.css?v=<?= urlencode($adminStyleVersion) ?>">
</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">
  <div id="content-area">
    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel . ' Logo', ENT_QUOTES, 'UTF-8') ?>" style="width:40px; height:auto;">
        <span class="fw-bold text-primary"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
      <div class="menu">
        <a href="<?= htmlspecialchars($dashboardHref, ENT_QUOTES, 'UTF-8') ?>"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="<?= htmlspecialchars($householdsHref, ENT_QUOTES, 'UTF-8') ?>"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
        <a href="reports.php" class="active"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="<?= htmlspecialchars($settingsHref, ENT_QUOTES, 'UTF-8') ?>"><i class="bi bi-gear"></i>Settings</a>
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
<?php if ($isAdminRole): ?>
          <div class="reports-header-actions">
            <button class="btn btn-primary report-toolbar-add" id="createReportBtn">
              <i class="bi bi-plus-lg"></i> New Report
            </button>
          </div>
<?php endif; ?>
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
    &copy; <span id="year"></span> <?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?>. All rights reserved.
  </footer>

  <!-- REPORT DETAILS MODAL -->
  <div class="modal fade" id="reportModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0 report-modal-header">
          <h5 class="modal-title mb-0">Report Details</h5>
<?php if ($isAdminRole): ?>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
<?php else: ?>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
<?php endif; ?>
        </div>
        <div class="modal-body pt-3">
          <div class="report-detail-list">
            <div class="report-detail-item">
              <span class="report-detail-label">Report ID:</span>
              <span class="report-detail-value" id="reportModalId">-</span>
            </div>
            <div class="report-detail-item">
              <span class="report-detail-label">Title:</span>
              <span class="report-detail-value" id="reportModalTitle">-</span>
            </div>
            <div class="report-detail-item">
              <span class="report-detail-label">Period:</span>
              <span class="report-detail-value" id="reportModalPeriod">Year <?= (int) date('Y') ?></span>
            </div>
            <div class="report-detail-item">
              <span class="report-detail-label">Generated Date:</span>
              <span class="report-detail-value" id="reportModalUpdated">-</span>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0 report-modal-footer">
          <div class="report-modal-actions">
            <button class="btn btn-outline-success btn-modern" id="reportModalPrint"><i class="bi bi-file-earmark-excel"></i> Generate Excel</button>
            <div class="report-modal-side-stack">
              <button class="btn btn-modern btn-report-pdf" id="reportModalDownload"><i class="bi bi-file-earmark-pdf"></i> Generate PDF</button>
<?php if ($isAdminRole): ?>
              <button class="btn btn-danger btn-modern report-modal-delete-btn" id="reportModalDelete"><i class="bi bi-trash"></i> Delete Report</button>
<?php else: ?>
              <button class="btn btn-outline-secondary btn-modern" data-bs-dismiss="modal">Close</button>
<?php endif; ?>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

<?php if ($isAdminRole): ?>
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
              <input type="month" class="form-control" id="createPeriod" required>
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
<?php endif; ?>

<?php if ($isAdminRole): ?>
  <!-- DELETE REPORT MODAL -->
  <div class="modal fade" id="deleteReportModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4 report-delete-modal">
        <div class="modal-icon mb-3 text-danger">
          <i class="bi bi-trash fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Delete Report</h5>
        <p class="mb-3" id="deleteReportMessage">This will delete <strong>this report</strong>. This action cannot be undone.</p>
        <div class="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="deleteReportConfirmBtn">Confirm Delete</button>
        </div>
      </div>
    </div>
  </div>
<?php endif; ?>

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
  <script src="assets/js/responsive-table-scripts.js?v=<?= urlencode($responsiveTableScriptVersion) ?>"></script>
  <script src="assets/js/admin-reports-scripts.js?v=<?= urlencode($reportsScriptVersion) ?>"></script>

</body>
</html>
