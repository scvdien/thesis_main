<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['staff', 'secretary', 'admin']);
$authRole = auth_user_role($authUser);
$brandBarangay = trim(auth_env(['BARANGAY_NAME'], 'Barangay'));
$brandCity = trim(auth_env(['BARANGAY_CITY', 'CITY_NAME', 'MUNICIPALITY_NAME'], ''));
$brandLabel = $brandBarangay !== '' ? $brandBarangay : 'Barangay';
$systemLabel = trim($brandLabel . ($brandCity !== '' ? ' ' . $brandCity : '') . ' Household Information Management System');
$memberScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/member-scripts.js') ?: time());
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3"><label class="form-label required" for="first_name">First Name</label><input type="text" class="form-control" id="first_name" required></div>
            <div class="col-md-3"><label class="form-label" for="middle_name">Middle Name</label><input type="text" class="form-control" id="middle_name"></div>
            <div class="col-md-3"><label class="form-label required" for="last_name">Last Name</label><input type="text" class="form-control" id="last_name" required></div>
            <div class="col-md-3"><label class="form-label" for="extension_name">Extension Name</label><input type="text" class="form-control" id="extension_name" placeholder="e.g., Jr., Sr., III"></div>
            <div class="col-md-3"><label class="form-label required" for="birthday">Birthday</label><input type="date" class="form-control" id="birthday" required></div>
            <div class="col-md-3"><label class="form-label required" for="sex">Sex/Gender</label>
              <select class="form-select" id="sex" required>
                <option value="">Select</option><option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div class="col-md-3"><label class="form-label required" for="civil_status">Civil Status</label>
              <select class="form-select" id="civil_status" required>
                <option value="">Select</option>
                <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option>
              </select>
            </div>
            <div class="col-md-3"><label class="form-label" for="citizenship">Nationality/Citizenship</label><input type="text" class="form-control" id="citizenship" value="Filipino"></div>
            <div class="col-md-3"><label class="form-label" for="religion">Religion</label><input type="text" class="form-control" id="religion"></div>
            <div class="col-md-3"><label class="form-label" for="blood_type">Blood Type</label><input type="text" class="form-control" id="blood_type"></div>
            <div class="col-md-2"><label class="form-label" for="height">Height (cm)</label><input type="number" class="form-control" id="height"></div>
            <div class="col-md-2"><label class="form-label" for="weight">Weight (kg)</label><input type="number" class="form-control" id="weight"></div>
            <div class="col-md-2"><label class="form-label" for="age">Age</label><input type="number" class="form-control" id="age" readonly></div>

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

      <!-- H. Household Data -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">H. Household Data</div>
        <div class="card-body">
          <div class="row g-3">
            <div class="col-md-3"><label class="form-label" for="num_members">Number of Household Members</label><input type="number" class="form-control" id="num_members"></div>
            <div class="col-md-3"><label class="form-label" for="relation_to_head">Relationship to Head</label><input type="text" class="form-control" id="relation_to_head"></div>
            <div class="col-md-3"><label class="form-label" for="num_children">Number of Children</label><input type="number" class="form-control" id="num_children"></div>
            <div class="col-md-3"><label class="form-label" for="partner_name">Marital Partner Name</label><input type="text" class="form-control" id="partner_name" placeholder="optional"></div>
          </div>
        </div>
      </div>

      <!-- I. Health Information -->
      <div class="card section-card mb-4">
        <div class="card-header section-header">I. Health Information</div>
        <div class="card-body">
          <div class="health-block">
            <div class="health-block-title"><span class="health-num">1</span> Current Illness</div>
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label" for="health_current_illness">Currently has illness?</label>
                <select class="form-select" id="health_current_illness">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-5">
                <label class="form-label" for="health_illness_type">Type of illness</label>
                <input type="text" class="form-control" id="health_illness_type">
              </div>
              <div class="col-md-4">
                <label class="form-label" for="health_illness_years">Years with illness</label>
                <input type="number" class="form-control" id="health_illness_years" min="0">
              </div>
            </div>
          </div>

          <div class="health-block">
            <div class="health-block-title"><span class="health-num">2</span> Chronic Diseases (Check all that apply)</div>
            <div class="row g-2 health-check-grid">
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_hypertension" value="Hypertension">
                  <label class="form-check-label" for="chronic_hypertension">Hypertension</label>
                </div>
              </div>
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_diabetes" value="Diabetes">
                  <label class="form-check-label" for="chronic_diabetes">Diabetes</label>
                </div>
              </div>
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_heart" value="Heart Disease">
                  <label class="form-check-label" for="chronic_heart">Heart Disease</label>
                </div>
              </div>
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_kidney" value="Kidney Disease">
                  <label class="form-check-label" for="chronic_kidney">Kidney Disease</label>
                </div>
              </div>
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_asthma" value="Asthma">
                  <label class="form-check-label" for="chronic_asthma">Asthma</label>
                </div>
              </div>
              <div class="col-6 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_arthritis" value="Arthritis">
                  <label class="form-check-label" for="chronic_arthritis">Arthritis</label>
                </div>
              </div>
              <div class="col-12 col-md-4 col-lg-3">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_chronic_diseases" id="chronic_mental" value="Mental Health">
                  <label class="form-check-label" for="chronic_mental">Mental Health (optional)</label>
                </div>
              </div>
            </div>
          </div>

          <div class="health-block">
            <div class="health-block-title"><span class="health-num">3</span> Common / Recent Illness</div>
            <div class="row g-2 health-check-grid">
              <div class="col-6 col-md-4 col-lg-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="common_cough_cold" value="Cough & Cold">
                  <label class="form-check-label" for="common_cough_cold">Cough &amp; Cold</label>
                </div>
              </div>
              <div class="col-6 col-md-3 col-lg-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="common_fever" value="Fever">
                  <label class="form-check-label" for="common_fever">Fever</label>
                </div>
              </div>
              <div class="col-6 col-md-3 col-lg-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="common_diarrhea" value="Diarrhea">
                  <label class="form-check-label" for="common_diarrhea">Diarrhea</label>
                </div>
              </div>
              <div class="col-6 col-md-3 col-lg-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="common_dengue" value="Dengue history">
                  <label class="form-check-label" for="common_dengue">Dengue history</label>
                </div>
              </div>
              <div class="col-6 col-md-3 col-lg-2">
                <div class="form-check">
                  <input class="form-check-input" type="checkbox" name="health_common_illnesses" id="common_skin" value="Skin diseases">
                  <label class="form-check-label" for="common_skin">Skin diseases</label>
                </div>
              </div>
            </div>
          </div>

          <div class="health-block">
            <div class="health-block-title"><span class="health-num">4</span> Medication Information</div>
            <div class="row g-3 medication-grid">
              <div class="col-md-4">
                <label class="form-label" for="health_maintenance_meds">Taking maintenance medicine?</label>
                <select class="form-select" id="health_maintenance_meds">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_medicine_name">Medicine name</label>
                <input type="text" class="form-control" id="health_medicine_name">
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_medicine_frequency">Frequency per day</label>
                <input type="number" class="form-control" id="health_medicine_frequency" min="0">
              </div>
              <div class="col-md-2">
                <label class="form-label" for="health_medicine_source">Source</label>
                <select class="form-select" id="health_medicine_source">
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
                <label class="form-label" for="health_maternal_pregnant">Pregnant?</label>
                <select class="form-select" id="health_maternal_pregnant">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="health_months_pregnant">Months pregnant</label>
                <input type="number" class="form-control" id="health_months_pregnant" min="0">
              </div>
              <div class="col-md-4">
                <label class="form-label" for="health_prenatal_care">With prenatal care?</label>
                <select class="form-select" id="health_prenatal_care">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
            </div>
            <div class="health-subtitle">For Children</div>
            <div class="row g-3">
              <div class="col-md-4">
                <label class="form-label" for="health_child_immunized">Fully immunized?</label>
                <select class="form-select" id="health_child_immunized">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="health_child_malnutrition">With malnutrition?</label>
                <select class="form-select" id="health_child_malnutrition">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-4">
                <label class="form-label" for="health_child_sick_per_year">Times sick per year</label>
                <input type="number" class="form-control" id="health_child_sick_per_year" min="0">
              </div>
            </div>
          </div>

          <div class="health-block">
            <div class="health-block-title"><span class="health-num">6</span> Disability / Special Condition</div>
            <div class="row g-3">
              <div class="col-md-3">
                <label class="form-label" for="health_has_disability">Has disability?</label>
                <select class="form-select" id="health_has_disability">
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
                      <input class="form-check-input" type="checkbox" name="health_disability_types" id="disability_physical" value="Physical">
                      <label class="form-check-label" for="disability_physical">Physical</label>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" name="health_disability_types" id="disability_hearing" value="Hearing">
                      <label class="form-check-label" for="disability_hearing">Hearing</label>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" name="health_disability_types" id="disability_visual" value="Visual">
                      <label class="form-check-label" for="disability_visual">Visual</label>
                    </div>
                  </div>
                  <div class="col-6 col-md-3">
                    <div class="form-check">
                      <input class="form-check-input" type="checkbox" name="health_disability_types" id="disability_mental" value="Mental">
                      <label class="form-check-label" for="disability_mental">Mental</label>
                    </div>
                  </div>
                </div>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_disability_regular_care">Needs regular medication or therapy?</label>
                <select class="form-select" id="health_disability_regular_care">
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
                <label class="form-label" for="health_smoker">Smoker in household?</label>
                <select class="form-select" id="health_smoker">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_alcohol_daily">Alcohol intake daily?</label>
                <select class="form-select" id="health_alcohol_daily">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_malnutrition_present">Malnutrition present?</label>
                <select class="form-select" id="health_malnutrition_present">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_clean_water">Clean water source?</label>
                <select class="form-select" id="health_clean_water">
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
                <label class="form-label" for="health_rhu_visits">RHU visits in past year</label>
                <input type="number" class="form-control" id="health_rhu_visits" min="0">
              </div>
              <div class="col-md-6">
                <label class="form-label" for="health_rhu_reason">Common reason for visit</label>
                <input type="text" class="form-control" id="health_rhu_reason">
              </div>
              <div class="col-md-3">
                <label class="form-label" for="health_has_philhealth">Has PhilHealth?</label>
                <select class="form-select" id="health_has_philhealth">
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
                <label class="form-label" for="health_hospitalized_5yrs">Hospitalized in last 5 years?</label>
                <select class="form-select" id="health_hospitalized_5yrs">
                  <option value="">Select</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div class="col-md-8">
                <label class="form-label" for="health_hospitalized_reason">Reason for hospitalization</label>
                <input type="text" class="form-control" id="health_hospitalized_reason">
              </div>
            </div>
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
  <script src="assets/js/member-scripts.js?v=<?= htmlspecialchars($memberScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>
</body>
</html>



