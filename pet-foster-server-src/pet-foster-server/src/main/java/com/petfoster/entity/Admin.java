package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 管理员表（sys_admin）：门店管理员账号，独立于工作人员表与客户表。
 */
@Data
@TableName("sys_admin")
public class Admin {
    @TableId(type = IdType.AUTO)
    private Long adminId;
    private String username;
    private String password;
    private String realName;
    private Integer status;
    private LocalDateTime createTime;
    private String remark;
}
