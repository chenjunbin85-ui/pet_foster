package com.petfoster.enums;

/**
 * 支付方式（替代原数据字典 payment_method 约定值）
 */
public enum PaymentMethod {
    WECHAT("微信"),
    ALIPAY("支付宝"),
    CASH("现金");

    private final String value;

    PaymentMethod(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }
}
