-- =============================================================
-- 护宠宝 / 宠物旅馆管理系统 —— 数据库初始化脚本（当前版本）
-- 基线：本机运行库 pet_foster 实测结构（2026-11-07），共 28 张业务表
-- 合并来源：旧 sql/schema.sql + v2_business_expansion + v3_prd_expansion + v4_staff_portal
-- 不含历史遗留表 sys_user：代码零引用，账号已拆分为 sys_admin / staff / customer
-- 表排序规则统一 utf8mb4_unicode_ci（运行库为 0900_ai_ci，仅排序规则差异）
-- 产品口径：订单创建即「已支付」（PRD §7.3）；payment_status / expires_at 保留列兼容旧数据与后续接入
-- 演示账号：手机号见种子段，统一密码 123456（BCrypt）
-- 执行：mysql -uroot -p --default-character-set=utf8mb4 < sql/schema.sql
-- 注意：使用 CREATE TABLE IF NOT EXISTS，不会删表；种子段为普通 INSERT，仅对全新空库执行一次，
--       已有数据的库重复执行会因唯一键报错，请跳过种子段或先备份。
-- =============================================================

CREATE DATABASE IF NOT EXISTS pet_foster DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pet_foster;

-- =============================================================
-- 一、建表（按表名字母序；列定义取自运行库，不做臆造）
-- =============================================================

