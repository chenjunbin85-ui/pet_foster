package com.petfoster.security;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

/**
 * Web 后台岗位级权限单一事实源（PRD 3.2「Web 端 8 页权限」）。
 *
 * <p>●=write（读写均可）、○=read（只读）、—=none（不可见，直接调接口也拒绝）。
 * Web 后台仅 OWNER（店长）与 FRONT（前台）有工位；CARE / VET / GROOM / DRIVER
 * 一律 none，作业入口只在小程序端。登录端点 /api/auth/login 与小程序员工端共用，
 * 不能按岗位拒绝登录；这里只负责拦 Web 业务接口，前端另用 hasWebWorkbench 提示改用小程序。
 * 一人多岗取最高权限；admin 由 StaffAuth.positions() 归一化为 OWNER，八页全写。
 *
 * <p>与小程序端 utils/auth.js 的 PAGE_RULES 一样，前端菜单隐藏只是第一层，
 * 这里的 @PreAuthorize("@webAuth.can(...)") 才是真正的墙。
 * /api/staff/**、/api/mp/** 不走本组件，避免误伤小程序员工端。
 */
@Component("webAuth")
public class WebAuth {

    private static final String W = "write";
    private static final String R = "read";

    private static final Map<String, Map<String, String>> MATRIX = Map.of(
        "dashboard", Map.of("OWNER", W, "FRONT", W),
        "customers", Map.of("OWNER", W, "FRONT", W),
        "pets",      Map.of("OWNER", W, "FRONT", W),
        "orders",    Map.of("OWNER", W, "FRONT", W),
        "health",    Map.of("OWNER", W, "FRONT", R),
        "services",  Map.of("OWNER", W, "FRONT", R),
        "stats",     Map.of("OWNER", W),
        "system",    Map.of("OWNER", W)
    );

    private final StaffAuth staffAuth;

    public WebAuth(StaffAuth staffAuth) {
        this.staffAuth = staffAuth;
    }

    /** 默认按「可读」判定；返回 false 时 Spring Security 产出 403。 */
    public boolean can(String module) {
        return can(module, R);
    }

    /** mode 传 read / write；未知模块、空岗位、越权写一律 false（fail closed）。 */
    public boolean can(String module, String mode) {
        Map<String, String> perms = MATRIX.get(module);
        if (perms == null) return false;
        // 客户 token 的 userId 与 staff_id 可能撞号，必须先挡住非后台身份
        String role = staffAuth.role();
        if (!"admin".equals(role) && !"staff".equals(role)) return false;
        Set<String> positions = staffAuth.positions();
        String best = "none";
        for (String p : positions) {
            String m = perms.getOrDefault(p, "none");
            if (W.equals(m)) { best = W; break; }
            if (R.equals(m)) best = R;
        }
        if ("none".equals(best)) return false;
        return !W.equals(mode) || W.equals(best);
    }

    /** 供 /api/auth/info 之外的调试与文档对照；不参与鉴权判定。 */
    public Map<String, String> capabilities() {
        java.util.Map<String, String> out = new java.util.LinkedHashMap<>();
        MATRIX.forEach((module, perms) -> out.put(module, can(module, W) ? W : can(module) ? R : "none"));
        return out;
    }
}
