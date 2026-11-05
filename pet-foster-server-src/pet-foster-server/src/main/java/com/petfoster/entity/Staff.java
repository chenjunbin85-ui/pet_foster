package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 工作人员表（staff）：护理员/前台等门店员工账号，独立于管理员表与客户表。
 */
@Data
@TableName("staff")
public class Staff {
    @TableId(type = IdType.AUTO)
    private Long staffId;
    private String username;
    private String password;
    private String realName;
    private String position;
    private Integer status;
    private LocalDateTime createTime;
    private String remark;
}
