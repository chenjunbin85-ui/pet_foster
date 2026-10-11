import { test, expect } from "@playwright/test"
import { login, profileMenuTrigger, profileRole } from "./helpers/auth"

// 登录失败次数限制：同一账号 5 分钟内失败 5 次后锁定 5 分钟。
// 登录接口用一次性账号驱动，避免把 admin / staff01 锁掉影响其它用例。
test.describe("登录失败次数限制", () => {
  test("连续 5 次失败后锁定并提示 5 分钟后再试", async ({ page }) => {
    await login(page, "admin", "admin123")
    const tempUser = `lock_${Date.now()}`

    // 通过「切换角色」浮窗驱动登录接口（与登录页共用同一套计数）
    await profileMenuTrigger(page).click()
    await page.getByRole("menuitem", { name: "切换为工作人员" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByLabel("账号").fill(tempUser)

    // 第 1~4 次失败：提示剩余可尝试次数
    for (let i = 0; i < 4; i++) {
      await page.getByLabel("密码").fill("wrong-password")
      await page.getByRole("button", { name: "确认切换" }).click()
      await expect(page.getByRole("dialog").getByRole("alert")).toContainText(`还可尝试 ${4 - i} 次`)
    }

    // 第 5 次失败：触发锁定
    await page.getByLabel("密码").fill("wrong-password")
    await page.getByRole("button", { name: "确认切换" }).click()
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("请 5 分钟后再试")

    // 锁定期内继续尝试仍被拒绝，且未发生角色切换
    await page.getByLabel("密码").fill("wrong-password")
    await page.getByRole("button", { name: "确认切换" }).click()
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("请 5 分钟后再试")
    await page.getByRole("button", { name: "取消" }).click()
    await expect(profileRole(page)).toHaveText("管理员")
  })

  test("锁定按账号隔离，不影响其它账号登录", async ({ page }) => {
    // 上一个用例锁定的是随机账号，admin 仍应能正常登录
    await login(page, "admin", "admin123")
    await expect(page.getByText("寄养中宠物")).toBeVisible()
  })
})