CREATE TABLE IF NOT EXISTS `biz_rule` (
  `rule_id` bigint NOT NULL AUTO_INCREMENT COMMENT '规则ID',
  `rule_key` varchar(50) NOT NULL COMMENT '规则键',
  `rule_value` varchar(255) NOT NULL COMMENT '规则值(数字或JSON)',
  `unit` varchar(20) DEFAULT NULL COMMENT '单位',
  `effective_from` date NOT NULL COMMENT '生效日期',
  `remark` varchar(255) DEFAULT NULL COMMENT '说明',
  PRIMARY KEY (`rule_id`),
  UNIQUE KEY `uk_key_from` (`rule_key`,`effective_from`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务规则配置';

CREATE TABLE IF NOT EXISTS `care_record` (
  `record_id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `day` int NOT NULL DEFAULT '1',
  `type` varchar(20) NOT NULL,
  `content` varchar(500) DEFAULT NULL,
  `image_url` varchar(255) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `deleted` int DEFAULT '0',
  PRIMARY KEY (`record_id`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coupon` (
  `coupon_id` bigint NOT NULL AUTO_INCREMENT,
  `customer_id` bigint NOT NULL,
  `name` varchar(50) NOT NULL,
  `discount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `min_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `status` varchar(20) DEFAULT 'UNUSED',
  `expire_at` date DEFAULT NULL,
  `order_id` bigint DEFAULT NULL,
  `deleted` int DEFAULT '0',
  PRIMARY KEY (`coupon_id`),
  KEY `idx_customer` (`customer_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer` (
  `customer_id` bigint NOT NULL AUTO_INCREMENT COMMENT '客户ID',
  `name` varchar(50) NOT NULL COMMENT '客户姓名',
  `phone` varchar(20) DEFAULT NULL COMMENT '联系电话',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `username` varchar(20) DEFAULT NULL COMMENT '登录账号(手机号)',
  `password` varchar(100) DEFAULT NULL COMMENT '密码(BCrypt加密)',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 0禁用 1启用',
  `last_login_time` datetime DEFAULT NULL COMMENT '最后登录时间',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户表';

CREATE TABLE IF NOT EXISTS `data_export_log` (
  `export_id` bigint NOT NULL AUTO_INCREMENT COMMENT '导出ID',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `purpose` varchar(255) NOT NULL COMMENT '导出用途(必填)',
  `data_scope` varchar(100) DEFAULT NULL COMMENT '导出数据范围',
  `phone_masked` tinyint NOT NULL DEFAULT '1' COMMENT '手机号是否脱敏',
  `create_time` datetime DEFAULT NULL COMMENT '导出时间',
  PRIMARY KEY (`export_id`),
  KEY `idx_time` (`create_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='数据导出留痕表';

CREATE TABLE IF NOT EXISTS `foster_bill_item` (
  `item_id` bigint NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `item_code` varchar(50) NOT NULL COMMENT '项目编码: ROOM/SERVICE/MEDICAL/OVERDUE/COMPENSATE/DEPOSIT/DISCOUNT',
  `item_name` varchar(100) NOT NULL COMMENT '展示名称',
  `item_type` varchar(20) NOT NULL COMMENT '类型: 房费/增值/医疗/超时/赔偿/定金/优惠',
  `unit_price` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT '单价',
  `quantity` decimal(10,2) NOT NULL DEFAULT '1.00' COMMENT '数量(日/次/项)',
  `amount` decimal(10,2) NOT NULL COMMENT '小计金额',
  `source` varchar(10) NOT NULL DEFAULT '系统' COMMENT '来源: 系统/手工',
  `status` varchar(20) NOT NULL DEFAULT '待结算' COMMENT '状态: 待结算/已结算/已退款',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `uk_order_code` (`order_id`,`item_code`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单账单明细';

CREATE TABLE IF NOT EXISTS `foster_care_log` (
  `care_log_id` bigint NOT NULL AUTO_INCREMENT COMMENT '巡视日志ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `log_date` date NOT NULL COMMENT '巡视日期',
  `shift` varchar(10) NOT NULL COMMENT '班次: 早/中/晚',
  `spirit` varchar(50) DEFAULT NULL COMMENT '精神',
  `appetite` varchar(50) DEFAULT NULL COMMENT '食欲/饮食',
  `defecation` varchar(50) DEFAULT NULL COMMENT '排泄',
  `exercise` varchar(50) DEFAULT NULL COMMENT '运动/遛放',
  `coat` varchar(50) DEFAULT NULL COMMENT '被毛',
  `temperature` decimal(4,1) DEFAULT NULL COMMENT '体温(℃)',
  `abnormal` varchar(255) DEFAULT NULL COMMENT '异常描述(空=无异常)',
  `photo_urls` varchar(1000) DEFAULT NULL COMMENT '巡视照片URL(逗号分隔,最多6张)',
  `recorder_id` bigint NOT NULL COMMENT '记录人ID',
  `recorder_position` varchar(30) DEFAULT NULL COMMENT '记录人岗位快照(CARE/VET)',
  `record_time` datetime DEFAULT NULL COMMENT '记录时间',
  PRIMARY KEY (`care_log_id`),
  UNIQUE KEY `uk_order_date_shift` (`order_id`,`log_date`,`shift`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日巡视日志(早/中/晚)';

CREATE TABLE IF NOT EXISTS `foster_disinfection_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT COMMENT '消毒记录ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `area` varchar(50) NOT NULL COMMENT '区域',
  `method` varchar(50) DEFAULT NULL COMMENT '方式',
  `agent` varchar(50) DEFAULT NULL COMMENT '消毒剂名称',
  `concentration` varchar(30) DEFAULT NULL COMMENT '使用浓度',
  `operator_id` bigint DEFAULT NULL COMMENT '操作人ID',
  `disinfection_time` datetime NOT NULL COMMENT '消毒时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  PRIMARY KEY (`log_id`),
  KEY `idx_store_time` (`store_id`,`disinfection_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='消毒记录表';

CREATE TABLE IF NOT EXISTS `foster_handover` (
  `handover_id` bigint NOT NULL AUTO_INCREMENT COMMENT '交接单ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `type` varchar(10) NOT NULL COMMENT '类型: 入店/离店',
  `check_items` json DEFAULT NULL COMMENT '体表检查项',
  `weight` decimal(6,2) DEFAULT NULL COMMENT '当场称重(kg)',
  `photo_urls` varchar(1000) DEFAULT NULL COMMENT '到场照片URL，逗号分隔',
  `belongings` json DEFAULT NULL COMMENT '随身物品清单',
  `customer_sign` tinyint NOT NULL DEFAULT '0' COMMENT '客户是否签字确认: 0否 1是',
  `signer_id` bigint DEFAULT NULL COMMENT '经办员工ID',
  `signer_position` varchar(50) DEFAULT NULL COMMENT '经办人岗位(快照)',
  `handover_time` datetime DEFAULT NULL COMMENT '交接时间',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`handover_id`),
  UNIQUE KEY `uk_order_type` (`order_id`,`type`),
  KEY `idx_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='入离店交接单';

CREATE TABLE IF NOT EXISTS `foster_incident` (
  `incident_id` bigint NOT NULL AUTO_INCREMENT COMMENT '异常事件ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `occur_time` datetime NOT NULL COMMENT '发生时间',
  `category` varchar(20) NOT NULL COMMENT '类别: 健康/受伤/走失/打斗/其他',
  `description` varchar(500) NOT NULL COMMENT '情况简介',
  `action` varchar(500) DEFAULT NULL COMMENT '处置措施',
  `notify_customer` tinyint NOT NULL DEFAULT '0' COMMENT '是否已通知主人',
  `notify_time` datetime DEFAULT NULL COMMENT '通知时间',
  `notify_channel` varchar(20) DEFAULT NULL COMMENT '通知渠道: 电话/微信/短信',
  `need_vet` tinyint NOT NULL DEFAULT '0' COMMENT '是否需要送医',
  `vet_authorized_by` bigint DEFAULT NULL COMMENT '授权人ID(执业兽医)',
  `vet_authorized_at` datetime DEFAULT NULL COMMENT '授权时间',
  `vet_hospital` varchar(100) DEFAULT NULL COMMENT '送诊医院',
  `cost` decimal(10,2) DEFAULT NULL COMMENT '医疗费用(计入账单)',
  `status` varchar(20) NOT NULL DEFAULT '待处理' COMMENT '状态: 待处理/处理中/已闭环',
  `close_note` varchar(255) DEFAULT NULL COMMENT '闭环说明',
  `recorder_id` bigint NOT NULL COMMENT '记录人ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `photo_urls` varchar(1000) DEFAULT NULL COMMENT '鐜板満鐓х墖URL,閫楀彿鍒嗛殧,鏈??6寮',
  PRIMARY KEY (`incident_id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='异常事件表';

CREATE TABLE IF NOT EXISTS `foster_order` (
  `order_id` bigint NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` varchar(30) NOT NULL COMMENT '订单号 FO+yyyyMMdd+3位序号',
  `customer_id` bigint NOT NULL COMMENT '客户ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `start_date` date NOT NULL COMMENT '寄养开始日期',
  `end_date` date NOT NULL COMMENT '寄养结束日期',
  `price_id` bigint DEFAULT NULL COMMENT '价位档位ID',
  `price_per_day` decimal(10,2) NOT NULL COMMENT '单日寄养单价(下单时价格快照)',
  `total_fee` decimal(10,2) DEFAULT NULL COMMENT '总费用',
  `status` varchar(20) NOT NULL DEFAULT '待入店' COMMENT '状态: 待入店/寄养中/已完成/已取消',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `payment_status` varchar(20) DEFAULT '未支付' COMMENT '支付状态: 未支付/已支付/已退款',
  `payment_method` varchar(20) DEFAULT NULL COMMENT '支付方式: 微信/支付宝/现金',
  `payment_time` datetime DEFAULT NULL COMMENT '支付时间',
  `paid_amount` decimal(10,2) DEFAULT NULL COMMENT '实付金额',
  `expires_at` datetime DEFAULT NULL COMMENT '支付截止时间(下单后15分钟未支付自动关闭)',
  `creator_id` bigint DEFAULT NULL COMMENT '创建人ID',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `deleted` tinyint NOT NULL DEFAULT '0' COMMENT '逻辑删除: 0正常 1已删除(页面不显示)',
  `store_id` bigint DEFAULT NULL,
  `room_id` bigint DEFAULT NULL COMMENT '房间ID(下单锁定)',
  `charge_days` int DEFAULT NULL COMMENT '计费日数(含离店日,快照)',
  `deposit_fee` decimal(10,2) DEFAULT '0.00' COMMENT '定金金额',
  `discount_fee` decimal(10,2) DEFAULT '0.00' COMMENT '优惠金额',
  `extra_fee` decimal(10,2) DEFAULT '0.00' COMMENT '增值服务金额',
  `check_in_time` datetime DEFAULT NULL COMMENT '实际入店时间',
  `check_out_time` datetime DEFAULT NULL COMMENT '实际离店时间',
  PRIMARY KEY (`order_id`),
  UNIQUE KEY `order_no` (`order_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='寄养订单表';

CREATE TABLE IF NOT EXISTS `foster_price` (
  `price_id` bigint NOT NULL AUTO_INCREMENT COMMENT '价位ID',
  `level_name` varchar(50) NOT NULL COMMENT '档位名称(房型/服务等级)',
  `price_per_day` decimal(10,2) NOT NULL COMMENT '单日寄养价格(元/天)',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 0停用 1启用',
  `sort` int DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`price_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='寄养价位档位表';

CREATE TABLE IF NOT EXISTS `foster_room` (
  `room_id` bigint NOT NULL AUTO_INCREMENT COMMENT '房间ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `room_no` varchar(20) NOT NULL COMMENT '房号/笼位号，如 A-01',
  `price_id` bigint NOT NULL COMMENT '对应价位档位ID',
  `room_type` varchar(20) NOT NULL COMMENT '类型: 犬舍/猫舍/套房',
  `capacity` int NOT NULL DEFAULT '1' COMMENT '同住上限(只)',
  `status` varchar(20) NOT NULL DEFAULT '空闲' COMMENT '状态: 空闲/已预订/在住/待清洁/维修/隔离',
  `sort` int DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `deleted` int NOT NULL DEFAULT '0' COMMENT '逻辑删除: 0正常 1删除',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`room_id`),
  UNIQUE KEY `uk_store_room` (`store_id`,`room_no`),
  KEY `idx_price` (`price_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='寄养房间表';

CREATE TABLE IF NOT EXISTS `foster_room_booking` (
  `booking_id` bigint NOT NULL AUTO_INCREMENT COMMENT '占用ID',
  `room_id` bigint NOT NULL COMMENT '房间ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `occupy_start` date NOT NULL COMMENT '占用开始(含)',
  `occupy_end` date NOT NULL COMMENT '占用结束(不含，通常是离店日)',
  `status` varchar(20) NOT NULL DEFAULT '锁定' COMMENT '状态: 锁定/占用/释放',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`booking_id`),
  UNIQUE KEY `uk_room_order` (`room_id`,`order_id`),
  KEY `idx_room_range` (`room_id`,`occupy_start`,`occupy_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='房间占用表';

CREATE TABLE IF NOT EXISTS `foster_service_record` (
  `service_id` bigint NOT NULL AUTO_INCREMENT COMMENT '服务记录ID',
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `item` varchar(100) NOT NULL COMMENT '服务项目',
  `content` text COMMENT '服务内容描述',
  `service_time` datetime DEFAULT NULL COMMENT '服务时间',
  `keeper_id` bigint DEFAULT NULL COMMENT '看护人ID',
  `record_type` varchar(30) DEFAULT NULL COMMENT 'CARE_RECORD/GROOM_LOG/PICKUP_HANDOVER/REDEEM',
  `photo_urls` varchar(1000) DEFAULT NULL COMMENT '鐜板満鐓х墖URL,閫楀彿鍒嗛殧,鏈??6寮',
  `recorder_position` varchar(30) DEFAULT NULL COMMENT '璁板綍浜哄矖浣嶅揩鐓',
  PRIMARY KEY (`service_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='寄养服务记录表';

CREATE TABLE IF NOT EXISTS `pet` (
  `pet_id` bigint NOT NULL AUTO_INCREMENT COMMENT '宠物ID',
  `customer_id` bigint NOT NULL COMMENT '所属客户ID',
  `name` varchar(50) NOT NULL COMMENT '宠物名称',
  `breed` varchar(50) DEFAULT NULL COMMENT '品种',
  `species` varchar(10) DEFAULT NULL COMMENT '犬/猫',
  `gender` varchar(10) DEFAULT NULL COMMENT '性别: 公/母',
  `age` int DEFAULT NULL COMMENT '年龄',
  `weight` decimal(6,2) DEFAULT NULL COMMENT '体重(kg)',
  `color` varchar(50) DEFAULT NULL COMMENT '颜色',
  `vaccine` varchar(255) DEFAULT NULL COMMENT '疫苗情况',
  `history` text COMMENT '病史',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`pet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物档案表';

CREATE TABLE IF NOT EXISTS `pet_cert` (
  `cert_id` bigint NOT NULL AUTO_INCREMENT COMMENT '证明ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `cert_type` varchar(20) NOT NULL COMMENT '类型: 疫苗/驱虫',
  `subtype` varchar(30) DEFAULT NULL COMMENT '细分: 狂犬/联苗/体内/体外',
  `cert_no` varchar(50) DEFAULT NULL COMMENT '证书编号/免疫证号',
  `hospital` varchar(100) DEFAULT NULL COMMENT '接种机构',
  `inject_date` date DEFAULT NULL COMMENT '接种日期',
  `expire_date` date DEFAULT NULL COMMENT '失效日期',
  `image_url` varchar(500) DEFAULT NULL COMMENT '证明照片URL',
  `audit_status` varchar(20) NOT NULL DEFAULT '待审核' COMMENT '审核: 待审核/通过/驳回',
  `audit_note` varchar(255) DEFAULT NULL COMMENT '审核意见',
  `auditor_id` bigint DEFAULT NULL COMMENT '审核人ID',
  `audit_time` datetime DEFAULT NULL COMMENT '审核时间',
  `deleted` int NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`cert_id`),
  KEY `idx_pet` (`pet_id`,`cert_type`),
  KEY `idx_expire` (`expire_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='免疫与驱虫证明表';

CREATE TABLE IF NOT EXISTS `pet_health_record` (
  `record_id` bigint NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `order_id` bigint DEFAULT NULL COMMENT '关联订单ID(可空)',
  `type` varchar(20) NOT NULL COMMENT '记录类型: 入店记录/寄养观测记录/离店记录',
  `temperature` decimal(4,1) DEFAULT NULL COMMENT '体温(℃)',
  `spirit` varchar(50) DEFAULT NULL COMMENT '精神状态',
  `appetite` varchar(50) DEFAULT NULL COMMENT '食欲',
  `defecation` varchar(50) DEFAULT NULL COMMENT '排便情况',
  `skin` varchar(100) DEFAULT NULL COMMENT '皮肤状况',
  `abnormal` varchar(255) DEFAULT NULL COMMENT '异常情况',
  `treatment` varchar(255) DEFAULT NULL COMMENT '处理措施',
  `recorder_id` bigint DEFAULT NULL COMMENT '记录人ID',
  `record_time` datetime DEFAULT NULL COMMENT '记录时间',
  `recorder_position` varchar(30) DEFAULT NULL COMMENT '记录人岗位快照',
  `verified_by` bigint DEFAULT NULL COMMENT '复核兽医staff_id',
  `verified_at` datetime DEFAULT NULL COMMENT '复核时间',
  `prescription_ref` varchar(50) DEFAULT NULL COMMENT '外部处方编号',
  PRIMARY KEY (`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物健康记录表';

CREATE TABLE IF NOT EXISTS `pet_reject` (
  `reject_id` bigint NOT NULL AUTO_INCREMENT COMMENT '拒收ID',
  `pet_id` bigint NOT NULL COMMENT '宠物ID',
  `reason_code` varchar(30) NOT NULL COMMENT '原因码',
  `reason_text` varchar(255) DEFAULT NULL COMMENT '说明',
  `basis` varchar(255) DEFAULT NULL COMMENT '依据',
  `reject_time` datetime DEFAULT NULL COMMENT '拒收时间',
  `operator_id` bigint DEFAULT NULL COMMENT '经办人ID',
  `review_status` varchar(20) DEFAULT '无异议' COMMENT '复核: 无异议/申诉中/已推翻',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`reject_id`),
  KEY `idx_pet` (`pet_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='宠物拒收记录';

CREATE TABLE IF NOT EXISTS `review` (
  `review_id` bigint NOT NULL AUTO_INCREMENT,
  `order_id` bigint NOT NULL,
  `customer_id` bigint NOT NULL,
  `pet_id` bigint DEFAULT NULL,
  `rating` int NOT NULL DEFAULT '5',
  `content` varchar(500) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `deleted` int DEFAULT '0',
  PRIMARY KEY (`review_id`),
  UNIQUE KEY `uk_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_item` (
  `service_id` bigint NOT NULL AUTO_INCREMENT COMMENT '服务项ID',
  `service_code` varchar(30) NOT NULL COMMENT '服务代码: BATH/WALK/PICKUP/MEDICATION',
  `service_name` varchar(50) NOT NULL COMMENT '服务名称',
  `unit_type` varchar(10) NOT NULL DEFAULT 'once' COMMENT '计价单位: day/once',
  `price` decimal(10,2) NOT NULL COMMENT '单价(元)',
  `status` tinyint NOT NULL DEFAULT '1' COMMENT '状态: 0停用 1启用',
  `sort` int DEFAULT '0' COMMENT '排序',
  `remark` varchar(255) DEFAULT NULL COMMENT '说明',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`service_id`),
  UNIQUE KEY `uk_service_code` (`service_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='增值服务价目表';

CREATE TABLE IF NOT EXISTS `staff` (
  `staff_id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `real_name` varchar(50) NOT NULL,
  `position` varchar(30) DEFAULT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` datetime DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  `positions` varchar(200) DEFAULT NULL COMMENT '宀椾綅澶氬?(閫楀彿鍒嗛殧: OWNER/FRONT/CARE/VET/GROOM/DRIVER)',
  PRIMARY KEY (`staff_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_cert` (
  `cert_id` bigint NOT NULL AUTO_INCREMENT COMMENT '资质ID',
  `staff_id` bigint NOT NULL COMMENT '员工ID',
  `cert_type` varchar(30) NOT NULL COMMENT '资质: 执业兽医/护理培训/美容/驾驶',
  `cert_no` varchar(50) DEFAULT NULL COMMENT '证书编号',
  `valid_from` date DEFAULT NULL COMMENT '有效期起',
  `valid_to` date DEFAULT NULL COMMENT '有效期止',
  `image_url` varchar(500) DEFAULT NULL COMMENT '证书照片',
  `deleted` int NOT NULL DEFAULT '0' COMMENT '逻辑删除',
  PRIMARY KEY (`cert_id`),
  KEY `idx_staff` (`staff_id`,`cert_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='员工资质表';

CREATE TABLE IF NOT EXISTS `staff_shift` (
  `shift_id` bigint NOT NULL AUTO_INCREMENT COMMENT '排班ID',
  `staff_id` bigint NOT NULL COMMENT '员工ID',
  `shift_date` date NOT NULL COMMENT '班次日期',
  `shift_type` varchar(10) NOT NULL COMMENT '班次: 早/中/晚/全天',
  `duty` varchar(20) DEFAULT NULL COMMENT '职责: 主责护理/前台/外勤/兽医',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`shift_id`),
  UNIQUE KEY `uk_staff_date_shift` (`staff_id`,`shift_date`,`shift_type`),
  KEY `idx_date_shift` (`shift_date`,`shift_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='排班表(仅建表,模块暂不实现)';

CREATE TABLE IF NOT EXISTS `store` (
  `store_id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `address` varchar(200) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `open_hours` varchar(50) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'ENABLED',
  `deleted` int DEFAULT '0',
  PRIMARY KEY (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `store_env_log` (
  `log_id` bigint NOT NULL AUTO_INCREMENT COMMENT '环境记录ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `log_date` date NOT NULL COMMENT '日期',
  `period` varchar(10) NOT NULL COMMENT '时段: 上午/下午',
  `temperature` decimal(4,1) DEFAULT NULL COMMENT '温度(℃)',
  `humidity` decimal(4,1) DEFAULT NULL COMMENT '湿度(%)',
  `recorder_id` bigint DEFAULT NULL COMMENT '记录人ID',
  `record_time` datetime DEFAULT NULL COMMENT '记录时间',
  PRIMARY KEY (`log_id`),
  UNIQUE KEY `uk_store_date_period` (`store_id`,`log_date`,`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='温湿度记录表';

CREATE TABLE IF NOT EXISTS `store_license` (
  `license_id` bigint NOT NULL AUTO_INCREMENT COMMENT '证照ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `license_type` varchar(50) NOT NULL COMMENT '证照类型: 营业执照/动物防疫条件合格证',
  `license_no` varchar(100) DEFAULT NULL COMMENT '证照编号',
  `valid_from` date DEFAULT NULL COMMENT '有效期起',
  `valid_to` date DEFAULT NULL COMMENT '有效期止',
  `image_url` varchar(500) DEFAULT NULL COMMENT '证照照片',
  `remark` varchar(255) DEFAULT NULL COMMENT '备注',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  PRIMARY KEY (`license_id`),
  KEY `idx_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店证照表';

CREATE TABLE IF NOT EXISTS `sys_admin` (
  `admin_id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `real_name` varchar(50) NOT NULL,
  `status` tinyint NOT NULL DEFAULT '1',
  `create_time` datetime DEFAULT NULL,
  `remark` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================
-- 二、演示种子数据（护宠宝单门店）
--     历史口径已修正：全部订单 payment_status=已支付、charge_days=DATEDIFF+1、
--     金额 = price_per_day × charge_days；不再有「待支付 / 15 分钟超时」演示单。
-- =============================================================

-- 店长 OWNER：13800138000 / 123456
INSERT INTO sys_admin (username, password, real_name, status, create_time, remark) VALUES
('13800138000', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '店长', 1, NOW(), 'OWNER 超级管理员');

-- 五岗位员工：position 单值（旧列，只读兼容）与 positions 多值列一致
INSERT INTO staff (username, password, real_name, position, positions, status, create_time, remark) VALUES
('13800138011', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '护理员小陈', 'CARE',   'CARE',   1, NOW(), '护理'),
('13800138012', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '前台小周',   'FRONT',  'FRONT',  1, NOW(), '前台'),
('13800138013', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '兽医小李',   'VET',    'VET',    1, NOW(), '兽医'),
('13800138014', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '美容师小王', 'GROOM',  'GROOM',  1, NOW(), '美容'),
('13800138015', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '司机小赵',   'DRIVER', 'DRIVER', 1, NOW(), '接送');

-- 客户（username = 手机号，小程序端登录账号）
INSERT INTO customer (name, phone, username, password, address, remark, status, create_time) VALUES
('李小明', '13800138001', '13800138001', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '泉州市丰泽区东湖街道1号', '老客户', 1, NOW()),
('王小红', '13900139002', '13900139002', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '泉州市鲤城区中山中路20号', NULL,     1, NOW()),
('张伟',   '13700137003', '13700137003', '$2a$10$obk31JbG2WevwnaYTaFNr..u5V5jgBmQSk2m0VnZn/UGO28zCNYL2', '泉州市洛江区万安街道5号', NULL,     1, NOW());

-- 价位档位
INSERT INTO foster_price (level_name, price_per_day, status, sort, remark, create_time) VALUES
('标准间', 60.00,  1, 1, '基础寄养房型', NOW()),
('舒适间', 80.00,  1, 2, '宽敞房型',   NOW()),
('豪华间', 120.00, 1, 3, '豪华房型',   NOW());

-- 门店
INSERT INTO store (name, address, phone, open_hours, status, deleted) VALUES
('毛球旅馆·西湖总店', '杭州市西湖区毛球路 16 号（演示地址）', '400-080-6060', '09:00-21:00', 'ENABLED', 0);

-- 宠物（species 猫/犬分区；vaccine 为小程序端 JSON 编码）
INSERT INTO pet (customer_id, name, breed, species, gender, age, weight, color, vaccine, history, create_time) VALUES
(1, '豆豆', '金毛寻回犬', '犬', '公', 3, 25.50, '金色', '狂犬疫苗已接种', '无', NOW()),
(1, '咪咪', '英国短毛猫', '猫', '母', 2,  4.20, '灰色', '猫三联已接种',   '无', NOW()),
(2, '旺财', '柯基犬',     '犬', '公', 1, 12.80, '黄白', '狂犬疫苗已接种', '轻度皮肤病已治愈', NOW()),
(3, '雪球', '萨摩耶',     '犬', '母', 4, 20.00, '白色', '狂犬疫苗+六联已接种', '无', NOW()),
(1, '布丁', '泰迪犬',     '犬', '公', 2,  6.50, '棕色', '{"status":"已接种","name":"狂犬疫苗","date":"2026-06"}', '性格活泼，寄养期间需每日遛弯', NOW()),
(1, '汤圆', '布偶猫',     '猫', '母', 1,  3.80, '白色', '{"status":"未接种","name":"猫三联","date":""}', '胆小怕生，未完成免疫前不可下单', NOW());

-- 房位（3 档 × 共 6 间）
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time) VALUES
(1, 'A-01', 1, '犬舍', 1, '空闲', 1, NOW()),
(1, 'A-02', 1, '犬舍', 1, '空闲', 2, NOW()),
(1, 'B-01', 2, '犬舍', 1, '空闲', 1, NOW()),
(1, 'B-02', 2, '犬舍', 1, '空闲', 2, NOW()),
(1, 'B-03', 2, '猫舍', 1, '空闲', 3, NOW()),
(1, 'C-01', 3, '犬舍', 1, '空闲', 1, NOW());

-- 业务规则
INSERT INTO biz_rule (rule_key, rule_value, unit, effective_from, remark) VALUES
('billing.unit',                 'day',  NULL,   '2026-01-01', '计费单位：按照护日'),
('billing.checkout_day_charge',  '1',    NULL,   '2026-01-01', '离店当日计费 1=是 0=免费'),
('deposit.ratio',                '0.3',  '比例', '2026-01-01', '定金占房费 30%'),
('refund.free_hours',            '24',   '小时', '2026-01-01', '入住前 24h 免费取消'),
('refund.late.fee_days',         '1',    '日',   '2026-01-01', '逾期取消收 1 日房费'),
('refund.ladder',                '[{"h":72,"r":1},{"h":24,"r":0.5},{"h":0,"r":0.3}]', 'JSON', '2026-01-01', '阶梯退定金比例'),
('overtime.hour_fee',            '10',   '元/小时', '2026-01-01', '超时费'),
('overtime.cap_days',            '1',    '日',   '2026-01-01', '超时费封顶 1 日房费'),
('abandon.hours',                '24',   '小时', '2026-01-01', '弃养判定小时数'),
('abandon.notice_times',         '2',    '次',   '2026-01-01', '通知≥2 次才生成工单'),
('medication.daily_fee',         '10',   '元/天', '2026-01-01', '喂药照护日费'),
('holiday.markup',               '1.2',  '倍率', '2026-01-01', '节假日倍率');

-- 增值服务价目（unit_type: day × charge_days / once × 1）
INSERT INTO service_item (service_code, service_name, unit_type, price, sort, remark) VALUES
('BATH',       '洗护美容', 'once', 30.00, 1, '离店前一次，按次计'),
('WALK',       '每日遛宠', 'day',  20.00, 2, '按照护日每日计'),
('PICKUP',     '上门接送', 'once', 40.00, 3, '单程一次'),
('MEDICATION', '喂药照护', 'day',  10.00, 4, '按日计');

-- 演示订单：创建即已支付；charge_days = DATEDIFF(离店, 入住) + 1
-- 账单明细 foster_bill_item 由下单时写入，不预置；staff_shift 由员工端 V1「今日在岗确认」写入，不预置
INSERT INTO foster_order (order_no, customer_id, pet_id, start_date, end_date, price_id, price_per_day,
                          total_fee, status, remark, payment_status, payment_method, payment_time,
                          paid_amount, charge_days, store_id, creator_id, create_time) VALUES
('FO20261001001', 1, 1, '2026-10-01', '2026-10-07', 2,    80.00, 560.00, '已完成', '国庆寄养',
 '已支付', '微信', '2026-10-01 09:00:00', 560.00,  7, 1, 1, '2026-10-01 09:00:00'),
('FO20261008001', 2, 3, '2026-10-08', '2026-10-15', 1,    60.00, 480.00, '寄养中', '短期寄养（8 个照护日）',
 '已支付', '微信', '2026-10-08 10:30:00', 480.00,  8, 1, 1, '2026-10-08 10:30:00'),
('FO20261009001', 3, 4, '2026-10-09', '2026-10-20', NULL, 100.00, 1200.00, '待入店', '已预订（历史价格快照）',
 '已支付', '微信', '2026-10-09 14:00:00', 1200.00, 12, 1, 1, '2026-10-09 14:00:00'),
('FO20261110001', 1, 5, '2026-11-10', '2026-11-13', 2, 80.00, 320.00, '待入店', '小程序演示：待入店',
 '已支付', '微信', '2026-11-01 09:00:00', 320.00, 4, 1, 1, '2026-11-01 09:00:00'),
('FO20261025002', 1, 2, '2026-10-25', '2026-11-05', 2, 80.00, 960.00, '寄养中', '小程序演示：寄养中',
 '已支付', '微信', '2026-10-25 09:12:00', 960.00, 12, 1, 1, '2026-10-25 09:12:00'),
('FO20260918003', 1, 5, '2026-09-18', '2026-09-20', 2, 80.00, 240.00, '已完成', '小程序演示：已完成',
 '已支付', '微信', '2026-09-18 10:05:00', 240.00, 3, 1, 1, '2026-09-18 10:05:00'),
('FO20260910004', 1, 1, '2026-09-10', '2026-09-11', 2, 80.00, 160.00, '已完成', '小程序演示：已完成',
 '已支付', '微信', '2026-09-10 15:30:00', 160.00, 2, 1, 1, '2026-09-10 15:30:00');

-- 健康记录
INSERT INTO pet_health_record (pet_id, order_id, type, temperature, spirit, appetite, defecation, skin, abnormal, treatment, recorder_id, record_time) VALUES
(1, 1, '入店记录',     38.5, '良好', '正常', '正常', '毛发光泽', '无', '无需处理', 1, '2026-10-01 09:30:00'),
(1, 1, '寄养观测记录', 38.7, '良好', '正常', '正常', '正常',     '无', '无需处理', 1, '2026-10-03 10:00:00'),
(3, 2, '入店记录',     38.6, '活泼', '正常', '正常', '无异常',   '无', '无需处理', 1, '2026-10-08 11:00:00');

-- 服务记录
INSERT INTO foster_service_record (order_id, pet_id, item, content, service_time, keeper_id) VALUES
(1, 1, '洗澡', '金毛全身清洗吹干',   '2026-10-02 15:00:00', 1),
(1, 1, '遛弯', '户外遛弯 30 分钟',   '2026-10-03 08:00:00', 1),
(2, 3, '喂食', '每日两餐，狗粮适量', '2026-10-08 18:00:00', 1);

-- 照护动态
INSERT INTO care_record (order_id, day, type, content, create_time) VALUES
(2, 1, 'PHOTO',    '早上交接完成，旺财精神好，吃了 200g 粮。', '2026-10-26 10:30:00'),
(2, 2, 'ACTIVITY', '下午遛弯 30 分钟，社交良好，无异常。',     '2026-10-27 15:00:00'),
(2, 3, 'HEALTH',   '体温正常，毛发干净，食欲佳。',             '2026-10-28 09:00:00');

-- 优惠券
INSERT INTO coupon (customer_id, name, discount, min_amount, status, expire_at) VALUES
(1, '新用户首单立减', 20.00, 0.00, 'UNUSED', '2026-12-31');

-- 演示兽医资质：cert_type 用英文代码 VET_LICENSE，避免字符集导致判定失效
INSERT INTO staff_cert (staff_id, cert_type, cert_no, valid_from, valid_to, deleted) VALUES
(3, 'VET_LICENSE', 'A3505****0003', '2020-01-01', '2035-12-31', 0);

-- =============================================================
-- 三、可选：索引优化见 src/main/resources/db/index_optimization.sql
--     历史迁移脚本 v2/v3/v4 已并入本文件，新环境无需再执行。
-- =============================================================
