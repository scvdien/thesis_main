<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
mss_page_require_auth(['admin']);
$supplyMonitoringJsVersion = (string) @filemtime(__DIR__ . '/assets/js/supply-monitoring.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Nurse-in-Charge Dashboard - Ligao City Coastal RHU</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;family=Sora:wght@500;600;700&amp;display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css">
  <link rel="stylesheet" href="assets/css/system-notifications.css">
</head>
<body class="admin-dashboard-page">
  <div id="wrapper">
    <div id="content-area">
      <aside id="sidebar">
        <div class="brand d-flex align-items-center gap-2 mb-3">
          <img src="assets/img/CityHealthOffice_LOGO.png" alt="Ligao City Coastal Rural Health Unit Logo">
          <div class="brand-text-wrap">
            <span class="brand-title">Ligao City Coastal RHU</span>
            <span class="brand-sub">Cabarian, Ligao City</span>
          </div>
        </div>

        <div class="menu">
          <a href="index.php" class="active"><i class="bi bi-speedometer2"></i>Dashboard</a>
          <a href="medicine-inventory.php"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="page-intro">
              <h4 class="mb-0 text-primary">Nurse-in-Charge Dashboard</h4>
            </div>
          </div>
        </div>

        <section class="demand-suite">
          <div class="demand-suite__inner">
            <div class="demand-suite__head">
              <h5>Demand Prediction Analytics</h5>
              <p>Estimated medicine demand for the next season.</p>
            </div>

            <div class="demand-summary-grid">
              <article class="demand-summary-card demand-summary-card--green">
                <div class="demand-summary-card__icon">
                  <i class="bi bi-capsule"></i>
                </div>
                <div class="demand-summary-card__body">
                  <strong id="metricDemandForecast">0</strong>
                  <span>Predicted Next Demand</span>
                </div>
              </article>

              <article class="demand-summary-card demand-summary-card--blue">
                <div class="demand-summary-card__icon">
                  <i class="bi bi-cloud-rain-heavy-fill" id="metricDemandSeasonIcon"></i>
                </div>
                <div class="demand-summary-card__body">
                  <strong id="metricDemandUplift">0</strong>
                  <span id="metricDemandSeasonLabel">Expected Next Season Change</span>
                </div>
              </article>

              <article class="demand-summary-card demand-summary-card--gold">
                <div class="demand-summary-card__icon">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                </div>
                <div class="demand-summary-card__body">
                  <strong id="metricDemandReorder">0</strong>
                <span>Medicines to Request Soon</span>
                </div>
              </article>

              <article class="demand-summary-card demand-summary-card--sand">
                <div class="demand-summary-card__icon">
                  <i class="bi bi-capsule-pill"></i>
                </div>
                <div class="demand-summary-card__body">
                  <strong id="metricDemandPriority">0</strong>
                  <span>Medicines to Watch</span>
                </div>
              </article>
            </div>

            <div class="demand-content-grid">
              <section class="demand-card demand-card--chart">
                <div class="demand-card__head">
                  <h6>Medicine Demand Trend</h6>
                </div>
                <div class="demand-chart-wrap">
                  <canvas id="demandForecastChart"></canvas>
                </div>
              </section>

              <aside class="demand-card demand-card--side">
                <div class="demand-card__head">
                  <h6>Medicines to Watch</h6>
                </div>
                <div class="demand-priority-list" id="seasonalSignalList"></div>
              </aside>
            </div>
          </div>
        </section>

        <section class="pattern-suite">
          <div class="pattern-suite__grid">
            <section class="pattern-panel pattern-panel--main">
              <div class="pattern-panel__head">
                <h5>Disease Pattern Analytics</h5>
                <p>Cabarian, Ligao City - Common Illness Trend</p>
              </div>

              <div class="pattern-panel__body">
                <div class="pattern-case-grid" id="diseasePatternList"></div>

                <section class="pattern-medicine-card">
                  <div class="pattern-medicine-card__head">
                    <span>Requested Medicines</span>
                    <small>Series and request frequency</small>
                  </div>
                  <div class="pattern-medicine-card__chart">
                    <canvas id="diseasePatternChart"></canvas>
                  </div>
                </section>
              </div>
            </section>
          </div>
        </section>

        <section class="movement-suite">
          <div class="movement-suite__inner">
            <div class="movement-suite__head">
              <div class="movement-suite__title">
                <h5>Stock Movement Analytics</h5>
                <p>Fast-moving and slow-moving medicine flow in Cabarian, Ligao City.</p>
              </div>
              <div class="movement-suite__summary">
                <article class="movement-summary movement-summary--fast">
                  <span class="movement-summary__label">Fast Movers</span>
                  <strong id="stockMovementFastCount">0 items</strong>
                </article>
                <article class="movement-summary movement-summary--slow">
                  <span class="movement-summary__label">Slow Movers</span>
                  <strong id="stockMovementSlowCount">0 items</strong>
                </article>
              </div>
            </div>

            <div class="movement-grid">
              <section class="movement-panel">
                <div class="movement-panel__head">
                  <div class="movement-panel__title">
                    <h6>Fast Moving Medicines</h6>
                    <small>Highest stock turnover this cycle</small>
                  </div>
                </div>
                <div class="movement-list" id="stockFastList"></div>
              </section>

              <section class="movement-panel">
                <div class="movement-panel__head">
                  <div class="movement-panel__title">
                    <h6>Slow Moving Medicines</h6>
                    <small>Low turnover and watch-list items</small>
                  </div>
                </div>
                <div class="movement-list" id="stockSlowList"></div>
              </section>
            </div>
          </div>
        </section>

        <section class="supply-suite">
          <div class="supply-suite__inner">
            <div class="supply-suite__head">
              <div class="supply-suite__title">
                <h5>CHO Request Fulfillment Analytics</h5>
                <p id="supplySourceLabel">Monitor supply lead times and delivery reliability.</p>
              </div>
            </div>

            <div class="supply-summary-grid">
              <article class="supply-summary-card supply-summary-card--sand">
                <div class="supply-summary-card__icon">
                  <i class="bi bi-stopwatch-fill"></i>
                </div>
                <div class="supply-summary-card__copy">
                  <span>Avg. Lead Time</span>
                  <strong id="supplyAvgLeadTime">0 days</strong>
                </div>
              </article>

              <article class="supply-summary-card supply-summary-card--olive">
                <div class="supply-summary-card__icon">
                  <i class="bi bi-check2-circle"></i>
                </div>
                <div class="supply-summary-card__copy">
                  <span>On-Time Deliveries</span>
                  <strong id="supplyOnTimeCount">0</strong>
                </div>
                <div class="supply-summary-card__progress">
                  <span id="supplySummaryReliabilityFill"></span>
                </div>
              </article>

              <article class="supply-summary-card supply-summary-card--green">
                <div class="supply-summary-card__icon">
                  <i class="bi bi-truck"></i>
                </div>
                <div class="supply-summary-card__copy">
                  <span>Delayed Deliveries</span>
                  <strong id="supplyDelayedCount">0</strong>
                </div>
              </article>

              <article class="supply-summary-card supply-summary-card--gold">
                <div class="supply-summary-card__icon">
                  <i class="bi bi-box-seam"></i>
                </div>
                <div class="supply-summary-card__copy">
                  <span>Incomplete Deliveries</span>
                  <strong id="supplyIncompleteCount">0</strong>
                </div>
              </article>

              <article class="supply-summary-card supply-summary-card--rose">
                <div class="supply-summary-card__icon">
                  <i class="bi bi-hourglass-split"></i>
                </div>
                <div class="supply-summary-card__copy">
                  <span>Pending Requests</span>
                  <strong id="supplyPendingCount">0</strong>
                </div>
              </article>
            </div>

            <div class="supply-content-grid">
              <section class="supply-panel supply-panel--timeline">
                <div class="supply-panel__head">
                  <h6>CHO Request Timeline</h6>
                </div>
                <div class="supply-request-list" id="supplyRequestList"></div>
              </section>

              <section class="supply-panel supply-panel--chart">
                <div class="supply-panel__head">
                  <h6>CHO Response Lead Time (Days)</h6>
                </div>
                <div class="supply-chart-wrap">
                  <canvas id="supplyLeadTimeChart"></canvas>
                </div>
              </section>

              <section class="supply-panel supply-panel--reliability">
                <div class="supply-panel__head">
                  <h6>Request Fulfillment Reliability</h6>
                </div>
                <div class="supply-reliability-card">
                  <div class="supply-reliability-card__top">
                    <strong id="supplyReliabilityValue">0%</strong>
                    <span>On-Time Fulfillment</span>
                  </div>
                  <div class="supply-progress">
                    <span id="supplyReliabilityFill"></span>
                  </div>
                  <p id="supplyReliabilityNote">Loading reliability note.</p>
                </div>
              </section>
            </div>
          </div>
        </section>

        <section class="expiry-suite">
          <div class="expiry-suite__inner">
            <div class="expiry-suite__head">
              <h5>Expiry &amp; Consumption Dashboard</h5>
              <p>Track expiry dates and medicine usage.</p>
            </div>

            <div class="expiry-summary-grid">
              <article class="expiry-summary-card expiry-summary-card--gold">
                <div class="expiry-summary-card__icon">
                  <i class="bi bi-exclamation-triangle-fill"></i>
                </div>
                <div class="expiry-summary-card__copy">
                  <span>Near Expiry</span>
                  <strong id="expirySoonCount">0 medicines</strong>
                </div>
              </article>

              <article class="expiry-summary-card expiry-summary-card--sand">
                <div class="expiry-summary-card__icon">
                  <i class="bi bi-hourglass-split"></i>
                </div>
                <div class="expiry-summary-card__copy">
                  <span>Expiring in 30 Days</span>
                  <strong id="expiryThirtyCount">0 medicines</strong>
                </div>
              </article>

              <article class="expiry-summary-card expiry-summary-card--green">
                <div class="expiry-summary-card__icon">
                  <i class="bi bi-archive-fill"></i>
                </div>
                <div class="expiry-summary-card__copy">
                  <span>Total Inventory</span>
                  <strong id="expiryInventoryTotal">0 units</strong>
                </div>
              </article>

              <article class="expiry-summary-card expiry-summary-card--olive">
                <div class="expiry-summary-card__icon">
                  <i class="bi bi-bar-chart-fill"></i>
                </div>
                <div class="expiry-summary-card__copy">
                  <span>Slow Moving Medicines</span>
                  <strong id="expirySlowCount">0 medicines</strong>
                </div>
              </article>
            </div>

            <div class="expiry-grid">
              <div class="expiry-main">
                <section class="expiry-panel">
                  <div class="expiry-panel__head">
                    <h6>Medicines Near Expiry</h6>
                  </div>
                  <div class="expiry-medicine-list" id="expiryMedicineList"></div>
                </section>

                <section class="expiry-panel">
                  <div class="expiry-panel__head">
                    <h6>Monthly Usage</h6>
                  </div>
                  <div class="expiry-consumption-list" id="expiryConsumptionList"></div>
                </section>
              </div>

              <aside class="expiry-side">
                <section class="expiry-panel expiry-panel--risk">
                  <div class="expiry-panel__head">
                    <h6>Medicine at Risk</h6>
                  </div>
                  <div class="expiry-risk-card">
                    <strong id="expiryRiskTitle">Loading risk item</strong>
                    <div class="expiry-risk-facts" id="expiryRiskFacts"></div>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>

        <section class="balance-suite">
          <div class="balance-suite__inner">
            <div class="balance-suite__head">
              <h5>Inventory Balance Dashboard</h5>
              <p>Balance between overstocking (tying up capital, risk of expiry) and understocking (risk of shortages).</p>
            </div>

            <div class="balance-summary-grid">
              <article class="balance-summary-card balance-summary-card--sand">
                <div class="balance-summary-card__icon">
                  <i class="bi bi-archive-fill"></i>
                </div>
                <div class="balance-summary-card__copy">
                  <span>Monitored Medicines</span>
                  <strong id="balanceTotalMedicines">0 items</strong>
                </div>
              </article>

              <article class="balance-summary-card balance-summary-card--green">
                <div class="balance-summary-card__icon">
                  <i class="bi bi-check2-circle"></i>
                </div>
                <div class="balance-summary-card__copy">
                  <span>Balanced Stock</span>
                  <strong id="balanceBalancedCount">0 medicines</strong>
                </div>
              </article>

              <article class="balance-summary-card balance-summary-card--red">
                <div class="balance-summary-card__icon">
                  <i class="bi bi-arrow-down-circle-fill"></i>
                </div>
                <div class="balance-summary-card__copy">
                  <span>Low Stock</span>
                  <strong id="balanceLowCount">0 medicines</strong>
                </div>
              </article>

              <article class="balance-summary-card balance-summary-card--gold">
                <div class="balance-summary-card__icon">
                  <i class="bi bi-arrow-up-circle-fill"></i>
                </div>
                <div class="balance-summary-card__copy">
                  <span>Overstock</span>
                  <strong id="balanceOverstockCount">0 medicines</strong>
                </div>
              </article>
            </div>

            <div class="balance-grid">
              <section class="balance-panel balance-panel--bucket">
                <div class="balance-panel__head balance-panel__head--stack">
                  <h6>Understock Risk</h6>
                  <p>Medicines below request point and at risk of shortage.</p>
                </div>
                <div class="balance-bucket-list" id="balanceLowList"></div>
              </section>

              <section class="balance-panel balance-panel--bucket">
                <div class="balance-panel__head balance-panel__head--stack">
                  <h6>Balanced Stock</h6>
                  <p>Medicines staying within the safe stock range.</p>
                </div>
                <div class="balance-bucket-list" id="balanceBalancedList"></div>
              </section>

              <section class="balance-panel balance-panel--bucket">
                <div class="balance-panel__head balance-panel__head--stack">
                  <h6>Overstock Risk</h6>
                  <p>Medicines above stock ceiling and at higher expiry risk.</p>
                </div>
                <div class="balance-bucket-list" id="balanceOverstockList"></div>
              </section>
            </div>
          </div>
        </section>
      </main>
    </div>

    <footer class="footer text-muted">
      &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System. All rights reserved.
    </footer>
  </div>

  <div class="modal fade" id="refreshModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content modern-modal text-center p-4">
        <div class="modal-icon mb-3">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
        </div>
        <h5 class="modal-title mb-2">Refreshing Data</h5>
        <p class="mb-1">Please wait while we refresh dashboard metrics.</p>
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

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>
  <script src="assets/js/session-heartbeat.js?v=20260321-presence"></script>
  <script src="assets/js/supply-monitoring.js?v=<?= urlencode($supplyMonitoringJsVersion) ?>"></script>
  <script src="assets/js/admin-dashboard.js?v=20260321-demand-backend"></script>
  <script src="assets/js/system-notifications.js"></script>
</body>
</html>
