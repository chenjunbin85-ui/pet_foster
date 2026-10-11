package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sys_user")
public class SysUser {
    @TableId(type = IdType.AUTO)
    private Long userId;
    private String username;
    private String password;
    private String realName;
    private String role;
    private Integer status;
    private LocalDateTime createTime;
    private String remark;
}
