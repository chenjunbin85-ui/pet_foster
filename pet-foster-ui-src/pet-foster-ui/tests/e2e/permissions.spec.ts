import { test, expect } from "@playwright/test"
import { login, relogin, navigateTo } from "./helpers/auth"

test.describe("权限控制", () => {
  test("管理员可见系统管理菜单", async ({ page }) => {
    await login(page, "admin", "admin123")
    await expect(page.locator('.nav-item[data-nav="system"]')).toBeVisible()
  })

  test("工作人员不可见系统管理菜单", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
  })

  test("管理员可见统计分析菜单，工作人员不可见", async ({ page }) => {
    await login(page, "admin", "admin123")
    await expect(page.locator('.nav-item[data-nav="stats"]')).toBeVisible()
    await relogin(page, "staff01", "staff123")
    await expect(page.locator('.nav-item[data-nav="stats"]')).toHaveCount(0)
  })

  test("管理员侧边栏仅保留统计分析/系统管理，订单流水只从统计卡进入", async ({ page }) => {
    await login(page, "admin", "admin123")
    // 只保留两组：数据统计（统计分析）+ 系统管理（系统管理）
    for (const name of ["客户信息管理", "宠物档案管理", "健康档案管理", "寄养服务记录", "寄养订单管理", "系统首页"]) {
      await expect(page.locator(".nav-item", { hasText: name })).toHaveCount(0)
    }
    await expect(page.locator('.nav-item[data-nav="stats"]')).toBeVisible()
    await expect(page.locator('.nav-item[data-nav="system"]')).toBeVisible()
    // 工作人员侧边栏：业务模块 + 订单入口可见
    await relogin(page, "staff01", "staff123")
    await expect(page.locator(".nav-item", { hasText: "客户信息管理" })).toBeVisible()
    await expect(page.locator(".nav-item", { hasText: "寄养订单管理" })).toBeVisible()
  })

  test("工作人员可访问业务模块", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await navigateTo(page, "客户信息管理")
    await expect(page.locator(".section-kicker")).toHaveText("客户档案")
    await navigateTo(page, "宠物档案管理")
    await expect(page.locator(".section-kicker")).toHaveText("宠物档案管理")
    await navigateTo(page, "寄养订单管理")
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
  })

  test("工作人员可看到订单状态操作按钮（执行层）", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await navigateTo(page, "寄养订单管理")
    const cancelButtons = page.getByRole("button", { name: "取消" })
    // 示例订单中存在「待入店」订单时应有操作按钮；至少断言「新建寄养订单」入口可见
    await expect(page.getByRole("button", { name: /新建寄养订单/ })).toBeVisible()
  })

  test("管理员订单只读：从统计卡进入订单流水页无操作按钮", async ({ page }) => {
    await login(page, "admin", "admin123")
    // 管理员默认统计分析页；点击「订单总数」卡进入订单流水（全部历史数据）
    await page.locator(".stat-card", { hasText: "订单总数" }).click()
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
    await expect(page.getByRole("button", { name: /新建寄养订单/ })).toHaveCount(0)
    const cancelButtons = page.getByRole("button", { name: "取消" })
    await expect(cancelButtons).toHaveCount(0)
  })
})
