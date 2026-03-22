# medicine-stock-system

Medicine Stock Monitoring System for Ligao City Coastal Rural Health Unit, Cabarian, Ligao City.

## Current Pages

- `index.php` - admin dashboard entry
- `staff.php` - staff dashboard entry
- `medicine-inventory.php` - medicine inventory workspace
- `dispensing-records.php` - dispensing history and medication records
- `cho-request-log.php` - request monitoring and delivery tracking
- `reports.php` - reports workspace
- `settings.php` - admin credentials, BHW management, presence, and logs
- `login.php` / `logout.php` - authentication entry and exit

## Backend Foundation

- `db.php` - PDO connection plus automatic schema bootstrap for medicine module tables
- `auth.php` - session, page auth, first-time admin setup, and helper functions
- `auth-api.php` - login, logout, setup, and heartbeat endpoint
- `state-api.php` - authenticated JSON snapshot endpoint for users, sessions, logs, inventory, movements, residents, and CHO requests
- `database/migrations/2026-03-21_create_mss_core_tables.sql` - SQL reference for the first backend schema

## Dependencies

### Composer Dependencies

The project now mirrors the Composer setup used by the `household-system` module:

- `setasign/fpdf` `^1.8`
- `phpoffice/phpspreadsheet` `^1.29`

These packages are provisioned for server-side PDF and Excel export work and for Hostinger deployment parity. The current `reports.php` UI still uses the existing frontend export flow, but the module now includes:

- `composer.json`
- `composer.lock`
- `vendor/`

### Frontend Libraries

- Bootstrap `5.3.3` via CDN
- Bootstrap Icons via CDN
- jsPDF via CDN
- jsPDF AutoTable via CDN

## First-Time Setup

- On the first visit, the system asks the admin to create the initial username and password.
- BHW accounts are created by the admin after the setup flow is completed.
