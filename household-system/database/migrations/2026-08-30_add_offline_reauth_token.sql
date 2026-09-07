ALTER TABLE `users` ADD COLUMN `offline_reauth_token` VARCHAR(128) DEFAULT NULL AFTER `must_change_password`;
