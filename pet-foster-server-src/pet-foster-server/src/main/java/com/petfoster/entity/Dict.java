package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

@Data
@TableName("sys_dict")
public class Dict {
    @TableId(type = IdType.AUTO)
    private Long dictId;
    private String typeCode;
    private String label;
    private String value;
    private Integer sort;
}
