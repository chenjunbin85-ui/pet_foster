-- 宠物寄养系统数据库索引优化脚本（修正版）
USE pet_foster;

-- 1. customer 表
ALTER TABLE customer ADD UNIQUE INDEX uk_customer_phone (phone);
ALTER TABLE customer ADD INDEX idx_customer_name (name);

-- 2. foster_order 表
ALTER TABLE foster_order ADD INDEX idx_order_customer_id (customer_id);
ALTER TABLE foster_order ADD INDEX idx_order_pet_id (pet_id);
ALTER TABLE foster_order ADD INDEX idx_order_status (status);
ALTER TABLE foster_order ADD INDEX idx_order_create_time (create_time);
ALTER TABLE foster_order ADD INDEX idx_order_start_date (start_date);
ALTER TABLE foster_order ADD INDEX idx_order_status_create (status, create_time);

-- 3. pet 表
ALTER TABLE pet ADD INDEX idx_pet_customer_id (customer_id);
ALTER TABLE pet ADD INDEX idx_pet_name (name);
ALTER TABLE pet ADD INDEX idx_pet_breed (breed);

-- 4. pet_health_record 表
ALTER TABLE pet_health_record ADD INDEX idx_health_pet_id (pet_id);
ALTER TABLE pet_health_record ADD INDEX idx_health_order_id (order_id);
ALTER TABLE pet_health_record ADD INDEX idx_health_record_time (record_time);
ALTER TABLE pet_health_record ADD INDEX idx_health_pet_time (pet_id, record_time);

-- 5. foster_service_record 表
ALTER TABLE foster_service_record ADD INDEX idx_service_order_id (order_id);
ALTER TABLE foster_service_record ADD INDEX idx_service_pet_id (pet_id);
ALTER TABLE foster_service_record ADD INDEX idx_service_time (service_time);

-- 6. sys_user 表
ALTER TABLE sys_user ADD INDEX idx_user_role (role);
ALTER TABLE sys_user ADD INDEX idx_user_status (status);

-- 7. sys_oper_log 表（user_id已有索引，补充时间和模块）
ALTER TABLE sys_oper_log ADD INDEX idx_oper_request_time (request_time);
ALTER TABLE sys_oper_log ADD INDEX idx_oper_module (module);

-- 8. sys_dict 表
ALTER TABLE sys_dict ADD INDEX idx_dict_type_code (type_code);

-- 验证索引
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS
WHERE TABLE_SCHEMA = 'pet_foster' AND INDEX_NAME != 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
