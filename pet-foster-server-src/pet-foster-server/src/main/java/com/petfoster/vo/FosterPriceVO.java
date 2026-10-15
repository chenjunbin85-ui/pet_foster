package com.petfoster.vo;

import lombok.Data;
import java.math.BigDecimal;

@Data
public class FosterPriceVO {
    private String id;
    private String levelName;
    private BigDecimal pricePerDay;
    private Integer status;
    private Integer sort;
    private String remark;
}
