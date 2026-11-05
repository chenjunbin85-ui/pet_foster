package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.SysUserDTO;
import com.petfoster.service.StaffService;
import com.petfoster.vo.SysUserVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * 工作人员管理（staff 表）：仅管理员可访问。
 */
@Tag(name = "工作人员管理", description = "管理员：门店护理员/前台账号的增删改查与启用禁用")
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class StaffController {

    private final StaffService staffService;

    public StaffController(StaffService staffService) {
        this.staffService = staffService;
    }

    @GetMapping
    public Result<PageResult<SysUserVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String keyword) {
        return Result.success(staffService.page(page, size, keyword));
    }

    @GetMapping("/{id}")
    public Result<SysUserVO> detail(@PathVariable Long id) {
        return Result.success(staffService.getDetail(id));
    }

    @PostMapping
    public Result<Void> create(@Valid @RequestBody SysUserDTO dto) {
        staffService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody SysUserDTO dto) {
        staffService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        staffService.removeById(id);
        return Result.success();
    }
}
