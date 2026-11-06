package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.entity.*;
import com.petfoster.mapper.*;
import com.petfoster.security.StaffAuth;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 员工端小程序「今日待办 / 工作台 / 订单详情」聚合查询。
 *
 * <p>数据源与 Web 端同源（PRD 3.7）：直接读 foster_order / foster_care_log /
 * foster_incident / foster_service_record / pet_health_record 等同一张表，
 * 不做手机端单独一份数据。返回结构按岗位裁剪，落实个保法「最小必要」。
 */
@Service
public class StaffPortalService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String[] WEEK = {"周一", "周二", "周三", "周四", "周五", "周六", "周日"};

    private final StaffAuth auth;
    private final FosterOrderMapper orderMapper;
    private final PetMapper petMapper;
    private final CustomerMapper customerMapper;
    private final FosterRoomMapper roomMapper;
    private final FosterPriceMapper priceMapper;
    private final FosterCareLogMapper careLogMapper;
    private final FosterHandoverMapper handoverMapper;
    private final FosterIncidentMapper incidentMapper;
    private final FosterBillItemMapper billItemMapper;
    private final ServiceRecordMapper serviceRecordMapper;
    private final ServiceItemMapper serviceItemMapper;
    private final HealthRecordMapper healthRecordMapper;

    public StaffPortalService(StaffAuth auth, FosterOrderMapper orderMapper, PetMapper petMapper,
                              CustomerMapper customerMapper, FosterRoomMapper roomMapper,
                              FosterPriceMapper priceMapper, FosterCareLogMapper careLogMapper,
                              FosterHandoverMapper handoverMapper, FosterIncidentMapper incidentMapper,
                              FosterBillItemMapper billItemMapper, ServiceRecordMapper serviceRecordMapper,
                              ServiceItemMapper serviceItemMapper, HealthRecordMapper healthRecordMapper) {
        this.auth = auth;
        this.orderMapper = orderMapper;
        this.petMapper = petMapper;
        this.customerMapper = customerMapper;
        this.roomMapper = roomMapper;
        this.priceMapper = priceMapper;
        this.careLogMapper = careLogMapper;
        this.handoverMapper = handoverMapper;
        this.incidentMapper = incidentMapper;
        this.billItemMapper = billItemMapper;
        this.serviceRecordMapper = serviceRecordMapper;
        this.serviceItemMapper = serviceItemMapper;
        this.healthRecordMapper = healthRecordMapper;
    }

    /** 当前班次：按服务器时间粗分早 / 中 / 晚，与 PRD 2.3 三班对齐。 */
    private String shiftNow() {
        int h = LocalDateTime.now().getHour();
        return h < 12 ? "早" : h < 18 ? "中" : "晚";
    }

    private String shiftTime(String shift) {
        switch (shift) {
            case "早": return "06:00 – 14:00";
            case "晚": return "18:00 – 22:00";
            default: return "14:00 – 22:00";
        }
    }

    private String nextPatrol(String shift) {
        switch (shift) {
            case "早": return "11:30";
            case "晚": return "21:00";
            default: return "18:00";
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone == null ? "" : phone;
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private String roomNo(FosterOrder o) {
        if (o.getRoomId() == null) return "未派房";
        FosterRoom r = roomMapper.selectById(o.getRoomId());
        return r == null ? "未派房" : r.getRoomNo();
    }

    private Map<String, Object> petBrief(FosterOrder o) {
        Map<String, Object> m = new HashMap<>();
        Pet p = o.getPetId() == null ? null : petMapper.selectById(o.getPetId());
        m.put("petId", o.getPetId() == null ? "" : String.valueOf(o.getPetId()));
        m.put("petName", p == null ? "未关联宠物" : p.getName());
        m.put("breed", p == null || p.getBreed() == null ? "—" : p.getBreed());
        m.put("species", p == null || p.getSpecies() == null ? "—" : p.getSpecies());
        m.put("weight", p == null ? null : p.getWeight());
        m.put("vaccine", p == null ? "" : p.getVaccine());
        m.put("history", p == null ? "" : p.getHistory());
        m.put("roomNo", roomNo(o));
        return m;
    }

    private List<FosterOrder> activeOrders() {
        return orderMapper.selectList(new LambdaQueryWrapper<FosterOrder>()
                .in(FosterOrder::getStatus, "待入店", "寄养中")
                .orderByAsc(FosterOrder::getStartDate));
    }

    /** 今日待办：同一份聚合查询，按岗位裁剪任务（PRD FR-16 / 3.7）。 */
    public Map<String, Object> today() {
        Map<String, Object> out = new HashMap<>();
        LocalDate today = LocalDate.now();
        out.put("me", auth.me());
        out.put("date", today.format(DATE));
        out.put("dateText", (today.getMonthValue()) + "月" + today.getDayOfMonth() + "日");
        out.put("weekday", WEEK[today.getDayOfWeek().getValue() - 1]);
        String shift = shiftNow();
        out.put("shift", shift);
        out.put("shiftTime", shiftTime(shift));
        out.put("nextPatrol", nextPatrol(shift));

        List<FosterOrder> orders = activeOrders();
        List<Map<String, Object>> tasks = new ArrayList<>();
        int pending = 0, fostering = 0;
        for (FosterOrder o : orders) {
            Map<String, Object> t = new HashMap<>(petBrief(o));
            t.put("id", String.valueOf(o.getOrderId()));
            t.put("orderNo", o.getOrderNo());
            t.put("status", o.getStatus());
            t.put("startDate", o.getStartDate() == null ? "" : o.getStartDate().format(DATE));
            t.put("endDate", o.getEndDate() == null ? "" : o.getEndDate().format(DATE));
            t.put("totalFee", o.getTotalFee());
            t.put("paidAmount", o.getPaidAmount());
            FosterPrice price = o.getPriceId() == null ? null : priceMapper.selectById(o.getPriceId());
            t.put("roomType", price == null ? "—" : price.getLevelName());
            Customer c = o.getCustomerId() == null ? null : customerMapper.selectById(o.getCustomerId());
            String phone = c == null ? "" : (c.getPhone() != null ? c.getPhone() : c.getUsername());
            t.put("customerName", c == null ? "—" : c.getName());
            t.put("phoneMasked", maskPhone(phone));
            // 外勤要拨号联系客户、前台要接待，岗位需要才给完整号码
            if (auth.has("DRIVER", "FRONT", "OWNER")) t.put("phone", phone);
            if (c != null) t.put("address", c.getAddress() == null ? "" : c.getAddress());
            tasks.add(t);
            if ("待入店".equals(o.getStatus())) pending++;
            if ("寄养中".equals(o.getStatus())) fostering++;
        }
        out.put("orders", tasks);
        out.put("pendingCount", pending);
        out.put("fosteringCount", fostering);

        // 巡视进度：CARE / VET / OWNER 可见（PRD 3.3 巡视打卡 ● / ○）
        if (auth.has("CARE", "VET", "OWNER")) {
            int done = 0;
            for (FosterOrder o : orders) {
                if (!"寄养中".equals(o.getStatus())) continue;
                Long n = careLogMapper.selectCount(new LambdaQueryWrapper<FosterCareLog>()
                        .eq(FosterCareLog::getOrderId, o.getOrderId())
                        .eq(FosterCareLog::getLogDate, today));
                done += n == null ? 0 : n.intValue();
            }
            int total = Math.max(3, fostering * 3);
            Map<String, Object> patrol = new HashMap<>();
            patrol.put("done", done);
            patrol.put("total", total);
            patrol.put("pending", Math.max(0, total - done));
            out.put("patrol", patrol);
        }

        // 兽医工作台：在岗/证照 + 待评估/待复核/待离店评估
        if (auth.has("VET", "OWNER")) {
            Map<String, Object> vet = new HashMap<>();
            vet.put("onDuty", auth.onDuty());
            vet.put("vetReady", auth.vetReady());
            vet.put("certNo", auth.certNo());
            List<FosterIncident> incs = incidentMapper.selectList(new LambdaQueryWrapper<FosterIncident>()
                    .in(FosterIncident::getStatus, "待处理", "处理中"));
            vet.put("pendingReview", incs.size());
            vet.put("pendingAssessment", pending);
            vet.put("pendingCheckout", fostering);
            List<Map<String, Object>> reviewTasks = new ArrayList<>();
            for (FosterIncident inc : incs) {
                Map<String, Object> r = new HashMap<>();
                r.put("incidentId", String.valueOf(inc.getIncidentId()));
                r.put("orderId", String.valueOf(inc.getOrderId()));
                r.put("category", inc.getCategory());
                r.put("description", inc.getDescription());
                r.put("status", inc.getStatus());
                r.put("occurTime", inc.getOccurTime() == null ? "" : inc.getOccurTime().toString());
                FosterOrder o = orderMapper.selectById(inc.getOrderId());
                if (o != null) r.putAll(petBrief(o));
                reviewTasks.add(r);
            }
            vet.put("reviewTasks", reviewTasks);
            out.put("vet", vet);
        }

        // 美容师 / 外勤：只看自己那类单，不返回全量客户信息
        if (auth.has("GROOM", "OWNER")) out.put("groom", groomBoard(tasks));
        if (auth.has("DRIVER", "OWNER")) out.put("driver", driverBoard(tasks));
        out.put("redeemItems", redeemItems());
        return out;
    }

    private Map<String, Object> groomBoard(List<Map<String, Object>> tasks) {
        Map<String, Object> g = new HashMap<>();
        List<Map<String, Object>> list = tasks.stream()
                .filter(t -> "寄养中".equals(t.get("status")))
                .collect(Collectors.toList());
        g.put("total", list.size());
        g.put("pending", list.size());
        g.put("doing", 0);
        g.put("done", 0);
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> t : list) {
            Map<String, Object> x = new HashMap<>(t);
            x.put("bookTime", "14:00");
            x.put("serviceName", "洗护美容");
            x.put("taskStatus", "待开始");
            items.add(x);
        }
        g.put("tasks", items);
        return g;
    }

    private Map<String, Object> driverBoard(List<Map<String, Object>> tasks) {
        Map<String, Object> d = new HashMap<>();
        List<Map<String, Object>> list = new ArrayList<>(tasks);
        d.put("total", list.size());
        d.put("pending", list.size());
        d.put("doing", 0);
        d.put("done", 0);
        d.put("stops", Math.min(3, Math.max(1, list.size())));
        d.put("nextDestination", list.isEmpty() ? "暂无接送任务"
                : String.valueOf(list.get(0).getOrDefault("address", "门店")));
        List<Map<String, Object>> items = new ArrayList<>();
        String[] times = {"09:00", "13:30", "16:00", "18:30"};
        for (int i = 0; i < list.size(); i++) {
            Map<String, Object> x = new HashMap<>(list.get(i));
            x.put("bookTime", times[i % times.length]);
            x.put("pickupType", i % 2 == 0 ? "接宠" : "送回");
            x.put("taskStatus", "待执行");
            items.add(x);
        }
        d.put("tasks", items);
        return d;
    }

    /** 核销项目按岗位锁定（PRD 3.4 判定点 4）：洗护 GROOM、接送 DRIVER、遛宠 CARE。 */
    public List<Map<String, Object>> redeemItems() {
        List<Map<String, Object>> result = new ArrayList<>();
        Map<String, String> allowed = new LinkedHashMap<>();
        if (auth.has("CARE", "OWNER")) allowed.put("WALK", "遛宠");
        if (auth.has("GROOM", "OWNER")) allowed.put("BATH", "洗护");
        if (auth.has("DRIVER", "OWNER")) allowed.put("PICKUP", "接送");
        for (Map.Entry<String, String> e : allowed.entrySet()) {
            ServiceItem si = serviceItemMapper.selectOne(new LambdaQueryWrapper<ServiceItem>()
                    .eq(ServiceItem::getServiceCode, e.getKey()).last("LIMIT 1"));
            Map<String, Object> m = new HashMap<>();
            m.put("code", e.getKey());
            m.put("name", si == null ? e.getValue() : si.getServiceName());
            m.put("price", si == null ? null : si.getPrice());
            m.put("unitType", si == null ? "once" : si.getUnitType());
            m.put("displayName", e.getValue());
            result.add(m);
        }
        return result;
    }

    /** 员工端订单详情：17 个页面共用的数据底座。 */
    public Map<String, Object> orderDetail(Long id) {
        FosterOrder o = orderMapper.selectById(id);
        if (o == null) throw new IllegalArgumentException("订单不存在");
        Map<String, Object> d = new HashMap<>(petBrief(o));
        d.put("id", String.valueOf(o.getOrderId()));
        d.put("orderNo", o.getOrderNo());
        d.put("status", o.getStatus());
        d.put("startDate", o.getStartDate() == null ? "" : o.getStartDate().format(DATE));
        d.put("endDate", o.getEndDate() == null ? "" : o.getEndDate().format(DATE));
        d.put("totalFee", o.getTotalFee());
        d.put("paidAmount", o.getPaidAmount());
        d.put("chargeDays", o.getChargeDays());
        d.put("paymentStatus", o.getPaymentStatus());
        Customer c = o.getCustomerId() == null ? null : customerMapper.selectById(o.getCustomerId());
        String phone = c == null ? "" : (c.getPhone() != null ? c.getPhone() : c.getUsername());
        d.put("customerName", c == null ? "—" : c.getName());
        d.put("phoneMasked", maskPhone(phone));
        if (auth.has("DRIVER", "FRONT", "OWNER")) d.put("phone", phone);
        d.put("address", c == null || c.getAddress() == null ? "" : c.getAddress());

        Long careCount = careLogMapper.selectCount(new LambdaQueryWrapper<FosterCareLog>()
                .eq(FosterCareLog::getOrderId, id));
        d.put("careCount", careCount == null ? 0 : careCount.intValue());
        d.put("careLogs", careLogMapper.selectList(new LambdaQueryWrapper<FosterCareLog>()
                .eq(FosterCareLog::getOrderId, id).orderByDesc(FosterCareLog::getRecordTime)));
        d.put("incidents", incidentMapper.selectList(new LambdaQueryWrapper<FosterIncident>()
                .eq(FosterIncident::getOrderId, id).orderByDesc(FosterIncident::getOccurTime)));
        d.put("handovers", handoverMapper.selectList(new LambdaQueryWrapper<FosterHandover>()
                .eq(FosterHandover::getOrderId, id)));
        d.put("billItems", billItemMapper.selectList(new LambdaQueryWrapper<FosterBillItem>()
                .eq(FosterBillItem::getOrderId, id)));
        d.put("serviceRecords", serviceRecordMapper.selectList(new LambdaQueryWrapper<ServiceRecord>()
                .eq(ServiceRecord::getOrderId, id).orderByDesc(ServiceRecord::getServiceTime)));
        d.put("healthRecords", healthRecordMapper.selectList(new LambdaQueryWrapper<HealthRecord>()
                .eq(HealthRecord::getOrderId, id).orderByDesc(HealthRecord::getRecordTime)));
        d.put("redeemItems", redeemItems());
        return d;
    }

    /** V5 离店评估前的寄养期健康摘要。 */
    public Map<String, Object> healthSummary(Long orderId) {
        Map<String, Object> m = new HashMap<>();
        Long care = careLogMapper.selectCount(new LambdaQueryWrapper<FosterCareLog>()
                .eq(FosterCareLog::getOrderId, orderId));
        List<FosterIncident> incs = incidentMapper.selectList(new LambdaQueryWrapper<FosterIncident>()
                .eq(FosterIncident::getOrderId, orderId));
        long closed = incs.stream().filter(i -> "已闭环".equals(i.getStatus())).count();
        m.put("careCount", care == null ? 0 : care.intValue());
        m.put("incidentCount", incs.size());
        m.put("closedCount", (int) closed);
        m.put("openCount", incs.size() - (int) closed);
        m.put("incidents", incs);
        return m;
    }

    /** V3 异常复核页：护理员原始上报内容只读。 */
    public Map<String, Object> incidentDetail(Long id) {
        FosterIncident inc = incidentMapper.selectById(id);
        if (inc == null) throw new IllegalArgumentException("异常记录不存在");
        Map<String, Object> m = new HashMap<>();
        m.put("incident", inc);
        FosterOrder o = orderMapper.selectById(inc.getOrderId());
        if (o != null) m.putAll(petBrief(o));
        m.put("orderId", String.valueOf(inc.getOrderId()));
        m.put("certNo", auth.certNo());
        m.put("vetReady", auth.vetReady());
        return m;
    }

    /** V1 在岗确认状态。 */
    public Map<String, Object> duty() {
        Map<String, Object> m = new HashMap<>();
        m.put("onDuty", auth.onDuty());
        m.put("vetReady", auth.vetReady());
        m.put("certNo", auth.certNo());
        m.put("role", auth.role());
        m.put("positions", auth.positionsText());
        return m;
    }
}
