package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.CustomerDTO;
import com.petfoster.service.CustomerService;
import com.petfoster.vo.CustomerVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/customers")
public class CustomerController {

    private final CustomerService customerService;

    public CustomerController(CustomerService customerService) {
        this.customerService = customerService;
    }

    @GetMapping
    public Result<PageResult<CustomerVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String keyword) {
        return Result.success(customerService.page(page, size, keyword));
    }

    @GetMapping("/{id}")
    public Result<CustomerVO> detail(@PathVariable Long id) {
        return Result.success(customerService.getDetail(id));
    }

    @PostMapping
    @Log(module = "客户管理", content = "新增客户")
    public Result<Void> create(@Valid @RequestBody CustomerDTO dto) {
        customerService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")
    @Log(module = "客户管理", content = "修改客户")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody CustomerDTO dto) {
        customerService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    @Log(module = "客户管理", content = "删除客户")
    public Result<Void> delete(@PathVariable Long id) {
        customerService.delete(id);
        return Result.success();
    }
}
