package com.petfoster.controller;

import com.petfoster.common.Result;
import com.petfoster.dto.MpPetSaveDTO;
import com.petfoster.service.MpPetService;
import com.petfoster.util.SecurityUtil;
import com.petfoster.vo.MpPetVO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** 小程序端宠物档案接口（毛球旅馆用户端，仅本人宠物） */
@Tag(name = "小程序·宠物档案", description = "本人宠物的查看、新增、编辑、删除")
@RestController
@RequestMapping("/api/mp/pets")
@PreAuthorize("hasRole('CUSTOMER')")
public class MpPetController {

    private final MpPetService mpPetService;

    public MpPetController(MpPetService mpPetService) {
        this.mpPetService = mpPetService;
    }

    @GetMapping
    public Result<List<MpPetVO>> list() {
        return Result.success(mpPetService.list(SecurityUtil.getCurrentUserId()));
    }

    @GetMapping("/{id}")
    public Result<MpPetVO> detail(@PathVariable Long id) {
        return Result.success(mpPetService.getDetail(id, SecurityUtil.getCurrentUserId()));
    }

    @PostMapping
    public Result<MpPetVO> create(@Valid @RequestBody MpPetSaveDTO dto) {
        return Result.success(mpPetService.create(dto, SecurityUtil.getCurrentUserId()));
    }

    @PutMapping("/{id}")
    public Result<MpPetVO> update(@PathVariable Long id, @Valid @RequestBody MpPetSaveDTO dto) {
        return Result.success(mpPetService.update(id, dto, SecurityUtil.getCurrentUserId()));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        mpPetService.delete(id, SecurityUtil.getCurrentUserId());
        return Result.success();
    }
}
