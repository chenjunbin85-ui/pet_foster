package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.FosterPriceDTO;
import com.petfoster.entity.FosterPrice;
import com.petfoster.mapper.FosterPriceMapper;
import com.petfoster.vo.FosterPriceVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FosterPriceService extends ServiceImpl<FosterPriceMapper, FosterPrice> {

    public PageResult<FosterPriceVO> page(long page, long size, String keyword) {
        Page<FosterPrice> p = new Page<>(page, size);
        LambdaQueryWrapper<FosterPrice> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.like(FosterPrice::getLevelName, keyword);
        }
        wrapper.orderByAsc(FosterPrice::getSort).orderByDesc(FosterPrice::getPriceId);
        Page<FosterPrice> result = page(p, wrapper);
        List<FosterPriceVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    /** 供工作人员下单时选择的启用档位列表 */
    public List<FosterPriceVO> listOptions() {
        return list(new LambdaQueryWrapper<FosterPrice>()
                .eq(FosterPrice::getStatus, 1)
                .orderByAsc(FosterPrice::getSort))
                .stream().map(this::toVO).collect(Collectors.toList());
    }

    public FosterPriceVO getDetail(Long id) {
        FosterPrice p = getById(id);
        if (p == null) throw new BusinessException("价位档位不存在");
        return toVO(p);
    }

    public void create(FosterPriceDTO dto) {
        FosterPrice p = new FosterPrice();
        applyDto(p, dto);
        p.setCreateTime(LocalDateTime.now());
        save(p);
    }

    public void update(Long id, FosterPriceDTO dto) {
        FosterPrice p = getById(id);
        if (p == null) throw new BusinessException("价位档位不存在");
        applyDto(p, dto);
        updateById(p);
    }

    public void delete(Long id) {
        FosterPrice p = getById(id);
        if (p == null) throw new BusinessException("价位档位不存在");
        removeById(id);
    }

    private void applyDto(FosterPrice p, FosterPriceDTO dto) {
        p.setLevelName(dto.getLevelName());
        p.setPricePerDay(dto.getPricePerDay());
        p.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        p.setSort(dto.getSort() != null ? dto.getSort() : 0);
        p.setRemark(dto.getRemark());
    }

    public FosterPriceVO toVO(FosterPrice p) {
        FosterPriceVO vo = new FosterPriceVO();
        vo.setId(String.valueOf(p.getPriceId()));
        vo.setLevelName(p.getLevelName());
        vo.setPricePerDay(p.getPricePerDay());
        vo.setStatus(p.getStatus());
        vo.setSort(p.getSort());
        vo.setRemark(p.getRemark());
        return vo;
    }
}
