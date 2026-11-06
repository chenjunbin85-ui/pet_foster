package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.petfoster.common.BusinessException;
import com.petfoster.common.PageResult;
import com.petfoster.dto.MpOrderCreateDTO;
import com.petfoster.entity.*;
import com.petfoster.enums.OrderStatus;
import com.petfoster.enums.PaymentMethod;
import com.petfoster.enums.PaymentStatus;
import com.petfoster.mapper.*;
import com.petfoster.util.VaccineJson;
import com.petfoster.vo.FosterOrderVO;
import com.petfoster.vo.MpStatsVO;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 小程序端寄养订单（仅本人数据）。
 *
 * <p>PRD 口径：
 * <ul>
 *   <li>按天计费：charge_days = 离店-入住+1（同日 1 天）</li>
 *   <li>防超订：同档位活跃占用数 &gt;= 房位数即拒绝（区间半开重叠）</li>
 *   <li>增值服务另收并落 foster_bill_item（day×charge_days / once×1）</li>
 *   <li>定金 = round(房费 × deposit.ratio, 2)，落 deposit_fee</li>
 *   <li>未免疫宠物不可下单；下单即视为已支付（演示，不接真实支付）</li>
 * </ul>
 */
@Service
public class MpOrderService {

    public static final int PAY_TIMEOUT_MINUTES = 15;

    private final FosterOrderMapper fosterOrderMapper;
    private final PetMapper petMapper;
    private final FosterOrderService fosterOrderService;
    private final FosterRoomMapper fosterRoomMapper;
    private final FosterRoomBookingMapper roomBookingMapper;
    private final FosterBillItemMapper billItemMapper;
    private final ServiceItemMapper serviceItemMapper;
    private final BizRuleMapper bizRuleMapper;

