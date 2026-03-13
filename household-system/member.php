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
if (stripos($brandLabel, 'barangay') !== 0) {
  $brandLabel = trim('Barangay ' . $brandLabel);
}
$systemLabel = trim($brandLabel . ($brandCity !== '' ? ' ' . $brandCity : '') . ' Household Information Management System');
$memberOfflineInitVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-offline-init.js') ?: time());
$memberScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/member-scripts.js') ?: time());
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0d6efd">
  <link rel="manifest" href="manifest.webmanifest">
  <title>Add Household Member</title>

  <!-- Bootstrap CSS -->
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/registration-style.css">
</head>

<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>
  <div class="py-4 page-wrap">
    <div class="page-header mb-4">
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-3 header-row">
        <div class="d-flex align-items-center gap-3 header-main">
          <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandLabel, ENT_QUOTES, 'UTF-8') ?> Logo" class="brand-logo">
          <div class="header-text">
            <div class="title">Add Household Member</div>
            <div class="subtitle"><?= htmlspecialchars($systemLabel, ENT_QUOTES, 'UTF-8') ?></div>
          </div>
        </div>
        <div class="header-actions">
          <button type="button" class="btn btn-light btn-sm" id="backBtn">
            <i class="bi bi-arrow-left"></i> Back to Registration
          </button>
        </div>
      </div>
    </div>

    <form id="memberForm">
      <!-- A. Member Information -->
      <div class="card section-card mb-4">
        <div class="card-header section-header d-flex justify-content-between align-items-center">
          <span>A. Member Information</span>
          <span class="badge rounded-pill">Required</span>
        </div>
        <div class="card-body member-info-body">
          <div class="member-info-group">
            <div class="member-info-group-title">Identity</div>
            <div class="row g-3">
              <div class="col-xl-3 col-md-6"><label class="form-label required" for="first_name">First Name</label><input type="text" class="form-control" id="first_name" required></div>
              <div class="col-xl-3 col-md-6"><label class="form-label" for="middle_name">Middle Name</label><input type="text" class="form-control" id="middle_name"></div>
              <div class="col-xl-3 col-md-6"><label class="form-label required" for="last_name">Last Name</label><input type="text" class="form-control" id="last_name" required></div>
              <div class="col-xl-3 col-md-6"><label class="form-label" for="extension_name">Extension Name</label><input type="text" class="form-control" id="extension_name" placeholder="e.g., Jr., Sr., III"></div>
            </div>
          </div>

          <div class="member-info-group">
            <div class="member-info-group-title">Profile Details</div>
            <div class="row g-3">
              <div class="col-lg-3 col-md-6"><label class="form-label required" for="birthday">Birthday</label><input type="date" class="form-control" id="birthday" required></div>
              <div class="col-lg-2 col-md-4"><label class="form-label" for="age">Age</label><input type="number" class="form-control" id="age" readonly></div>
              <div class="col-lg-2 col-md-4"><label class="form-label required" for="sex">Sex/Gender</label>
                <select class="form-select" id="sex" required>
                  <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
              <div class="col-lg-2 col-md-4"><label class="form-label required" for="civil_status">Civil Status</label>
                <select class="form-select" id="civil_status" required>
                  <option value="">Select</option>
                  <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
                </select>
              </div>
              <div class="col-lg-3 col-md-12"><label class="form-label" for="relation_to_head">Relationship to Head</label>
                <select class="form-select" id="relation_to_head">
                  <option value="">Select</option>
                  <option>Father</option>
                  <option>Mother</option>
                  <option>Son</option>
                  <option>Daughter</option>
                </select>
              </div>
              <div class="col-lg-3 col-md-6"><label class="form-label" for="citizenship">Nationality/Citizenship</label><input type="text" class="form-control" id="citizenship" value="Filipino"></div>
              <div class="col-lg-3 col-md-6"><label class="form-label" for="religion">Religion</label><input type="text" class="form-control" id="religion"></div>
              <div class="col-lg-2 col-md-4"><label class="form-label" for="blood_type">Blood Type</label><input type="text" class="form-control" id="blood_type"></div>
              <div class="col-lg-2 col-md-4"><label class="form-label" for="height">Height (cm)</label><input type="number" class="form-control" id="height"></div>
              <div class="col-lg-2 col-md-4"><label class="form-label" for="weight">Weight (kg)</label><input type="number" class="form-control" id="weight"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- B. Contact & Location -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">B. Contact & Location</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label" for="contact">Contact Number</label><input type="tel" class="form-control" id="contact"></div>
            <div class="col-md-4"><label class="form-label" for="address">Complete Address</label><input type="text" class="form-control" id="address"></div>
            <div class="col-md-4"><label class="form-label" for="zone">Zone</label><input type="text" class="form-control" id="zone"></div>
            <div class="col-md-4"><label class="form-label" for="barangay">Barangay</label><input type="text" class="form-control" id="barangay"></div>
            <div class="col-md-4"><label class="form-label" for="city">City/Municipality</label><input type="text" class="form-control" id="city"></div>
            <div class="col-md-4"><label class="form-label" for="province">Province</label><input type="text" class="form-control" id="province"></div>
          </div>
        </div>
      </div>

      <!-- C. Education -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">C. Education</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label" for="education">Educational Attainment</label><input type="text" class="form-control" id="education"></div>
            <div class="col-md-4"><label class="form-label" for="degree">Degree/Course</label><input type="text" class="form-control" id="degree"></div>
            <div class="col-md-4"><label class="form-label" for="school_name">School Name</label><input type="text" class="form-control" id="school_name"></div>
            <div class="col-md-3"><label class="form-label" for="school_type">School Type</label>
              <select class="form-select" id="school_type"><option>Private</option><option>Public</option></select>
            </div>
            <div class="col-md-3"><label class="form-label" for="dropout">Drop Out?</label><select class="form-select" id="dropout"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-3"><label class="form-label" for="osy">Out of School Youth?</label><select class="form-select" id="osy"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-3"><label class="form-label" for="currently_studying">Currently Studying?</label><select class="form-select" id="currently_studying"><option>No</option><option>Yes</option></select></div>
          </div>
        </div>
      </div>

      <!-- D. Employment -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">D. Employment</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3"><label class="form-label" for="occupation">Occupation</label><input type="text" class="form-control" id="occupation"></div>
            <div class="col-md-3"><label class="form-label" for="employment_status">Employment Status</label>
              <select class="form-select" id="employment_status"><option>Employed</option><option>Unemployed</option><option>Self-employed</option></select>
            </div>
            <div class="col-md-3"><label class="form-label" for="work_type">Type of Work</label>
              <select class="form-select" id="work_type"><option>Government</option><option>Private</option><option>Freelance</option></select>
            </div>
            <div class="col-md-3"><label class="form-label" for="monthly_income">Monthly Income</label><input type="text" class="form-control" id="monthly_income" placeholder="optional"></div>
          </div>
        </div>
      </div>

      <!-- E. Social Welfare -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">E. Social Welfare</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3"><label class="form-label" for="four_ps">4Ps Member?</label><select class="form-select" id="four_ps"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-3"><label class="form-label" for="senior">Senior Citizen?</label><select class="form-select" id="senior"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-3"><label class="form-label" for="pwd">PWD?</label><select class="form-select" id="pwd"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-3"><label class="form-label" for="ip">Indigenous People (IP)?</label><select class="form-select" id="ip"><option>No</option><option>Yes</option></select></div>
          </div>
        </div>
      </div>

      <!-- F. Voter Info -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">F. Voter Information</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label" for="voter">Registered Voter?</label><select class="form-select" id="voter"><option>No</option><option>Yes</option></select></div>
            <div class="col-md-6"><label class="form-label" for="precinct">Precinct Number</label><input type="text" class="form-control" id="precinct"></div>
          </div>
        </div>
      </div>

      <!-- G. Government IDs -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">G. Government IDs</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-4"><label class="form-label" for="sss">SSS Number</label><input type="text" class="form-control" id="sss"></div>
            <div class="col-md-4"><label class="form-label" for="philhealth">PhilHealth Number</label><input type="text" class="form-control" id="philhealth"></div>
            <div class="col-md-4"><label class="form-label" for="gsis">GSIS Number</label><input type="text" class="form-control" id="gsis"></div>
            <div class="col-md-3"><label class="form-label" for="tin">TIN Number</label><input type="text" class="form-control" id="tin"></div>
            <div class="col-md-3"><label class="form-label" for="philid">PhilSys National ID</label><input type="text" class="form-control" id="philid"></div>
            <div class="col-md-3"><label class="form-label" for="driver_license">Driver's License</label><input type="text" class="form-control" id="driver_license"></div>
            <div class="col-md-3"><label class="form-label" for="passport">Passport Number</label><input type="text" class="form-control" id="passport"></div>
          </div>
        </div>
      </div>

      <div class="action-bar">
        <div class="d-flex justify-content-end gap-2">
          <button type="button" class="btn btn-outline-primary" id="cancelBtn"><i class="bi bi-arrow-left"></i> Back</button>
          <button type="reset" class="btn btn-secondary" id="clearBtn"><i class="bi bi-x-circle"></i> Clear</button>
          <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Save Member</button>
        </div>
      </div>
    </form>
  </div>

  <footer class="footer page-footer py-3 text-center mt-4">
    <div class="page-wrap">
      <p class="mb-1 fw-semibold"><?= htmlspecialchars($systemLabel, ENT_QUOTES, 'UTF-8') ?></p>
      <p class="mb-0 small">&copy; <span id="year"></span> <?= htmlspecialchars(trim($brandLabel . ($brandCity !== '' ? ', ' . $brandCity : '')), ENT_QUOTES, 'UTF-8') ?></p>
    </div>
  </footer>

  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/indexeddb-storage-scripts.js"></script>
  <script src="assets/js/registration-offline-init.js?v=<?= htmlspecialchars($memberOfflineInitVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
  <script src="assets/js/member-scripts.js?v=<?= htmlspecialchars($memberScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>



