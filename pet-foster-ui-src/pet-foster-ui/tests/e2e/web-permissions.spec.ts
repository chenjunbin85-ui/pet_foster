import { test, expect, type Page } from "@playwright/test"

/** PRD 3.2 Web 端岗位矩阵：仅 OWNER / FRONT 有工位，其余岗位只在小程序端作业。 */
const ACCOUNT = {
  OWNER: "13800138000",
  FRONT: "13800138012",
  CARE: "13800138011",
  VET: "13800138013",
  GROOM: "13800138014",
  DRIVER: "13800138015",
} as const
const PASSWORD = "123456"
// Vite dev server 没有 /api 代理，前端 SDK 走绝对地址；用例里直连接口也必须用同一基址
const API = "http://127.0.0.1:8090"

/**
 * Vite dev server 首个页面要现场编译模块，等 "load" 偶发超过 30s / ERR_ABORTED。
 * 与 helpers/auth.ts 的 relogin() 一致：domcontentloaded + 失败重试一次。
 * 只在本 spec 内自包含处理，不改公共 helper 以免影响其余 120 条用例。
 */
async function openLogin(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" }).catch(async () => {
    await page.goto("/", { waitUntil: "domcontentloaded" })
  })
}

/** 有 Web 工位的岗位：登录并等待工作区（等价于 helpers/auth.ts 的 login）。 */
async function loginWithWorkbench(page: Page, account: string) {
  await openLogin(page)
  await page.getByLabel("账号").fill(account)
  await page.getByLabel("密码").fill(PASSWORD)
  await page.getByRole("button", { name: /登\s*录/ }).click()
  await page.waitForFunction(() => localStorage.getItem("pet_foster_token") !== null, null, { timeout: 30000 })
  await expect(page.locator(".dashboard-welcome")).toBeVisible()
}

async function navKeys(page: Page) {
  return page.locator(".nav-item").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-nav"))
  )
}

async function apiStatus(
  page: Page,
  url: string,
  method = "GET",
  body?: unknown,
  customToken?: string
) {
  return page.evaluate(
    async ({ url, method, body, customToken, base }) => {
      const token = customToken || localStorage.getItem("pet_foster_token") || ""
      const res = await fetch(`${base}${url}`, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return res.status
    },
    { url, method, body, customToken, base: API }
  )
}

test.describe("Web 端岗位级权限（PRD 3.2）", () => {
  test("管理员 OWNER 八页全写，无只读标记", async ({ page }) => {
    await loginWithWorkbench(page, ACCOUNT.OWNER)
    await expect(page.locator(".nav-item")).toHaveCount(8)
    await expect(page.locator(".nav-readonly")).toHaveCount(0)
    const keys = await navKeys(page)
    expect(keys).toEqual(["dashboard", "customers", "pets", "orders", "health", "services", "stats", "system"])
  })

  test("前台 FRONT 六页可见且客户可写，经营数据与系统管理不可见", async ({ page }) => {
    await loginWithWorkbench(page, ACCOUNT.FRONT)
    const keys = await navKeys(page)
    expect(keys).toEqual(["dashboard", "customers", "pets", "orders", "health", "services"])
    await expect(page.locator('.nav-item[data-nav="stats"]')).toHaveCount(0)
    await expect(page.locator('.nav-item[data-nav="system"]')).toHaveCount(0)
    await page.locator('.nav-item[data-nav="customers"]').click()
    await expect(page.getByRole("button", { name: /新增客户/ })).toBeVisible()
    // 健康档案与服务记录对前台只读
    await expect(page.locator('.nav-item[data-nav="health"]')).toHaveAttribute("data-capability", "read")
    await expect(page.locator('.nav-item[data-nav="services"]')).toHaveAttribute("data-capability", "read")
  })

  /**
   * 无 Web 工位岗位：/api/auth/login 与小程序员工端共用，必须照常签发 token，
   * 否则小程序也登不上；Web 侧只在这里拦进入，业务接口由后端 @PreAuthorize 拦。
   */
  async function loginNoWorkbench(page: Page, account: string) {
    await openLogin(page)
    await page.getByLabel("账号").fill(account)
    await page.getByLabel("密码").fill(PASSWORD)
    await page.getByRole("button", { name: /登\s*录/ }).click()
    await expect(page.getByRole("heading", { name: /没有 Web 工位/ })).toBeVisible()
    await expect(page.locator(".workspace")).toHaveCount(0)
    const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    expect(token).toBeTruthy()
  }

  // 护理员 / 兽医 / 美容师 / 外勤接送：一律只在小程序端作业，Web 后台不开放任何页面
  for (const [label, account] of [
    ["护理员 CARE", ACCOUNT.CARE],
    ["兽医 VET", ACCOUNT.VET],
    ["美容师 GROOM", ACCOUNT.GROOM],
    ["外勤 DRIVER", ACCOUNT.DRIVER],
  ] as const) {
    test(`${label} 只在小程序端作业：Web 无工位但登录端点放行`, async ({ page }) => {
      await loginNoWorkbench(page, account)
      // 直接调 Web 业务接口仍被后端挡住
      expect(await apiStatus(page, "/api/customers?page=1&size=1")).toBe(403)
    })
  }

  test("后端墙：无 Web 工位岗位读/写/统计接口一律 403", async ({ page }) => {
    await loginNoWorkbench(page, ACCOUNT.CARE)
    expect(await apiStatus(page, "/api/customers?page=1&size=1")).toBe(403)
    expect(await apiStatus(page, "/api/customers", "POST", { name: "越权测试", phone: "13000000000" })).toBe(403)
    expect(await apiStatus(page, "/api/stats/dashboard")).toBe(403)
  })

  test("客户 token 不能借撞号访问 Web 客户接口", async ({ page }) => {
    await openLogin(page)
    const status = await page.evaluate(async (base) => {
      const loginRes = await fetch(`${base}/api/mp/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "13800138001", password: "123456" }),
      })
      const json = await loginRes.json()
      const res = await fetch(`${base}/api/customers?page=1&size=1`, {
        headers: { Authorization: `Bearer ${json.data.token}` },
      })
      return res.status
    }, API)
    expect(status).toBe(403)
  })
})
