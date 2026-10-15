import { Page, expect } from "@playwright/test"

export async function login(page: Page, username: string, password: string) {
  await page.goto("/")
  await page.getByLabel("账号").fill(username)
  await page.getByLabel("密码").fill(password)
  await page.getByRole("button", { name: /登\s*录/ }).click()
  // 等待登录成功：token 存入 localStorage 且页面进入工作区（管理员默认统计分析页，工作人员默认系统首页）
  await page.waitForFunction(() => localStorage.getItem("pet_foster_token") !== null, null, { timeout: 30000 })
  await expect(page.locator(".dashboard-welcome")).toBeVisible()
}

/** 清除登录态后以指定账号重新登录（用于同一用例中切换角色） */
export async function relogin(page: Page, username: string, password: string) {
  await page.evaluate(() => localStorage.clear())
  // 并行跑测时 Vite dev server 偶发中断导航（ERR_ABORTED），失败重试一次
  await page.goto("/login", { waitUntil: "domcontentloaded" }).catch(async () => {
    await page.goto("/login", { waitUntil: "domcontentloaded" })
  })
  await login(page, username, password)
}

/** 侧边栏底部头像区的「更多操作」按钮（角色切换 / 退出登录入口） */
export function profileMenuTrigger(page: Page) {
  return page.getByLabel("更多操作")
}

/** 侧边栏底部的角色文案（管理员 / 工作人员） */
export function profileRole(page: Page) {
  return page.locator(".profile small")
}

export async function logout(page: Page) {
  await profileMenuTrigger(page).click()
  await page.getByRole("menuitem", { name: "退出登录" }).click()
  // 退出登录需二次确认
  await page.getByRole("button", { name: "确认退出" }).click()
  await expect(page.getByRole("button", { name: /登\s*录/ })).toBeVisible()
}

export async function navigateTo(page: Page, menuName: string) {
  await page.locator(".nav-item", { hasText: menuName }).first().click()
  await page.waitForTimeout(500)
}
