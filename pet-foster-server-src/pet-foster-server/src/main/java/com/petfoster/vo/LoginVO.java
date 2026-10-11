package com.petfoster.vo;

import lombok.Data;

@Data
public class LoginVO {
    private String token;
    private SysUserVO userInfo;
}
