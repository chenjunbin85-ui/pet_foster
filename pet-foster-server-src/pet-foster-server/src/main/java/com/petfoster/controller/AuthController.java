package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.dto.LoginDTO;
import com.petfoster.service.AuthService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.LoginVO;
import com.petfoster.vo.SysUserVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "认证管理", description = "登录、当前用户信息、修改密码")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public Result<LoginVO> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(authService.login(dto));
    }

    @GetMapping("/info")
    public Result<SysUserVO> info() {
        Long userId = SecurityUtil.getCurrentUserId();
        return Result.success(authService.getInfo(userId));
    }

    @PutMapping("/password")
    public Result<Void> changePassword(@RequestBody Map<String, String> body) {
        Long userId = SecurityUtil.getCurrentUserId();
        String oldPassword = body.get("oldPassword");
        String newPassword = body.get("newPassword");
        authService.changePassword(userId, oldPassword, newPassword);
        return Result.success();
    }
}
