package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 订单账单明细（房费/增值/医疗/超时/赔偿/定金/优惠逐条落账） */
@Data
@TableName("foster_bill_item")
public class FosterBillItem {
    @TableId(type = IdType.AUTO)
    private Long itemId;
    private Long orderId;
    private String itemCode;
    private String itemName;
    private String itemType;
    private BigDecimal unitPrice;
    private BigDecimal quantity;
    private BigDecimal amount;
    private String source;
    private String status;
    private String remark;
    private LocalDateTime createTime;
}
