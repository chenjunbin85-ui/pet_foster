package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.service.OperLogService;
import com.petfoster.vo.OperLogVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "操作日志", description = "管理员：系统操作日志查询")
@RestController
@RequestMapping("/api/oper-logs")
@PreAuthorize("hasRole('ADMIN')")
public class OperLogController {

    private final OperLogService operLogService;

    public OperLogController(OperLogService operLogService) {
        this.operLogService = operLogService;
    }

    @GetMapping
    public Result<PageResult<OperLogVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String module,
            @RequestParam(required = false) Long userId) {
        return Result.success(operLogService.page(page, size, module, userId));
    }
}
