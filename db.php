<?php
declare(strict_types=1);

/**
 * @param array<int, string> $keys
 */
function db_env(array $keys, string $default = ''): string
{
    foreach ($keys as $key) {
        if (isset($_ENV[$key]) && trim((string) $_ENV[$key]) !== '') {
            return trim((string) $_ENV[$key]);
        }
        if (isset($_SERVER[$key]) && trim((string) $_SERVER[$key]) !== '') {
            return trim((string) $_SERVER[$key]);
        }
        $value = getenv($key);
        if ($value !== false && trim((string) $value) !== '') {
            return trim((string) $value);
        }
    }

    return $default;
}

/**
 * @param callable(array<int, string>, string): string|null $envReader
 */
function db_connection(?callable $envReader = null): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if (!class_exists('PDO')) {
        throw new RuntimeException('PDO extension is not available.');
    }

    $readEnv = $envReader ?? 'db_env';
    $host = $readEnv(['DB_HOST'], '127.0.0.1');
    $port = $readEnv(['DB_PORT'], '3306');
    $username = $readEnv(['DB_USERNAME', 'DB_USER'], 'root');
    $password = $readEnv(['DB_PASSWORD', 'DB_PASS'], '');
    $database = $readEnv(['DB_NAME'], 'thesis_main');

    if (preg_match('/^[A-Za-z0-9_]+$/', $database) !== 1) {
        throw new RuntimeException('Invalid database name.');
    }

    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", $username, $password, $options);
        return $pdo;
    } catch (Throwable $exception) {
        // Fallback: try creating the database when it does not exist yet.
    }

    $pdo = new PDO("mysql:host={$host};port={$port};charset=utf8mb4", $username, $password, $options);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `{$database}`");

    return $pdo;
}
