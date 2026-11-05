package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("review")
public class Review {
    @TableId(type = IdType.AUTO)
    private Long reviewId;
    private Long orderId;
    private Long customerId;
    private Long petId;
    private Integer rating;
    private String content;
    private LocalDateTime createTime;
    @TableLogic
    private Integer deleted;
}
