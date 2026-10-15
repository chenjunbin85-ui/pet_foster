package com.petfoster.controller;

import com.alibaba.excel.EasyExcel;
import com.alibaba.excel.ExcelWriter;
import com.alibaba.excel.write.metadata.WriteSheet;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.entity.Customer;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Tag(name = "数据导出", description = "订单导出仅管理员；客户、宠物导出仅工作人员")
@RestController
@RequestMapping("/api/export")
public class ExportController {

    private final CustomerMapper customerMapper;
    private final PetMapper petMapper;
    private final FosterOrderMapper fosterOrderMapper;

    public ExportController(CustomerMapper customerMapper, PetMapper petMapper, FosterOrderMapper fosterOrderMapper) {
        this.customerMapper = customerMapper;
        this.petMapper = petMapper;
        this.fosterOrderMapper = fosterOrderMapper;
    }

    @GetMapping("/customers")
    @PreAuthorize("hasRole('STAFF')")
    public void exportCustomers(HttpServletResponse response) throws IOException {
        List<Customer> list = customerMapper.selectList(
                new LambdaQueryWrapper<Customer>().orderByDesc(Customer::getCreateTime));
        List<List<String>> data = new ArrayList<>();
        data.add(List.of("客户ID", "姓名", "手机号", "地址", "备注", "创建时间"));
        for (Customer c : list) {
            data.add(List.of(
                    String.valueOf(c.getCustomerId()),
                    c.getName(),
                    c.getPhone(),
                    c.getAddress() != null ? c.getAddress() : "",
                    c.getRemark() != null ? c.getRemark() : "",
                    c.getCreateTime() != null ? c.getCreateTime().toString() : ""
            ));
        }
        writeExcel(response, "客户列表", data);
    }

    @GetMapping("/pets")
    @PreAuthorize("hasRole('STAFF')")
    public void exportPets(HttpServletResponse response) throws IOException {
        List<Pet> list = petMapper.selectList(
                new LambdaQueryWrapper<Pet>().orderByDesc(Pet::getCreateTime));
        List<List<String>> data = new ArrayList<>();
        data.add(List.of("宠物ID", "所属客户ID", "名字", "品种", "性别", "年龄", "体重", "毛色", "疫苗情况", "既往病史", "创建时间"));
        for (Pet p : list) {
            data.add(List.of(
                    String.valueOf(p.getPetId()),
                    String.valueOf(p.getCustomerId()),
                    p.getName(),
                    p.getBreed() != null ? p.getBreed() : "",
                    p.getGender() != null ? p.getGender() : "",
                    p.getAge() != null ? String.valueOf(p.getAge()) : "",
                    p.getWeight() != null ? String.valueOf(p.getWeight()) : "",
                    p.getColor() != null ? p.getColor() : "",
                    p.getVaccine() != null ? p.getVaccine() : "",
                    p.getHistory() != null ? p.getHistory() : "",
                    p.getCreateTime() != null ? p.getCreateTime().toString() : ""
            ));
        }
        writeExcel(response, "宠物档案", data);
    }

    @GetMapping("/orders")
    @PreAuthorize("hasRole('ADMIN')")
    public void exportOrders(HttpServletResponse response) throws IOException {
        List<FosterOrder> list = fosterOrderMapper.selectList(
                new LambdaQueryWrapper<FosterOrder>().orderByDesc(FosterOrder::getCreateTime));

        // sheet2 订单数据：订单流水明细
        List<List<String>> orderData = new ArrayList<>();
        orderData.add(List.of("订单号", "客户ID", "宠物ID", "开始日期", "结束日期", "单日单价", "总费用", "状态", "备注", "创建人ID", "创建时间"));
        for (FosterOrder o : list) {
            orderData.add(List.of(
                    o.getOrderNo(),
                    String.valueOf(o.getCustomerId()),
                    String.valueOf(o.getPetId()),
                    o.getStartDate() != null ? o.getStartDate().toString() : "",
                    o.getEndDate() != null ? o.getEndDate().toString() : "",
                    o.getPricePerDay() != null ? o.getPricePerDay().toString() : "",
                    o.getTotalFee() != null ? o.getTotalFee().toString() : "",
                    o.getStatus(),
                    o.getRemark() != null ? o.getRemark() : "",
                    o.getCreatorId() != null ? String.valueOf(o.getCreatorId()) : "",
                    o.getCreateTime() != null ? o.getCreateTime().toString() : ""
            ));
        }

        // sheet1 经营数据：与统计分析页四卡口径一致（订单总数/已完成/已取消/总营收，均不含软删订单）
        long total = list.size();
        long completed = list.stream().filter(o -> "已完成".equals(o.getStatus())).count();
        long cancelled = list.stream().filter(o -> "已取消".equals(o.getStatus())).count();
        BigDecimal revenue = list.stream()
                .filter(o -> !"已取消".equals(o.getStatus()))
                .map(FosterOrder::getTotalFee)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        List<List<String>> summaryData = new ArrayList<>();
        summaryData.add(List.of("指标", "数值"));
        summaryData.add(List.of("订单总数（单）", String.valueOf(total)));
        summaryData.add(List.of("已完成订单（单）", String.valueOf(completed)));
        summaryData.add(List.of("已取消订单（单）", String.valueOf(cancelled)));
        summaryData.add(List.of("总营收（元）", revenue.toPlainString()));
        summaryData.add(List.of("导出时间", LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))));

        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("utf-8");
        String encoded = URLEncoder.encode("门店经营数据", StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        response.setHeader("Content-disposition", "attachment;filename*=utf-8''" + encoded + ".xlsx");

        try (ExcelWriter excelWriter = EasyExcel.write(response.getOutputStream()).build()) {
            WriteSheet summarySheet = EasyExcel.writerSheet("经营数据").build();
            WriteSheet orderSheet = EasyExcel.writerSheet("订单数据").build();
            excelWriter.write(summaryData, summarySheet);
            excelWriter.write(orderData, orderSheet);
        }
    }

    private void writeExcel(HttpServletResponse response, String fileName, List<List<String>> data) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setCharacterEncoding("utf-8");
        String encoded = URLEncoder.encode(fileName, StandardCharsets.UTF_8).replaceAll("\\+", "%20");
        response.setHeader("Content-disposition", "attachment;filename*=utf-8''" + encoded + ".xlsx");
        EasyExcel.write(response.getOutputStream()).sheet(fileName).doWrite(data);
    }
}
