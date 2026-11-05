package com.petfoster.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.common.Result;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Review;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.ReviewMapper;
import com.petfoster.util.SecurityUtil;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@Tag(name = "小程序·订单评价", description = "已完成订单提交评价 / 查看评价")
@RestController
@RequestMapping("/api/mp/orders")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpReviewController {

    private final ReviewMapper reviewMapper;
    private final FosterOrderMapper fosterOrderMapper;

    public MpReviewController(ReviewMapper reviewMapper, FosterOrderMapper fosterOrderMapper) {
        this.reviewMapper = reviewMapper;
        this.fosterOrderMapper = fosterOrderMapper;
    }

    @GetMapping("/{orderId}/review")
    public Result<Review> get(@PathVariable Long orderId) {
        Review review = reviewMapper.selectOne(new LambdaQueryWrapper<Review>()
                .eq(Review::getOrderId, orderId));
        return Result.success(review);
    }

    @PostMapping("/{orderId}/review")
    public Result<Review> submit(@PathVariable Long orderId, @Valid @RequestBody ReviewDTO dto) {
        Long customerId = SecurityUtil.getCurrentUserId();
        FosterOrder order = fosterOrderMapper.selectById(orderId);
        if (order == null || !order.getCustomerId().equals(customerId)) {
            throw new BusinessException("订单不存在或无权操作");
        }
        Review existing = reviewMapper.selectOne(new LambdaQueryWrapper<Review>()
                .eq(Review::getOrderId, orderId));
        if (existing != null) {
            throw new BusinessException("该订单已评价");
        }
        Review review = new Review();
        review.setOrderId(orderId);
        review.setCustomerId(customerId);
        review.setPetId(order.getPetId());
        review.setRating(dto.getRating());
        review.setContent(dto.getContent());
        review.setCreateTime(LocalDateTime.now());
        reviewMapper.insert(review);
        return Result.success(review);
    }

    @Data
    public static class ReviewDTO {
        @Min(value = 1, message = "评分 1-5")
        @Max(value = 5, message = "评分 1-5")
        private Integer rating = 5;
        @Size(max = 500, message = "评价最多 500 字")
        private String content;
    }
}
