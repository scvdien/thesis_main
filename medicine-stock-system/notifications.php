<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin']);
$adminDashboardCssVersion = (string) @filemtime(__DIR__ . '/assets/css/admin-dashboard.css');
$notificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/notifications.css');
$systemNotificationsCssVersion = (string) @filemtime(__DIR__ . '/assets/css/system-notifications.css');
$notificationsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/notifications.js');
$systemNotificationsJsVersion = (string) @filemtime(__DIR__ . '/assets/js/system-notifications.js');
?><!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Notifications - Ligao City Coastal RHU</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@500;600;700&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <link rel="stylesheet" href="assets/css/admin-dashboard.css?v=<?= urlencode($adminDashboardCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/notifications.css?v=<?= urlencode($notificationsCssVersion) ?>">
  <link rel="stylesheet" href="assets/css/system-notifications.css?v=<?= urlencode($systemNotificationsCssVersion) ?>">
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
          <a href="index.php"><i class="bi bi-speedometer2"></i>Dashboard</a>
          <a href="medicine-inventory.php"><i class="bi bi-capsule-pill"></i>Medicine Inventory</a>
          <a href="cho-request-log.php"><i class="bi bi-clipboard2-plus"></i>CHO Request Log</a>
          <a href="dispensing-records.php?role=admin"><i class="bi bi-journal-medical"></i>Dispensing Records</a>
          <a href="reports.php"><i class="bi bi-file-earmark-text"></i>Reports</a>
          <a href="notifications.php" class="active"><i class="bi bi-bell"></i>Notifications</a>
          <a href="settings.php"><i class="bi bi-gear"></i>Settings</a>
          <a href="#" class="text-danger" id="logoutLink"><i class="bi bi-box-arrow-right"></i>Logout</a>
        </div>
      </aside>

      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <main id="main" class="notifications-main">
        <div class="topbar">
          <div class="d-flex align-items-center gap-3">
            <button type="button" class="toggle-btn" id="sidebarToggle" aria-label="Toggle sidebar">
              <i class="bi bi-list"></i>
            </button>
            <div class="page-intro">
              <h4 class="mb-0 text-primary">Notifications</h4>
            </div>
          </div>
        </div>

        <div id="moduleAlert" class="alert d-none" role="alert"></div>

        <section class="notification-panel notification-panel--feed">
          <div class="notification-toolbar notification-toolbar--simple">
            <div class="notification-toolbar__main">
              <div class="notification-filter-groups" aria-label="Notification filters">
                <div class="notification-filter-cluster">
                  <div class="notification-quick-filters" role="group" aria-label="Notification types">
                    <button type="button" class="notification-filter-pill is-active" data-notification-type="all" aria-pressed="true">All</button>
                    <button type="button" class="notification-filter-pill" data-notification-type="low-stock" aria-pressed="false">Low Stock</button>
                    <button type="button" class="notification-filter-pill" data-notification-type="out-of-stock" aria-pressed="false">Out of Stock</button>
                    <button type="button" class="notification-filter-pill" data-notification-type="expiring-soon" aria-pressed="false">Expiring Soon</button>
                    <button type="button" class="notification-filter-pill" data-notification-type="critical" aria-pressed="false">Critical</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="notification-toolbar__aside">
              <div class="notification-system-controls" id="notificationSystemControls" aria-label="Notification preferences"></div>
              <span class="notification-record-count" id="notificationCount">0 alerts</span>
            </div>
          </div>

          <div class="notification-feed" id="notificationFeed">
            <div class="notification-empty">Loading notifications...</div>
          </div>
        </section>
      </main>
    </div>

    <footer class="footer text-muted">
      &copy; <span id="year"></span> Ligao City Coastal RHU Medicine Stock Monitoring System. All rights reserved.
    </footer>
  </div>

  <div class="modal fade" id="notificationMessageModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content notification-message-modal">
        <div class="modal-header border-0">
          <div class="notification-message-modal__head">
            <span class="notification-meta-label" id="notificationModalCategory">Medicine Status</span>
            <div class="notification-message-modal__actions">
              <span class="notification-badge notification-badge--info" id="notificationModalPriority">Alert</span>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
        </div>

        <div class="modal-body pt-0">
          <h5 id="notificationModalTitle">Notification</h5>
          <p id="notificationModalBody">Message details will appear here.</p>

          <div class="notification-message-modal__meta">
            <span>Timeline</span>
            <strong id="notificationModalTime">-</strong>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="deleteNotificationModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content notification-confirm-modal notification-confirm-modal--local text-center p-4">
        <div class="notification-confirm-modal__icon notification-confirm-modal__icon--local mb-3">
          <i class="bi bi-eye-slash fs-1"></i>
        </div>
        <h5 class="modal-title mb-2">Remove Notification</h5>
        <p class="mb-3 text-muted" id="deleteNotificationMessage">Remove this notification from your view only?</p>
        <div class="d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" class="btn btn-secondary btn-modern" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-success btn-modern" id="confirmDeleteNotificationBtn">Remove</button>
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

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="assets/js/session-heartbeat.js?v=20260321-presence"></script>
  <script>
    window.MSS_AUTH_USER = <?= json_encode(mss_auth_user_payload($authUser), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script src="assets/js/notifications.js?v=<?= urlencode($notificationsJsVersion) ?>"></script>
  <script src="assets/js/system-notifications.js?v=<?= urlencode($systemNotificationsJsVersion) ?>"></script>
</body>
</html>
