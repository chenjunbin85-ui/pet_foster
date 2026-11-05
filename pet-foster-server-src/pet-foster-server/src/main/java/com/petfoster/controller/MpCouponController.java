package com.petfoster.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.Result;
import com.petfoster.entity.Coupon;
import com.petfoster.mapper.CouponMapper;
import com.petfoster.util.SecurityUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "小程序·优惠券", description = "我的优惠券列表")
@RestController
@RequestMapping("/api/mp/coupons")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpCouponController {

    private final CouponMapper couponMapper;

    public MpCouponController(CouponMapper couponMapper) {
        this.couponMapper = couponMapper;
    }

    @GetMapping
    public Result<List<Coupon>> mine() {
        List<Coupon> list = couponMapper.selectList(
                new LambdaQueryWrapper<Coupon>()
                        .eq(Coupon::getCustomerId, SecurityUtil.getCurrentUserId())
                        .orderByDesc(Coupon::getCouponId));
        return Result.success(list);
    }
}
