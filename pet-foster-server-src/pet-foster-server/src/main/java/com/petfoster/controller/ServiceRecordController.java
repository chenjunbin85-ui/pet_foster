package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.ServiceRecordDTO;
import com.petfoster.service.ServiceRecordService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.ServiceRecordVO;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/service-records")
public class ServiceRecordController {

    private final ServiceRecordService serviceRecordService;

    public ServiceRecordController(ServiceRecordService serviceRecordService) {
        this.serviceRecordService = serviceRecordService;
    }

    @GetMapping
    public Result<PageResult<ServiceRecordVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) Long orderId,
            @RequestParam(required = false) Long petId) {
        return Result.success(serviceRecordService.page(page, size, orderId, petId));
    }

    @GetMapping("/{id}")
    public Result<ServiceRecordVO> detail(@PathVariable Long id) {
        return Result.success(serviceRecordService.getDetail(id));
    }

    @PostMapping


    @Log(module = "服务记录", content = "新增")


    public Result<Void> create(@Valid @RequestBody ServiceRecordDTO dto) {
        Long keeperId = SecurityUtil.getCurrentUserId();
        serviceRecordService.create(dto, keeperId);
        return Result.success();
    }

    @PutMapping("/{id}")


    @Log(module = "服务记录", content = "修改")


    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody ServiceRecordDTO dto) {
        serviceRecordService.update(id, dto);
        return Result.success();
    }

    

    @Log(module = "服务记录", content = "删除")
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        serviceRecordService.removeById(id);
        return Result.success();
    }
}
