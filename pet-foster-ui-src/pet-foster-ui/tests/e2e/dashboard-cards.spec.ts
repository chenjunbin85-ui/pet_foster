import { test, expect } from "@playwright/test"
import { login, relogin } from "./helpers/auth"

test.describe("首页卡片数据展示", () => {
  test.beforeEach(async ({ page }) => {
    // 首页工作台面向工作人员（管理员默认进入统计分析页）
    await login(page, "staff01", "staff123")
  })

  test("四个统计卡片数据完整展示", async ({ page }) => {
    // 等待统计数据加载
    await expect(page.locator(".stat-card")).toHaveCount(4)

    const cards = [
      { label: "寄养中宠物", unit: "只", desc: "当前在店的小伙伴" },
      { label: "待入店订单", unit: "单", desc: "等待安排入住" },
      { label: "本月订单", unit: "单", desc: "本月累计寄养订单" },
      { label: "本月寄养金额", unit: "元", desc: "本月累计寄养收入" },
    ]

    for (const card of cards) {
      const cardEl = page.locator(".stat-card", { hasText: card.label })
      await expect(cardEl).toBeVisible()
      // 标题
      await expect(cardEl.locator(".stat-top")).toHaveText(card.label)
      // 数值（非占位符）
      const value = cardEl.locator(".stat-value")
      await expect(value).toBeVisible()
      const valueText = await value.textContent()
      expect(valueText, `${card.label} 数值不应为占位符`).not.toBe("—")
      expect(valueText, `${card.label} 数值不应为空`).toBeTruthy()
      // 单位
      await expect(cardEl.locator(".stat-value small")).toHaveText(card.unit)
      // 描述
      await expect(cardEl.locator("p")).toHaveText(card.desc)
    }
  })

  test("今日待办卡片数据展示", async ({ page }) => {
    const card = page.locator(".todo-care-card")
    await expect(card).toBeVisible()
    // 标题
    await expect(card.getByRole("heading", { name: "今日待办" })).toBeVisible()
    // 数字
    const count = card.locator(".care-count strong")
    await expect(count).toBeVisible()
    const countText = await count.textContent()
    expect(countText, "今日待办数字不应为空").toBeTruthy()
    // 单位
    await expect(card.locator(".care-count span")).toHaveText("项待处理")
    // 插画
    await expect(card.locator(".care-banner img")).toBeVisible()
  })

  test("在店宠物状态卡片数据展示", async ({ page }) => {
    const card = page.locator(".pet-care-card")
    await expect(card).toBeVisible()
    // 标题
    await expect(card.getByRole("heading", { name: "在店宠物状态" })).toBeVisible()
    // 数字
    const count = card.locator(".care-count strong")
    await expect(count).toBeVisible()
    const countText = await count.textContent()
    expect(countText, "在店宠物状态数字不应为空").toBeTruthy()
    // 单位
    await expect(card.locator(".care-count span")).toHaveText("只在寄养中")
    // 插画
    await expect(card.locator(".care-banner img")).toBeVisible()
  })

  test("统计卡片数值与后端数据一致", async ({ page }) => {
    // 员工首页金额卡数据来自轻量接口 /api/stats/monthly-revenue（与后端口径一致：本月已完成订单合计）
    const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    const response = await page.request.get("http://127.0.0.1:8090/api/stats/monthly-revenue", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    const expectedRevenue = Number(data.data).toLocaleString("zh-CN")

    const revenueCard = page.locator(".stat-card", { hasText: "本月寄养金额" })
    await expect(revenueCard.locator(".stat-value")).toContainText(expectedRevenue)
  })

  test("工作人员首页同样展示四卡（含本月寄养金额）", async ({ page }) => {
    // 新需求：工作人员系统首页也展示「本月寄养金额」卡（轻量口径接口双方可见）
    await expect(page.locator(".stat-card")).toHaveCount(4)
    const revenueCard = page.locator(".stat-card", { hasText: "本月寄养金额" })
    await expect(revenueCard).toBeVisible()
    const value = revenueCard.locator(".stat-value")
    await expect(value).toBeVisible()
    const valueText = await value.textContent()
    expect(valueText, "员工可见的金额不应为占位符").not.toBe("—")
    expect(valueText, "员工可见的金额不应为空").toBeTruthy()
  })

  test("卡片可点击跳转", async ({ page }) => {
    // 今日待办点击跳转到订单页
    await page.locator(".todo-care-card").click()
    await expect(page.locator(".section-kicker", { hasText: "寄养订单管理" })).toBeVisible()
    // 用侧边栏回到首页
    await page.getByText("系统首页", { exact: true }).click()
    await expect(page.locator(".section-kicker", { hasText: "门店工作台" })).toBeVisible()

    // 在店宠物状态点击跳转到宠物页
    await page.locator(".pet-care-card").click()
    await expect(page.locator(".section-kicker", { hasText: "宠物档案管理" })).toBeVisible()
  })
})
