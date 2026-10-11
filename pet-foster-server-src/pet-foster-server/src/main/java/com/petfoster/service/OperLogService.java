package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.PageResult;
import com.petfoster.entity.OperLog;
import com.petfoster.mapper.OperLogMapper;
import com.petfoster.vo.OperLogVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class OperLogService extends ServiceImpl<OperLogMapper, OperLog> {

    public PageResult<OperLogVO> page(long page, long size, String module, Long userId) {
        Page<OperLog> p = new Page<>(page, size);
        LambdaQueryWrapper<OperLog> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(module)) wrapper.like(OperLog::getModule, module);
        if (userId != null) wrapper.eq(OperLog::getUserId, userId);
        wrapper.orderByDesc(OperLog::getRequestTime);
        Page<OperLog> result = page(p, wrapper);
        List<OperLogVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    private OperLogVO toVO(OperLog l) {
        OperLogVO vo = new OperLogVO();
        vo.setId(String.valueOf(l.getLogId()));
        vo.setUserId(l.getUserId() != null ? String.valueOf(l.getUserId()) : null);
        vo.setModule(l.getModule());
        vo.setContent(l.getContent());
        vo.setTime(l.getRequestTime());
        vo.setIp(l.getIp());
        return vo;
    }
}
