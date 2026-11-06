package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;

/** 员工资质（v3_prd_expansion.sql: staff_cert）。执业兽医证过期即收回签署权。 */
@Data
@TableName("staff_cert")
public class StaffCert {
    @TableId(type = IdType.AUTO)
    private Long certId;
    private Long staffId;
    private String certType;
    private String certNo;
    private LocalDate validFrom;
    private LocalDate validTo;
    private String imageUrl;
    @TableLogic
    private Integer deleted;
}
