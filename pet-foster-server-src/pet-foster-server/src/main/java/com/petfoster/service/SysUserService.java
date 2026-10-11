package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.SysUserDTO;
import com.petfoster.entity.SysUser;
import com.petfoster.mapper.SysUserMapper;
import com.petfoster.vo.SysUserVO;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SysUserService extends ServiceImpl<SysUserMapper, SysUser> {

    private final PasswordEncoder passwordEncoder;

    public SysUserService(PasswordEncoder passwordEncoder) {
        this.passwordEncoder = passwordEncoder;
    }

    public PageResult<SysUserVO> page(long page, long size, String keyword) {
        Page<SysUser> p = new Page<>(page, size);
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SysUser::getUsername, keyword).or().like(SysUser::getRealName, keyword));
        }
        wrapper.orderByDesc(SysUser::getCreateTime);
        Page<SysUser> result = page(p, wrapper);
        List<SysUserVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public SysUserVO getDetail(Long id) {
        SysUser u = getById(id);
        if (u == null) throw new BusinessException("用户不存在");
        return toVO(u);
    }

    public void create(SysUserDTO dto) {
        // 检查用户名唯一
        Long count = count(new LambdaQueryWrapper<SysUser>().eq(SysUser::getUsername, dto.getUsername()));
        if (count > 0) throw new BusinessException("用户名已存在");
        SysUser u = new SysUser();
        u.setUsername(dto.getUsername());
        u.setPassword(passwordEncoder.encode(dto.getPassword() != null ? dto.getPassword() : "123456"));
        u.setRealName(dto.getRealName());
        u.setRole(StringUtils.hasText(dto.getRole()) ? dto.getRole() : "staff");
        u.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        u.setRemark(dto.getRemark());
        u.setCreateTime(LocalDateTime.now());
        save(u);
    }

    public void update(Long id, SysUserDTO dto) {
        SysUser u = getById(id);
        if (u == null) throw new BusinessException("用户不存在");
        u.setRealName(dto.getRealName());
        u.setRole(StringUtils.hasText(dto.getRole()) ? dto.getRole() : u.getRole());
        if (dto.getStatus() != null) u.setStatus(dto.getStatus());
        u.setRemark(dto.getRemark());
        if (StringUtils.hasText(dto.getPassword())) {
            u.setPassword(passwordEncoder.encode(dto.getPassword()));
        }
        updateById(u);
    }

    public SysUserVO toVO(SysUser u) {
        SysUserVO vo = new SysUserVO();
        vo.setId(String.valueOf(u.getUserId()));
        vo.setUsername(u.getUsername());
        vo.setName(u.getRealName());
        vo.setRole(u.getRole());
        vo.setStatus(u.getStatus() != null && u.getStatus() == 1 ? "启用" : "禁用");
        vo.setRemark(u.getRemark());
        vo.setCreatedAt(u.getCreateTime());
        return vo;
    }
}
