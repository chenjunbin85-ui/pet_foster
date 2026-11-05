package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.MpOrderCreateDTO;
import com.petfoster.service.MpOrderService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.FosterOrderVO;
import com.petfoster.vo.MpStatsVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** 小程序端寄养订单接口（毛球旅馆用户端，仅本人订单） */
@Tag(name = "小程序·寄养订单", description = "下单、我的订单、演示支付、取消、个人统计")
@RestController
@RequestMapping("/api/mp/orders")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpOrderController {

    private final MpOrderService mpOrderService;

    public MpOrderController(MpOrderService mpOrderService) {
        this.mpOrderService = mpOrderService;
    }

    @GetMapping
    public Result<PageResult<FosterOrderVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return Result.success(mpOrderService.list(SecurityUtil.getCurrentUserId(), page, size, status, keyword));
    }

    @GetMapping("/{id}")
    public Result<FosterOrderVO> detail(@PathVariable Long id) {
        return Result.success(mpOrderService.getDetail(id, SecurityUtil.getCurrentUserId()));
    }

    @PostMapping
    public Result<FosterOrderVO> create(@Valid @RequestBody MpOrderCreateDTO dto) {
        return Result.success(mpOrderService.create(dto, SecurityUtil.getCurrentUserId()));
    }

    /** 演示支付：模拟微信支付成功，不产生真实扣款 */
    @PostMapping("/{id}/pay")
    public Result<FosterOrderVO> pay(@PathVariable Long id) {
        return Result.success(mpOrderService.pay(id, SecurityUtil.getCurrentUserId()));
    }

    /** 取消订单：未支付直接取消；已支付走演示退款 */
    @PostMapping("/{id}/cancel")
    public Result<FosterOrderVO> cancel(@PathVariable Long id) {
        return Result.success(mpOrderService.cancel(id, SecurityUtil.getCurrentUserId()));
    }

    /** 个人中心统计：待入店/寄养中/已完成/累计寄养 */
    @GetMapping("/stats")
    public Result<MpStatsVO> stats() {
        return Result.success(mpOrderService.stats(SecurityUtil.getCurrentUserId()));
    }
}
