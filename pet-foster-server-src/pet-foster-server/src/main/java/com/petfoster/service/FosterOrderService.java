package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.entity.Customer;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.FosterOrderVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FosterOrderService extends ServiceImpl<FosterOrderMapper, FosterOrder> {

    private final CustomerMapper customerMapper;
    private final PetMapper petMapper;

    public FosterOrderService(CustomerMapper customerMapper, PetMapper petMapper) {
        this.customerMapper = customerMapper;
        this.petMapper = petMapper;
    }

    public PageResult<FosterOrderVO> page(long page, long size, String status, Long customerId, String orderNo) {
        Page<FosterOrder> p = new Page<>(page, size);
        LambdaQueryWrapper<FosterOrder> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(status)) {
            wrapper.eq(FosterOrder::getStatus, status);
        }
        if (customerId != null) {
            wrapper.eq(FosterOrder::getCustomerId, customerId);
        }
        if (StringUtils.hasText(orderNo)) {
            wrapper.like(FosterOrder::getOrderNo, orderNo);
        }
        wrapper.orderByDesc(FosterOrder::getCreateTime);
        Page<FosterOrder> result = page(p, wrapper);
        List<FosterOrderVO> records = result.getRecords().stream().map(this::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public FosterOrderVO getDetail(Long id) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        return toVO(o);
    }

    public void create(FosterOrderDTO dto, Long creatorId) {
        FosterOrder o = new FosterOrder();
        o.setOrderNo(generateOrderNo());
        o.setCustomerId(dto.getCustomerId());
        o.setPetId(dto.getPetId());
        o.setStartDate(dto.getStartDate());
        o.setEndDate(dto.getEndDate());
        o.setPricePerDay(dto.getPricePerDay());
        o.setStatus("待入店");
        o.setRemark(dto.getRemark());
        o.setCreatorId(creatorId);
        o.setCreateTime(LocalDateTime.now());
        // 自动计算总费用
        o.setTotalFee(calcTotalFee(dto.getStartDate(), dto.getEndDate(), dto.getPricePerDay()));
        save(o);
    }

    public void update(Long id, FosterOrderDTO dto) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if ("已完成".equals(o.getStatus()) || "已取消".equals(o.getStatus())) {
            throw new BusinessException("已完成或已取消的订单不能修改");
        }
        o.setCustomerId(dto.getCustomerId());
        o.setPetId(dto.getPetId());
        o.setStartDate(dto.getStartDate());
        o.setEndDate(dto.getEndDate());
        o.setPricePerDay(dto.getPricePerDay());
        o.setRemark(dto.getRemark());
        o.setTotalFee(calcTotalFee(dto.getStartDate(), dto.getEndDate(), dto.getPricePerDay()));
        updateById(o);
    }

    public void checkIn(Long id) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!"待入店".equals(o.getStatus())) {
            throw new BusinessException("只有待入店状态的订单才能确认入店");
        }
        o.setStatus("寄养中");
        updateById(o);
    }

    public void checkOut(Long id) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!"寄养中".equals(o.getStatus())) {
            throw new BusinessException("只有寄养中状态的订单才能确认离店");
        }
        o.setStatus("已完成");
        updateById(o);
    }

    public void cancel(Long id) {
        // 取消订单仅限管理员
        String role = SecurityUtil.getCurrentUser().getRole();
        if (!"admin".equals(role)) {
            throw new BusinessException("仅管理员可取消订单");
        }
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!"待入店".equals(o.getStatus()) && !"寄养中".equals(o.getStatus())) {
            throw new BusinessException("只有待入店或寄养中状态的订单才能取消");
        }
        o.setStatus("已取消");
        updateById(o);
    }

    private BigDecimal calcTotalFee(LocalDate start, LocalDate end, BigDecimal pricePerDay) {
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        return pricePerDay.multiply(BigDecimal.valueOf(days));
    }

    private String generateOrderNo() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        // 查询今天已有多少单
        Long count = count(new LambdaQueryWrapper<FosterOrder>().likeRight(FosterOrder::getOrderNo, "FO" + datePart));
        String seq = String.format("%03d", count + 1);
        return "FO" + datePart + seq;
    }

    public FosterOrderVO toVO(FosterOrder o) {
        FosterOrderVO vo = new FosterOrderVO();
        vo.setId(String.valueOf(o.getOrderId()));
        vo.setOrderNo(o.getOrderNo());
        vo.setCustomerId(String.valueOf(o.getCustomerId()));
        vo.setPetId(String.valueOf(o.getPetId()));
        vo.setStartDate(o.getStartDate());
        vo.setEndDate(o.getEndDate());
        vo.setPricePerDay(o.getPricePerDay());
        vo.setTotalFee(o.getTotalFee());
        vo.setStatus(o.getStatus());
        vo.setRemark(o.getRemark());
        vo.setCreatorId(o.getCreatorId() != null ? String.valueOf(o.getCreatorId()) : null);
        vo.setCreatedAt(o.getCreateTime());
        // 填充客户姓名和宠物名
        Customer c = customerMapper.selectById(o.getCustomerId());
        if (c != null) vo.setCustomerName(c.getName());
        Pet p = petMapper.selectById(o.getPetId());
        if (p != null) vo.setPetName(p.getName());
        return vo;
    }
}
