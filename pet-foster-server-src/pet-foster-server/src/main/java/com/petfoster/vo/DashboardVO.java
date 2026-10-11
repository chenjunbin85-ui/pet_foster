package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class DashboardVO {
    private long fosteringCount;
    private long pendingCount;
    private long monthlyOrderCount;
    private BigDecimal monthlyRevenue;
}
