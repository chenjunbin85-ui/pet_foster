package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("customer")
public class Customer {
    @TableId(type = IdType.AUTO)
    private Long customerId;
    private String name;
    private String phone;
    private String address;
    private String remark;
    /** 小程序登录账号（手机号） */
    private String username;
    /** 密码（BCrypt 加密） */
    private String password;
    /** 状态: 0禁用 1启用 */
    private Integer status;
    /** 最后登录时间 */
    private LocalDateTime lastLoginTime;
    private LocalDateTime createTime;
}
