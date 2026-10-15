package com.petfoster.controller;

import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.CustomerDTO;
import com.petfoster.service.CustomerService;
import com.petfoster.vo.CustomerVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "客户管理", description = "客户信息的增删改查与分页查询（仅工作人员）")
@RestController
@RequestMapping("/api/customers")
@PreAuthorize("hasRole('STAFF')")
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
    public Result<Void> create(@Valid @RequestBody CustomerDTO dto) {
        customerService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody CustomerDTO dto) {
        customerService.update(id, dto);
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        customerService.delete(id);
        return Result.success();
    }
}
