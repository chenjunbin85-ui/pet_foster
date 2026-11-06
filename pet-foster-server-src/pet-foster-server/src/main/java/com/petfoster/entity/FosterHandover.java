package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 入离店交接单 */
@Data
@TableName("foster_handover")
public class FosterHandover {
    @TableId(type = IdType.AUTO)
    private Long handoverId;
    private Long orderId;
    private String type;
    private String checkItems;
    private BigDecimal weight;
    private String photoUrls;
    private String belongings;
    private Integer customerSign;
    private Long signerId;
    private String signerPosition;
    private LocalDateTime handoverTime;
    private String remark;
    private LocalDateTime createTime;
}
