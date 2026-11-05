package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.service.FosterPriceService;
import com.petfoster.vo.FosterPriceVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 小程序端寄养价位接口（毛球旅馆用户端，展示启用的房型档位） */
@Tag(name = "小程序·价位档位", description = "用户下单可选择的房型/价位")
@RestController
@RequestMapping("/api/mp/prices")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpPriceController {

    private final FosterPriceService fosterPriceService;

    public MpPriceController(FosterPriceService fosterPriceService) {
        this.fosterPriceService = fosterPriceService;
    }

    @GetMapping
    public Result<List<FosterPriceVO>> list() {
        return Result.success(fosterPriceService.listOptions());
    }
}
