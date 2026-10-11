package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SysUserDTO {
    @NotBlank(message = "用户名不能为空")
    private String username;
    private String password;
    @NotBlank(message = "真实姓名不能为空")
    private String realName;
    private String role;
    private Integer status;
    private String remark;
}
