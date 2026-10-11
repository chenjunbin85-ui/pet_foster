import { test, expect, type Page } from "@playwright/test"
import { login } from "./helpers/auth"

const loginButton = (page: Page) => page.getByRole("button", { name: /登\s*录/ })

test.describe("认证模块", () => {
  test("登录页按设计稿渲染", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { name: /安心寄养/ })).toBeVisible()
    await expect(page.getByRole("heading", { name: "欢迎登录" })).toBeVisible()
    await expect(page.getByLabel("账号")).toBeVisible()
    await expect(page.getByLabel("密码")).toBeVisible()
    await expect(loginButton(page)).toBeVisible()
  })

  test("管理员登录成功", async ({ page }) => {
    await login(page, "admin", "admin123")
    await expect(page.getByText("寄养中宠物")).toBeVisible()
  })

  test("工作人员登录成功", async ({ page }) => {
    await login(page, "staff01", "staff123")
    await expect(page.getByText("寄养中宠物")).toBeVisible()
  })

  test("错误密码登录失败并在表单内提示", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("账号").fill("nonexistent_user")
    await page.getByLabel("密码").fill("wrongpassword")
    await loginButton(page).click()
    await expect(page.getByRole("alert")).toContainText(/用户不存在|密码错误/)
    // 停留在登录页，未进入系统
    await expect(loginButton(page)).toBeVisible()
    await expect(page.getByText("寄养中宠物")).toHaveCount(0)
  })

  test("空账号登录被拦截", async ({ page }) => {
    await page.goto("/")
    await loginButton(page).click()
    await expect(loginButton(page)).toBeVisible()
    await expect(page.getByText("寄养中宠物")).toHaveCount(0)
  })
})
