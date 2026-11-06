package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.petfoster.common.BusinessException;
import com.petfoster.entity.*;
import com.petfoster.mapper.*;
import com.petfoster.security.StaffAuth;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

/**
 * 员工端现场动作写入：护理记录、洗护作业、接送交接、兽医评估签署、
 * 异常复核与隔离/送医授权、VET 在岗确认。
 *
 * <p>每个写接口都独立判岗位（PRD 3.6「页面隐藏只是礼貌，接口必须再判一次」），
 * 兽医签署额外判「执业证有效 + 当日在岗」，fail closed 不降级代签。
 */
@Service
public class StaffActionService {

    private final StaffAuth auth;
    private final ObjectMapper json;
    private final FosterOrderMapper orderMapper;
    private final ServiceRecordMapper serviceRecordMapper;
    private final HealthRecordMapper healthRecordMapper;
    private final FosterIncidentMapper incidentMapper;
    private final FosterCareLogMapper careLogMapper;
    private final StaffShiftMapper shiftMapper;

    public StaffActionService(StaffAuth auth, ObjectMapper json, FosterOrderMapper orderMapper,
                              ServiceRecordMapper serviceRecordMapper, HealthRecordMapper healthRecordMapper,
                              FosterIncidentMapper incidentMapper, FosterCareLogMapper careLogMapper,
                              StaffShiftMapper shiftMapper) {
        this.auth = auth;
        this.json = json;
        this.orderMapper = orderMapper;
        this.serviceRecordMapper = serviceRecordMapper;
        this.healthRecordMapper = healthRecordMapper;
        this.incidentMapper = incidentMapper;
        this.careLogMapper = careLogMapper;
        this.shiftMapper = shiftMapper;
    }

    private FosterOrder requireOrder(Long id) {
        FosterOrder o = orderMapper.selectById(id);
        if (o == null) throw new BusinessException("订单不存在");
        return o;
    }

    private String bodyText(Map<String, Object> body) {
        try {
            return json.writeValueAsString(body == null ? new HashMap<>() : body);
        } catch (JsonProcessingException e) {
            return String.valueOf(body);
        }
    }

    private String photos(Map<String, Object> body) {
        Object v = body == null ? null : body.get("photoUrls");
        if (v == null) v = body == null ? null : body.get("photos");
        if (v == null) return null;
        String s = String.valueOf(v);
        // 单条最多 6 张（PRD 8 非功能需求）
        String[] parts = s.split(",");
        if (parts.length > 6) s = String.join(",", java.util.Arrays.copyOf(parts, 6));
        return s;
    }

    /** C3 日常护理记录：喂食 / 遛放 / 清洁，三个类型字段不混用。 */
    @Transactional(rollbackFor = Exception.class)
    public Object careRecord(Long orderId, Map<String, Object> body) {
        auth.require("CARE", "OWNER");
        FosterOrder o = requireOrder(orderId);
        ServiceRecord r = new ServiceRecord();
        r.setOrderId(orderId);
        r.setPetId(o.getPetId());
        r.setItem(String.valueOf(body.getOrDefault("type", "喂食")));
        r.setContent(bodyText(body));
        r.setRecordType("CARE_RECORD");
        r.setPhotoUrls(photos(body));
        r.setRecorderPosition(String.join(",", auth.positions()));
        r.setKeeperId(auth.userId());
        r.setServiceTime(LocalDateTime.now());
        serviceRecordMapper.insert(r);
        return r;
    }

    /** G2 洗护作业记录；皮肤异常必须转交，不允许直接走正常核销。 */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> groomLog(Long orderId, Map<String, Object> body) {
        auth.require("GROOM", "OWNER");
        FosterOrder o = requireOrder(orderId);
        boolean alert = Boolean.TRUE.equals(body.get("skinAlert"))
                || "红肿".equals(String.valueOf(body.get("skin")))
                || "寄生虫".equals(String.valueOf(body.get("skin")));
        ServiceRecord r = new ServiceRecord();
        r.setOrderId(orderId);
        r.setPetId(o.getPetId());
        r.setItem("洗护作业");
        r.setContent(bodyText(body));
        r.setRecordType("GROOM_LOG");
        r.setPhotoUrls(photos(body));
        r.setRecorderPosition(String.join(",", auth.positions()));
        r.setKeeperId(auth.userId());
        r.setServiceTime(LocalDateTime.now());
        serviceRecordMapper.insert(r);
        Map<String, Object> out = new HashMap<>();
        out.put("record", r);
        out.put("needTransfer", alert);
        out.put("message", alert ? "发现皮肤问题，请转交护理员 / 兽医，不得直接核销" : "作业记录已保存");
        return out;
    }

