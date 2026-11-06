-- ============================================================
-- v3 PRD 业务扩展迁移（毛球旅馆 v1.0）
-- 建 16 张新表 + 订单/健康/员工表补列 + 种子数据
-- 幂等：新表 CREATE IF NOT EXISTS；列缺失才 ADD（见末尾动态补列）
-- ============================================================

-- ---------- 2.1 房间与房态 ----------
CREATE TABLE IF NOT EXISTS foster_room (
  room_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '房间ID',
  store_id    BIGINT NOT NULL COMMENT '门店ID',
  room_no     VARCHAR(20) NOT NULL COMMENT '房号/笼位号，如 A-01',
  price_id    BIGINT NOT NULL COMMENT '对应价位档位ID',
  room_type   VARCHAR(20) NOT NULL COMMENT '类型: 犬舍/猫舍/套房',
  capacity    INT NOT NULL DEFAULT 1 COMMENT '同住上限(只)',
  status      VARCHAR(20) NOT NULL DEFAULT '空闲' COMMENT '状态: 空闲/已预订/在住/待清洁/维修/隔离',
  sort        INT DEFAULT 0 COMMENT '排序',
  remark      VARCHAR(255) COMMENT '备注',
  deleted     INT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0正常 1删除',
  create_time DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_store_room (store_id, room_no),
  KEY idx_price (price_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='寄养房间表';

CREATE TABLE IF NOT EXISTS foster_room_booking (
  booking_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '占用ID',
  room_id        BIGINT NOT NULL COMMENT '房间ID',
  order_id       BIGINT NOT NULL COMMENT '订单ID',
  occupy_start   DATE NOT NULL COMMENT '占用开始(含)',
  occupy_end     DATE NOT NULL COMMENT '占用结束(不含，通常是离店日)',
  status         VARCHAR(20) NOT NULL DEFAULT '锁定' COMMENT '状态: 锁定/占用/释放',
  create_time    DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_room_order (room_id, order_id),
  KEY idx_room_range (room_id, occupy_start, occupy_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='房间占用表';

-- ---------- 2.2 入离店交接单 ----------
CREATE TABLE IF NOT EXISTS foster_handover (
  handover_id    BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '交接单ID',
  order_id       BIGINT NOT NULL COMMENT '订单ID',
  type           VARCHAR(10) NOT NULL COMMENT '类型: 入店/离店',
  check_items    JSON COMMENT '体表检查项',
  weight         DECIMAL(6,2) COMMENT '当场称重(kg)',
  photo_urls     VARCHAR(1000) COMMENT '到场照片URL，逗号分隔',
  belongings     JSON COMMENT '随身物品清单',
  customer_sign  TINYINT NOT NULL DEFAULT 0 COMMENT '客户是否签字确认: 0否 1是',
  signer_id      BIGINT COMMENT '经办员工ID',
  signer_position VARCHAR(50) COMMENT '经办人岗位(快照)',
  handover_time  DATETIME COMMENT '交接时间',
  remark         VARCHAR(255) COMMENT '备注',
  create_time    DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_order_type (order_id, type),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入离店交接单';

-- ---------- 2.3 每日巡视日志 ----------
CREATE TABLE IF NOT EXISTS foster_care_log (
  care_log_id  BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '巡视日志ID',
  order_id     BIGINT NOT NULL COMMENT '订单ID',
  pet_id       BIGINT NOT NULL COMMENT '宠物ID',
  log_date     DATE NOT NULL COMMENT '巡视日期',
  shift        VARCHAR(10) NOT NULL COMMENT '班次: 早/中/晚',
  spirit       VARCHAR(50) COMMENT '精神',
  appetite     VARCHAR(50) COMMENT '食欲/饮食',
  defecation   VARCHAR(50) COMMENT '排泄',
  exercise     VARCHAR(50) COMMENT '运动/遛放',
  coat         VARCHAR(50) COMMENT '被毛',
  temperature  DECIMAL(4,1) COMMENT '体温(℃)',
  abnormal     VARCHAR(255) COMMENT '异常描述(空=无异常)',
  photo_urls   VARCHAR(1000) COMMENT '巡视照片URL(逗号分隔,最多6张)',
  recorder_id  BIGINT NOT NULL COMMENT '记录人ID',
  recorder_position VARCHAR(30) COMMENT '记录人岗位快照(CARE/VET)',
  record_time  DATETIME COMMENT '记录时间',
  UNIQUE KEY uk_order_date_shift (order_id, log_date, shift),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='每日巡视日志(早/中/晚)';

-- ---------- 2.4 异常事件 ----------
CREATE TABLE IF NOT EXISTS foster_incident (
  incident_id      BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '异常事件ID',
  order_id         BIGINT NOT NULL COMMENT '订单ID',
  pet_id           BIGINT NOT NULL COMMENT '宠物ID',
  occur_time       DATETIME NOT NULL COMMENT '发生时间',
  category         VARCHAR(20) NOT NULL COMMENT '类别: 健康/受伤/走失/打斗/其他',
  description      VARCHAR(500) NOT NULL COMMENT '情况简介',
  action           VARCHAR(500) COMMENT '处置措施',
  notify_customer  TINYINT NOT NULL DEFAULT 0 COMMENT '是否已通知主人',
  notify_time      DATETIME COMMENT '通知时间',
  notify_channel   VARCHAR(20) COMMENT '通知渠道: 电话/微信/短信',
  need_vet         TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要送医',
  vet_authorized_by BIGINT COMMENT '授权人ID(执业兽医)',
  vet_authorized_at DATETIME COMMENT '授权时间',
  vet_hospital     VARCHAR(100) COMMENT '送诊医院',
  cost             DECIMAL(10,2) COMMENT '医疗费用(计入账单)',
  status           VARCHAR(20) NOT NULL DEFAULT '待处理' COMMENT '状态: 待处理/处理中/已闭环',
  close_note       VARCHAR(255) COMMENT '闭环说明',
  recorder_id      BIGINT NOT NULL COMMENT '记录人ID',
  create_time      DATETIME COMMENT '创建时间',
  KEY idx_order (order_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='异常事件表';

-- ---------- 2.5 消毒与环境台账 ----------
CREATE TABLE IF NOT EXISTS foster_disinfection_log (
  log_id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '消毒记录ID',
  store_id         BIGINT NOT NULL COMMENT '门店ID',
  area             VARCHAR(50) NOT NULL COMMENT '区域',
  method           VARCHAR(50) COMMENT '方式',
  agent            VARCHAR(50) COMMENT '消毒剂名称',
  concentration    VARCHAR(30) COMMENT '使用浓度',
  operator_id      BIGINT COMMENT '操作人ID',
  disinfection_time DATETIME NOT NULL COMMENT '消毒时间',
  remark           VARCHAR(255) COMMENT '备注',
  KEY idx_store_time (store_id, disinfection_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消毒记录表';

CREATE TABLE IF NOT EXISTS store_env_log (
  log_id       BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '环境记录ID',
  store_id     BIGINT NOT NULL COMMENT '门店ID',
  log_date     DATE NOT NULL COMMENT '日期',
  period       VARCHAR(10) NOT NULL COMMENT '时段: 上午/下午',
  temperature  DECIMAL(4,1) COMMENT '温度(℃)',
  humidity     DECIMAL(4,1) COMMENT '湿度(%)',
  recorder_id  BIGINT COMMENT '记录人ID',
  record_time  DATETIME COMMENT '记录时间',
  UNIQUE KEY uk_store_date_period (store_id, log_date, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='温湿度记录表';

-- ---------- 2.6 免疫 / 驱虫附件 ----------
CREATE TABLE IF NOT EXISTS pet_cert (
  cert_id       BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '证明ID',
  pet_id        BIGINT NOT NULL COMMENT '宠物ID',
  cert_type     VARCHAR(20) NOT NULL COMMENT '类型: 疫苗/驱虫',
  subtype       VARCHAR(30) COMMENT '细分: 狂犬/联苗/体内/体外',
  cert_no       VARCHAR(50) COMMENT '证书编号/免疫证号',
  hospital      VARCHAR(100) COMMENT '接种机构',
  inject_date   DATE COMMENT '接种日期',
  expire_date   DATE COMMENT '失效日期',
  image_url     VARCHAR(500) COMMENT '证明照片URL',
  audit_status  VARCHAR(20) NOT NULL DEFAULT '待审核' COMMENT '审核: 待审核/通过/驳回',
  audit_note    VARCHAR(255) COMMENT '审核意见',
  auditor_id    BIGINT COMMENT '审核人ID',
  audit_time    DATETIME COMMENT '审核时间',
  deleted       INT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
  create_time   DATETIME COMMENT '创建时间',
  KEY idx_pet (pet_id, cert_type),
  KEY idx_expire (expire_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='免疫与驱虫证明表';

-- ---------- 2.7 账单明细 ----------
CREATE TABLE IF NOT EXISTS foster_bill_item (
  item_id      BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '明细ID',
  order_id     BIGINT NOT NULL COMMENT '订单ID',
  item_code    VARCHAR(50) NOT NULL COMMENT '项目编码: ROOM/SERVICE/MEDICAL/OVERDUE/COMPENSATE/DEPOSIT/DISCOUNT',
  item_name    VARCHAR(100) NOT NULL COMMENT '展示名称',
  item_type    VARCHAR(20) NOT NULL COMMENT '类型: 房费/增值/医疗/超时/赔偿/定金/优惠',
  unit_price   DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '单价',
  quantity     DECIMAL(10,2) NOT NULL DEFAULT 1 COMMENT '数量(日/次/项)',
  amount       DECIMAL(10,2) NOT NULL COMMENT '小计金额',
  source       VARCHAR(10) NOT NULL DEFAULT '系统' COMMENT '来源: 系统/手工',
  status       VARCHAR(20) NOT NULL DEFAULT '待结算' COMMENT '状态: 待结算/已结算/已退款',
  remark       VARCHAR(255) COMMENT '备注',
  create_time  DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_order_code (order_id, item_code),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单账单明细';

-- ---------- 2.8 拒收记录 ----------
CREATE TABLE IF NOT EXISTS pet_reject (
  reject_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '拒收ID',
  pet_id        BIGINT NOT NULL COMMENT '宠物ID',
  reason_code   VARCHAR(30) NOT NULL COMMENT '原因码',
  reason_text    VARCHAR(255) COMMENT '说明',
  basis         VARCHAR(255) COMMENT '依据',
  reject_time   DATETIME COMMENT '拒收时间',
  operator_id   BIGINT COMMENT '经办人ID',
  review_status VARCHAR(20) DEFAULT '无异议' COMMENT '复核: 无异议/申诉中/已推翻',
  create_time   DATETIME COMMENT '创建时间',
  KEY idx_pet (pet_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物拒收记录';

-- ---------- 2.9 资质与排班 ----------
CREATE TABLE IF NOT EXISTS staff_cert (
  cert_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '资质ID',
  staff_id    BIGINT NOT NULL COMMENT '员工ID',
  cert_type   VARCHAR(30) NOT NULL COMMENT '资质: 执业兽医/护理培训/美容/驾驶',
  cert_no     VARCHAR(50) COMMENT '证书编号',
  valid_from  DATE COMMENT '有效期起',
  valid_to    DATE COMMENT '有效期止',
  image_url   VARCHAR(500) COMMENT '证书照片',
  deleted     INT NOT NULL DEFAULT 0 COMMENT '逻辑删除',
  KEY idx_staff (staff_id, cert_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='员工资质表';

CREATE TABLE IF NOT EXISTS staff_shift (
  shift_id    BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '排班ID',
  staff_id    BIGINT NOT NULL COMMENT '员工ID',
  shift_date  DATE NOT NULL COMMENT '班次日期',
  shift_type  VARCHAR(10) NOT NULL COMMENT '班次: 早/中/晚/全天',
  duty        VARCHAR(20) COMMENT '职责: 主责护理/前台/外勤/兽医',
  remark      VARCHAR(255) COMMENT '备注',
  create_time DATETIME COMMENT '创建时间',
  UNIQUE KEY uk_staff_date_shift (staff_id, shift_date, shift_type),
  KEY idx_date_shift (shift_date, shift_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='排班表(仅建表,模块暂不实现)';

-- ---------- 2.11 规则配置 ----------
CREATE TABLE IF NOT EXISTS biz_rule (
  rule_id        BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '规则ID',
  rule_key       VARCHAR(50) NOT NULL COMMENT '规则键',
  rule_value     VARCHAR(255) NOT NULL COMMENT '规则值(数字或JSON)',
  unit           VARCHAR(20) COMMENT '单位',
  effective_from DATE NOT NULL COMMENT '生效日期',
  remark         VARCHAR(255) COMMENT '说明',
  UNIQUE KEY uk_key_from (rule_key, effective_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='业务规则配置';

-- ---------- 2.12 增值服务价目表 ----------
CREATE TABLE IF NOT EXISTS service_item (
  service_id   BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '服务项ID',
  service_code VARCHAR(30)  NOT NULL COMMENT '服务代码: BATH/WALK/PICKUP/MEDICATION',
  service_name VARCHAR(50)  NOT NULL COMMENT '服务名称',
  unit_type    VARCHAR(10)  NOT NULL DEFAULT 'once' COMMENT '计价单位: day/once',
  price        DECIMAL(10,2) NOT NULL COMMENT '单价(元)',
  status       TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0停用 1启用',
  sort         INT DEFAULT 0 COMMENT '排序',
  remark       VARCHAR(255) COMMENT '说明',
  create_time  DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  UNIQUE KEY uk_service_code (service_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='增值服务价目表';

-- ---------- 合规留痕：门店证照 / 导出日志 ----------
CREATE TABLE IF NOT EXISTS store_license (
  license_id   BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '证照ID',
  store_id     BIGINT NOT NULL COMMENT '门店ID',
  license_type VARCHAR(50) NOT NULL COMMENT '证照类型: 营业执照/动物防疫条件合格证',
  license_no   VARCHAR(100) COMMENT '证照编号',
  valid_from   DATE COMMENT '有效期起',
  valid_to     DATE COMMENT '有效期止',
  image_url    VARCHAR(500) COMMENT '证照照片',
  remark       VARCHAR(255) COMMENT '备注',
  create_time  DATETIME COMMENT '创建时间',
  KEY idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='门店证照表';

CREATE TABLE IF NOT EXISTS data_export_log (
  export_id    BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '导出ID',
  operator_id  BIGINT COMMENT '操作人ID',
  purpose      VARCHAR(255) NOT NULL COMMENT '导出用途(必填)',
  data_scope   VARCHAR(100) COMMENT '导出数据范围',
  phone_masked TINYINT NOT NULL DEFAULT 1 COMMENT '手机号是否脱敏',
  create_time  DATETIME COMMENT '导出时间',
  KEY idx_time (create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='数据导出留痕表';

-- ============================================================
-- 种子数据
-- ============================================================
-- 房间：每档若干房位（舒适间 2 犬舍 + 1 猫舍，便于测猫犬分区与防超订）
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'A-01',1,'犬舍',1,'空闲',1,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='A-01');
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'A-02',1,'犬舍',1,'空闲',2,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='A-02');
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'B-01',2,'犬舍',1,'空闲',1,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='B-01');
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'B-02',2,'犬舍',1,'空闲',2,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='B-02');
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'B-03',2,'猫舍',1,'空闲',3,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='B-03');
INSERT INTO foster_room (store_id, room_no, price_id, room_type, capacity, status, sort, create_time)
SELECT 1,'C-01',3,'犬舍',1,'空闲',1,NOW() WHERE NOT EXISTS (SELECT 1 FROM foster_room WHERE room_no='C-01');

-- biz_rule 默认规则
INSERT INTO biz_rule (rule_key, rule_value, unit, effective_from, remark) VALUES
 ('billing.unit','day',NULL,'2026-01-01','计费单位：按照护日'),
 ('billing.checkout_day_charge','1',NULL,'2026-01-01','离店当日计费 1=是 0=免费'),
 ('deposit.ratio','0.3','比例','2026-01-01','定金占房费30%'),
 ('refund.free_hours','24','小时','2026-01-01','入住前24h免费取消'),
 ('refund.late.fee_days','1','日','2026-01-01','逾期取消收1日房费'),
 ('refund.ladder','[{"h":72,"r":1},{"h":24,"r":0.5},{"h":0,"r":0.3}]','JSON','2026-01-01','阶梯退定金比例'),
 ('overtime.hour_fee','10','元/小时','2026-01-01','超时费'),
 ('overtime.cap_days','1','日','2026-01-01','超时费封顶1日房费'),
 ('abandon.hours','24','小时','2026-01-01','弃养判定小时数'),
 ('abandon.notice_times','2','次','2026-01-01','通知≥2次才生成工单'),
 ('medication.daily_fee','10','元/天','2026-01-01','喂药照护日费'),
 ('holiday.markup','1.2','倍率','2026-01-01','节假日倍率')
ON DUPLICATE KEY UPDATE remark=VALUES(remark);

-- service_item 增值服务
INSERT INTO service_item (service_code, service_name, unit_type, price, sort, remark) VALUES
 ('BATH','洗护美容','once',30.00,1,'离店前一次，按次计'),
 ('WALK','每日遛宠','day',20.00,2,'按照护日每日计'),
 ('PICKUP','上门接送','once',40.00,3,'单程一次'),
 ('MEDICATION','喂药照护','day',10.00,4,'按日计')
ON DUPLICATE KEY UPDATE price=VALUES(price);

-- ============================================================
-- 列补齐（MySQL8 不支持 ADD COLUMN IF NOT EXISTS；本表此前无这些列，可直接执行）
-- ============================================================
ALTER TABLE sys_user ADD COLUMN positions VARCHAR(200) COMMENT '岗位多值(逗号分隔: OWNER/FRONT/CARE/VET/GROOM/DRIVER)';
ALTER TABLE foster_order ADD COLUMN room_id BIGINT NULL COMMENT '房间ID(下单锁定)';
ALTER TABLE foster_order ADD COLUMN charge_days INT NULL COMMENT '计费日数(含离店日,快照)';
ALTER TABLE foster_order ADD COLUMN deposit_fee DECIMAL(10,2) DEFAULT 0 COMMENT '定金金额';
ALTER TABLE foster_order ADD COLUMN discount_fee DECIMAL(10,2) DEFAULT 0 COMMENT '优惠金额';
ALTER TABLE foster_order ADD COLUMN extra_fee DECIMAL(10,2) DEFAULT 0 COMMENT '增值服务金额';
ALTER TABLE foster_order ADD COLUMN check_in_time DATETIME NULL COMMENT '实际入店时间';
ALTER TABLE foster_order ADD COLUMN check_out_time DATETIME NULL COMMENT '实际离店时间';
ALTER TABLE pet_health_record ADD COLUMN recorder_position VARCHAR(30) NULL COMMENT '记录人岗位快照';
ALTER TABLE pet_health_record ADD COLUMN verified_by BIGINT NULL COMMENT '复核兽医staff_id';
ALTER TABLE pet_health_record ADD COLUMN verified_at DATETIME NULL COMMENT '复核时间';
ALTER TABLE pet_health_record ADD COLUMN prescription_ref VARCHAR(50) NULL COMMENT '外部处方编号';

-- 旧岗位映射回填：admin→OWNER；13800138011(前台护理)→FRONT,CARE
UPDATE sys_user SET positions='OWNER' WHERE user_id=1 AND (positions IS NULL OR positions='');
UPDATE sys_user SET positions='FRONT,CARE' WHERE user_id=2 AND (positions IS NULL OR positions='');
