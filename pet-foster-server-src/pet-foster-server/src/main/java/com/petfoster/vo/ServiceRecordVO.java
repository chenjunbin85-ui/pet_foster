package com.petfoster.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ServiceRecordVO {
    private String id;
    private String orderId;
    private String petId;
    private String serviceName;
    private String description;
    private LocalDateTime serviceTime;
    private String keeperId;
    private String keeper;
}
