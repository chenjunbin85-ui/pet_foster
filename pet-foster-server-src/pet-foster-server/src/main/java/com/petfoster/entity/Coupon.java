package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
@TableName("coupon")
public class Coupon {
    @TableId(type = IdType.AUTO)
    private Long couponId;
    private Long customerId;
    private String name;
    private BigDecimal discount;
    private BigDecimal minAmount;
    private String status;
    private LocalDate expireAt;
    private Long orderId;
    @TableLogic
    private Integer deleted;
}
