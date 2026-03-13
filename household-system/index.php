<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
$authUser = auth_require_page(['captain']);
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
$systemLabel = trim($brandFooterLabel . ' Online Household Information Management System');
$dashboardStyleVersion = (string) (@filemtime(__DIR__ . '/assets/css/site-style.css') ?: time());
$dashboardScriptVersion = (string) (@filemtime(__DIR__ . '/assets/js/index-scripts.js') ?: time());
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Barangay Captain Dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">

<!-- Bootstrap CSS -->
<link href="bootstrap/bootstrap-5.3.8-dist/css/bootstrap.min.css" rel="stylesheet">
<link href="assets/vendor/bootstrap-icons/bootstrap-icons.css" rel="stylesheet">
<script src="assets/vendor/chartjs/chart.umd.min.js"></script>
<link rel="stylesheet" href="assets/css/site-style.css?v=<?= htmlspecialchars($dashboardStyleVersion, ENT_QUOTES, 'UTF-8') ?>">

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
    <a href="#" class="active"><i class="bi bi-speedometer2"></i>Dashboard</a>
    <a href="households.php"><i class="bi bi-house"></i>Households</a>
    <a href="residents.php"><i class="bi bi-people"></i>Residents</a>
    <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
    <a href="settings.php?role=captain"><i class="bi bi-gear"></i>Settings</a>
    <a href="#" class="text-danger"><i class="bi bi-box-arrow-right"></i>Logout</a>
  </div>
</aside>
    <div class="sidebar-backdrop" id="sidebarBackdrop" onclick="toggleSidebar()"></div>
    <!-- MAIN -->
    <main id="main">
      <div class="topbar">
        <div class="d-flex align-items-center gap-3">
          <i class="bi bi-list toggle-btn" onclick="toggleSidebar()"></i>
          <h4 class="mb-0 text-primary">Barangay Captain Dashboard</h4>
        </div>
        <div>
          <select id="yearSelect" class="form-select d-inline w-auto"></select>
          <button class="btn btn-outline-primary ms-2" id="refreshBtn">
            <i class="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      <!-- STAT CARDS -->
      <div class="stat-grid">
        <div class="stat-card">
          <div class="icon-box bg-success-subtle text-success"><i class="bi bi-people"></i></div>
          <div>Total Population<br><b id="metricPopulation">0</b></div>
        </div>
        <div class="stat-card">
          <div class="icon-box bg-primary-subtle text-primary"><i class="bi bi-house"></i></div>
          <div>Total Households<br><b id="metricHouseholds">0</b></div>
        </div>
        <div class="stat-card">
          <div class="icon-box bg-info-subtle text-info"><i class="bi bi-gender-ambiguous"></i></div>
          <div>Gender Counts<br><b id="metricGender">M:0 | F:0</b></div>
        </div>
        <div class="stat-card">
          <div class="icon-box bg-warning-subtle text-warning"><i class="bi bi-person-badge"></i></div>
          <div>Senior Citizens<br><b id="metricSenior">0</b></div>
        </div>
        <div class="stat-card">
          <div class="icon-box bg-danger-subtle text-danger"><i class="bi bi-heart-pulse"></i></div>
          <div>PWD's<br><b id="metricPwd">0</b></div>
        </div>
        <div class="stat-card">
          <div class="icon bg-danger bg-opacity-10 text-danger p-3 rounded me-3"><i class="bi bi-person-heart"></i></div>
          <div>Pregnant Women<br><b id="metricPregnant">0</b></div>
        </div>
      </div>

      <!-- AGE -->
      <h5 class="mt-4 fw-bold">Age Brackets</h5>
      <div class="age-grid">
        <div class="card-box">0-5<br><b id="age_0_5">0</b></div>
        <div class="card-box">6-10<br><b id="age_6_10">0</b></div>
        <div class="card-box">11-15<br><b id="age_11_15">0</b></div>
        <div class="card-box">16-20<br><b id="age_16_20">0</b></div>
        <div class="card-box">21-30<br><b id="age_21_30">0</b></div>
        <div class="card-box">31-40<br><b id="age_31_40">0</b></div>
        <div class="card-box">41-50<br><b id="age_41_50">0</b></div>
        <div class="card-box">51-60<br><b id="age_51_60">0</b></div>
        <div class="card-box">61-70<br><b id="age_61_70">0</b></div>
        <div class="card-box">71+<br><b id="age_71_plus">0</b></div>
      </div>

      <!-- CHARTS -->
      <h5 class="mt-4 fw-bold">Demographic Charts</h5>
      <div class="chart-grid">
        <div class="card-box text-center">
          <h6>Population by Age Group</h6>
          <canvas id="ageChart"></canvas>
        </div>
        <div class="card-box chart-card--pie">
          <h6>Population by Gender</h6>
          <div class="chart-square-wrap">
            <canvas id="genderChart"></canvas>
          </div>
          <div class="chart-legend" id="genderLegend"></div>
        </div>
        <div class="card-box chart-card--pie">
          <h6>Population by Civil Status</h6>
          <div class="chart-square-wrap">
            <canvas id="civilChart"></canvas>
          </div>
          <div class="chart-legend" id="civilLegend"></div>
        </div>
      </div>

      <div class="chart-grid mt-3">
        <div class="card-box chart-card--pie">
          <h6>Educational Attainment</h6>
          <div class="chart-square-wrap">
            <canvas id="educationChart"></canvas>
          </div>
          <div class="chart-legend" id="educationLegend"></div>
        </div>
        <div class="card-box chart-card--pie">
          <h6>Occupation / Employment Status</h6>
          <div class="chart-square-wrap">
            <canvas id="employmentChart"></canvas>
          </div>
          <div class="chart-legend" id="employmentLegend"></div>
        </div>
        <div class="card-box chart-card--pie">
          <h6>Household Size / Family Composition</h6>
          <div class="chart-square-wrap">
            <canvas id="householdChart"></canvas>
          </div>
          <div class="chart-legend" id="householdLegend"></div>
        </div>
      </div>
    </main>
  </div>

  <!-- FOOTER -->
  <footer class="footer text-muted">
    &copy; <span id="year"></span> <?= htmlspecialchars(auth_footer_system_name(), ENT_QUOTES, 'UTF-8') ?>. All rights reserved.
  </footer>

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

  <script src="assets/js/index-scripts.js?v=<?= htmlspecialchars($dashboardScriptVersion, ENT_QUOTES, 'UTF-8') ?>"></script>

</body>
</html>





