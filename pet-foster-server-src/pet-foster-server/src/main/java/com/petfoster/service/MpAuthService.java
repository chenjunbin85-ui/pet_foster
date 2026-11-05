package com.petfoster.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.common.BusinessException;
import com.petfoster.dto.MpLoginDTO;
import com.petfoster.dto.MpRegisterDTO;
import com.petfoster.entity.Customer;
import com.petfoster.mapper.CustomerMapper;
import com.petfoster.security.LoginAttemptService;
import com.petfoster.util.JwtUtil;
import com.petfoster.vo.CustomerVO;
import com.petfoster.vo.MpLoginVO;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * 小程序端客户认证（手机号 + 密码）。
 *
 * <p>登录失败次数限制复用 {@link LoginAttemptService}（Redis 计数，5 次/5 分钟锁定）；
 * JWT 角色为 customer，与 web 端 admin/staff 互不干扰。
 */
@Service
public class MpAuthService {

    private final CustomerMapper customerMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final LoginAttemptService loginAttemptService;

    public MpAuthService(CustomerMapper customerMapper, PasswordEncoder passwordEncoder,
                         JwtUtil jwtUtil, LoginAttemptService loginAttemptService) {
        this.customerMapper = customerMapper;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.loginAttemptService = loginAttemptService;
    }

    public MpLoginVO login(MpLoginDTO dto) {
        String phone = dto.getPhone().trim();
        loginAttemptService.checkNotLocked(phone);

        Customer customer = customerMapper.selectOne(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getUsername, phone));
        if (customer == null) {
            throw new BusinessException(loginAttemptService.recordFailure(phone, "手机号未注册"));
        }
        if (customer.getStatus() != null && customer.getStatus() == 0) {
            throw new BusinessException("账号已被禁用，请联系门店");
        }
        if (customer.getPassword() == null || !passwordEncoder.matches(dto.getPassword(), customer.getPassword())) {
            throw new BusinessException(loginAttemptService.recordFailure(phone, "密码错误"));
        }
        loginAttemptService.recordSuccess(phone);

        customer.setLastLoginTime(LocalDateTime.now());
        customerMapper.updateById(customer);

        String token = jwtUtil.generateToken(customer.getCustomerId(), phone, "customer");
        MpLoginVO vo = new MpLoginVO();
        vo.setToken(token);
        vo.setCustomer(toVO(customer));
        return vo;
    }

    public CustomerVO me(Long customerId) {
        Customer customer = customerMapper.selectById(customerId);
        if (customer == null) {
            throw new BusinessException("客户不存在");
        }
        return toVO(customer);
    }

    /**
     * 自助注册：手机号 + 密码创建客户，成功后自动登录返回 token。
     */
    public MpLoginVO register(MpRegisterDTO dto) {
        String phone = dto.getPhone().trim();
        Long exists = customerMapper.selectCount(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getUsername, phone));
        if (exists != null && exists > 0) {
            throw new BusinessException("该手机号已注册，请直接登录");
        }
        Customer customer = new Customer();
        customer.setName("爱宠家长");
        customer.setPhone(phone);
        customer.setUsername(phone);
        customer.setPassword(passwordEncoder.encode(dto.getPassword()));
        customer.setStatus(1);
        customer.setCreateTime(LocalDateTime.now());
        customerMapper.insert(customer);

        String token = jwtUtil.generateToken(customer.getCustomerId(), phone, "customer");
        MpLoginVO vo = new MpLoginVO();
        vo.setToken(token);
        vo.setCustomer(toVO(customer));
        return vo;
    }

    private CustomerVO toVO(Customer customer) {
        CustomerVO vo = new CustomerVO();
        vo.setId(String.valueOf(customer.getCustomerId()));
        vo.setName(customer.getName());
        vo.setPhone(customer.getPhone());
        vo.setAddress(customer.getAddress());
        vo.setRemark(customer.getRemark());
        vo.setCreatedAt(customer.getCreateTime());
        return vo;
    }
}
