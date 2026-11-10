package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.MpCareService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.MpCareRecordVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "小程序·照护记录", description = "寄养期间每日巡视（含现场照片）与照护记录")
@RestController
@RequestMapping("/api/mp/orders")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpCareController {

    private final MpCareService mpCareService;

    public MpCareController(MpCareService mpCareService) {
        this.mpCareService = mpCareService;
    }

    @GetMapping("/{orderId}/care")
    @Operation(summary = "照护时间线", description = "仅本人订单；员工端上传的现场照片在此返回")
    public Result<List<MpCareRecordVO>> list(@PathVariable Long orderId) {
        return Result.success(mpCareService.list(orderId, SecurityUtil.getCurrentUserId()));
    }
}
