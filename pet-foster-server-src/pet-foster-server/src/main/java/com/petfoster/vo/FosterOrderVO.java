package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class FosterOrderVO {
    private String id;
    private String orderNo;
    private String customerId;
    private String petId;
    private LocalDate startDate;
    private LocalDate endDate;
    private String priceId;
    private BigDecimal pricePerDay;
    private BigDecimal totalFee;
    private String storeName;
    private String status;
    private String remark;
    private String paymentStatus;
    private String paymentMethod;
    private LocalDateTime paymentTime;
    private BigDecimal paidAmount;
    /** 支付截止时间（小程序端 15 分钟未支付自动关闭） */
    private LocalDateTime expiresAt;
    /** 寄养天数（按天计费：离店-入住+1，同日 1 天） */
    private Integer stayDays;
    /** 计费日数快照 */
    private Integer chargeDays;
    /** 定金金额 */
    private BigDecimal depositFee;
    /** 增值服务金额 */
    private BigDecimal extraFee;
    /** 优惠金额 */
    private BigDecimal discountFee;
    /** 锁定房间ID */
    private String roomId;
    /** 价位档位名称 */
    private String priceLevelName;
    private String creatorId;
    private LocalDateTime createdAt;
    private String customerName;
    private String petName;
}
