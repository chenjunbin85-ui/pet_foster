import { test, expect, type Page } from "@playwright/test"
import { login, logout, profileMenuTrigger, profileRole } from "./helpers/auth"

// 回归测试：侧边栏底部「更多操作」曾因 DropdownMenuLabel 缺少 Group 上下文导致整页白屏；
// 现切换角色必须先在浮窗内通过目标账号的密码校验。

const dialogAlert = (page: Page) => page.getByRole("dialog").getByRole("alert")

async function openProfileMenu(page: Page) {
  await profileMenuTrigger(page).click()
}

/** 走完整的「密码校验 → 切换」流程 */
async function switchRole(page: Page, roleLabel: string, username: string, password: string) {
  await openProfileMenu(page)
  await page.getByRole("menuitem", { name: `切换为${roleLabel}` }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.getByLabel("账号").fill(username)
  await page.getByLabel("密码").fill(password)
  await page.getByRole("button", { name: "确认切换" }).click()
}

test.describe("布局与角色菜单", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
  })

  test("底部更多操作菜单可展开且不白屏", async ({ page }) => {
    await openProfileMenu(page)
    await expect(page.getByRole("menuitem", { name: "切换为工作人员" })).toBeVisible()
    await expect(page.getByText(/当前角色：管理员/)).toBeVisible()
    // 页面主体仍在正常渲染，未跳转到空白页
    await expect(page.locator(".dashboard-welcome h1")).toBeVisible()
  })

  test("更多操作触发器不再出现 button 嵌套 button", async ({ page }) => {
    expect(await page.locator(".profile button button").count()).toBe(0)
  })

  // 回归测试：菜单曾锚定触发按钮（28px），右边界越过侧边栏伸进内容区 171px。
  // 现锚定 .profile 卡片 + align="end"，右边界必须与卡片（=侧边栏内容右边界）齐平。
  test("角色菜单右边界与侧边栏内容右边界齐平", async ({ page }) => {
    await openProfileMenu(page)
    const menu = page.locator('[data-slot="dropdown-menu-content"]')
    await expect(menu).toBeVisible()
    const { menuRight, profileRight, menuLeft, profileLeft } = await page.evaluate(() => {
      const menuEl = document.querySelector('[data-slot="dropdown-menu-content"]')!
      const profileEl = document.querySelector(".profile")!
      const m = menuEl.getBoundingClientRect()
      const p = profileEl.getBoundingClientRect()
      return { menuRight: m.right, profileRight: p.right, menuLeft: m.left, profileLeft: p.left }
    })
    // 右边界对齐（浮点计算允许 1px 误差）
    expect(Math.abs(menuRight - profileRight)).toBeLessThanOrEqual(1)
    // 左边界也不得越出卡片左侧（菜单与卡片同宽）
    expect(menuLeft).toBeGreaterThanOrEqual(profileLeft - 1)
    await page.keyboard.press("Escape")
  })

  test("当前角色的菜单项置灰不可点", async ({ page }) => {
    await openProfileMenu(page)
    const current = page.getByRole("menuitem", { name: /切换为管理员/ })
    const isDisabled = await current.evaluate(
      (el) => el.getAttribute("aria-disabled") === "true" || el.hasAttribute("data-disabled")
    )
    expect(isDisabled).toBe(true)
  })

  // 回归测试：只有「当前角色」该置灰，其它角色项必须保持正常前景色。
  // 踩坑：全局规则 `[data-slot="dropdown-menu-item"] > span:last-child`（本意是给右侧
  // 「当前 / ⌘K」这类标注刷淡）误伤了非当前项 —— 非当前项只有一个 <span>（标题），
  // 它同时也是 :last-child，于是标题被当成标注一起刷淡，出现「其他账号也是灰的」。
  // 又因为刷淡的是内层 span，父项上那条 `!important` 的 color 也救不回来。
  // 现改为只认 .current-role-tag / shortcut slot 两个真正的标注节点。
  test("非当前角色的菜单项不被置灰", async ({ page }) => {
    await openProfileMenu(page)
    const colors = await page.locator(".sidebar-menu").evaluate((menu) => {
      const items = Array.from(
        menu.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]')
      )
      // 取标签 <span>（有的话）的颜色：标题就包在 span 里，硬边 bug 正是出在这一层
      const colorOf = (el: HTMLElement) => {
        const label = el.querySelector("span")
        return getComputedStyle(label ?? el).color
      }
      const current = items.find((el) => el.classList.contains("role-item-disabled"))
      const logout = items.find((el) => (el.textContent ?? "").includes("退出登录"))
      return {
        current: current ? colorOf(current) : null,
        selectable: items.filter((el) => !el.classList.contains("role-item-disabled")).map(colorOf),
        normal: logout ? colorOf(logout) : null,
      }
    })

    expect(colors.current, "没找到被置灰的当前角色项").not.toBeNull()
    expect(colors.normal, "没找到退出登录项做基准色").not.toBeNull()
    // 当前角色项必须确实比普通项浅
    expect(colors.current, "当前角色项没有置灰").not.toBe(colors.normal)
    // 其余可选角色项必须与普通项同色（= 正常前景色）
    expect(colors.selectable.length).toBeGreaterThan(0)
    for (const c of colors.selectable) {
      expect(c, "非当前角色项被误置灰了").toBe(colors.normal)
    }
  })

  test("切换角色会弹出密码校验浮窗并预填目标账号", async ({ page }) => {
    await openProfileMenu(page)
    await page.getByRole("menuitem", { name: "切换为工作人员" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("dialog")).toContainText("切换到工作人员")
    await expect(page.getByLabel("账号")).toHaveValue("staff01")
    await expect(page.getByLabel("密码")).toHaveValue("")
  })

  test("密码错误时提示错误且不切换账号", async ({ page }) => {
    const tokenBefore = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    await switchRole(page, "工作人员", "staff01", "wrong-password")
    await expect(dialogAlert(page)).toContainText("密码错误")
    // 浮窗保持打开，账号与 token 均未变化
    await expect(page.getByRole("dialog")).toBeVisible()
    expect(await page.evaluate(() => localStorage.getItem("pet_foster_token"))).toBe(tokenBefore)
    await page.getByRole("button", { name: "取消" }).click()
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(profileRole(page)).toHaveText("管理员")
  })

  test("密码正确后切换为工作人员并换发 token、收起系统管理", async ({ page }) => {
    const tokenBefore = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    await switchRole(page, "工作人员", "staff01", "staff123")
    await expect(page.getByRole("dialog")).toBeHidden()
    await expect(profileRole(page)).toHaveText("工作人员")
    // 换发新 token，前端角色与后端接口权限保持一致
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("pet_foster_token")))
      .not.toBe(tokenBefore)
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
  })

  test("侧边栏折叠后角色菜单仍可用", async ({ page }) => {
    await page.locator(".sidebar-logo-toggle").click()
    await page.waitForTimeout(600)
    await expect(page.locator(".sidebar")).toHaveClass(/is-collapsed/)
    await openProfileMenu(page)
    await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menuitem", { name: "退出登录" })).toBeHidden()
  })

  test("退出登录需二次确认", async ({ page }) => {
    await logout(page)
  })
})

test.describe("角色切换权限校验", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "staff01", "staff123")
  })

  test("工作人员账号不能切换为管理员", async ({ page }) => {
    await switchRole(page, "管理员", "staff01", "staff123")
    await expect(dialogAlert(page)).toContainText("无法切换为")
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "取消" }).click()
    await expect(profileRole(page)).toHaveText("工作人员")
  })
})
