<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['staff', 'secretary', 'admin']);
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
$systemLabel = trim($brandSidebarLabel . ' Online Household Information Management System');
$footerBarangayLabel = $brandLabel;
if (stripos($footerBarangayLabel, 'barangay') !== 0) {
  $footerBarangayLabel = trim('Barangay ' . $footerBarangayLabel);
}
$footerLocationLabel = $footerBarangayLabel;
if ($brandCity !== '' && stripos($footerLocationLabel, $brandCity) === false) {
  $footerLocationLabel = trim($footerLocationLabel . ', ' . $brandCity);
}
$footerSystemLabel = trim($footerLocationLabel . ' Online Household Information Management System');
$editHouseholdId = trim((string) ($_GET['edit'] ?? ''));
$isRegistrationEditMode = $editHouseholdId !== '';
$registrationReturnSource = strtolower(trim((string) ($_GET['from'] ?? '')));
$isHouseholdEditReturn = $isRegistrationEditMode && $registrationReturnSource === 'household-view';
$registrationRequiresCredentialUpdate = $authRole === AUTH_ROLE_STAFF && !empty($authUser['requires_credential_update']);
$showStaffAccountSettings = $authRole === AUTH_ROLE_STAFF;
$staffCredentialsTitle = 'Change Credentials';
$staffCredentialsDescription = $registrationRequiresCredentialUpdate
  ? 'Update your username or password to continue.'
  : 'Update your username or password.';
