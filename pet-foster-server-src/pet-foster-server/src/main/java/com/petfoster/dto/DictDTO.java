package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DictDTO {
    @NotBlank(message = "字典类型编码不能为空")
    private String typeCode;
    @NotBlank(message = "标签不能为空")
    private String label;
    @NotBlank(message = "值不能为空")
    private String value;
    private Integer sort;
}
