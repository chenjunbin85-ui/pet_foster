package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.CustomerDTO;
import com.petfoster.entity.Customer;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.vo.CustomerVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomerService extends ServiceImpl<CustomerMapper, Customer> {

    private final PetMapper petMapper;

    public CustomerService(PetMapper petMapper) {
        this.petMapper = petMapper;
    }

    public PageResult<CustomerVO> page(long page, long size, String keyword) {
        Page<Customer> p = new Page<>(page, size);
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(Customer::getName, keyword).or().like(Customer::getPhone, keyword));
        }
        wrapper.orderByDesc(Customer::getCreateTime);
        Page<Customer> result = page(p, wrapper);
        List<CustomerVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public CustomerVO getDetail(Long id) {
        Customer c = getById(id);
        if (c == null) throw new BusinessException("客户不存在");
        return toVO(c);
    }

    public void create(CustomerDTO dto) {
        // 手机号唯一校验
        Long count = count(new LambdaQueryWrapper<Customer>().eq(Customer::getPhone, dto.getPhone()));
        if (count > 0) throw new BusinessException("该手机号已存在客户档案");
        Customer c = new Customer();
        c.setName(dto.getName());
        c.setPhone(dto.getPhone());
        c.setAddress(dto.getAddress());
        c.setRemark(dto.getRemark());
        c.setCreateTime(LocalDateTime.now());
        save(c);
    }

    public void update(Long id, CustomerDTO dto) {
        Customer c = getById(id);
        if (c == null) throw new BusinessException("客户不存在");
        // 手机号唯一校验（排除自身）
        Long count = count(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getPhone, dto.getPhone())
                .ne(Customer::getCustomerId, id));
        if (count > 0) throw new BusinessException("该手机号已被其他客户使用");
        c.setName(dto.getName());
        c.setPhone(dto.getPhone());
        c.setAddress(dto.getAddress());
        c.setRemark(dto.getRemark());
        updateById(c);
    }

    public void delete(Long id) {
        Customer c = getById(id);
        if (c == null) throw new BusinessException("客户不存在");
        // 删除保护：检查是否有关联宠物
        Long petCount = petMapper.selectCount(new LambdaQueryWrapper<Pet>().eq(Pet::getCustomerId, id));
        if (petCount > 0) throw new BusinessException("该客户下存在宠物档案，无法删除，请先处理关联宠物");
        removeById(id);
    }

    private CustomerVO toVO(Customer c) {
        CustomerVO vo = new CustomerVO();
        vo.setId(String.valueOf(c.getCustomerId()));
        vo.setName(c.getName());
        vo.setPhone(c.getPhone());
        vo.setAddress(c.getAddress());
        vo.setRemark(c.getRemark());
        vo.setCreatedAt(c.getCreateTime());
        return vo;
    }
}
