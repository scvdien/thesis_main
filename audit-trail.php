<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
$authRole = auth_user_role($authUser);
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
<link rel="stylesheet" href="assets/css/site-style.css">

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
        <div>
          <select id="yearSelect" class="form-select d-inline w-auto"></select>
          <button class="btn btn-outline-primary ms-2" id="refreshBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <section class="module audit-module">
        <div class="module-header">
          <div>
            <h5 class="mb-1 fw-bold">Activity Logs</h5>
            <p class="mb-0 text-muted small">System actions and approvals recorded for accountability</p>
          </div>
          <div class="module-actions">
            <div class="input-group input-group-sm module-search">
              <input type="text" class="form-control" id="auditSearchInput" placeholder="Search action, user, or record">
              <span class="input-group-text"><i class="bi bi-search"></i></span>
            </div>
            <select class="form-select form-select-sm" id="auditActionFilter">
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="deleted">Deleted</option>
              <option value="security">Security</option>
              <option value="access">Access</option>
            </select>
            <select class="form-select form-select-sm" id="auditUserFilter">
              <option value="all">All Users</option>
              <option value="captain">Captain</option>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>
        </div>

        <div class="module-grid">
          <div class="module-card">
            <div class="module-label">Total Actions</div>
            <div class="module-value" id="auditTotalActions">0</div>
          </div>
          <div class="module-card">
            <div class="module-label">Created</div>
            <div class="module-value" id="auditCreatedCount">0</div>
          </div>
          <div class="module-card">
            <div class="module-label">Updates</div>
            <div class="module-value" id="auditUpdatedCount">0</div>
          </div>
          <div class="module-card">
            <div class="module-label">Deleted</div>
            <div class="module-value" id="auditDeletedCount">0</div>
          </div>
        </div>

        <div class="module-table table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Date &amp; Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Record</th>
                <th>Module</th>
                <th>Details</th>
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
    &copy; <span id="year"></span> Barangay Cabarian Ligao City Household Information Management System. All rights reserved.
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



