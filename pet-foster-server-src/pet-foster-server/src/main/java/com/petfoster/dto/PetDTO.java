package com.petfoster.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class PetDTO {
    @NotNull(message = "客户ID不能为空")
    private Long customerId;
    @NotBlank(message = "宠物名称不能为空")
    private String name;
    private String breed;
    private String gender;
    private Integer age;
    private BigDecimal weight;
    private String color;
    /** 宠物头像：上传接口返回的 /api/files/xxx 地址 */
    private String photoUrl;
    private String vaccine;
    /** 疫苗/驱虫证明照片 */
    private String vaccineProofUrl;
    private String history;
}
