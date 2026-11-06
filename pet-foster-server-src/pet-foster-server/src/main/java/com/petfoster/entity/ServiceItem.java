package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 增值服务价目表 */
@Data
@TableName("service_item")
public class ServiceItem {
    @TableId(type = IdType.AUTO)
    private Long serviceId;
    private String serviceCode;
    private String serviceName;
    /** day/once */
    private String unitType;
    private BigDecimal price;
    private Integer status;
    private Integer sort;
    private String remark;
    private LocalDateTime createTime;
}
