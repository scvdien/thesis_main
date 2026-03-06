-- Migration: Create/replace sp_sync_registration_member
-- Generated: 2026-02-25 23:07:35
-- Purpose: Keep household_members table synchronized from registration_members triggers.

DROP PROCEDURE IF EXISTS `sp_sync_registration_member`;
DELIMITER $$

CREATE PROCEDURE `sp_sync_registration_member`(
  IN p_household_code VARCHAR(64),
  IN p_resident_code VARCHAR(64),
  IN p_member_order INT,
  IN p_full_name VARCHAR(180),
  IN p_relation_to_head VARCHAR(120),
  IN p_sex VARCHAR(20),
  IN p_age VARCHAR(20),
  IN p_zone VARCHAR(80),
  IN p_member_data_json LONGTEXT,
  IN p_created_at DATETIME,
  IN p_updated_at DATETIME
)
BEGIN
  DECLARE v_member_json LONGTEXT;
  DECLARE v_first_name VARCHAR(120);
  DECLARE v_middle_name VARCHAR(120);
  DECLARE v_last_name VARCHAR(160);
  DECLARE v_extension_name VARCHAR(60);
  DECLARE v_full_name VARCHAR(255);
  DECLARE v_text VARCHAR(255);
  DECLARE v_age INT;
  DECLARE v_household_id BIGINT;
  DECLARE v_created_at DATETIME;
  DECLARE v_updated_at DATETIME;

  SET v_member_json = CASE
    WHEN p_member_data_json IS NOT NULL AND JSON_VALID(p_member_data_json) THEN p_member_data_json
    ELSE '{}'
  END;

  SET v_first_name = TRIM(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.first_name')), ''), ''));
  SET v_middle_name = TRIM(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.middle_name')), ''), ''));
  SET v_last_name = TRIM(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.last_name')), ''), ''));
  SET v_extension_name = TRIM(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.extension_name')), ''), ''));

  SET v_full_name = TRIM(COALESCE(
    NULLIF(p_full_name, ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.full_name')), ''),
    NULLIF(CONCAT_WS(' ', NULLIF(v_first_name, ''), NULLIF(v_middle_name, ''), NULLIF(v_last_name, ''), NULLIF(v_extension_name, '')), ''),
    CONCAT('Member ', GREATEST(COALESCE(p_member_order, 1), 1))
  ));

  SET v_text = TRIM(COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.age')), ''),
    NULLIF(p_age, ''),
    ''
  ));
  SET v_age = CASE WHEN v_text REGEXP '^[0-9]+$' THEN CAST(v_text AS UNSIGNED) ELSE NULL END;

  SET v_household_id = NULL;
  SELECT `id` INTO v_household_id
  FROM `households`
  WHERE `household_code` = p_household_code
  LIMIT 1;

  IF v_household_id IS NULL THEN
    SELECT `id` INTO v_household_id
    FROM `registration_households`
    WHERE `household_code` = p_household_code
    LIMIT 1;
  END IF;

  SET v_household_id = COALESCE(v_household_id, 0);
  SET v_created_at = COALESCE(p_created_at, p_updated_at, NOW());
  SET v_updated_at = COALESCE(p_updated_at, p_created_at, NOW());

  INSERT INTO `household_members` (
    `household_id`, `household_code`, `resident_code`, `member_order`,
    `first_name`, `middle_name`, `last_name`, `extension_name`, `full_name`,
    `birthday`, `age`, `sex`, `pregnant`, `civil_status`, `citizenship`, `religion`,
    `height_cm`, `weight_kg`, `blood_type`, `contact`, `address`,
    `zone`, `barangay`, `city`, `province`,
    `education`, `degree`, `school_name`, `school_type`, `dropout`, `osy`, `currently_studying`,
    `occupation`, `employment_status`, `work_type`, `monthly_income`, `four_ps`,
    `senior`, `pwd`, `ip`, `voter`, `precinct`,
    `sss`, `philhealth`, `gsis`, `tin`, `philid`, `driver_license`, `passport`,
    `num_members`, `relation_to_head`, `num_children`, `partner_name`,
    `health_current_illness`, `health_illness_type`, `health_illness_years`,
    `health_chronic_diseases_json`, `health_common_illnesses_json`,
    `health_maintenance_meds`, `health_medicine_name`, `health_medicine_frequency`, `health_medicine_source`,
    `health_maternal_pregnant`, `health_months_pregnant`, `health_prenatal_care`,
    `health_child_immunized`, `health_child_malnutrition`, `health_child_sick_per_year`,
    `health_has_disability`, `health_disability_types_json`, `health_disability_regular_care`,
    `health_smoker`, `health_alcohol_daily`, `health_malnutrition_present`, `health_clean_water`,
    `health_rhu_visits`, `health_rhu_reason`, `health_has_philhealth`, `health_hospitalized_5yrs`, `health_hospitalized_reason`,
    `raw_member_json`, `created_at`, `updated_at`
  ) VALUES (
    v_household_id,
    LEFT(COALESCE(NULLIF(p_household_code, ''), ''), 64),
    LEFT(COALESCE(NULLIF(p_resident_code, ''), CONCAT(COALESCE(NULLIF(p_household_code, ''), 'HH'), '-R', LPAD(GREATEST(COALESCE(p_member_order, 1), 1), 2, '0'))), 64),
    GREATEST(COALESCE(p_member_order, 1), 1),

    LEFT(v_first_name, 120),
    LEFT(v_middle_name, 120),
    LEFT(v_last_name, 160),
    LEFT(v_extension_name, 60),
    LEFT(v_full_name, 255),

    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.birthday')), '') AS DATE),
    v_age,
    LEFT(COALESCE(NULLIF(p_sex, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.sex')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.pregnant')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.civil_status')), ''), ''), 60),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.citizenship')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.religion')), ''), ''), 100),

    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.height')), '') REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.height')) AS DECIMAL(10,2)) ELSE NULL END,
    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.weight')), '') REGEXP '^-?[0-9]+(\\.[0-9]+)?$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.weight')) AS DECIMAL(10,2)) ELSE NULL END,
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.blood_type')), ''), ''), 10),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.contact')), ''), ''), 100),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.address')), ''), ''), 255),

    LEFT(COALESCE(NULLIF(p_zone, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.zone')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.barangay')), ''), ''), 120),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.city')), ''), ''), 120),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.province')), ''), ''), 120),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.education')), ''), ''), 120),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.degree')), ''), ''), 180),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.school_name')), ''), ''), 180),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.school_type')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.dropout')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.osy')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.currently_studying')), ''), ''), 40),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.occupation')), ''), ''), 120),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.employment_status')), ''), ''), 60),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.work_type')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.monthly_income')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$."4ps"')), ''), ''), 20),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.senior')), ''), ''), 20),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.pwd')), ''), ''), 20),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.ip')), ''), ''), 20),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.voter')), ''), ''), 20),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.precinct')), ''), ''), 80),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.sss')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.philhealth')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.gsis')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.tin')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.philid')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.driver_license')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.passport')), ''), ''), 80),

    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.num_members')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.num_members')) AS UNSIGNED) ELSE NULL END,
    LEFT(COALESCE(NULLIF(p_relation_to_head, ''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.relation_to_head')), ''), ''), 80),
    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.num_children')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.num_children')) AS UNSIGNED) ELSE NULL END,
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.partner_name')), ''), ''), 180),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_current_illness')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_illness_type')), ''), ''), 160),
    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_illness_years')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_illness_years')) AS UNSIGNED) ELSE NULL END,

    COALESCE(JSON_EXTRACT(v_member_json, '$.health_chronic_diseases'), JSON_EXTRACT(v_member_json, '$.health_chronic_diseases_json'), '[]'),
    COALESCE(JSON_EXTRACT(v_member_json, '$.health_common_illnesses'), JSON_EXTRACT(v_member_json, '$.health_common_illnesses_json'), '[]'),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_maintenance_meds')), ''), ''), 80),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_medicine_name')), ''), ''), 160),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_medicine_frequency')), ''), ''), 120),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_medicine_source')), ''), ''), 120),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_maternal_pregnant')), ''), ''), 40),
    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_months_pregnant')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_months_pregnant')) AS UNSIGNED) ELSE NULL END,
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_prenatal_care')), ''), ''), 80),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_child_immunized')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_child_malnutrition')), ''), ''), 40),
    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_child_sick_per_year')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_child_sick_per_year')) AS UNSIGNED) ELSE NULL END,

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_has_disability')), ''), ''), 40),
    COALESCE(JSON_EXTRACT(v_member_json, '$.health_disability_types'), JSON_EXTRACT(v_member_json, '$.health_disability_types_json'), '[]'),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_disability_regular_care')), ''), ''), 80),

    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_smoker')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_alcohol_daily')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_malnutrition_present')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_clean_water')), ''), ''), 40),

    CASE WHEN NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_rhu_visits')), '') REGEXP '^[0-9]+$' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_rhu_visits')) AS UNSIGNED) ELSE NULL END,
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_rhu_reason')), ''), ''), 180),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_has_philhealth')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_hospitalized_5yrs')), ''), ''), 40),
    LEFT(COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(v_member_json, '$.health_hospitalized_reason')), ''), ''), 180),

    COALESCE(NULLIF(p_member_data_json, ''), '{}'),
    v_created_at,
    v_updated_at
  )
  ON DUPLICATE KEY UPDATE
    `household_id` = VALUES(`household_id`),
    `household_code` = VALUES(`household_code`),
    `member_order` = VALUES(`member_order`),
    `first_name` = VALUES(`first_name`),
    `middle_name` = VALUES(`middle_name`),
    `last_name` = VALUES(`last_name`),
    `extension_name` = VALUES(`extension_name`),
    `full_name` = VALUES(`full_name`),
    `birthday` = VALUES(`birthday`),
    `age` = VALUES(`age`),
    `sex` = VALUES(`sex`),
    `pregnant` = VALUES(`pregnant`),
    `civil_status` = VALUES(`civil_status`),
    `citizenship` = VALUES(`citizenship`),
    `religion` = VALUES(`religion`),
    `height_cm` = VALUES(`height_cm`),
    `weight_kg` = VALUES(`weight_kg`),
    `blood_type` = VALUES(`blood_type`),
    `contact` = VALUES(`contact`),
    `address` = VALUES(`address`),
    `zone` = VALUES(`zone`),
    `barangay` = VALUES(`barangay`),
    `city` = VALUES(`city`),
    `province` = VALUES(`province`),
    `education` = VALUES(`education`),
    `degree` = VALUES(`degree`),
    `school_name` = VALUES(`school_name`),
    `school_type` = VALUES(`school_type`),
    `dropout` = VALUES(`dropout`),
    `osy` = VALUES(`osy`),
    `currently_studying` = VALUES(`currently_studying`),
    `occupation` = VALUES(`occupation`),
    `employment_status` = VALUES(`employment_status`),
    `work_type` = VALUES(`work_type`),
    `monthly_income` = VALUES(`monthly_income`),
    `four_ps` = VALUES(`four_ps`),
    `senior` = VALUES(`senior`),
    `pwd` = VALUES(`pwd`),
    `ip` = VALUES(`ip`),
    `voter` = VALUES(`voter`),
    `precinct` = VALUES(`precinct`),
    `sss` = VALUES(`sss`),
    `philhealth` = VALUES(`philhealth`),
    `gsis` = VALUES(`gsis`),
    `tin` = VALUES(`tin`),
    `philid` = VALUES(`philid`),
    `driver_license` = VALUES(`driver_license`),
    `passport` = VALUES(`passport`),
    `num_members` = VALUES(`num_members`),
    `relation_to_head` = VALUES(`relation_to_head`),
    `num_children` = VALUES(`num_children`),
    `partner_name` = VALUES(`partner_name`),
    `health_current_illness` = VALUES(`health_current_illness`),
    `health_illness_type` = VALUES(`health_illness_type`),
    `health_illness_years` = VALUES(`health_illness_years`),
    `health_chronic_diseases_json` = VALUES(`health_chronic_diseases_json`),
    `health_common_illnesses_json` = VALUES(`health_common_illnesses_json`),
    `health_maintenance_meds` = VALUES(`health_maintenance_meds`),
    `health_medicine_name` = VALUES(`health_medicine_name`),
    `health_medicine_frequency` = VALUES(`health_medicine_frequency`),
    `health_medicine_source` = VALUES(`health_medicine_source`),
    `health_maternal_pregnant` = VALUES(`health_maternal_pregnant`),
    `health_months_pregnant` = VALUES(`health_months_pregnant`),
    `health_prenatal_care` = VALUES(`health_prenatal_care`),
    `health_child_immunized` = VALUES(`health_child_immunized`),
    `health_child_malnutrition` = VALUES(`health_child_malnutrition`),
    `health_child_sick_per_year` = VALUES(`health_child_sick_per_year`),
    `health_has_disability` = VALUES(`health_has_disability`),
    `health_disability_types_json` = VALUES(`health_disability_types_json`),
    `health_disability_regular_care` = VALUES(`health_disability_regular_care`),
    `health_smoker` = VALUES(`health_smoker`),
    `health_alcohol_daily` = VALUES(`health_alcohol_daily`),
    `health_malnutrition_present` = VALUES(`health_malnutrition_present`),
    `health_clean_water` = VALUES(`health_clean_water`),
    `health_rhu_visits` = VALUES(`health_rhu_visits`),
    `health_rhu_reason` = VALUES(`health_rhu_reason`),
    `health_has_philhealth` = VALUES(`health_has_philhealth`),
    `health_hospitalized_5yrs` = VALUES(`health_hospitalized_5yrs`),
    `health_hospitalized_reason` = VALUES(`health_hospitalized_reason`),
    `raw_member_json` = VALUES(`raw_member_json`),
    `created_at` = COALESCE(`created_at`, VALUES(`created_at`)),
    `updated_at` = VALUES(`updated_at`);
END
$$

DELIMITER ;
