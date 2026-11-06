package com.petfoster.security;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.petfoster.entity.Staff;
import com.petfoster.entity.StaffCert;
import com.petfoster.entity.StaffShift;
import com.petfoster.mapper.StaffCertMapper;
import com.petfoster.mapper.StaffMapper;
import com.petfoster.mapper.StaffShiftMapper;
import com.petfoster.util.SecurityUtil;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 员工端权限单一事实源。
 *
 * <p>口径见 docs/PRD.md 3.1 / 3.6 与 docs/业务补齐方案.md 11.3、11.12：
 * 岗位存代码不存中文，空值 fail closed；admin 落点 OWNER；
 * 兽医签署额外要求「执业证有效 + 当日在岗」，无 VET 在岗不降级代签。
 *
 * <p>兼容历史数据：staff.positions（多值逗号分隔）优先，缺省回退 staff.position（单值），
 * 中文旧值（前台 / 护理员 / 兽医助理…）按 PRD 3.1 的映射表归一化。
 */
@Component
public class StaffAuth {

    private static final Map<String, String> CN_POSITION = new HashMap<>();
    private static final Map<String, String> DISPLAY = new HashMap<>();

    static {
        CN_POSITION.put("店长", "OWNER");
        CN_POSITION.put("管理员", "OWNER");
        CN_POSITION.put("前台", "FRONT");
        CN_POSITION.put("护理员", "CARE");
        CN_POSITION.put("兽医", "VET");
        CN_POSITION.put("兽医助理", "VET,CARE");
        CN_POSITION.put("美容师", "GROOM");
        CN_POSITION.put("外勤", "DRIVER");
        CN_POSITION.put("司机", "DRIVER");

        DISPLAY.put("OWNER", "店长／管理员");
        DISPLAY.put("FRONT", "前台");
        DISPLAY.put("CARE", "护理员");
        DISPLAY.put("VET", "兽医");
        DISPLAY.put("GROOM", "美容师");
        DISPLAY.put("DRIVER", "外勤接送");
    }

    private final StaffMapper staffMapper;
    private final StaffCertMapper certMapper;
    private final StaffShiftMapper shiftMapper;

    public StaffAuth(StaffMapper staffMapper, StaffCertMapper certMapper, StaffShiftMapper shiftMapper) {
        this.staffMapper = staffMapper;
        this.certMapper = certMapper;
        this.shiftMapper = shiftMapper;
    }

    public Long userId() {
        return SecurityUtil.getCurrentUserId();
    }

    public String role() {
        return SecurityUtil.getCurrentUser().getRole();
    }

    public boolean isAdmin() {
        return "admin".equals(role());
    }

    /**
     * 归一化岗位字符串（静态方法，登录时尚无 SecurityContext，AuthService 也要用）。
     * 未知值、空值一律返回空集合（fail closed）。
     */
    public static Set<String> normalize(String raw) {
        if (!StringUtils.hasText(raw)) return Collections.emptySet();
        Set<String> result = new LinkedHashSet<>();
        for (String part : raw.split("[,，;；\\s]+")) {
            String origin = part.trim();
            if (origin.isEmpty()) continue;
            String code = CN_POSITION.containsKey(origin) ? CN_POSITION.get(origin) : origin.toUpperCase();
            for (String c : code.split(",")) {
                if (DISPLAY.containsKey(c.trim())) result.add(c.trim());
            }
        }
        return result;
    }

    /** 归一化岗位集合；未知值、空值、禁用账号一律返回空集合（fail closed）。 */
    public Set<String> positions() {
        if (isAdmin()) return Collections.singleton("OWNER");
        Staff s = staffMapper.selectById(userId());
        if (s == null || (s.getStatus() != null && s.getStatus() != 1)) return Collections.emptySet();
        String raw = StringUtils.hasText(s.getPositions()) ? s.getPositions() : s.getPosition();
        return normalize(raw);
    }

    public String positionsText() {
        return String.join(",", positions());
    }

    public String displayName() {
        Set<String> p = positions();
        if (p.isEmpty()) return "未分配岗位";
        StringBuilder sb = new StringBuilder();
        for (String code : p) {
            if (sb.length() > 0) sb.append("、");
            sb.append(DISPLAY.getOrDefault(code, code));
        }
        return sb.toString();
    }

    public String staffName() {
        if (isAdmin()) return "店长";
        Staff s = staffMapper.selectById(userId());
        return s == null ? "员工" : s.getRealName();
    }

    public boolean has(String... need) {
        Set<String> p = positions();
        for (String n : need) if (p.contains(n)) return true;
        return false;
    }

    /** 页面隐藏只是礼貌，写接口必须再判一次。 */
    public void require(String... need) {
        if (has(need)) return;
        Set<String> p = positions();
        String current = p.isEmpty() ? "未分配岗位" : String.join("/", p);
        String wanted = String.join(" 或 ", need);
        throw new AccessDeniedException("当前岗位（" + current + "）无此操作权限，需要「" + wanted + "」岗位");
    }

    /** 执业兽医证有效且当日在岗；无 VET 在岗时 fail closed，不降级给护理代签。 */
    public boolean vetReady() {
        if (!has("VET")) return false;
        LocalDate today = LocalDate.now();
        Long count = certMapper.selectCount(new LambdaQueryWrapper<StaffCert>()
                .eq(StaffCert::getStaffId, userId())
                .in(StaffCert::getCertType, "VET_LICENSE", "执业兽医")
                .le(StaffCert::getValidFrom, today)
                .ge(StaffCert::getValidTo, today));
        if (count == null || count == 0) return false;
        Long shift = shiftMapper.selectCount(new LambdaQueryWrapper<StaffShift>()
                .eq(StaffShift::getStaffId, userId())
                .eq(StaffShift::getShiftDate, today));
        return shift != null && shift > 0;
    }

    public void requireVet() {
        if (vetReady()) return;
        if (!has("VET")) {
            throw new AccessDeniedException("该操作需要「兽医」岗位且今日在岗");
        }
        throw new AccessDeniedException("今日未确认在岗或执业兽医证已过期，按合规要求拒绝签署");
    }

    public String certNo() {
        LocalDate today = LocalDate.now();
        StaffCert c = certMapper.selectOne(new LambdaQueryWrapper<StaffCert>()
                .eq(StaffCert::getStaffId, userId())
                .in(StaffCert::getCertType, "VET_LICENSE", "执业兽医")
                .le(StaffCert::getValidFrom, today)
                .ge(StaffCert::getValidTo, today)
                .last("LIMIT 1"));
        return c == null || !StringUtils.hasText(c.getCertNo()) ? "—" : c.getCertNo();
    }

    /** 给前端页面鉴权用的身份快照（不返回任何密码类字段）。 */
    public Map<String, Object> me() {
        Map<String, Object> m = new HashMap<>();
        m.put("id", String.valueOf(userId()));
        m.put("name", staffName());
        m.put("role", role());
        m.put("positions", new java.util.ArrayList<>(positions()));
        m.put("positionsText", positionsText());
        m.put("positionLabel", displayName());
        m.put("vetReady", vetReady());
        m.put("certNo", certNo());
        m.put("onDuty", onDuty());
        return m;
    }

    public boolean onDuty() {
        if (isAdmin()) return true;
        Long shift = shiftMapper.selectCount(new LambdaQueryWrapper<StaffShift>()
                .eq(StaffShift::getStaffId, userId())
                .eq(StaffShift::getShiftDate, LocalDate.now()));
        return shift != null && shift > 0;
    }
}
