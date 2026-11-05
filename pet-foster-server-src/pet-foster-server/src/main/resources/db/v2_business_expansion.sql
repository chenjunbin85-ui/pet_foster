-- 业务扩展：门店 / 优惠券 / 评价 / 照护记录
CREATE TABLE IF NOT EXISTS store (
  store_id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  address VARCHAR(200),
  phone VARCHAR(20),
  open_hours VARCHAR(50),
  status VARCHAR(20) DEFAULT 'ENABLED',
  deleted INT DEFAULT 0,
  PRIMARY KEY (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS coupon (
  coupon_id BIGINT NOT NULL AUTO_INCREMENT,
  customer_id BIGINT NOT NULL,
  name VARCHAR(50) NOT NULL,
  discount DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'UNUSED',
  expire_at DATE,
  order_id BIGINT NULL,
  deleted INT DEFAULT 0,
  PRIMARY KEY (coupon_id),
  KEY idx_customer (customer_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS review (
  review_id BIGINT NOT NULL AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  customer_id BIGINT NOT NULL,
  pet_id BIGINT NULL,
  rating INT NOT NULL DEFAULT 5,
  content VARCHAR(500),
  create_time DATETIME,
  deleted INT DEFAULT 0,
  PRIMARY KEY (review_id),
  UNIQUE KEY uk_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS care_record (
  record_id BIGINT NOT NULL AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  day INT NOT NULL DEFAULT 1,
  type VARCHAR(20) NOT NULL,
  content VARCHAR(500),
  image_url VARCHAR(255),
  create_time DATETIME,
  deleted INT DEFAULT 0,
  PRIMARY KEY (record_id),
  KEY idx_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单关联门店
ALTER TABLE foster_order ADD COLUMN IF NOT EXISTS store_id BIGINT NULL;

-- 演示数据
INSERT INTO store (name, address, phone, open_hours) VALUES
  ('毛球旅馆·西湖总店', '杭州市西湖区毛球路 16 号（演示地址）', '400-080-6060', '09:00–21:00')
ON DUPLICATE KEY UPDATE name=name;
