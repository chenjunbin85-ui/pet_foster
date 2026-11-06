package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.entity.*;
import com.petfoster.enums.OrderStatus;
import com.petfoster.mapper.*;
import com.petfoster.security.StaffAuth;
import com.petfoster.util.SecurityUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 门店运营：入离店交接单、每日巡视、异常事件、增值核销、导出留痕。
 *
 * <p>岗位判定统一走 {@link StaffAuth}（PRD 3.1 / 3.6 / 11.12）：
 * 中文旧值与 positions 多值都归一化，空岗位 fail closed，admin 落点 OWNER。
 * 写接口一律再判一次，不依赖小程序端隐藏按钮。
 */
@Service
public class StaffOpsService {

    private final StaffAuth auth;
    private final FosterOrderMapper fosterOrderMapper;
    private final FosterRoomBookingMapper roomBookingMapper;
    private final FosterHandoverMapper handoverMapper;
    private final FosterCareLogMapper careLogMapper;
    private final FosterIncidentMapper incidentMapper;
    private final FosterBillItemMapper billItemMapper;
    private final DataExportLogMapper exportLogMapper;
    private final CustomerMapper customerMapper;
    private final ServiceRecordMapper serviceRecordMapper;
    private final HealthRecordMapper healthRecordMapper;

    public StaffOpsService(StaffAuth auth, FosterOrderMapper fosterOrderMapper,
                           FosterRoomBookingMapper roomBookingMapper, FosterHandoverMapper handoverMapper,
                           FosterCareLogMapper careLogMapper, FosterIncidentMapper incidentMapper,
                           FosterBillItemMapper billItemMapper, DataExportLogMapper exportLogMapper,
                           CustomerMapper customerMapper, ServiceRecordMapper serviceRecordMapper,
                           HealthRecordMapper healthRecordMapper) {
        this.auth = auth;
        this.fosterOrderMapper = fosterOrderMapper;
        this.roomBookingMapper = roomBookingMapper;
        this.handoverMapper = handoverMapper;
        this.careLogMapper = careLogMapper;
        this.incidentMapper = incidentMapper;
        this.billItemMapper = billItemMapper;
        this.exportLogMapper = exportLogMapper;
        this.customerMapper = customerMapper;
        this.serviceRecordMapper = serviceRecordMapper;
        this.healthRecordMapper = healthRecordMapper;
    }

    private FosterOrder requireOrder(Long id) {
        FosterOrder o = fosterOrderMapper.selectById(id);
        if (o == null) throw new BusinessException("订单不存在");
        return o;
    }

    private String photos(Map<String, Object> body) {
        Object v = body.get("photoUrls") == null ? body.get("photos") : body.get("photoUrls");
        if (v == null) return null;
        String s = String.valueOf(v);
        String[] parts = s.split(",");
        return parts.length > 6 ? String.join(",", Arrays.copyOf(parts, 6)) : s;
    }

