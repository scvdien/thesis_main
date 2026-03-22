<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$settingsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/settings.css');
$settingsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/settings.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Settings - Ligao City Coastal RHU</title>
  <script>
    (() => {
      const validPanels = new Set(["nurse-credentials", "manage-staff", "active-users", "activity-logs"]);
      const hashedPanel = (window.location.hash || "").replace(/^#/, "");
      const initialPanel = validPanels.has(hashedPanel) ? hashedPanel : "nurse-credentials";
      document.documentElement.classList.add("settings-panel-booting");
      document.documentElement.setAttribute("data-settings-initial-panel", initialPanel);
    })();
  </script>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css">
  <link rel="stylesheet" href="assets/css/settings.css?v=<?= urlencode($settingsCssVersion) ?>">
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
          <a href="medicine-inventory.php"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php" class="active"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main" class="accounts-main settings-main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div>
              <h4 class="mb-0 text-primary">Settings</h4>
            </div>
          </div>
        </div>

        <div id="moduleAlert" class="settings-floating-notice" role="status" aria-live="polite" aria-hidden="true">
          <div class="settings-floating-notice__icon" id="moduleAlertIcon" aria-hidden="true">
            <i class="bi bi-check2-circle"></i>
          </div>
          <div class="settings-floating-notice__message" id="moduleAlertText">Action completed successfully.</div>
        </div>

        <div class="settings-shell">
          <aside class="card-shell settings-nav">
            <div class="settings-nav-group">
              <div class="settings-nav-title">Account</div>
              <a href="#nurse-credentials" class="active"><i class="bi bi-shield-lock"></i>Admin Credentials</a>
            </div>
            <div class="settings-nav-group">
              <div class="settings-nav-title">Administration</div>
              <a href="#manage-staff"><i class="bi bi-person-badge"></i>Manage BHW</a>
            </div>
            <div class="settings-nav-group">
              <div class="settings-nav-title">Monitoring</div>
              <a href="#active-users"><i class="bi bi-people"></i>Active Users</a>
              <a href="#activity-logs"><i class="bi bi-clock-history"></i>Logs</a>
            </div>
          </aside>

          <div class="settings-content">
            <section class="card-shell settings-panel settings-panel--credentials is-active" id="nurse-credentials">
              <div class="nurse-credentials-summary" id="nurseCredentialsSummary">
                <div class="section-head section-head-split">
                  <div>
                    <h5>Admin Credentials</h5>
                  </div>
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="badge bg-success-subtle text-success credentials-badge">Security</span>
                    <button type="button" class="btn btn-outline-success credentials-start-btn" id="nurseCredentialsStartBtn">
                      <i class="bi bi-key"></i>Change Credentials
                    </button>
                  </div>
                </div>
              </div>

              <div id="nurseCredentialsPanel" class="d-none">
                <div class="section-head section-head-split nurse-credentials-editor-head">
                  <div>
                    <h5>Change Admin Credentials</h5>
                  </div>
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <span class="badge bg-success-subtle text-success credentials-badge">Security</span>
                  </div>
                </div>
                <form id="nurseSettingsForm" class="account-form-grid" autocomplete="off">
                  <div>
                    <label for="nurseFullName" class="form-label">Full Name</label>
                    <input type="text" id="nurseFullName" class="form-control" placeholder="Full name" required>
                  </div>
                  <div>
                    <label for="nurseRoleDisplay" class="form-label">Role</label>
                    <input type="text" id="nurseRoleDisplay" class="form-control" value="Nurse-in-Charge" readonly>
                  </div>
                  <div>
                    <label for="nurseUsername" class="form-label">Username</label>
                    <input type="text" id="nurseUsername" class="form-control" placeholder="Username" required>
                  </div>
                  <div>
                    <label for="nursePassword" class="form-label">New Password</label>
                    <input type="password" id="nursePassword" class="form-control" placeholder="Enter new password" minlength="8">
                  </div>
                  <div class="account-field-right">
                    <label for="nurseConfirmPassword" class="form-label">Confirm New Password</label>
                    <input type="password" id="nurseConfirmPassword" class="form-control" placeholder="Confirm password" minlength="8">
                  </div>
                  <div class="account-form-actions">
                    <div class="account-helper" id="nurseSettingsNotice">Admin account only.</div>
                    <div class="credentials-editor-actions">
                      <button type="button" class="btn btn-light credentials-cancel-btn" id="nurseCredentialsCancelBtn">Cancel</button>
                      <button type="submit" class="btn btn-create-account">
                        <i class="bi bi-shield-check"></i>Save Credentials
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section class="card-shell settings-panel" id="manage-staff">
              <div class="section-head section-head-split">
                <div>
                  <h5>Create BHW Account</h5>
                  <p>Nurse-in-Charge creates BHW accounts and manages reset or delete actions here.</p>
                </div>
                <span class="badge bg-success-subtle text-success">Create BHW Account</span>
              </div>

              <form id="createAccountForm" class="account-form-grid" autocomplete="off">
                <div>
                  <label for="accountFullName" class="form-label">Full Name</label>
                  <input type="text" id="accountFullName" class="form-control" placeholder="Maria L. Santos" required>
                </div>
                <div>
                  <label for="accountRoleDisplay" class="form-label">Role</label>
                  <input type="text" id="accountRoleDisplay" class="form-control" value="BHW" readonly>
                  <input type="hidden" id="accountRole" value="BHW">
                </div>
                <div>
                  <label for="accountUsername" class="form-label">Username</label>
                  <input type="text" id="accountUsername" class="form-control" placeholder="maria.santos" required>
                </div>
                <div>
                  <label for="accountPassword" class="form-label">Password</label>
                  <input type="password" id="accountPassword" class="form-control" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character." required>
                </div>
                <div>
                  <label for="accountContact" class="form-label">Contact Number</label>
                  <input type="text" id="accountContact" class="form-control" placeholder="09XX-XXX-XXXX" required>
                </div>
                <div>
                  <label for="accountConfirmPassword" class="form-label">Confirm Password</label>
                  <input type="password" id="accountConfirmPassword" class="form-control" placeholder="Re-enter password" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character." required>
                </div>
                <input type="hidden" id="accountType" value="BHW">
                <div class="account-form-actions">
                  <div class="account-helper">Only admin-created BHW accounts will appear in this list.</div>
                  <button type="submit" class="btn btn-create-account">
                    <i class="bi bi-person-check"></i>Create BHW Account
                  </button>
                </div>
              </form>

              <div class="small text-muted mt-2" id="usersListNotice">Manage your BHW accounts here.</div>
              <div class="section-divider"></div>
              <div class="account-list" id="usersList"></div>
            </section>

            <section class="card-shell settings-panel" id="active-users">
              <div class="section-head section-head-split">
                <div>
                  <h5>Active Users</h5>
                  <p>User account presence and currently used modules.</p>
                </div>
                <span class="badge bg-success-subtle text-success" id="activeUsersBadge">0 Online</span>
              </div>
              <div class="settings-list" id="activeUsersList">
                <div class="settings-list-item">
                  <div class="item-info">
                    <div class="fw-semibold">Loading users...</div>
                    <div class="small text-muted">Fetching active account list.</div>
                  </div>
                  <span class="badge bg-secondary-subtle text-secondary">Syncing</span>
                </div>
              </div>
            </section>

            <section class="card-shell settings-panel" id="activity-logs">
              <div class="logs-module">
                <div class="logs-module-header">
                  <div class="logs-title-wrap">
                    <h5 class="mb-1 fw-bold">Activity Logs</h5>
                  </div>
                </div>

                <div class="logs-toolbar" role="search" aria-label="Monitoring log filters">
                  <div class="logs-search-pill">
                    <input
                      type="search"
                      id="activityLogSearch"
                      class="form-control"
                      placeholder="Search action, medicine, or user"
                      autocomplete="off"
                    >
                    <span class="logs-search-icon" aria-hidden="true"><i class="bi bi-search"></i></span>
                  </div>

                  <div class="logs-quick-row">
                    <div class="logs-quick-group">
                      <span class="logs-quick-label">Quick Filter</span>
                      <div class="logs-quick-pills" role="group" aria-label="Monitoring log quick filters">
                        <button type="button" class="logs-quick-pill is-active" data-activity-log-filter="all" aria-pressed="true">All</button>
                        <button type="button" class="logs-quick-pill" data-activity-log-filter="created" aria-pressed="false">Created</button>
                        <button type="button" class="logs-quick-pill" data-activity-log-filter="updated" aria-pressed="false">Updated</button>
                        <button type="button" class="logs-quick-pill" data-activity-log-filter="deleted" aria-pressed="false">Deleted</button>
                        <button type="button" class="logs-quick-pill" data-activity-log-filter="security" aria-pressed="false">Security</button>
                        <button type="button" class="logs-quick-pill" data-activity-log-filter="access" aria-pressed="false">Access</button>
                      </div>
                    </div>
                    <div class="logs-record-inline text-muted small" id="activityLogCount" aria-live="polite">0 records found</div>
                  </div>
                </div>

                <div class="logs-table-shell table-responsive">
                  <table class="table logs-table align-middle mb-0">
                    <colgroup>
                      <col class="logs-col logs-col--datetime">
                      <col class="logs-col logs-col--user">
                      <col class="logs-col logs-col--module">
                      <col class="logs-col logs-col--action">
                      <col class="logs-col logs-col--result">
                      <col class="logs-col logs-col--reference">
                      <col class="logs-col logs-col--details">
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Date &amp; Time</th>
                        <th scope="col">User</th>
                        <th scope="col">Module</th>
                        <th scope="col">Action</th>
                        <th scope="col">Result</th>
                        <th scope="col">Reference</th>
                        <th scope="col">Details</th>
                      </tr>
                    </thead>
                    <tbody id="activityLogTableBody">
                      <tr>
                        <td colspan="7" class="text-center text-muted py-4">Loading activity logs...</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>

    <footer class="footer text-muted">
      &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System. All rights reserved.
    </footer>
  </div>

  <div class="modal fade" id="editUserModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content modern-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <h5 class="modal-title mb-1">View BHW Account</h5>
              <p class="small text-muted mb-0">Review and update BHW account details.</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
        <div class="modal-body">
          <form id="editAccountForm" class="row g-3">
            <input type="hidden" id="editUserId">
            <div class="col-12">
              <label for="editFullName" class="form-label">Full Name</label>
              <input type="text" id="editFullName" class="form-control" required>
            </div>
            <div class="col-md-6">
              <label for="editUsername" class="form-label">Username</label>
              <input type="text" id="editUsername" class="form-control" required>
            </div>
            <div class="col-md-6">
              <label for="editContact" class="form-label">Contact Number</label>
              <input type="text" id="editContact" class="form-control" required>
            </div>
            <div class="col-md-6">
              <label for="editRoleDisplay" class="form-label">Role</label>
              <input type="text" id="editRoleDisplay" class="form-control" readonly>
              <input type="hidden" id="editRole">
              <input type="hidden" id="editType" value="BHW">
            </div>
            <div class="col-12 text-end pt-2">
              <button type="button" class="btn btn-light me-2" data-bs-dismiss="modal">Close</button>
              <button type="submit" class="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="changePasswordModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-primary">
          <i class="bi bi-key-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Reset BHW Credentials</h5>
        <p class="mb-3 text-muted">Set a new temporary username and password. BHW must change them after the next login.</p>
        <form id="changePasswordForm">
          <input type="hidden" id="passwordUserId">
          <div class="settings-form-grid text-start">
            <div class="settings-form-full">
              <label for="resetFullName" class="form-label small">BHW Account</label>
              <input type="text" id="resetFullName" class="form-control" readonly>
            </div>
            <div>
              <label for="resetUsername" class="form-label small">Temporary Username</label>
              <input type="text" id="resetUsername" class="form-control" placeholder="maria.santos" required>
            </div>
            <div>
              <label for="newPassword" class="form-label small">Temporary Password</label>
              <input type="password" id="newPassword" class="form-control" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character." required>
            </div>
            <div class="settings-form-full">
              <label for="confirmNewPassword" class="form-label small">Confirm Temporary Password</label>
              <input type="password" id="confirmNewPassword" class="form-control" placeholder="Re-type temporary password" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character." required>
            </div>
          </div>
          <div class="small text-muted mt-3" id="resetCredentialsNotice">Temporary credentials are never shown again after this reset.</div>
          <div class="d-flex justify-content-center gap-2 flex-wrap mt-4">
            <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
            <button type="submit" class="btn btn-primary btn-modern">
              <i class="bi bi-check2-circle"></i> Save New Credentials
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <div class="modal fade" id="confirmAccountActionModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-warning">
          <i class="bi bi-exclamation-circle-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2" id="confirmAccountActionTitle">Confirm Action</h5>
        <p class="mb-3 text-muted" id="confirmAccountActionMessage">Are you sure you want to continue?</p>
        <div class="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-warning btn-modern" id="confirmAccountActionBtn">Continue</button>
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
  <script src="assets/js/settings.js?v=<?= urlencode($settingsJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js"></script>
</body>
</html>
