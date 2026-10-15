package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.StatsService;
import com.petfoster.vo.BreedDistributionVO;
import com.petfoster.vo.DashboardVO;
import com.petfoster.vo.OrderTrendVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "统计分析", description = "首页仪表盘、订单趋势、品种分布等统计接口")
@RestController
@RequestMapping("/api/stats")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/dashboard")
    public Result<DashboardVO> dashboard() {
        return Result.success(statsService.dashboard());
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