    public MpOrderService(FosterOrderMapper fosterOrderMapper, PetMapper petMapper,
                          FosterOrderService fosterOrderService,
                          FosterRoomMapper fosterRoomMapper,
                          FosterRoomBookingMapper roomBookingMapper,
                          FosterBillItemMapper billItemMapper,
                          ServiceItemMapper serviceItemMapper,
                          BizRuleMapper bizRuleMapper) {
        this.fosterOrderMapper = fosterOrderMapper;
        this.petMapper = petMapper;
        this.fosterOrderService = fosterOrderService;
        this.fosterRoomMapper = fosterRoomMapper;
        this.roomBookingMapper = roomBookingMapper;
        this.billItemMapper = billItemMapper;
        this.serviceItemMapper = serviceItemMapper;
        this.bizRuleMapper = bizRuleMapper;
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

    /** 取业务规则数值（最新生效日），缺省返回 defaultVal */
    private BigDecimal ruleValue(String key, BigDecimal defaultVal) {
        BizRule r = bizRuleMapper.selectOne(new LambdaQueryWrapper<BizRule>()
                .eq(BizRule::getRuleKey, key)
                .orderByDesc(BizRule::getEffectiveFrom)
                .last("LIMIT 1"));
        if (r == null || !StringUtils.hasText(r.getRuleValue())) return defaultVal;
        try { return new BigDecimal(r.getRuleValue()); }
        catch (Exception e) { return defaultVal; }
    }

    @Transactional(rollbackFor = Exception.class)
    public FosterOrderVO create(MpOrderCreateDTO dto, Long customerId) {
        Pet pet = petMapper.selectById(dto.getPetId());
        if (pet == null) throw new BusinessException("宠物不存在");
        if (!pet.getCustomerId().equals(customerId)) throw new BusinessException("无权为他人宠物下单");
        if (!VaccineJson.isVaccinated(pet.getVaccine())) throw new BusinessException("该宠物未完成免疫，暂不可下单");

        LocalDate start = dto.getStartDate();
        LocalDate end = dto.getEndDate();
        if (start.isBefore(LocalDate.now())) throw new BusinessException("入住日期不能早于今天");
        if (end.isBefore(start)) throw new BusinessException("离店日期不能早于入住日期");

        FosterPrice price = fosterOrderService.resolvePrice(dto.getPriceId());
        long chargeDays = Math.max(1, ChronoUnit.DAYS.between(start, end) + 1);

        // 猫犬分区：犬→犬舍，猫→猫舍
        String roomType = "猫".equals(pet.getSpecies()) ? "猫舍" : ("犬".equals(pet.getSpecies()) ? "犬舍" : null);

        // —— 防超订：同档位+同品类房位数 vs 重叠区间的活跃占用数 ——
        Long roomId = allocateRoom(dto.getPriceId(), start, end, roomType);
        if (roomId == null) {
            throw new BusinessException("该房型无可用房，请更换日期或档位");
        }

        BigDecimal roomFee = price.getPricePerDay().multiply(BigDecimal.valueOf(chargeDays))
                .setScale(2, RoundingMode.HALF_UP);

        // —— 增值服务：按 unit_type 计价并落账单明细 ——
        BigDecimal extraFee = BigDecimal.ZERO;
        List<ServiceItem> picked = resolveServices(dto.getServiceCodes());
        LocalDateTime now = LocalDateTime.now();

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
        order.setPaymentStatus(PaymentStatus.PAID.getValue());
        order.setPaymentMethod(PaymentMethod.WECHAT.getValue());
        order.setPaymentTime(now);
        order.setRemark(dto.getRemark());
        order.setChargeDays((int) chargeDays);
        order.setRoomId(roomId);
        order.setCreatorId(customerId);
        order.setCreateTime(now);

        // 定金 = round(房费 × ratio, 2)
        BigDecimal deposit = roomFee.multiply(ruleValue("deposit.ratio", new BigDecimal("0.30")))
                .setScale(2, RoundingMode.HALF_UP);
        order.setDepositFee(deposit);

        fosterOrderMapper.insert(order);

        // 房费明细
        insertBillItem(order.getOrderId(), "ROOM", "房费（" + chargeDays + "个照护日）", "房费",
                price.getPricePerDay(), BigDecimal.valueOf(chargeDays), roomFee, now);

        // 增值服务明细
        for (ServiceItem si : picked) {
            BigDecimal qty = "day".equalsIgnoreCase(si.getUnitType())
                    ? BigDecimal.valueOf(chargeDays) : BigDecimal.ONE;
            BigDecimal amount = si.getPrice().multiply(qty).setScale(2, RoundingMode.HALF_UP);
            extraFee = extraFee.add(amount);
            insertBillItem(order.getOrderId(), "SERVICE_" + si.getServiceCode(),
                    si.getServiceName(), "增值", si.getPrice(), qty, amount, now);
        }
        order.setExtraFee(extraFee);

        BigDecimal totalFee = roomFee.add(extraFee).setScale(2, RoundingMode.HALF_UP);
        order.setTotalFee(totalFee);
        order.setPaidAmount(totalFee);
        fosterOrderMapper.updateById(order);

        // 房间占用（下单即支付 → 占用）
        FosterRoomBooking booking = new FosterRoomBooking();
        booking.setRoomId(roomId);
        booking.setOrderId(order.getOrderId());
        booking.setOccupyStart(start);
        booking.setOccupyEnd(end.plusDays(1)); // 半开区间：离店日当天释放
        booking.setStatus("占用");
        booking.setCreateTime(now);
        roomBookingMapper.insert(booking);

        return fosterOrderService.toVO(order);
    }

    private void insertBillItem(Long orderId, String code, String name, String type,
                                BigDecimal unitPrice, BigDecimal qty, BigDecimal amount, LocalDateTime now) {
        FosterBillItem item = new FosterBillItem();
        item.setOrderId(orderId);
        item.setItemCode(code);
        item.setItemName(name);
        item.setItemType(type);
        item.setUnitPrice(unitPrice);
        item.setQuantity(qty);
        item.setAmount(amount);
        item.setSource("系统");
        item.setStatus("待结算");
        item.setCreateTime(now);
        billItemMapper.insert(item);
    }

    private List<ServiceItem> resolveServices(List<String> codes) {
        if (codes == null || codes.isEmpty()) return Collections.emptyList();
        List<ServiceItem> all = serviceItemMapper.selectList(new LambdaQueryWrapper<ServiceItem>()
                .eq(ServiceItem::getStatus, 1));
        Set<String> wanted = new HashSet<>(codes);
        return all.stream().filter(s -> wanted.contains(s.getServiceCode())).collect(Collectors.toList());
    }

    /**
     * 在指定档位找一间可订房：可用房位数 = 该档 deleted=0 的房间数；
     * 重叠区间 [start, end+1) 的活跃占用数（状态!=释放）。空闲房 = 房位数 - 活跃占用数。
     * 采用先查可用数再取第一间空闲房的方式（演示库单门店，行锁在高并发下可升级为 SELECT ... FOR UPDATE）。
     */
    Long allocateRoom(Long priceId, LocalDate start, LocalDate end, String roomType) {
        List<FosterRoom> allTier = fosterRoomMapper.selectList(new LambdaQueryWrapper<FosterRoom>()
                .eq(FosterRoom::getPriceId, priceId)
                .eq(FosterRoom::getDeleted, 0));
        // 猫犬分区：在 Java 侧按房型过滤（避免 JDBC 中文参数字符集问题）
        List<FosterRoom> tierRooms = allTier.stream()
                .filter(r -> roomType == null || roomType.equals(r.getRoomType()))
                .collect(Collectors.toList());
        long roomCount = tierRooms.size();
        if (roomCount == 0) return null;
        // 半开区间重叠：existing.occupy_start < endExclusive && existing.occupy_end > start
        LocalDate endExclusive = end.plusDays(1);
        List<FosterRoomBooking> active = roomBookingMapper.selectList(
                new LambdaQueryWrapper<FosterRoomBooking>()
                        .ne(FosterRoomBooking::getStatus, "释放"));
        // 只统计与本档位+品类房间有关的占用
        Set<Long> tierRoomIds = tierRooms.stream().map(FosterRoom::getRoomId).collect(Collectors.toSet());
        long overlapping = active.stream()
                .filter(b -> tierRoomIds.contains(b.getRoomId()))
                .filter(b -> b.getOccupyStart().isBefore(endExclusive) && b.getOccupyEnd().isAfter(start))
                .count();
        if (overlapping >= roomCount) return null;
        // 取一个在该区间未被占用的房间
        for (Long rid : tierRoomIds) {
            boolean used = active.stream()
                    .anyMatch(b -> b.getRoomId().equals(rid)
                            && b.getOccupyStart().isBefore(endExclusive)
                            && b.getOccupyEnd().isAfter(start));
            if (!used) return rid;
        }
        return null;
    }

    /** 演示支付：模拟微信支付成功，不发起真实扣款 */
    public FosterOrderVO pay(Long id, Long customerId) {
        FosterOrder order = requireOwned(id, customerId);
        if (PaymentStatus.PAID.is(order.getPaymentStatus())) throw new BusinessException("订单已支付，请勿重复支付");
        if (OrderStatus.CANCELLED.is(order.getStatus())) throw new BusinessException("已取消订单无法支付");
        order.setPaymentStatus(PaymentStatus.PAID.getValue());
        order.setPaymentMethod(PaymentMethod.WECHAT.getValue());
        order.setPaymentTime(LocalDateTime.now());
        order.setPaidAmount(order.getTotalFee());
        fosterOrderMapper.updateById(order);
        return fosterOrderService.toVO(order);
    }

    /** 取消订单：已支付走演示退款，释放房间占用，账单明细转已退款 */
    @Transactional(rollbackFor = Exception.class)
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

        // 释放房间占用
        roomBookingMapper.update(null, new LambdaUpdateWrapper<FosterRoomBooking>()
                .eq(FosterRoomBooking::getOrderId, order.getOrderId())
                .set(FosterRoomBooking::getStatus, "释放"));
        // 账单明细转已退款
        FosterBillItem refund = new FosterBillItem();
        refund.setStatus("已退款");
        billItemMapper.update(refund, new LambdaQueryWrapper<FosterBillItem>()
                .eq(FosterBillItem::getOrderId, order.getOrderId()));
        return fosterOrderService.toVO(order);
    }

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
        if (order == null) throw new BusinessException("订单不存在");
        if (!order.getCustomerId().equals(customerId)) throw new BusinessException("无权操作该订单");
        return order;
    }
}
