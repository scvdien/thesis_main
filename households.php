<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
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
$householdsScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/households-scripts.js') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Households | Barangay Captain Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">

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
        <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?> Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
      <div class="menu">
        <a href="index.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php" class="active"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
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
          <h4 class="mb-0 text-primary">Households</h4>
        </div>
        <div>
          <select id="yearSelect" class="form-select d-inline w-auto"></select>
          <button class="btn btn-outline-primary ms-2" id="refreshBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <section class="module households-module">
        <div class="module-header">
          <div>
            <h5 class="mb-1 fw-bold">Households Overview</h5>
            <p class="mb-0 text-muted small">Latest household registrations</p>
          </div>
          <div class="households-toolbar">
            <select class="form-select form-select-sm" id="householdZoneFilter">
              <option value="all">All Zones</option>
            </select>
            <div class="search-inline households-search">
              <input type="text" id="householdSearchInput" class="form-control" placeholder="Search head, household ID, or zone">
              <i class="bi bi-search"></i>
            </div>
            <a href="registration.php" class="btn btn-primary btn-sm role-secretary-only d-inline-flex align-items-center gap-1 household-toolbar-add">
              <i class="bi bi-plus-circle"></i> Add Household
            </a>
          </div>
        </div>

        <div class="module-table household-table-wrap table-responsive">
          <table class="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th>Household ID</th>
                <th>Head of Household</th>
                <th>Zone</th>
                <th>Members</th>
                <th>Last Updated</th>
                <th class="text-end">Action</th>
              </tr>
            </thead>
            <tbody id="householdsTableBody">
              <tr id="householdsLoadingRow">
                <td colspan="6" class="text-center text-muted">Loading households...</td>
              </tr>
              <tr id="householdsEmptyRow" class="d-none">
                <td colspan="6" class="text-center text-muted">No households found.</td>
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

  <!-- HOUSEHOLD DETAILS MODAL -->
  <div class="modal fade" id="householdModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content modern-modal">
          <div class="modal-header border-0 pb-0">
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <span class="hh-id-badge" id="hhModalId">HH-</span>
                <span class="hh-status" id="hhModalStatus">-</span>
              </div>
              <p class="text-muted small mb-0" id="hhModalUpdated">-</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body pt-3">
            <div class="hh-card">
              <div class="section-head">
                <span class="label mb-0">Head Snapshot</span>
              </div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Name</div><div class="v" id="hhHeadName">-</div></div>
                <div class="kv"><div class="k">Age</div><div class="v" id="hhHeadAge">-</div></div>
                <div class="kv"><div class="k">Sex</div><div class="v" id="hhHeadSex">-</div></div>
                <div class="kv"><div class="k">Civil Status</div><div class="v" id="hhHeadCivil">-</div></div>
                <div class="kv"><div class="k">Birthday</div><div class="v" id="hhHeadBirthday">-</div></div>
                <div class="kv"><div class="k">Citizenship</div><div class="v" id="hhHeadCitizenship">-</div></div>
                <div class="kv"><div class="k">Religion</div><div class="v" id="hhHeadReligion">-</div></div>
                <div class="kv"><div class="k">Blood Type</div><div class="v" id="hhHeadBlood">-</div></div>
                <div class="kv"><div class="k">Height</div><div class="v" id="hhHeadHeight">-</div></div>
                <div class="kv"><div class="k">Weight</div><div class="v" id="hhHeadWeight">-</div></div>
                <div class="kv"><div class="k">Pregnant</div><div class="v" id="hhHeadPregnant">-</div></div>
              </div>
            </div>

            <div class="hh-card">
              <div class="section-head"><span class="label mb-0">Contact & Address</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Contact</div><div class="v" id="hhHeadContact">-</div></div>
                <div class="kv"><div class="k">Address</div><div class="v" id="hhHeadAddress">-</div></div>
                <div class="kv"><div class="k">Zone</div><div class="v" id="hhHeadZone">-</div></div>
                <div class="kv"><div class="k">Barangay</div><div class="v" id="hhHeadBarangay">-</div></div>
                <div class="kv"><div class="k">City/Municipality</div><div class="v" id="hhHeadCity">-</div></div>
                <div class="kv"><div class="k">Province</div><div class="v" id="hhHeadProvince">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Education</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Attainment</div><div class="v" id="hhHeadEducation">-</div></div>
                <div class="kv"><div class="k">Degree/Course</div><div class="v" id="hhHeadDegree">-</div></div>
                <div class="kv"><div class="k">School</div><div class="v" id="hhHeadSchool">-</div></div>
                <div class="kv"><div class="k">School Type</div><div class="v" id="hhHeadSchoolType">-</div></div>
                <div class="kv"><div class="k">Drop Out</div><div class="v" id="hhHeadDropout">-</div></div>
                <div class="kv"><div class="k">OSY</div><div class="v" id="hhHeadOSY">-</div></div>
                <div class="kv"><div class="k">Studying</div><div class="v" id="hhHeadCurrentlyStudying">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Employment</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Occupation</div><div class="v" id="hhHeadOccupation">-</div></div>
                <div class="kv"><div class="k">Employment Status</div><div class="v" id="hhHeadEmploymentStatus">-</div></div>
                <div class="kv"><div class="k">Work Type</div><div class="v" id="hhHeadWorkType">-</div></div>
                <div class="kv"><div class="k">Monthly Income</div><div class="v" id="hhHeadIncome">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Social Welfare</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">4Ps</div><div class="v" id="hhHead4ps">-</div></div>
                <div class="kv"><div class="k">Senior</div><div class="v" id="hhHeadSenior">-</div></div>
                <div class="kv"><div class="k">PWD</div><div class="v" id="hhHeadPWD">-</div></div>
                <div class="kv"><div class="k">Indigenous People</div><div class="v" id="hhHeadIP">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Voter & IDs</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Registered Voter</div><div class="v" id="hhHeadVoter">-</div></div>
                <div class="kv"><div class="k">Precinct</div><div class="v" id="hhHeadPrecinct">-</div></div>
                <div class="kv"><div class="k">SSS</div><div class="v" id="hhHeadSSS">-</div></div>
                <div class="kv"><div class="k">PhilHealth</div><div class="v" id="hhHeadPhilhealth">-</div></div>
                <div class="kv"><div class="k">GSIS</div><div class="v" id="hhHeadGSIS">-</div></div>
                <div class="kv"><div class="k">TIN</div><div class="v" id="hhHeadTIN">-</div></div>
                <div class="kv"><div class="k">PhilSys ID</div><div class="v" id="hhHeadPhilID">-</div></div>
                <div class="kv"><div class="k">Driver's License</div><div class="v" id="hhHeadDriver">-</div></div>
                <div class="kv"><div class="k">Passport</div><div class="v" id="hhHeadPassport">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Household Data</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Members</div><div class="v" id="hhHouseNumMembers">-</div></div>
                <div class="kv"><div class="k">Relation to Head</div><div class="v" id="hhHouseRelationToHead">-</div></div>
                <div class="kv"><div class="k">Children</div><div class="v" id="hhHouseNumChildren">-</div></div>
                <div class="kv"><div class="k">Marital Partner</div><div class="v" id="hhHousePartnerName">-</div></div>
              </div>
            </div>

            <div class="hh-card two-col">
              <div class="section-head"><span class="label mb-0">Housing & Utilities</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Ownership</div><div class="v" id="hhHouseOwnership">-</div></div>
                <div class="kv"><div class="k">House Type</div><div class="v" id="hhHouseType">-</div></div>
                <div class="kv"><div class="k">Toilet</div><div class="v" id="hhHouseToilet">-</div></div>
                <div class="kv"><div class="k">Rooms</div><div class="v" id="hhHouseRooms">-</div></div>
                <div class="kv"><div class="k">Electricity</div><div class="v" id="hhHouseElectricity">-</div></div>
                <div class="kv"><div class="k">Water Source</div><div class="v" id="hhHouseWater">-</div></div>
                <div class="kv"><div class="k">Internet</div><div class="v" id="hhHouseInternet">-</div></div>
              </div>
            </div>

            <div class="hh-card">
              <div class="section-head"><span class="label mb-0">Health Summary</span></div>
              <div class="hh-kv-grid">
                <div class="kv"><div class="k">Current Illness</div><div class="v" id="hhHealthCurrentIllness">-</div></div>
                <div class="kv"><div class="k">Illness Type</div><div class="v" id="hhHealthIllnessType">-</div></div>
                <div class="kv"><div class="k">Chronic Diseases</div><div class="v" id="hhHealthChronic">-</div></div>
                <div class="kv"><div class="k">Common Illness</div><div class="v" id="hhHealthCommon">-</div></div>
                <div class="kv"><div class="k">Maintenance Meds</div><div class="v" id="hhHealthMaintenance">-</div></div>
                <div class="kv"><div class="k">Medicine</div><div class="v" id="hhHealthMedicine">-</div></div>
                <div class="kv"><div class="k">Frequency</div><div class="v" id="hhHealthFrequency">-</div></div>
                <div class="kv"><div class="k">Source</div><div class="v" id="hhHealthSource">-</div></div>
                <div class="kv"><div class="k">Pregnant (Mother)</div><div class="v" id="hhHealthPregnant">-</div></div>
                <div class="kv"><div class="k">Months Pregnant</div><div class="v" id="hhHealthMonthsPregnant">-</div></div>
                <div class="kv"><div class="k">Prenatal Care</div><div class="v" id="hhHealthPrenatal">-</div></div>
                <div class="kv"><div class="k">Child Immunized</div><div class="v" id="hhHealthChildImmunized">-</div></div>
                <div class="kv"><div class="k">Child Malnutrition</div><div class="v" id="hhHealthChildMalnutrition">-</div></div>
                <div class="kv"><div class="k">Child Sick/Year</div><div class="v" id="hhHealthChildSick">-</div></div>
                <div class="kv"><div class="k">Has Disability</div><div class="v" id="hhHealthDisability">-</div></div>
              </div>
            </div>

            <div class="hh-card">
              <div class="section-head">
                <span class="label mb-0">Household Members</span>
                <span class="muted small" id="hhModalMembersCount"></span>
              </div>
              <ul class="hh-member-list" id="hhModalMembersList"></ul>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0">
            <button class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
            <div class="ms-auto d-flex gap-2">
              <button id="hhModalEditBtn" class="btn btn-primary btn-modern role-secretary-only">Edit</button>
              <button id="hhModalDeleteBtn" class="btn btn-danger btn-modern role-secretary-only">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- EDIT HOUSEHOLD MODAL (SECRETARY ONLY) -->
  <div class="modal fade" id="editHouseholdModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Edit Household</h5>
            <p class="text-muted small mb-0" id="editHouseholdId">HH-</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <div class="settings-form-grid">
            <div>
              <label class="form-label small">Head of Household</label>
              <input type="text" class="form-control" id="editHouseholdHead">
            </div>
            <div>
              <label class="form-label small">Zone</label>
              <input type="text" class="form-control" id="editHouseholdZone">
            </div>
            <div>
              <label class="form-label small">Members</label>
              <input type="number" class="form-control" id="editHouseholdMembers">
            </div>
            <div>
              <label class="form-label small">Status</label>
              <select class="form-select" id="editHouseholdStatus">
                <option>Verified</option>
                <option>Pending</option>
                <option>Unverified</option>
              </select>
            </div>
            <div class="settings-form-full">
              <label class="form-label small">Address</label>
              <input type="text" class="form-control" id="editHouseholdAddress">
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button class="btn btn-primary btn-modern" data-bs-dismiss="modal">Save Changes</button>
        </div>
      </div>
    </div>
  </div>

  <!-- DELETE HOUSEHOLD MODAL (SECRETARY ONLY) -->
  <div class="modal fade" id="deleteHouseholdModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-danger">
          <i class="bi bi-trash fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Delete Household</h5>
        <p class="mb-3">This will delete <strong id="deleteHouseholdId">HH-</strong>. This action cannot be undone.</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" data-bs-dismiss="modal">Confirm Delete</button>
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
  <script src="assets/js/households-scripts.js?v=<?= htmlspecialchars($householdsScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>


