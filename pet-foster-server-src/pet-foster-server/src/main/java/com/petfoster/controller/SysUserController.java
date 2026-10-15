package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.SysUserDTO;
import com.petfoster.service.SysUserService;
import com.petfoster.vo.SysUserVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "系统用户管理", description = "管理员：系统账号的增删改查与启用禁用")
@RestController
@RequestMapping("/api/users")
@PreAuthorize("hasRole('ADMIN')")
public class SysUserController {

    private final SysUserService sysUserService;

    public SysUserController(SysUserService sysUserService) {
        this.sysUserService = sysUserService;
    }

    @GetMapping
    public Result<PageResult<SysUserVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String keyword) {
        return Result.success(sysUserService.page(page, size, keyword));
    }

    @GetMapping("/{id}")
    public Result<SysUserVO> detail(@PathVariable Long id) {
        return Result.success(sysUserService.getDetail(id));
    }

    @PostMapping
    public Result<Void> create(@Valid @RequestBody SysUserDTO dto) {
        sysUserService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody SysUserDTO dto) {
        sysUserService.update(id, dto);
        return Result.success();
    }
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        sysUserService.removeById(id);
        return Result.success();
    }
}
