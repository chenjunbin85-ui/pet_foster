package com.petfoster.security;

import com.petfoster.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.TimeUnit;

/**
 * 登录失败次数限制（计数存放在 Redis）。
 *
 * <p>同一账号在 {@link #WINDOW} 内失败 {@link #MAX_ATTEMPTS} 次后锁定 {@link #WINDOW}，
 * 锁定期内直接拒绝登录并提示剩余时间；登录成功则清零。
 *
 * <p>登录页与「切换角色」浮窗都走 {@code /api/auth/login}，因此共用同一套计数，
 * 刷新页面或换入口都无法绕过。计数放在 Redis，服务重启不会丢失。
 *
 * <p>Redis 键：
 * <ul>
 *   <li>{@code pet:foster:login:fail:{账号}} —— 失败次数，TTL 为一个统计窗口</li>
 *   <li>{@code pet:foster:login:lock:{账号}} —— 锁定标记，TTL 为锁定时长</li>
 * </ul>
 *
 * <p>Redis 不可用时只记录告警并跳过限制，避免因为缓存故障导致所有人都登录不了。
 */
@Service
public class LoginAttemptService {

    private static final Logger log = LoggerFactory.getLogger(LoginAttemptService.class);

    /** 触发锁定所需的失败次数 */
    public static final int MAX_ATTEMPTS = 5;

    /** 统计窗口，同时也是锁定时长 */
    public static final Duration WINDOW = Duration.ofMinutes(5);

    private static final String FAIL_KEY_PREFIX = "pet:foster:login:fail:";
    private static final String LOCK_KEY_PREFIX = "pet:foster:login:lock:";

    private final StringRedisTemplate redis;

    public LoginAttemptService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * 登录前校验：命中锁定则直接拒绝。
     *
     * @throws BusinessException 账号处于锁定期内
     */
    public void checkNotLocked(String username) {
        try {
            Long ttl = redis.getExpire(lockKey(username), TimeUnit.SECONDS);
            if (ttl != null && ttl > 0) {
                throw new BusinessException(lockedMessage(ttl));
            }
        } catch (BusinessException e) {
            throw e;
        } catch (DataAccessException e) {
            degrade("检查登录锁定状态", username, e);
        }
    }

    /**
     * 记录一次登录失败，并返回应提示给用户的信息。
     *
     * @param reason 失败原因，例如「密码错误」
     * @return 触发锁定后返回「登录失败次数过多，请 5 分钟后再试」，
     *         否则返回「{@code reason}，还可尝试 N 次」
     */
    public String recordFailure(String username, String reason) {
        try {
            String failKey = failKey(username);
            Long count = redis.opsForValue().increment(failKey);
            if (count == null) {
                return reason;
            }
            if (count == 1L) {
                // 第一次失败才开始计时，构成「5 分钟窗口」
                redis.expire(failKey, WINDOW.toSeconds(), TimeUnit.SECONDS);
            }
            if (count >= MAX_ATTEMPTS) {
                redis.delete(failKey);
                redis.opsForValue().set(lockKey(username), "1", WINDOW.toSeconds(), TimeUnit.SECONDS);
                return lockedMessage(WINDOW.toSeconds());
            }
            return reason + "，还可尝试 " + (MAX_ATTEMPTS - count) + " 次";
        } catch (DataAccessException e) {
            degrade("记录登录失败次数", username, e);
            return reason;
        }
    }

    /** 登录成功：清零该账号的失败次数与锁定标记 */
    public void recordSuccess(String username) {
        try {
            redis.delete(failKey(username));
            redis.delete(lockKey(username));
        } catch (DataAccessException e) {
            degrade("清空登录失败计数", username, e);
        }
    }

    /** 锁定期提示，剩余时间向上取整到分钟（刚锁定时即为 5 分钟） */
    private static String lockedMessage(long seconds) {
        long minutes = Math.max(1, (seconds + 59) / 60);
        return "登录失败次数过多，请 " + minutes + " 分钟后再试";
    }

    private void degrade(String action, String username, DataAccessException e) {
        log.warn("Redis 不可用，已跳过登录失败次数限制（{}，账号 {}）：{}", action, username, e.getMessage());
    }

    private static String failKey(String username) {
        return FAIL_KEY_PREFIX + normalized(username);
    }

    private static String lockKey(String username) {
        return LOCK_KEY_PREFIX + normalized(username);
    }

    private static String normalized(String username) {
        return username == null ? "" : username.trim().toLowerCase();
    }
}
