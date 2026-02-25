<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain', 'admin', 'secretary']);
$authRole = auth_user_role($authUser);
$householdViewScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/household-view.js') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Household Details | Admin</title>
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/site-style.css">
  <link rel="stylesheet" href="assets/css/household-view.css">
</head>
<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>

<div id="wrapper">
  <div id="content-area">
    <!-- SIDEBAR (reuse) -->
    <aside id="sidebar">
      <div class="brand d-flex align-items-center gap-2 mb-3">
        <img src="assets/img/barangay-cabarian-logo.png" alt="Barangay Cabarian Logo" style="width:40px; height:auto;">
        <span class="fw-bold text-primary">Barangay Cabarian</span>
      </div>
      <div class="menu">
        <a href="admin.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
        <a href="households.php" class="active"><i class="bi bi-house"></i>Households</a>
        <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
        <a href="admin-reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
        <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
        <a href="#" class="text-danger"><i class="bi bi-box-arrow-right"></i>Logout</a>
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
        <div class="hv-pill">
          <div class="pill-head">
            <div class="label">Record ID</div>
            <i class="bi bi-upc-scan"></i>
          </div>
          <div class="value" id="hvId">-</div>
        </div>
        <div class="hv-pill">
          <div class="pill-head">
            <div class="label">Status</div>
            <i class="bi bi-patch-check"></i>
          </div>
          <div class="badge status" id="hvStatus">-</div>
        </div>
        <div class="hv-pill">
          <div class="pill-head">
            <div class="label">Last Updated</div>
            <i class="bi bi-clock-history"></i>
          </div>
          <div class="value" id="hvUpdated">-</div>
        </div>
        <div class="hv-pill">
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
              <div class="hv-chip-row">
                <div class="hv-chip"><span class="k">Age</span><span class="v" id="hvHeadAge">-</span></div>
                <div class="hv-chip"><span class="k">Sex</span><span class="v" id="hvHeadSex">-</span></div>
                <div class="hv-chip"><span class="k">Civil Status</span><span class="v" id="hvHeadCivil">-</span></div>
              </div>
            </div>
            <div class="kv-grid hv-quick-kv">
              <div class="kv"><span class="k">Contact</span><span class="v" id="hvHeadContact">-</span></div>
              <div class="kv"><span class="k">Zone/Purok</span><span class="v" id="hvHeadZone">-</span></div>
              <div class="kv wide"><span class="k">Address</span><span class="v" id="hvHeadAddress">-</span></div>
              <div class="kv"><span class="k">Barangay</span><span class="v" id="hvHeadBarangay">-</span></div>
              <div class="kv"><span class="k">City/Municipality</span><span class="v" id="hvHeadCity">-</span></div>
              <div class="kv"><span class="k">Province</span><span class="v" id="hvHeadProvince">-</span></div>
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
                  <div class="kv-grid">
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
                  <div class="kv-grid">
                    <div class="kv"><span class="k">Education Attainment</span><span class="v" id="hvHeadEducation">-</span></div>
                    <div class="kv"><span class="k">Degree/Course</span><span class="v" id="hvHeadDegree">-</span></div>
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
                  <div class="kv-grid">
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
                  <div class="kv-grid hv-house-grid">
                    <div class="kv"><span class="k">Members</span><span class="v" id="hvHouseNumMembers">-</span></div>
                    <div class="kv"><span class="k">Relation to Head</span><span class="v" id="hvHouseRelationToHead">-</span></div>
                    <div class="kv"><span class="k">Children</span><span class="v" id="hvHouseNumChildren">-</span></div>
                    <div class="kv"><span class="k">Marital Partner</span><span class="v" id="hvHousePartnerName">-</span></div>
                    <div class="kv"><span class="k">Ownership</span><span class="v" id="hvHouseOwnership">-</span></div>
                    <div class="kv"><span class="k">House Type</span><span class="v" id="hvHouseType">-</span></div>
                    <div class="kv"><span class="k">Rooms</span><span class="v" id="hvHouseRooms">-</span></div>
                    <div class="kv"><span class="k">Toilet</span><span class="v" id="hvHouseToilet">-</span></div>
                    <div class="kv"><span class="k">Electricity</span><span class="v" id="hvHouseElectricity">-</span></div>
                    <div class="kv"><span class="k">Internet</span><span class="v" id="hvHouseInternet">-</span></div>
                    <div class="kv wide"><span class="k">Water Source</span><span class="v" id="hvHouseWater">-</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div class="accordion-item">
              <h2 class="accordion-header" id="hvHeadingFive">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#hvCollapseFive" aria-expanded="false" aria-controls="hvCollapseFive">
                  Health Profile
                </button>
              </h2>
              <div id="hvCollapseFive" class="accordion-collapse collapse" aria-labelledby="hvHeadingFive" data-bs-parent="#hvAccordion">
                <div class="accordion-body">
                  <div class="kv-grid">
                    <div class="kv"><span class="k">Current Illness</span><span class="v" id="hvHealthCurrentIllness">-</span></div>
                    <div class="kv"><span class="k">Illness Type</span><span class="v" id="hvHealthIllnessType">-</span></div>
                    <div class="kv"><span class="k">Chronic Diseases</span><span class="v" id="hvHealthChronic">-</span></div>
                    <div class="kv"><span class="k">Common Illness</span><span class="v" id="hvHealthCommon">-</span></div>
                    <div class="kv"><span class="k">Maintenance Meds</span><span class="v" id="hvHealthMaintenance">-</span></div>
                    <div class="kv"><span class="k">Medicine</span><span class="v" id="hvHealthMedicine">-</span></div>
                    <div class="kv"><span class="k">Frequency</span><span class="v" id="hvHealthFrequency">-</span></div>
                    <div class="kv"><span class="k">Source</span><span class="v" id="hvHealthSource">-</span></div>
                    <div class="kv"><span class="k">Pregnant (Mother)</span><span class="v" id="hvHealthPregnant">-</span></div>
                    <div class="kv"><span class="k">Months Pregnant</span><span class="v" id="hvHealthMonthsPregnant">-</span></div>
                    <div class="kv"><span class="k">Prenatal Care</span><span class="v" id="hvHealthPrenatal">-</span></div>
                    <div class="kv"><span class="k">Child Immunized</span><span class="v" id="hvHealthChildImmunized">-</span></div>
                    <div class="kv"><span class="k">Child Malnutrition</span><span class="v" id="hvHealthChildMalnutrition">-</span></div>
                    <div class="kv"><span class="k">Child Sick/Year</span><span class="v" id="hvHealthChildSick">-</span></div>
                    <div class="kv"><span class="k">Has Disability</span><span class="v" id="hvHealthDisability">-</span></div>
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
    <div class="modal-dialog modal-lg modal-dialog-centered">
      <div class="modal-content modern-modal">
        <div class="modal-header border-0 pb-0">
          <div>
            <h5 class="modal-title mb-1">Member Details</h5>
            <p class="text-muted small mb-0" id="mdRelation">-</p>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body pt-3">
          <div class="member-detail-grid">
            <div class="member-detail-item">
              <span class="k">Full Name</span>
              <span class="v" id="mdName">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Age</span>
              <span class="v" id="mdAge">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Sex</span>
              <span class="v" id="mdSex">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Civil Status</span>
              <span class="v" id="mdCivilStatus">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Contact</span>
              <span class="v" id="mdContact">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Education</span>
              <span class="v" id="mdEducation">-</span>
            </div>
            <div class="member-detail-item">
              <span class="k">Occupation</span>
              <span class="v" id="mdOccupation">-</span>
            </div>
            <div class="member-detail-item full">
              <span class="k">Address</span>
              <span class="v" id="mdAddress">-</span>
            </div>
            <div class="member-detail-item full">
              <span class="k">Health Notes</span>
              <span class="v" id="mdHealthNotes">-</span>
            </div>
          </div>
        </div>
        <div class="modal-footer border-0 pt-0">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Close</button>
          <div class="ms-auto d-flex gap-2">
            <button type="button" class="btn btn-danger btn-modern role-secretary-only" id="memberDetailsDeleteBtn">
              <i class="bi bi-trash"></i> Delete Member
            </button>
            <button type="button" class="btn btn-primary btn-modern role-secretary-only" id="memberDetailsEditBtn">
              <i class="bi bi-pencil"></i> Edit Member
            </button>
          </div>
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


