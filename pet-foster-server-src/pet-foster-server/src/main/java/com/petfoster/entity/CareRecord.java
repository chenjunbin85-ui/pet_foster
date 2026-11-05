package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("care_record")
public class CareRecord {
    @TableId(type = IdType.AUTO)
    private Long recordId;
    private Long orderId;
    private Integer day;
    private String type;
    private String content;
    private String imageUrl;
    private LocalDateTime createTime;
    @TableLogic
    private Integer deleted;
}
