-- Migration: Add solo_parent columns to household_members and households
-- Date: 2026-09-20

ALTER TABLE `household_members`
  ADD COLUMN `solo_parent` VARCHAR(16) NOT NULL DEFAULT 'No' AFTER `ip`;

ALTER TABLE `households`
  ADD COLUMN `head_solo_parent` VARCHAR(16) NOT NULL DEFAULT 'No' AFTER `head_ip`;
