package com.petfoster.task;

import com.petfoster.service.MpOrderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 小程序端订单定时任务：每分钟关闭超过支付截止时间的待入店未支付订单。
 *
 * <p>查询侧（列表/详情）也有懒关闭兜底，定时任务保证不访问也会自动关闭。
 */
@Component
public class OrderExpireTask {

    private static final Logger log = LoggerFactory.getLogger(OrderExpireTask.class);

    private final MpOrderService mpOrderService;

    public OrderExpireTask(MpOrderService mpOrderService) {
        this.mpOrderService = mpOrderService;
    }

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void closeExpiredOrders() {
        try {
            mpOrderService.expireOverdue();
        } catch (Exception e) {
            log.warn("关闭超时订单失败：{}", e.getMessage());
        }
    }
}
