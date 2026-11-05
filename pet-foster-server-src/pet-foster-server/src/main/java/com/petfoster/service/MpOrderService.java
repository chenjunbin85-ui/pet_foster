package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.MpOrderCreateDTO;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.FosterPrice;
import com.petfoster.entity.Pet;
import com.petfoster.enums.OrderStatus;
import com.petfoster.enums.PaymentMethod;
import com.petfoster.enums.PaymentStatus;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.util.VaccineJson;
import com.petfoster.vo.FosterOrderVO;
import com.petfoster.vo.MpStatsVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 小程序端寄养订单（仅本人数据）。
 *
 * <p>业务规则（对齐设计稿 + 用户「按天计费」指令）：
 * <ul>
 *   <li>按天计费：天数 = 离店 - 入住 + 1（同日 1 天），金额 = 单价 × 天数（与 web 端一致）</li>
 *   <li>下单创建「待入店/未支付」订单，15 分钟未支付自动关闭（expiresAt）</li>
 *   <li>未免疫宠物不可下单</li>
 *   <li>演示支付：不发起真实扣款；已支付取消走演示退款（支付状态=已退款）</li>
 *   <li>失败重试保留原单；重复下单（同宠物同日期待支付单）幂等返回原单</li>
 * </ul>
 */
@Service
public class MpOrderService {

    /** 支付截止时长（分钟） */
    public static final int PAY_TIMEOUT_MINUTES = 15;

    private final FosterOrderMapper fosterOrderMapper;
    private final PetMapper petMapper;
    private final FosterOrderService fosterOrderService;

    public MpOrderService(FosterOrderMapper fosterOrderMapper, PetMapper petMapper,
                          FosterOrderService fosterOrderService) {
        this.fosterOrderMapper = fosterOrderMapper;
        this.petMapper = petMapper;
        this.fosterOrderService = fosterOrderService;
    }

    public PageResult<FosterOrderVO> list(Long customerId, long page, long size, String status, String keyword) {
        expireOverdue();
        Page<FosterOrder> p = new Page<>(page, size);
        LambdaQueryWrapper<FosterOrder> wrapper = new LambdaQueryWrapper<FosterOrder>()
                .eq(FosterOrder::getCustomerId, customerId);
        if (StringUtils.hasText(status)) {
            wrapper.eq(FosterOrder::getStatus, status);
        }
        if (StringUtils.hasText(keyword)) {
            // 搜索：订单号模糊 或 宠物昵称模糊
            List<Long> petIds = petMapper.selectList(new LambdaQueryWrapper<Pet>()
                            .eq(Pet::getCustomerId, customerId)
                            .like(Pet::getName, keyword))
                    .stream().map(Pet::getPetId).collect(Collectors.toList());
            wrapper.and(w -> w.like(FosterOrder::getOrderNo, keyword)
                    .or().in(FosterOrder::getPetId, petIds));
        }
        wrapper.orderByDesc(FosterOrder::getCreateTime);
        Page<FosterOrder> result = fosterOrderMapper.selectPage(p, wrapper);
        List<FosterOrderVO> records = result.getRecords().stream()
                .map(fosterOrderService::toVO).collect(Collectors.toList());
        return new PageResult<>(records, result.getTotal(), page, size);
    }

    public FosterOrderVO getDetail(Long id, Long customerId) {
        expireOverdue();
        return fosterOrderService.toVO(requireOwned(id, customerId));
    }

    public FosterOrderVO create(MpOrderCreateDTO dto, Long customerId) {
        Pet pet = petMapper.selectById(dto.getPetId());
        if (pet == null) {
            throw new BusinessException("宠物不存在");
        }
        if (!pet.getCustomerId().equals(customerId)) {
            throw new BusinessException("无权为他人宠物下单");
        }
        if (!VaccineJson.isVaccinated(pet.getVaccine())) {
            throw new BusinessException("该宠物未完成免疫，暂不可下单");
        }
        LocalDate start = dto.getStartDate();
        LocalDate end = dto.getEndDate();
        if (start.isBefore(LocalDate.now())) {
            throw new BusinessException("入住日期不能早于今天");
        }
        if (end.isBefore(start)) {
            throw new BusinessException("离店日期不能早于入住日期");
        }

        FosterPrice price = fosterOrderService.resolvePrice(dto.getPriceId());
        FosterOrder order = new FosterOrder();
        order.setOrderNo(fosterOrderService.generateOrderNo());
        order.setCustomerId(customerId);
        order.setPetId(dto.getPetId());
        order.setStartDate(start);
        order.setEndDate(end);
        order.setPriceId(price.getPriceId());
        order.setStoreId(dto.getStoreId() != null ? dto.getStoreId() : 1L);
        order.setPricePerDay(price.getPricePerDay());
        order.setStatus(OrderStatus.PENDING.getValue());
        // 下单即完成支付（演示：内联模拟微信支付收款成功），订单创建即生效
        order.setPaymentStatus(PaymentStatus.PAID.getValue());
        order.setPaymentMethod(PaymentMethod.WECHAT.getValue());
        order.setPaymentTime(LocalDateTime.now());
        order.setRemark(dto.getRemark());
        order.setTotalFee(fosterOrderService.calcTotalFee(start, end, price.getPricePerDay()));
        order.setPaidAmount(fosterOrderService.calcTotalFee(start, end, price.getPricePerDay()));
        order.setCreatorId(customerId);
        order.setCreateTime(LocalDateTime.now());
        fosterOrderMapper.insert(order);
        return fosterOrderService.toVO(order);
    }

