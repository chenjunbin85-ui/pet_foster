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
    private String gender;
    private Integer age;
    private BigDecimal weight;
    private String color;
    private String vaccine;
    private String history;
    private LocalDateTime createTime;
}
