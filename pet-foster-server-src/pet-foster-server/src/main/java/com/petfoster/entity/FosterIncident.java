package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 异常事件 */
@Data
@TableName("foster_incident")
public class FosterIncident {
    @TableId(type = IdType.AUTO)
    private Long incidentId;
    private Long orderId;
    private Long petId;
    private LocalDateTime occurTime;
    private String category;
    private String description;
    private String action;
    private Integer notifyCustomer;
    private LocalDateTime notifyTime;
    private String notifyChannel;
    private Integer needVet;
    private Long vetAuthorizedBy;
    private LocalDateTime vetAuthorizedAt;
    private String vetHospital;
    private BigDecimal cost;
    private String status;
    private String closeNote;
    /** 现场照片 URL，逗号分隔，最多 6 张 */
    private String photoUrls;
    private Long recorderId;
    private LocalDateTime createTime;
}
