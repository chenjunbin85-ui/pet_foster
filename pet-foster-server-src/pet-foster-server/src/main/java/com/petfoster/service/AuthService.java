package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.dto.LoginDTO;
import com.petfoster.entity.SysUser;
import com.petfoster.mapper.SysUserMapper;
import com.petfoster.security.LoginAttemptService;
import com.petfoster.util.JwtUtil;
import com.petfoster.vo.LoginVO;
import com.petfoster.vo.SysUserVO;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final SysUserMapper sysUserMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginAttemptService loginAttemptService;

    public AuthService(SysUserMapper sysUserMapper, PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                       LoginAttemptService loginAttemptService) {
        this.sysUserMapper = sysUserMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.loginAttemptService = loginAttemptService;
    }

    public LoginVO login(LoginDTO dto) {
        // 锁定期内直接拒绝，避免密码校验被人用来暴力猜解
        loginAttemptService.checkNotLocked(dto.getUsername());

        SysUser user = sysUserMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, dto.getUsername()));
        if (user == null) {
            throw new BusinessException(loginAttemptService.recordFailure(dto.getUsername(), "用户不存在"));
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }
        if (!passwordEncoder.matches(dto.getPassword(), user.getPassword())) {
            throw new BusinessException(loginAttemptService.recordFailure(dto.getUsername(), "密码错误"));
        }
        loginAttemptService.recordSuccess(dto.getUsername());

        String token = jwtUtil.generateToken(user.getUserId(), user.getUsername(), user.getRole());
        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setUserInfo(toVO(user));
        return vo;
    }

    public SysUserVO getInfo(Long userId) {
        SysUser user = sysUserMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        return toVO(user);
    }

    public void changePassword(Long userId, String oldPassword, String newPassword) {
        SysUser user = sysUserMapper.selectById(userId);
        if (user == null) throw new BusinessException("用户不存在");
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            throw new BusinessException("原密码错误");
        }
        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessException("新密码长度不能少于6位");
        }
        user.setPassword(passwordEncoder.encode(newPassword));
        sysUserMapper.updateById(user);
    }

    private SysUserVO toVO(SysUser user) {
        SysUserVO vo = new SysUserVO();
        vo.setId(String.valueOf(user.getUserId()));
        vo.setUsername(user.getUsername());
        vo.setName(user.getRealName());
        vo.setRole(user.getRole());
        vo.setStatus(user.getStatus() != null && user.getStatus() == 1 ? "启用" : "禁用");
        vo.setRemark(user.getRemark());
        vo.setCreatedAt(user.getCreateTime());
        return vo;
    }
}
