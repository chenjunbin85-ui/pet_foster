package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.StatsService;
import com.petfoster.vo.BreedDistributionVO;
import com.petfoster.vo.DashboardVO;
import com.petfoster.vo.OrderTrendVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@Tag(name = "统计分析", description = "首页仪表盘、订单趋势、品种分布等统计接口（经营汇总仅管理员；本月寄养金额首页展示双方可见）")
@RestController
@RequestMapping("/api/stats")
@PreAuthorize("hasRole('ADMIN')")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/dashboard")
    public Result<DashboardVO> dashboard() {
        return Result.success(statsService.dashboard());
    }

    /** 本月寄养金额（轻量口径，首页金额卡用）：登录用户均可访问 */
    @GetMapping("/monthly-revenue")
    @PreAuthorize("isAuthenticated()")
    public Result<BigDecimal> monthlyRevenue() {
        return Result.success(statsService.monthlyRevenue());
    }

    @GetMapping("/order-trend")
    public Result<List<OrderTrendVO>> orderTrend(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return Result.success(statsService.orderTrend(startDate, endDate));
    }

    @GetMapping("/breed-distribution")
    public Result<List<BreedDistributionVO>> breedDistribution() {
        return Result.success(statsService.breedDistribution());
    }
}
