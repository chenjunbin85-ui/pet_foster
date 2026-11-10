package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pet")
public class Pet {
    @TableId(type = IdType.AUTO)
    private Long petId;
    private Long customerId;
    private String name;
    private String breed;
    private String species;
    private String gender;
    private Integer age;
    private BigDecimal weight;
    private String color;
    /** 宠物头像（相对地址 /api/files/xxx，读取由 FileController 放行） */
    private String photoUrl;
    private String vaccine;
    /** 疫苗/驱虫证明照片 */
    private String vaccineProofUrl;
    private String history;
    private LocalDateTime createTime;
}
