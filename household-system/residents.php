<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
$authRole = auth_user_role($authUser);
$csrfToken = auth_csrf_token();
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
$brandCoreCandidate = preg_replace('/^\s*barangay\b[\s,]*/i', '', $brandLabel);
$brandCore = trim((string) ($brandCoreCandidate ?? $brandLabel));
if ($brandCore === '') {
  $brandCore = trim($brandLabel);
}
$brandFooterLabel = $brandCore !== '' ? 'Barangay ' . $brandCore : 'Barangay';
if ($brandCity !== '' && stripos($brandFooterLabel, $brandCity) === false) {
  $brandFooterLabel = trim($brandFooterLabel . ', ' . $brandCity);
}
$brandSidebarLabel = $brandCore;
if ($brandCity !== '' && stripos($brandSidebarLabel, $brandCity) === false) {
  $brandSidebarLabel = trim($brandSidebarLabel . ' ' . $brandCity);
}
if ($brandSidebarLabel === '') {
  $brandSidebarLabel = $brandFooterLabel;
}
$systemLabel = trim($brandFooterLabel . ' Household Information Management System');
$siteStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/site-style.css') ?: time());
$residentsStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/residents-style.css') ?: time());
$residentsScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/residents-scripts.js') ?: time());
?>

<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Residents | Barangay Captain Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">

<!-- Bootstrap CSS -->
<link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
<link rel="stylesheet" href="assets/css/site-style.css?v=<?= htmlspecialchars($siteStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
<link rel="stylesheet" href="assets/css/residents-style.css?v=<?= htmlspecialchars($residentsStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
<style>
  #residentDetailsContact .resident-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 14px;
    align-items: start;
  }

  #residentDetailsProfile .resident-profile-grid-top {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 14px;
    align-items: start;
  }

  #residentDetailsProfile .resident-profile-grid-bottom {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 14px;
    align-items: start;
    margin-top: 12px;
  }

  #residentDetailsGov .resident-gov-grid-top {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px 14px;
    align-items: start;
  }

  #residentDetailsGov .resident-gov-grid-bottom {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px 14px;
    align-items: start;
    margin-top: 12px;
  }

  @media (max-width: 992px) {
    #residentDetailsGov .resident-gov-grid-top,
    #residentDetailsGov .resident-gov-grid-bottom {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 768px) {
    #residentDetailsContact .resident-detail-grid {
      grid-template-columns: 1fr;
    }

    #residentDetailsProfile .resident-profile-grid-top,
    #residentDetailsProfile .resident-profile-grid-bottom {
      grid-template-columns: 1fr;
    }

    #residentDetailsGov .resident-gov-grid-top,
    #residentDetailsGov .resident-gov-grid-bottom {
      grid-template-columns: 1fr;
    }
  }
</style>

