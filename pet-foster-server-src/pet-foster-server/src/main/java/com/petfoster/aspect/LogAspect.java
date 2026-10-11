package com.petfoster.aspect;

import com.petfoster.entity.OperLog;
import com.petfoster.mapper.OperLogMapper;
import com.petfoster.security.LoginUser;
import com.petfoster.util.SecurityUtil;
import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;

@Aspect
@Component
public class LogAspect {

    private final OperLogMapper operLogMapper;

    public LogAspect(OperLogMapper operLogMapper) {
        this.operLogMapper = operLogMapper;
    }

    @Around("@annotation(logAnnotation)")
    public Object around(ProceedingJoinPoint joinPoint, Log logAnnotation) throws Throwable {
        Object result = joinPoint.proceed();
        try {
            saveLog(joinPoint, logAnnotation);
        } catch (Exception ignored) {
        }
        return result;
    }

    private void saveLog(ProceedingJoinPoint joinPoint, Log logAnnotation) {
        OperLog operLog = new OperLog();
        operLog.setModule(logAnnotation.module());
        operLog.setContent(logAnnotation.content());
        operLog.setRequestTime(LocalDateTime.now());

        // 获取当前用户
        try {
            LoginUser user = SecurityUtil.getCurrentUser();
            operLog.setUserId(user.getUserId());
        } catch (Exception ignored) {
        }

        // 获取 IP
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String ip = request.getHeader("X-Forwarded-For");
                if (ip == null || ip.isEmpty()) ip = request.getRemoteAddr();
                operLog.setIp(ip);
            }
        } catch (Exception ignored) {
        }

        operLogMapper.insert(operLog);
    }
}
