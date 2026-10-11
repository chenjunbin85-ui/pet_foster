package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.DictDTO;
import com.petfoster.service.DictService;
import com.petfoster.vo.DictVO;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dicts")
@PreAuthorize("hasRole('ADMIN')")
public class DictController {

    private final DictService dictService;

    public DictController(DictService dictService) {
        this.dictService = dictService;
    }

    @GetMapping
    public Result<PageResult<DictVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) String typeCode) {
        return Result.success(dictService.page(page, size, typeCode));
    }

    @GetMapping("/type/{typeCode}")
    public Result<List<DictVO>> listByType(@PathVariable String typeCode) {
        return Result.success(dictService.listByType(typeCode));
    }

    @PostMapping


    @Log(module = "数据字典", content = "新增")


    public Result<Void> create(@Valid @RequestBody DictDTO dto) {
        dictService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")


    @Log(module = "数据字典", content = "修改")


    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody DictDTO dto) {
        dictService.update(id, dto);
        return Result.success();
    }

    

    @Log(module = "数据字典", content = "删除")
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        dictService.removeById(id);
        return Result.success();
    }
}
