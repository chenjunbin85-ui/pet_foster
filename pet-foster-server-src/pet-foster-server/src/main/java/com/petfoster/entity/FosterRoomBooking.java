package com.petfoster.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 房间占用（一条订单一条，区间半开 [occupyStart, occupyEnd)） */
@Data
@TableName("foster_room_booking")
public class FosterRoomBooking {
    @TableId(type = IdType.AUTO)
    private Long bookingId;
    private Long roomId;
    private Long orderId;
    private LocalDate occupyStart;
    private LocalDate occupyEnd;
    /** 锁定/占用/释放 */
    private String status;
    private LocalDateTime createTime;
}