    /** C5 / D2 入离店交接：照片、物品清单、签字落 foster_handover，并做离店四项阻断。 */
    @Transactional(rollbackFor = Exception.class)
    public Object handover(Long orderId, Map<String, Object> body) {
        // PRD 3.3：FRONT 客户签字、CARE 接宠签字、DRIVER 到场/到家交接、VET 离店结论、OWNER 兜底
        auth.require("FRONT", "CARE", "DRIVER", "VET", "OWNER");
        FosterOrder order = requireOrder(orderId);
        String type = String.valueOf(body.getOrDefault("type", ""));
        LocalDateTime now = LocalDateTime.now();
        String pics = photos(body);
        boolean legacyExempt = auth.has("OWNER") && Boolean.TRUE.equals(body.get("legacyExempt"));

        if ("入店".equals(type)) {
            if (!OrderStatus.PENDING.is(order.getStatus())) throw new BusinessException("仅待入店订单可办入店交接");
            if (!legacyExempt) {
                if (!StringUtils.hasText(pics)) throw new BusinessException("入店交接必须上传现场照片（U3）");
                if (!Boolean.TRUE.equals(body.get("signed")) && !Boolean.TRUE.equals(body.get("customerSign"))) {
                    throw new BusinessException("交接人未完成签字，不能确认入店（U3）");
                }
            }
        } else if ("离店".equals(type)) {
            if (!OrderStatus.FOSTERING.is(order.getStatus())) throw new BusinessException("仅寄养中订单可办离店交接");
            if (!legacyExempt) {
                // U5：存在未闭环异常阻断离店
                Long open = incidentMapper.selectCount(new LambdaQueryWrapper<FosterIncident>()
                        .eq(FosterIncident::getOrderId, orderId)
                        .ne(FosterIncident::getStatus, "已闭环"));
                if (open != null && open > 0) throw new BusinessException("存在 " + open + " 条未闭环异常，阻断离店（U5）");
                // 兽医离店评估签署（V5 / 11.12 字段级）
                Long signed = healthRecordMapper.selectCount(new LambdaQueryWrapper<HealthRecord>()
                        .eq(HealthRecord::getOrderId, orderId)
                        .eq(HealthRecord::getType, "离店评估"));
                if (signed == null || signed == 0) throw new BusinessException("兽医未完成离店评估签署，阻断离店交接");
                // 费用结清（原型 C5「费用结清状态」）
                if ("未支付".equals(order.getPaymentStatus())
                        || (order.getPaidAmount() != null && order.getTotalFee() != null
                        && order.getPaidAmount().compareTo(order.getTotalFee()) < 0)) {
                    throw new BusinessException("费用未结清，阻断离店交接");
                }
                // U12 缺班可见随排班模块暂缓，此处仅提示不阻断（PRD FR-12）
                if (!StringUtils.hasText(pics)) throw new BusinessException("离店交接必须上传现场照片（U3）");
            }
        } else {
            throw new BusinessException("交接类型仅支持 入店/离店");
        }

        FosterHandover h = new FosterHandover();
        h.setOrderId(orderId);
        h.setType(type);
        h.setPhotoUrls(pics);
        h.setCheckItems(body.get("checkItems") == null ? null : String.valueOf(body.get("checkItems")));
        h.setBelongings(body.get("belongings") == null ? null : String.valueOf(body.get("belongings")));
        if (body.get("weight") != null) {
            try {
                h.setWeight(new BigDecimal(String.valueOf(body.get("weight"))));
            } catch (NumberFormatException ignored) {
                // 称重非必填，格式错误不阻断
            }
        }
        h.setRemark(body.get("remark") == null ? null : String.valueOf(body.get("remark")));
        h.setSignerId(SecurityUtil.getCurrentUserId());
        h.setSignerPosition(auth.positionsText());
        h.setHandoverTime(now);
        h.setCreateTime(now);
        h.setCustomerSign(Boolean.TRUE.equals(body.get("customerSign")) || Boolean.TRUE.equals(body.get("signed")) ? 1 : 0);
        if (legacyExempt) h.setRemark("[历史订单豁免] " + (h.getRemark() == null ? "" : h.getRemark()));

        if ("入店".equals(type)) {
            order.setStatus(OrderStatus.FOSTERING.getValue());
            order.setCheckInTime(now);
        } else {
            order.setStatus(OrderStatus.COMPLETED.getValue());
            order.setCheckOutTime(now);
            roomBookingMapper.update(null, new LambdaUpdateWrapper<FosterRoomBooking>()
                    .eq(FosterRoomBooking::getOrderId, orderId)
                    .set(FosterRoomBooking::getStatus, "释放"));
        }
        fosterOrderMapper.updateById(order);
        handoverMapper.insert(h);
        return h;
    }

