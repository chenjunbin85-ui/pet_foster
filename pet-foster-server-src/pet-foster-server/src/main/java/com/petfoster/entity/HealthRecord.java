package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pet_health_record")
public class HealthRecord {
    @TableId(type = IdType.AUTO)
    private Long recordId;
    private Long petId;
    private Long orderId;
    private String type;
    private BigDecimal temperature;
    private String spirit;
    private String appetite;
    private String defecation;
    private String skin;
    private String abnormal;
    private String treatment;
    private Long recorderId;
    private LocalDateTime recordTime;
}
