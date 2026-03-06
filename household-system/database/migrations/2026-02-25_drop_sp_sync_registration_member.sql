-- Rollback Migration: Drop sp_sync_registration_member
-- Generated: 2026-02-25
-- WARNING:
--   registration_members triggers currently CALL this procedure.
--   If you run this rollback without updating/dropping those triggers,
--   INSERT/UPDATE on registration_members can fail.

DROP PROCEDURE IF EXISTS `sp_sync_registration_member`;
