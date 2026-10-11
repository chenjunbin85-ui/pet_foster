package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("sys_oper_log")
public class OperLog {
    @TableId(type = IdType.AUTO)
    private Long logId;
    private Long userId;
    private String module;
    private String content;
    private LocalDateTime requestTime;
    private String ip;
}
