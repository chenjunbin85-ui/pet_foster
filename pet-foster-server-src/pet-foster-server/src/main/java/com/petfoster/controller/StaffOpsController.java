package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.StaffOpsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 门店运营：交接单 / 巡视日志 / 异常事件 / 导出留痕 */
@Tag(name = "门店运营", description = "入离店交接、每日巡视、异常事件、订单导出")
@RestController
@RequestMapping("/api/staff")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class StaffOpsController {

    private final StaffOpsService staffOpsService;

    public StaffOpsController(StaffOpsService staffOpsService) {
        this.staffOpsService = staffOpsService;
    }

    @PostMapping("/orders/{id}/handover")
    public Result<Object> handover(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(staffOpsService.handover(id, body));
    }

    @PostMapping("/orders/{id}/care-log")
    public Result<Object> careLog(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(staffOpsService.careLog(id, body));
    }

    @PostMapping("/orders/{id}/incident")
    public Result<Object> incident(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(staffOpsService.incident(id, body));
    }

    @PostMapping("/orders/{id}/redeem")
    public Result<Object> redeem(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(staffOpsService.redeem(id, body));
    }

    @GetMapping(value = "/export/orders.csv")
    public String exportOrders(@RequestParam String purpose) {
        return staffOpsService.exportOrdersCsv(purpose);
    }
}
