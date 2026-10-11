package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.dto.FosterOrderDTO;
import com.petfoster.entity.Customer;
import com.petfoster.entity.FosterOrder;
import com.petfoster.entity.Pet;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.mapper.FosterOrderMapper;
import com.petfoster.mapper.PetMapper;
import com.petfoster.security.LoginUser;
import com.petfoster.vo.FosterOrderVO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
        dto.setPricePerDay(new BigDecimal("100"));
        dto.setRemark("测试订单");
        return dto;
    }

    private void setCurrentUser(String role) {
        LoginUser user = new LoginUser(1L, "admin", role);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                user, null, List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase())));
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    @Nested
    @DisplayName("订单创建")
    class CreateOrder {

        @Test
        @DisplayName("创建订单成功 - 自动计算总费用")
        void createSuccess() {
            FosterOrderDTO dto = buildDTO();
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);
            when(orderMapper.selectCount(any(Wrapper.class))).thenReturn(0L);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper, times(1)).insert(argThat(o -> {
                // 5天 * 100 = 500
                assertEquals(new BigDecimal("500"), o.getTotalFee());
                assertEquals("待入店", o.getStatus());
                assertEquals("FO20261011001", o.getOrderNo());
                return true;
            }));
        }

        @Test
        @DisplayName("创建订单 - 订单号递增")
        void createOrderNoIncrement() {
            FosterOrderDTO dto = buildDTO();
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);
            when(orderMapper.selectCount(any(Wrapper.class))).thenReturn(5L);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper).insert(argThat(o -> {
                assertEquals("FO20261011006", o.getOrderNo());
                return true;
            }));
        }

        @Test
        @DisplayName("创建订单 - 单日寄养费用正确")
        void createSingleDay() {
            FosterOrderDTO dto = buildDTO();
            dto.setEndDate(dto.getStartDate()); // 同一天
            when(orderMapper.insert(any(FosterOrder.class))).thenReturn(1);
            when(orderMapper.selectCount(any(Wrapper.class))).thenReturn(0L);

            assertDoesNotThrow(() -> orderService.create(dto, 1L));

            verify(orderMapper).insert(argThat(o -> {
                // 1天 * 100 = 100
                assertEquals(new BigDecimal("100"), o.getTotalFee());
                return true;
            }));
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
        @DisplayName("取消订单成功 - 管理员取消待入店订单")
        void cancelByAdmin() {
            setCurrentUser("admin");
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);

            assertDoesNotThrow(() -> orderService.cancel(1L));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals("已取消", updated.getStatus());
                return true;
            }));
            SecurityContextHolder.clearContext();
        }

        @Test
        @DisplayName("取消订单失败 - 工作人员无权限")
        void cancelByStaff() {
            setCurrentUser("staff");
            // 权限校验在查询之前，不需要mock selectById

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.cancel(1L));
            assertEquals("仅管理员可取消订单", ex.getMessage());
            verify(orderMapper, never()).updateById(any());
            SecurityContextHolder.clearContext();
        }

        @Test
        @DisplayName("取消订单失败 - 已完成订单不能取消")
        void cancelCompletedOrder() {
            setCurrentUser("admin");
            FosterOrder o = buildOrder(1L, "已完成");
            when(orderMapper.selectById(1L)).thenReturn(o);

            BusinessException ex = assertThrows(BusinessException.class, () -> orderService.cancel(1L));
            assertEquals("只有待入店或寄养中状态的订单才能取消", ex.getMessage());
            SecurityContextHolder.clearContext();
        }
    }

    @Nested
    @DisplayName("订单修改")
    class UpdateOrder {

        @Test
        @DisplayName("修改订单成功 - 待入店状态可修改")
        void updateSuccess() {
            FosterOrder o = buildOrder(1L, "待入店");
            when(orderMapper.selectById(1L)).thenReturn(o);
            when(orderMapper.updateById(any(FosterOrder.class))).thenReturn(1);

            FosterOrderDTO dto = buildDTO();
            dto.setPricePerDay(new BigDecimal("150"));
            assertDoesNotThrow(() -> orderService.update(1L, dto));

            verify(orderMapper).updateById(argThat(updated -> {
                assertEquals(new BigDecimal("750"), updated.getTotalFee()); // 5天 * 150
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
