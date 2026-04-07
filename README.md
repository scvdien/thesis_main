# thesis-main

`thesis-main` is a shared PHP/MySQL repository that contains two connected web applications for barangay operations:

- `household-system/` - Online Household Information Management System
- `medicine-stock-system/` - Medicine Stock Monitoring System

Both modules can run from one XAMPP or shared-hosting setup and can use the same database connection through the root `db.config.php`.

## Modules

### 1. Household System

The `household-system/` module is the barangay household and resident information system. It is a multi-page PHP application with role-based access for:

- `admin`
- `captain`
- `staff`

Main capabilities:

- household registration and yearly record management
- resident profile storage and lookup
- offline-capable registration using Service Worker and IndexedDB
- pending sync queue with automatic sync when internet returns
- captain and admin dashboards with demographic analytics
- household, resident, report, and audit trail pages
- report export to PDF and Excel
- barangay profile, user management, backup, and restore tools

Important files:

- `household-system/registration.php` - staff registration page
- `household-system/registration-sync.php` - registration sync and yearly rollover API
- `household-system/settings.php` - profile, users, and backup/restore settings
- `household-system/service-worker.js` - offline registration caching
- `household-system/assets/js/indexeddb-storage-scripts.js` - local offline storage helper

### 2. Medicine Stock System

The `medicine-stock-system/` module is the RHU/barangay medicine inventory and dispensing system. It supports:

- `admin` / nurse-in-charge access
- `staff` / barangay health worker access

Main capabilities:

- medicine inventory management
- dispensing records and patient medication history
- CHO request logging and fulfillment tracking
- notifications and status monitoring
- dashboard analytics for demand, disease patterns, stock movement, and supply lead time
- report pages and export-ready backend setup
- settings, account management, and activity/state APIs

The medicine module can also read resident records from the household module through `medicine-stock-system/household-residents-api.php` when the `registration_residents` table is available.

Important files:

- `medicine-stock-system/index.php` - admin dashboard
- `medicine-stock-system/staff.php` - staff/BHW workspace
- `medicine-stock-system/medicine-inventory.php` - inventory module
- `medicine-stock-system/dispensing-records.php` - dispense history and medication records
- `medicine-stock-system/cho-request-log.php` - request and delivery tracking
- `medicine-stock-system/state-api.php` - authenticated state/data API

## Shared Setup

Both applications use the same root database config:

- `db.config.php`

Default local development values in this repository:

- `DB_HOST=127.0.0.1`
- `DB_PORT=3306`
- `DB_NAME=thesis_main`
- `DB_USERNAME=root`
- `DB_PASSWORD=` (blank for default local XAMPP)

The repository also includes a shared private storage area:

- `private-storage/backups/`
- `private-storage/tmp/`
- `private-storage/uploads/official-seals/`

## Local Development

Recommended environment:

- XAMPP / Apache / MySQL
- PHP `8.3+` recommended
- required PHP extensions for export and uploads such as `pdo_mysql`, `mbstring`, `gd`, `fileinfo`, `zip`, `xml`, `iconv`, and `zlib`
- Composer dependencies installed inside each module

Typical local URLs when the project is placed in `htdocs/thesis-main`:

- `http://localhost/thesis-main/household-system/`
- `http://localhost/thesis-main/medicine-stock-system/`

## First-Time Access

### Household System

- first-time setup creates the initial barangay captain account if setup is allowed
- user routing depends on role:
  - `admin` -> `admin.php`
  - `captain` -> `index.php`
  - `staff` -> `registration.php`

### Medicine Stock System

- first-time setup creates the initial admin account
- admin users land on `index.php`
- staff/BHW users land on `staff.php`

## Composer Dependencies

Both modules currently include:

- `setasign/fpdf`
- `phpoffice/phpspreadsheet`

These packages support PDF and Excel export workflows and are already declared in:

- `household-system/composer.json`
- `medicine-stock-system/composer.json`

## Deployment Notes

### Household System Offline Registration

- offline registration on hosted sites requires HTTPS because Service Worker and app install features are secure-context features
- records created while offline are saved locally and placed in the pending sync queue
- database duplicate checks should only be confirmed during online sync, while offline duplicate checks should be limited to local pending items

### Household System Sync Routines

- shared-hosting-safe mode keeps sync routines disabled by default unless `AUTH_ENABLE_SYNC_ROUTINES=1`
- if you intentionally enable sync routines, import these migration files:
  - `household-system/database/migrations/2026-02-25_create_sp_sync_registration_household.sql`
  - `household-system/database/migrations/2026-02-25_create_sp_sync_registration_member.sql`
- if routines stay disabled, remove any legacy triggers that still call:
  - `sp_sync_registration_household`
  - `sp_sync_registration_member`

### Medicine and Household Integration

- the medicine module can operate on its own core tables
- when the household module is present in the same database, medicine pages can also use synced resident data for patient-related workflows

## Repository Structure

```text
thesis-main/
|-- household-system/          # Household and resident information system
|-- medicine-stock-system/     # Medicine stock and dispensing system
|-- private-storage/           # Backups, temp files, and uploads
|-- db.config.php              # Shared database and runtime config
|-- README.md                  # Root project overview
|-- household-system.zip       # Packaged household-system archive
`-- medicine-stock-system.zip  # Packaged medicine-stock-system archive
```

## Additional Module Documentation

For module-specific details, see:

- `household-system/README.md`
- `medicine-stock-system/README.md`
