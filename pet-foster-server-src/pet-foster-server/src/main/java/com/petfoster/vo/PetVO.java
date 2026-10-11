package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class PetVO {
    private String id;
    private String customerId;
    private String name;
    private String breed;
    private String gender;
    private Integer age;
    private BigDecimal weight;
    private String color;
    private String vaccine;
    private String history;
    private LocalDateTime createdAt;
}
