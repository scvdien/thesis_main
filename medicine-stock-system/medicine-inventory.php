<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$medicineInventoryCssVersion = (string) @filemtime(__DIR__ . '/assets/css/medicine-inventory.css');
$medicineInventoryJsVersion = (string) @filemtime(__DIR__ . '/assets/js/medicine-inventory.js');
$supplyMonitoringJsVersion = (string) @filemtime(__DIR__ . '/assets/js/supply-monitoring.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Medicine Inventory - Ligao City Coastal RHU</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css">
  <link rel="stylesheet" href="assets/css/medicine-inventory.css?v=<?= urlencode($medicineInventoryCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/system-notifications.css">
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
          <a href="medicine-inventory.php" class="active"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main" class="inventory-main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="page-intro">
              <h4 class="mb-0 text-primary">Medicine Inventory</h4>
            </div>
          </div>
        </div>

        <div id="moduleAlert" class="inventory-feedback-modal" role="status" aria-live="polite"></div>

        <section class="inventory-workspace">
          <section class="inventory-panel inventory-panel--table">
            <div class="inventory-panel__head inventory-panel__head--split">
              <div>
                <h5>Inventory</h5>
                <p>Search, filter, and update stock.</p>
              </div>
              <span class="inventory-record-count" id="inventoryCount">0 items</span>
            </div>

            <div class="inventory-toolbar">
              <div class="inventory-searchbar" role="search" aria-label="Search inventory">
                <div class="inventory-searchbox">
                  <label class="inventory-searchfield" for="inventorySearch">
                    <input
                      type="search"
                      id="inventorySearch"
                      class="form-control"
                      placeholder="Search medicine, form, or batch"
                      autocomplete="off"
                    >
                  </label>
                  <button type="button" class="inventory-searchbtn" id="inventorySearchBtn" aria-label="Search inventory">
                    <i class="bi bi-search"></i>
                  </button>
                </div>
              </div>

              <select id="categoryFilter" class="form-select" aria-label="Filter by medicine category">
                <option value="all">Category</option>
              </select>

              <select id="statusFilter" class="form-select" aria-label="Filter by stock status">
                <option value="all">Active Records</option>
                <option value="healthy">Healthy</option>
                <option value="low-stock">Low Stock</option>
                <option value="critical">Critical</option>
                <option value="expiring-soon">Expiring Soon</option>
                <option value="out-of-stock">Out of Stock</option>
                <option value="archived">Archived</option>
              </select>

              <div class="inventory-toolbar__action">
                <button type="button" class="btn btn-primary btn-add-medicine" id="openAddMedicineBtn">
                  <i class="bi bi-plus-lg"></i>Add Medicine
                </button>
              </div>
            </div>

            <div class="inventory-table-shell table-responsive">
              <table class="table inventory-table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Medicine</th>
                    <th scope="col">Medicine Form</th>
                    <th scope="col">Batch</th>
                    <th scope="col">Stock</th>
                    <th scope="col">Expiry</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody id="inventoryTableBody">
                  <tr>
                    <td colspan="7" class="inventory-empty">Loading inventory records...</td>
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

  <div class="modal fade" id="medicineModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="medicineModalTitle">Add Medicine Record</h5>
            <p class="inventory-modal-subtitle mb-0" id="medicineModalSubtitle">Create a new inventory record for RHU medicine stock.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="medicineForm" class="inventory-form-grid">
            <input type="hidden" id="medicineId">

            <div>
              <label for="medicineName" class="form-label">Medicine Name</label>
              <input type="text" id="medicineName" class="form-control" placeholder="Paracetamol" required>
            </div>

            <div>
              <label for="genericName" class="form-label">Generic Name</label>
              <input type="text" id="genericName" class="form-control" placeholder="Acetaminophen" required>
            </div>

            <div>
              <label for="medicineCategory" class="form-label">Medicine Category</label>
              <select id="medicineCategory" class="form-select" required>
                <option value="">Select medicine category</option>
                <option value="Vitamins">Vitamins</option>
                <option value="Antibiotics">Antibiotics</option>
                <option value="Analgesic">Analgesic</option>
                <option value="Antihistamine">Antihistamine</option>
                <option value="Hydration">Hydration</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Respiratory">Respiratory</option>
                <option value="Herbal">Herbal</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div>
              <label for="medicineFormType" class="form-label">Medicine Form</label>
              <select id="medicineFormType" class="form-select" required>
                <option value="">Select medicine form</option>
                <option value="Tablet">Tablet</option>
                <option value="Capsule">Capsule</option>
                <option value="Syrup">Syrup</option>
                <option value="Injection">Injection</option>
                <option value="Sachet">Sachet</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div>
              <label for="medicineStrength" class="form-label">Strength</label>
              <input type="text" id="medicineStrength" class="form-control" placeholder="500mg / 60mL">
            </div>

            <div>
              <label for="medicineUnit" class="form-label">Unit</label>
              <input type="text" id="medicineUnit" class="form-control" placeholder="tablets, capsules, bottles, vials" required>
            </div>

            <div>
              <label for="stockOnHand" class="form-label">Stock On Hand</label>
              <input type="number" id="stockOnHand" class="form-control" min="0" step="1" required>
            </div>

            <div>
              <label for="reorderLevel" class="form-label">Request Alert Level</label>
              <input type="number" id="reorderLevel" class="form-control" min="1" step="1" required>
            </div>

            <div>
              <label for="batchNumber" class="form-label">Batch Number</label>
              <input type="text" id="batchNumber" class="form-control" placeholder="BATCH-2026-001" required>
            </div>

            <div>
              <label for="expiryDate" class="form-label">Expiry Date</label>
                <input type="date" id="expiryDate" class="form-control" required>
              </div>

            <div class="col-span-2 inventory-form-actions">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-save2"></i>Save Record
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="stockActionModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Adjust Stock</h5>
            <p class="inventory-modal-subtitle mb-0" id="stockActionMedicineLabel">Select a medicine to update stock movement.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="stockActionForm" class="inventory-form-grid inventory-form-grid--single">
            <input type="hidden" id="stockMedicineId">

            <div class="inventory-action-note">
              <span>Current Stock</span>
              <strong id="stockCurrentStock">0 units</strong>
            </div>

            <div>
              <label for="stockActionType" class="form-label">Action Type</label>
              <select id="stockActionType" class="form-select" required>
                <option value="restock">Restock</option>
                <option value="dispose">Dispose / Write-off</option>
              </select>
            </div>

            <div>
              <label for="stockActionQuantity" class="form-label">Quantity</label>
              <input type="number" id="stockActionQuantity" class="form-control" min="1" step="1" required>
            </div>

            <div>
              <label for="stockActionDate" class="form-label">Action Date</label>
              <input type="date" id="stockActionDate" class="form-control" required>
            </div>

            <div class="col-span-2" id="stockLinkedRequestGroup">
              <label for="stockLinkedRequestId" class="form-label">Linked to Request</label>
              <select id="stockLinkedRequestId" class="form-select">
                <option value="">Not linked to a CHO request</option>
              </select>
              <small class="inventory-field-hint" id="stockLinkedRequestHint">Choose an open CHO request for this medicine when receiving a delivery.</small>
            </div>

            <div class="col-span-2 d-none" id="stockActionNoteGroup">
              <label for="stockActionNote" class="form-label" id="stockActionNoteLabel">Notes (Optional)</label>
              <textarea id="stockActionNote" class="form-control" rows="3" placeholder="Source or optional note"></textarea>
            </div>

            <div class="col-span-2 inventory-form-actions">
              <button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">
                <i class="bi bi-check2-circle"></i>Apply Action
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="recordStatusModal" tabindex="-1" aria-labelledby="recordStatusModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal inventory-confirm-modal">
        <button type="button" class="btn-close ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
        <div class="modal-icon mb-3">
          <div class="inventory-confirm-modal__icon inventory-confirm-modal__icon--archive" id="recordStatusModalIcon" aria-hidden="true">
            <i class="bi bi-archive-fill" id="recordStatusModalIconGlyph"></i>
          </div>
        </div>
        <h5 class="modal-title mb-2 text-center" id="recordStatusModalTitle">Archive medicine record?</h5>
        <p class="inventory-confirm-modal__copy" id="recordStatusModalMessage">This medicine will be hidden from the active inventory list and request workflows.</p>
        <p class="inventory-confirm-modal__hint mb-0" id="recordStatusModalHint">You can restore it later from the Archived filter.</p>
        <div class="inventory-confirm-modal__actions">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="recordStatusModalConfirmBtn">Archive</button>
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
  <script src="assets/js/medicine-inventory.js?v=<?= urlencode($medicineInventoryJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js"></script>
</body>
</html>
