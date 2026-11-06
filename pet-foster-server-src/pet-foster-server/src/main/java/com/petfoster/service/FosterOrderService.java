package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.entity.Customer;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.FosterPrice;
import com.petfoster.entity.Pet;
import com.petfoster.enums.OrderStatus;
import com.petfoster.enums.PaymentMethod;
import com.petfoster.enums.PaymentStatus;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.FosterPriceMapper;
import com.petfoster.mapper.PetMapper;
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
    private final FosterPriceMapper fosterPriceMapper;

    public FosterOrderService(CustomerMapper customerMapper, PetMapper petMapper, FosterPriceMapper fosterPriceMapper) {
        this.customerMapper = customerMapper;
        this.petMapper = petMapper;
        this.fosterPriceMapper = fosterPriceMapper;
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

    public FosterOrderVO create(FosterOrderDTO dto, Long creatorId) {
        FosterPrice price = resolvePrice(dto.getPriceId());
        FosterOrder o = new FosterOrder();
        o.setOrderNo(generateOrderNo());
        o.setCustomerId(dto.getCustomerId());
        o.setPetId(dto.getPetId());
        o.setStartDate(dto.getStartDate());
        o.setEndDate(dto.getEndDate());
        o.setPriceId(price.getPriceId());
        o.setPricePerDay(price.getPricePerDay());
        o.setStatus(OrderStatus.PENDING.getValue());
        // 前台创建订单即完成收款（演示），不再产生未支付订单
        o.setPaymentStatus(PaymentStatus.PAID.getValue());
        o.setPaymentMethod(PaymentMethod.WECHAT.getValue());
        o.setPaymentTime(LocalDateTime.now());
        o.setRemark(dto.getRemark());
        o.setCreatorId(creatorId);
        o.setCreateTime(LocalDateTime.now());
        // 自动计算总费用与计费天数（以价位表价格为准，与小程序端 charge_days 口径一致）
        o.setChargeDays(chargeDays(dto.getStartDate(), dto.getEndDate()));
        o.setTotalFee(calcTotalFee(dto.getStartDate(), dto.getEndDate(), price.getPricePerDay()));
        o.setPaidAmount(o.getTotalFee());
        save(o);
        return toVO(o);
    }

    public void update(Long id, FosterOrderDTO dto) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (OrderStatus.COMPLETED.is(o.getStatus()) || OrderStatus.CANCELLED.is(o.getStatus())) {
            throw new BusinessException("已完成或已取消的订单不能修改");
        }
        FosterPrice price = resolvePrice(dto.getPriceId());
        o.setCustomerId(dto.getCustomerId());
        o.setPetId(dto.getPetId());
        o.setStartDate(dto.getStartDate());
        o.setEndDate(dto.getEndDate());
        o.setPriceId(price.getPriceId());
        o.setPricePerDay(price.getPricePerDay());
        o.setRemark(dto.getRemark());
        o.setChargeDays(chargeDays(dto.getStartDate(), dto.getEndDate()));
        o.setTotalFee(calcTotalFee(dto.getStartDate(), dto.getEndDate(), price.getPricePerDay()));
        updateById(o);
    }

    public void checkIn(Long id) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!OrderStatus.PENDING.is(o.getStatus())) {
            throw new BusinessException("只有待入店状态的订单才能确认入店");
        }
        o.setStatus(OrderStatus.FOSTERING.getValue());
        updateById(o);
    }

    public void checkOut(Long id) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!OrderStatus.FOSTERING.is(o.getStatus())) {
            throw new BusinessException("只有寄养中状态的订单才能确认离店");
        }
        o.setStatus(OrderStatus.COMPLETED.getValue());
        updateById(o);
    }

    public void cancel(Long id) {
        // 取消订单归工作人员（接口层已限定 STAFF 角色）
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        if (!OrderStatus.PENDING.is(o.getStatus()) && !OrderStatus.FOSTERING.is(o.getStatus())) {
            throw new BusinessException("只有待入店或寄养中状态的订单才能取消");
        }
        o.setStatus(OrderStatus.CANCELLED.getValue());
        updateById(o);
    }

    /** 校验价位档位存在且启用，返回档位（价格以价位表为准，不接受前端自定义单价） */
    public FosterPrice resolvePrice(Long priceId) {
        if (priceId == null) throw new BusinessException("请选择寄养价位档位");
        FosterPrice price = fosterPriceMapper.selectById(priceId);
        if (price == null) throw new BusinessException("价位档位不存在");
        if (price.getStatus() == null || price.getStatus() != 1) {
            throw new BusinessException("该价位档位已停用，请联系管理员");
        }
        return price;
    }

    /** 计费天数 = 离店 - 入住 + 1（同日 1 天）；总费用与 charge_days 快照共用同一口径 */
    private int chargeDays(LocalDate start, LocalDate end) {
        return Math.toIntExact(ChronoUnit.DAYS.between(start, end) + 1);
    }

    /** 按天计费：金额 = 单价 × 计费天数 */
    public BigDecimal calcTotalFee(LocalDate start, LocalDate end, BigDecimal pricePerDay) {
        return pricePerDay.multiply(BigDecimal.valueOf(chargeDays(start, end)));
    }

    public String generateOrderNo() {
        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"));
        // 物理计数（含逻辑删除订单）：订单号一旦生成永久占用，避免序号复用与唯一键冲突
        Long count = baseMapper.countByOrderNoPrefix("FO" + datePart);
        String seq = String.format("%03d", count + 1);
        return "FO" + datePart + seq;
    }

    public FosterOrderVO pay(Long id, String paymentMethod) {
        FosterOrder o = getById(id);
        if (o == null) throw new BusinessException("订单不存在");
        // 先判订单状态再判支付状态：已取消订单不应被误报为「重复支付」
        if (OrderStatus.CANCELLED.is(o.getStatus())) throw new BusinessException("已取消订单无法支付");
        if (PaymentStatus.PAID.is(o.getPaymentStatus())) throw new BusinessException("订单已支付，请勿重复支付");
        o.setPaymentStatus(PaymentStatus.PAID.getValue());
        o.setPaymentMethod(paymentMethod);
        o.setPaymentTime(LocalDateTime.now());
        o.setPaidAmount(o.getTotalFee());
        updateById(o);
        return toVO(o);
    }

    public FosterOrderVO toVO(FosterOrder o) {
        FosterOrderVO vo = new FosterOrderVO();
        vo.setId(String.valueOf(o.getOrderId()));
        vo.setOrderNo(o.getOrderNo());
        vo.setCustomerId(String.valueOf(o.getCustomerId()));
        vo.setPetId(String.valueOf(o.getPetId()));
        vo.setStartDate(o.getStartDate());
        vo.setEndDate(o.getEndDate());
        vo.setPriceId(o.getPriceId() != null ? String.valueOf(o.getPriceId()) : null);
        vo.setPricePerDay(o.getPricePerDay());
        vo.setTotalFee(o.getTotalFee());
        vo.setStatus(o.getStatus());
        vo.setRemark(o.getRemark());
        vo.setPaymentStatus(o.getPaymentStatus());
        vo.setPaymentMethod(o.getPaymentMethod());
        vo.setPaymentTime(o.getPaymentTime());
        vo.setPaidAmount(o.getPaidAmount());
        vo.setExpiresAt(o.getExpiresAt());
        if (o.getStartDate() != null && o.getEndDate() != null) {
            vo.setStayDays(Math.toIntExact(ChronoUnit.DAYS.between(o.getStartDate(), o.getEndDate()) + 1));
        }
        vo.setChargeDays(o.getChargeDays());
        vo.setDepositFee(o.getDepositFee());
        vo.setExtraFee(o.getExtraFee());
        vo.setDiscountFee(o.getDiscountFee());
        vo.setRoomId(o.getRoomId() != null ? String.valueOf(o.getRoomId()) : null);
        if (o.getPriceId() != null) {
            FosterPrice fp = fosterPriceMapper.selectById(o.getPriceId());
            if (fp != null) vo.setPriceLevelName(fp.getLevelName());
        }
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
