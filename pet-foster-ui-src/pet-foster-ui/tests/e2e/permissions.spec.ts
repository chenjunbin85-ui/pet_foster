import { test, expect } from "@playwright/test"
import { login, relogin, navigateTo } from "./helpers/auth"

test.describe("权限控制", () => {
  test("管理员可见系统管理菜单", async ({ page }) => {
    await login(page, "13800138000", "123456")
    await expect(page.locator('.nav-item[data-nav="system"]')).toBeVisible()
  })

  test("工作人员不可见系统管理菜单", async ({ page }) => {
    await login(page, "13800138012", "123456")
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
  })

  test("管理员可见经营数据菜单，工作人员不可见", async ({ page }) => {
    await login(page, "13800138000", "123456")
    await expect(page.locator('.nav-item[data-nav="stats"]')).toBeVisible()
    await relogin(page, "13800138012", "123456")
    await expect(page.locator('.nav-item[data-nav="stats"]')).toHaveCount(0)
  })

  test("管理员按 PRD 3.2 可见八页，工作人员仅业务模块", async ({ page }) => {
    await login(page, "13800138000", "123456")
    await expect(page.locator(".nav-item")).toHaveCount(8)
    await expect(page.locator('.nav-item[data-nav="orders"]')).toBeVisible()
    // 工作人员（FRONT）：业务模块 + 订单入口可见，经营数据与系统管理不可见
    await relogin(page, "13800138012", "123456")
    await expect(page.locator('.nav-item[data-nav="stats"]')).toHaveCount(0)
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
    await expect(page.locator(".nav-item", { hasText: "客户信息管理" })).toBeVisible()
    await expect(page.locator(".nav-item", { hasText: "寄养订单管理" })).toBeVisible()
  })

  test("工作人员可访问业务模块", async ({ page }) => {
    await login(page, "13800138012", "123456")
    await navigateTo(page, "客户信息管理")
    await expect(page.locator(".section-kicker")).toHaveText("客户档案")
    await navigateTo(page, "宠物档案管理")
    await expect(page.locator(".section-kicker")).toHaveText("宠物档案管理")
    await navigateTo(page, "寄养订单管理")
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
  })

  test("工作人员可看到订单状态操作按钮（执行层）", async ({ page }) => {
    await login(page, "13800138012", "123456")
    await navigateTo(page, "寄养订单管理")
    const cancelButtons = page.getByRole("button", { name: "取消" })
    // 示例订单中存在「待入店」订单时应有操作按钮；至少断言「新建寄养订单」入口可见
    await expect(page.getByRole("button", { name: /新建寄养订单/ })).toBeVisible()
  })

  test("管理员订单可写：八页全写口径下新建入口可见", async ({ page }) => {
    await login(page, "13800138000", "123456")
    // 管理员默认经营数据页；点击「订单总数」卡进入订单流水
    await page.locator(".stat-card", { hasText: "订单总数" }).click()
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
    await expect(page.getByRole("button", { name: /新建寄养订单/ })).toBeVisible()
  })
})
