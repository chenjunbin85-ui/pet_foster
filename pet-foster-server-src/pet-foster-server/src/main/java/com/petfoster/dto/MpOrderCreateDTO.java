package com.petfoster.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/** 小程序端下单请求 */
@Data
public class MpOrderCreateDTO {

    @NotNull(message = "宠物不能为空")
    private Long petId;

    @NotNull(message = "请选择寄养价位档位")
    private Long priceId;

    private Long storeId;

    private Long couponId;

    @NotNull(message = "入住日期不能为空")
    private LocalDate startDate;

    @NotNull(message = "离店日期不能为空")
    private LocalDate endDate;

    @Size(max = 255, message = "备注不能超过255字")
    private String remark;
}
