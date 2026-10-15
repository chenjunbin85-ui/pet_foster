package com.petfoster.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.petfoster.entity.FosterOrder;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.Map;

public interface FosterOrderMapper extends BaseMapper<FosterOrder> {

    /** 以下统计类自定义 SQL 均显式过滤软删订单（deleted = 0），与 MyBatis-Plus 逻辑删除口径一致 */
    /** countByOrderNoPrefix 例外：订单号生成需物理计数（含软删），避免序号复用与唯一键冲突 */

    @Select("SELECT COUNT(*) FROM foster_order WHERE order_no LIKE CONCAT(#{prefix}, '%')")
    long countByOrderNoPrefix(@Param("prefix") String prefix);

    @Select("SELECT COUNT(*) FROM foster_order WHERE deleted = 0 AND status = #{status}")
    long countByStatus(String status);

    @Select("SELECT COUNT(*) FROM foster_order WHERE deleted = 0 AND DATE_FORMAT(create_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')")
    long countMonthlyOrders();

    @Select("SELECT COALESCE(SUM(total_fee), 0) FROM foster_order WHERE deleted = 0 AND status != '已取消' AND DATE_FORMAT(create_time, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')")
    java.math.BigDecimal sumMonthlyRevenue();

    @Select("<script>" +
            "SELECT DATE_FORMAT(create_time, '%Y-%m') AS month, COUNT(*) AS count, COALESCE(SUM(total_fee), 0) AS revenue " +
            "FROM foster_order WHERE deleted = 0 AND status != '已取消' " +
            "<if test='startDate != null and startDate != \"\"'>AND create_time &gt;= #{startDate}</if> " +
            "<if test='endDate != null and endDate != \"\"'>AND create_time &lt;= CONCAT(#{endDate}, ' 23:59:59')</if> " +
            "GROUP BY DATE_FORMAT(create_time, '%Y-%m') ORDER BY month" +
            "</script>")
    List<Map<String, Object>> selectOrderTrend(@Param("startDate") String startDate, @Param("endDate") String endDate);
}
