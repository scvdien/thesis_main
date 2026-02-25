<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin']);
$authRole = auth_user_role($authUser);
$settingsCsrfToken = auth_csrf_token();
$settingsScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/settings-scripts.js') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Settings | Barangay Captain Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf-token" content="<?= htmlspecialchars($settingsCsrfToken, ENT_QUOTES, 'UTF-8') ?>">

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
        <a href="settings.php" class="active"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger"><i class="bi bi-box-arrow-right"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- MAIN -->
    <main id="main">
      <div class="topbar settings-topbar">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-list toggle-btn" onclick="toggleSidebar()"></i>
          <div>
            <h4 class="mb-0 text-primary">Settings</h4>
          </div>
        </div>
        <div class="d-flex align-items-center gap-2 flex-wrap"></div>
      </div>

      <div class="settings-shell">
        <aside class="settings-nav">
          <div class="settings-nav-group">
            <div class="settings-nav-title">Account</div>
            <a class="active" href="#change-password" data-role="captain-only"><i class="bi bi-shield-lock"></i>Captain Credentials</a>
            <a class="active" href="#admin-credentials" data-role="admin-only"><i class="bi bi-shield-lock"></i>Admin Credentials</a>
          </div>
          <div class="settings-nav-group">
            <div class="settings-nav-title">Administration</div>
            <a href="#admin-account" data-role="captain-only"><i class="bi bi-person-badge"></i>Admin Account</a>
            <a href="#create-staff-account" data-role="admin-only"><i class="bi bi-people"></i>Manage Staff</a>
          </div>
          <div class="settings-nav-group" data-role="captain-only">
            <div class="settings-nav-title">Users</div>
            <a href="#active-users"><i class="bi bi-people"></i>Active Users</a>
          </div>
          <div class="settings-nav-group" data-role="captain-only">
            <div class="settings-nav-title">Governance</div>
            <a href="#barangay-profile"><i class="bi bi-building"></i>Barangay Profile</a>
          </div>
          <div class="settings-nav-group" data-role="captain-only">
            <div class="settings-nav-title">Compliance</div>
              <a href="#audit-trail"><i class="bi bi-clock-history"></i>Logs</a>
          </div>
          <div class="settings-nav-group" data-role="captain-only">
            <div class="settings-nav-title">Data</div>
            <a href="#backup-restore"><i class="bi bi-cloud-arrow-up"></i>Backup & Restore</a>
          </div>
        </aside>

        <div class="settings-content">
          <section class="settings-section settings-panel is-active" style="--delay:0s" id="change-password" data-role="captain-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Captain Credentials</h5>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-primary-subtle text-primary">Security</span>
                <button type="button" class="btn btn-cta d-none" id="captainCredentialsStartBtn">
                  <i class="bi bi-key"></i> Change Credentials
                </button>
              </div>
            </div>
            <div class="collapse show" id="captainCredentialsForm">
              <div class="settings-form-grid">
                <div>
                  <label class="form-label small">Current Username</label>
                  <input type="text" class="form-control" id="captainCredentialsCurrentUsername" placeholder="Enter current username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
                </div>
                <div>
                  <label class="form-label small">Current Password</label>
                  <input type="password" class="form-control" id="captainCredentialsCurrentPassword" placeholder="Enter current password" minlength="8" title="Minimum 8 characters.">
                </div>
                <div>
                  <label class="form-label small">New Username</label>
                  <input type="text" class="form-control" id="captainCredentialsNewUsername" placeholder="Enter new username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
                </div>
                <div>
                  <label class="form-label small">New Password</label>
                  <input type="password" class="form-control" id="captainCredentialsNewPassword" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character.">
                </div>
                <div>
                  <label class="form-label small">Confirm Password</label>
                  <input type="password" class="form-control" id="captainCredentialsConfirmPassword" placeholder="Re-type password" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character.">
                </div>
                <div class="settings-form-full d-flex justify-content-end">
                  <button type="button" class="btn btn-cta" id="captainCredentialsSaveBtn">
                    <i class="bi bi-check2-circle"></i> Save Changes
                  </button>
                </div>
              </div>
            </div>
            <div class="small text-muted mt-3" id="captainCredentialsNotice">Enter your current credentials to update your account.</div>
          </section>

          <section class="settings-section settings-panel is-active" style="--delay:0.02s" id="admin-credentials" data-role="admin-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Admin Credentials</h5>
                <p class="small text-muted mb-0 d-none" id="adminCredentialsTemporaryHint">Use your temporary credentials first, then set your own username and password.</p>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-primary-subtle text-primary">Security</span>
                <button type="button" class="btn btn-cta d-none" id="adminCredentialsStartBtn">
                  <i class="bi bi-key"></i> Change Credentials
                </button>
              </div>
            </div>
            <div class="collapse show" id="adminCredentialsForm">
              <div class="settings-form-grid">
              <div>
                <label class="form-label small">Current Username</label>
                <input type="text" class="form-control" id="adminCredentialsCurrentUsername" placeholder="Enter current username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
              </div>
              <div>
                <label class="form-label small">Current Password</label>
                <input type="password" class="form-control" id="adminCredentialsCurrentPassword" placeholder="Enter current password" minlength="8" title="Minimum 8 characters.">
              </div>
              <div>
                <label class="form-label small">New Username</label>
                <input type="text" class="form-control" id="adminCredentialsNewUsername" placeholder="Enter new username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false">
              </div>
              <div>
                <label class="form-label small">New Password</label>
                <input type="password" class="form-control" id="adminCredentialsNewPassword" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character.">
              </div>
              <div>
                <label class="form-label small">Confirm Password</label>
                <input type="password" class="form-control" id="adminCredentialsConfirmPassword" placeholder="Re-type password" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character.">
              </div>
              <div class="settings-form-full d-flex justify-content-end">
                <button type="button" class="btn btn-cta" id="adminCredentialsSaveBtn">
                  <i class="bi bi-check2-circle"></i> Save Changes
                </button>
              </div>
              </div>
            </div>
            <div class="small text-muted mt-3" id="adminCredentialsNotice">Enter your current temporary credentials to continue.</div>
          </section>

          <div class="settings-panel settings-panel-stack admin-account" style="--delay:0.05s" id="admin-account" data-role="captain-only">
            <section class="settings-section">
              <div class="settings-section-head">
                <div>
                  <h5 class="mb-1">Create Admin Account</h5>
                  <p class="small text-muted mb-0">Set temporary username and password for admin access.</p>
                </div>
                <div class="d-flex align-items-center gap-2">
                  <span class="badge bg-warning-subtle text-warning">One-Time</span>
                  <span class="badge bg-secondary-subtle text-secondary">1 Admin Only</span>
                </div>
              </div>
              <div class="settings-form-grid admin-create-fields">
                <div>
                  <label class="form-label small">Full Name</label>
                  <input type="text" class="form-control" id="adminAccountCreateFullName" placeholder="Juan Dela Cruz">
                </div>
                <div>
                  <label class="form-label small">Role</label>
                  <select class="form-select" id="adminAccountCreateRole" disabled>
                    <option>Admin</option>
                  </select>
                </div>
                <div>
                  <label class="form-label small">Temporary Username</label>
                  <input type="text" class="form-control" id="adminAccountCreateUsername" placeholder="admin.cabarian">
                </div>
                <div>
                  <label class="form-label small">Temporary Password</label>
                  <input type="password" class="form-control" id="adminAccountCreatePassword" placeholder="Minimum 8 characters" minlength="8" title="Minimum 8 characters.">
                </div>
                <div>
                  <label class="form-label small">Confirm Temporary Password</label>
                  <input type="password" class="form-control" id="adminAccountCreatePasswordConfirm" placeholder="Re-type temporary password" minlength="8" title="Minimum 8 characters.">
                </div>
                <div class="settings-form-full d-flex justify-content-end">
                  <button class="btn btn-cta" id="adminAccountCreateBtn">
                    <i class="bi bi-person-plus"></i> Create Admin Account
                  </button>
                </div>
              </div>
              <div class="admin-created-state">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-check-circle text-success"></i>
                    <div class="fw-semibold">Admin Status</div>
                    <span class="badge bg-success-subtle text-success" id="adminAccountStatusBadge">Active</span>
                  </div>
                  <button type="button" class="btn btn-cta" id="adminAccountResetStartBtn">
                    <i class="bi bi-key"></i> Reset Credentials
                  </button>
                </div>
                <div class="small text-muted mt-2">
                  <span class="fw-semibold" id="adminAccountSummaryName">Admin Account</span>
                  <span> | Username: </span>
                  <span id="adminAccountSummaryUsername">-</span>
                </div>
                <div class="collapse mt-3" id="adminAccountCredentials">
                  <div class="settings-form-grid">
                    <div>
                      <label class="form-label small">New Username</label>
                      <input type="text" class="form-control" id="adminAccountResetUsername" placeholder="Enter new username">
                    </div>
                    <div>
                      <label class="form-label small">New Temporary Password</label>
                      <input type="password" class="form-control" id="adminAccountResetPassword" placeholder="Minimum 8 characters" minlength="8" title="Minimum 8 characters.">
                    </div>
                    <div>
                      <label class="form-label small">Confirm Password</label>
                      <input type="password" class="form-control" id="adminAccountResetPasswordConfirm" placeholder="Re-type new password" minlength="8" title="Minimum 8 characters.">
                    </div>
                    <div class="settings-form-full d-flex justify-content-end">
                      <button type="button" class="btn btn-cta" id="adminAccountResetBtn">
                        <i class="bi bi-check2-circle"></i> Save New Credentials
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="small text-muted mt-3" id="adminAccountActionNotice">No admin account created yet.</div>
            </section>

            <section class="settings-section" id="deactivate-admin-account">
              <div class="settings-section-head">
                <div>
                  <h5 class="mb-1">Deactivate Admin Account</h5>
                  <p class="small text-muted mb-0">Disable admin login access temporarily.</p>
                </div>
                <span class="badge bg-warning-subtle text-warning">Access</span>
              </div>
              <div class="settings-list">
                <div class="settings-list-item">
                  <div class="item-info">
                    <div class="fw-semibold">Deactivate Admin</div>
                  </div>
                  <div class="form-check form-switch ms-auto">
                    <input class="form-check-input" type="checkbox" id="adminAccountDeactivateToggle">
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section class="settings-section settings-panel" style="--delay:0.12s" id="create-staff-account" data-role="admin-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Create Staff Account</h5>
                <p class="small text-muted mb-0">Admin creates staff accounts and activates them immediately.</p>
              </div>
              <span class="badge bg-success-subtle text-success">Create Staff Account</span>
            </div>
            <div class="settings-form-grid" id="staffCreateForm">
              <div>
                <label class="form-label small">Full Name</label>
                <input type="text" class="form-control" id="staffCreateFullName" placeholder="Maria L. Santos">
              </div>
              <div>
                <label class="form-label small">Role</label>
                <select class="form-select" id="staffCreateRole" disabled>
                  <option>Registration Staff</option>
                </select>
              </div>
              <div>
                <label class="form-label small">Username</label>
                <input type="text" class="form-control" id="staffCreateUsername" placeholder="maria.santos">
              </div>
              <div>
                <label class="form-label small">Password</label>
                <input type="password" class="form-control" id="staffCreatePassword" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" title="Minimum 8 characters and must include at least 1 special character.">
              </div>
              <div>
                <label class="form-label small">Contact Number</label>
                <input type="text" class="form-control" id="staffCreateContactNumber" placeholder="09XX-XXX-XXXX">
              </div>
              <div>
                <label class="form-label small">Requested Module</label>
                <select class="form-select" id="staffCreateModule" disabled>
                  <option>Registration Module</option>
                </select>
              </div>
              <div class="settings-form-full d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="small text-muted">Newly created staff accounts are activated immediately.</div>
                <button type="button" class="btn btn-cta" id="staffCreateBtn">
                  <i class="bi bi-person-check"></i> Create Staff Account
                </button>
              </div>
            </div>
            <div class="small text-muted mt-2" id="staffAccountNotice">No staff account created yet.</div>
            <div class="settings-divider"></div>
            <div class="settings-list" id="staffAccountsList"></div>
          </section>

          <section class="settings-section settings-panel" style="--delay:0.2s" id="active-users" data-role="captain-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Active Users</h5>
                <p class="small text-muted mb-0">Currently signed-in users and their assigned modules.</p>
              </div>
              <span class="badge bg-success-subtle text-success" id="activeUsersBadge">0 Active</span>
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

          <section class="settings-section settings-panel" style="--delay:0.25s" id="barangay-profile" data-role="captain-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Barangay Profile & Officials</h5>
                <p class="small text-muted mb-0">Official identity, seal, and signatories.</p>
              </div>
              <span class="badge bg-secondary-subtle text-secondary">Official</span>
            </div>
            <div class="settings-form-grid">
              <div>
                <label class="form-label small">Barangay Name</label>
                <input type="text" class="form-control" value="Barangay Cabarian">
              </div>
              <div>
                <label class="form-label small">Barangay Code</label>
                <input type="text" class="form-control" value="BRC-082">
              </div>
              <div>
                <label class="form-label small">Email Address</label>
                <input type="email" class="form-control" value="barangay.cabarian@ligao.gov.ph">
              </div>
              <div>
                <label class="form-label small">Contact Number</label>
                <input type="text" class="form-control" value="(052) 123-4567">
              </div>
              <div class="settings-form-full">
                <label class="form-label small">Barangay Hall Address</label>
                <input type="text" class="form-control" value="Purok 2, Barangay Cabarian, Ligao City">
              </div>
              <div>
                <label class="form-label small">Captain Name</label>
                <input type="text" class="form-control" value="Hon. Ricardo V. Ladera">
              </div>
              <div>
                <label class="form-label small">Secretary Name</label>
                <input type="text" class="form-control" value="Ms. Angelica M. Ramos">
              </div>
              <div class="settings-form-full">
                <label class="form-label small">Official Seal</label>
                <input type="file" class="form-control">
              </div>
              <div class="settings-form-full d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="small text-muted">These details will appear on official documents and reports.</div>
                <button class="btn btn-cta">
                  <i class="bi bi-check2-circle"></i> Save Profile
                </button>
              </div>
            </div>
          </section>

          <section class="settings-section settings-panel" style="--delay:0.3s" id="audit-trail" data-role="captain-only">
            <div class="module audit-module">
              <div class="module-header">
                <div>
                  <h5 class="mb-1 fw-bold">Activity Logs</h5>
                  <p class="mb-0 text-muted small">System actions and approvals recorded for accountability</p>
                </div>
                <div class="module-actions">
                  <div class="input-group input-group-sm module-search">
                    <input type="text" class="form-control" id="settingsAuditSearchInput" placeholder="Search action, user, or record">
                    <span class="input-group-text"><i class="bi bi-search"></i></span>
                  </div>
                  <select class="form-select form-select-sm" id="settingsAuditActionFilter">
                    <option value="all">All Actions</option>
                    <option value="created">Created</option>
                    <option value="updated">Updated</option>
                    <option value="deleted">Deleted</option>
                    <option value="security">Security</option>
                    <option value="access">Access</option>
                  </select>
                  <select class="form-select form-select-sm" id="settingsAuditUserFilter">
                    <option value="all">All Users</option>
                    <option value="captain">Captain</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                  </select>
                  <select class="form-select form-select-sm" id="settingsAuditYearFilter">
                    <option value="all">All Years</option>
                  </select>
                </div>
              </div>

              <div class="module-grid">
                <div class="module-card">
                  <div class="module-label">Total Actions</div>
                  <div class="module-value" id="settingsAuditTotalActions">0</div>
                </div>
                <div class="module-card">
                  <div class="module-label">Created</div>
                  <div class="module-value" id="settingsAuditCreatedCount">0</div>
                </div>
                <div class="module-card">
                  <div class="module-label">Updates</div>
                  <div class="module-value" id="settingsAuditUpdatedCount">0</div>
                </div>
                <div class="module-card">
                  <div class="module-label">Deleted</div>
                  <div class="module-value" id="settingsAuditDeletedCount">0</div>
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
                  <tbody id="settingsAuditTableBody">
                    <tr id="settingsAuditLoadingRow">
                      <td colspan="6" class="text-center text-muted">Loading activity logs...</td>
                    </tr>
                    <tr id="settingsAuditEmptyRow" class="d-none">
                      <td colspan="6" class="text-center text-muted">No activity logs found.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section class="settings-section settings-panel" style="--delay:0.4s" id="backup-restore" data-role="captain-only">
            <div class="settings-section-head">
              <div>
                <h5 class="mb-1">Backup & Restore</h5>
                <p class="small text-muted mb-0">Protect and recover barangay system data.</p>
              </div>
              <span class="badge bg-success-subtle text-success">Healthy</span>
            </div>
            <div class="settings-callout">
              <i class="bi bi-info-circle"></i>
              <div>
                <div class="fw-semibold">Backup Policy</div>
                <div class="small text-muted">Keep at least one recent backup before restoring or updating records.</div>
              </div>
            </div>
            <div class="settings-form-grid">
              <div>
                <label class="form-label small">Backup Schedule</label>
                <select class="form-select">
                  <option>Daily at 9:00 PM</option>
                  <option>Weekly (Every Friday)</option>
                  <option>Manual Only</option>
                </select>
              </div>
              <div>
                <label class="form-label small">Storage Location</label>
                <select class="form-select">
                  <option>Local Server</option>
                  <option>External Drive</option>
                  <option>Cloud Storage</option>
                </select>
              </div>
              <div>
                <label class="form-label small">Last Backup</label>
                <input type="text" class="form-control" value="Feb 08, 2026 - 9:30 PM" readonly>
              </div>
              <div>
                <label class="form-label small">Backup Size</label>
                <input type="text" class="form-control" value="412 MB" readonly>
              </div>
              <div class="settings-form-full">
                <label class="form-label small">Restore From File</label>
                <input type="file" class="form-control">
              </div>
              <div class="settings-form-full d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div class="small text-muted">Restoring will overwrite current data.</div>
                <div class="d-flex gap-2 flex-wrap">
                  <button class="btn btn-outline-primary">
                    <i class="bi bi-cloud-arrow-up"></i> Run Backup
                  </button>
                  <button class="btn btn-outline-primary">
                    <i class="bi bi-download"></i> Download Backup
                  </button>
                  <button class="btn btn-danger">
                    <i class="bi bi-arrow-repeat"></i> Restore Now
                  </button>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
    </main>
  </div>

  <!-- FOOTER -->
  <footer class="footer text-muted">
    &copy; <span id="year"></span> Barangay Cabarian Ligao City Household Information Management System. All rights reserved.
  </footer>

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

  <!-- RESET CREDENTIALS CONFIRM MODAL -->
  <div class="modal fade" id="adminAccountResetConfirmModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-warning">
          <i class="bi bi-shield-exclamation fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Confirm Credential Reset</h5>
        <p class="mb-3">You are about to reset the admin credentials. Continue to open the reset form.</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="adminAccountResetConfirmBtn">Continue</button>
        </div>
      </div>
    </div>
  </div>

  <!-- STAFF ACCOUNT VIEW MODAL -->
  <div class="modal fade" id="staffViewModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered modal-lg">
      <div class="modal-content modern-modal p-0 overflow-hidden">
        <div class="modal-header border-0 px-4 pt-4 pb-2 staff-view-modal-header">
          <div class="staff-view-header-main">
            <h5 class="modal-title mb-1" id="staffViewName">Staff Account</h5>
            <p class="small text-muted mb-0" id="staffViewMeta">Registration Staff | Registration Module</p>
          </div>
          <div class="staff-view-header-actions">
            <span class="badge bg-success-subtle text-success" id="staffViewStatusBadge">Active</span>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
        </div>
        <div class="modal-body px-4 pt-2 pb-3">
          <div class="staff-view-grid">
            <div class="staff-view-field">
              <span class="staff-view-label">Username</span>
              <code class="staff-view-value" id="staffViewUsername">-</code>
            </div>
            <div class="staff-view-field">
              <span class="staff-view-label">Contact Number</span>
              <span class="staff-view-value staff-view-value-text" id="staffViewContact">-</span>
            </div>
            <div class="staff-view-field staff-view-field-full">
              <span class="staff-view-label">Password</span>
              <div class="staff-view-password-row">
                <code class="staff-view-value" id="staffViewPasswordValue" data-staff-password="" data-visible="false">--------</code>
                <button type="button" class="btn btn-sm btn-outline-secondary staff-view-password-btn" id="staffViewPasswordToggleBtn">
                  <i class="bi bi-eye"></i><span data-toggle-label>Show</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 px-4 pt-0 pb-4">
          <button type="button" class="btn btn-outline-warning btn-modern" id="staffViewToggleBtn">
            <i class="bi bi-pause-circle"></i> Deactivate
          </button>
          <button type="button" class="btn btn-danger btn-modern" id="staffViewDeleteBtn">
            <i class="bi bi-trash"></i> Delete
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- DELETE STAFF ACCOUNT MODAL -->
  <div class="modal fade" id="staffDeleteConfirmModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-danger">
          <i class="bi bi-trash3-fill fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Delete Staff Account</h5>
        <p class="mb-3" id="staffDeleteConfirmText">This action cannot be undone.</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="staffDeleteConfirmBtn">Delete Account</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Bootstrap JS bundle -->
  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/responsive-table-scripts.js"></script>
  <script src="assets/js/settings-scripts.js?v=<?= htmlspecialchars($settingsScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>


