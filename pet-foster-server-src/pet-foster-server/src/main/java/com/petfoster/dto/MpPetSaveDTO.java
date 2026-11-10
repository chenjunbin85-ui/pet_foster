package com.petfoster.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

/** 小程序端宠物档案保存请求（customerId 由登录态强制，不允许前端指定） */
@Data
public class MpPetSaveDTO {

    @NotBlank(message = "宠物昵称不能为空")
    @Size(max = 20, message = "宠物昵称不能超过20字")
    private String name;

    @Size(max = 30, message = "品种不能超过30字")
    private String breed;

    @NotBlank(message = "请选择性别")
    private String gender;

    @Min(value = 0, message = "年龄需在0-40周岁之间")
    @Max(value = 40, message = "年龄需在0-40周岁之间")
    private Integer age;

    private BigDecimal weight;

    @Size(max = 50, message = "毛色不能超过50字")
    private String color;

    /** 宠物头像：上传接口返回的 /api/files/xxx 地址 */
    @Size(max = 500, message = "头像地址过长")
    private String photoUrl;

    /** 疫苗 JSON：{"status":"已接种","name":"狂犬疫苗","date":"2026-03"} */
    private String vaccine;

    /** 疫苗/驱虫证明照片 */
    @Size(max = 500, message = "证明照片地址过长")
    private String vaccineProofUrl;

    @Size(max = 255, message = "备注不能超过255字")
    private String history;
}
