package com.petfoster.enums;

/**
 * 订单状态（替代原数据字典 order_status）
 */
public enum OrderStatus {
    PENDING("待入店"),
    FOSTERING("寄养中"),
    COMPLETED("已完成"),
    CANCELLED("已取消");

    private final String value;

    OrderStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean is(String s) {
        return this.value.equals(s);
    }
}
