package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class HealthRecordDTO {
    @NotNull(message = "宠物ID不能为空")
    private Long petId;
    private Long orderId;
    @NotBlank(message = "记录类型不能为空")
    private String type;
    private BigDecimal temperature;
    private String spirit;
    private String appetite;
    private String defecation;
    private String skin;
    private String abnormal;
    private String treatment;
}
