package com.petfoster.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.petfoster.common.BusinessException;

/**
 * 宠物疫苗 JSON 编码工具（小程序端约定）。
 *
 * <p>编码：{@code {"status":"已接种","name":"狂犬疫苗","date":"2026-03"}}
 * <ul>
 *   <li>status：已接种 / 未接种</li>
 *   <li>name：疫苗名称，≤100 字</li>
 *   <li>date：接种日期（yyyy-MM），可为空字符串</li>
 * </ul>
 *
 * <p>web 端历史数据为中文描述（如「狂犬疫苗已接种」），非 JSON 字符串保持原样，
 * 展示与下单校验均做兼容处理。
 */
public final class VaccineJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    public static final String VACCINATED = "已接种";
    public static final String NOT_VACCINATED = "未接种";

    private VaccineJson() {
    }

    /** 校验并返回规范化 JSON；web 端历史中文数据原样放行。 */
    public static String normalize(String vaccine) {
        if (vaccine == null || vaccine.isBlank()) {
            return vaccine;
        }
        String trimmed = vaccine.trim();
        if (!trimmed.startsWith("{")) {
            return vaccine;
        }
        try {
            JsonNode node = MAPPER.readTree(trimmed);
            String status = node.path("status").asText("");
            String name = node.path("name").asText("");
            String date = node.path("date").asText("");
            if (status.isEmpty()) {
                throw new BusinessException("疫苗信息缺少 status");
            }
            if (!VACCINATED.equals(status) && !NOT_VACCINATED.equals(status)) {
                throw new BusinessException("疫苗状态仅支持「已接种」或「未接种」");
            }
            if (name.length() > 100) {
                throw new BusinessException("疫苗名称不能超过100字");
            }
            if (date.length() > 20) {
                throw new BusinessException("疫苗日期不能超过20字");
            }
            return MAPPER.writeValueAsString(MAPPER.createObjectNode()
                    .put("status", status)
                    .put("name", name)
                    .put("date", date));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("疫苗信息格式不正确，应为 {\"status\":\"已接种\",\"name\":\"疫苗名称\",\"date\":\"yyyy-MM\"}");
        }
    }

    /** 是否已免疫（可下单）：JSON 且 status=已接种，或历史中文描述视为已维护；空/未接种不可下单。 */
    public static boolean isVaccinated(String vaccine) {
        if (vaccine == null || vaccine.isBlank()) {
            return false;
        }
        String trimmed = vaccine.trim();
        if (!trimmed.startsWith("{")) {
            return true;
        }
        try {
            return VACCINATED.equals(MAPPER.readTree(trimmed).path("status").asText(""));
        } catch (Exception e) {
            return false;
        }
    }

    /** 解析为可读文本（如「狂犬疫苗 · 2026-06」）；非 JSON 原样返回。 */
    public static String toReadable(String vaccine) {
        if (vaccine == null || vaccine.isBlank()) {
            return "";
        }
        String trimmed = vaccine.trim();
        if (!trimmed.startsWith("{")) {
            return trimmed;
        }
        try {
            JsonNode node = MAPPER.readTree(trimmed);
            String status = node.path("status").asText("");
            String name = node.path("name").asText("");
            String date = node.path("date").asText("");
            StringBuilder sb = new StringBuilder();
            if (!name.isEmpty()) {
                sb.append(name);
            }
            if (!date.isEmpty()) {
                if (!sb.isEmpty()) {
                    sb.append(" · ");
                }
                sb.append(date);
            }
            if (sb.isEmpty()) {
                sb.append(status.isEmpty() ? "疫苗信息" : status);
            }
            return sb.toString();
        } catch (Exception e) {
            return trimmed;
        }
    }
}
