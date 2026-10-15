package com.petfoster.service;

import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.enums.OrderStatus;
import com.petfoster.vo.BreedDistributionVO;
import com.petfoster.vo.DashboardVO;
import com.petfoster.vo.OrderTrendVO;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class StatsService {

    private final FosterOrderMapper fosterOrderMapper;
    private final PetMapper petMapper;

    public StatsService(FosterOrderMapper fosterOrderMapper, PetMapper petMapper) {
        this.fosterOrderMapper = fosterOrderMapper;
        this.petMapper = petMapper;
    }

    public DashboardVO dashboard() {
        DashboardVO vo = new DashboardVO();
        vo.setFosteringCount(fosterOrderMapper.countByStatus(OrderStatus.FOSTERING.getValue()));
        vo.setPendingCount(fosterOrderMapper.countByStatus(OrderStatus.PENDING.getValue()));
        vo.setMonthlyOrderCount(fosterOrderMapper.countMonthlyOrders());
        BigDecimal revenue = fosterOrderMapper.sumMonthlyRevenue();
        vo.setMonthlyRevenue(revenue != null ? revenue : BigDecimal.ZERO);
        return vo;
    }

    /** 本月寄养金额（本月非已取消订单合计，口径与总营收一致）——首页展示用，工作人员亦可见（轻量口径） */
    public BigDecimal monthlyRevenue() {
        BigDecimal revenue = fosterOrderMapper.sumMonthlyRevenue();
        return revenue != null ? revenue : BigDecimal.ZERO;
    }

    public List<OrderTrendVO> orderTrend(String startDate, String endDate) {
        List<Map<String, Object>> rows = fosterOrderMapper.selectOrderTrend(startDate, endDate);
        List<OrderTrendVO> list = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            OrderTrendVO vo = new OrderTrendVO();
            vo.setMonth(String.valueOf(row.get("month")));
            Object count = row.get("count");
            vo.setCount(count != null ? ((Number) count).longValue() : 0L);
            Object revenue = row.get("revenue");
            vo.setRevenue(revenue != null ? new BigDecimal(String.valueOf(revenue)) : BigDecimal.ZERO);
            list.add(vo);
        }
        return list;
    }

    public List<BreedDistributionVO> breedDistribution() {
        List<Map<String, Object>> rows = petMapper.selectBreedDistribution();
        List<BreedDistributionVO> list = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            BreedDistributionVO vo = new BreedDistributionVO();
            vo.setBreed(String.valueOf(row.get("breed")));
            Object count = row.get("count");
            vo.setCount(count != null ? ((Number) count).longValue() : 0L);
            list.add(vo);
        }
        return list;
    }
}
