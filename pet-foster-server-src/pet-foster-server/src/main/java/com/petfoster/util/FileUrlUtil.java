package com.petfoster.util;

import com.petfoster.common.BusinessException;

import java.util.regex.Pattern;

/**
 * 图片地址校验：只允许本项目上传接口产出的相对地址，或 http(s) 绝对地址。
 *
 * <p>小程序 image 与 Web 端 img 都直接把该值当 src 使用，若不校验，前端可写入
 * {@code javascript:}、{@code data:} 等协议造成注入或展示非图片内容。
 */
public final class FileUrlUtil {

    /** 上传接口返回的地址形态：/api/files/8f3c...jpg */
    private static final Pattern LOCAL = Pattern.compile("^/api/files/[A-Za-z0-9._-]{1,120}$");
    /** 兼容对象存储/历史数据中的绝对地址 */
    private static final Pattern ABSOLUTE = Pattern.compile("^https?://[^\\s\"'<>]{1,400}$");

    private FileUrlUtil() {
    }

    /** 空值归一为 null；非法地址抛业务异常 */
    public static String normalize(String url) {
        if (url == null) return null;
        String trimmed = url.trim();
        if (trimmed.isEmpty()) return null;
        if (LOCAL.matcher(trimmed).matches() || ABSOLUTE.matcher(trimmed).matches()) {
            return trimmed;
        }
        throw new BusinessException("图片地址不合法，请通过上传接口获取图片地址");
    }
}