    /** D2 到场 / 送达交接拍照：定位、必拍照片、签字三项齐才可确认。 */
    @Transactional(rollbackFor = Exception.class)
    public Object pickupHandover(Long orderId, Map<String, Object> body) {
        auth.require("DRIVER", "OWNER");
        FosterOrder o = requireOrder(orderId);
        String pics = photos(body);
        if (!StringUtils.hasText(pics)) throw new BusinessException("交接现场照片必拍，不能确认交接");
        if (!Boolean.TRUE.equals(body.get("signed"))) throw new BusinessException("交接人未完成电子签字");
        if (!Boolean.TRUE.equals(body.get("located"))) throw new BusinessException("未完成到场定位打卡");
        ServiceRecord r = new ServiceRecord();
        r.setOrderId(orderId);
        r.setPetId(o.getPetId());
        r.setItem(String.valueOf(body.getOrDefault("type", "接宠交接")));
        r.setContent(bodyText(body));
        r.setRecordType("PICKUP_HANDOVER");
        r.setPhotoUrls(pics);
        r.setRecorderPosition(String.join(",", auth.positions()));
        r.setKeeperId(auth.userId());
        r.setServiceTime(LocalDateTime.now());
        serviceRecordMapper.insert(r);
        return r;
    }

    /** V2 入店评估签署 / V5 离店评估签署：只录外部处方编号，不存处方内容。 */
    @Transactional(rollbackFor = Exception.class)
    public Object healthAssessment(Long orderId, Map<String, Object> body) {
        auth.requireVet();
        FosterOrder o = requireOrder(orderId);
        String type = String.valueOf(body.getOrDefault("type", "入店评估"));
        if (!"入店评估".equals(type) && !"离店评估".equals(type)) {
            throw new BusinessException("评估类型仅支持 入店评估 / 离店评估");
        }
        if (!Boolean.TRUE.equals(body.get("signed"))) {
            throw new BusinessException("兽医未完成手写签署，不得生成评估结论");
        }
        if ("离店评估".equals(type)) {
            Long open = incidentMapper.selectCount(new LambdaQueryWrapper<FosterIncident>()
                    .eq(FosterIncident::getOrderId, orderId)
                    .ne(FosterIncident::getStatus, "已闭环"));
            if (open != null && open > 0) {
                throw new BusinessException("存在 " + open + " 条未闭环异常，不得签署放行离店");
            }
        }
        HealthRecord h = new HealthRecord();
        h.setPetId(o.getPetId());
        h.setOrderId(orderId);
        h.setType(type);
        h.setTemperature(toDecimal(body.get("temperature")));
        h.setSpirit(String.valueOf(body.getOrDefault("spirit", "")));
        h.setSkin(String.valueOf(body.getOrDefault("skinExam", "")));
        h.setAbnormal(String.valueOf(body.getOrDefault("screening", "")));
        h.setTreatment(String.valueOf(body.getOrDefault("conclusion", "")));
        h.setPrescriptionRef(String.valueOf(body.getOrDefault("prescriptionRef", "")));
        h.setRecorderId(auth.userId());
        h.setRecorderPosition("VET");
        h.setVerifiedBy(auth.userId());
        h.setVerifiedAt(LocalDateTime.now());
        h.setRecordTime(LocalDateTime.now());
        healthRecordMapper.insert(h);
        return h;
    }

    private BigDecimal toDecimal(Object v) {
        if (v == null || String.valueOf(v).isBlank()) return null;
        try {
            return new BigDecimal(String.valueOf(v));
        } catch (NumberFormatException e) {
            throw new BusinessException("体温格式不正确");
        }
    }

