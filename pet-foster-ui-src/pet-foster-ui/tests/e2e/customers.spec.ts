import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

test.describe("客户管理 CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
    await navigateTo(page, "客户信息管理")
  })

  test("客户列表加载", async ({ page }) => {
    await expect(page.locator(".section-kicker")).toHaveText("客户档案")
    // 验证表格有数据行（不依赖特定客户名，因数据量和分页动态变化）
    const rows = page.locator("table tbody tr:not(.empty-row)")
    await expect(rows.first()).toBeVisible()
  })

  test("搜索客户", async ({ page }) => {
    await page.getByPlaceholder("按客户姓名 / 手机号搜索").fill("王小红")
    await page.keyboard.press("Enter")
    await page.waitForTimeout(800)
    await expect(page.getByRole("cell", { name: "王小红", exact: true })).toBeVisible()
  })

  test("新增客户弹窗打开", async ({ page }) => {
    await page.getByRole("button", { name: "新增客户" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: "保存" })).toBeVisible()
  })

  test("手机号重复校验", async ({ page }) => {
    await page.getByRole("button", { name: "新增客户" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("姓名").fill("重复客户")
    await dialog.getByLabel("联系电话").fill("13800138000")
    await dialog.getByLabel("居住地址").fill("测试地址")
    await dialog.getByRole("button", { name: "保存" }).click()
    await expect(dialog.getByText(/手机号/)).toBeVisible()
  })
})
