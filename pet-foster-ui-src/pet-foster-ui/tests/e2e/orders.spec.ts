import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

test.describe("订单状态流转", () => {
  test.beforeEach(async ({ page }) => {
    // 订单列表为执行层页面（管理员侧边栏无订单入口，订单流水仅能从统计卡进入）
    await login(page, "staff01", "staff123")
    await navigateTo(page, "寄养订单管理")
  })

  test("订单列表加载", async ({ page }) => {
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
    const rowCount = await page.locator(".customer-table tbody tr").count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test("订单状态筛选控件存在", async ({ page }) => {
    await expect(page.getByLabel("全部状态")).toBeVisible()
    const rowCount = await page.locator(".customer-table tbody tr").count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test("订单详情可查看", async ({ page }) => {
    const firstRow = page.locator(".customer-table tbody tr").first()
    await expect(firstRow).toBeVisible()
    await expect(firstRow.locator("td").first()).toBeVisible()
  })

  test("订单编号搜索框存在", async ({ page }) => {
    await expect(page.getByPlaceholder("按订单编号搜索")).toBeVisible()
  })

  test("工作人员订单页返回键回到系统首页", async ({ page }) => {
    const backBtn = page.locator(".page-back-btn")
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page.locator(".section-kicker", { hasText: "门店工作台" })).toBeVisible()
  })
})
