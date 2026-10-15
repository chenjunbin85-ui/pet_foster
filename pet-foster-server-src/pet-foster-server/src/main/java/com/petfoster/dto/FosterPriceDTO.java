package com.petfoster.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class FosterPriceDTO {
    @NotBlank(message = "档位名称不能为空")
    private String levelName;
    @NotNull(message = "单日价格不能为空")
    @DecimalMin(value = "0.01", message = "单日价格必须大于0")
    private BigDecimal pricePerDay;
    private Integer status;
    private Integer sort;
    private String remark;
}
