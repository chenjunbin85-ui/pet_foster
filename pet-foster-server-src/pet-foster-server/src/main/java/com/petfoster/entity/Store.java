package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("store")
public class Store {
    @TableId(type = IdType.AUTO)
    private Long storeId;
    private String name;
    private String address;
    private String phone;
    private String openHours;
    private String status;
    @TableLogic
    private Integer deleted;
}
