package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.dto.LoginDTO;
import com.petfoster.entity.Admin;
import com.petfoster.entity.Staff;
import com.petfoster.mapper.AdminMapper;
import com.petfoster.mapper.StaffMapper;
import com.petfoster.security.LoginAttemptService;
import com.petfoster.security.LoginUser;
import com.petfoster.security.StaffAuth;
import com.petfoster.util.JwtUtil;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.LoginVO;
import com.petfoster.vo.SysUserVO;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * 后台登录鉴权：管理员(sys_admin) 与 工作人员(staff) 分表存储，登录时依次校验两张表。
 */
@Service
public class AuthService {

    private final AdminMapper adminMapper;
    private final StaffMapper staffMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginAttemptService loginAttemptService;

    public AuthService(AdminMapper adminMapper, StaffMapper staffMapper,
                       PasswordEncoder passwordEncoder, JwtUtil jwtUtil,
                       LoginAttemptService loginAttemptService) {
        this.adminMapper = adminMapper;
        this.staffMapper = staffMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.loginAttemptService = loginAttemptService;
    }

    public LoginVO login(LoginDTO dto) {
        // 锁定期内直接拒绝，避免密码校验被人用来暴力猜解
        loginAttemptService.checkNotLocked(dto.getUsername());

        // 1) 先查管理员表
        Admin admin = adminMapper.selectOne(new LambdaQueryWrapper<Admin>()
                .eq(Admin::getUsername, dto.getUsername()));
        if (admin != null) {
            if (admin.getStatus() != null && admin.getStatus() == 0) {
                throw new BusinessException("账号已被禁用");
            }
            if (!passwordEncoder.matches(dto.getPassword(), admin.getPassword())) {
                throw new BusinessException(loginAttemptService.recordFailure(dto.getUsername(), "密码错误"));
            }
            loginAttemptService.recordSuccess(dto.getUsername());
            String token = jwtUtil.generateToken(admin.getAdminId(), admin.getUsername(), "admin");
            LoginVO vo = new LoginVO();
            vo.setToken(token);
            vo.setUserInfo(toVO(admin));
            return vo;
        }

        // 2) 再查工作人员表
        Staff staff = staffMapper.selectOne(new LambdaQueryWrapper<Staff>()
                .eq(Staff::getUsername, dto.getUsername()));
        if (staff == null) {
            throw new BusinessException(loginAttemptService.recordFailure(dto.getUsername(), "用户不存在"));
        }
        if (staff.getStatus() != null && staff.getStatus() == 0) {
            throw new BusinessException("账号已被禁用");
        }
        if (!passwordEncoder.matches(dto.getPassword(), staff.getPassword())) {
            throw new BusinessException(loginAttemptService.recordFailure(dto.getUsername(), "密码错误"));
        }
        loginAttemptService.recordSuccess(dto.getUsername());

        String token = jwtUtil.generateToken(staff.getStaffId(), staff.getUsername(), "staff");
        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setUserInfo(toVO(staff));
        return vo;
    }

    public SysUserVO getInfo(Long userId) {
        LoginUser me = SecurityUtil.getCurrentUser();
        if ("admin".equals(me.getRole())) {
            Admin a = adminMapper.selectById(userId);
            if (a == null) throw new BusinessException("用户不存在");
            return toVO(a);
        }
        Staff s = staffMapper.selectById(userId);
        if (s == null) throw new BusinessException("用户不存在");
        return toVO(s);
    }

    public void changePassword(Long userId, String oldPassword, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new BusinessException("新密码长度不能少于6位");
        }
        LoginUser me = SecurityUtil.getCurrentUser();
        if ("admin".equals(me.getRole())) {
            Admin a = adminMapper.selectById(userId);
            if (a == null) throw new BusinessException("用户不存在");
            if (!passwordEncoder.matches(oldPassword, a.getPassword())) {
                throw new BusinessException("原密码错误");
            }
            a.setPassword(passwordEncoder.encode(newPassword));
            adminMapper.updateById(a);
        } else {
            Staff s = staffMapper.selectById(userId);
            if (s == null) throw new BusinessException("用户不存在");
            if (!passwordEncoder.matches(oldPassword, s.getPassword())) {
                throw new BusinessException("原密码错误");
            }
            s.setPassword(passwordEncoder.encode(newPassword));
            staffMapper.updateById(s);
        }
    }

    private SysUserVO toVO(Admin a) {
        SysUserVO vo = new SysUserVO();
        vo.setId(String.valueOf(a.getAdminId()));
        vo.setUsername(a.getUsername());
        vo.setName(a.getRealName());
        vo.setRole("admin");
        // admin 与店长为同一岗位（PRD 3.1），不新增系统角色
        vo.setPosition("OWNER");
        vo.setPositions("OWNER");
        vo.setStatus(a.getStatus() != null && a.getStatus() == 1 ? "启用" : "禁用");
        vo.setRemark(a.getRemark());
        vo.setCreatedAt(a.getCreateTime());
        return vo;
    }

    private SysUserVO toVO(Staff s) {
        SysUserVO vo = new SysUserVO();
        vo.setId(String.valueOf(s.getStaffId()));
        vo.setUsername(s.getUsername());
        vo.setName(s.getRealName());
        vo.setRole("staff");
        vo.setPosition(s.getPosition());
        String raw = s.getPositions() != null && !s.getPositions().isBlank() ? s.getPositions() : s.getPosition();
        vo.setPositions(String.join(",", StaffAuth.normalize(raw)));
        vo.setStatus(s.getStatus() != null && s.getStatus() == 1 ? "启用" : "禁用");
        vo.setRemark(s.getRemark());
        vo.setCreatedAt(s.getCreateTime());
        return vo;
    }
}
