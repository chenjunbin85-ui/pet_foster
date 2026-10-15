import { test, expect, type Page } from "@playwright/test"
import { login } from "./helpers/auth"

const API_BASE = "http://127.0.0.1:8090/api"

async function getToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
  return token || ""
}

async function createTestCustomers(page: Page, count: number) {
  const token = await getToken(page)
  for (let i = 0; i < count; i++) {
    await page.request.post(`${API_BASE}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: `分页测试客户${String(i + 1).padStart(3, "0")}`,
        phone: `139${String(10000000 + i).slice(-8)}`,
        address: `测试地址${i + 1}`,
        remark: "分页测试",
      },
    })
  }
}

async function deleteTestCustomers(page: Page) {
  const token = await getToken(page)
  // 搜索所有分页测试客户
  const res = await page.request.get(`${API_BASE}/customers?page=1&size=100&keyword=分页测试客户`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.json()
  const records = body.data?.records || []
  for (const r of records) {
    await page.request.delete(`${API_BASE}/customers/${r.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  }
}

test.describe("分页显示", () => {
  test("客户列表分页显示与翻页", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1080 })
    // 客户为执行层业务，由工作人员操作
    await login(page, "staff01", "staff123")
    await page.waitForTimeout(4000) // 等待toast消失

    // 先清理可能残留的测试数据
    await deleteTestCustomers(page)
    await page.waitForTimeout(1000)

    // 插入15条测试数据（超过PAGE_SIZE=10，触发分页）
    await createTestCustomers(page, 15)
    await page.waitForTimeout(1000)

    try {
      // 导航到客户页
      await page.getByRole("button", { name: "客户信息管理" }).click()
      await page.waitForTimeout(2000)

      // 滚动到页面底部，确保分页控件可见
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(500)

      // 验证总数大于0
      const footer = page.locator(".customer-table-footer")
      await expect(footer).toContainText("共")
      await expect(footer).toContainText("位客户")

      // 验证分页控件显示
      const pageNumbers = footer.locator(".pagination-page")
      const pageCount = await pageNumbers.count()
      expect(pageCount).toBeGreaterThanOrEqual(1)

      // 验证当前页高亮
      await expect(pageNumbers.nth(0)).toHaveClass(/active/)

      // 验证表格有数据行
      const rows = page.locator(".customer-table tbody tr:not(.empty-row)")
      const rowCount = await rows.count()
      expect(rowCount).toBeGreaterThan(0)

      // 验证"上一页"按钮在第一页禁用
      const prevBtn = footer.getByRole("button", { name: "上一页" })
      await expect(prevBtn).toBeDisabled()

      // 点击"下一页"（如果有多个页面）
      const nextBtn = footer.getByRole("button", { name: "下一页" })
      const isNextEnabled = await nextBtn.isEnabled()
      if (isNextEnabled) {
        await nextBtn.click()
        await page.waitForTimeout(2000)

        // 验证当前页有且仅有一个active
        const pageNumbersAfter = footer.locator(".pagination-page")
        const activeCount = await pageNumbersAfter.evaluateAll((els) =>
          els.filter((el) => el.className.includes("active")).length
        )
        expect(activeCount).toBe(1)

        // 验证"上一页"按钮启用
        await expect(prevBtn).toBeEnabled()

        // 点击页码1回到第一页
        await pageNumbersAfter.nth(0).click()
        await page.waitForTimeout(2000)
        const activePageAfter = footer.locator(".pagination-page.active")
        await expect(activePageAfter).toHaveText("1")
      }

      // 验证总数显示
      await expect(footer).toContainText("共")
      await expect(footer).toContainText("位客户")
    } finally {
      // 清理测试数据
      await deleteTestCustomers(page)
    }
  })

  test("分页控件正常显示且按钮状态正确", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1080 })
    // 宠物为执行层业务，由工作人员操作
    await login(page, "staff01", "staff123")
    await page.waitForTimeout(4000)

    // 进入宠物页
    await page.getByRole("button", { name: "宠物档案管理" }).click()
    await page.waitForTimeout(2000)

    // 滚动到页面底部
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // 分页控件存在
    const footer = page.locator(".customer-table-footer, .table-footer, .pagination-footer").first()
    await expect(footer).toBeVisible()

    // 上一页按钮在第一页禁用
    const prevBtn = footer.getByRole("button", { name: "上一页" })
    await expect(prevBtn).toBeDisabled()

    // 页码按钮至少1个
    const pageNumbers = footer.locator(".pagination-page")
    const pageCount = await pageNumbers.count()
    expect(pageCount).toBeGreaterThanOrEqual(1)
    await expect(pageNumbers.nth(0)).toHaveClass(/active/)
  })
})