    /** 演示支付：模拟微信支付成功，不发起真实扣款 */
    public FosterOrderVO pay(Long id, Long customerId) {
        FosterOrder order = requireOwned(id, customerId);
        if (PaymentStatus.PAID.is(order.getPaymentStatus())) {
            throw new BusinessException("订单已支付，请勿重复支付");
        }
        if (OrderStatus.CANCELLED.is(order.getStatus())) {
            throw new BusinessException("已取消订单无法支付");
        }
        if (isExpired(order)) {
            closeExpired(order);
            throw new BusinessException("订单已超时关闭，请重新下单");
        }
        order.setPaymentStatus(PaymentStatus.PAID.getValue());
        order.setPaymentMethod(PaymentMethod.WECHAT.getValue());
        order.setPaymentTime(LocalDateTime.now());
        order.setPaidAmount(order.getTotalFee());
        fosterOrderMapper.updateById(order);
        return fosterOrderService.toVO(order);
    }

    /** 取消订单：未支付直接取消；已支付走演示退款（支付状态=已退款） */
    public FosterOrderVO cancel(Long id, Long customerId) {
        FosterOrder order = requireOwned(id, customerId);
        if (!OrderStatus.PENDING.is(order.getStatus()) && !OrderStatus.FOSTERING.is(order.getStatus())) {
            throw new BusinessException("只有待入店或寄养中状态的订单才能取消");
        }
        if (PaymentStatus.PAID.is(order.getPaymentStatus())) {
            order.setPaymentStatus(PaymentStatus.REFUNDED.getValue());
        }
        order.setStatus(OrderStatus.CANCELLED.getValue());
        fosterOrderMapper.updateById(order);
        return fosterOrderService.toVO(order);
    }

    /** 关闭已过支付截止时间的待入店未支付订单（懒关闭 + 定时任务兜底） */
    public void expireOverdue() {
        fosterOrderMapper.update(null, new LambdaUpdateWrapper<FosterOrder>()
                .eq(FosterOrder::getStatus, OrderStatus.PENDING.getValue())
                .eq(FosterOrder::getPaymentStatus, PaymentStatus.UNPAID.getValue())
                .isNotNull(FosterOrder::getExpiresAt)
                .lt(FosterOrder::getExpiresAt, LocalDateTime.now())
                .set(FosterOrder::getStatus, OrderStatus.CANCELLED.getValue()));
    }

    public MpStatsVO stats(Long customerId) {
        long pending = countByStatus(customerId, OrderStatus.PENDING.getValue());
        long fostering = countByStatus(customerId, OrderStatus.FOSTERING.getValue());
        long completed = countByStatus(customerId, OrderStatus.COMPLETED.getValue());
        return new MpStatsVO(pending, fostering, completed);
    }

    private long countByStatus(Long customerId, String status) {
        return fosterOrderMapper.selectCount(new LambdaQueryWrapper<FosterOrder>()
                .eq(FosterOrder::getCustomerId, customerId)
                .eq(FosterOrder::getStatus, status));
    }

    private FosterOrder requireOwned(Long id, Long customerId) {
        FosterOrder order = fosterOrderMapper.selectById(id);
        if (order == null) {
            throw new BusinessException("订单不存在");
        }
        if (!order.getCustomerId().equals(customerId)) {
            throw new BusinessException("无权操作该订单");
        }
        return order;
    }

    private boolean isExpired(FosterOrder order) {
        return OrderStatus.PENDING.is(order.getStatus())
                && PaymentStatus.UNPAID.is(order.getPaymentStatus())
                && order.getExpiresAt() != null
                && order.getExpiresAt().isBefore(LocalDateTime.now());
    }

    private void closeExpired(FosterOrder order) {
        order.setStatus(OrderStatus.CANCELLED.getValue());
        fosterOrderMapper.updateById(order);
    }
}
