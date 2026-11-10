-- =============================================================
-- 毛球旅馆 · 图片上传全链路迁移（2026-11-10）
-- 1. pet.photo_url          宠物头像
-- 2. pet.vaccine_proof_url  疫苗/驱虫证明照片
-- 说明：MySQL 不支持 ADD COLUMN IF NOT EXISTS，用存储过程按 information_schema 判断，
--       重复执行安全；不删表、不改动既有列。
-- =============================================================

USE pet_foster;

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing $$
CREATE PROCEDURE add_column_if_missing(
  IN p_table VARCHAR(64),
  IN p_column VARCHAR(64),
  IN p_definition VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END $$

DELIMITER ;

CALL add_column_if_missing('pet', 'photo_url',
  "varchar(500) DEFAULT NULL COMMENT '宠物头像URL(/api/files/xxx)' AFTER `color`");
CALL add_column_if_missing('pet', 'vaccine_proof_url',
  "varchar(500) DEFAULT NULL COMMENT '疫苗/驱虫证明照片URL(/api/files/xxx)' AFTER `vaccine`");

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- 校验
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_COMMENT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'pet_foster' AND TABLE_NAME = 'pet'
  AND COLUMN_NAME IN ('photo_url', 'vaccine_proof_url');
