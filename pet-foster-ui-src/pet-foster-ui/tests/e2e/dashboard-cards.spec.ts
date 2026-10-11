import { test, expect } from "@playwright/test"
import { login } from "./helpers/auth"

test.describe("首页卡片数据展示", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
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
    // 调用后端API获取统计数据
    const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    const response = await page.request.get("http://127.0.0.1:8090/api/stats/dashboard", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    const stats = data.data || data

    // 验证前端显示与后端数据一致
    const fosteringCard = page.locator(".stat-card", { hasText: "寄养中宠物" })
    await expect(fosteringCard.locator(".stat-value")).toContainText(String(stats.fosteringCount))

    const pendingCard = page.locator(".stat-card", { hasText: "待入店订单" })
    await expect(pendingCard.locator(".stat-value")).toContainText(String(stats.pendingCount))

    const monthlyCard = page.locator(".stat-card", { hasText: "本月订单" })
    await expect(monthlyCard.locator(".stat-value")).toContainText(String(stats.monthlyOrderCount))

    const revenueCard = page.locator(".stat-card", { hasText: "本月寄养金额" })
    const expectedRevenue = Number(stats.monthlyRevenue).toLocaleString("zh-CN")
    await expect(revenueCard.locator(".stat-value")).toContainText(expectedRevenue)
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
