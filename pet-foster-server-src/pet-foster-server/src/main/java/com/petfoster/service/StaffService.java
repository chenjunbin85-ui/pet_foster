package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.SysUserDTO;
import com.petfoster.entity.Staff;
import com.petfoster.mapper.StaffMapper;
import com.petfoster.vo.SysUserVO;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 工作人员管理：管理员在后台维护 staff 表（护理员/前台）。
 * 管理员账号本身在 sys_admin 表，不通过此接口增删。
 */
@Service
public class StaffService extends ServiceImpl<StaffMapper, Staff> {

    private final PasswordEncoder passwordEncoder;

    public StaffService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public PageResult<SysUserVO> page(long page, long size, String keyword) {
        Page<Staff> p = new Page<>(page, size);
        LambdaQueryWrapper<Staff> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Staff::getUsername, keyword).or().like(Staff::getRealName, keyword));
        }
        wrapper.orderByDesc(Staff::getCreateTime);
        Page<Staff> result = page(p, wrapper);
        List<SysUserVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public SysUserVO getDetail(Long id) {
        Staff u = getById(id);
        if (u == null) throw new BusinessException("用户不存在");
        return toVO(u);
    }

    public void create(SysUserDTO dto) {
        // 检查用户名唯一
        Long count = count(new LambdaQueryWrapper<Staff>().eq(Staff::getUsername, dto.getUsername()));
        if (count > 0) throw new BusinessException("用户名已存在");
        Staff u = new Staff();
        u.setUsername(dto.getUsername());
        u.setPassword(passwordEncoder.encode(dto.getPassword() != null ? dto.getPassword() : "123456"));
        u.setRealName(dto.getRealName());
        u.setPosition(dto.getPosition());
        u.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        u.setRemark(dto.getRemark());
        u.setCreateTime(LocalDateTime.now());
        save(u);
    }

    public void update(Long id, SysUserDTO dto) {
        Staff u = getById(id);
        if (u == null) throw new BusinessException("用户不存在");
        u.setRealName(dto.getRealName());
        if (dto.getPosition() != null) u.setPosition(dto.getPosition());
        if (dto.getStatus() != null) u.setStatus(dto.getStatus());
        u.setRemark(dto.getRemark());
        if (StringUtils.hasText(dto.getPassword())) {
            u.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        updateById(u);
    }

    public SysUserVO toVO(Staff u) {
        SysUserVO vo = new SysUserVO();
        vo.setId(String.valueOf(u.getStaffId()));
        vo.setUsername(u.getUsername());
        vo.setName(u.getRealName());
        vo.setRole("staff");
        vo.setPosition(u.getPosition());
        vo.setStatus(u.getStatus() != null && u.getStatus() == 1 ? "启用" : "禁用");
        vo.setRemark(u.getRemark());
        vo.setCreatedAt(u.getCreateTime());
        return vo;
    }
}
