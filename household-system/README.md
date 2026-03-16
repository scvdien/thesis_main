# Household Information Management System (HIMS)

## Project Overview

The Household System is a PHP and MySQL based web application used to manage barangay household records, resident profiles, yearly registration data, dashboard analytics, and report exports. It includes separate entry points for administrators, the barangay captain, and registration staff, plus an offline-capable household registration flow that can queue local changes and sync them back to the server.

This module is structured as a traditional multi-page PHP application with bundled frontend assets. Core operations such as authentication, registration sync, report analytics, audit trail logging, user management, backup and restore, and export generation are implemented directly in the repository.

## Key Features

- Role-based access for `admin`, `captain`, and `staff` users.
- Dedicated module entry pages for dashboard, household records, residents, reports, settings, and audit trail.
- Household and resident registration workflow with create, update, delete, and lookup operations.
- Year-based household rollover support through `registration-sync.php` and SQL migration procedures.
- Offline-ready registration module powered by a service worker and IndexedDB queue storage.
- Dashboard analytics for population, gender, age groups, civil status, education, employment, household size, and housing/utility indicators.
- Health-related analytics for pregnant women, malnourished children, persons with illness, and deaths by cause.
- PDF and Excel annual report export using Composer-installed libraries.
- User account management, credential reset flow, and `must_change_password` enforcement.
- Barangay profile management, including official seal upload for report output.
- Household backup, download, and restore tools with year-based backup scope support.
- Audit trail logging and active session / presence tracking for authenticated users.

## Technologies Used

- PHP for the application logic and server-rendered pages.
- MySQL with PDO for database access.
- Bootstrap `5.3.8` for layout and UI components.
- Bootstrap Icons for interface icons.
- Chart.js for dashboard and demographic visualizations.
- Service Worker and Web App Manifest for installable offline registration support.
- IndexedDB for local offline registration storage and sync queue handling.
- Composer for PHP dependency management.
- FPDF for PDF export generation.
- PhpSpreadsheet for Excel export generation.

## Project Structure

```text
household-system/
|-- admin.php                      # Admin dashboard entry
|-- index.php                      # Barangay captain dashboard entry
|-- registration.php               # Staff registration module
|-- households.php                 # Household records page
|-- residents.php                  # Residents listing page
|-- reports.php                    # Reports interface
|-- settings.php                   # Account, profile, and backup settings
|-- audit-trail.php                # Audit trail viewer
|-- login.php / logout.php         # Authentication entry and exit
|-- auth.php                       # Auth, sessions, role routing, CSRF helpers
|-- db.php                         # PDO connection and environment-based DB config
|-- registration-sync.php          # Household/member/resident sync API
|-- dashboard-analytics-api.php    # Dashboard analytics data source
|-- reports-api.php                # Report data API
|-- report-export.php              # PDF/XLSX export pipeline
|-- users-api.php                  # User management, barangay profile, backups
|-- service-worker.js              # Offline caching rules for registration module
|-- manifest.webmanifest           # PWA metadata for the registration module
|-- assets/
|   |-- css/                       # Page stylesheets
|   |-- js/                        # Frontend page scripts and offline helpers
|   |-- img/                       # Logos and images
|   `-- vendor/                    # Bundled frontend libraries
|-- bootstrap/                     # Local Bootstrap distribution
|-- database/
|   `-- migrations/                # Stored procedure migrations for sync rollover
`-- vendor/                        # Composer packages for export features
```

## Dependencies

### Composer Dependencies

The project currently declares the following PHP packages in `composer.json`:

- `setasign/fpdf` `^1.8`
- `phpoffice/phpspreadsheet` `^1.29`

These are required by `report-export.php` for PDF and Excel output. If `vendor/autoload.php` is missing, Excel export will fail and the code will prompt for `composer install`.

### Bundled Frontend Libraries

- Bootstrap `5.3.8` from the local `bootstrap/` directory
- Bootstrap Icons from `assets/vendor/bootstrap-icons/`
- Chart.js from `assets/vendor/chartjs/`

### Runtime Requirements

- PHP environment capable of running the included pages and Composer packages
- MySQL database accessible through PDO
- Writable storage for uploaded official seal images and generated backup files
- Browser support for Service Worker and IndexedDB to use the offline registration experience

## Development Notes

- Database connection defaults are read from environment variables in `db.php`:
  - `DB_HOST` default: `127.0.0.1`
  - `DB_PORT` default: `3306`
  - `DB_USERNAME` / `DB_USER` default: `root`
  - `DB_PASSWORD` / `DB_PASS` default: empty string
  - `DB_NAME` default: `thesis_main`
- Authentication uses the `hims_session` session name and routes users by role to `admin.php`, `index.php`, or `registration.php`.
- The offline registration flow is centered on `registration.php`, `member.php`, `service-worker.js`, `assets/js/registration-offline-init.js`, and `assets/js/indexeddb-storage-scripts.js`.
- `registration-sync.php` handles household, member, and resident sync operations and also supports year rollover and rollover reset actions.
- Stored procedures related to registration sync rollover are defined under `database/migrations/`.
- `users-api.php` contains a large portion of the settings and system administration logic, including staff account creation, own credential updates, barangay profile updates, official seal handling, backup creation, backup download, and restore operations.
- `dashboard-analytics-api.php` aggregates demographic, socio-economic, housing, and health indicators directly from stored household and resident data.
- `report-export.php` supports PDF and XLSX export and includes fallback database name checks for `thesis_main`, `barangay_hims`, `hims`, and `thesis`.
- The project is organized as a server-rendered PHP application with direct asset loading; there is no frontend build pipeline in this module.
