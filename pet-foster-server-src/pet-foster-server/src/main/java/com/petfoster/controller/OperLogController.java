package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.service.OperLogService;
import com.petfoster.vo.OperLogVO;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
