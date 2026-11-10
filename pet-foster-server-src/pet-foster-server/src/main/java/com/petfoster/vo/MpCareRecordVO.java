package com.petfoster.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 顾客端「每日照护记录」视图：把员工现场提交的巡视日志（含照片）与历史照顾记录合并成一条时间线。
 *
 * <p>photos 内为上传接口返回的相对地址（/api/files/xxx），客户端按自身 BASE_URL 拼绝对地址。
 */
@Data
public class MpCareRecordVO {

    private String recordId;
    /** 寄养第几天（入住日 = 第 1 天） */
    private Integer day;
    /** PHOTO / DIET / ACTIVITY / HEALTH / 巡视 */
    private String type;
    private String content;
    /** 兼容旧字段：首张照片 */
    private String imageUrl;
    /** 本条记录的全部照片（最多 6 张） */
    private List<String> photos;
    /** 巡视班次：早 / 中 / 晚 */
    private String shift;
    private String recorderPosition;
    private LocalDateTime recordTime;
}