$staffCredentialsBadge = $registrationRequiresCredentialUpdate ? 'Required' : '';
$registrationCurrentUsername = (string) ($authUser['username'] ?? '');
$registrationCsrfToken = auth_csrf_token();
$registrationStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/registration-style.css') ?: time());
$registrationOfflineInitVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-offline-init.js') ?: time());
$registrationScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-scripts.js') ?: time());
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($registrationCsrfToken, ENT_QUOTES, 'UTF-8') ?>">
  <meta name="theme-color" content="#0d6efd">
  <link rel="manifest" href="manifest.webmanifest">
  <title>Household Registration</title>

  <!-- Bootstrap CSS -->
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/registration-style.css?v=<?= htmlspecialchars($registrationStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
</head>

<body
  data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>"
  data-requires-credential-update="<?= $registrationRequiresCredentialUpdate ? 'true' : 'false' ?>"
  data-current-username="<?= htmlspecialchars($registrationCurrentUsername, ENT_QUOTES, 'UTF-8') ?>"
>
<?php echo auth_client_role_script($authRole); ?>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?> Logo" class="brand-logo">
      <div>
        <div class="brand-title"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></div>
      </div>
    </div>

    <div class="sidebar-section sidebar-nav-section">
      <nav class="sidebar-nav">
        <a class="active" href="registration.php"><i class="bi bi-ui-checks-grid"></i> Registration</a>
      </nav>
    </div>

    <div class="sidebar-section sidebar-members">
      <div class="sidebar-panel-header">
        <div class="sidebar-panel-title-row">
          <span class="sidebar-panel-title">Members</span>
          <span class="badge rounded-pill" id="sidebarMemberCount">0</span>
        </div>
        <button class="sidebar-members-toggle" type="button" id="sidebarMembersToggle" aria-controls="sidebarMembersList" aria-expanded="true">
          <i class="bi bi-chevron-down"></i>
        </button>
      </div>
      <a href="member.php" class="btn btn-light btn-sm sidebar-add-btn" id="addMemberBtn" aria-disabled="true">
        <i class="bi bi-person-plus"></i> Add Member
      </a>
      <div class="sidebar-member-list" id="sidebarMembersList"></div>
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-quick">
        <div class="quick-card d-none" id="syncCenterCard">
          <div class="quick-title">Sync Center</div>
          <div class="sync-status sync-status-sidebar" id="syncStatusWrap" aria-live="polite">
            <div class="sync-status-main">
              <span class="sync-badge sync-badge-neutral" id="syncStatusBadge">Checking</span>
              <span class="sync-status-text" id="syncStatusText">Preparing sync status...</span>
            </div>
          </div>
          <div class="offline-pending-line sidebar-pending d-none" id="offlinePendingLine" aria-live="polite">
            <i class="bi bi-cloud-slash"></i>
            <span>Offline pending households: <strong id="offlinePendingCount">0</strong></span>
          </div>
        </div>
      </div>
      <div class="sidebar-actions">
        <?php if ($showStaffAccountSettings): ?>
          <button type="button" class="btn btn-light btn-sm" id="openStaffAccountSettingsBtn">
            <i class="bi bi-person-gear"></i> Change Credentials
          </button>
        <?php endif; ?>
        <a href="logout.php" class="btn btn-light btn-sm">
          <i class="bi bi-box-arrow-right"></i> Logout
        </a>
      </div>
    </div>

  </aside>

  <div class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true"></div>

  <main class="content">
    <div class="content-header mb-4">
      <div class="content-heading">
        <button class="sidebar-toggle btn btn-light btn-sm" type="button" id="sidebarToggle" aria-controls="sidebar" aria-expanded="false" aria-label="Open menu">
          <span class="menu-bars" aria-hidden="true"></span>
        </button>
        <div>
          <div class="content-title">Household Registration</div>
          <div class="content-subtitle"><?= htmlspecialchars($systemLabel, ENT_QUOTES, 'UTF-8') ?></div>
          <div class="content-subtitle content-subtitle-mobile"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></div>
        </div>
      </div>
      <div class="content-meta">
        <div class="content-meta-actions">
          <button type="button" class="btn btn-outline-primary btn-sm" id="loadExistingBtn">
            <i class="bi <?= $isRegistrationEditMode ? 'bi-arrow-left' : 'bi-folder2-open' ?>"></i> <?= $isRegistrationEditMode ? ($isHouseholdEditReturn ? 'Back to Household' : 'Back to Registration') : 'Load Existing Household' ?>
          </button>
        </div>
      </div>
    </div>

    <form id="censusForm">

    <!-- A. Household Head Information -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">
        <span>A. Household Head Information</span>
        <span class="badge rounded-pill">Required fields are marked *</span>
      </div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label required">First Name</label><input type="text" class="form-control" name="first_name" required></div>
          <div class="col-md-3"><label class="form-label">Middle Name</label><input type="text" class="form-control" name="middle_name"></div>
          <div class="col-md-3"><label class="form-label required">Last Name</label><input type="text" class="form-control" name="last_name" required></div>
          <div class="col-md-3"><label class="form-label">Extension Name</label><input type="text" class="form-control" name="extension_name" placeholder="e.g., Jr., Sr., III"></div>
          <div class="col-md-3"><label class="form-label required">Birthday</label><input type="date" class="form-control" name="birthday" id="birthday" required></div>
          <div class="col-md-3"><label class="form-label required">Sex/Gender</label>
            <select class="form-select" name="sex" id="sex" required>
              <option value="">Select</option><option>Male</option><option>Female</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label required">Civil Status</label>
            <select class="form-select" name="civil_status" required>
              <option value="">Select</option>
              <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
            </select>
          </div>
                    <div class="col-md-3"><label class="form-label">Nationality/Citizenship</label><input type="text" class="form-control" name="citizenship" value="Filipino"></div>
          <div class="col-md-3"><label class="form-label">Religion</label><input type="text" class="form-control" name="religion"></div>
          <div class="col-md-3"><label class="form-label">Blood Type</label><input type="text" class="form-control" name="blood_type"></div>
          <div class="col-md-2"><label class="form-label">Height (cm)</label><input type="number" class="form-control" name="height"></div>
          <div class="col-md-2"><label class="form-label">Weight (kg)</label><input type="number" class="form-control" name="weight"></div>
          <div class="col-md-2"><label class="form-label">Age</label><input type="number" class="form-control" name="age" id="age" readonly></div>

          <div class="col-md-2" id="pregnantWrap" style="display:none;">
            <label class="form-label">Pregnant?</label>
            <div class="d-flex gap-3" style="min-height:42px; align-items:center;">
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="pregnant" id="pregnant_yes" value="Yes">
                <label class="form-check-label" for="pregnant_yes">Yes</label>
              </div>
              <div class="form-check form-check-inline">
                <input class="form-check-input" type="radio" name="pregnant" id="pregnant_no" value="No">
                <label class="form-check-label" for="pregnant_no">No</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- B. Contact & Location -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">B. Contact & Location</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label required">Contact Number</label><input type="tel" class="form-control" name="contact" required></div>
          <div class="col-md-4"><label class="form-label required">Complete Address</label><input type="text" class="form-control" name="address" required></div>
          <div class="col-md-4"><label class="form-label required">Zone</label><input type="text" class="form-control" name="zone" required></div>
          <div class="col-md-4"><label class="form-label">Barangay</label><input type="text" class="form-control" name="barangay"></div>
          <div class="col-md-4"><label class="form-label">City/Municipality</label><input type="text" class="form-control" name="city"></div>
          <div class="col-md-4"><label class="form-label">Province</label><input type="text" class="form-control" name="province"></div>
        </div>
      </div>
    </div>

    <!-- C. Education -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">C. Education</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">Educational Attainment</label><input type="text" class="form-control" name="education"></div>
          <div class="col-md-4"><label class="form-label">Degree/Course</label><input type="text" class="form-control" name="degree"></div>
          <div class="col-md-4"><label class="form-label">School Name</label><input type="text" class="form-control" name="school_name"></div>
          <div class="col-md-3"><label class="form-label">School Type</label>
            <select class="form-select" name="school_type"><option>Private</option><option>Public</option></select>
          </div>
          <div class="col-md-3"><label class="form-label">Drop Out?</label><select class="form-select" name="dropout"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3"><label class="form-label">Out of School Youth?</label><select class="form-select" name="osy"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3"><label class="form-label">Currently Studying?</label><select class="form-select" name="currently_studying"><option>No</option><option>Yes</option></select></div>
        </div>
      </div>
    </div>

    <!-- D. Employment -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">D. Employment</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label">Occupation</label><input type="text" class="form-control" name="occupation"></div>
          <div class="col-md-3"><label class="form-label">Employment Status</label>
            <select class="form-select" name="employment_status"><option>Employed</option><option>Unemployed</option><option>Self-employed</option></select>
          </div>
          <div class="col-md-3"><label class="form-label">Type of Work</label>
            <select class="form-select" name="work_type"><option>Government</option><option>Private</option><option>Freelance</option></select>
          </div>
          <div class="col-md-3"><label class="form-label">Monthly Income</label><input type="text" class="form-control" name="monthly_income" placeholder="optional"></div>
        </div>
      </div>
    </div>

    <!-- E. Social Welfare -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">E. Social Welfare</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label">4Ps Member?</label><select class="form-select" name="4ps"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3"><label class="form-label">Senior Citizen?</label><select class="form-select" name="senior"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3"><label class="form-label">PWD?</label><select class="form-select" name="pwd"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3"><label class="form-label">Indigenous People (IP)?</label><select class="form-select" name="ip"><option>No</option><option>Yes</option></select></div>
        </div>
      </div>
    </div>

    <!-- F. Voter Info -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">F. Voter Information</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Registered Voter?</label><select class="form-select" name="voter"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-6"><label class="form-label">Precinct Number</label><input type="text" class="form-control" name="precinct"></div>
        </div>
      </div>
    </div>

    <!-- G. Government IDs -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">G. Government IDs</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">SSS Number</label><input type="text" class="form-control" name="sss"></div>
          <div class="col-md-4"><label class="form-label">PhilHealth Number</label><input type="text" class="form-control" name="philhealth"></div>
          <div class="col-md-4"><label class="form-label">GSIS Number</label><input type="text" class="form-control" name="gsis"></div>
          <div class="col-md-3"><label class="form-label">TIN Number</label><input type="text" class="form-control" name="tin"></div>
          <div class="col-md-3"><label class="form-label">PhilSys National ID</label><input type="text" class="form-control" name="philid"></div>
          <div class="col-md-3"><label class="form-label">Driver's License</label><input type="text" class="form-control" name="driver_license"></div>
          <div class="col-md-3"><label class="form-label">Passport Number</label><input type="text" class="form-control" name="passport"></div>
        </div>
      </div>
    </div>

    <!-- H. Household Data -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">H. Household Data</div>
      <div class="card-body">
        <div class="row g-3 household-data-primary-row">
          <div class="col-md-3"><label class="form-label required">No. of Household Members</label><input type="number" class="form-control" name="num_members" required readonly></div>
          <div class="col-md-3"><label class="form-label">Relationship to Head</label><input type="text" class="form-control" name="relation_to_head"></div>
          <div class="col-md-3"><label class="form-label">No. of Children</label><input type="number" class="form-control" name="num_children" readonly></div>
          <div class="col-md-3"><label class="form-label">Marital Partner Name</label><input type="text" class="form-control" name="partner_name" placeholder="optional"></div>
        </div>
      </div>
    </div>

    <!-- I. Housing & Utilities -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">I. Housing & Utilities</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">House Ownership</label><select class="form-select" name="ownership"><option>Owned</option><option>Rented</option></select></div>
          <div class="col-md-4"><label class="form-label">House Type</label><select class="form-select" name="house_type"><option value="" selected>Select or type</option><option value="Concrete">Concrete</option><option value="Wood">Wood</option><option value="Mixed">Mixed</option></select></div>
          <div class="col-md-4">
            <label class="form-label">Toilet Type</label>
            <input class="form-control" list="toilet_options" name="toilet" id="toilet" placeholder="Select or type">
            <datalist id="toilet_options">
              <option value="Water-sealed (Flush toilet)"></option>
              <option value="Pour-flush"></option>
              <option value="Pit latrine"></option>
              <option value="Composting toilet / Eco-toilet"></option>
              <option value="Shared toilet"></option>
              <option value="Public toilet"></option>
              <option value="No toilet facility"></option>
              <option value="Other"></option>
            </datalist>
          </div>
          <div class="col-md-3"><label class="form-label">Number of Rooms</label><input type="number" class="form-control" name="num_rooms"></div>
          <div class="col-md-3"><label class="form-label">Electricity?</label><select class="form-select" name="electricity"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3">
            <label class="form-label">Water Source</label>
            <input class="form-control" list="water_source_options" name="water" id="water_source" placeholder="Select or type">
            <datalist id="water_source_options">
              <option value="Piped water (Direktang linya ng tubig sa bahay)"></option>
              <option value="Deep well (Malalim na balon na may pump)"></option>
              <option value="Shallow well (Mababaw na balon)"></option>
              <option value="Hand pump / Poso"></option>
              <option value="Spring / Bukal"></option>
              <option value="Rainwater collection (Imbakan ng tubig-ulan)"></option>
              <option value="River / (Ilog)"></option>
              <option value="Water refilling station (Binibiling inumin)"></option>
              <option value="Delivered by truck / (Dinadala ng water truck)"></option>
              <option value="Other (Specify)"></option>
            </datalist>
          </div>
          <div class="col-md-3"><label class="form-label">Internet Access?</label><select class="form-select" name="internet"><option>No</option><option>Yes</option></select></div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="action-bar">
      <div class="action-buttons">
        <button type="button" class="btn btn-outline-primary" id="previewBtn"><i class="bi bi-eye"></i> Preview</button>
        <?php if (!$isRegistrationEditMode): ?>
        <button type="button" class="btn btn-secondary" id="clearBtn"><i class="bi bi-x-circle"></i> Clear</button>
        <?php endif; ?>
        <button type="button" class="btn btn-primary" id="saveBtn"><i class="bi bi-save"></i> Save Registration</button>
      </div>
    </div>

    </form>

    <footer class="footer page-footer py-3 text-center">
      <div class="footer-inner">
        <p class="mb-1 fw-semibold"><?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?></p>
        <p class="mb-0 small">&copy; <span id="year"></span> <?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></p>
      </div>
    </footer>
  </main>
</div>

<!-- Preview Modal -->
<div class="modal fade" id="previewModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-xl modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Preview Registration</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body" id="previewBody">
        <p class="text-muted text-center mb-0">No details provided.</p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<!-- Member Details Modal -->
<div class="modal fade" id="memberModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Member Details</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body" id="memberModalBody"></div>
      <div class="modal-footer">
        <button class="btn btn-primary" type="button" id="editMemberBtn">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button class="btn btn-danger" type="button" id="deleteMemberBtn">
          <i class="bi bi-trash"></i> Delete
        </button>
        <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<!-- Staff Credential Update Modal -->
<div class="modal fade" id="staffCredentialsModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
  <div class="modal-dialog modal-dialog-centered staff-credentials-dialog">
    <div class="modal-content modern-modal staff-credentials-modal">
      <div class="staff-credentials-shell">
        <div class="staff-credentials-hero">
          <div class="staff-credentials-icon">
            <i class="bi bi-shield-lock-fill"></i>
          </div>
          <div class="staff-credentials-copy">
            <span class="staff-credentials-badge" id="staffCredentialsModeBadge"<?= $staffCredentialsBadge === '' ? ' hidden' : '' ?>><?= htmlspecialchars($staffCredentialsBadge, ENT_QUOTES, 'UTF-8') ?></span>
            <h5 class="modal-title" id="staffCredentialsModalTitle"><?= htmlspecialchars($staffCredentialsTitle, ENT_QUOTES, 'UTF-8') ?></h5>
            <p id="staffCredentialsModalDescription"><?= htmlspecialchars($staffCredentialsDescription, ENT_QUOTES, 'UTF-8') ?></p>
          </div>
        </div>

        <div class="staff-credentials-grid">
          <div class="staff-credentials-field">
            <label class="form-label small" for="staffCredentialsCurrentUsername">Current Username</label>
            <input type="text" class="form-control" id="staffCredentialsCurrentUsername" readonly>
          </div>
          <div class="staff-credentials-field">
            <label class="form-label small" for="staffCredentialsCurrentPassword">Current Password</label>
            <input type="password" class="form-control" id="staffCredentialsCurrentPassword" placeholder="Enter current password" autocomplete="current-password">
          </div>
          <div class="staff-credentials-field">
            <label class="form-label small" for="staffCredentialsNewUsername">New Username</label>
            <input type="text" class="form-control" id="staffCredentialsNewUsername" placeholder="Enter new username" autocomplete="username">
          </div>
          <div class="staff-credentials-field">
            <label class="form-label small" for="staffCredentialsNewPassword">New Password</label>
            <input type="password" class="form-control" id="staffCredentialsNewPassword" placeholder="8+ chars, 1 special" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" autocomplete="new-password">
          </div>
          <div class="staff-credentials-field staff-credentials-field-full">
            <label class="form-label small" for="staffCredentialsConfirmPassword">Confirm New Password</label>
            <input type="password" class="form-control" id="staffCredentialsConfirmPassword" placeholder="Re-type new password" minlength="8" pattern="(?=.*[^A-Za-z0-9]).{8,}" autocomplete="new-password">
          </div>
        </div>

        <div class="staff-credentials-notice text-muted" id="staffCredentialsNotice" hidden></div>

        <div class="staff-credentials-actions">
          <button type="button" class="btn btn-secondary btn-modern d-none" id="staffCredentialsCancelBtn" data-bs-dismiss="modal">Close</button>
          <a href="logout.php" class="btn btn-secondary btn-modern" id="staffCredentialsLogoutBtn">Logout</a>
          <button type="button" class="btn btn-primary btn-modern" id="staffCredentialsSaveBtn">Save Changes</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Delete Member Modal -->
<div class="modal fade" id="deleteMemberModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-danger">
        <i class="bi bi-trash-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Delete Member</h5>
      <p class="mb-3">Are you sure you want to delete this member?</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-danger btn-modern" id="deleteMemberConfirm">Delete</button>
      </div>
    </div>
  </div>
</div>

<!-- Logout Modal -->
<div class="modal fade" id="logoutModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-exclamation-triangle-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Logout Confirmation</h5>
      <p class="mb-3">Are you sure you want to log out?</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-danger btn-modern" id="logoutConfirm">Logout</button>
      </div>
    </div>
  </div>
</div>

<!-- Clear Modal -->
<div class="modal fade" id="clearModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-trash3-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Clear Form</h5>
      <p class="mb-3">This will clear all fields and remove all members.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-danger btn-modern" id="clearConfirm">Clear</button>
      </div>
    </div>
  </div>
</div>

<!-- Save Modal -->
<div class="modal fade" id="saveModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3">
        <i class="bi bi-check-circle-fill fs-1 text-success"></i>
      </div>
      <h5 class="modal-title mb-2">Save Registration</h5>
      <p class="mb-3">Ready to save this registration?</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary btn-modern" id="saveConfirm">Save</button>
      </div>
    </div>
  </div>
</div>

<!-- Saving Household Overlay -->
<div id="savingHouseholdModal" class="saving-household-overlay" hidden aria-hidden="true" aria-modal="true" role="dialog">
  <div class="saving-household-dialog">
    <div class="modern-modal text-center saving-household-modal">
      <div class="modal-icon saving-household-icon mb-3" aria-hidden="true">
        <div class="spinner-border saving-household-spinner" role="status"></div>
      </div>
      <h5 class="modal-title mb-2" id="savingHouseholdModalTitle">Saving Household</h5>
      <p class="mb-0" id="savingHouseholdModalMessage">Please wait while we save this household record.</p>
    </div>
  </div>
</div>

<!-- Duplicate Household Modal -->
<div class="modal fade" id="duplicateHouseholdModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center duplicate-household-modal">
      <div class="modal-icon duplicate-household-icon mb-3 text-warning">
        <i class="bi bi-exclamation-circle-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2" id="duplicateHouseholdModalTitle">Household Already Exists</h5>
      <p class="mb-3" id="duplicateHouseholdModalMessage">This household record already exists.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-primary btn-modern" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>
</div>

<!-- Load Existing Household Modal -->
<div class="modal fade" id="loadHouseholdModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg load-household-dialog">
    <div class="modal-content modern-modal load-household-modal">
      <div class="modal-header border-0">
        <div>
          <h5 class="modal-title mb-1">Load Existing Household</h5>
          <p class="text-muted small mb-0">Find a household record by year, household ID, head name, or zone to continue editing.</p>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body">
        <div class="load-household-toolbar">
          <div class="load-household-field">
            <label for="loadHouseholdYear" class="form-label">Year</label>
            <select class="form-select" id="loadHouseholdYear"></select>
          </div>
          <div class="load-household-field load-household-search-field">
            <label for="loadHouseholdSearch" class="form-label visually-hidden">Search</label>
            <div class="load-household-search-wrap">
              <input
                type="search"
                class="form-control"
                id="loadHouseholdSearch"
                placeholder="Search head, household ID, or zone"
                autocomplete="off"
              >
              <button type="button" class="btn load-household-inline-btn" id="loadHouseholdSearchBtn" aria-label="Search households">
                <i class="bi bi-search"></i>
              </button>
            </div>
          </div>
        </div>
        <p class="load-household-status text-muted mb-0 d-none" id="loadHouseholdStatus"></p>
        <div class="load-household-content">
          <div class="load-household-empty" id="loadHouseholdEmpty">
            <div class="load-household-empty-icon">
              <i class="bi bi-search"></i>
            </div>
            <div class="load-household-empty-copy">
              <div class="load-household-empty-title" id="loadHouseholdEmptyTitle">Ready to search</div>
              <p class="mb-0" id="loadHouseholdEmptyText">Select a year, enter a search term, then click Search.</p>
            </div>
          </div>
          <div class="load-household-results" id="loadHouseholdResults"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Pending Sync Queue Modal -->
<div class="modal fade" id="pendingSyncModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered modal-lg">
    <div class="modal-content modern-modal pending-sync-modal">
      <div class="modal-header border-0 pb-2">
        <h5 class="modal-title mb-0">Pending Sync Households <span class="pending-sync-title-count" id="pendingSyncTitleCount">(0)</span></h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body pt-0">
        <p class="text-muted mb-3">Review pending households and resolve sync issues.</p>
        <div class="pending-sync-list" id="pendingSyncList"></div>
        <p class="text-muted mb-0 d-none" id="pendingSyncEmpty">No pending households.</p>
      </div>
      <div class="modal-footer border-0 pt-0">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>

<!-- Pending Action Confirm Modal -->
<div class="modal fade" id="pendingActionModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-exclamation-circle-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2" id="pendingActionModalTitle">Confirm Action</h5>
      <p class="mb-3" id="pendingActionModalMessage">Are you sure you want to continue?</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary btn-modern" id="pendingActionConfirm">Confirm</button>
      </div>
    </div>
  </div>
</div>

<!-- Add Member Blocked Modal -->
<div class="modal fade" id="addMemberBlockedModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-info-circle-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Complete Household Head</h5>
      <p class="mb-3">Please fill in the Household Head details first before adding members.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-primary btn-modern" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>
</div>

<!-- Save Blocked: Member Required Modal -->
<div class="modal fade" id="memberRequiredModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-people-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Cannot Save Registration</h5>
      <p class="mb-3">Please add at least one household member before saving this registration.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-primary btn-modern" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>
</div>

<div class="app-toast-container">
  <div id="syncToast" class="toast app-toast toast-tone-info" role="status" aria-live="polite" aria-atomic="true">
    <div class="toast-header">
      <i class="bi bi-info-circle-fill me-2" id="syncToastIcon"></i>
      <strong class="me-auto" id="syncToastTitle">Notice</strong>
    </div>
    <div class="toast-body" id="syncToastBody">Status update</div>
  </div>
</div>

<script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
<script src="assets/js/indexeddb-storage-scripts.js"></script>
<script src="assets/js/registration-offline-init.js?v=<?= htmlspecialchars($registrationOfflineInitVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/registration-scripts.js?v=<?= htmlspecialchars($registrationScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>



