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
    /** 疫苗可读文案（小程序端展示用，JSON 疫苗解析为「狂犬疫苗 · 2026-06」） */
    private String vaccineText;
    private String history;
    private LocalDateTime createdAt;
}
