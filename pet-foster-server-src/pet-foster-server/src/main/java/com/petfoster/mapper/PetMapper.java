package com.petfoster.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.petfoster.entity.Pet;
import org.apache.ibatis.annotations.Select;
import java.util.List;
import java.util.Map;

public interface PetMapper extends BaseMapper<Pet> {

    @Select("SELECT breed, COUNT(*) AS count FROM pet GROUP BY breed ORDER BY count DESC")
    List<Map<String, Object>> selectBreedDistribution();
}
