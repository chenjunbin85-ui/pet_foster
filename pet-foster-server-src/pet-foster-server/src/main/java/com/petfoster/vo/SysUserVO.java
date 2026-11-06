package com.petfoster.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SysUserVO {
    private String id;
    private String username;
    private String name;
    private String role;
    private String position;
    /** 归一化岗位代码，逗号分隔；admin 固定 OWNER。员工端页面鉴权以此为准 */
    private String positions;
    private String status;
    private String remark;
    private LocalDateTime createdAt;
}
