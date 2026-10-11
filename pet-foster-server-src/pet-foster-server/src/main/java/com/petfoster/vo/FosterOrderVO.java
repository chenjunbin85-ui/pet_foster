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
    private BigDecimal pricePerDay;
    private BigDecimal totalFee;
    private String status;
    private String remark;
    private String creatorId;
    private LocalDateTime createdAt;
    private String customerName;
    private String petName;
}
