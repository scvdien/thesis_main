-- Rollback Migration: Drop sp_sync_registration_household
-- Generated: 2026-02-25
-- WARNING:
--   registration_households triggers currently CALL this procedure.
--   If you run this rollback without updating/dropping those triggers,
--   INSERT/UPDATE on registration_households can fail.

DROP PROCEDURE IF EXISTS `sp_sync_registration_household`;
