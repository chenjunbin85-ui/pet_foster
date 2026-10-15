package com.petfoster.enums;

/**
 * 宠物性别（替代原数据字典 pet_gender）
 */
public enum PetGender {
    MALE("公"),
    FEMALE("母");

    private final String value;

    PetGender(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static boolean isValid(String s) {
        if (s == null || s.isEmpty()) {
            return false;
        }
        for (PetGender g : values()) {
            if (g.value.equals(s)) {
                return true;
            }
        }
        return false;
    }

    /** 校验并抛业务异常（空值视为未填写，不拦截） */
    public static void checkGender(String s) {
        if (s == null || s.isEmpty()) {
            return;
        }
        if (!isValid(s)) {
            throw new com.petfoster.common.BusinessException("宠物性别只能是：公/母");
        }
    }
}
