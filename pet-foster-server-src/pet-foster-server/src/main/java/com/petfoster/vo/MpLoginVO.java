package com.petfoster.vo;

import lombok.Data;

/** 小程序端客户登录结果 */
@Data
public class MpLoginVO {
    private String token;
    private CustomerVO customer;
}