    /** C2 巡视打卡：(order_id, log_date, shift) 幂等，重复提交只覆盖不新增（PRD 8 弱网）。 */
    @Transactional(rollbackFor = Exception.class)
    public Object careLog(Long orderId, Map<String, Object> body) {
        auth.require("CARE", "VET", "OWNER"); // 能力组 C
        FosterOrder order = requireOrder(orderId);
        if (!OrderStatus.FOSTERING.is(order.getStatus())) throw new BusinessException("仅寄养中订单可录巡视日志");
        LocalDate logDate = body.get("logDate") == null ? LocalDate.now()
                : LocalDate.parse(String.valueOf(body.get("logDate")));
        String shift = String.valueOf(body.getOrDefault("shift", "早"));
        String pics = photos(body);
        if (!StringUtils.hasText(pics)) throw new BusinessException("巡视必须至少上传 1 张现场照片（FR-09）");

        FosterCareLog c = careLogMapper.selectOne(new LambdaQueryWrapper<FosterCareLog>()
                .eq(FosterCareLog::getOrderId, orderId)
                .eq(FosterCareLog::getLogDate, logDate)
                .eq(FosterCareLog::getShift, shift)
                .last("LIMIT 1"));
        boolean isNew = c == null;
        if (isNew) {
            c = new FosterCareLog();
            c.setOrderId(orderId);
            c.setPetId(order.getPetId());
            c.setLogDate(logDate);
            c.setShift(shift);
            c.setRecorderId(SecurityUtil.getCurrentUserId());
        }
        c.setSpirit(body.get("spirit") == null ? null : String.valueOf(body.get("spirit")));
        c.setAppetite(body.get("appetite") == null ? null : String.valueOf(body.get("appetite")));
        c.setDefecation(body.get("defecation") == null ? null : String.valueOf(body.get("defecation")));
        c.setExercise(body.get("exercise") == null ? null : String.valueOf(body.get("exercise")));
        c.setCoat(body.get("coat") == null ? null : String.valueOf(body.get("coat")));
        c.setAbnormal(body.get("abnormal") == null ? null : String.valueOf(body.get("abnormal")));
        if (body.get("temperature") != null) {
            try {
                c.setTemperature(new BigDecimal(String.valueOf(body.get("temperature"))));
            } catch (NumberFormatException ignored) {
                // 体温格式错误不覆盖原值
            }
        }
        c.setPhotoUrls(pics);
        c.setRecorderPosition(auth.positionsText());
        c.setRecordTime(LocalDateTime.now());
        if (isNew) careLogMapper.insert(c);
        else careLogMapper.updateById(c);
        return c;
    }

    /** C4 异常上报：护理员只记描述，定级/处置/送医判断留给 VET（PRD 3.4 判定点 1）。 */
    @Transactional(rollbackFor = Exception.class)
    public Object incident(Long orderId, Map<String, Object> body) {
        auth.require("CARE", "VET", "GROOM", "OWNER");
        FosterOrder order = requireOrder(orderId);
        boolean needVet = Boolean.TRUE.equals(body.get("needVet"));
        if (needVet) auth.require("VET", "OWNER");
        if (!StringUtils.hasText(String.valueOf(body.getOrDefault("description", "")))) {
            throw new BusinessException("异常描述必填");
        }
        FosterIncident inc = new FosterIncident();
        inc.setOrderId(orderId);
        inc.setPetId(order.getPetId());
        inc.setOccurTime(LocalDateTime.now());
        inc.setCategory(String.valueOf(body.getOrDefault("category", "其他")));
        inc.setDescription(String.valueOf(body.get("description")));
        inc.setPhotoUrls(photos(body));
        inc.setNeedVet(needVet ? 1 : 0);
        inc.setNotifyCustomer(0);
        inc.setStatus("待处理");
        inc.setRecorderId(SecurityUtil.getCurrentUserId());
        inc.setCreateTime(LocalDateTime.now());
        // 非 VET/OWNER 一律不落处置结论
        if (auth.has("VET", "OWNER") && body.get("action") != null) {
            inc.setAction(String.valueOf(body.get("action")));
        }
        if (body.get("cost") != null) {
            BigDecimal cost = new BigDecimal(String.valueOf(body.get("cost")));
            inc.setCost(cost);
            if (cost.compareTo(BigDecimal.ZERO) > 0) {
                FosterBillItem b = new FosterBillItem();
                b.setOrderId(orderId);
                b.setItemCode("MEDICAL");
                b.setItemName("医疗费用-" + inc.getCategory());
                b.setItemType("医疗");
                b.setUnitPrice(cost);
                b.setQuantity(BigDecimal.ONE);
                b.setAmount(cost);
                b.setSource("手工");
                b.setStatus("待结算");
                b.setCreateTime(LocalDateTime.now());
                billItemMapper.insert(b);
            }
        }
        incidentMapper.insert(inc);
        return inc;
    }

