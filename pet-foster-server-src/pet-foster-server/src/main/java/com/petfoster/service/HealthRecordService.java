package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.HealthRecordDTO;
import com.petfoster.entity.HealthRecord;
import com.petfoster.entity.SysUser;
import com.petfoster.mapper.HealthRecordMapper;
import com.petfoster.mapper.SysUserMapper;
import com.petfoster.vo.HealthRecordVO;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class HealthRecordService extends ServiceImpl<HealthRecordMapper, HealthRecord> {

    private final SysUserMapper sysUserMapper;

    public HealthRecordService(SysUserMapper sysUserMapper) {
        this.sysUserMapper = sysUserMapper;
    }

    public PageResult<HealthRecordVO> page(long page, long size, Long petId, Long orderId) {
        Page<HealthRecord> p = new Page<>(page, size);
        LambdaQueryWrapper<HealthRecord> wrapper = new LambdaQueryWrapper<>();
        if (petId != null) wrapper.eq(HealthRecord::getPetId, petId);
        if (orderId != null) wrapper.eq(HealthRecord::getOrderId, orderId);
        wrapper.orderByDesc(HealthRecord::getRecordTime);
        Page<HealthRecord> result = page(p, wrapper);
        List<HealthRecordVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public HealthRecordVO getDetail(Long id) {
        HealthRecord r = getById(id);
        if (r == null) throw new BusinessException("健康记录不存在");
        return toVO(r);
    }

    public void create(HealthRecordDTO dto, Long recorderId) {
        HealthRecord r = new HealthRecord();
        r.setPetId(dto.getPetId());
        r.setOrderId(dto.getOrderId());
        r.setType(dto.getType());
        r.setTemperature(dto.getTemperature());
        r.setSpirit(dto.getSpirit());
        r.setAppetite(dto.getAppetite());
        r.setDefecation(dto.getDefecation());
        r.setSkin(dto.getSkin());
        r.setAbnormal(dto.getAbnormal());
        r.setTreatment(dto.getTreatment());
        r.setRecorderId(recorderId);
        r.setRecordTime(LocalDateTime.now());
        save(r);
    }

    public void update(Long id, HealthRecordDTO dto) {
        HealthRecord r = getById(id);
        if (r == null) throw new BusinessException("健康记录不存在");
        // 仅当天可编辑：记录创建日期必须为今天
        if (r.getRecordTime() != null && !r.getRecordTime().toLocalDate().equals(java.time.LocalDate.now())) {
            throw new BusinessException("仅允许修改当天创建的健康记录");
        }
        r.setPetId(dto.getPetId());
        r.setOrderId(dto.getOrderId());
        r.setType(dto.getType());
        r.setTemperature(dto.getTemperature());
        r.setSpirit(dto.getSpirit());
        r.setAppetite(dto.getAppetite());
        r.setDefecation(dto.getDefecation());
        r.setSkin(dto.getSkin());
        r.setAbnormal(dto.getAbnormal());
        r.setTreatment(dto.getTreatment());
        updateById(r);
    }

    public HealthRecordVO toVO(HealthRecord r) {
        HealthRecordVO vo = new HealthRecordVO();
        vo.setId(String.valueOf(r.getRecordId()));
        vo.setPetId(String.valueOf(r.getPetId()));
        vo.setOrderId(r.getOrderId() != null ? String.valueOf(r.getOrderId()) : null);
        vo.setType(r.getType());
        vo.setTemperature(r.getTemperature());
        vo.setSpirit(r.getSpirit());
        vo.setAppetite(r.getAppetite());
        vo.setDefecation(r.getDefecation());
        vo.setSkin(r.getSkin());
        vo.setAbnormal(r.getAbnormal());
        vo.setTreatment(r.getTreatment());
        vo.setRecorderId(r.getRecorderId() != null ? String.valueOf(r.getRecorderId()) : null);
        // 填充记录人姓名
        if (r.getRecorderId() != null) {
            SysUser u = sysUserMapper.selectById(r.getRecorderId());
            if (u != null) vo.setRecorder(u.getRealName());
        }
        vo.setRecordTime(r.getRecordTime());
        return vo;
    }
}
