package com.petfoster.controller;

import com.petfoster.aspect.Log;
import com.petfoster.common.PageResult;
import com.petfoster.common.Result;
import com.petfoster.dto.PetDTO;
import com.petfoster.service.PetService;
import com.petfoster.vo.PetVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "宠物档案管理", description = "宠物档案的增删改查与分页查询")
@RestController
@RequestMapping("/api/pets")
public class PetController {

    private final PetService petService;

    public PetController(PetService petService) {
        this.petService = petService;
    }

    @GetMapping
    public Result<PageResult<PetVO>> page(
            @RequestParam(defaultValue = "1") long page,
            @RequestParam(defaultValue = "10") long size,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) String name) {
        return Result.success(petService.page(page, size, customerId, name));
    }

    @GetMapping("/customer/{customerId}")
    public Result<List<PetVO>> listByCustomer(@PathVariable Long customerId) {
        return Result.success(petService.listByCustomer(customerId));
    }

    @GetMapping("/{id}")
    public Result<PetVO> detail(@PathVariable Long id) {
        return Result.success(petService.getDetail(id));
    }

    @PostMapping


    @Log(module = "宠物档案", content = "新增")


    public Result<Void> create(@Valid @RequestBody PetDTO dto) {
        petService.create(dto);
        return Result.success();
    }

    @PutMapping("/{id}")


    @Log(module = "宠物档案", content = "修改")


    public Result<Void> update(@PathVariable Long id, @Valid @RequestBody PetDTO dto) {
        petService.update(id, dto);
        return Result.success();
    }

    

    @Log(module = "宠物档案", content = "删除")
@DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        petService.delete(id);
        return Result.success();
    }
}
