<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$adminDashboardCssVersion = (string) @filemtime(__DIR__ . '/assets/css/admin-dashboard.css');
$medicineInventoryCssVersion = (string) @filemtime(__DIR__ . '/assets/css/medicine-inventory.css');
$systemNotificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/system-notifications.css');
$medicineInventoryJsVersion = (string) @filemtime(__DIR__ . '/assets/js/medicine-inventory.js');
$supplyMonitoringJsVersion = (string) @filemtime(__DIR__ . '/assets/js/supply-monitoring.js');
$systemNotificationsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/system-notifications.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Medicine Inventory - Ligao City Coastal RHU</title>
  <link rel="icon" type="image/png" href="assets/img/CityHealthOffice_LOGO.png">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css?v=<?= urlencode($adminDashboardCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/medicine-inventory.css?v=<?= urlencode($medicineInventoryCssVersion) ?>">
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
          <a href="medicine-inventory.php" class="active"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Log out</a>
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
                <option value="Analgesic">Analgesic / Antipyretic (Pain & Fever)</option>
                <option value="Antibiotics">Antibiotics</option>
                <option value="Antihistamine">Antihistamine (Anti-Allergy & Cold)</option>
                <option value="Respiratory">Respiratory / Cough Remedies</option>
                <option value="Gastrointestinal">Antacid & Gastrointestinal (Acid & Ulcer)</option>
                <option value="Hydration">Hydration & Antidiarrheal (ORS & Diarrhea)</option>
                <option value="Anthelmintic">Anthelmintic (Deworming / Pampurga)</option>
                <option value="Antihypertensive">Antihypertensive (Blood Pressure Maintenance)</option>
                <option value="Antidiabetic">Antidiabetic (Blood Sugar Maintenance)</option>
                <option value="Lipid-Lowering">Lipid-Lowering (Cholesterol Maintenance)</option>
                <option value="Maintenance">General Maintenance</option>
                <option value="Vitamins">Vitamins & Mineral Supplements</option>
                <option value="Maternal">Maternal & Prenatal Care (Iron & Folic)</option>
                <option value="Topical">Topical & Dermatological (Skin Ointments)</option>
                <option value="Eye & Ear">Eye & Ear Drops</option>
                <option value="Family Planning">Family Planning Supplies</option>
                <option value="Herbal">Herbal Medicine</option>
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
                <option value="Inhaler">Inhaler</option>
                <option value="Injection">Injection</option>
                <option value="Cream">Cream</option>
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
              <div id="stockOnHandDisplay" class="stock-stat-card d-none">
                <div class="d-flex align-items-center justify-content-between w-100">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-box-seam text-primary"></i>
                    <strong class="text-dark" id="stockOnHandDisplayValue">-</strong>
                  </div>
                  <span class="badge bg-light text-secondary border fw-normal" style="font-size: 0.7rem;">Active Total</span>
                </div>
              </div>
            </div>

            <div>
              <label for="reorderLevel" class="form-label">Request Alert Level</label>
              <input type="number" id="reorderLevel" class="form-control" min="1" step="1" required>
            </div>

            <div id="medicineModalBatchNumberGroup">
              <label for="batchNumber" class="form-label">Batch Number</label>
              <input type="text" id="batchNumber" class="form-control" placeholder="BATCH-2026-001" required>
            </div>

            <div id="medicineModalExpiryDateGroup">
              <label for="expiryDate" class="form-label">Expiry Date</label>
              <input type="date" id="expiryDate" class="form-control" required>
            </div>

            <div id="medicineModalMultiBatchBanner" class="col-span-2 d-none">
              <div class="multi-batch-inline-note">
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-info-circle-fill text-primary flex-shrink-0"></i>
                  <span class="small text-secondary">
                    Tracked across <strong id="medicineModalBatchCount" class="text-dark fw-semibold">2 active batches</strong> with separate expiry dates.
                  </span>
                </div>
                <button type="button" class="btn btn-sm btn-outline-primary multi-batch-manage-btn" id="medicineModalManageBatchesBtn">
                  <i class="bi bi-layers me-1"></i>Manage Batches
                </button>
              </div>
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

  <div class="modal fade" id="stockActionModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
    <div class="modal-dialog modal-dialog-centered stock-action-dialog">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="stockActionModalTitle">Receive or Adjust Stock</h5>
            <p class="inventory-modal-subtitle mb-0" id="stockActionMedicineLabel">Select a medicine to update stock movement.</p>
          </div>
          <button type="button" class="btn-close" id="stockActionCloseBtn" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="stockActionForm" class="inventory-form-grid inventory-form-grid--single" novalidate>
            <input type="hidden" id="stockMedicineId">

            <div class="stock-action-overview">
              <div class="stock-action-overview__field">
                <span class="form-label d-block">Current stock</span>
                <div class="inventory-action-note stock-action-current">
                  <span class="stock-action-current__icon" aria-hidden="true"><i class="bi bi-box-seam"></i></span>
                  <strong id="stockCurrentStock">0 units</strong>
                </div>
              </div>

              <div class="stock-action-overview__field">
                <label for="stockActionType" class="form-label">Action type</label>
                <div class="stock-action-type-control">
                  <i id="stockActionTypeIcon" class="bi bi-box-arrow-in-down stock-action-type-icon" aria-hidden="true"></i>
                  <select id="stockActionType" class="form-select" required>
                    <option value="restock">Restock</option>
                    <option value="dispose">Dispose / Write-off</option>
                  </select>
                  <i class="bi bi-chevron-down stock-action-type-chevron" aria-hidden="true"></i>
                </div>
              </div>
            </div>

            <section id="stockRestockFlow" class="stock-restock-flow">
              <div id="stockRestockSourceGroup">
                <span class="form-label d-block">Restock source</span>
                <div class="stock-source-toggle" role="radiogroup" aria-label="Restock source">
                  <input type="radio" class="btn-check" name="stockRestockSource" id="stockRestockSourceCho" value="cho" autocomplete="off">
                  <label for="stockRestockSourceCho">
                    <i class="bi bi-truck" aria-hidden="true"></i>
                    <span>CHO Request</span>
                  </label>

                  <input type="radio" class="btn-check" name="stockRestockSource" id="stockRestockSourceManual" value="manual" autocomplete="off" checked>
                  <label for="stockRestockSourceManual">
                    <i class="bi bi-box-arrow-in-down" aria-hidden="true"></i>
                    <span>Manual Restock</span>
                  </label>
                </div>
                <small class="inventory-field-hint" id="stockRestockSourceHint">Choose where this stock came from.</small>
              </div>

              <div id="stockLinkedRequestGroup" class="d-none">
                <label for="stockLinkedRequestId" class="form-label">CHO request</label>
                <select id="stockLinkedRequestId" class="form-select">
                  <option value="">Select an open CHO request</option>
                </select>
                <small class="inventory-field-hint" id="stockLinkedRequestHint">Only open requests for this medicine are shown.</small>

                <article id="stockLinkedRequestCard" class="stock-linked-request-card d-none" aria-live="polite">
                  <div class="stock-linked-request-card__head">
                    <div>
                      <span>Selected request</span>
                      <strong id="stockLinkedRequestCode">-</strong>
                    </div>
                    <span class="stock-request-status" id="stockLinkedRequestStatus">Pending</span>
                  </div>
                  <div class="stock-linked-request-metrics">
                    <div>
                      <span>Requested</span>
                      <strong id="stockLinkedRequestedQuantity">0</strong>
                    </div>
                    <div>
                      <span>Received</span>
                      <strong id="stockLinkedReceivedQuantity">0</strong>
                    </div>
                    <div class="stock-linked-request-metrics__remaining">
                      <span>Remaining</span>
                      <strong id="stockLinkedRemainingQuantity">0</strong>
                    </div>
                  </div>
                  <div class="stock-linked-request-card__footer">
                    <i class="bi bi-calendar-event" aria-hidden="true"></i>
                    Expected delivery: <strong id="stockLinkedExpectedDate">-</strong>
                  </div>
                </article>
              </div>
            </section>

            <div id="stockActionQuantityGroup">
              <label for="stockActionQuantity" class="form-label" id="stockActionQuantityLabel">Restock quantity</label>
              <div class="stock-action-quantity-field">
                <input type="number" id="stockActionQuantity" class="form-control" min="1" step="1" inputmode="numeric" placeholder="Enter quantity" required>
                <span id="stockActionQuantityUnit">units</span>
              </div>
            </div>

            <section id="stockDisposeBatchSection" class="stock-dispose-section d-none">
              <div class="stock-dispose-head d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <div>
                  <span class="form-label d-block mb-0">Select Batches to Dispose</span>
                  <small class="text-muted">Choose which batches to write off and specify quantity.</small>
                </div>
                <button type="button" class="btn btn-sm btn-outline-danger" id="stockDisposeSelectExpiredBtn">
                  <i class="bi bi-clock-history me-1"></i>Select Expired Batches
                </button>
              </div>

              <div class="table-responsive stock-dispose-table-wrap mb-2">
                <table class="table align-middle stock-dispose-table mb-0">
                  <thead>
                    <tr>
                      <th scope="col" class="text-center" style="width: 38px;">
                        <input type="checkbox" class="form-check-input" id="stockDisposeSelectAllCheck" title="Select all batches">
                      </th>
                      <th scope="col">Batch No.</th>
                      <th scope="col">Expiry</th>
                      <th scope="col" class="text-end">Available</th>
                      <th scope="col" style="width: 130px;" class="text-end">Dispose Qty</th>
                    </tr>
                  </thead>
                  <tbody id="stockDisposeBatchTableBody">
                    <tr>
                      <td colspan="5" class="text-center text-muted py-3">No active batches available.</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div id="stockDisposeSummary" class="stock-dispose-summary mb-1">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div>
                    <span class="text-muted small">Total to dispose:</span>
                    <strong class="text-danger ms-1 fs-6" id="stockDisposeTotalCount">0</strong>
                    <span class="text-muted small ms-1" id="stockDisposeTotalUnit">units</span>
                    <span class="badge bg-light text-secondary border ms-2" id="stockDisposeBatchCountBadge">0 batches</span>
                  </div>
                  <div>
                    <span class="text-muted small">Stock after disposal:</span>
                    <strong class="text-primary ms-1 fs-6" id="stockDisposeRemainingStock">0</strong>
                  </div>
                </div>
              </div>
            </section>

            <div id="stockActionPreview" class="stock-action-preview d-none" aria-live="polite">
              <span class="stock-action-preview__icon"><i class="bi bi-arrow-up-right" aria-hidden="true"></i></span>
              <div>
                <strong id="stockActionPreviewTitle">Stock after restock: 0 units</strong>
                <span id="stockActionPreviewText">Enter a quantity to preview this action.</span>
              </div>
            </div>

            <div>
              <label for="stockActionDate" class="form-label" id="stockActionDateLabel">Restock date</label>
              <input type="date" id="stockActionDate" class="form-control" required>
            </div>

            <div id="stockActionBatchGroup">
              <div class="row g-2">
                <div class="col-sm-6">
                  <label for="stockActionBatchNumber" class="form-label" id="stockActionBatchNumberLabel">Batch / Lot Number</label>
                  <input type="text" id="stockActionBatchNumber" class="form-control" placeholder="e.g. BATCH-2026-002">
                  <small class="inventory-field-hint" id="stockActionBatchHint">Lot/batch number (Leave blank to auto-generate for donations)</small>
                </div>
                <div class="col-sm-6">
                  <label for="stockActionExpiryDate" class="form-label" id="stockActionExpiryDateLabel">Expiration Date</label>
                  <input type="date" id="stockActionExpiryDate" class="form-control">
                  <small class="inventory-field-hint">Expiry date of this delivery</small>
                </div>
              </div>
            </div>

            <div class="d-none" id="stockActionNoteGroup">
              <label for="stockActionNote" class="form-label" id="stockActionNoteLabel">Source / notes (optional)</label>
              <textarea id="stockActionNote" class="form-control" rows="2" placeholder="Supplier, delivery reference, or optional note"></textarea>
            </div>

            <div id="stockActionFeedback" class="stock-action-feedback d-none" role="alert"></div>

            <div class="inventory-form-actions stock-action-form-actions">
              <button type="button" class="btn btn-light" id="stockActionCancelBtn" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="stockActionSubmitBtn">
                <i class="bi bi-check2-circle"></i><span id="stockActionSubmitLabel">Add Stock</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="batchDetailsModal" tabindex="-1" aria-labelledby="batchDetailsModalTitle" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="batchDetailsModalTitle">Batch Details</h5>
            <p class="inventory-modal-subtitle mb-0" id="batchDetailsModalSubtitle">Active batches sorted by earliest expiration date.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="batch-modal-summary mb-3 p-3 rounded bg-light border d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div>
              <h6 class="mb-0 fw-bold" id="batchDetailsMedicineName">-</h6>
              <span class="text-muted small" id="batchDetailsMedicineMeta">-</span>
            </div>
            <div class="text-end">
              <span class="text-muted small d-block">Total Stock</span>
              <strong class="batch-modal-total-stock" id="batchDetailsTotalStock">0</strong>
            </div>
          </div>

          <div class="d-flex flex-wrap justify-content-between align-items-center mb-2 px-1 gap-2" id="batchDetailsExhaustedToggleContainer">
            <span class="text-muted small" id="batchDetailsCountHint">Record: 0</span>
            <button type="button" class="btn btn-batch-action btn-batch-action--outline" id="batchHistoryToggleBtn">
              <i class="bi bi-clock-history" id="batchHistoryToggleIcon"></i>
              <span id="batchHistoryToggleLabel">Batch History</span>
            </button>
          </div>

          <div class="table-responsive">
            <table class="table align-middle batch-details-table mb-0">
              <thead>
                <tr>
                  <th scope="col" class="text-nowrap">Priority</th>
                  <th scope="col" class="text-nowrap">Batch No.</th>
                  <th scope="col" class="text-nowrap">Expiration</th>
                  <th scope="col" class="text-nowrap">Remaining</th>
                  <th scope="col" class="text-nowrap">Source</th>
                  <th scope="col" class="text-nowrap">Status</th>
                  <th scope="col" class="text-nowrap text-end" style="width: 80px;">Action</th>
                </tr>
              </thead>
              <tbody id="batchDetailsTableBody">
                <tr>
                  <td colspan="7" class="text-center text-muted py-3">Loading batch details...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <small class="text-muted"><i class="bi bi-info-circle text-success me-1"></i>Earliest expiring batch is dispensed first.</small>
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="disposeConfirmModal" tabindex="-1" aria-labelledby="disposeConfirmModalTitle" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal inventory-confirm-modal">
        <button type="button" class="btn-close ms-auto" data-bs-dismiss="modal" aria-label="Close"></button>
        <div class="modal-icon mb-3">
          <div class="inventory-confirm-modal__icon inventory-confirm-modal__icon--danger" id="disposeConfirmModalIcon" aria-hidden="true">
            <i class="bi bi-trash3-fill"></i>
          </div>
        </div>
        <h5 class="modal-title mb-2 text-center" id="disposeConfirmModalTitle">Confirm Stock Disposal?</h5>
        <p class="inventory-confirm-modal__copy mb-3 text-center" id="disposeConfirmModalMessage">
          Review the medicine and batches to be written off. This action cannot be undone.
        </p>

        <div class="dispose-confirm-card mb-3 p-3 rounded-3 text-start border bg-light" id="disposeConfirmDetails">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Medicine:</span>
            <strong id="disposeConfirmMedicineName">-</strong>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Total to Dispose:</span>
            <strong class="text-danger fs-6" id="disposeConfirmTotalQty">-</strong>
          </div>
          <div class="mb-2">
            <span class="text-muted small d-block mb-1">Batches to be written off:</span>
            <div class="dispose-confirm-batch-list small p-2 bg-white border rounded" id="disposeConfirmBatchList">
              <!-- Injected batch rows -->
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-muted small">Disposal Reason:</span>
            <span class="fw-semibold text-dark text-break small" id="disposeConfirmReason">-</span>
          </div>
          <div class="d-flex justify-content-between align-items-center pt-2 border-top">
            <span class="text-muted small">Stock Adjustment:</span>
            <span class="small fw-bold" id="disposeConfirmStockAdjustment">0 → 0</span>
          </div>
        </div>

        <div class="inventory-confirm-modal__actions">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="disposeConfirmSubmitBtn">
            <i class="bi bi-trash3-fill me-1"></i>Confirm Disposal
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="editBatchModal" tabindex="-1" aria-labelledby="editBatchModalTitle" aria-hidden="true" data-bs-backdrop="static">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1" id="editBatchModalTitle">Edit Batch Details</h5>
            <p class="inventory-modal-subtitle mb-0" id="editBatchModalSubtitle">Update batch number and expiration date.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="editBatchForm" novalidate>
            <input type="hidden" id="editBatchMedicineId">
            <input type="hidden" id="editBatchId">

            <div class="p-3 mb-3 rounded-3 bg-light border">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="text-muted small">Medicine:</span>
                <strong id="editBatchMedicineName">-</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="text-muted small">Remaining in Batch:</span>
                <strong class="text-primary" id="editBatchQuantity">-</strong>
              </div>
              <div class="d-flex justify-content-between align-items-center">
                <span class="text-muted small">Batch Source:</span>
                <span class="small text-muted" id="editBatchSource">-</span>
              </div>
            </div>

            <div class="mb-3">
              <label for="editBatchNumber" class="form-label">Batch / Lot Number</label>
              <input type="text" id="editBatchNumber" class="form-control" placeholder="e.g. BATCH-2026-001" required>
            </div>

            <div class="mb-3">
              <label for="editBatchExpiryDate" class="form-label">Expiration Date</label>
              <input type="date" id="editBatchExpiryDate" class="form-control" required>
            </div>

            <div id="editBatchFeedback" class="alert alert-danger d-none py-2 mb-3 small" role="alert"></div>

            <div class="inventory-form-actions">
              <button type="button" class="btn btn-light" id="editBatchCancelBtn" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="editBatchSubmitBtn">
                <i class="bi bi-save2 me-1"></i>Save Changes
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
  <script src="assets/js/session-heartbeat.js?v=20260820-presence"></script>
  <script src="assets/js/supply-monitoring.js?v=<?= urlencode($supplyMonitoringJsVersion) ?>"></script>
  <script src="assets/js/medicine-inventory.js?v=<?= urlencode($medicineInventoryJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js?v=<?= urlencode($systemNotificationsJsVersion) ?>"></script>
</body>
</html>
