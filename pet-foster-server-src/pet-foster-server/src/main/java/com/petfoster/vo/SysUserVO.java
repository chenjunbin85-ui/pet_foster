package com.petfoster.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SysUserVO {
    private String id;
    private String username;
    private String name;
    private String role;
    private String status;
    private String remark;
    private LocalDateTime createdAt;
}
