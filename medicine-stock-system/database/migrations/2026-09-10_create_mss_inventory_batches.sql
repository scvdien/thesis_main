-- Migration: 2026-09-10 Create MSS Inventory Batches & Add Movement Batch Columns
-- Description: Supports multi-batch tracking and FEFO inventory for medicines.

CREATE TABLE IF NOT EXISTS `mss_inventory_batches` (
  `id` VARCHAR(64) NOT NULL,
  `medicine_id` VARCHAR(64) NOT NULL,
  `batch_number` VARCHAR(80) NOT NULL,
  `expiry_date` DATE NOT NULL,
  `quantity_received` INT NOT NULL DEFAULT 0,
  `quantity_remaining` INT NOT NULL DEFAULT 0,
  `received_date` DATE NOT NULL,
  `source_type` VARCHAR(40) NOT NULL DEFAULT 'initial',
  `source_reference` VARCHAR(120) NOT NULL DEFAULT '',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mss_batches_med_expiry` (`medicine_id`, `expiry_date`),
  KEY `idx_mss_batches_medicine_id` (`medicine_id`),
  KEY `idx_mss_batches_status` (`status`),
  KEY `idx_mss_batches_number` (`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill initial batches for active medicines that have stock and don't have a batch yet
INSERT INTO `mss_inventory_batches`
  (`id`, `medicine_id`, `batch_number`, `expiry_date`, `quantity_received`, `quantity_remaining`, `received_date`, `source_type`, `source_reference`, `status`, `created_at`, `updated_at`)
SELECT
  CONCAT('batch_init_', MD5(CONCAT(m.`id`, '_', COALESCE(m.`batch_number`, 'init')))) AS `id`,
  m.`id` AS `medicine_id`,
  CASE WHEN TRIM(COALESCE(m.`batch_number`, '')) IN ('', '-') THEN 'INITIAL-BATCH' ELSE TRIM(m.`batch_number`) END AS `batch_number`,
  COALESCE(m.`expiry_date`, DATE_ADD(CURRENT_DATE, INTERVAL 1 YEAR)) AS `expiry_date`,
  m.`stock_on_hand` AS `quantity_received`,
  m.`stock_on_hand` AS `quantity_remaining`,
  COALESCE(DATE(m.`last_updated_at`), CURRENT_DATE) AS `received_date`,
  'initial' AS `source_type`,
  'Initial stock migration' AS `source_reference`,
  CASE WHEN m.`stock_on_hand` <= 0 THEN 'exhausted' ELSE 'active' END AS `status`,
  COALESCE(m.`last_updated_at`, NOW()) AS `created_at`,
  COALESCE(m.`last_updated_at`, NOW()) AS `updated_at`
FROM `mss_inventory_records` m
WHERE NOT EXISTS (
  SELECT 1 FROM `mss_inventory_batches` b WHERE b.`medicine_id` = m.`id`
);
