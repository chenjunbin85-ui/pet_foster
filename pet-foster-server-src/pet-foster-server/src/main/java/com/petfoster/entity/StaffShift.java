package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 排班表：模块暂不实现，仅用于「兽医当日在岗」判定（PRD FR-12）。 */
@Data
@TableName("staff_shift")
public class StaffShift {
    @TableId(type = IdType.AUTO)
    private Long shiftId;
    private Long staffId;
    private LocalDate shiftDate;
    private String shiftType;
    private String duty;
    private String remark;
    private LocalDateTime createTime;
}
