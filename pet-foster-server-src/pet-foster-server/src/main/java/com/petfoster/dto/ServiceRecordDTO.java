package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ServiceRecordDTO {
    @NotNull(message = "订单ID不能为空")
    private Long orderId;
    @NotNull(message = "宠物ID不能为空")
    private Long petId;
    @NotBlank(message = "服务项目不能为空")
    private String serviceName;
    private String description;
    private LocalDateTime serviceTime;
}
