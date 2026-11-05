package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.dto.MpLoginDTO;
import com.petfoster.dto.MpRegisterDTO;
import com.petfoster.service.MpAuthService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.CustomerVO;
import com.petfoster.vo.MpLoginVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/** 小程序端客户认证接口（毛球旅馆用户端） */
@Tag(name = "小程序·客户认证", description = "手机号+密码登录、当前客户信息")
@RestController
@RequestMapping("/api/mp/auth")
public class MpAuthController {

    private final MpAuthService mpAuthService;

    public MpAuthController(MpAuthService mpAuthService) {
        this.mpAuthService = mpAuthService;
    }

    @PostMapping("/login")
    public Result<MpLoginVO> login(@Valid @RequestBody MpLoginDTO dto) {
        return Result.success(mpAuthService.login(dto));
    }

    @PostMapping("/register")
    public Result<MpLoginVO> register(@Valid @RequestBody MpRegisterDTO dto) {
        return Result.success(mpAuthService.register(dto));
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER')")
    public Result<CustomerVO> me() {
        return Result.success(mpAuthService.me(SecurityUtil.getCurrentUserId()));
    }
}
