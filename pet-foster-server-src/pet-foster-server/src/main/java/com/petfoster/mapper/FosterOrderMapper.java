package com.petfoster.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.petfoster.entity.FosterOrder;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.Map;

public interface FosterOrderMapper extends BaseMapper<FosterOrder> {

    @Select("SELECT COUNT(*) FROM foster_order WHERE status = #{status}")
    long countByStatus(String status);

    @Select("SELECT COUNT(*) FROM foster_order WHERE DATE_FORMAT(create_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')")
    long countMonthlyOrders();

    @Select("SELECT COALESCE(SUM(total_fee), 0) FROM foster_order WHERE status = '已完成' AND DATE_FORMAT(create_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')")
    java.math.BigDecimal sumMonthlyRevenue();

    @Select("<script>" +
            "SELECT DATE_FORMAT(create_time, '%Y-%m') AS month, COUNT(*) AS count, COALESCE(SUM(total_fee), 0) AS revenue " +
            "FROM foster_order WHERE 1=1 " +
            "<if test='startDate != null and startDate != \"\"'>AND create_time &gt;= #{startDate}</if> " +
            "<if test='endDate != null and endDate != \"\"'>AND create_time &lt;= CONCAT(#{endDate}, ' 23:59:59')</if> " +
            "GROUP BY DATE_FORMAT(create_time, '%Y-%m') ORDER BY month" +
            "</script>")
    List<Map<String, Object>> selectOrderTrend(@Param("startDate") String startDate, @Param("endDate") String endDate);
}
