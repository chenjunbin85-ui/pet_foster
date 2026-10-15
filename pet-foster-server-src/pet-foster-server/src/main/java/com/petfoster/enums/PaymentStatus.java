package com.petfoster.enums;

/**
 * 支付状态（替代原数据字典 payment_status 约定值）
 */
public enum PaymentStatus {
    UNPAID("未支付"),
    PAID("已支付");

    private final String value;

    PaymentStatus(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public boolean is(String s) {
        return this.value.equals(s);
    }
}
