<?php
declare(strict_types=1);

/**
 * @return array<string, string>
 */
function db_config_accepts_empty_value(string $key): bool
{
    return in_array($key, ['DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD'], true);
}

/**
 * @return array<string, string>
 */
function db_file_config(): array
{
    static $config = null;
    if (is_array($config)) {
        return $config;
    }

    $config = [];
    $rootDir = dirname(__DIR__);
    $paths = [
        __DIR__ . DIRECTORY_SEPARATOR . 'db.runtime.php',
        __DIR__ . DIRECTORY_SEPARATOR . 'db.config.php',
        $rootDir . DIRECTORY_SEPARATOR . 'db.runtime.php',
        $rootDir . DIRECTORY_SEPARATOR . 'db.config.php',
    ];

    foreach ($paths as $path) {
        if (!is_file($path)) {
            continue;
        }

        $loaded = require $path;
        if (!is_array($loaded)) {
            continue;
        }

        foreach ($loaded as $key => $value) {
            if ((!is_string($key) && !is_int($key)) || !is_scalar($value)) {
                continue;
            }

            $normalizedKey = strtoupper(trim((string) $key));
            $normalizedValue = trim((string) $value);
            if ($normalizedKey === '') {
                continue;
            }
            if ($normalizedValue === '' && !db_config_accepts_empty_value($normalizedKey)) {
                continue;
            }

            if (!array_key_exists($normalizedKey, $config)) {
                $config[$normalizedKey] = $normalizedValue;
            }
        }
    }

    return $config;
}

/**
 * @param array<int, string> $keys
 */
function db_env(array $keys, string $default = ''): string
{
    $fileConfig = db_file_config();
    foreach ($keys as $key) {
        $normalizedKey = strtoupper(trim((string) $key));
        if ($normalizedKey !== '' && isset($fileConfig[$normalizedKey])) {
            return $fileConfig[$normalizedKey];
        }

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

    return trim($default);
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
    $host = $readEnv(['DB_HOST', 'MYSQL_HOST'], 'localhost');
    $port = $readEnv(['DB_PORT', 'MYSQL_PORT'], '3306');
    $username = $readEnv(['DB_USERNAME', 'DB_USER', 'MYSQL_USER'], 'root');
    $password = $readEnv(['DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD'], '');
    $database = $readEnv(['DB_NAME', 'DB_DATABASE', 'MYSQL_DATABASE'], 'thesis_main');

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
        throw new RuntimeException(
            'Database connection failed. Check DB_HOST, DB_PORT, DB_NAME, DB_USERNAME, and DB_PASSWORD.',
            0,
            $exception
        );
    }
}
