package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.entity.CareRecord;
import com.petfoster.entity.FosterCareLog;
import com.petfoster.entity.FosterOrder;
import com.petfoster.mapper.CareRecordMapper;
import com.petfoster.mapper.FosterCareLogMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.vo.MpCareRecordVO;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 顾客端照护时间线：员工现场照片上传后，必须在这里被消费，上传才算走完「产品全链路」。
 *
 * <p>数据源两张表：
 * <ul>
 *   <li>{@code foster_care_log}：员工手机端巡视打卡（照片、班次、岗位快照）</li>
 *   <li>{@code care_record}：历史/后台补录的照护记录（单张 image_url）</li>
 * </ul>
 * 返回前按「寄养第几天 + 记录时间」排序，并校验订单归属，避免跨客户读取。
 */
@Service
public class MpCareService {

    private final FosterOrderMapper orderMapper;
    private final FosterCareLogMapper careLogMapper;
    private final CareRecordMapper careRecordMapper;

    public MpCareService(FosterOrderMapper orderMapper, FosterCareLogMapper careLogMapper,
                         CareRecordMapper careRecordMapper) {
        this.orderMapper = orderMapper;
        this.careLogMapper = careLogMapper;
        this.careRecordMapper = careRecordMapper;
    }

    public List<MpCareRecordVO> list(Long orderId, Long customerId) {
        FosterOrder order = orderMapper.selectById(orderId);
        if (order == null) throw new BusinessException("订单不存在");
        if (!order.getCustomerId().equals(customerId)) throw new BusinessException("无权查看该订单的照护记录");

        LocalDate start = order.getStartDate();
        List<MpCareRecordVO> result = new ArrayList<>();

        careRecordMapper.selectList(new LambdaQueryWrapper<CareRecord>()
                        .eq(CareRecord::getOrderId, orderId))
                .forEach(r -> {
                    MpCareRecordVO vo = new MpCareRecordVO();
                    vo.setRecordId("CR-" + r.getRecordId());
                    vo.setDay(r.getDay() == null ? 1 : r.getDay());
                    vo.setType(r.getType() == null ? "PHOTO" : r.getType());
                    vo.setContent(r.getContent());
                    List<String> photos = splitPhotos(r.getImageUrl());
                    vo.setPhotos(photos);
                    vo.setImageUrl(photos.isEmpty() ? null : photos.get(0));
                    vo.setRecordTime(r.getCreateTime());
                    result.add(vo);
                });

        careLogMapper.selectList(new LambdaQueryWrapper<FosterCareLog>()
                        .eq(FosterCareLog::getOrderId, orderId))
                .forEach(log -> {
                    MpCareRecordVO vo = new MpCareRecordVO();
                    vo.setRecordId("CL-" + log.getCareLogId());
                    vo.setDay(dayOf(start, log.getLogDate()));
                    vo.setType("巡视");
                    vo.setContent(summarize(log));
                    List<String> photos = splitPhotos(log.getPhotoUrls());
                    vo.setPhotos(photos);
                    vo.setImageUrl(photos.isEmpty() ? null : photos.get(0));
                    vo.setShift(log.getShift());
                    vo.setRecorderPosition(log.getRecorderPosition());
                    vo.setRecordTime(log.getRecordTime());
                    result.add(vo);
                });

        return result.stream()
                .sorted(Comparator.comparing((MpCareRecordVO v) -> v.getDay() == null ? 1 : v.getDay())
                        .thenComparing(v -> v.getRecordTime() == null ? LocalDateTime.MIN : v.getRecordTime()))
                .collect(Collectors.toList());
    }

    /** 入住日算第 1 天；早于入住日的历史记录归到第 1 天 */
    private int dayOf(LocalDate start, LocalDate logDate) {
        if (start == null || logDate == null) return 1;
        long days = ChronoUnit.DAYS.between(start, logDate);
        return (int) Math.max(1, days + 1);
    }

    /** 巡视日志 → 顾客可读的一句话，照片单独放在 photos 里 */
    private String summarize(FosterCareLog log) {
        List<String> parts = new ArrayList<>();
        put(parts, "精神", log.getSpirit());
        put(parts, "食欲", log.getAppetite());
        put(parts, "排便", log.getDefecation());
        put(parts, "运动", log.getExercise());
        put(parts, "被毛", log.getCoat());
        BigDecimal t = log.getTemperature();
        if (t != null) parts.add("体温 " + t.stripTrailingZeros().toPlainString() + "℃");
        if (StringUtils.hasText(log.getAbnormal())) parts.add("异常：" + log.getAbnormal());
        if (parts.isEmpty()) return "护理员已完成本班巡视";
        return String.join(" · ", parts);
    }

    private void put(List<String> parts, String label, String value) {
        if (StringUtils.hasText(value)) parts.add(label + " " + value);
    }

    /** 照片字段为逗号分隔相对地址，最多 6 张，过滤空值与重复 */
    private List<String> splitPhotos(String raw) {
        if (!StringUtils.hasText(raw)) return List.of();
        return java.util.Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .filter(Objects::nonNull)
                .distinct()
                .limit(6)
                .collect(Collectors.toList());
    }
}
