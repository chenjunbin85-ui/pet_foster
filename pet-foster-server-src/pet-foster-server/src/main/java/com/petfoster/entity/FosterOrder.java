package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("foster_order")
public class FosterOrder {
    @TableId(type = IdType.AUTO)
    private Long orderId;
    private String orderNo;
    private Long customerId;
    private Long petId;
    private LocalDate startDate;
    private LocalDate endDate;
    private BigDecimal pricePerDay;
    private BigDecimal totalFee;
    private String status;
    private String remark;
    private Long creatorId;
    private LocalDateTime createTime;
}
