# thesis-main

Project structure:

- `household-system/` - Online Household Information System
- `medicine-stock-system/` - Medicine Stock Monitoring System (scaffold folder for integration)

Both systems can use one shared database connection/config as needed.

Shared hosting note for `household-system`:

- Default shared-hosting-safe mode keeps sync routines disabled unless `AUTH_ENABLE_SYNC_ROUTINES=1`.
- If you intentionally enable sync routines, import these SQL files in your MySQL database:
  - `household-system/database/migrations/2026-02-25_create_sp_sync_registration_household.sql`
  - `household-system/database/migrations/2026-02-25_create_sp_sync_registration_member.sql`
- If routines stay disabled, remove any legacy triggers that still call `sp_sync_registration_household` or `sp_sync_registration_member`.
- The Settings > Backup & Restore panel now shows database setup health so missing tables, procedures, or legacy trigger risks are easier to spot before going live.
- The same panel now also checks PHP environment readiness, including PHP `8.3+` with `8.3/8.4` preferred for the bundled spreadsheet package, 64-bit PHP, Composer `vendor/` files, and required extensions such as `pdo_mysql`, `mbstring`, `gd`, `fileinfo`, `zip`, `xml*`, `iconv`, and `zlib`.
