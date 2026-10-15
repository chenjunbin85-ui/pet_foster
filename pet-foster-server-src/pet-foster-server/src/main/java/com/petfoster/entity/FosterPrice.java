package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("foster_price")
public class FosterPrice {
    @TableId(type = IdType.AUTO)
    private Long priceId;
    private String levelName;
    private BigDecimal pricePerDay;
    private Integer status;
    private Integer sort;
    private String remark;
    private LocalDateTime createTime;
}
