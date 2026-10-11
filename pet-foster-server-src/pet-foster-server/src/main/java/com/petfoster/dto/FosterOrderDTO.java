package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class FosterOrderDTO {
    @NotNull(message = "客户ID不能为空")
    private Long customerId;
    @NotNull(message = "宠物ID不能为空")
    private Long petId;
    @NotNull(message = "开始日期不能为空")
    private LocalDate startDate;
    @NotNull(message = "结束日期不能为空")
    private LocalDate endDate;
    @NotNull(message = "单日寄养单价不能为空")
    private BigDecimal pricePerDay;
    private String remark;
}
