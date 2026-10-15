package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.FosterPriceDTO;
import com.petfoster.service.FosterPriceService;
import com.petfoster.vo.FosterPriceVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "寄养价位管理", description = "管理员：固定价位档位维护；工作人员：下单选择档位")
@RestController
@RequestMapping("/api/prices")
public class PriceController {

    private final FosterPriceService fosterPriceService;

    public PriceController(FosterPriceService fosterPriceService) {
        this.fosterPriceService = fosterPriceService;
    }

    /** 登录用户均可查看启用档位（下单下拉选择） */
    @GetMapping("/options")
    public Result<List<FosterPriceVO>> options() {
        return Result.success(fosterPriceService.listOptions());
    }

    /** 管理员：分页查看全部档位（含停用） */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Result<PageResult<FosterPriceVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String keyword) {
        return Result.success(fosterPriceService.page(page, size, keyword));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Result<FosterPriceVO> detail(@PathVariable Long id) {
        return Result.success(fosterPriceService.getDetail(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public Result<Void> create(@Valid @RequestBody FosterPriceDTO dto) {
        fosterPriceService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody FosterPriceDTO dto) {
        fosterPriceService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public Result<Void> delete(@PathVariable Long id) {
        fosterPriceService.delete(id);
        return Result.success();
    }
}