    /** V3 异常复核与处置：护理员原始上报内容不可修改，verified_by 记录复核兽医。 */
    @Transactional(rollbackFor = Exception.class)
    public Object reviewIncident(Long id, Map<String, Object> body) {
        auth.requireVet();
        FosterIncident inc = incidentMapper.selectById(id);
        if (inc == null) throw new BusinessException("异常记录不存在");
        if (!StringUtils.hasText(String.valueOf(body.getOrDefault("level", "")))) {
            throw new BusinessException("异常定级必填");
        }
        Map<String, Object> review = new HashMap<>(body);
        review.put("verifiedBy", auth.userId());
        review.put("certNo", auth.certNo());
        review.put("signedAt", LocalDateTime.now().toString());
        review.put("recorderPosition", "VET");
        inc.setAction(bodyText(review));
        inc.setStatus(Boolean.TRUE.equals(body.get("close")) ? "已闭环" : "处理中");
        if (Boolean.TRUE.equals(body.get("close"))) {
            if (inc.getNotifyCustomer() == null || inc.getNotifyCustomer() != 1
                    || !StringUtils.hasText(inc.getNotifyChannel()) || inc.getNotifyTime() == null) {
                throw new BusinessException("未登记客户通知渠道与时间，异常不能闭环（U16）");
            }
            inc.setCloseNote(String.valueOf(body.getOrDefault("closeNote", "兽医复核后闭环")));
        }
        incidentMapper.updateById(inc);
        return inc;
    }

    /** V4 隔离 / 送医授权：客户通知是硬前置；紧急由 OWNER 先记、24 小时内 VET 补签。 */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> authorizeIncident(Long id, Map<String, Object> body) {
        FosterIncident inc = incidentMapper.selectById(id);
        if (inc == null) throw new BusinessException("异常记录不存在");
        if (!Boolean.TRUE.equals(body.get("notified"))) {
            throw new BusinessException("未确认「已通知客户」，禁止提交授权");
        }
        String channel = String.valueOf(body.getOrDefault("notifyChannel", ""));
        if (!StringUtils.hasText(channel)) throw new BusinessException("通知渠道必填（电话 / 微信 / 短信）");
        inc.setNotifyCustomer(1);
        inc.setNotifyChannel(channel);
        inc.setNotifyTime(LocalDateTime.now());

        Map<String, Object> out = new HashMap<>();
        if (auth.has("OWNER") && !auth.vetReady()) {
            // 紧急兜底：不写授权人，24 小时内须由在岗兽医补签，异常保持未闭环
            inc.setAction("[紧急兜底·待兽医24小时内补签] " + String.valueOf(body.getOrDefault("reason", "")));
            out.put("emergency", true);
            out.put("message", "已按紧急路径记录，异常保持未闭环，须由在岗兽医 24 小时内补签");
        } else {
            auth.requireVet();
            String type = String.valueOf(body.getOrDefault("type", "隔离"));
            if (!"隔离".equals(type) && !"送医".equals(type)) {
                throw new BusinessException("授权类型仅支持 隔离 / 送医");
            }
            inc.setVetAuthorizedBy(auth.userId());
            inc.setVetAuthorizedAt(LocalDateTime.now());
            inc.setVetHospital(String.valueOf(body.getOrDefault("hospital", "")));
            inc.setAction("[" + type + "授权] " + String.valueOf(body.getOrDefault("reason", ""))
                    + "；通知渠道=" + channel + "；证号=" + auth.certNo() + "；签署人=" + auth.staffName());
            inc.setStatus("处理中");
            out.put("emergency", false);
            out.put("message", type + "授权已签署");
        }
        incidentMapper.updateById(inc);
        out.put("incident", inc);
        return out;
    }

    /** V1 在岗确认：写当日 VET 班次（排班模块暂不实现，仅支撑 U20/U21 在岗判定）。 */
    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> confirmDuty(Map<String, Object> body) {
        auth.require("VET");
        LocalDate today = LocalDate.now();
        Long exists = shiftMapper.selectCount(new LambdaQueryWrapper<StaffShift>()
                .eq(StaffShift::getStaffId, auth.userId())
                .eq(StaffShift::getShiftDate, today));
        if (exists == null || exists == 0) {
            StaffShift s = new StaffShift();
            s.setStaffId(auth.userId());
            s.setShiftDate(today);
            s.setShiftType("FULL");
            s.setDuty("VET");
            s.setRemark("staff-miniprogram-duty-confirm");
            s.setCreateTime(LocalDateTime.now());
            shiftMapper.insert(s);
        }
        Map<String, Object> out = new HashMap<>();
        out.put("onDuty", true);
        out.put("vetReady", auth.vetReady());
        out.put("certNo", auth.certNo());
        out.put("message", auth.vetReady() ? "今日已确认在岗，可开展评估与签署"
                : "已确认在岗，但执业兽医证无效或缺失，签署仍被阻断");
        return out;
    }
}
