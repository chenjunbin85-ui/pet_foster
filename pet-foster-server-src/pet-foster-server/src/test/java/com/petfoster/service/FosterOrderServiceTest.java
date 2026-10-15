package com.petfoster.service;

import com.petfoster.common.BusinessException;import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.entity.Customer;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.FosterPrice;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.FosterPriceMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.vo.FosterOrderVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("寄养订单Service单元测试")
class FosterOrderServiceTest {

    @Mock
    private FosterOrderMapper orderMapper;

    @Mock
    private CustomerMapper customerMapper;

    @Mock
    private PetMapper petMapper;

    @Mock
    private FosterPriceMapper fosterPriceMapper;

    @InjectMocks
    private FosterOrderService orderService;

    @BeforeEach
    void setUp() throws Exception {
        // 用反射设置baseMapper（ServiceImpl的protected字段）
        java.lang.reflect.Field baseMapperField = com.baomidou.mybatisplus.extension.service.impl.ServiceImpl.class.getDeclaredField("baseMapper");
        baseMapperField.setAccessible(true);
        baseMapperField.set(orderService, orderMapper);
    }

    private FosterOrder buildOrder(Long id, String status) {
        FosterOrder o = new FosterOrder();
        o.setOrderId(id);
        o.setOrderNo("FO20261011001");
        o.setCustomerId(1L);
        o.setPetId(1L);
        o.setStartDate(LocalDate.of(2026, 10, 1));
        o.setEndDate(LocalDate.of(2026, 10, 5));
        o.setPriceId(1L);
        o.setPricePerDay(new BigDecimal("100"));
        o.setTotalFee(new BigDecimal("500"));
        o.setStatus(status);
        o.setCreatorId(1L);
        o.setCreateTime(LocalDateTime.now());
        return o;
    }

    private FosterOrderDTO buildDTO() {
        FosterOrderDTO dto = new FosterOrderDTO();
        dto.setCustomerId(1L);
        dto.setPetId(1L);
        dto.setStartDate(LocalDate.of(2026, 10, 1));
        dto.setEndDate(LocalDate.of(2026, 10, 5));
        dto.setPriceId(1L);
        dto.setRemark("测试订单");
        return dto;
    }

    /** 当天订单号前缀，如 FO20261015 */
    private static String todayPrefix() {
        return "FO" + LocalDate.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMdd"));
    }

    /** mock 价位档位：单价 + 启用状态 */
    private void mockPrice(Long id, String price, int status) {
        FosterPrice p = new FosterPrice();
        p.setPriceId(id);
        p.setPricePerDay(new BigDecimal(price));
        p.setStatus(status);
        when(fosterPriceMapper.selectById(id)).thenReturn(p);
    }

    @Nested
    @DisplayName("订单创建")
    class CreateOrder {

        @Test
        @DisplayName("创建订单成功 - 以价位表计价，自动计算总费用")
        void createSuccess() {
            mockPrice(1L, "100", 1);
            FosterOrderDTO dto = buildDTO();
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper, times(1)).insert(argThat(o -> {
                // 5天 * 100 = 500
                assertEquals(new BigDecimal("500"), o.getTotalFee());
                assertEquals(new BigDecimal("100"), o.getPricePerDay());
                assertEquals(1L, o.getPriceId());
                assertEquals("待入店", o.getStatus());
                assertEquals(todayPrefix() + "001", o.getOrderNo());
                return true;
            }));
        }

