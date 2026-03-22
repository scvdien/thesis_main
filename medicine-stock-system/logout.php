<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';

$pdo = mss_auth_bootstrap();
mss_auth_logout($pdo);

header('Location: login.php');
exit;
