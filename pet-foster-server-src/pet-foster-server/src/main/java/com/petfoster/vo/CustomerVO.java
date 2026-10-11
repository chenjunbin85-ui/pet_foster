package com.petfoster.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class CustomerVO {
    private String id;
    private String name;
    private String phone;
    private String address;
    private String remark;
    private LocalDateTime createdAt;
}
