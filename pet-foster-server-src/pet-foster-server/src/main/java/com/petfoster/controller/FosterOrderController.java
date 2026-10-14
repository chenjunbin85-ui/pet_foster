package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.service.FosterOrderService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.FosterOrderVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

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
    @Log(module = "寄养订单", content = "新增订单")
    public Result<FosterOrderVO> create(@Valid @RequestBody FosterOrderDTO dto) {
        Long creatorId = SecurityUtil.getCurrentUserId();
        return Result.success(fosterOrderService.create(dto, creatorId));
    }

    @PutMapping("/{id}")
    @Log(module = "寄养订单", content = "修改订单")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody FosterOrderDTO dto) {
        fosterOrderService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @Log(module = "寄养订单", content = "删除订单")
    public Result<Void> delete(@PathVariable Long id) {
        fosterOrderService.removeById(id);
        return Result.success();
    }

    @PutMapping("/{id}/check-in")
    @Log(module = "寄养订单", content = "确认入店")
    public Result<Void> checkIn(@PathVariable Long id) {
        fosterOrderService.checkIn(id);
        return Result.success();
    }

    @PutMapping("/{id}/check-out")
    @Log(module = "寄养订单", content = "确认离店")
    public Result<Void> checkOut(@PathVariable Long id) {
        fosterOrderService.checkOut(id);
        return Result.success();
    }

    @PutMapping("/{id}/cancel")
    @Log(module = "寄养订单", content = "取消订单")
    public Result<Void> cancel(@PathVariable Long id) {
        fosterOrderService.cancel(id);
        return Result.success();
    }

    @PostMapping("/{id}/pay")
    @Log(module = "寄养订单", content = "模拟支付")
    public Result<FosterOrderVO> pay(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String paymentMethod = body.getOrDefault("paymentMethod", "微信");
        return Result.success(fosterOrderService.pay(id, paymentMethod));
    }
}
