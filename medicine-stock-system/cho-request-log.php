<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$adminDashboardCssVersion = (string) @filemtime(__DIR__ . '/assets/css/admin-dashboard.css');
$medicineInventoryCssVersion = (string) @filemtime(__DIR__ . '/assets/css/medicine-inventory.css');
$choRequestLogCssVersion = (string) @filemtime(__DIR__ . '/assets/css/cho-request-log.css');
$systemNotificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/system-notifications.css');
$choRequestLogJsVersion = (string) @filemtime(__DIR__ . '/assets/js/cho-request-log.js');
$supplyMonitoringJsVersion = (string) @filemtime(__DIR__ . '/assets/js/supply-monitoring.js');
$systemNotificationsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/system-notifications.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>CHO Request Log - Ligao City Coastal RHU</title>
  <link rel="icon" type="image/png" href="assets/img/CityHealthOffice_LOGO.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css?v=<?= urlencode($adminDashboardCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/medicine-inventory.css?v=<?= urlencode($medicineInventoryCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/cho-request-log.css?v=<?= urlencode($choRequestLogCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/system-notifications.css?v=<?= urlencode($systemNotificationsCssVersion) ?>">
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
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Log out</a>
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
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable request-modal-dialog">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="requestModalTitle">New CHO Request</h5>
            <p class="inventory-modal-subtitle mb-0" id="requestModalSubtitle">Select medicines, enter quantities, then set the delivery date.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="requestForm" class="inventory-form-grid">
            <input type="hidden" id="requestId">

            <section class="col-span-2 request-form-section" aria-labelledby="requestMedicinesTitle">
              <div class="request-section-heading">
                <span class="request-step-number" aria-hidden="true">1</span>
                <div>
                  <h6 id="requestMedicinesTitle">Add medicines</h6>
                  <p>Search the inventory and add each medicine to this request.</p>
                </div>
              </div>

              <div class="request-medicine-picker" id="requestMedicinePicker">
                <label for="requestMedicineSearch" class="form-label">Search medicine</label>
                <div class="request-medicine-search">
                  <i class="bi bi-search" aria-hidden="true"></i>
                  <input
                    type="search"
                    id="requestMedicineSearch"
                    class="form-control"
                    placeholder="Type a medicine or generic name"
                    autocomplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-controls="requestMedicineResults"
                    aria-expanded="false"
                  >
                  <span class="request-medicine-search__hint">Select from inventory</span>
                </div>
                <div id="requestMedicineResults" class="request-medicine-results d-none" role="listbox" aria-label="Available medicines" aria-multiselectable="true"></div>
              </div>

              <div class="request-selected-heading">
                <div>
                  <h6>Selected medicines</h6>
                  <p id="requestItemsStatus">Add at least one medicine to continue.</p>
                </div>
                <span class="request-selected-count" id="requestItemCount">0 selected</span>
              </div>

              <div id="requestItemsContainer" class="request-items-list"></div>
              <div id="requestItemsEmpty" class="request-items-empty">
                <span><i class="bi bi-capsule-pill" aria-hidden="true"></i></span>
                <div>
                  <strong>No medicines added yet</strong>
                  <p>Use the search field above to start your request.</p>
                </div>
              </div>
            </section>

            <section class="col-span-2 request-form-section request-schedule-section" aria-labelledby="requestScheduleTitle">
              <div class="request-section-heading">
                <span class="request-step-number" aria-hidden="true">2</span>
                <div>
                  <h6 id="requestScheduleTitle">Delivery schedule</h6>
                  <p>Confirm when the request is made and when delivery is expected.</p>
                </div>
              </div>

              <div class="request-date-grid">
                <div>
                  <label for="requestDate" class="form-label">Request date</label>
                  <input type="date" id="requestDate" class="form-control" required>
                  <small>Defaults to today's date.</small>
                </div>

                <div>
                  <label for="requestExpectedDate" class="form-label">Expected delivery date</label>
                  <input type="date" id="requestExpectedDate" class="form-control" required>
                  <small>Must be on or after the request date.</small>
                </div>
              </div>
            </section>

            <div id="requestFormFeedback" class="col-span-2 request-form-feedback d-none" role="alert"></div>

            <div class="col-span-2 inventory-form-actions request-form-actions">
              <div class="request-form-summary" aria-live="polite">
                <strong id="requestSummaryTitle">No medicines selected</strong>
                <span id="requestSummaryText">Add medicine and quantity details to continue.</span>
              </div>
              <div class="request-form-actions__buttons">
                <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary" id="requestSubmitBtn" disabled>
                  <i class="bi bi-send-check"></i><span id="requestSubmitBtnLabel">Submit Request</span>
                </button>
              </div>
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
  <script src="assets/js/session-heartbeat.js?v=20260820-presence"></script>
  <script src="assets/js/supply-monitoring.js?v=<?= urlencode($supplyMonitoringJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js?v=<?= urlencode($systemNotificationsJsVersion) ?>"></script>
  <script src="assets/js/cho-request-log.js?v=<?= urlencode($choRequestLogJsVersion) ?>"></script>
</body>
</html>
