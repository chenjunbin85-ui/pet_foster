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
    /** 记录人岗位快照 */
    private String recorderPosition;
    /** 复核兽医 staff_id（L2 处置 / L3 签署） */
    private Long verifiedBy;
    private LocalDateTime verifiedAt;
    /** 外部处方编号，系统不存处方内容 */
    private String prescriptionRef;
}
