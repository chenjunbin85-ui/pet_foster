-- [历史脚本 · 2026-11-07 起] 内容已并入 sql/schema.sql（当前版本一体化初始化脚本）。
-- 新环境只需执行 schema.sql；本文件仅保留用于旧库升级追溯，勿对新建库重复执行。
-- ============================================================
-- v4 员工端小程序（17 页原型迁移）配套 DDL
-- 目标：补齐「岗位多值 / 现场照片 / 岗位快照 / 兽医资质」四类字段
-- 说明：全部 ALTER 用 information_schema 判存在，脚本可重复执行；
--       不新增业务表，复用 PRD v3 已建的 16 张表。
-- 执行：mysql -uroot -proot pet_foster < src/main/resources/db/v4_staff_portal.sql
-- ============================================================

-- 1. staff.positions（多岗位，逗号分隔代码；旧列 position 保留只读兼容）
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE staff ADD COLUMN positions VARCHAR(200) NULL COMMENT ''岗位多值(逗号分隔: OWNER/FRONT/CARE/VET/GROOM/DRIVER)''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'staff' AND COLUMN_NAME = 'positions');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 旧单值岗位回升到多值列（只填空值，不覆盖人工维护的多岗）
UPDATE staff
   SET positions = UPPER(TRIM(position))
 WHERE (positions IS NULL OR positions = '')
   AND UPPER(TRIM(position)) IN ('OWNER','FRONT','CARE','VET','GROOM','DRIVER');

-- 2. foster_service_record：现场动作类型 / 照片 / 岗位快照
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foster_service_record ADD COLUMN record_type VARCHAR(30) NULL COMMENT ''CARE_RECORD/GROOM_LOG/PICKUP_HANDOVER/REDEEM''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'foster_service_record' AND COLUMN_NAME = 'record_type');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foster_service_record ADD COLUMN photo_urls VARCHAR(1000) NULL COMMENT ''现场照片URL,逗号分隔,最多6张''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'foster_service_record' AND COLUMN_NAME = 'photo_urls');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foster_service_record ADD COLUMN recorder_position VARCHAR(30) NULL COMMENT ''记录人岗位快照''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'foster_service_record' AND COLUMN_NAME = 'recorder_position');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. foster_incident：异常上报现场照片（护理员上报 / 兽医复核只读）
SET @sql = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE foster_incident ADD COLUMN photo_urls VARCHAR(1000) NULL COMMENT ''现场照片URL,逗号分隔,最多6张''',
  'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'foster_incident' AND COLUMN_NAME = 'photo_urls');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. 演示资质：给 VET 岗位一条有效期内的执业兽医证
--    PRD FR-12：排班模块暂不实现，staff_shift 不预置数据，
--    兽医需在员工端 V1 页「今日在岗确认」写入当日班次后才能签署。
-- cert_type 存代码不存中文（PRD 3.1）：避免 mysql CLI / JDBC 字符集不一致导致判定失效。
-- 老数据（含历史中文值）统一归一到 VET_LICENSE。
UPDATE staff_cert SET cert_type = 'VET_LICENSE'
 WHERE cert_type <> 'VET_LICENSE'
   AND staff_id IN (SELECT staff_id FROM (SELECT staff_id FROM staff WHERE UPPER(TRIM(position)) = 'VET') x);

INSERT INTO staff_cert (staff_id, cert_type, cert_no, valid_from, valid_to, deleted)
SELECT s.staff_id, 'VET_LICENSE', CONCAT('A3505****', LPAD(s.staff_id, 4, '0')),
       '2020-01-01', '2035-12-31', 0
  FROM staff s
 WHERE UPPER(TRIM(s.position)) = 'VET'
   AND NOT EXISTS (SELECT 1 FROM staff_cert c
                    WHERE c.staff_id = s.staff_id AND c.cert_type = 'VET_LICENSE' AND c.deleted = 0);
