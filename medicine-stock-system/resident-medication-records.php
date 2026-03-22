<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$authUser = mss_page_require_auth(['admin', 'staff']);
$residentRecordsRole = mss_auth_user_role($authUser) === 'staff' ? 'staff' : 'admin';
mss_page_redirect('dispensing-records.php?role=' . $residentRecordsRole);
