package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class OrderTrendVO {
    private String month;
    private long count;
    private BigDecimal revenue;
}
