package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.PetDTO;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.vo.PetVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PetService extends ServiceImpl<PetMapper, Pet> {

    private final FosterOrderMapper fosterOrderMapper;

    public PetService(FosterOrderMapper fosterOrderMapper) {
        this.fosterOrderMapper = fosterOrderMapper;
    }

    public PageResult<PetVO> page(long page, long size, Long customerId, String name) {
        Page<Pet> p = new Page<>(page, size);
        LambdaQueryWrapper<Pet> wrapper = new LambdaQueryWrapper<>();
        if (customerId != null) {
            wrapper.eq(Pet::getCustomerId, customerId);
        }
        if (StringUtils.hasText(name)) {
            wrapper.like(Pet::getName, name);
        }
        wrapper.orderByDesc(Pet::getCreateTime);
        Page<Pet> result = page(p, wrapper);
        List<PetVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public List<PetVO> listByCustomer(Long customerId) {
        return list(new LambdaQueryWrapper<Pet>().eq(Pet::getCustomerId, customerId))
                .stream().map(this::toVO).collect(Collectors.toList());
    }

    public PetVO getDetail(Long id) {
        Pet p = getById(id);
        if (p == null) throw new BusinessException("宠物不存在");
        return toVO(p);
    }

    public void create(PetDTO dto) {
        Pet p = new Pet();
        p.setCustomerId(dto.getCustomerId());
        p.setName(dto.getName());
        p.setBreed(dto.getBreed());
        p.setGender(dto.getGender());
        p.setAge(dto.getAge());
        p.setWeight(dto.getWeight());
        p.setColor(dto.getColor());
        p.setVaccine(dto.getVaccine());
        p.setHistory(dto.getHistory());
        p.setCreateTime(LocalDateTime.now());
        save(p);
    }

    public void update(Long id, PetDTO dto) {
        Pet p = getById(id);
        if (p == null) throw new BusinessException("宠物不存在");
        p.setCustomerId(dto.getCustomerId());
        p.setName(dto.getName());
        p.setBreed(dto.getBreed());
        p.setGender(dto.getGender());
        p.setAge(dto.getAge());
        p.setWeight(dto.getWeight());
        p.setColor(dto.getColor());
        p.setVaccine(dto.getVaccine());
        p.setHistory(dto.getHistory());
        updateById(p);
    }

    public void delete(Long id) {
        Pet p = getById(id);
        if (p == null) throw new BusinessException("宠物不存在");
        // 删除保护：检查是否有关联寄养订单
        Long orderCount = fosterOrderMapper.selectCount(
                new LambdaQueryWrapper<FosterOrder>().eq(FosterOrder::getPetId, id));
        if (orderCount > 0) throw new BusinessException("该宠物存在寄养订单记录，无法删除");
        removeById(id);
    }

    public PetVO toVO(Pet p) {
        PetVO vo = new PetVO();
        vo.setId(String.valueOf(p.getPetId()));
        vo.setCustomerId(String.valueOf(p.getCustomerId()));
        vo.setName(p.getName());
        vo.setBreed(p.getBreed());
        vo.setGender(p.getGender());
        vo.setAge(p.getAge());
        vo.setWeight(p.getWeight());
        vo.setColor(p.getColor());
        vo.setVaccine(p.getVaccine());
        vo.setHistory(p.getHistory());
        vo.setCreatedAt(p.getCreateTime());
        return vo;
    }
}
