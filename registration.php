<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['staff', 'secretary', 'admin']);
$authRole = auth_user_role($authUser);
$registrationCsrfToken = auth_csrf_token();
$registrationScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/registration-scripts.js') ?: time());
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($registrationCsrfToken, ENT_QUOTES, 'UTF-8') ?>">
  <title>Household Registration</title>

  <!-- Bootstrap CSS -->
  <link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/registration-style.css">
</head>

<body data-role="<?= htmlspecialchars($authRole, ENT_QUOTES, 'UTF-8') ?>">
<?php echo auth_client_role_script($authRole); ?>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-brand">
      <img src="assets/img/barangay-cabarian-logo.png" alt="Barangay Cabarian Logo" class="brand-logo">
      <div>
        <div class="brand-title">Barangay Cabarian</div>
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
          <div class="content-subtitle">Barangay Cabarian Household Information Management System</div>
          <div class="content-subtitle content-subtitle-mobile">Barangay Cabarian</div>
        </div>
      </div>
      <div class="content-meta">
        <span class="badge rounded-pill">Required fields are marked *</span>
      </div>
    </div>

    <form id="censusForm">

    <!-- A. Household Head Information -->
    <div class="card section-card mb-4">
      <div class="card-header section-header d-flex justify-content-between align-items-center">
        <span>A. Household Head Information</span>
        <span class="badge rounded-pill">Required</span>
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
          <div class="col-md-4"><label class="form-label">Zone/Purok</label><input type="text" class="form-control" name="zone"></div>
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
        <div class="row g-3">
          <div class="col-md-3"><label class="form-label required">Number of Household Members</label><input type="number" class="form-control" name="num_members" required></div>
          <div class="col-md-3"><label class="form-label">Relationship to Head</label><input type="text" class="form-control" name="relation_to_head"></div>
          <div class="col-md-3"><label class="form-label">Number of Children</label><input type="number" class="form-control" name="num_children"></div>
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
          <div class="col-md-4"><label class="form-label">House Type</label><select class="form-select" name="house_type"><option>Concrete</option><option>Wood</option><option>Mixed</option></select></div>
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

    <!-- J. Health Information -->
    <div class="card section-card mb-4">
      <div class="card-header section-header">J. Health Information</div>
      <div class="card-body">
        <div class="health-block">
          <div class="health-block-title"><span class="health-num">1</span> Current Illness</div>
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">Currently has illness?</label>
              <select class="form-select" name="health_current_illness" id="head_health_current_illness">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-5">
              <label class="form-label">Type of illness</label>
              <input type="text" class="form-control" name="health_illness_type" id="head_health_illness_type">
            </div>
            <div class="col-md-4">
              <label class="form-label">Years with illness</label>
              <input type="number" class="form-control" name="health_illness_years" id="head_health_illness_years" min="0">
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">2</span> Chronic Diseases (Check all that apply)</div>
          <div class="row g-2 health-check-grid">
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_hypertension" value="Hypertension">
                <label class="form-check-label" for="head_chronic_hypertension">Hypertension</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_diabetes" value="Diabetes">
                <label class="form-check-label" for="head_chronic_diabetes">Diabetes</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_heart" value="Heart Disease">
                <label class="form-check-label" for="head_chronic_heart">Heart Disease</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_kidney" value="Kidney Disease">
                <label class="form-check-label" for="head_chronic_kidney">Kidney Disease</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_asthma" value="Asthma">
                <label class="form-check-label" for="head_chronic_asthma">Asthma</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_arthritis" value="Arthritis">
                <label class="form-check-label" for="head_chronic_arthritis">Arthritis</label>
              </div>
            </div>
            <div class="col-12 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="head_chronic_mental" value="Mental Health">
                <label class="form-check-label" for="head_chronic_mental">Mental Health (optional)</label>
              </div>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">3</span> Common / Recent Illness</div>
          <div class="row g-2 health-check-grid">
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="head_common_cough_cold" value="Cough & Cold">
                <label class="form-check-label" for="head_common_cough_cold">Cough &amp; Cold</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="head_common_fever" value="Fever">
                <label class="form-check-label" for="head_common_fever">Fever</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="head_common_diarrhea" value="Diarrhea">
                <label class="form-check-label" for="head_common_diarrhea">Diarrhea</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="head_common_dengue" value="Dengue history">
                <label class="form-check-label" for="head_common_dengue">Dengue history</label>
              </div>
            </div>
            <div class="col-6 col-md-4 col-lg-3">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="head_common_skin" value="Skin diseases">
                <label class="form-check-label" for="head_common_skin">Skin diseases</label>
              </div>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">4</span> Medication Information</div>
          <div class="row g-3 medication-grid">
            <div class="col-md-4">
              <label class="form-label">Taking maintenance medicine?</label>
              <select class="form-select" name="health_maintenance_meds" id="head_health_maintenance_meds">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Medicine name</label>
              <input type="text" class="form-control" name="health_medicine_name" id="head_health_medicine_name">
            </div>
            <div class="col-md-3">
              <label class="form-label">Frequency per day</label>
              <input type="number" class="form-control" name="health_medicine_frequency" id="head_health_medicine_frequency" min="0">
            </div>
            <div class="col-md-2">
              <label class="form-label">Source</label>
              <select class="form-select" name="health_medicine_source" id="head_health_medicine_source">
                <option value="">Select</option>
                <option>RHU</option>
                <option>Pharmacy</option>
              </select>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">5</span> Maternal &amp; Child Health</div>
          <div class="health-subtitle">For Mothers</div>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">Pregnant?</label>
              <select class="form-select" name="health_maternal_pregnant" id="head_health_maternal_pregnant">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">Months pregnant</label>
              <input type="number" class="form-control" name="health_months_pregnant" id="head_health_months_pregnant" min="0">
            </div>
            <div class="col-md-4">
              <label class="form-label">With prenatal care?</label>
              <select class="form-select" name="health_prenatal_care" id="head_health_prenatal_care">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          </div>
          <div class="health-subtitle">For Children</div>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">Fully immunized?</label>
              <select class="form-select" name="health_child_immunized" id="head_health_child_immunized">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">With malnutrition?</label>
              <select class="form-select" name="health_child_malnutrition" id="head_health_child_malnutrition">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-4">
              <label class="form-label">Times sick per year</label>
              <input type="number" class="form-control" name="health_child_sick_per_year" id="head_health_child_sick_per_year" min="0">
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">6</span> Disability / Special Condition</div>
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">Has disability?</label>
              <select class="form-select" name="health_has_disability" id="head_health_has_disability">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">Type (check all that apply)</label>
              <div class="row g-2 health-check-grid">
                <div class="col-6 col-md-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="health_disability_types" id="head_disability_physical" value="Physical">
                    <label class="form-check-label" for="head_disability_physical">Physical</label>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="health_disability_types" id="head_disability_hearing" value="Hearing">
                    <label class="form-check-label" for="head_disability_hearing">Hearing</label>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="health_disability_types" id="head_disability_visual" value="Visual">
                    <label class="form-check-label" for="head_disability_visual">Visual</label>
                  </div>
                </div>
                <div class="col-6 col-md-3">
                  <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="health_disability_types" id="head_disability_mental" value="Mental">
                    <label class="form-check-label" for="head_disability_mental">Mental</label>
                  </div>
                </div>
              </div>
            </div>
            <div class="col-md-3">
              <label class="form-label">Needs regular medication or therapy?</label>
              <select class="form-select" name="health_disability_regular_care" id="head_health_disability_regular_care">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">7</span> Health Risk Factors</div>
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">Smoker in household?</label>
              <select class="form-select" name="health_smoker" id="head_health_smoker">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Alcohol intake daily?</label>
              <select class="form-select" name="health_alcohol_daily" id="head_health_alcohol_daily">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Malnutrition present?</label>
              <select class="form-select" name="health_malnutrition_present" id="head_health_malnutrition_present">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label">Clean water source?</label>
              <select class="form-select" name="health_clean_water" id="head_health_clean_water">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">8</span> Health Service Usage</div>
          <div class="row g-3">
            <div class="col-md-3">
              <label class="form-label">RHU visits in past year</label>
              <input type="number" class="form-control" name="health_rhu_visits" id="head_health_rhu_visits" min="0">
            </div>
            <div class="col-md-6">
              <label class="form-label">Common reason for visit</label>
              <input type="text" class="form-control" name="health_rhu_reason" id="head_health_rhu_reason">
            </div>
            <div class="col-md-3">
              <label class="form-label">Has PhilHealth?</label>
              <select class="form-select" name="health_has_philhealth" id="head_health_has_philhealth">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
          </div>
        </div>

        <div class="health-block">
          <div class="health-block-title"><span class="health-num">9</span> Serious Illness History</div>
          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label">Hospitalized in last 5 years?</label>
              <select class="form-select" name="health_hospitalized_5yrs" id="head_health_hospitalized_5yrs">
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div class="col-md-8">
              <label class="form-label">Reason for hospitalization</label>
              <input type="text" class="form-control" name="health_hospitalized_reason" id="head_health_hospitalized_reason">
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="action-bar">
      <div class="action-buttons">
        <button type="button" class="btn btn-outline-primary" id="previewBtn"><i class="bi bi-eye"></i> Preview</button>
        <button type="button" class="btn btn-secondary" id="clearBtn"><i class="bi bi-x-circle"></i> Clear</button>
        <button type="button" class="btn btn-primary" id="saveBtn"><i class="bi bi-save"></i> Save Registration</button>
      </div>
    </div>

    </form>

    <footer class="footer page-footer py-3 text-center mt-4">
      <div class="footer-inner">
        <p class="mb-1 fw-semibold">Barangay Cabarian Household Information Management System</p>
        <p class="mb-0 small">&copy; <span id="year"></span> Barangay Cabarian, Ligao City</p>
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
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body" id="previewBody"><p class="text-muted text-center">No details provided.</p></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal" id="previewEditBtn">
          <i class="bi bi-pencil"></i> Edit
        </button>
        <button class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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

<!-- Replace Existing Household Modal -->
<div class="modal fade" id="replaceHouseholdModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content modern-modal text-center">
      <div class="modal-icon mb-3 text-warning">
        <i class="bi bi-exclamation-circle-fill fs-1"></i>
      </div>
      <h5 class="modal-title mb-2">Replace Existing Household?</h5>
      <p class="mb-3" id="replaceHouseholdMessage">A matching household record already exists.</p>
      <div class="d-flex justify-content-center gap-2 flex-wrap">
        <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-primary btn-modern" id="replaceHouseholdConfirm">Replace</button>
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
<script src="assets/js/registration-scripts.js?v=<?= htmlspecialchars($registrationScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>



