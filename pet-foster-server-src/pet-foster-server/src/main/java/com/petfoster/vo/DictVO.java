package com.petfoster.vo;

import lombok.Data;

@Data
public class DictVO {
    private String id;
    private String typeCode;
    private String label;
    private String value;
    private Integer sort;
}
