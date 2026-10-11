package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.dto.LoginDTO;
import com.petfoster.service.AuthService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.LoginVO;
import com.petfoster.vo.SysUserVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

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
