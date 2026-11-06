package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 寄养房间（物理房位） */
@Data
@TableName("foster_room")
public class FosterRoom {
    @TableId(type = IdType.AUTO)
    private Long roomId;
    private Long storeId;
    private String roomNo;
    private Long priceId;
    private String roomType;
    private Integer capacity;
    private String status;
    private Integer sort;
    private String remark;
    private Integer deleted;
    private LocalDateTime createTime;
}
