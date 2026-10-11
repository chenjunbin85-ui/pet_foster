package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.ServiceRecordDTO;
import com.petfoster.entity.ServiceRecord;
import com.petfoster.entity.SysUser;
import com.petfoster.mapper.ServiceRecordMapper;
import com.petfoster.mapper.SysUserMapper;
import com.petfoster.vo.ServiceRecordVO;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ServiceRecordService extends ServiceImpl<ServiceRecordMapper, ServiceRecord> {

    private final SysUserMapper sysUserMapper;

    public ServiceRecordService(SysUserMapper sysUserMapper) {
        this.sysUserMapper = sysUserMapper;
    }

    public PageResult<ServiceRecordVO> page(long page, long size, Long orderId, Long petId) {
        Page<ServiceRecord> p = new Page<>(page, size);
        LambdaQueryWrapper<ServiceRecord> wrapper = new LambdaQueryWrapper<>();
        if (orderId != null) wrapper.eq(ServiceRecord::getOrderId, orderId);
        if (petId != null) wrapper.eq(ServiceRecord::getPetId, petId);
        wrapper.orderByDesc(ServiceRecord::getServiceTime);
        Page<ServiceRecord> result = page(p, wrapper);
        List<ServiceRecordVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public ServiceRecordVO getDetail(Long id) {
        ServiceRecord r = getById(id);
        if (r == null) throw new BusinessException("服务记录不存在");
        return toVO(r);
    }

    public void create(ServiceRecordDTO dto, Long keeperId) {
        ServiceRecord r = new ServiceRecord();
        r.setOrderId(dto.getOrderId());
        r.setPetId(dto.getPetId());
        r.setItem(dto.getServiceName());
        r.setContent(dto.getDescription());
        r.setServiceTime(dto.getServiceTime() != null ? dto.getServiceTime() : LocalDateTime.now());
        r.setKeeperId(keeperId);
        save(r);
    }

    public void update(Long id, ServiceRecordDTO dto) {
        ServiceRecord r = getById(id);
        if (r == null) throw new BusinessException("服务记录不存在");
        r.setOrderId(dto.getOrderId());
        r.setPetId(dto.getPetId());
        r.setItem(dto.getServiceName());
        r.setContent(dto.getDescription());
        r.setServiceTime(dto.getServiceTime());
        updateById(r);
    }

    public ServiceRecordVO toVO(ServiceRecord r) {
        ServiceRecordVO vo = new ServiceRecordVO();
        vo.setId(String.valueOf(r.getServiceId()));
        vo.setOrderId(String.valueOf(r.getOrderId()));
        vo.setPetId(String.valueOf(r.getPetId()));
        vo.setServiceName(r.getItem());
        vo.setDescription(r.getContent());
        vo.setServiceTime(r.getServiceTime());
        vo.setKeeperId(r.getKeeperId() != null ? String.valueOf(r.getKeeperId()) : null);
        if (r.getKeeperId() != null) {
            SysUser u = sysUserMapper.selectById(r.getKeeperId());
            if (u != null) vo.setKeeper(u.getRealName());
        }
        return vo;
    }
}
