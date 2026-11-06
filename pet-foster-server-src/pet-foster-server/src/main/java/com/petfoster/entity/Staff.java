package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * 工作人员表（staff）：护理员/前台等门店员工账号，独立于管理员表与客户表。
 */
@Data
@TableName("staff")
public class Staff {
    @TableId(type = IdType.AUTO)
    private Long staffId;
    private String username;
    private String password;
    private String realName;
    /** 旧列：单值岗位（自由文本 / 代码），仅作兼容与展示 */
    private String position;
    /** 新列：多岗位，逗号分隔代码 OWNER/FRONT/CARE/VET/GROOM/DRIVER；空值即无敏感权限 */
    private String positions;
    private Integer status;
    private LocalDateTime createTime;
    private String remark;
}
