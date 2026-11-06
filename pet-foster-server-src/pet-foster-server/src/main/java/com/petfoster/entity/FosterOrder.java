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
    private Long priceId;
    private BigDecimal pricePerDay;
    private BigDecimal totalFee;
    private Long storeId;
    private String status;
    private String remark;
    private String paymentStatus;
    private String paymentMethod;
    private LocalDateTime paymentTime;
    private BigDecimal paidAmount;
    /** 支付截止时间（下单后 15 分钟未支付自动关闭） */
    private LocalDateTime expiresAt;
    private Long creatorId;
    private LocalDateTime createTime;
    @TableLogic
    private Integer deleted;

    /** 计费日数（含离店日，快照） */
    private Integer chargeDays;
    /** 定金金额 */
    private BigDecimal depositFee;
    /** 优惠金额 */
    private BigDecimal discountFee;
    /** 增值服务金额 */
    private BigDecimal extraFee;
    /** 锁定房间ID */
    private Long roomId;
    /** 实际入店时间 */
    private LocalDateTime checkInTime;
    /** 实际离店时间 */
    private LocalDateTime checkOutTime;
}
