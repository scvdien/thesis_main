<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
$authRole = auth_user_role($authUser);
$brandBarangay = trim(auth_env(['BARANGAY_NAME'], 'Barangay'));
$brandCity = trim(auth_env(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], ''));
try {
  $profilePdo = auth_db();
  $profileStmt = $profilePdo->query('SELECT `barangay_name`, `city_name` FROM `barangay_profile` WHERE `id` = 1 LIMIT 1');
  $profileRow = $profileStmt instanceof PDOStatement ? $profileStmt->fetch(PDO::FETCH_ASSOC) : null;
  if (is_array($profileRow)) {
    $profileBarangay = trim((string) ($profileRow['barangay_name'] ?? ''));
    $profileCity = trim((string) ($profileRow['city_name'] ?? ''));
    if ($profileBarangay !== '') {
      $brandBarangay = $profileBarangay;
    }
    if ($profileCity !== '') {
      $brandCity = $profileCity;
    }
  }
} catch (Throwable $exception) {
  // Fall back to environment defaults when profile data is unavailable.
}
$brandLabel = $brandBarangay !== '' ? $brandBarangay : 'Barangay';
$brandSidebarLabel = $brandLabel;
if ($brandCity !== '' && stripos($brandLabel, $brandCity) === false) {
  $brandSidebarLabel = trim($brandLabel . ' ' . $brandCity);
}
$systemLabel = trim($brandSidebarLabel . ' Household Information Management System');
$siteStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/site-style.css') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Audit Trail | Barangay Captain Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<!-- Bootstrap CSS -->
<link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
<link rel="stylesheet" href="assets/css/site-style.css?v=<?= htmlspecialchars($siteStyleVersion, ENT_QUOTES, 'UTF-8') ?>">

</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">

  <div id="content-area">
    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?> Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
      <div class="menu">
        <a href="index.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
        <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger"><i class="bi bi-box-arrow-right"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- MAIN -->
    <main id="main">
      <div class="topbar">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-list toggle-btn" onclick="toggleSidebar()"></i>
          <h4 class="mb-0 text-primary">System Logs</h4>
        </div>
        <div class="topbar-actions">
          <button class="btn btn-outline-primary" id="refreshBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <section class="module audit-module">
        <div class="module-header">
          <div class="audit-title-wrap">
            <h5 class="mb-1 fw-bold">Activity Logs</h5>
            <p class="mb-0 text-muted small">System actions and approvals recorded for accountability</p>
          </div>
          <div class="audit-header-actions">
            <select class="form-select form-select-sm audit-pill-filter audit-year-filter" id="yearSelect">
              <option value="all">All Years</option>
            </select>
          </div>
        </div>
        <div class="audit-toolbar" role="search" aria-label="Activity log filters">
          <div class="audit-search-pill">
            <input type="text" class="form-control" id="auditSearchInput" placeholder="Search action, user, or record">
            <span class="audit-search-icon" aria-hidden="true"><i class="bi bi-search"></i></span>
          </div>
          <div class="audit-quick-row">
            <div class="audit-quick-group">
              <span class="audit-quick-label">Quick Filter</span>
              <div class="audit-quick-pills" role="group" aria-label="Action filters">
                <button type="button" class="audit-quick-pill is-active" data-audit-action="all" aria-pressed="true">All</button>
                <button type="button" class="audit-quick-pill" data-audit-action="created" aria-pressed="false">Created</button>
                <button type="button" class="audit-quick-pill" data-audit-action="updated" aria-pressed="false">Updated</button>
                <button type="button" class="audit-quick-pill" data-audit-action="deleted" aria-pressed="false">Deleted</button>
                <button type="button" class="audit-quick-pill" data-audit-action="security" aria-pressed="false">Security</button>
                <button type="button" class="audit-quick-pill" data-audit-action="access" aria-pressed="false">Access</button>
              </div>
            </div>
            <div class="audit-record-inline text-muted small" id="auditRecordCount" aria-live="polite">0 records found</div>
          </div>
        </div>

        <div class="module-table table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Result</th>
                <th>Details</th>
                <th>IP Address</th>
              </tr>
            </thead>
            <tbody id="auditTableBody">
              <tr id="auditLoadingRow">
                <td colspan="6" class="text-center text-muted">Loading activity logs...</td>
              </tr>
              <tr id="auditEmptyRow" class="d-none">
                <td colspan="6" class="text-center text-muted">No activity logs found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <!-- FOOTER -->
  <footer class="footer text-muted">
    &copy; <span id="year"></span> <?= htmlspecialchars($systemLabel, ENT_QUOTES, 'UTF-8') ?>. All rights reserved.
  </footer>

  <!-- MODERN REFRESH MODAL -->
  <div class="modal fade" id="refreshModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <h5 class="modal-title mb-2">Refreshing Data</h5>
        <p class="mb-3">Please wait while we refresh the data.</p>
        <button type="button" class="btn btn-primary btn-modern" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>

  <!-- MODERN LOGOUT MODAL -->
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

  <!-- Bootstrap JS bundle -->
  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/responsive-table-scripts.js"></script>
  <script src="assets/js/audit-trail-scripts.js"></script>

</body>
</html>



