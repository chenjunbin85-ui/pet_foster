package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class HealthRecordVO {
    private String id;
    private String petId;
    private String orderId;
    private String type;
    private BigDecimal temperature;
    private String spirit;
    private String appetite;
    private String defecation;
    private String skin;
    private String abnormal;
    private String treatment;
    private String recorderId;
    private String recorder;
    private LocalDateTime recordTime;
}
