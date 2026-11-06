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
    /** 现场动作类型：CARE_RECORD / GROOM_LOG / PICKUP_HANDOVER / REDEEM */
    private String recordType;
    /** 现场照片 URL，逗号分隔，最多 6 张 */
    private String photoUrls;
    /** 记录人岗位快照（调岗不改历史） */
    private String recorderPosition;
}
