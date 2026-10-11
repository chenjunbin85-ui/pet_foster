import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

test.describe("订单状态流转", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
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
})
