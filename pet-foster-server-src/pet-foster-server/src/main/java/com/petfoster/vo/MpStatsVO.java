package com.petfoster.vo;

import lombok.Data;

/** 小程序端个人中心统计 */
@Data
public class MpStatsVO {

    /** 待入店 */
    private long pending;
    /** 寄养中 */
    private long fostering;
    /** 已完成 */
    private long completed;
    /** 累计寄养（= 寄养中 + 已完成） */
    private long cumulative;

    public MpStatsVO(long pending, long fostering, long completed) {
        this.pending = pending;
        this.fostering = fostering;
        this.completed = completed;
        this.cumulative = fostering + completed;
    }
}
