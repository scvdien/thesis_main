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
$brandSidebarLabel = $brandLabel;
if ($brandCity !== '' && stripos($brandLabel, $brandCity) === false) {
  $brandSidebarLabel = trim($brandLabel . ' ' . $brandCity);
}
$siteStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/site-style.css') ?: time());
$householdViewStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/household-view.css') ?: time());
$householdViewScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/household-view.js') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="csrf-token" content="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
  <title>Household Details | Admin</title>
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/site-style.css?v=<?= htmlspecialchars($siteStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
  <link rel="stylesheet" href="assets/css/household-view.css?v=<?= htmlspecialchars($householdViewStyleVersion, ENT_QUOTES, 'UTF-8') ?>">
</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">
  <div id="content-area">
    <!-- SIDEBAR (reuse) -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="<?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?> Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary"><?= htmlspecialchars($brandSidebarLabel, ENT_QUOTES, 'UTF-8') ?></span>
      </div>
      <div class="menu">
        <a href="admin.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php" class="active"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
        <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger" id="logoutBtn"><i class="bi bi-box-arrow-right"></i>Logout</a>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>

    <!-- MAIN -->
    <main id="main">
      <div class="topbar hv-topbar">
        <div class="hv-toolbar-row">
          <div class="hv-toolbar-left">
            <button class="hv-menu-btn" type="button" onclick="toggleSidebar()" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <a href="households.php" class="btn btn-light border hv-back-btn">
              <i class="bi bi-arrow-left-short"></i> Back to Households
            </a>
          </div>
          <div class="dropdown role-secretary-only">
            <button class="btn btn-primary btn-modern dropdown-toggle hv-actions-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-sliders2"></i> Actions
            </button>
            <ul class="dropdown-menu dropdown-menu-end hv-actions-menu">
              <li>
                <button id="viewEditBtn" class="dropdown-item" type="button">
                  <i class="bi bi-pencil"></i> Edit household
                </button>
              </li>
              <li><hr class="dropdown-divider"></li>
              <li>
                <button id="viewDeleteBtn" class="dropdown-item text-danger" type="button">
                  <i class="bi bi-trash"></i> Delete household
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <section class="hv-summary">
        <div class="hv-pill hv-pill-record">
          <div class="pill-head">
            <div class="label">Record ID</div>
            <i class="bi bi-upc-scan"></i>
          </div>
          <div class="value" id="hvId">-</div>
        </div>
        <div class="hv-pill hv-pill-status">
          <div class="pill-head">
            <div class="label">Status</div>
            <i class="bi bi-patch-check"></i>
          </div>
          <div class="badge status" id="hvStatus">-</div>
        </div>
        <div class="hv-pill hv-pill-updated">
          <div class="pill-head">
            <div class="label">Last Updated</div>
            <i class="bi bi-clock-history"></i>
          </div>
          <div class="value" id="hvUpdated">-</div>
        </div>
        <div class="hv-pill hv-pill-members">
          <div class="pill-head">
            <div class="label">Members</div>
            <i class="bi bi-people"></i>
          </div>
          <div class="value" id="hvMembersCount">-</div>
        </div>
      </section>

      <section class="hv-grid">
        <div class="hv-card hv-card-primary" id="hv-card-head">
          <div class="hv-head"><i class="bi bi-person-vcard"></i> Primary Information</div>
          <div class="hv-primary-grid">
            <div class="hv-primary-main">
              <p class="hv-primary-label mb-1">Household Head</p>
              <h5 class="mb-2" id="hvHeadName">-</h5>
              <p class="hv-primary-note mb-3">Primary resident listed for this household record.</p>
              <div class="hv-chip-row">
                <div class="hv-chip"><span class="k">Age</span><span class="v" id="hvHeadAge">-</span></div>
                <div class="hv-chip"><span class="k">Sex</span><span class="v" id="hvHeadSex">-</span></div>
                <div class="hv-chip"><span class="k">Civil Status</span><span class="v" id="hvHeadCivil">-</span></div>
              </div>
            </div>
            <div class="hv-primary-group">
              <p class="hv-primary-group-title">Contact &amp; Location</p>
              <div class="kv-grid hv-quick-kv">
                <div class="kv"><span class="k">Contact</span><span class="v" id="hvHeadContact">-</span></div>
                <div class="kv"><span class="k">Zone / Purok</span><span class="v" id="hvHeadZone">-</span></div>
                <div class="kv wide"><span class="k">Full Address</span><span class="v" id="hvHeadAddress">-</span></div>
              </div>
            </div>
            <div class="hv-primary-group hv-primary-group-snapshot">
              <p class="hv-primary-group-title">Household Snapshot</p>
              <div class="kv-grid hv-quick-kv">
                <div class="kv"><span class="k">Occupation</span><span class="v" id="hvPrimaryOccupation">-</span></div>
                <div class="kv"><span class="k">Children</span><span class="v" id="hvPrimaryChildren">-</span></div>
                <div class="kv"><span class="k">Ownership</span><span class="v" id="hvPrimaryOwnership">-</span></div>
                <div class="kv"><span class="k">House Type</span><span class="v" id="hvPrimaryHouseType">-</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="hv-card" id="hv-card-details">
          <div class="hv-head"><i class="bi bi-journal-text"></i> Complete Household Record</div>
          <div class="accordion hv-accordion" id="hvAccordion">
            <div class="accordion-item">
              <h2 class="accordion-header" id="hvHeadingOne">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#hvCollapseOne" aria-expanded="true" aria-controls="hvCollapseOne">
                  Personal Background
                </button>
              </h2>
              <div id="hvCollapseOne" class="accordion-collapse collapse show" aria-labelledby="hvHeadingOne" data-bs-parent="#hvAccordion">
                <div class="accordion-body">
                  <div class="kv-grid hv-personal-grid">
                    <div class="kv"><span class="k">Birthday</span><span class="v" id="hvHeadBirthday">-</span></div>
                    <div class="kv"><span class="k">Age</span><span class="v" id="hvHeadAgeInPersonal">-</span></div>
                    <div class="kv"><span class="k">Citizenship</span><span class="v" id="hvHeadCitizenship">-</span></div>
                    <div class="kv"><span class="k">Religion</span><span class="v" id="hvHeadReligion">-</span></div>
                    <div class="kv"><span class="k">Blood Type</span><span class="v" id="hvHeadBlood">-</span></div>
                    <div class="kv"><span class="k">Height</span><span class="v" id="hvHeadHeight">-</span></div>
                    <div class="kv"><span class="k">Weight</span><span class="v" id="hvHeadWeight">-</span></div>
                    <div class="kv"><span class="k">Pregnant</span><span class="v" id="hvHeadPregnant">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="hvHeadingTwo">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#hvCollapseTwo" aria-expanded="false" aria-controls="hvCollapseTwo">
                  Education, Employment, and Social Welfare
                </button>
              </h2>
                <div id="hvCollapseTwo" class="accordion-collapse collapse" aria-labelledby="hvHeadingTwo" data-bs-parent="#hvAccordion">
                  <div class="accordion-body">
                    <div class="kv-grid hv-education-grid">
                      <div class="hv-education-top">
                        <div class="kv"><span class="k">Education Attainment</span><span class="v" id="hvHeadEducation">-</span></div>
                        <div class="kv"><span class="k">Degree/Course</span><span class="v" id="hvHeadDegree">-</span></div>
                      </div>
                      <div class="kv wide"><span class="k">School</span><span class="v" id="hvHeadSchool">-</span></div>
                      <div class="kv"><span class="k">School Type</span><span class="v" id="hvHeadSchoolType">-</span></div>
                      <div class="kv"><span class="k">Drop Out</span><span class="v" id="hvHeadDropout">-</span></div>
                      <div class="kv"><span class="k">OSY</span><span class="v" id="hvHeadOSY">-</span></div>
                      <div class="kv"><span class="k">Studying</span><span class="v" id="hvHeadCurrentlyStudying">-</span></div>
                      <div class="kv"><span class="k">Occupation</span><span class="v" id="hvHeadOccupation">-</span></div>
                      <div class="kv"><span class="k">Employment Status</span><span class="v" id="hvHeadEmploymentStatus">-</span></div>
                      <div class="kv"><span class="k">Work Type</span><span class="v" id="hvHeadWorkType">-</span></div>
                      <div class="kv"><span class="k">Monthly Income</span><span class="v" id="hvHeadIncome">-</span></div>
                      <div class="kv"><span class="k">4Ps</span><span class="v" id="hvHead4ps">-</span></div>
                      <div class="kv"><span class="k">Senior</span><span class="v" id="hvHeadSenior">-</span></div>
                      <div class="kv"><span class="k">PWD</span><span class="v" id="hvHeadPWD">-</span></div>
                      <div class="kv"><span class="k">Indigenous People</span><span class="v" id="hvHeadIP">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="hvHeadingThree">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#hvCollapseThree" aria-expanded="false" aria-controls="hvCollapseThree">
                  Voter and Government IDs
                </button>
              </h2>
              <div id="hvCollapseThree" class="accordion-collapse collapse" aria-labelledby="hvHeadingThree" data-bs-parent="#hvAccordion">
                <div class="accordion-body">
                  <div class="kv-grid hv-government-grid">
                    <div class="kv"><span class="k">Registered Voter</span><span class="v" id="hvHeadVoter">-</span></div>
                    <div class="kv"><span class="k">Precinct</span><span class="v" id="hvHeadPrecinct">-</span></div>
                    <div class="kv"><span class="k">SSS</span><span class="v" id="hvHeadSSS">-</span></div>
                    <div class="kv"><span class="k">PhilHealth</span><span class="v" id="hvHeadPhilhealth">-</span></div>
                    <div class="kv"><span class="k">GSIS</span><span class="v" id="hvHeadGSIS">-</span></div>
                    <div class="kv"><span class="k">TIN</span><span class="v" id="hvHeadTIN">-</span></div>
                    <div class="kv"><span class="k">PhilSys ID</span><span class="v" id="hvHeadPhilID">-</span></div>
                    <div class="kv"><span class="k">Driver's License</span><span class="v" id="hvHeadDriver">-</span></div>
                    <div class="kv"><span class="k">Passport</span><span class="v" id="hvHeadPassport">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="hvHeadingFour">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#hvCollapseFour" aria-expanded="false" aria-controls="hvCollapseFour">
                  Household and Housing Information
                </button>
              </h2>
                <div id="hvCollapseFour" class="accordion-collapse collapse" aria-labelledby="hvHeadingFour" data-bs-parent="#hvAccordion">
                  <div class="accordion-body">
                    <div class="hv-house-layout">
                      <div class="kv-grid hv-house-grid">
                        <div class="kv"><span class="k">Members</span><span class="v" id="hvHouseNumMembers">-</span></div>
                        <div class="kv"><span class="k">Relation to Head</span><span class="v" id="hvHouseRelationToHead">-</span></div>
                        <div class="kv"><span class="k">Children</span><span class="v" id="hvHouseNumChildren">-</span></div>
                        <div class="kv"><span class="k">Marital Partner</span><span class="v" id="hvHousePartnerName">-</span></div>
                        <div class="kv"><span class="k">Ownership</span><span class="v" id="hvHouseOwnership">-</span></div>
                        <div class="kv"><span class="k">House Type</span><span class="v" id="hvHouseType">-</span></div>
                        <div class="kv"><span class="k">Rooms</span><span class="v" id="hvHouseRooms">-</span></div>
                        <div class="kv"><span class="k">Toilet</span><span class="v" id="hvHouseToilet">-</span></div>
                      </div>
                      <div class="kv-grid hv-house-grid-bottom">
                        <div class="kv"><span class="k">Electricity</span><span class="v" id="hvHouseElectricity">-</span></div>
                        <div class="kv"><span class="k">Internet</span><span class="v" id="hvHouseInternet">-</span></div>
                        <div class="kv"><span class="k">Water Source</span><span class="v" id="hvHouseWater">-</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

          </div>
        </div>

        <div class="hv-card" id="hv-card-members">
          <div class="hv-head d-flex justify-content-between align-items-center">
            <span><i class="bi bi-people-fill"></i> Household Members</span>
            <span class="text-muted small" id="hvMembersLabel">-</span>
          </div>
          <div class="table-responsive">
            <table class="table align-middle mb-0">
              <thead>
                <tr>
                  <th>#</th><th>Name</th><th>Relation</th><th>Age</th><th>Sex</th><th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody id="hvMembersTable">
                <tr><td colspan="6" class="text-muted text-center">No members listed.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- DELETE CONFIRM MODAL -->
  <div class="modal fade" id="viewDeleteModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3 text-danger"><i class="bi bi-trash fs-1"></i></div>
        <h5 class="modal-title mb-2">Delete Household</h5>
        <p class="mb-3">This will delete <strong id="viewDeleteId">HH-</strong>. This action cannot be undone.</p>
        <div class="d-flex justify-content-center gap-2">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-danger btn-modern" id="viewDeleteConfirmBtn">Confirm Delete</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MEMBER DETAILS MODAL -->
  <div class="modal fade" id="memberDetailsModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Member Details</h5>
            <p class="text-muted small mb-0" id="mdRelation">-</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <div class="accordion member-modal-accordion" id="memberDetailsAccordion">
            <div class="accordion-item">
              <h2 class="accordion-header" id="memberDetailsBasicHead">
                <button class="accordion-button" type="button" data-bs-toggle="collapse" data-bs-target="#memberDetailsBasic" aria-expanded="true" aria-controls="memberDetailsBasic">
                  Basic Information
                </button>
              </h2>
              <div id="memberDetailsBasic" class="accordion-collapse collapse show" aria-labelledby="memberDetailsBasicHead" data-bs-parent="#memberDetailsAccordion">
                <div class="accordion-body">
                  <div class="member-detail-grid">
                    <div class="member-detail-item"><span class="k">Full Name</span><span class="v" id="mdName">-</span></div>
                    <div class="member-detail-item"><span class="k">Relation</span><span class="v" id="mdRelationToHeadValue">-</span></div>
                    <div class="member-detail-item"><span class="k">Birthday</span><span class="v" id="mdBirthday">-</span></div>
                    <div class="member-detail-item"><span class="k">Age</span><span class="v" id="mdAge">-</span></div>
                    <div class="member-detail-item"><span class="k">Sex</span><span class="v" id="mdSex">-</span></div>
                    <div class="member-detail-item"><span class="k">Civil Status</span><span class="v" id="mdCivilStatus">-</span></div>
                    <div class="member-detail-item"><span class="k">Citizenship</span><span class="v" id="mdCitizenship">-</span></div>
                    <div class="member-detail-item"><span class="k">Religion</span><span class="v" id="mdReligion">-</span></div>
                    <div class="member-detail-item"><span class="k">Blood Type</span><span class="v" id="mdBloodType">-</span></div>
                    <div class="member-detail-item"><span class="k">Pregnant</span><span class="v" id="mdPregnant">-</span></div>
                    <div class="member-detail-item"><span class="k">Height</span><span class="v" id="mdHeight">-</span></div>
                    <div class="member-detail-item"><span class="k">Weight</span><span class="v" id="mdWeight">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="memberDetailsContactHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#memberDetailsContact" aria-expanded="false" aria-controls="memberDetailsContact">
                  Contact and Address
                </button>
              </h2>
              <div id="memberDetailsContact" class="accordion-collapse collapse" aria-labelledby="memberDetailsContactHead" data-bs-parent="#memberDetailsAccordion">
                <div class="accordion-body">
                  <div class="member-detail-grid member-detail-grid--contact">
                    <div class="member-detail-item"><span class="k">Contact</span><span class="v" id="mdContact">-</span></div>
                    <div class="member-detail-item"><span class="k">Zone</span><span class="v" id="mdZone">-</span></div>
                    <div class="member-detail-item"><span class="k">Barangay</span><span class="v" id="mdBarangay">-</span></div>
                    <div class="member-detail-item"><span class="k">City/Municipality</span><span class="v" id="mdCity">-</span></div>
                    <div class="member-detail-item"><span class="k">Province</span><span class="v" id="mdProvince">-</span></div>
                    <div class="member-detail-item"><span class="k">Address</span><span class="v" id="mdAddress">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="memberDetailsProfileHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#memberDetailsProfile" aria-expanded="false" aria-controls="memberDetailsProfile">
                  Education and Employment
                </button>
              </h2>
              <div id="memberDetailsProfile" class="accordion-collapse collapse" aria-labelledby="memberDetailsProfileHead" data-bs-parent="#memberDetailsAccordion">
                <div class="accordion-body">
                  <div class="member-profile-grid-top">
                    <div class="member-detail-item"><span class="k">Education</span><span class="v" id="mdEducation">-</span></div>
                    <div class="member-detail-item"><span class="k">Degree/Course</span><span class="v" id="mdDegree">-</span></div>
                    <div class="member-detail-item"><span class="k">School Name</span><span class="v" id="mdSchoolName">-</span></div>
                    <div class="member-detail-item"><span class="k">School Type</span><span class="v" id="mdSchoolType">-</span></div>
                    <div class="member-detail-item"><span class="k">Dropout</span><span class="v" id="mdDropout">-</span></div>
                    <div class="member-detail-item"><span class="k">Out of School Youth</span><span class="v" id="mdOSY">-</span></div>
                    <div class="member-detail-item"><span class="k">Currently Studying</span><span class="v" id="mdCurrentlyStudying">-</span></div>
                    <div class="member-detail-item"><span class="k">Occupation</span><span class="v" id="mdOccupation">-</span></div>
                  </div>
                  <div class="member-profile-grid-bottom">
                    <div class="member-detail-item"><span class="k">Employment Status</span><span class="v" id="mdEmploymentStatus">-</span></div>
                    <div class="member-detail-item"><span class="k">Work Type</span><span class="v" id="mdWorkType">-</span></div>
                    <div class="member-detail-item"><span class="k">Monthly Income</span><span class="v" id="mdMonthlyIncome">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="memberDetailsGovHead">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#memberDetailsGov" aria-expanded="false" aria-controls="memberDetailsGov">
                  Government IDs and Social Welfare
                </button>
              </h2>
              <div id="memberDetailsGov" class="accordion-collapse collapse" aria-labelledby="memberDetailsGovHead" data-bs-parent="#memberDetailsAccordion">
                <div class="accordion-body">
                  <div class="member-gov-grid-top">
                    <div class="member-detail-item"><span class="k">4Ps Beneficiary</span><span class="v" id="md4ps">-</span></div>
                    <div class="member-detail-item"><span class="k">PWD</span><span class="v" id="mdPWD">-</span></div>
                    <div class="member-detail-item"><span class="k">Senior Citizen</span><span class="v" id="mdSenior">-</span></div>
                    <div class="member-detail-item"><span class="k">Indigenous People</span><span class="v" id="mdIP">-</span></div>
                  </div>
                  <div class="member-gov-grid-bottom">
                    <div class="member-detail-item"><span class="k">Registered Voter</span><span class="v" id="mdVoter">-</span></div>
                    <div class="member-detail-item"><span class="k">Precinct</span><span class="v" id="mdPrecinct">-</span></div>
                    <div class="member-detail-item"><span class="k">SSS</span><span class="v" id="mdSSS">-</span></div>
                    <div class="member-detail-item"><span class="k">PhilHealth</span><span class="v" id="mdPhilhealth">-</span></div>
                    <div class="member-detail-item"><span class="k">GSIS</span><span class="v" id="mdGSIS">-</span></div>
                    <div class="member-detail-item"><span class="k">TIN</span><span class="v" id="mdTIN">-</span></div>
                    <div class="member-detail-item"><span class="k">PhilSys ID</span><span class="v" id="mdPhilID">-</span></div>
                    <div class="member-detail-item"><span class="k">Driver's License</span><span class="v" id="mdDriverLicense">-</span></div>
                    <div class="member-detail-item"><span class="k">Passport</span><span class="v" id="mdPassport">-</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0 member-modal-footer">
          <button type="button" class="btn btn-outline-primary btn-modern role-secretary-only" id="memberDetailsEditBtn">
            <i class="bi bi-pencil"></i> Edit Member
          </button>
          <button type="button" class="btn btn-outline-danger btn-modern role-secretary-only" id="memberDetailsDeleteBtn">
            <i class="bi bi-trash"></i> Delete Member
          </button>
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
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

</div>

<script src="bootstrap/bootstrap-5.3.8-dist/js/bootstrap.bundle.min.js"></script>
<script src="assets/js/indexeddb-storage-scripts.js"></script>
<script src="assets/js/responsive-table-scripts.js"></script>
<script src="assets/js/household-view.js?v=<?= htmlspecialchars($householdViewScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>


