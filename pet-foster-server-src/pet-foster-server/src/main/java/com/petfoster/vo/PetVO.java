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
    /** 宠物头像：/api/files/xxx（前端按各自 BASE_URL 拼绝对地址） */
    private String photoUrl;
    private String vaccine;
    /** 疫苗可读文案（小程序端展示用，JSON 疫苗解析为「狂犬疫苗 · 2026-06」） */
    private String vaccineText;
    /** 疫苗/驱虫证明照片 */
    private String vaccineProofUrl;
    private String history;
    private LocalDateTime createdAt;
}
