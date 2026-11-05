package com.petfoster.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.Result;
import com.petfoster.entity.CareRecord;
import com.petfoster.mapper.CareRecordMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "小程序·照护记录", description = "寄养期间每日照片/饮食/活动/健康记录")
@RestController
@RequestMapping("/api/mp/orders")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpCareController {

    private final CareRecordMapper careRecordMapper;

    public MpCareController(CareRecordMapper careRecordMapper) {
        this.careRecordMapper = careRecordMapper;
    }

    @GetMapping("/{orderId}/care")
    public Result<List<CareRecord>> list(@PathVariable Long orderId) {
        List<CareRecord> records = careRecordMapper.selectList(
                new LambdaQueryWrapper<CareRecord>()
                        .eq(CareRecord::getOrderId, orderId)
                        .orderByAsc(CareRecord::getDay)
                        .orderByAsc(CareRecord::getRecordId));
        return Result.success(records);
    }
}
