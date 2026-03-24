<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['staff']);
$adminDashboardCssVersion = (string) @filemtime(__DIR__ . '/assets/css/admin-dashboard.css');
$notificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/notifications.css');
$staffCssVersion = (string) @filemtime(__DIR__ . '/assets/css/staff.css');
$systemNotificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/system-notifications.css');
$staffJsVersion = (string) @filemtime(__DIR__ . '/assets/js/staff.js');
$systemNotificationsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/system-notifications.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Barangay Health Worker Dashboard - Ligao City Coastal RHU</title>
  <script>
    (() => {
      const validSections = new Set(["staff-dashboard", "patient-profiles", "dispense-medicine", "notifications", "my-settings"]);
      const hashedSection = (window.location.hash || "").replace(/^#/, "");
      const initialSection = validSections.has(hashedSection) ? hashedSection : "staff-dashboard";
      document.documentElement.classList.add("staff-section-booting");
      document.documentElement.setAttribute("data-staff-initial-section", initialSection);
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css?v=<?= urlencode($adminDashboardCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/notifications.css?v=<?= urlencode($notificationsCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/staff.css?v=<?= urlencode($staffCssVersion) ?>">
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
          <a href="#staff-dashboard" class="active"><i class="bi bi-speedometer2"></i>Dashboard</a>
          <a href="#patient-profiles"><i class="bi bi-person-vcard"></i>Patient Profiles</a>
          <a href="dispensing-records.php?role=staff"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="#notifications" id="staffSidebarNotifications"><i class="bi bi-bell"></i>Notifications<span class="staff-notification-badge d-none" id="staffSidebarNotificationBadge">0</span></a>
          <a href="#my-settings"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main" class="staff-main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="page-intro">
              <h4 class="mb-0 text-primary">Barangay Health Worker Dashboard</h4>
            </div>
          </div>
        </div>

        <div id="moduleAlert" class="alert d-none" role="alert"></div>

        <section class="staff-workspace">
          <section class="staff-panel staff-content-panel is-active" id="staff-dashboard" data-staff-section="staff-dashboard">
            <div class="staff-panel__head staff-panel__head--dashboard">
              <h5>Dashboard</h5>
            </div>

            <section class="staff-dashboard-profile" aria-label="Staff profile">
              <article class="staff-account-btn staff-account-btn--dashboard staff-account-btn--static" aria-label="Staff account summary">
                <span class="staff-account-btn__icon" aria-hidden="true">
                  <i class="bi bi-person-circle"></i>
                </span>
                <span class="staff-account-btn__copy">
                  <small class="staff-account-btn__eyebrow">Staff Profile</small>
                  <strong id="staffAccountName">Staff Account</strong>
                  <small id="staffAccountMeta">Barangay Health Worker</small>
                </span>
                <span class="staff-account-btn__status" id="staffAccountStatus" data-state="online">Online</span>
              </article>
            </section>

            <div class="staff-dashboard-metrics">
              <article class="staff-dashboard-metric staff-dashboard-metric--danger">
                <span class="staff-dashboard-metric__icon" aria-hidden="true">
                  <i class="bi bi-exclamation-diamond"></i>
                </span>
                <div class="staff-dashboard-metric__content">
                  <strong id="dashboardLowCount">0</strong>
                  <span class="staff-dashboard-metric__label">Low / Critical Stock</span>
                </div>
              </article>

              <article class="staff-dashboard-metric staff-dashboard-metric--warning">
                <span class="staff-dashboard-metric__icon" aria-hidden="true">
                  <i class="bi bi-hourglass-split"></i>
                </span>
                <div class="staff-dashboard-metric__content">
                  <strong id="dashboardExpiringCount">0</strong>
                  <span class="staff-dashboard-metric__label">Expiring Soon</span>
                </div>
              </article>

              <article class="staff-dashboard-metric staff-dashboard-metric--accent">
                <span class="staff-dashboard-metric__icon" aria-hidden="true">
                  <i class="bi bi-box2-heart"></i>
                </span>
                <div class="staff-dashboard-metric__content">
                  <strong id="dashboardReleasedToday">0</strong>
                  <span class="staff-dashboard-metric__label">Dispensed Today</span>
                </div>
              </article>

              <article class="staff-dashboard-metric staff-dashboard-metric--neutral">
                <span class="staff-dashboard-metric__icon" aria-hidden="true">
                  <i class="bi bi-people"></i>
                </span>
                <div class="staff-dashboard-metric__content">
                  <strong id="dashboardResidentCount">0</strong>
                  <span class="staff-dashboard-metric__label">Patient Profiles</span>
                </div>
              </article>
            </div>

            <section class="staff-dashboard-panel staff-dashboard-panel--actions">
              <div class="staff-panel__head staff-panel__head--compact">
                <div>
                  <h6>Quick Actions</h6>
                  <p>Start here.</p>
                </div>
              </div>

              <div class="staff-dashboard-actions">
                <button type="button" class="btn btn-light staff-dashboard-action" id="toggleResidentFormBtn">
                  <span class="staff-dashboard-action__icon" aria-hidden="true">
                    <i class="bi bi-person-plus"></i>
                  </span>
                  <span class="staff-dashboard-action__copy">
                    <strong>New Patient</strong>
                    <small>Add profile</small>
                  </span>
                </button>
                <button type="button" class="btn btn-primary staff-dashboard-action" id="dashboardDispenseBtn">
                  <span class="staff-dashboard-action__icon" aria-hidden="true">
                    <i class="bi bi-box-seam"></i>
                  </span>
                  <span class="staff-dashboard-action__copy">
                    <strong>Dispense Medicine</strong>
                    <small>Record entry</small>
                  </span>
                </button>
              </div>
            </section>
          </section>

          <section class="staff-panel staff-content-panel" id="patient-profiles" data-staff-section="patient-profiles">
            <div class="staff-panel__head staff-panel__head--split">
              <div>
                <h5>Patient Profiles</h5>
                <p>View all patients with recorded dispensing history and open their profile details.</p>
              </div>
              <span class="staff-record-count" id="patientProfileCount">0 profiles</span>
            </div>

            <div class="staff-profile-toolbar">
              <div class="staff-account-searchbar staff-account-searchbar--profiles">
                <div class="staff-account-searchbox staff-account-searchbox--profiles">
                  <label class="staff-account-searchfield staff-account-searchfield--profiles" for="patientProfileSearchInput">
                    <input
                      type="search"
                      id="patientProfileSearchInput"
                      class="form-control"
                      placeholder="Search patient name, resident ID, or barangay"
                      autocomplete="off"
                    >
                  </label>
                  <button type="button" class="staff-account-searchbtn staff-account-searchbtn--profiles" id="patientProfileSearchBtn" aria-label="Search patient profiles">
                    <i class="bi bi-search"></i>
                  </button>
                </div>
              </div>
            </div>

            <div class="staff-profile-table">
              <div class="staff-profile-table__head">
                <span>Patient</span>
                <span>Barangay</span>
                <span>Last Medicine</span>
                <span>Last Dispense</span>
                <span>Records</span>
                <span>Action</span>
              </div>

              <div class="staff-profile-results" id="patientProfileList">
                <div class="staff-empty">No patient profiles with dispense records yet.</div>
              </div>
            </div>
          </section>

          <section class="staff-panel staff-content-panel" id="dispense-medicine" data-staff-section="dispense-medicine">
            <div class="staff-panel__head">
              <h5>Dispense Medicine</h5>
              <p>Select the patient, medicine, and case details for this entry.</p>
            </div>

            <form id="dispenseForm" class="staff-form-grid staff-dispense-form" autocomplete="off">
              <section class="col-span-2 staff-dispense-card">
                <div class="staff-dispense-card__head">
                  <div>
                    <h6>Patient</h6>
                    <p>Search the patient first.</p>
                  </div>
                </div>

                <div class="staff-dispense-patient-picker">
                  <div class="staff-dispense-patient-preview d-none" id="dispenseResidentPreview">
                    <strong>Selected Patient</strong>
                    <span></span>
                  </div>

                  <div class="staff-account-searchbox" id="dispenseResidentSearchBox">
                    <label class="staff-account-searchfield" for="dispenseResidentSearch">
                      <input
                        type="search"
                        id="dispenseResidentSearch"
                        class="form-control"
                        placeholder="Search patient name, resident ID, or barangay"
                        autocomplete="off"
                      >
                    </label>
                    <button type="button" class="staff-account-searchbtn" id="dispenseResidentSearchBtn" aria-label="Search existing patient">
                      <i class="bi bi-search"></i>
                    </button>
                  </div>

                  <div class="staff-account-results staff-account-results--compact d-none" id="dispenseResidentResults"></div>
                </div>
              </section>

              <section class="col-span-2 staff-dispense-card" id="dispenseMedicineCard">
                <div class="staff-dispense-card__head">
                  <div>
                    <h6>Medicine Selection</h6>
                    <p>Search and select the medicine.</p>
                  </div>
                </div>

                <div class="staff-medicine-picker">
                  <label class="staff-search staff-search--embedded" for="dispenseMedicineSearch">
                    <i class="bi bi-search"></i>
                    <input
                      type="search"
                      id="dispenseMedicineSearch"
                      class="form-control"
                      placeholder="Search medicine, form, strength, or batch"
                      autocomplete="off"
                    >
                  </label>

                  <select id="dispenseMedicine" class="form-select d-none" aria-hidden="true" tabindex="-1">
                    <option value="">Select medicine</option>
                  </select>

                  <div class="staff-medicine-results" id="dispenseMedicineResults">
                    <div class="staff-empty">Search for the medicine to dispense.</div>
                  </div>

                  <div class="staff-stock-preview" id="dispenseStockPreview">
                    <strong>No medicine selected</strong>
                    <span>Choose a medicine to view stock details.</span>
                  </div>
                </div>
              </section>

              <section class="col-span-2 staff-dispense-card">
                <div class="staff-dispense-card__head">
                  <div>
                    <h6>Case Details</h6>
                    <p>Record the case details.</p>
                  </div>
                </div>

                <div class="staff-dispense-grid">
                  <div class="staff-dispense-field">
                    <label for="dispenseDiseaseCategory" class="form-label">Disease Category</label>
                    <select id="dispenseDiseaseCategory" class="form-select" required>
                      <option value="">Select category</option>
                      <option value="Fever">Fever</option>
                      <option value="Cough / Cold">Cough / Cold</option>
                      <option value="Respiratory">Respiratory</option>
                      <option value="Diarrhea">Diarrhea</option>
                      <option value="Pain / Inflammation">Pain / Inflammation</option>
                      <option value="Hypertension">Hypertension</option>
                      <option value="Diabetes">Diabetes</option>
                      <option value="Skin Disease">Skin Disease</option>
                      <option value="Vitamin / Supplement">Vitamin / Supplement</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <div class="staff-dispense-field">
                    <label for="dispenseIllness" class="form-label">Illness / Complaint</label>
                    <input
                      type="text"
                      id="dispenseIllness"
                      class="form-control"
                      placeholder="e.g. Fever, cough, and headache"
                      required
                    >
                  </div>

                  <div class="staff-dispense-field">
                    <label for="dispenseQuantity" class="form-label">Quantity</label>
                    <input type="number" id="dispenseQuantity" class="form-control" min="1" step="1" required>
                  </div>

                  <div class="staff-dispense-field">
                    <label for="dispenseDate" class="form-label">Date Dispensed</label>
                    <input type="date" id="dispenseDate" class="form-control" required>
                  </div>

                </div>
              </section>

              <div class="col-span-2 staff-form-actions staff-dispense-actions">
                <button type="button" class="btn btn-outline-secondary" id="dispenseCancelBtn">
                  Cancel
                </button>
                <button type="submit" class="btn btn-primary" id="dispenseSubmitBtn">
                  <i class="bi bi-box-seam"></i>Dispense Medicine
                </button>
              </div>
            </form>
          </section>

          <section class="staff-panel staff-content-panel" id="notifications" data-staff-section="notifications">
            <div class="notification-toolbar notification-toolbar--simple notification-toolbar--staff">
              <div class="notification-toolbar__main">
                <div class="notification-filter-groups" aria-label="BHW notification filters">
                  <div class="notification-filter-cluster">
                    <div class="notification-quick-filters" role="group" aria-label="BHW notification types">
                      <button type="button" class="notification-filter-pill is-active" data-staff-notification-type="all" aria-pressed="true">All</button>
                      <button type="button" class="notification-filter-pill" data-staff-notification-type="low-stock" aria-pressed="false">Low Stock</button>
                      <button type="button" class="notification-filter-pill" data-staff-notification-type="out-of-stock" aria-pressed="false">Out of Stock</button>
                      <button type="button" class="notification-filter-pill" data-staff-notification-type="expiring-soon" aria-pressed="false">Expiring Soon</button>
                      <button type="button" class="notification-filter-pill" data-staff-notification-type="critical" aria-pressed="false">Critical</button>
                      <button type="button" class="notification-filter-pill" data-staff-notification-type="resolved" aria-pressed="false">Resolved</button>
                    </div>
                  </div>
                </div>
              </div>

              <div class="notification-toolbar__aside">
                <div class="notification-system-controls" id="notificationSystemControls" aria-label="Notification preferences"></div>
                <span class="notification-record-count" id="staffNotificationCount">0 alerts</span>
              </div>
            </div>

            <div class="notification-feed staff-notification-feed staff-notification-feed--panel" id="staffNotificationFeed">
              <div class="notification-empty">Loading notifications...</div>
            </div>
          </section>

          <section class="staff-panel--settings-shell staff-content-panel" id="my-settings" data-staff-section="my-settings">
            <section class="card-shell staff-credentials-card settings-panel--credentials">
              <div class="staff-credentials-summary" id="settingsSummaryView">
                <div class="section-head section-head-split staff-credentials-card__head">
                  <div>
                    <h5>Staff Credentials</h5>
                  </div>
                  <div class="staff-credentials-card__actions">
                    <span class="badge bg-success-subtle text-success credentials-badge" id="settingsStatusChip">Security</span>
                    <button type="button" class="btn btn-outline-success credentials-start-btn" id="settingsChangeBtn">
                      <i class="bi bi-key"></i>Change Credentials
                    </button>
                  </div>
                </div>
              </div>

              <div class="staff-credentials-panel d-none" id="settingsCredentialsPanel">
                <div class="section-head section-head-split staff-credentials-editor-head">
                  <div>
                    <h5>Change Staff Credentials</h5>
                  </div>
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="badge bg-success-subtle text-success credentials-badge">Security</span>
                  </div>
                </div>

                <form id="settingsForm" class="account-form-grid staff-credentials-form" autocomplete="off">
                  <div>
                    <label for="settingsFullName" class="form-label">Full Name</label>
                    <input type="text" id="settingsFullName" class="form-control" placeholder="Full name" required>
                  </div>

                  <div>
                    <label for="settingsRole" class="form-label">Role</label>
                    <input type="text" id="settingsRole" class="form-control" value="BHW" readonly>
                  </div>

                  <div>
                    <label for="settingsUsername" class="form-label">Username</label>
                    <input type="text" id="settingsUsername" class="form-control" placeholder="Username" required>
                  </div>

                  <div>
                    <label for="settingsPassword" class="form-label">New Password</label>
                    <input type="password" id="settingsPassword" class="form-control" placeholder="Enter new password" minlength="8">
                  </div>

                  <div class="account-field-right">
                    <label for="settingsConfirmPassword" class="form-label">Confirm New Password</label>
                    <input type="password" id="settingsConfirmPassword" class="form-control" placeholder="Confirm password" minlength="8">
                  </div>

                  <div class="account-form-actions">
                    <div class="account-helper" id="settingsNotice">Staff account only.</div>
                    <div class="credentials-editor-actions">
                      <button type="button" class="btn btn-light credentials-cancel-btn" id="settingsCancelBtn">Cancel</button>
                      <button type="submit" class="btn btn-create-account" id="settingsSubmitBtn">
                        <i class="bi bi-shield-check"></i>Save Credentials
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>
          </section>
        </section>
      </main>
    </div>

    <footer class="footer text-muted">
      &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System. All rights reserved.
    </footer>
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

  <div class="modal fade" id="dispenseSuccessModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-success">
          <i class="bi bi-check-circle-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2" id="dispenseSuccessTitle">Medicine Dispensed</h5>
        <p class="mb-0" id="dispenseSuccessBody">The dispensing record was saved successfully.</p>
      </div>
    </div>
  </div>

  <div class="modal fade" id="staffNotificationMessageModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content notification-message-modal">
        <div class="modal-header border-0">
          <div class="notification-message-modal__head">
            <span class="notification-meta-label" id="staffNotificationModalCategory">Medicine Status</span>
            <div class="notification-message-modal__actions">
              <span class="notification-badge notification-badge--info" id="staffNotificationModalPriority">Alert</span>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
        </div>

        <div class="modal-body pt-0">
          <h5 id="staffNotificationModalTitle">Notification</h5>
          <p id="staffNotificationModalBody">Message details will appear here.</p>

          <div class="notification-message-modal__meta">
            <span>Timeline</span>
            <strong id="staffNotificationModalTime">-</strong>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="staffNotificationRemoveModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content notification-confirm-modal notification-confirm-modal--local text-center p-4">
        <div class="notification-confirm-modal__icon notification-confirm-modal__icon--local mb-3 text-success">
          <i class="bi bi-eye-slash fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Remove Notification</h5>
        <p class="mb-3 text-muted" id="staffNotificationRemoveMessage">Remove this resolved notification from your view only?</p>
        <div class="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-success btn-modern" id="confirmStaffNotificationRemoveBtn">Remove</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="residentFormModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered staff-resident-form-dialog">
      <div class="modal-content staff-resident-modal">
        <div class="modal-header border-0">
          <div class="staff-account-modal-copy">
            <h5 class="modal-title mb-0">Add Patient Account</h5>
            <p>Search a Cabarian resident from the household database, or switch to manual entry for walk-in and non-Cabarian patients.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body pt-0">
          <section class="staff-quick-form staff-quick-form--modal">
            <div class="staff-account-mode-switch" role="tablist" aria-label="Patient account source">
              <button
                type="button"
                class="staff-account-mode is-active"
                id="residentModeCabarianBtn"
                data-resident-mode="cabarian"
                aria-pressed="true"
              >
                <i class="bi bi-search"></i>
                <span>Cabarian Search</span>
              </button>
              <button
                type="button"
                class="staff-account-mode"
                id="residentModeManualBtn"
                data-resident-mode="manual"
                aria-pressed="false"
              >
                <i class="bi bi-pencil-square"></i>
                <span>Manual Entry</span>
              </button>
            </div>

            <section class="staff-account-pane" id="residentHouseholdPanel">
              <div class="staff-account-searchbar">
                <div class="staff-account-searchbox">
                  <label class="staff-account-searchfield" for="residentCabarianSearch">
                    <input
                      type="search"
                      id="residentCabarianSearch"
                      class="form-control"
                      placeholder="Search Cabarian resident..."
                      autocomplete="off"
                    >
                  </label>
                  <button type="button" class="staff-account-searchbtn" id="residentCabarianSearchBtn" aria-label="Search Cabarian resident">
                    <i class="bi bi-search"></i>
                  </button>
                </div>
                <span class="staff-record-count" id="residentCabarianCount"></span>
              </div>

              <div class="staff-account-results" id="residentCabarianResults">
                <div class="staff-empty">Search a resident name, resident ID, or household ID to view matches.</div>
              </div>
            </section>

            <section class="staff-account-pane staff-account-pane--manual d-none" id="residentFormPanel">
              <p class="staff-account-pane__copy">Enter the patient details manually for walk-in or non-Cabarian patients who are not in the household system.</p>
              <form id="residentForm" class="staff-form-grid" autocomplete="off">
                <div class="col-span-2">
                  <label for="quickResidentName" class="form-label">Full Name</label>
                  <input type="text" id="quickResidentName" class="form-control" placeholder="Juan Dela Cruz" required>
                </div>

                <div>
                  <label for="quickResidentBarangay" class="form-label">Barangay</label>
                  <input type="text" id="quickResidentBarangay" class="form-control" placeholder="Other barangay or walk-in area" required>
                </div>

                <div>
                  <label for="quickResidentZone" class="form-label">Zone</label>
                  <input type="text" id="quickResidentZone" class="form-control" placeholder="Zone 2">
                </div>

                <div class="col-span-2">
                  <label for="quickResidentCity" class="form-label">City / Municipality</label>
                  <input type="text" id="quickResidentCity" class="form-control" value="Ligao City" placeholder="Ligao City">
                </div>

                <div class="col-span-2 staff-form-actions">
                  <button type="button" class="btn btn-light" id="closeResidentFormBtn" data-bs-dismiss="modal">Cancel</button>
                  <button type="submit" class="btn btn-primary">
                    <i class="bi bi-person-plus"></i>Save Manual Entry
                  </button>
                </div>
              </form>
            </section>
          </section>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="residentSummaryModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content staff-resident-modal">
        <div class="modal-header border-0">
          <div class="staff-account-modal-copy staff-account-modal-copy--compact">
            <h5 class="modal-title mb-0">Patient Profile</h5>
            <p>Summary and dispensing details.</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <div class="modal-body pt-0">
          <article class="staff-selected-resident staff-selected-resident--modal" id="selectedResidentCard">
            <div class="staff-selected-resident__head">
              <div class="staff-selected-resident__identity">
                <span class="staff-selected-resident__avatar" aria-hidden="true">
                  <i class="bi bi-person-vcard"></i>
                </span>
                <div class="staff-selected-resident__copy">
                  <span class="staff-kicker">Patient Profile</span>
                  <h6 id="selectedResidentName">No patient selected</h6>
                  <p id="selectedResidentMeta">Choose a resident from the directory to review patient details.</p>
                </div>
              </div>

              <div class="staff-selected-resident__actions">
                <button type="button" class="btn btn-sm btn-primary staff-selected-resident__use-btn" id="selectedResidentUseBtn" disabled>Use for Dispense</button>
              </div>
            </div>

            <div class="staff-selected-resident__stats">
              <article class="staff-selected-stat">
                <span>Total Dispense Records</span>
                <strong id="selectedResidentReleaseCount">0</strong>
              </article>

              <article class="staff-selected-stat">
                <span>Last Medicine</span>
                <strong id="selectedResidentLastMedicineValue">-</strong>
              </article>

              <article class="staff-selected-stat">
                <span>Last Dispense</span>
                <strong id="selectedResidentLastReleaseValue">-</strong>
              </article>
            </div>
          </article>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script>
    window.MSS_AUTH_USER = <?= json_encode(mss_auth_user_payload($authUser), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script src="assets/js/session-heartbeat.js?v=20260321-presence"></script>
  <script src="assets/js/staff.js?v=<?= urlencode($staffJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js?v=<?= urlencode($systemNotificationsJsVersion) ?>"></script>
</body>
</html>
