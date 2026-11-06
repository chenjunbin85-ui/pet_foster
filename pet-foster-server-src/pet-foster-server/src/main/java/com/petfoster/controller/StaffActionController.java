package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.StaffActionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 员工端现场动作写入：每个接口独立判岗位，不依赖前端隐藏按钮。 */
@Tag(name = "员工端现场动作", description = "护理记录 / 洗护作业 / 接送交接 / 兽医签署 / 异常复核授权 / 在岗确认")
@RestController
@RequestMapping("/api/staff")
@PreAuthorize("hasAnyRole('STAFF','ADMIN')")
public class StaffActionController {

    private final StaffActionService actions;

    public StaffActionController(StaffActionService actions) {
        this.actions = actions;
    }

    /** V1 兽医在岗确认：写当日 VET 班次。 */
    @PostMapping("/duty/confirm")
    public Result<Map<String, Object>> confirmDuty(@RequestBody(required = false) Map<String, Object> body) {
        return Result.success(actions.confirmDuty(body == null ? Map.of() : body));
    }

    /** C3 日常护理记录（喂食 / 遛放 / 清洁）。 */
    @PostMapping("/orders/{id}/care-record")
    public Result<Object> careRecord(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.careRecord(id, body));
    }

    /** G2 洗护作业记录，皮肤异常返回 needTransfer=true。 */
    @PostMapping("/orders/{id}/groom-log")
    public Result<Map<String, Object>> groomLog(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.groomLog(id, body));
    }

    /** D2 到场 / 送达交接拍照。 */
    @PostMapping("/orders/{id}/pickup-handover")
    public Result<Object> pickupHandover(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.pickupHandover(id, body));
    }

    /** V2 / V5 入离店健康评估签署。 */
    @PostMapping("/orders/{id}/health-assessment")
    public Result<Object> healthAssessment(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.healthAssessment(id, body));
    }

    /** V3 异常复核与处置。 */
    @PostMapping("/incidents/{id}/review")
    public Result<Object> reviewIncident(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.reviewIncident(id, body));
    }

    /** V4 隔离 / 送医授权（客户通知硬前置，OWNER 紧急兜底）。 */
    @PostMapping("/incidents/{id}/authorize")
    public Result<Map<String, Object>> authorizeIncident(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return Result.success(actions.authorizeIncident(id, body));
    }
}
