package com.petfoster.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.Result;
import com.petfoster.entity.Store;
import com.petfoster.mapper.StoreMapper;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "小程序·门店", description = "可预约的寄养门店列表")
@RestController
@RequestMapping("/api/mp/stores")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpStoreController {

    private final StoreMapper storeMapper;

    public MpStoreController(StoreMapper storeMapper) {
        this.storeMapper = storeMapper;
    }

    @GetMapping
    public Result<List<Store>> list() {
        List<Store> stores = storeMapper.selectList(
                new LambdaQueryWrapper<Store>().eq(Store::getStatus, "ENABLED").orderByAsc(Store::getStoreId));
        return Result.success(stores);
    }
}
