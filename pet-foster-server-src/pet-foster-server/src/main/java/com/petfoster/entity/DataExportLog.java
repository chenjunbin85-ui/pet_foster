package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 数据导出留痕 */
@Data
@TableName("data_export_log")
public class DataExportLog {
    @TableId(type = IdType.AUTO)
    private Long exportId;
    private Long operatorId;
    private String purpose;
    private String dataScope;
    private Integer phoneMasked;
    private LocalDateTime createTime;
}
