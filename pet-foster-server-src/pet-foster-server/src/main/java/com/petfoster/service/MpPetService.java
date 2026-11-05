package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.dto.MpPetSaveDTO;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Pet;
import com.petfoster.enums.OrderStatus;
import com.petfoster.enums.PetGender;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.util.VaccineJson;
import com.petfoster.vo.MpPetVO;
import com.petfoster.vo.PetVO;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 小程序端宠物档案管理（仅本人数据）。
 *
 * <p>规则（对齐设计稿）：
 * <ul>
 *   <li>未免疫宠物不可下单（下单校验见 {@link MpOrderService}）</li>
 *   <li>进行中预约（待入店/寄养中）锁定昵称/品种/性别/年龄/体重/疫苗，仅可补充毛色与备注</li>
 *   <li>删除保护：存在寄养订单的宠物不可删除</li>
 *   <li>年龄 0-40 周岁整数、体重 0.1-150kg 最多 1 位小数</li>
 * </ul>
 */
@Service
public class MpPetService {

    private final PetMapper petMapper;
    private final FosterOrderMapper fosterOrderMapper;
    private final PetService petService;

    public MpPetService(PetMapper petMapper, FosterOrderMapper fosterOrderMapper, PetService petService) {
        this.petMapper = petMapper;
        this.fosterOrderMapper = fosterOrderMapper;
        this.petService = petService;
    }

    public List<MpPetVO> list(Long customerId) {
        return petMapper.selectList(new LambdaQueryWrapper<Pet>()
                        .eq(Pet::getCustomerId, customerId)
                        .orderByDesc(Pet::getCreateTime))
                .stream().map(this::toMpVO).collect(Collectors.toList());
    }

    public MpPetVO getDetail(Long id, Long customerId) {
        Pet pet = requireOwned(id, customerId);
        return toMpVO(pet);
    }

    public MpPetVO create(MpPetSaveDTO dto, Long customerId) {
        validate(dto);
        Pet pet = new Pet();
        pet.setCustomerId(customerId);
        applyDto(pet, dto);
        pet.setCreateTime(LocalDateTime.now());
        petMapper.insert(pet);
        return toMpVO(pet);
    }

    public MpPetVO update(Long id, MpPetSaveDTO dto, Long customerId) {
        Pet pet = requireOwned(id, customerId);
        validate(dto);
        if (hasActiveOrder(id)) {
            // 进行中预约锁定关键信息，仅可补充毛色与备注
            pet.setColor(dto.getColor());
            pet.setHistory(dto.getHistory());
        } else {
            applyDto(pet, dto);
        }
        petMapper.updateById(pet);
        return toMpVO(pet);
    }

    public void delete(Long id, Long customerId) {
        requireOwned(id, customerId);
        // 删除保护：存在关联订单（含已取消/已完成）不可删除
        Long count = fosterOrderMapper.selectCount(
                new LambdaQueryWrapper<FosterOrder>().eq(FosterOrder::getPetId, id));
        if (count > 0) {
            throw new BusinessException("该宠物存在寄养订单记录，无法删除");
        }
        petMapper.deleteById(id);
    }

    /** 是否存在进行中（待入店/寄养中）预约 */
    public boolean hasActiveOrder(Long petId) {
        Long count = fosterOrderMapper.selectCount(new LambdaQueryWrapper<FosterOrder>()
                .eq(FosterOrder::getPetId, petId)
                .in(FosterOrder::getStatus, OrderStatus.PENDING.getValue(), OrderStatus.FOSTERING.getValue()));
        return count != null && count > 0;
    }

    private MpPetVO toMpVO(Pet pet) {
        MpPetVO vo = new MpPetVO();
        vo.setId(String.valueOf(pet.getPetId()));
        vo.setCustomerId(String.valueOf(pet.getCustomerId()));
        vo.setName(pet.getName());
        vo.setBreed(pet.getBreed());
        vo.setGender(pet.getGender());
        vo.setAge(pet.getAge());
        vo.setWeight(pet.getWeight());
        vo.setColor(pet.getColor());
        vo.setVaccine(pet.getVaccine());
        vo.setVaccineText(VaccineJson.toReadable(pet.getVaccine()));
        vo.setHistory(pet.getHistory());
        vo.setCreatedAt(pet.getCreateTime());
        vo.setLocked(hasActiveOrder(pet.getPetId()));
        return vo;
    }

    private Pet requireOwned(Long id, Long customerId) {
        Pet pet = petMapper.selectById(id);
        if (pet == null) {
            throw new BusinessException("宠物不存在");
        }
        if (!pet.getCustomerId().equals(customerId)) {
            throw new BusinessException("无权操作该宠物");
        }
        return pet;
    }

    private void validate(MpPetSaveDTO dto) {
        PetGender.checkGender(dto.getGender());
        if (dto.getWeight() != null) {
            BigDecimal w = dto.getWeight();
            if (w.compareTo(new BigDecimal("0.1")) < 0 || w.compareTo(new BigDecimal("150")) > 0) {
                throw new BusinessException("体重需在 0.1-150kg 之间");
            }
            if (w.stripTrailingZeros().scale() > 1) {
                throw new BusinessException("体重最多保留 1 位小数");
            }
        }
        dto.setVaccine(VaccineJson.normalize(dto.getVaccine()));
    }

    private void applyDto(Pet pet, MpPetSaveDTO dto) {
        pet.setName(dto.getName());
        pet.setBreed(dto.getBreed());
        pet.setGender(dto.getGender());
        pet.setAge(dto.getAge());
        pet.setWeight(dto.getWeight());
        pet.setColor(dto.getColor());
        pet.setVaccine(dto.getVaccine());
        pet.setHistory(dto.getHistory());
    }
}
