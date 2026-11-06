package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

/** 业务规则配置（金额公式不写死代码） */
@Data
@TableName("biz_rule")
public class BizRule {
    @TableId(type = IdType.AUTO)
    private Long ruleId;
    private String ruleKey;
    private String ruleValue;
    private String unit;
    private LocalDate effectiveFrom;
    private String remark;
}
