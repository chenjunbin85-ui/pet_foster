import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

test.describe("权限控制", () => {
  test("管理员可见系统管理菜单", async ({ page }) => {
    await login(page, "admin", "admin123")
    await expect(page.locator('.nav-item[data-nav="system"]')).toBeVisible()
  })

  test("工作人员不可见系统管理菜单", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
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

  test("工作人员看不到订单状态操作按钮", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await navigateTo(page, "寄养订单管理")
    const cancelButtons = page.getByRole("button", { name: "取消" })
    await expect(cancelButtons).toHaveCount(0)
  })
})
