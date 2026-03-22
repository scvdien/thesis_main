<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$choRequestLogJsVersion = (string) @filemtime(__DIR__ . '/assets/js/cho-request-log.js');
$supplyMonitoringJsVersion = (string) @filemtime(__DIR__ . '/assets/js/supply-monitoring.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CHO Request Log - Ligao City Coastal RHU</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css">
  <link rel="stylesheet" href="assets/css/medicine-inventory.css">
  <link rel="stylesheet" href="assets/css/cho-request-log.css">
</head>
<body class="admin-dashboard-page">
  <div id="wrapper">
    <div id="content-area">
      <aside id="sidebar">
        <div class="brand d-flex align-items-center gap-2 mb-3">
          <img src="assets/img/CityHealthOffice_LOGO.png" alt="Ligao City Coastal Rural Health Unit Logo">
          <div class="brand-text-wrap">
            <span class="brand-title">Ligao City Coastal RHU</span>
            <span class="brand-sub">Cabarian, Ligao City</span>
          </div>
        </div>

        <div class="menu">
          <a href="index.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
          <a href="medicine-inventory.php"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php" class="active"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main" class="inventory-main request-main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="page-intro">
              <h4 class="mb-0 text-primary">CHO Request Log</h4>
            </div>
          </div>
        </div>

        <div id="moduleAlert" class="alert d-none" role="alert"></div>

        <section class="inventory-workspace">
          <section class="inventory-panel inventory-panel--table">
            <div class="inventory-panel__head inventory-panel__head--split">
              <div>
                <h5>Request Tracking</h5>
                <p>Log CHO requests, link received deliveries, and monitor fulfillment status.</p>
              </div>
              <span class="inventory-record-count" id="requestCount">0 requests</span>
            </div>

            <div class="request-toolbar">
              <div class="inventory-searchbar" role="search" aria-label="Search request log">
                <div class="inventory-searchbox">
                  <label class="inventory-searchfield" for="requestSearch">
                    <input
                      type="search"
                      id="requestSearch"
                      class="form-control"
                      placeholder="Search request number, medicine, or source"
                      autocomplete="off"
                    >
                  </label>
                  <button type="button" class="inventory-searchbtn" id="requestSearchBtn" aria-label="Search request log">
                    <i class="bi bi-search"></i>
                  </button>
                </div>
              </div>

              <select id="requestStatusFilter" class="form-select" aria-label="Filter request status">
                <option value="all">Status</option>
                <option value="pending">Pending</option>
                <option value="incomplete">Incomplete</option>
                <option value="delayed">Delayed</option>
                <option value="on-time">On Time</option>
              </select>

              <div class="inventory-toolbar__action">
                <button type="button" class="btn btn-primary btn-add-medicine" id="openRequestModalBtn">
                  <i class="bi bi-plus-lg"></i>New Request
                </button>
              </div>
            </div>

            <div class="inventory-table-shell request-table-shell table-responsive">
              <table class="table inventory-table request-table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Request</th>
                    <th scope="col">Medicines</th>
                    <th scope="col">Requested Items</th>
                    <th scope="col">Request Date</th>
                    <th scope="col">Expected Delivery</th>
                    <th scope="col">Received</th>
                    <th scope="col">Lead Time</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody id="requestTableBody">
                  <tr>
                    <td colspan="9" class="inventory-empty">Loading CHO requests...</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>
    </div>

    <footer class="footer text-muted">
      &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System. All rights reserved.
    </footer>
  </div>

  <div class="modal fade" id="requestModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="requestModalTitle">New CHO Request</h5>
            <p class="inventory-modal-subtitle mb-0" id="requestModalSubtitle">Create one CHO request with all required medicines.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="requestForm" class="inventory-form-grid">
            <input type="hidden" id="requestId">

            <div class="col-span-2">
              <div class="request-items-panel">
                <div class="request-items-head">
                  <div>
                    <label class="form-label mb-1">Requested Medicines</label>
                    <p class="inventory-modal-subtitle mb-0">Add the medicines included in this request.</p>
                  </div>
                  <button type="button" class="btn btn-light request-item-add-btn" id="addRequestItemBtn">
                    <i class="bi bi-plus-lg"></i>Add Medicine
                  </button>
                </div>
                <div class="request-items-grid-head" aria-hidden="true">
                  <span>Medicine</span>
                  <span>Quantity</span>
                  <span class="request-items-grid-head__action">Action</span>
                </div>
                <div id="requestItemsContainer" class="request-items-list"></div>
              </div>
            </div>

            <div>
              <label for="requestDate" class="form-label">Request Date</label>
              <input type="date" id="requestDate" class="form-control" required>
            </div>

            <div>
              <label for="requestExpectedDate" class="form-label">Expected Delivery Date</label>
              <input type="date" id="requestExpectedDate" class="form-control" required>
            </div>

            <div class="col-span-2 inventory-form-actions">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="requestSubmitBtn">
                <i class="bi bi-save2"></i>Save Request
              </button>
            </div>
          </form>

          <div id="requestDetailsView" class="request-details-view d-none">
            <div class="request-details-meta">
              <article class="request-details-meta__card">
                <span>Request Code</span>
                <strong id="requestDetailCode">-</strong>
              </article>
              <article class="request-details-meta__card">
                <span>Request Date</span>
                <strong id="requestDetailRequestDate">-</strong>
              </article>
              <article class="request-details-meta__card">
                <span>Expected Delivery</span>
                <strong id="requestDetailExpectedDate">-</strong>
              </article>
              <article class="request-details-meta__card">
                <span>Status</span>
                <div id="requestDetailStatus">-</div>
              </article>
            </div>

            <section class="request-detail-section">
              <div class="request-detail-section__head">
                <h6>Medicines Requested</h6>
                <p>Review the medicines and requested quantities in this CHO request.</p>
              </div>

              <div class="table-responsive">
                <table class="table request-detail-table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Medicine</th>
                      <th scope="col">Generic Name</th>
                      <th scope="col">Quantity Requested</th>
                    </tr>
                  </thead>
                  <tbody id="requestDetailTableBody">
                    <tr>
                      <td colspan="3" class="inventory-empty">No medicines listed.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <div class="request-detail-footer">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="requestDeleteModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-danger">
          <i class="bi bi-trash3-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Delete CHO Request</h5>
        <p class="mb-3" id="requestDeleteMessage">Are you sure you want to delete this CHO request and all listed medicines?</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="confirmDeleteRequestBtn">Delete</button>
        </div>
      </div>
    </div>
  </div>

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

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    window.MSS_AUTH_USER = <?= json_encode(mss_auth_user_payload($authUser), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script src="assets/js/session-heartbeat.js?v=20260321-presence"></script>
  <script src="assets/js/supply-monitoring.js?v=<?= urlencode($supplyMonitoringJsVersion) ?>"></script>
  <script src="assets/js/cho-request-log.js?v=<?= urlencode($choRequestLogJsVersion) ?>"></script>
</body>
</html>
