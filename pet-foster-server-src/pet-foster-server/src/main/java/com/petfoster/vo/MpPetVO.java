package com.petfoster.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 小程序端宠物档案视图（在 {@link PetVO} 基础上补充编辑锁定状态）。
 * 存在进行中预约（待入店/寄养中）时 locked=true，前端应锁定关键信息仅可补充毛色与备注。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class MpPetVO extends PetVO {

    /** 进行中预约锁定：true 时仅可补充毛色与备注 */
    private boolean locked;
}
