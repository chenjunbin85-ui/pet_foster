package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.SysUserDTO;
import com.petfoster.service.SysUserService;
import com.petfoster.vo.SysUserVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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


    @Log(module = "用户管理", content = "新增")


    public Result<Void> create(@Valid @RequestBody SysUserDTO dto) {
        sysUserService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")


    @Log(module = "用户管理", content = "修改")


    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody SysUserDTO dto) {
        sysUserService.update(id, dto);
        return Result.success();
    }

    

    @Log(module = "用户管理", content = "删除")
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        sysUserService.removeById(id);
        return Result.success();
    }
}
