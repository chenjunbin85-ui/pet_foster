package com.petfoster.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
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
    @NotNull(message = "请选择寄养价位档位")
    private Long priceId;
    private String remark;
}