    /** C6 / G3 / D3 服务核销：项目按岗位锁定，不提供跨项目选择（PRD 3.4 判定点 4）。 */
    @Transactional(rollbackFor = Exception.class)
    public Object redeem(Long orderId, Map<String, Object> body) {
        auth.require("CARE", "GROOM", "DRIVER", "OWNER");
        FosterOrder order = requireOrder(orderId);
        if (!OrderStatus.FOSTERING.is(order.getStatus())) {
            throw new BusinessException("仅寄养中订单可核销增值服务");
        }
        String item = body.get("item") == null ? "" : String.valueOf(body.get("item"));
        if (item.isBlank()) throw new BusinessException("服务项目必填");
        if (!auth.has("OWNER")) {
            String expected = null;
            if (auth.has("CARE")) expected = "遛宠";
            else if (auth.has("GROOM")) expected = "洗护";
            else if (auth.has("DRIVER")) expected = "接送";
            if (expected == null || !(expected.equals(item)
                    || ("遛宠".equals(expected) && "WALK".equalsIgnoreCase(item))
                    || ("洗护".equals(expected) && "BATH".equalsIgnoreCase(item))
                    || ("接送".equals(expected) && "PICKUP".equalsIgnoreCase(item)))) {
                throw new BusinessException("当前岗位只能核销「" + (expected == null ? "—" : expected) + "」项目，跨项目核销已拒绝");
            }
        }
        ServiceRecord r = new ServiceRecord();
        r.setOrderId(orderId);
        r.setPetId(order.getPetId());
        r.setItem(item);
        r.setContent(body.get("content") == null ? null : String.valueOf(body.get("content")));
        r.setRecordType("REDEEM");
        r.setPhotoUrls(photos(body));
        r.setRecorderPosition(auth.positionsText());
        r.setServiceTime(LocalDateTime.now());
        r.setKeeperId(SecurityUtil.getCurrentUserId());
        serviceRecordMapper.insert(r);
        return r;
    }

    /** 导出订单 CSV（手机号脱敏）并留痕 */
    public String exportOrdersCsv(String purpose) {
        auth.require("FRONT", "OWNER");
        if (purpose == null || purpose.isBlank()) throw new BusinessException("导出用途必填（留痕要求）");
        List<FosterOrder> orders = fosterOrderMapper.selectList(
                new LambdaQueryWrapper<FosterOrder>().orderByDesc(FosterOrder::getCreateTime).last("LIMIT 500"));
        StringBuilder sb = new StringBuilder();
        sb.append("orderNo,status,totalFee,phoneMasked\n");
        for (FosterOrder o : orders) {
            String phone = maskPhone(customerPhoneOf(o));
            sb.append(String.format("%s,%s,%s,%s\n",
                    csv(o.getOrderNo()), csv(o.getStatus()), o.getTotalFee(), phone));
        }
        DataExportLog log = new DataExportLog();
        log.setOperatorId(SecurityUtil.getCurrentUserId());
        log.setPurpose(purpose);
        log.setDataScope("寄养订单最近500条");
        log.setPhoneMasked(1);
        log.setCreateTime(LocalDateTime.now());
        exportLogMapper.insert(log);
        return sb.toString();
    }

    private String customerPhoneOf(FosterOrder o) {
        Customer c = customerMapper.selectById(o.getCustomerId());
        return c == null ? "" : (c.getPhone() != null ? c.getPhone() : c.getUsername());
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone == null ? "" : phone;
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private String csv(String s) {
        return s == null ? "" : s.replace(",", "，");
    }
}
