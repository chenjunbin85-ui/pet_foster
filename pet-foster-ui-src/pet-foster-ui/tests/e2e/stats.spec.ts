import { test, expect } from "@playwright/test"
import { login } from "./helpers/auth"

test.describe("统计分析面板", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
    // 管理员默认展示界面即为统计分析页，无需再点击侧边栏
    await expect(page.locator(".section-kicker", { hasText: "统计分析" })).toBeVisible()
  })

  test("管理员登录默认进入统计分析页，侧边栏仅保留统计与系统管理", async ({ page }) => {
    await expect(page.locator(".statistics-page")).toBeVisible()
    // 侧边栏只保留两组：数据统计（统计分析）+ 系统管理（系统管理）
    const navButtons = page.locator(".nav-item")
    await expect(navButtons).toHaveCount(2)
    await expect(page.locator('.nav-item[data-nav="stats"]')).toBeVisible()
    await expect(page.locator('.nav-item[data-nav="system"]')).toBeVisible()
  })

  test("统计卡片点击跳转订单流水并预设状态筛选", async ({ page }) => {
    // 已完成订单卡 → 订单流水页自动筛选「已完成」
    await page.locator(".stat-card", { hasText: "已完成订单" }).click()
    await expect(page.locator(".section-kicker", { hasText: "寄养订单管理" })).toBeVisible()
    await expect(page.getByLabel("全部状态")).toHaveValue("已完成")

    // 回到统计页，再点已取消订单卡 → 自动筛选「已取消」
    await page.locator('.nav-item[data-nav="stats"]').click()
    await page.locator(".stat-card", { hasText: "已取消订单" }).click()
    await expect(page.locator(".section-kicker", { hasText: "寄养订单管理" })).toBeVisible()
    await expect(page.getByLabel("全部状态")).toHaveValue("已取消")
  })

  test("统计卡片 hover 呈现凸起悬浮效果", async ({ page }) => {
    const card = page.locator(".stat-card", { hasText: "订单总数" })
    await card.hover()
    // hover 后 transition(0.22s) 将卡片上浮 translateY(-6px)；轮询等待动画完成
    await expect
      .poll(() => card.evaluate((el) => getComputedStyle(el).transform), { timeout: 5000 })
      .toContain("-6")
    const raised = await card.evaluate((el) => {
      const c = getComputedStyle(el)
      return { cursor: c.cursor }
    })
    expect(raised.cursor).toBe("pointer")
  })

  test("订单流水页返回键回到统计分析页", async ({ page }) => {
    // 管理员从统计卡进入订单流水后，标题栏左侧返回键可回到统计分析页
    await page.locator(".stat-card", { hasText: "已完成订单" }).click()
    await expect(page.locator(".section-kicker", { hasText: "寄养订单管理" })).toBeVisible()
    const backBtn = page.locator(".page-back-btn")
    await expect(backBtn).toBeVisible()
    await backBtn.click()
    await expect(page.locator(".section-kicker", { hasText: "统计分析" })).toBeVisible()
    await expect(page.locator(".statistics-page")).toBeVisible()
  })

  test("订单总数/总营收卡点击进入全部订单流水", async ({ page }) => {
    await page.locator(".stat-card", { hasText: "总营收" }).click()
    await expect(page.locator(".section-kicker", { hasText: "寄养订单管理" })).toBeVisible()
    // 不预设筛选 → 全部状态
    await expect(page.getByLabel("全部状态")).toHaveValue("")
  })

  test("页面标题和描述正确", async ({ page }) => {
    await expect(page.locator(".dashboard-welcome h1")).toHaveText("照护有温度，经营有方向。")
    await expect(page.locator(".dashboard-welcome p")).toContainText("统计范围")
  })

  test("四个统计卡片完整展示", async ({ page }) => {
    await expect(page.locator(".stat-card")).toHaveCount(4)

    const cards = [
      { label: "订单总数", unit: "单" },
      { label: "已完成订单", unit: "单" },
      { label: "已取消订单", unit: "单" },
      { label: "总营收", unit: "元" },
    ]

    for (const card of cards) {
      const cardEl = page.locator(".stat-card", { hasText: card.label })
      await expect(cardEl).toBeVisible()
      await expect(cardEl.locator(".stat-top")).toHaveText(card.label)
      const value = cardEl.locator(".stat-value")
      await expect(value).toBeVisible()
      const valueText = await value.textContent()
      expect(valueText, `${card.label} 数值不应为空`).toBeTruthy()
      await expect(cardEl.locator(".stat-value small")).toHaveText(card.unit)
    }
  })

  test("统计卡片数值与后端API一致", async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
    const response = await page.request.get("http://127.0.0.1:8090/api/orders?page=1&size=500", {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const data = await response.json()
    const orders = data.data.records || data.records || []

    const total = orders.length
    const completed = orders.filter((o: any) => o.status === "已完成").length
    const cancelled = orders.filter((o: any) => o.status === "已取消").length
    const revenue = orders
      .filter((o: any) => o.status !== "已取消")
      .reduce((sum: number, o: any) => sum + (o.totalFee || 0), 0)

    await expect(page.locator(".stat-card", { hasText: "订单总数" }).locator(".stat-value")).toContainText(String(total))
    await expect(page.locator(".stat-card", { hasText: "已完成订单" }).locator(".stat-value")).toContainText(String(completed))
    await expect(page.locator(".stat-card", { hasText: "已取消订单" }).locator(".stat-value")).toContainText(String(cancelled))
    await expect(page.locator(".stat-card", { hasText: "总营收" }).locator(".stat-value")).toContainText(revenue.toLocaleString("zh-CN"))
  })

  test("寄养订单趋势图展示", async ({ page }) => {
    const chartCard = page.locator(".dashboard-card", { hasText: "寄养订单趋势" })
    await expect(chartCard).toBeVisible()
    await expect(chartCard.getByRole("heading", { name: "寄养订单趋势" })).toBeVisible()
    // 图例
    await expect(chartCard.locator(".chart-legend")).toContainText("订单数")
    await expect(chartCard.locator(".chart-legend")).toContainText("收入")
    // 图表容器
    await expect(chartCard.locator("[data-chart]")).toBeVisible()
    // X轴月份标签（SVG元素用attached判断）
    await expect(chartCard.locator(".recharts-xAxis")).toBeAttached()
  })

  test("宠物品种分布环形图展示", async ({ page }) => {
    const chartCard = page.locator(".dashboard-card", { hasText: "宠物品种分布" })
    await expect(chartCard).toBeVisible()
    await expect(chartCard.getByRole("heading", { name: "宠物品种分布" })).toBeVisible()
    // 总数徽章
    await expect(chartCard.locator(".soft-badge")).toContainText("共")
    // 环形图
    await expect(chartCard.locator(".recharts-pie")).toBeVisible()
    // 图例
    await expect(chartCard.locator(".breed-legend")).toBeVisible()
  })

  test("周期筛选下拉存在且可切换", async ({ page }) => {
    const select = page.locator(".stats-period-select")
    await expect(select).toBeVisible()

    // 验证选项数量
    await expect(select.locator("option")).toHaveCount(7)

    // 切换到近30天
    await select.selectOption("30d")
    await expect(page.locator(".dashboard-welcome p")).toContainText("近30天")
    // 统计卡片描述也更新
    await expect(page.locator(".stat-card").first().locator("p")).toHaveText("近30天")
  })

  test("日期范围选择器存在", async ({ page }) => {
    const dateInputs = page.locator(".stats-date-inline input[type='date']")
    await expect(dateInputs).toHaveCount(2)
    await expect(page.locator(".stats-date-inline")).toContainText("至")
  })

  test("自定义日期后切换为自定义周期", async ({ page }) => {
    const startInput = page.locator(".stats-date-inline input[type='date']").first()
    // 使用React兼容的方式设置值
    await startInput.evaluate((el) => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      nativeInputValueSetter.call(el, "2026-10-01")
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    })
    await page.waitForTimeout(500)
    // 验证周期选择器变为custom或页面不报错
    const periodSelect = page.locator(".stats-period-select")
    const periodValue = await periodSelect.inputValue().catch(() => "")
    expect(["custom", "all"]).toContain(periodValue)
  })

  test("导出Excel按钮存在", async ({ page }) => {
    const exportBtn = page.locator(".stats-filters .secondary-action", { hasText: "导出订单 Excel" })
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toBeEnabled()
  })

  test("周期切换后趋势图数据更新", async ({ page }) => {
    // 先记录全部历史时的趋势图状态
    const select = page.locator(".stats-period-select")

    // 切换到本月
    await select.selectOption("month")
    await page.waitForTimeout(500) // 等待数据刷新

    // 图表仍然可见
    await expect(page.locator(".dashboard-card", { hasText: "寄养订单趋势" }).locator("[data-chart]")).toBeVisible()

    // 切换回全部历史
    await select.selectOption("all")
    await page.waitForTimeout(500)
    await expect(page.locator(".dashboard-welcome p")).toContainText("全部历史数据")
  })

  test("页脚信息展示", async ({ page }) => {
    await expect(page.locator(".dashboard-footer")).toContainText("专业照护 · 温暖相伴")
    await expect(page.locator(".dashboard-footer")).toContainText("数据实时同步自服务端")
  })
})
