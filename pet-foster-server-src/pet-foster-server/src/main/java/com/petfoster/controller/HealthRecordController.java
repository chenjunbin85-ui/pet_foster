package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.HealthRecordDTO;
import com.petfoster.service.HealthRecordService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.HealthRecordVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "健康记录管理", description = "入店记录、寄养观测记录、离店记录（仅工作人员）")
@RestController
@RequestMapping("/api/health-records")
@PreAuthorize("hasRole('STAFF')")
public class HealthRecordController {

    private final HealthRecordService healthRecordService;

    public HealthRecordController(HealthRecordService healthRecordService) {
        this.healthRecordService = healthRecordService;
    }

    @GetMapping
    public Result<PageResult<HealthRecordVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) Long petId,
            @RequestParam(required = false) Long orderId) {
        return Result.success(healthRecordService.page(page, size, petId, orderId));
    }

    @GetMapping("/{id}")
    public Result<HealthRecordVO> detail(@PathVariable Long id) {
        return Result.success(healthRecordService.getDetail(id));
    }

    @PostMapping
    public Result<Void> create(@Valid @RequestBody HealthRecordDTO dto) {
        Long recorderId = SecurityUtil.getCurrentUserId();
        healthRecordService.create(dto, recorderId);
        return Result.success();
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody HealthRecordDTO dto) {
        healthRecordService.update(id, dto);
        return Result.success();
    }
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        healthRecordService.removeById(id);
        return Result.success();
    }
}