</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">

  <div id="content-area">
    <!-- SIDEBAR -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?> Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
      <div class="menu">
        <a href="index.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php" class="active"><i class="bi bi-people"></i>Residents</a>
        <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger"><i class="bi bi-box-arrow-right"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- MAIN -->
    <main id="main">
      <div class="topbar">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-list toggle-btn" onclick="toggleSidebar()"></i>
          <h4 class="mb-0 text-primary">Residents</h4>
        </div>
        <div>
          <select id="yearSelect" class="form-select d-inline w-auto"></select>
          <button class="btn btn-outline-primary ms-2" id="refreshBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <section class="module residents-module">
        <div class="module-header residents-header">
          <div>
            <h5 class="mb-1 fw-bold">Residents Overview</h5>
            <p class="mb-0 text-muted small">Directory of registered residents</p>
          </div>
          <div class="residents-toolbar">
              <select class="form-select form-select-sm" id="residentZoneFilter">
                <option value="all">All Zones</option>
              </select>
              <div class="search-inline residents-search">
                <input type="text" id="residentSearchInput" class="form-control" placeholder="Search name, resident ID, or household">
                <i class="bi bi-search"></i>
              </div>
          </div>
        </div>

        <div class="resident-filter-row">
          <div class="resident-filter-label">Quick Filter</div>
          <div class="resident-filter-pills" role="group" aria-label="Resident quick filters">
            <button type="button" class="resident-filter-pill is-active" data-filter="all" aria-pressed="true">All</button>
            <button type="button" class="resident-filter-pill" data-filter="male" aria-pressed="false">Male</button>
            <button type="button" class="resident-filter-pill" data-filter="female" aria-pressed="false">Female</button>
            <button type="button" class="resident-filter-pill" data-filter="senior" aria-pressed="false">Senior</button>
            <button type="button" class="resident-filter-pill" data-filter="pwd" aria-pressed="false">PWD</button>
            <button type="button" class="resident-filter-pill" data-filter="pregnant" aria-pressed="false">Pregnant</button>
          </div>
          <div class="resident-filter-count text-muted small" id="residentVisibleCount">0 records</div>
        </div>

        <div class="module-table resident-table-wrap table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Resident ID</th>
                <th>Name</th>
                <th>Age</th>
                <th>Sex</th>
                <th>Household</th>
                <th>Zone</th>
                <th>Last Updated</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody id="residentsTableBody">
              <tr id="residentsLoadingRow">
                <td colspan="8" class="text-center text-muted">Loading residents...</td>
              </tr>
              <tr id="residentsEmptyRow" class="d-none">
                <td colspan="8" class="text-center text-muted">No residents found.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>

  <!-- FOOTER -->
  <footer class="footer text-muted">
    &copy; <span id="year"></span> <?= htmlspecialchars($systemLabel, ENT_QUOTES, 'UTF-8') ?>. All rights reserved.
  </footer>

  <!-- RESIDENT DETAILS MODAL -->
  <div class="modal fade" id="residentDetailsModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Resident Details</h5>
            <p class="text-muted small mb-0" id="rdRelation">-</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <div class="accordion resident-modal-accordion" id="residentDetailsAccordion">
            <div class="accordion-item">
              <h2 class="accordion-header" id="residentDetailsBasicHead">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#residentDetailsBasic" aria-expanded="true" aria-controls="residentDetailsBasic">
                  Basic Information
                </button>
              </h2>
              <div id="residentDetailsBasic" class="accordion-collapse collapse show" aria-labelledby="residentDetailsBasicHead" data-bs-parent="#residentDetailsAccordion">
                <div class="accordion-body">
                  <div class="resident-detail-grid">
                    <div class="resident-detail-item"><span class="k">Full Name</span><span class="v" id="rdName">-</span></div>
                    <div class="resident-detail-item"><span class="k">Relation</span><span class="v" id="rdRelationToHeadValue">-</span></div>
                    <div class="resident-detail-item"><span class="k">Birthday</span><span class="v" id="rdBirthday">-</span></div>
                    <div class="resident-detail-item"><span class="k">Age</span><span class="v" id="rdAge">-</span></div>
                    <div class="resident-detail-item"><span class="k">Sex</span><span class="v" id="rdSex">-</span></div>
                    <div class="resident-detail-item"><span class="k">Civil Status</span><span class="v" id="rdCivilStatus">-</span></div>
                    <div class="resident-detail-item"><span class="k">Citizenship</span><span class="v" id="rdCitizenship">-</span></div>
                    <div class="resident-detail-item"><span class="k">Religion</span><span class="v" id="rdReligion">-</span></div>
                    <div class="resident-detail-item"><span class="k">Blood Type</span><span class="v" id="rdBloodType">-</span></div>
                    <div class="resident-detail-item"><span class="k">Pregnant</span><span class="v" id="rdPregnant">-</span></div>
                    <div class="resident-detail-item"><span class="k">Height</span><span class="v" id="rdHeight">-</span></div>
                    <div class="resident-detail-item"><span class="k">Weight</span><span class="v" id="rdWeight">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="residentDetailsContactHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#residentDetailsContact" aria-expanded="false" aria-controls="residentDetailsContact">
                  Contact and Address
                </button>
              </h2>
              <div id="residentDetailsContact" class="accordion-collapse collapse" aria-labelledby="residentDetailsContactHead" data-bs-parent="#residentDetailsAccordion">
                <div class="accordion-body">
                  <div class="resident-detail-grid">
                    <div class="resident-detail-item"><span class="k">Contact</span><span class="v" id="rdContact">-</span></div>
                    <div class="resident-detail-item"><span class="k">Zone</span><span class="v" id="rdZone">-</span></div>
                    <div class="resident-detail-item"><span class="k">Barangay</span><span class="v" id="rdBarangay">-</span></div>
                    <div class="resident-detail-item"><span class="k">City/Municipality</span><span class="v" id="rdCity">-</span></div>
                    <div class="resident-detail-item"><span class="k">Province</span><span class="v" id="rdProvince">-</span></div>
                    <div class="resident-detail-item"><span class="k">Address</span><span class="v" id="rdAddress">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="residentDetailsProfileHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#residentDetailsProfile" aria-expanded="false" aria-controls="residentDetailsProfile">
                  Education and Employment
                </button>
              </h2>
              <div id="residentDetailsProfile" class="accordion-collapse collapse" aria-labelledby="residentDetailsProfileHead" data-bs-parent="#residentDetailsAccordion">
                <div class="accordion-body">
                  <div class="resident-profile-grid-top">
                    <div class="resident-detail-item"><span class="k">Education</span><span class="v" id="rdEducation">-</span></div>
                    <div class="resident-detail-item"><span class="k">Degree/Course</span><span class="v" id="rdDegree">-</span></div>
                    <div class="resident-detail-item"><span class="k">School Name</span><span class="v" id="rdSchoolName">-</span></div>
                    <div class="resident-detail-item"><span class="k">School Type</span><span class="v" id="rdSchoolType">-</span></div>
                    <div class="resident-detail-item"><span class="k">Dropout</span><span class="v" id="rdDropout">-</span></div>
                    <div class="resident-detail-item"><span class="k">Out of School Youth</span><span class="v" id="rdOSY">-</span></div>
                    <div class="resident-detail-item"><span class="k">Currently Studying</span><span class="v" id="rdCurrentlyStudying">-</span></div>
                    <div class="resident-detail-item"><span class="k">Occupation</span><span class="v" id="rdOccupation">-</span></div>
                  </div>
                  <div class="resident-profile-grid-bottom">
                    <div class="resident-detail-item"><span class="k">Employment Status</span><span class="v" id="rdEmploymentStatus">-</span></div>
                    <div class="resident-detail-item"><span class="k">Work Type</span><span class="v" id="rdWorkType">-</span></div>
                    <div class="resident-detail-item"><span class="k">Monthly Income</span><span class="v" id="rdMonthlyIncome">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="residentDetailsGovHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#residentDetailsGov" aria-expanded="false" aria-controls="residentDetailsGov">
                  Government IDs and Social Welfare
                </button>
              </h2>
              <div id="residentDetailsGov" class="accordion-collapse collapse" aria-labelledby="residentDetailsGovHead" data-bs-parent="#residentDetailsAccordion">
                <div class="accordion-body">
                  <div class="resident-gov-grid-top">
                    <div class="resident-detail-item"><span class="k">4Ps Beneficiary</span><span class="v" id="rd4ps">-</span></div>
                    <div class="resident-detail-item"><span class="k">PWD</span><span class="v" id="rdPWD">-</span></div>
                    <div class="resident-detail-item"><span class="k">Senior Citizen</span><span class="v" id="rdSenior">-</span></div>
                    <div class="resident-detail-item"><span class="k">Indigenous People</span><span class="v" id="rdIP">-</span></div>
                  </div>
                  <div class="resident-gov-grid-bottom">
                    <div class="resident-detail-item"><span class="k">Registered Voter</span><span class="v" id="rdVoter">-</span></div>
                    <div class="resident-detail-item"><span class="k">Precinct</span><span class="v" id="rdPrecinct">-</span></div>
                    <div class="resident-detail-item"><span class="k">SSS</span><span class="v" id="rdSSS">-</span></div>
                    <div class="resident-detail-item"><span class="k">PhilHealth</span><span class="v" id="rdPhilhealth">-</span></div>
                    <div class="resident-detail-item"><span class="k">GSIS</span><span class="v" id="rdGSIS">-</span></div>
                    <div class="resident-detail-item"><span class="k">TIN</span><span class="v" id="rdTIN">-</span></div>
                    <div class="resident-detail-item"><span class="k">PhilSys ID</span><span class="v" id="rdPhilID">-</span></div>
                    <div class="resident-detail-item"><span class="k">Driver's License</span><span class="v" id="rdDriverLicense">-</span></div>
                    <div class="resident-detail-item"><span class="k">Passport</span><span class="v" id="rdPassport">-</span></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        <div class="modal-footer border-0 pt-0 resident-modal-footer">
          <?php if ($authRole === AUTH_ROLE_ADMIN): ?>
            <button type="button" class="btn btn-outline-primary btn-modern" id="residentEditBtn">
              <i class="bi bi-pencil-square"></i> Edit
            </button>
            <button type="button" class="btn btn-outline-danger btn-modern" id="residentDeleteBtn">
              <i class="bi bi-trash"></i> Delete
            </button>
          <?php endif; ?>
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
        </div>
      </div>
    </div>
  </div>

  <!-- RESIDENT DELETE CONFIRM MODAL -->
  <div class="modal fade" id="residentDeleteConfirmModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal resident-delete-confirm-modal text-center p-4">
        <div class="modal-icon mb-3 text-danger">
          <i class="bi bi-trash fs-1"></i>
        </div>
        <h5 class="modal-title mb-2" id="residentDeleteConfirmTitle">Delete Resident</h5>
        <p class="resident-delete-confirm-copy mb-3">
          This will delete <strong id="residentDeleteConfirmTarget">RS-</strong>. This action cannot be undone.
        </p>
        <div class="resident-delete-confirm-actions">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="residentDeleteConfirmBtn">Confirm Delete</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODERN REFRESH MODAL -->
  <div class="modal fade" id="refreshModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <h5 class="modal-title mb-2">Refreshing Data</h5>
        <p class="mb-3">Please wait while we refresh the data.</p>
        <button type="button" class="btn btn-primary btn-modern" data-bs-dismiss="modal">OK</button>
      </div>
    </div>
  </div>

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

  <!-- Bootstrap JS bundle -->
  <script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/responsive-table-scripts.js"></script>
  <script src="assets/js/residents-scripts.js?v=<?= htmlspecialchars($residentsScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>


