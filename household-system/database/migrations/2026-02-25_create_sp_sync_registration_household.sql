-- Migration: Create/replace sp_sync_registration_household
-- Generated: 2026-02-25 22:37:06
-- Purpose: Keep households table synchronized from registration_households triggers.

DROP PROCEDURE IF EXISTS `sp_sync_registration_household`;
DELIMITER $$

CREATE PROCEDURE `sp_sync_registration_household`(
  IN p_household_code VARCHAR(64),
  IN p_source VARCHAR(80),
  IN p_head_name VARCHAR(180),
  IN p_zone VARCHAR(80),
  IN p_member_count INT,
  IN p_head_data_json LONGTEXT,
  IN p_members_data_json LONGTEXT,
  IN p_record_data_json LONGTEXT,
  IN p_created_by_user_id BIGINT,
  IN p_updated_by_user_id BIGINT,
  IN p_created_at DATETIME,
  IN p_updated_at DATETIME
)
BEGIN
  DECLARE v_head_json LONGTEXT;
  DECLARE v_record_json LONGTEXT;
  DECLARE v_record_head_json LONGTEXT;
  DECLARE v_text VARCHAR(255);

  DECLARE v_first_name VARCHAR(120);
  DECLARE v_middle_name VARCHAR(120);
  DECLARE v_last_name VARCHAR(160);
  DECLARE v_extension_name VARCHAR(60);
  DECLARE v_full_name VARCHAR(255);

  DECLARE v_head_age INT;
  DECLARE v_head_height DECIMAL(10,2);
  DECLARE v_head_weight DECIMAL(10,2);

  DECLARE v_num_members INT;
  DECLARE v_num_children INT;
  DECLARE v_num_rooms INT;
  DECLARE v_member_count INT;

  DECLARE v_created_at DATETIME;
  DECLARE v_updated_at DATETIME;

  SET v_head_json = CASE
    WHEN p_head_data_json IS NOT NULL AND JSON_VALID(p_head_data_json) THEN p_head_data_json
    ELSE '{}'
  END;

  SET v_record_json = CASE
    WHEN p_record_data_json IS NOT NULL AND JSON_VALID(p_record_data_json) THEN p_record_data_json
    ELSE '{}'
  END;

  SET v_record_head_json = COALESCE(JSON_EXTRACT(v_record_json, '$.head'), '{}');

  SET v_first_name = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.first_name')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.first_name')), ''),
    ''
  ));

  SET v_middle_name = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.middle_name')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.middle_name')), ''),
    ''
  ));

  SET v_last_name = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.last_name')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.last_name')), ''),
    ''
  ));

  SET v_extension_name = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.extension_name')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.extension_name')), ''),
    ''
  ));

  SET v_full_name = TRIM(COALESCE(
    NULLIF(p_head_name, ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.full_name')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.full_name')), ''),
    NULLIF(CONCAT_WS(' ', NULLIF(v_first_name, ''), NULLIF(v_middle_name, ''), NULLIF(v_last_name, ''), NULLIF(v_extension_name, '')), ''),
    ''
  ));

  IF v_first_name = '' AND v_full_name <> '' THEN
    SET v_first_name = TRIM(SUBSTRING_INDEX(v_full_name, ' ', 1));
  END IF;

  IF v_last_name = '' AND v_full_name <> '' THEN
    SET v_last_name = TRIM(SUBSTRING(v_full_name, CHAR_LENGTH(v_first_name) + 1));
  END IF;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.age')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.age')), ''),
    ''
  ));
  SET v_head_age = CASE WHEN v_text REGEXP '^[0-9]+$' THEN CAST(v_text AS UNSIGNED) ELSE NULL END;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.height')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.height')), ''),
    ''
  ));
  SET v_head_height = CASE WHEN v_text REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST(v_text AS DECIMAL(10,2)) ELSE NULL END;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.weight')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.weight')), ''),
    ''
  ));
  SET v_head_weight = CASE WHEN v_text REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST(v_text AS DECIMAL(10,2)) ELSE NULL END;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.num_members')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.num_members')), ''),
    ''
  ));
  SET v_num_members = CASE WHEN v_text REGEXP '^[0-9]+$' THEN CAST(v_text AS UNSIGNED) ELSE NULL END;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.num_children')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.num_children')), ''),
    ''
  ));
  SET v_num_children = CASE WHEN v_text REGEXP '^[0-9]+$' THEN CAST(v_text AS UNSIGNED) ELSE NULL END;

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.num_rooms')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.num_rooms')), ''),
    ''
  ));
  SET v_num_rooms = CASE WHEN v_text REGEXP '^[0-9]+$' THEN CAST(v_text AS UNSIGNED) ELSE NULL END;

  SET v_member_count = GREATEST(COALESCE(p_member_count, v_num_members, 0), 0);

  SET v_created_at = COALESCE(p_created_at, p_updated_at, NOW());
  SET v_updated_at = COALESCE(p_updated_at, p_created_at, NOW());

  INSERT INTO `households` (
    `household_code`, `source`,
    `head_first_name`, `head_middle_name`, `head_last_name`, `head_extension_name`, `head_full_name`,
    `head_birthday`, `head_age`, `head_sex`, `head_pregnant`, `head_civil_status`, `head_citizenship`, `head_religion`,
    `head_height_cm`, `head_weight_kg`, `head_blood_type`, `head_contact`, `head_address`,
    `zone`, `barangay`, `city`, `province`,
    `head_education`, `head_degree`, `head_school_name`, `head_school_type`, `head_dropout`, `head_osy`, `head_currently_studying`,
    `head_occupation`, `head_employment_status`, `head_work_type`, `head_monthly_income`, `head_four_ps`,
    `head_senior`, `head_pwd`, `head_ip`, `head_voter`, `head_precinct`,
    `head_sss`, `head_philhealth`, `head_gsis`, `head_tin`, `head_philid`, `head_driver_license`, `head_passport`,
    `num_members`, `relation_to_head`, `num_children`, `partner_name`,
    `house_type`, `ownership`, `num_rooms`, `toilet`, `electricity`, `water`, `internet`,
    `member_count`,
    `raw_head_json`, `raw_members_json`, `raw_record_json`,
    `created_by_user_id`, `updated_by_user_id`, `created_at`, `updated_at`
  ) VALUES (
    LEFT(COALESCE(NULLIF(p_household_code, ''), CONCAT('REG-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'))), 64),
    LEFT(COALESCE(NULLIF(p_source, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_json, '$.source')), ''), 'registration-module'), 80),

    LEFT(v_first_name, 120),
    LEFT(v_middle_name, 120),
    LEFT(v_last_name, 160),
    LEFT(v_extension_name, 60),
    LEFT(v_full_name, 255),

    CAST(NULLIF(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.birthday')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.birthday')), ''),
      ''
    ), '') AS DATE),
    v_head_age,
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.sex')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.sex')), ''),
      ''
    ), 40),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.pregnant')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.pregnant')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.health_maternal_pregnant')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.health_maternal_pregnant')), ''),
      ''
    ), 40),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.civil_status')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.civil_status')), ''),
      ''
    ), 60),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.citizenship')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.citizenship')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.religion')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.religion')), ''),
      ''
    ), 100),
    v_head_height,
    v_head_weight,
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.blood_type')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.blood_type')), ''),
      ''
    ), 10),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.contact')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.contact')), ''),
      ''
    ), 100),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.address')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.address')), ''),
      ''
    ), 255),

    LEFT(COALESCE(
      NULLIF(p_zone, ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.zone')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.zone')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.barangay')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.barangay')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.city')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.city')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.province')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.province')), ''),
      ''
    ), 120),

    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.education')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.education')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.degree')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.degree')), ''),
      ''
    ), 180),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.school_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.school_name')), ''),
      ''
    ), 180),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.school_type')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.school_type')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.dropout')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.dropout')), ''),
      ''
    ), 40),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.osy')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.osy')), ''),
      ''
    ), 40),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.currently_studying')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.currently_studying')), ''),
      ''
    ), 40),

    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.occupation')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.occupation')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.employment_status')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.employment_status')), ''),
      ''
    ), 60),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.work_type')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.work_type')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.monthly_income')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.monthly_income')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$."4ps"')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$."4ps"')), ''),
      ''
    ), 20),

    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.senior')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.senior')), ''),
      ''
    ), 20),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.pwd')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.pwd')), ''),
      ''
    ), 20),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.ip')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.ip')), ''),
      ''
    ), 20),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.voter')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.voter')), ''),
      ''
    ), 20),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.precinct')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.precinct')), ''),
      ''
    ), 80),

    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.sss')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.sss')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.philhealth')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.philhealth')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.gsis')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.gsis')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.tin')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.tin')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.philid')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.philid')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.driver_license')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.driver_license')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.passport')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.passport')), ''),
      ''
    ), 80),

    v_num_members,
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.relation_to_head')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.relation_to_head')), ''),
      ''
    ), 80),
    v_num_children,
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.partner_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.partner_name')), ''),
      ''
    ), 180),

    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.house_type')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.house_type')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.ownership')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.ownership')), ''),
      ''
    ), 80),
    v_num_rooms,
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.toilet')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.toilet')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.electricity')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.electricity')), ''),
      ''
    ), 80),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.water')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.water')), ''),
      ''
    ), 120),
    LEFT(COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_head_json, '$.internet')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_record_head_json, '$.internet')), ''),
      ''
    ), 80),

    v_member_count,

    COALESCE(NULLIF(p_head_data_json, ''), '{}'),
    COALESCE(NULLIF(p_members_data_json, ''), '[]'),
    COALESCE(NULLIF(p_record_data_json, ''), '{}'),

    p_created_by_user_id,
    p_updated_by_user_id,
    v_created_at,
    v_updated_at
  )
  ON DUPLICATE KEY UPDATE
    `source` = VALUES(`source`),
    `head_first_name` = VALUES(`head_first_name`),
    `head_middle_name` = VALUES(`head_middle_name`),
    `head_last_name` = VALUES(`head_last_name`),
    `head_extension_name` = VALUES(`head_extension_name`),
    `head_full_name` = VALUES(`head_full_name`),
    `head_birthday` = VALUES(`head_birthday`),
    `head_age` = VALUES(`head_age`),
    `head_sex` = VALUES(`head_sex`),
    `head_pregnant` = VALUES(`head_pregnant`),
    `head_civil_status` = VALUES(`head_civil_status`),
    `head_citizenship` = VALUES(`head_citizenship`),
    `head_religion` = VALUES(`head_religion`),
    `head_height_cm` = VALUES(`head_height_cm`),
    `head_weight_kg` = VALUES(`head_weight_kg`),
    `head_blood_type` = VALUES(`head_blood_type`),
    `head_contact` = VALUES(`head_contact`),
    `head_address` = VALUES(`head_address`),
    `zone` = VALUES(`zone`),
    `barangay` = VALUES(`barangay`),
    `city` = VALUES(`city`),
    `province` = VALUES(`province`),
    `head_education` = VALUES(`head_education`),
    `head_degree` = VALUES(`head_degree`),
    `head_school_name` = VALUES(`head_school_name`),
    `head_school_type` = VALUES(`head_school_type`),
    `head_dropout` = VALUES(`head_dropout`),
    `head_osy` = VALUES(`head_osy`),
    `head_currently_studying` = VALUES(`head_currently_studying`),
    `head_occupation` = VALUES(`head_occupation`),
    `head_employment_status` = VALUES(`head_employment_status`),
    `head_work_type` = VALUES(`head_work_type`),
    `head_monthly_income` = VALUES(`head_monthly_income`),
    `head_four_ps` = VALUES(`head_four_ps`),
    `head_senior` = VALUES(`head_senior`),
    `head_pwd` = VALUES(`head_pwd`),
    `head_ip` = VALUES(`head_ip`),
    `head_voter` = VALUES(`head_voter`),
    `head_precinct` = VALUES(`head_precinct`),
    `head_sss` = VALUES(`head_sss`),
    `head_philhealth` = VALUES(`head_philhealth`),
    `head_gsis` = VALUES(`head_gsis`),
    `head_tin` = VALUES(`head_tin`),
    `head_philid` = VALUES(`head_philid`),
    `head_driver_license` = VALUES(`head_driver_license`),
    `head_passport` = VALUES(`head_passport`),
    `num_members` = VALUES(`num_members`),
    `relation_to_head` = VALUES(`relation_to_head`),
    `num_children` = VALUES(`num_children`),
    `partner_name` = VALUES(`partner_name`),
    `house_type` = VALUES(`house_type`),
    `ownership` = VALUES(`ownership`),
    `num_rooms` = VALUES(`num_rooms`),
    `toilet` = VALUES(`toilet`),
    `electricity` = VALUES(`electricity`),
    `water` = VALUES(`water`),
    `internet` = VALUES(`internet`),
    `member_count` = VALUES(`member_count`),
    `raw_head_json` = VALUES(`raw_head_json`),
    `raw_members_json` = VALUES(`raw_members_json`),
    `raw_record_json` = VALUES(`raw_record_json`),
    `created_by_user_id` = COALESCE(`created_by_user_id`, VALUES(`created_by_user_id`)),
    `updated_by_user_id` = VALUES(`updated_by_user_id`),
    `created_at` = COALESCE(`created_at`, VALUES(`created_at`)),
    `updated_at` = VALUES(`updated_at`);
END
$$

DELIMITER ;

-- Optional one-time backfill after deploying this migration:
-- UPDATE `registration_households`
-- SET `updated_at` = CURRENT_TIMESTAMP;
