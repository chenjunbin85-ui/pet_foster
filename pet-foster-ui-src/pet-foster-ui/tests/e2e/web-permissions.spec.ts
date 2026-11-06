import { test, expect, type Page } from "@playwright/test"
import { login } from "./helpers/auth"

/** PRD 3.2 Web 端八页岗位矩阵：前端可见性 + 后端接口双重验证。 */
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
    await login(page, ACCOUNT.OWNER, PASSWORD)
    await expect(page.locator(".nav-item")).toHaveCount(8)
    await expect(page.locator(".nav-readonly")).toHaveCount(0)
    const keys = await navKeys(page)
    expect(keys).toEqual(["dashboard", "customers", "pets", "orders", "health", "services", "stats", "system"])
  })

  test("前台 FRONT 六页可见且客户可写，经营数据与系统管理不可见", async ({ page }) => {
    await login(page, ACCOUNT.FRONT, PASSWORD)
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

  test("护理员 CARE 客户/订单只读，健康与服务可写", async ({ page }) => {
    await login(page, ACCOUNT.CARE, PASSWORD)
    await expect(page.locator('.nav-item[data-nav="customers"]')).toHaveAttribute("data-capability", "read")
    await expect(page.locator('.nav-item[data-nav="orders"]')).toHaveAttribute("data-capability", "read")
    await expect(page.locator('.nav-item[data-nav="health"]')).toHaveAttribute("data-capability", "write")
    await page.locator('.nav-item[data-nav="customers"]').click()
    await expect(page.getByRole("button", { name: /新增客户/ })).toHaveCount(0)
    await expect(page.locator('button[aria-label^="编辑"]')).toHaveCount(0)
    await expect(page.locator('button[aria-label^="删除"]')).toHaveCount(0)
    await page.locator('.nav-item[data-nav="health"]').click()
    await expect(page.getByRole("button", { name: /新增健康记录/ })).toBeVisible()
  })

  test("兽医 VET 健康可写、服务记录只读", async ({ page }) => {
    await login(page, ACCOUNT.VET, PASSWORD)
    await expect(page.locator('.nav-item[data-nav="health"]')).toHaveAttribute("data-capability", "write")
    await expect(page.locator('.nav-item[data-nav="services"]')).toHaveAttribute("data-capability", "read")
    await page.locator('.nav-item[data-nav="services"]').click()
    await expect(page.locator('button[aria-label="编辑服务记录"]')).toHaveCount(0)
  })

  test("美容师 GROOM 看不到客户与健康，宠物/订单/服务可见", async ({ page }) => {
    await login(page, ACCOUNT.GROOM, PASSWORD)
    const keys = await navKeys(page)
    expect(keys).toEqual(["dashboard", "pets", "orders", "services"])
    await expect(page.locator('.nav-item[data-nav="customers"]')).toHaveCount(0)
    await expect(page.locator('.nav-item[data-nav="health"]')).toHaveCount(0)
  })

  test("外勤 DRIVER 登录端点放行但 Web 端无工位", async ({ page }) => {
    await page.goto("/")
    await page.getByLabel("账号").fill(ACCOUNT.DRIVER)
    await page.getByLabel("密码").fill(PASSWORD)
    await page.getByRole("button", { name: /登\s*录/ }).click()
    await expect(page.getByRole("heading", { name: /没有 Web 工位/ })).toBeVisible()
    await expect(page.locator(".workspace")).toHaveCount(0)
    // 登录端点与小程序员工端共用，token 必须签发，否则小程序外勤也登不上
    const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    expect(token).toBeTruthy()
    // 直接调 Web 业务接口仍被后端挡住
    expect(await apiStatus(page, "/api/customers?page=1&size=1")).toBe(403)
  })

  test("后端墙：只读岗位写接口 403，读接口放行", async ({ page }) => {
    await login(page, ACCOUNT.CARE, PASSWORD)
    expect(await apiStatus(page, "/api/customers?page=1&size=1")).toBe(200)
    expect(await apiStatus(page, "/api/customers", "POST", { name: "越权测试", phone: "13000000000" })).toBe(403)
    expect(await apiStatus(page, "/api/stats/dashboard")).toBe(403)
  })

  test("客户 token 不能借撞号访问 Web 客户接口", async ({ page }) => {
    await page.goto("/")
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
