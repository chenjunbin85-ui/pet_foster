package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CustomerDTO {
    @NotBlank(message = "客户姓名不能为空")
    private String name;
    private String phone;
    private String address;
    private String remark;
}
