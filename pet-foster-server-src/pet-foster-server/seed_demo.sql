-- 演示优惠券：客户1 新用户首单立减
INSERT INTO coupon (customer_id, name, discount, min_amount, status, expire_at)
SELECT 1, '新用户首单立减', 20.00, 0.00, 'UNUSED', '2026-12-31'
WHERE NOT EXISTS (SELECT 1 FROM coupon WHERE customer_id=1 AND status='UNUSED');

-- 演示照护记录：订单5（寄养中）3 天
INSERT INTO care_record (order_id, day, type, content, create_time)
SELECT 5, 1, 'PHOTO', '早上交接完成，豆豆精神好，吃了 200g 粮。', '2026-10-26 10:30:00'
WHERE NOT EXISTS (SELECT 1 FROM care_record WHERE order_id=5 AND day=1);
INSERT INTO care_record (order_id, day, type, content, create_time)
SELECT 5, 2, 'ACTIVITY', '下午遛弯 30 分钟，社交良好，无异常。', '2026-10-27 15:00:00'
WHERE NOT EXISTS (SELECT 1 FROM care_record WHERE order_id=5 AND day=2);
INSERT INTO care_record (order_id, day, type, content, create_time)
SELECT 5, 3, 'HEALTH', '体温正常，毛发干净，食欲佳。', '2026-10-28 09:00:00'
WHERE NOT EXISTS (SELECT 1 FROM care_record WHERE order_id=5 AND day=3);
