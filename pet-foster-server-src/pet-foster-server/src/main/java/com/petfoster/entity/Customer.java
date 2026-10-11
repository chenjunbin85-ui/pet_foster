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
    private LocalDateTime createTime;
}
