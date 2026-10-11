package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("foster_service_record")
public class ServiceRecord {
    @TableId(type = IdType.AUTO)
    private Long serviceId;
    private Long orderId;
    private Long petId;
    private String item;
    private String content;
    private LocalDateTime serviceTime;
    private Long keeperId;
}
