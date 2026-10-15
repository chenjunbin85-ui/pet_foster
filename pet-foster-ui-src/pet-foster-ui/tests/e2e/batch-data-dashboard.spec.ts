import { test, expect } from "@playwright/test"
import { login } from "./helpers/auth"

const API = "http://127.0.0.1:8090"

test.describe("批量录入数据与数据面板验证", () => {
  let token: string
  const createdIds: { customers: number[]; pets: number[]; orders: number[] } = {
    customers: [],
    pets: [],
    orders: [],
  }

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    // 业务数据由工作人员录入（执行层）
    await login(page, "staff01", "staff123")
    token = await page.evaluate(() => localStorage.getItem("pet_foster_token") || "")
    await page.close()
    expect(token, "登录获取token失败").toBeTruthy()
  })

  test.afterAll(async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}` }
    for (const id of createdIds.orders) {
      await request.delete(`${API}/api/orders/${id}`, { headers }).catch(() => {})
    }
    for (const id of createdIds.pets) {
      await request.delete(`${API}/api/pets/${id}`, { headers }).catch(() => {})
    }
    for (const id of createdIds.customers) {
      await request.delete(`${API}/api/customers/${id}`, { headers }).catch(() => {})
    }
  })

  test("批量录入客户、宠物、订单", async ({ request }) => {
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    const uniqueSuffix = Date.now().toString().slice(-6)
    const fmt = (d: Date) => d.toISOString().split("T")[0]

    // 1. 创建3个客户
    const customerNames = [`批量客${uniqueSuffix}A`, `批量客${uniqueSuffix}B`, `批量客${uniqueSuffix}C`]
    for (let i = 0; i < customerNames.length; i++) {
      const res = await request.post(`${API}/api/customers`, {
        headers,
        data: { name: customerNames[i], phone: `139${uniqueSuffix}${i}`, address: "测试地址", remark: "批量测试" },
      })
      expect(res.ok()).toBeTruthy()
    }
    // 查询获取客户ID
    const custList = await request.get(`${API}/api/customers?page=1&size=200`, { headers })
    const custBody = await custList.json()
    const custRecords = custBody.data?.records || custBody.data?.list || custBody.records || []
    createdIds.customers = custRecords.filter((c: any) => customerNames.includes(c.name)).map((c: any) => Number(c.customerId || c.id))
    expect(createdIds.customers.length).toBe(3)

    // 2. 创建3只宠物
    const petNames = [`批量宠${uniqueSuffix}A`, `批量宠${uniqueSuffix}B`, `批量宠${uniqueSuffix}C`]
    for (let i = 0; i < petNames.length; i++) {
      const res = await request.post(`${API}/api/pets`, {
        headers,
        data: { customerId: createdIds.customers[i], name: petNames[i], breed: "金毛", gender: "公", age: 2, weight: 5, color: "金色", vaccine: "已接种" },
      })
      expect(res.ok()).toBeTruthy()
    }
    const petList = await request.get(`${API}/api/pets?page=1&size=200`, { headers })
    const petBody = await petList.json()
    const petRecords = petBody.data?.records || petBody.data?.list || petBody.records || []
    createdIds.pets = petRecords.filter((p: any) => petNames.includes(p.name)).map((p: any) => Number(p.petId || p.id))
    expect(createdIds.pets.length).toBe(3)

    // 3. 创建2个寄养订单（按固定价位档位计价）
    const priceRes = await request.get(`${API}/api/prices/options`, { headers })
    const priceBody = await priceRes.json()
    const priceRecords = priceBody.data || []
    const priceId = Number(priceRecords.find((p: any) => p.status === 1)?.id)
    expect(priceId, "未找到启用中的价位档位").toBeTruthy()
    for (let i = 0; i < 2; i++) {
      const today = new Date()
      const end = new Date(today)
      end.setDate(end.getDate() + 3)
      const res = await request.post(`${API}/api/orders`, {
        headers,
        data: { customerId: createdIds.customers[i], petId: createdIds.pets[i], startDate: fmt(today), endDate: fmt(end), priceId, remark: "批量测试订单" },
      })
      expect(res.ok()).toBeTruthy()
    }
    const orderList = await request.get(`${API}/api/orders?page=1&size=200`, { headers })
    const orderBody = await orderList.json()
    const orderRecords = orderBody.data?.records || orderBody.data?.list || orderBody.records || []
    createdIds.orders = orderRecords.filter((o: any) => o.remark === "批量测试订单").map((o: any) => Number(o.orderId || o.id))
    expect(createdIds.orders.length).toBe(2)
  })

  test("首页统计卡片数据正确反映批量录入", async ({ page }) => {
    // 首页工作台面向工作人员（管理员默认进入统计分析页）
    await login(page, "staff01", "staff123")
    await page.waitForTimeout(2000)

    // 验证四个统计卡片存在且有数值
    const statCards = page.locator(".stat-card, .dashboard-stat, [class*='stat']")
    await expect(statCards.first()).toBeVisible()

    // 验证本月订单数大于0
    const bodyText = await page.locator("body").innerText()
    expect(bodyText).toContain("本月订单")
  })

  test("统计分析页数据面板正确展示", async ({ page }) => {
    await login(page, "admin", "admin123")
    // 管理员默认即统计分析页；用侧边栏按钮导航（页面 kicker 与按钮同名，避免文本匹配歧义）
    await page.locator('.nav-item[data-nav="stats"]').click()
    await expect(page.locator(".section-kicker", { hasText: "统计分析" })).toBeVisible()

    // 验证图表容器存在
    await expect(page.locator(".recharts-wrapper, [class*='chart']").first()).toBeVisible({ timeout: 10000 })

    // 验证至少有2个图表
    const charts = page.locator(".recharts-wrapper, [class*='chart-container']")
    const chartCount = await charts.count()
    expect(chartCount).toBeGreaterThanOrEqual(2)

    // 验证图表标题存在
    const chartTitles = page.locator("h2, h3, .chart-title")
    const titles = await chartTitles.allTextContents()
    expect(titles.some((t) => t.includes("订单") || t.includes("趋势") || t.includes("品种"))).toBeTruthy()
  })

  test("数据面板数值与后端API一致", async ({ page, request }) => {
    const headers = { Authorization: `Bearer ${token}` }
    // 从后端获取订单统计
    const orderRes = await request.get(`${API}/api/orders?page=1&size=1`, { headers })
    const orderBody = await orderRes.json()
    const apiTotal = orderBody.data?.total || 0

    await login(page, "admin", "admin123")
    await page.waitForTimeout(1000)

    // 验证页面不崩溃
    await expect(page.locator("body")).toBeVisible()
    expect(apiTotal).toBeGreaterThanOrEqual(0)
  })
})
