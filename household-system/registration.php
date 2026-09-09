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
$registrationCurrentUserId = (int) ($authUser['id'] ?? 0);
$registrationCsrfToken = auth_csrf_token();
$registrationStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/registration-style.css') ?: time());
$indexedDbStorageVersion = (string) (@filemtime(__DIR__ . '/assets/js/indexeddb-storage-scripts.js') ?: time());
$registrationOfflineInitVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-offline-init.js') ?: time());
$registrationScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-scripts.js') ?: time());
$passwordToggleVersion = (string) (@filemtime(__DIR__ . '/assets/js/password-toggle.js') ?: time());
$registrationPhotoStorageVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-photo-storage.js') ?: time());
$photoCaptureVersion = (string) (@filemtime(__DIR__ . '/assets/js/photo-capture.js') ?: time());
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="csrf-token" content="<?= htmlspecialchars($registrationCsrfToken, ENT_QUOTES, 'UTF-8') ?>">
  <meta name="theme-color" content="#0d6efd">
  <link rel="manifest" href="manifest.webmanifest">
  <title>Household Registration</title>
  <link rel="icon" type="image/png" href="assets/img/registration-app-icon-192.png">

  <!-- Bootstrap CSS -->
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/registration-style.css?v=<?= htmlspecialchars($registrationStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="assets/css/password-toggle.css?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>">
  <script>
    if (navigator.onLine) {
      try {
        sessionStorage.setItem('cabarian_session_authenticated', 'true');
        sessionStorage.setItem('cabarian_offline_session_active', 'true');
      } catch {}
    } else {
      var isSessionActive = false;
      try {
        isSessionActive = sessionStorage.getItem('cabarian_session_authenticated') === 'true'
          || sessionStorage.getItem('cabarian_offline_session_active') === 'true';
      } catch {}

      if (!isSessionActive) {
        window.location.replace('login.php');
      }
    }
  </script>
</head>

<body
  data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>"
  data-requires-credential-update="<?= $registrationRequiresCredentialUpdate ? 'true' : 'false' ?>"
  data-current-username="<?= htmlspecialchars($registrationCurrentUsername, ENT_QUOTES, 'UTF-8') ?>"
  data-current-user-id="<?= $registrationCurrentUserId ?>"
  data-offline-reauth-token="<?= htmlspecialchars((string) ($authUser['offline_reauth_token'] ?? ''), ENT_QUOTES, 'UTF-8') ?>"
>
<?php echo auth_client_role_script($authRole); ?>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="assets/img/barangay-cabarian-logo.png" alt="Cabarian Ligao City Logo" class="brand-logo">
      <div>
        <div class="brand-title">Cabarian Ligao City</div>
        <div class="brand-subtitle">Online Household Information Management System</div>
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
      </div>
      <a href="member.php" class="btn btn-light btn-sm sidebar-add-btn" id="addMemberBtn" aria-disabled="true">
        <i class="bi bi-person-plus"></i> Add Member
      </a>
      <div class="sidebar-member-list" id="sidebarMembersList"></div>
    </div>

    <div class="sidebar-footer">
      <div class="sidebar-quick">
        <div class="quick-card" id="syncCenterCard">
          <div class="quick-title">Connection &amp; Sync</div>
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
          <i class="bi bi-box-arrow-right"></i> Log out
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

    <form id="censusForm" autocomplete="off">

    <!-- A. Household Head Information -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">
        <span>A. Household Head Information</span>
        <span class="badge rounded-pill">Required fields are marked *</span>
      </div>
      <div class="card-body">
        <section class="registration-photo-panel registration-photo-panel-single" aria-labelledby="registrationPhotosHeading">
          <div class="registration-photo-panel-header">
            <div class="registration-photo-panel-title" id="registrationPhotosHeading">
              <i class="bi bi-camera-fill" aria-hidden="true"></i>
              Household Head Photo
            </div>
            <span class="badge rounded-pill">Optional</span>
          </div>
          <div class="registration-photo-grid">
            <section class="registration-photo-card" aria-labelledby="headProfilePhotoHeading">
              <div class="registration-photo-preview registration-photo-preview-profile">
                <img id="headProfilePhotoPreview" alt="Selected household head profile photo" hidden>
                <div class="registration-photo-placeholder" id="headProfilePhotoPlaceholder">
                  <i class="bi bi-person-fill" aria-hidden="true"></i>
                  <span class="visually-hidden">No photo</span>
                </div>
              </div>
              <div class="registration-photo-copy">
                <div class="registration-photo-heading" id="headProfilePhotoHeading">
                  Household Head
                </div>
                <div class="registration-photo-status text-muted" id="headProfilePhotoStatus" role="status" aria-live="polite">
                  No photo yet
                </div>
                <input
                  type="file"
                  class="visually-hidden registration-photo-input"
                  id="headProfilePhotoInput"
                  accept="image/*"
                  capture="environment"
                >
                <div class="registration-photo-actions">
                  <button type="button" class="btn btn-primary btn-sm registration-photo-capture-btn" id="headProfilePhotoCaptureBtn">
                    <i class="bi bi-camera-fill" aria-hidden="true"></i>
                    <span id="headProfilePhotoTriggerText">Open Camera</span>
                  </button>
                  <button type="button" class="btn btn-outline-danger btn-sm registration-photo-remove-btn" id="headProfilePhotoRemoveBtn" aria-label="Remove household head photo" title="Remove photo" hidden>
                    <i class="bi bi-trash3" aria-hidden="true"></i>
                    <span class="visually-hidden">Remove photo</span>
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>

        <div class="row g-3">
          <div class="col-md-3"><label class="form-label required">First Name</label><input type="text" class="form-control" name="first_name" required></div>
          <div class="col-md-3"><label class="form-label">Middle Name</label><input type="text" class="form-control" name="middle_name"></div>
          <div class="col-md-3"><label class="form-label required">Last Name</label><input type="text" class="form-control" name="last_name" required></div>
          <div class="col-md-3">
            <label class="form-label">Extension Name</label>
            <select class="form-select" name="extension_name">
              <option value="">None</option>
              <option>Jr.</option>
              <option>Sr.</option>
              <option>II</option>
              <option>III</option>
              <option>IV</option>
              <option>V</option>
            </select>
          </div>
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
          <div class="col-md-3">
            <label class="form-label">Nationality/Citizenship</label>
            <input type="text" class="form-control" name="citizenship" list="citizenship_options" value="Filipino">
            <datalist id="citizenship_options">
              <option value="Filipino"></option>
              <option value="Dual Citizen"></option>
              <option value="Naturalized Filipino"></option>
              <option value="American"></option>
              <option value="Chinese"></option>
              <option value="Japanese"></option>
              <option value="Korean"></option>
              <option value="Indian"></option>
              <option value="Canadian"></option>
              <option value="Australian"></option>
              <option value="British"></option>
              <option value="Other"></option>
            </datalist>
          </div>
          <div class="col-md-3">
            <label class="form-label">Religion</label>
            <select class="form-select" name="religion">
              <option value="">Select</option>
              <option>Roman Catholic</option>
              <option>Iglesia ni Cristo</option>
              <option>Islam</option>
              <option>Born Again Christian</option>
              <option>Protestant</option>
              <option>Seventh-day Adventist</option>
              <option>Jehovah's Witness</option>
              <option>Philippine Independent Church</option>
              <option>Buddhism</option>
              <option>Hinduism</option>
              <option>None</option>
              <option>Other</option>
            </select>
          </div>
          <div class="col-md-3">
            <label class="form-label">Blood Type</label>
            <select class="form-select" name="blood_type">
              <option value="">Select</option>
              <option>Unknown</option>
              <option>A+</option>
              <option>A-</option>
              <option>B+</option>
              <option>B-</option>
              <option>AB+</option>
              <option>AB-</option>
              <option>O+</option>
              <option>O-</option>
            </select>
          </div>
          <div class="col-md-2"><label class="form-label">Height (cm)</label><input type="number" class="form-control positive-num" name="height" min="0" step="any" placeholder="cm"></div>
          <div class="col-md-2"><label class="form-label">Weight (kg)</label><input type="number" class="form-control positive-num" name="weight" min="0" step="any" placeholder="kg"></div>
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
          <div class="col-md-4">
            <label class="form-label required">Contact Number</label>
            <div class="input-group">
              <span class="input-group-text" style="border-radius:12px 0 0 12px;background:#eef2f7;font-weight:600;font-size:0.85rem;">+63</span>
              <input type="tel" class="form-control" name="contact" id="contactNumber" data-mask="999-999-9999" placeholder="9XX-XXX-XXXX" inputmode="numeric" maxlength="12" required style="border-radius:0 12px 12px 0;">
            </div>
          </div>
          <div class="col-md-4"><label class="form-label required">Complete Address</label><input type="text" class="form-control" name="address" required></div>
          <div class="col-md-4">
            <label class="form-label required">Zone</label>
            <select class="form-select" name="zone" required>
              <option value="">Select</option>
              <option>Zone 1</option>
              <option>Zone 2</option>
              <option>Zone 3</option>
              <option>Zone 4</option>
              <option>Zone 5</option>
              <option>Zone 6</option>
              <option>Zone 7</option>
            </select>
          </div>
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
          <div class="col-md-4">
            <label class="form-label required">Educational Attainment</label>
            <select class="form-select" name="education" id="head_education" required>
              <option value="">Select</option>
              <option>No Formal Education</option>
              <option>Elementary</option>
              <option>Junior High School</option>
              <option>Senior High School</option>
              <option>Vocational/Technical</option>
              <option>College</option>
              <option>Postgraduate</option>
            </select>
          </div>
          <div class="col-md-4 head-education-subfield"><label class="form-label">Degree/Course</label><input type="text" class="form-control" name="degree"></div>
          <div class="col-md-4 head-education-subfield"><label class="form-label">School Name</label><input type="text" class="form-control" name="school_name"></div>
          <div class="col-md-3 head-education-subfield"><label class="form-label">School Type</label>
            <select class="form-select" name="school_type"><option value="">N/A</option><option>Private</option><option>Public</option></select>
          </div>
          <div class="col-md-3 head-education-subfield"><label class="form-label">Drop Out?</label><select class="form-select" name="dropout"><option value="">N/A</option><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3 head-education-subfield"><label class="form-label">Out of School Youth?</label><select class="form-select" name="osy"><option value="">N/A</option><option>No</option><option>Yes</option></select></div>
          <div class="col-md-3 head-education-subfield"><label class="form-label">Currently Studying?</label><select class="form-select" name="currently_studying"><option value="">N/A</option><option>No</option><option>Yes</option></select></div>
        </div>
      </div>
    </div>

    <!-- D. Employment -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">D. Employment</div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label required">Occupation</label>
            <input type="text" class="form-control" name="occupation" list="occupation_options" placeholder="Select or type" required>
            <datalist id="occupation_options">
              <option value="Farmer"></option>
              <option value="Fisherfolk"></option>
              <option value="Teacher"></option>
              <option value="Government Employee"></option>
              <option value="Private Employee"></option>
              <option value="Business Owner"></option>
              <option value="Vendor"></option>
              <option value="Driver"></option>
              <option value="Construction Worker"></option>
              <option value="Skilled Worker"></option>
              <option value="Healthcare Worker"></option>
              <option value="Overseas Filipino Worker (OFW)"></option>
              <option value="Homemaker"></option>
              <option value="Student"></option>
              <option value="Retired"></option>
              <option value="Unemployed"></option>
              <option value="Other"></option>
            </datalist>
          </div>
          <div class="col-md-3"><label class="form-label required">Employment Status</label>
            <select class="form-select" name="employment_status" required>
              <option>Employed</option>
              <option>Unemployed</option>
              <option>Self-employed</option>
              <option>Student</option>
              <option>Homemaker</option>
              <option>Retired</option>
              <option>Seasonal Worker</option>
              <option>Unable to Work</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label required">Type of Work</label>
            <select class="form-select" name="work_type" required>
              <option>Government</option>
              <option>Private</option>
              <option>Self-employed</option>
              <option>Freelance</option>
              <option>Contractual</option>
              <option>Seasonal</option>
              <option>Agricultural</option>
              <option>Informal Sector</option>
              <option>Overseas Filipino Worker (OFW)</option>
              <option>Not Applicable</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label">Monthly Income</label><input type="text" class="form-control" name="monthly_income" placeholder="optional"></div>
        </div>
      </div>
    </div>

    <!-- E. Social Welfare -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">E. Social Welfare <span class="badge rounded-pill bg-light text-muted fw-normal">Optional</span></div>
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
      <div class="card-header section-header d-flex justify-content-between align-items-center">F. Voter Information <span class="badge rounded-pill bg-light text-muted fw-normal">Optional</span></div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-6"><label class="form-label">Registered Voter?</label><select class="form-select" name="voter"><option>No</option><option>Yes</option></select></div>
          <div class="col-md-6"><label class="form-label">Precinct Number</label><input type="text" class="form-control" name="precinct"></div>
        </div>
      </div>
    </div>

    <!-- G. Government IDs -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">G. Government IDs <span class="badge rounded-pill bg-light text-muted fw-normal">Optional</span></div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4"><label class="form-label">SSS Number</label><input type="text" class="form-control gov-id-mask" name="sss" data-mask="99-9999999-9" placeholder="00-0000000-0" maxlength="12" inputmode="numeric"></div>
          <div class="col-md-4"><label class="form-label">PhilHealth Number</label><input type="text" class="form-control gov-id-mask" name="philhealth" data-mask="99-999999999-9" placeholder="00-000000000-0" maxlength="14" inputmode="numeric"></div>
          <div class="col-md-4"><label class="form-label">GSIS Number</label><input type="text" class="form-control gov-id-mask" name="gsis" data-mask="99999999999" placeholder="00000000000" maxlength="11" inputmode="numeric"></div>
          <div class="col-md-3"><label class="form-label">TIN Number</label><input type="text" class="form-control gov-id-mask" name="tin" data-mask="999-999-999-999" placeholder="000-000-000-000" maxlength="15" inputmode="numeric"></div>
          <div class="col-md-3"><label class="form-label">PhilSys National ID</label><input type="text" class="form-control gov-id-mask" name="philid" data-mask="9999-9999-9999-9999" placeholder="0000-0000-0000-0000" maxlength="19" inputmode="numeric"></div>
          <div class="col-md-3"><label class="form-label">Driver's License</label><input type="text" class="form-control" name="driver_license" placeholder="XXX-XX-XXXXXX" maxlength="14"></div>
          <div class="col-md-3"><label class="form-label">Passport Number</label><input type="text" class="form-control" name="passport" placeholder="P1234567A" maxlength="10" style="text-transform:uppercase;"></div>
        </div>
      </div>
    </div>

    <div class="card section-card mb-4">
      <div class="card-header section-header">H. Household Data</div>
      <div class="card-body">
        <div class="row g-3 household-data-primary-row">
          <div class="col-md-3">
            <label class="form-label required">No. of Household Members</label>
            <input type="number" class="form-control" name="num_members" required readonly>
            <div class="form-check align-items-start mt-2 pt-1" style="cursor: pointer;">
              <input class="form-check-input mt-1 flex-shrink-0" type="checkbox" id="soloHouseholdCheck" name="is_solo_household" value="1">
              <label class="form-check-label user-select-none" for="soloHouseholdCheck" style="cursor: pointer; line-height: 1.25;">
                <span class="d-block fw-semibold text-dark small"><i class="bi bi-person-fill text-primary me-1"></i>Single-Person Household</span>
                <span class="d-block text-muted" style="font-size: 0.75rem;">(Living alone)</span>
              </label>
            </div>
          </div>
          <div class="col-md-3">
            <label class="form-label required">Relationship to Head</label>
            <select class="form-select" name="relation_to_head" required>
              <option value="">Select</option>
              <option>Head</option>
              <option>Spouse</option>
              <option>Father</option>
              <option>Mother</option>
              <option>Son</option>
              <option>Daughter</option>
              <option>Brother</option>
              <option>Sister</option>
              <option>Grandfather</option>
              <option>Grandmother</option>
              <option>Grandson</option>
              <option>Granddaughter</option>
              <option>In-law</option>
              <option>Other Relative</option>
              <option>Non-relative</option>
              <option>Other</option>
            </select>
          </div>
          <div class="col-md-3"><label class="form-label">No. of Children</label><input type="number" class="form-control" name="num_children" readonly></div>
          <div class="col-md-3"><label class="form-label">Marital Partner Name</label><input type="text" class="form-control" name="partner_name" placeholder="optional"></div>
        </div>
      </div>
    </div>

    <!-- I. Housing & Utilities -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">I. Housing &amp; Utilities <span class="badge rounded-pill bg-light text-muted fw-normal">Optional</span></div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">House Ownership</label>
            <select class="form-select" name="ownership">
              <option>Owned</option>
              <option>Rented</option>
              <option>Rent-free</option>
              <option>Shared/Co-owned</option>
              <option>Government-provided</option>
              <option>Employer-provided</option>
              <option>Informal Settler</option>
              <option>Other</option>
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">House Type</label>
            <select class="form-select" name="house_type">
              <option value="" selected>Select</option>
              <option>Concrete</option>
              <option>Semi-concrete</option>
              <option>Wood</option>
              <option>Mixed</option>
              <option>Makeshift/Light Materials</option>
              <option>Apartment/Condominium</option>
              <option>Duplex</option>
              <option>Other</option>
            </select>
          </div>
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
        <button type="button" class="btn btn-primary btn-modern" id="pendingSyncNowBtn"><i class="bi bi-arrow-repeat me-1"></i> Sync Now</button>
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
      <h5 class="modal-title mb-2">No Household Members Added</h5>
      <p class="mb-3 text-muted">At least one household member is required. If this resident lives alone, you may proceed by saving this record as a Single-Person Household.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-outline-secondary btn-modern" data-bs-dismiss="modal">Add Member</button>
        <button type="button" class="btn btn-primary btn-modern" id="confirmSoloHouseholdBtn"><i class="bi bi-person-fill"></i> Save as Single-Person Household</button>
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
<script src="assets/js/indexeddb-storage-scripts.js?v=<?= htmlspecialchars($indexedDbStorageVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/registration-offline-init.js?v=<?= htmlspecialchars($registrationOfflineInitVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/password-toggle.js?v=<?= htmlspecialchars($passwordToggleVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/registration-photo-storage.js?v=<?= htmlspecialchars($registrationPhotoStorageVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/photo-capture.js?v=<?= htmlspecialchars($photoCaptureVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script src="assets/js/registration-scripts.js?v=<?= htmlspecialchars($registrationScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
<script>
(function(){
  document.querySelectorAll('.gov-id-mask').forEach(function(el){
    var mask=el.getAttribute('data-mask')||'';
    if(!mask)return;
    el.addEventListener('input',function(){
      var raw=el.value.replace(/\D/g,'');
      if(!raw){el.value='';return;}
      var out='',ri=0;
      for(var i=0;i<mask.length&&ri<raw.length;i++){
        if(mask[i]==='-'){out+='-';}
        else{out+=raw[ri];ri++;}
      }
      el.value=out;
    });
  });
  var contact=document.getElementById('contactNumber');
  if(contact){
    contact.addEventListener('keydown',function(e){
      var allowed=['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'];
      if(allowed.indexOf(e.key)!==-1)return;
      if(e.ctrlKey||e.metaKey)return;
      if(!/^\d$/.test(e.key)){e.preventDefault();return;}
      var raw=contact.value.replace(/\D/g,'');
      if(raw.length===0&&e.key!=='9'){e.preventDefault();return;}
      if(raw.length>=10){e.preventDefault();return;}
    });
    contact.addEventListener('input',function(){
      var raw=contact.value.replace(/\D/g,'');
      if(raw.length>0&&raw[0]!=='9')raw='';
      if(raw.length>10)raw=raw.substring(0,10);
      if(!raw){contact.value='';return;}
      var out=raw.substring(0,3);
      if(raw.length>3)out+='-'+raw.substring(3,6);
      if(raw.length>6)out+='-'+raw.substring(6,10);
      contact.value=out;
    });
    contact.addEventListener('paste',function(e){
      e.preventDefault();
      var text=(e.clipboardData||window.clipboardData).getData('text');
      var raw=text.replace(/\D/g,'');
      if(raw.length>0&&raw[0]==='0')raw=raw.substring(1);
      if(raw.length>0&&raw[0]!=='9')return;
      if(raw.length>10)raw=raw.substring(0,10);
      if(!raw)return;
      var out=raw.substring(0,3);
      if(raw.length>3)out+='-'+raw.substring(3,6);
      if(raw.length>6)out+='-'+raw.substring(6,10);
      contact.value=out;
      contact.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
  document.querySelectorAll('.positive-num').forEach(function(el){
    el.addEventListener('keydown',function(e){
      if(e.key==='-'||e.key==='e'||e.key==='E'){e.preventDefault();}
    });
    el.addEventListener('input',function(){
      if(this.value!==''&&parseFloat(this.value)<0){this.value='';}
    });
  });
})();
</script>

</body>
</html>



