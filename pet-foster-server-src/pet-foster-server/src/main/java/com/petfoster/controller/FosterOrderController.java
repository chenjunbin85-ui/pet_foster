package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.enums.PaymentMethod;
import com.petfoster.service.FosterOrderService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.FosterOrderVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@Tag(name = "寄养订单管理", description = "订单增删改查、确认入店/离店/取消、模拟支付；写操作仅工作人员")
@RestController
@RequestMapping("/api/orders")
public class FosterOrderController {

    private final FosterOrderService fosterOrderService;

    public FosterOrderController(FosterOrderService fosterOrderService) {
        this.fosterOrderService = fosterOrderService;
    }

    @GetMapping
    public Result<PageResult<FosterOrderVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String orderNo) {
        return Result.success(fosterOrderService.page(page, size, status, customerId, orderNo));
    }

    @GetMapping("/{id}")
    public Result<FosterOrderVO> detail(@PathVariable Long id) {
        return Result.success(fosterOrderService.getDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('STAFF')")
    public Result<FosterOrderVO> create(@Valid @RequestBody FosterOrderDTO dto) {
        Long creatorId = SecurityUtil.getCurrentUserId();
        return Result.success(fosterOrderService.create(dto, creatorId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('STAFF')")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody FosterOrderDTO dto) {
        fosterOrderService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('STAFF')")
    public Result<Void> delete(@PathVariable Long id) {
        fosterOrderService.removeById(id);
        return Result.success();
    }

    @PutMapping("/{id}/check-in")
    @PreAuthorize("hasRole('STAFF')")
    public Result<Void> checkIn(@PathVariable Long id) {
        fosterOrderService.checkIn(id);
        return Result.success();
    }

    @PutMapping("/{id}/check-out")
    @PreAuthorize("hasRole('STAFF')")
    public Result<Void> checkOut(@PathVariable Long id) {
        fosterOrderService.checkOut(id);
        return Result.success();
    }

    @PutMapping("/{id}/cancel")
    @PreAuthorize("hasRole('STAFF')")
    public Result<Void> cancel(@PathVariable Long id) {
        fosterOrderService.cancel(id);
        return Result.success();
    }

    @PostMapping("/{id}/pay")
    @PreAuthorize("hasRole('STAFF')")
    public Result<FosterOrderVO> pay(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String paymentMethod = body.getOrDefault("paymentMethod", PaymentMethod.WECHAT.getValue());
        return Result.success(fosterOrderService.pay(id, paymentMethod));
    }
}
