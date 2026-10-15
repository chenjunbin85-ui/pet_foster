-- ============================================
-- 宠物寄养登记与健康档案管理系统 建表脚本
-- ============================================

CREATE DATABASE IF NOT EXISTS pet_foster DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pet_foster;

-- 1. 系统用户表
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    user_id     BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID',
    username    VARCHAR(50) NOT NULL UNIQUE COMMENT '用户名',
    password    VARCHAR(255) NOT NULL COMMENT '密码(BCrypt加密)',
    real_name   VARCHAR(50) NOT NULL COMMENT '真实姓名',
    role        VARCHAR(20) NOT NULL DEFAULT 'staff' COMMENT '角色: admin/staff',
    status      TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0禁用 1启用',
    create_time DATETIME COMMENT '创建时间',
    remark      VARCHAR(255) COMMENT '备注'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 2. 客户表
DROP TABLE IF EXISTS customer;
CREATE TABLE customer (
    customer_id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '客户ID',
    name        VARCHAR(50) NOT NULL COMMENT '客户姓名',
    phone       VARCHAR(20) COMMENT '联系电话',
    address     VARCHAR(255) COMMENT '地址',
    remark      VARCHAR(255) COMMENT '备注',
    create_time DATETIME COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='客户表';

-- 3. 宠物档案表
DROP TABLE IF EXISTS pet;
CREATE TABLE pet (
    pet_id      BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '宠物ID',
    customer_id BIGINT NOT NULL COMMENT '所属客户ID',
    name        VARCHAR(50) NOT NULL COMMENT '宠物名称',
    breed       VARCHAR(50) COMMENT '品种',
    gender      VARCHAR(10) COMMENT '性别: 公/母',
    age         INT COMMENT '年龄',
    weight      DECIMAL(6,2) COMMENT '体重(kg)',
    color       VARCHAR(50) COMMENT '颜色',
    vaccine     VARCHAR(255) COMMENT '疫苗情况',
    history     TEXT COMMENT '病史',
    create_time DATETIME COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物档案表';

-- 4. 寄养订单表
DROP TABLE IF EXISTS foster_order;
CREATE TABLE foster_order (
    order_id       BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '订单ID',
    order_no       VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号 FO+yyyyMMdd+3位序号',
    customer_id    BIGINT NOT NULL COMMENT '客户ID',
    pet_id         BIGINT NOT NULL COMMENT '宠物ID',
    start_date     DATE NOT NULL COMMENT '寄养开始日期',
    end_date       DATE NOT NULL COMMENT '寄养结束日期',
    price_id       BIGINT COMMENT '价位档位ID',
    price_per_day  DECIMAL(10,2) NOT NULL COMMENT '单日寄养单价(下单时价格快照)',
    total_fee      DECIMAL(10,2) COMMENT '总费用',
    status         VARCHAR(20) NOT NULL DEFAULT '待入店' COMMENT '状态: 待入店/寄养中/已完成/已取消',
    remark         VARCHAR(255) COMMENT '备注',
    payment_status VARCHAR(20) DEFAULT '未支付' COMMENT '支付状态: 未支付/已支付',
    payment_method VARCHAR(20) COMMENT '支付方式: 微信/支付宝/现金',
    payment_time   DATETIME COMMENT '支付时间',
    paid_amount    DECIMAL(10,2) COMMENT '实付金额',
    creator_id     BIGINT COMMENT '创建人ID',
    create_time    DATETIME COMMENT '创建时间',
    deleted        TINYINT NOT NULL DEFAULT 0 COMMENT '逻辑删除: 0正常 1已删除(页面不显示)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='寄养订单表';

-- 4.1 寄养价位档位表（管理员维护，订单关联引用）
DROP TABLE IF EXISTS foster_price;
CREATE TABLE foster_price (
    price_id      BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '价位ID',
    level_name    VARCHAR(50) NOT NULL COMMENT '档位名称(房型/服务等级)',
    price_per_day DECIMAL(10,2) NOT NULL COMMENT '单日寄养价格(元/天)',
    status        TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0停用 1启用',
    sort          INT DEFAULT 0 COMMENT '排序',
    remark        VARCHAR(255) COMMENT '备注',
    create_time   DATETIME COMMENT '创建时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='寄养价位档位表';

-- 5. 宠物健康记录表
DROP TABLE IF EXISTS pet_health_record;
CREATE TABLE pet_health_record (
    record_id   BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID',
    pet_id      BIGINT NOT NULL COMMENT '宠物ID',
    order_id    BIGINT COMMENT '关联订单ID(可空)',
    type        VARCHAR(20) NOT NULL COMMENT '记录类型: 入店记录/寄养观测记录/离店记录',
    temperature DECIMAL(4,1) COMMENT '体温(℃)',
    spirit      VARCHAR(50) COMMENT '精神状态',
    appetite    VARCHAR(50) COMMENT '食欲',
    defecation  VARCHAR(50) COMMENT '排便情况',
    skin        VARCHAR(100) COMMENT '皮肤状况',
    abnormal    VARCHAR(255) COMMENT '异常情况',
    treatment   VARCHAR(255) COMMENT '处理措施',
    recorder_id BIGINT COMMENT '记录人ID',
    record_time DATETIME COMMENT '记录时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='宠物健康记录表';

-- 6. 寄养服务记录表
DROP TABLE IF EXISTS foster_service_record;
CREATE TABLE foster_service_record (
    service_id   BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '服务记录ID',
    order_id     BIGINT NOT NULL COMMENT '订单ID',
    pet_id       BIGINT NOT NULL COMMENT '宠物ID',
    item         VARCHAR(100) NOT NULL COMMENT '服务项目',
    content      TEXT COMMENT '服务内容描述',
    service_time DATETIME COMMENT '服务时间',
    keeper_id    BIGINT COMMENT '看护人ID'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='寄养服务记录表';

-- ============================================
-- 初始数据
-- ============================================

-- 用户: admin/admin123, staff01/staff123
INSERT INTO sys_user (username, password, real_name, role, status, create_time, remark) VALUES
('admin', '$2b$10$JTOsPJJdw7U5wDLXUvVrhuHRx/WFbx6.EUL6XWSzetTnfkndW/2RW', '系统管理员', 'admin', 1, NOW(), '超级管理员'),
('staff01', '$2b$10$hInT5h4a.QafYiywEVdkIu59sQ16IS6p6ty9po4wSRjfxnGsVa7my', '张护理', 'staff', 1, NOW(), '前台护理员');

-- 数据字典已移除：订单状态、宠物性别等枚举由系统代码/前端固定定义
-- 寄养价位档位初始数据（管理员可在系统管理中修改）
INSERT INTO foster_price (level_name, price_per_day, status, sort, remark, create_time) VALUES
('标准间', 60.00, 1, 1, '基础寄养房型', NOW()),
('舒适间', 80.00, 1, 2, '宽敞房型', NOW()),
('豪华间', 120.00, 1, 3, '豪华房型', NOW());

-- 示例客户
INSERT INTO customer (name, phone, address, remark, create_time) VALUES
('李小明', '13800138001', '泉州市丰泽区东湖街道1号', '老客户', NOW()),
('王小红', '13900139002', '泉州市鲤城区中山中路20号', NULL, NOW()),
('张伟', '13700137003', '泉州市洛江区万安街道5号', NULL, NOW());

-- 示例宠物
INSERT INTO pet (customer_id, name, breed, gender, age, weight, color, vaccine, history, create_time) VALUES
(1, '豆豆', '金毛寻回犬', '公', 3, 25.50, '金色', '狂犬疫苗已接种', '无', NOW()),
(1, '咪咪', '英国短毛猫', '母', 2, 4.20, '灰色', '猫三联已接种', '无', NOW()),
(2, '旺财', '柯基犬', '公', 1, 12.80, '黄白', '狂犬疫苗已接种', '轻度皮肤病已治愈', NOW()),
(3, '雪球', '萨摩耶', '母', 4, 20.00, '白色', '狂犬疫苗+六联已接种', '无', NOW());

-- 示例订单（price_id 关联价位档位；price_per_day 为下单时价格快照）
INSERT INTO foster_order (order_no, customer_id, pet_id, start_date, end_date, price_id, price_per_day, total_fee, status, remark, creator_id, create_time) VALUES
('FO20261001001', 1, 1, '2026-10-01', '2026-10-07', 2, 80.00, 560.00, '已完成', '国庆寄养', 1, '2026-10-01 09:00:00'),
('FO20261008001', 2, 3, '2026-10-08', '2026-10-15', 1, 60.00, 420.00, '寄养中', '短期寄养', 1, '2026-10-08 10:30:00'),
('FO20261009001', 3, 4, '2026-10-09', '2026-10-20', NULL, 100.00, 1200.00, '待入店', '已预订(历史快照)', 1, '2026-10-09 14:00:00');

-- 示例健康记录
INSERT INTO pet_health_record (pet_id, order_id, type, temperature, spirit, appetite, defecation, skin, abnormal, treatment, recorder_id, record_time) VALUES
(1, 1, '入店记录', 38.5, '良好', '正常', '正常', '毛发光泽', '无', '无需处理', 2, '2026-10-01 09:30:00'),
(1, 1, '寄养观测记录', 38.7, '良好', '正常', '正常', '正常', '无', '无需处理', 2, '2026-10-03 10:00:00'),
(3, 2, '入店记录', 38.6, '活泼', '正常', '正常', '无异常', '无', '无需处理', 2, '2026-10-08 11:00:00');

-- 示例服务记录
INSERT INTO foster_service_record (order_id, pet_id, item, content, service_time, keeper_id) VALUES
(1, 1, '洗澡', '金毛全身清洗吹干', '2026-10-02 15:00:00', 2),
(1, 1, '遛弯', '户外遛弯30分钟', '2026-10-03 08:00:00', 2),
(2, 3, '喂食', '每日两餐，狗粮适量', '2026-10-08 18:00:00', 2);