        @Test
        @DisplayName("创建订单 - 订单号递增（物理计数，含逻辑删除）")
        void createOrderNoIncrement() {
            mockPrice(1L, "100", 1);
            FosterOrderDTO dto = buildDTO();
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);
            when(orderMapper.countByOrderNoPrefix(anyString())).thenReturn(5L);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper).insert(argThat(o -> {
                assertEquals(todayPrefix() + "006", o.getOrderNo());
                return true;
            }));
        }

        @Test
        @DisplayName("创建订单 - 单日寄养费用正确")
        void createSingleDay() {
            mockPrice(1L, "100", 1);
            FosterOrderDTO dto = buildDTO();
            dto.setEndDate(dto.getStartDate()); // 同一天
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper).insert(argThat(o -> {
                // 1天 * 100 = 100
                assertEquals(new BigDecimal("100"), o.getTotalFee());
                return true;
            }));
        }

        @Test
        @DisplayName("创建订单失败 - 价位档位不存在")
        void createPriceNotFound() {
            when(fosterPriceMapper.selectById(999L)).thenReturn(null);
            FosterOrderDTO dto = buildDTO();
            dto.setPriceId(999L);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.create(dto, 1L));
            assertEquals("价位档位不存在", ex.getMessage());
            verify(orderMapper, never()).insert(any());
        }

        @Test
        @DisplayName("创建订单失败 - 价位档位已停用")
        void createPriceDisabled() {
            mockPrice(1L, "100", 0);
            FosterOrderDTO dto = buildDTO();

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.create(dto, 1L));
            assertEquals("该价位档位已停用，请联系管理员", ex.getMessage());
            verify(orderMapper, never()).insert(any());
        }

        @Test
        @DisplayName("创建订单失败 - 未选择价位档位")
        void createPriceNull() {
            FosterOrderDTO dto = buildDTO();
            dto.setPriceId(null);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.create(dto, 1L));
            assertEquals("请选择寄养价位档位", ex.getMessage());
            verify(orderMapper, never()).insert(any());
        }
    }

    @Nested
    @DisplayName("订单状态流转")
    class StatusTransition {

        @Test
        @DisplayName("确认入店成功 - 待入店 -> 寄养中")
        void checkInSuccess() {
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.checkIn(1L));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals("寄养中", updated.getStatus());
                return true;
            }));
        }

        @Test
        @DisplayName("确认入店失败 - 非待入店状态")
        void checkInInvalidStatus() {
            FosterOrder o = buildOrder(1L, "寄养中");
            when(orderMapper.selectById(1L)).thenReturn(o);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.checkIn(1L));
            assertEquals("只有待入店状态的订单才能确认入店", ex.getMessage());
            verify(orderMapper, never()).updateById(any());
        }

        @Test
        @DisplayName("确认入店失败 - 订单不存在")
        void checkInNotFound() {
            when(orderMapper.selectById(999L)).thenReturn(null);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.checkIn(999L));
            assertEquals("订单不存在", ex.getMessage());
        }

        @Test
        @DisplayName("确认离店成功 - 寄养中 -> 已完成")
        void checkOutSuccess() {
            FosterOrder o = buildOrder(1L, "寄养中");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.checkOut(1L));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals("已完成", updated.getStatus());
                return true;
            }));
        }

        @Test
        @DisplayName("确认离店失败 - 非寄养中状态")
        void checkOutInvalidStatus() {
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.checkOut(1L));
            assertEquals("只有寄养中状态的订单才能确认离店", ex.getMessage());
        }

        @Test
        @DisplayName("取消订单成功 - 待入店订单（工作人员可取消）")
        void cancelSuccess() {
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.cancel(1L));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals("已取消", updated.getStatus());
                return true;
            }));
        }

        @Test
        @DisplayName("取消订单失败 - 已完成订单不能取消")
        void cancelCompletedOrder() {
            FosterOrder o = buildOrder(1L, "已完成");
            when(orderMapper.selectById(1L)).thenReturn(o);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.cancel(1L));
            assertEquals("只有待入店或寄养中状态的订单才能取消", ex.getMessage());
        }
    }

    @Nested
    @DisplayName("订单修改")
    class UpdateOrder {

        @Test
        @DisplayName("修改订单成功 - 换档位重新计价")
        void updateSuccess() {
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);
            mockPrice(2L, "150", 1);

            FosterOrderDTO dto = buildDTO();
            dto.setPriceId(2L);
            assertDoesNotThrow(() -> orderService.update(1L, dto));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals(new BigDecimal("750"), updated.getTotalFee()); // 5天 * 150
                assertEquals(2L, updated.getPriceId());
                return true;
            }));
        }

        @Test
        @DisplayName("修改订单失败 - 已完成订单不能修改")
        void updateCompletedOrder() {
            FosterOrder o = buildOrder(1L, "已完成");
            when(orderMapper.selectById(1L)).thenReturn(o);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.update(1L, buildDTO()));
            assertEquals("已完成或已取消的订单不能修改", ex.getMessage());
        }

        @Test
        @DisplayName("修改订单失败 - 订单不存在")
        void updateNotFound() {
            when(orderMapper.selectById(999L)).thenReturn(null);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.update(999L, buildDTO()));
            assertEquals("订单不存在", ex.getMessage());
        }
    }

    @Nested
    @DisplayName("订单详情")
    class GetDetail {

        @Test
        @DisplayName("获取详情成功 - 填充客户名和宠物名")
        void getDetailSuccess() {
            FosterOrder o = buildOrder(1L, "寄养中");
            Customer c = new Customer();
            c.setCustomerId(1L);
            c.setName("张三");
            Pet p = new Pet();
            p.setPetId(1L);
            p.setName("旺财");

            when(orderMapper.selectById(1L)).thenReturn(o);
            when(customerMapper.selectById(1L)).thenReturn(c);
            when(petMapper.selectById(1L)).thenReturn(p);

            FosterOrderVO vo = orderService.getDetail(1L);

            assertNotNull(vo);
            assertEquals("FO20261011001", vo.getOrderNo());
            assertEquals("1", vo.getPriceId());
            assertEquals("张三", vo.getCustomerName());
            assertEquals("旺财", vo.getPetName());
            assertEquals("寄养中", vo.getStatus());
        }

        @Test
        @DisplayName("获取详情失败 - 订单不存在")
        void getDetailNotFound() {
            when(orderMapper.selectById(999L)).thenReturn(null);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.getDetail(999L));
            assertEquals("订单不存在", ex.getMessage());
        }
    }
}
