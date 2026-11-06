package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 每日巡视日志 */
@Data
@TableName("foster_care_log")
public class FosterCareLog {
    @TableId(type = IdType.AUTO)
    private Long careLogId;
    private Long orderId;
    private Long petId;
    private LocalDate logDate;
    private String shift;
    private String spirit;
    private String appetite;
    private String defecation;
    private String exercise;
    private String coat;
    private BigDecimal temperature;
    private String abnormal;
    private String photoUrls;
    private Long recorderId;
    private String recorderPosition;
    private LocalDateTime recordTime;
}
