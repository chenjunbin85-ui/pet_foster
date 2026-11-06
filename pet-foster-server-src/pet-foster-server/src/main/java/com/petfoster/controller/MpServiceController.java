package com.petfoster.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.Result;
import com.petfoster.entity.ServiceItem;
import com.petfoster.mapper.ServiceItemMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 小程序端增值服务价目（启用项） */
@Tag(name = "小程序·增值服务", description = "下单可选增值服务价目")
@RestController
@RequestMapping("/api/mp/services")
public class MpServiceController {

    private final ServiceItemMapper serviceItemMapper;

    public MpServiceController(ServiceItemMapper serviceItemMapper) {
        this.serviceItemMapper = serviceItemMapper;
    }

    @GetMapping("/options")
    public Result<List<ServiceItem>> options() {
        List<ServiceItem> list = serviceItemMapper.selectList(
                new LambdaQueryWrapper<ServiceItem>()
                        .eq(ServiceItem::getStatus, 1)
                        .orderByAsc(ServiceItem::getSort));
        return Result.success(list);
    }
}
