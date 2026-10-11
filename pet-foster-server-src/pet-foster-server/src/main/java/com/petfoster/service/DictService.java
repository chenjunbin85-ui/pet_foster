package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.DictDTO;
import com.petfoster.entity.Dict;
import com.petfoster.mapper.DictMapper;
import com.petfoster.vo.DictVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DictService extends ServiceImpl<DictMapper, Dict> {

    public PageResult<DictVO> page(long page, long size, String typeCode) {
        Page<Dict> p = new Page<>(page, size);
        LambdaQueryWrapper<Dict> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(typeCode)) wrapper.eq(Dict::getTypeCode, typeCode);
        wrapper.orderByAsc(Dict::getSort);
        Page<Dict> result = page(p, wrapper);
        List<DictVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public List<DictVO> listByType(String typeCode) {
        return list(new LambdaQueryWrapper<Dict>()
                .eq(Dict::getTypeCode, typeCode)
                .orderByAsc(Dict::getSort))
                .stream().map(this::toVO).collect(Collectors.toList());
    }

    public void create(DictDTO dto) {
        Dict d = new Dict();
        d.setTypeCode(dto.getTypeCode());
        d.setLabel(dto.getLabel());
        d.setValue(dto.getValue());
        d.setSort(dto.getSort() != null ? dto.getSort() : 0);
        save(d);
    }

    public void update(Long id, DictDTO dto) {
        Dict d = getById(id);
        if (d == null) throw new BusinessException("字典项不存在");
        d.setTypeCode(dto.getTypeCode());
        d.setLabel(dto.getLabel());
        d.setValue(dto.getValue());
        d.setSort(dto.getSort());
        updateById(d);
    }

    private DictVO toVO(Dict d) {
        DictVO vo = new DictVO();
        vo.setId(String.valueOf(d.getDictId()));
        vo.setTypeCode(d.getTypeCode());
        vo.setLabel(d.getLabel());
        vo.setValue(d.getValue());
        vo.setSort(d.getSort());
        return vo;
    }
}
