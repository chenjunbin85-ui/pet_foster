package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.security.StaffAuth;
import com.petfoster.service.StaffPortalService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 员工端（同一小程序按角色分流）聚合查询：今日待办、订单详情、健康摘要、异常详情、在岗状态。 */
@Tag(name = "员工端工作台", description = "今日待办 / 工作台 / 订单详情 / 岗位身份")
@RestController
@RequestMapping("/api/staff")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class StaffPortalController {

    private final StaffPortalService portal;
    private final StaffAuth auth;

    public StaffPortalController(StaffPortalService portal, StaffAuth auth) {
        this.portal = portal;
        this.auth = auth;
    }

    /** 页面鉴权用的身份快照（岗位代码、能力组、VET 在岗与证照）。 */
    @GetMapping("/me")
    public Result<Map<String, Object>> me() {
        return Result.success(auth.me());
    }

    @GetMapping("/today")
    public Result<Map<String, Object>> today() {
        return Result.success(portal.today());
    }

    @GetMapping("/orders/{id}")
    public Result<Map<String, Object>> orderDetail(@PathVariable Long id) {
        return Result.success(portal.orderDetail(id));
    }

    @GetMapping("/orders/{id}/health-summary")
    public Result<Map<String, Object>> healthSummary(@PathVariable Long id) {
        return Result.success(portal.healthSummary(id));
    }

    @GetMapping("/incidents/{id}")
    public Result<Map<String, Object>> incidentDetail(@PathVariable Long id) {
        return Result.success(portal.incidentDetail(id));
    }

    @GetMapping("/services")
    public Result<Object> services() {
        return Result.success(portal.redeemItems());
    }

    @GetMapping("/duty")
    public Result<Map<String, Object>> duty() {
        return Result.success(portal.duty());
    }
}
