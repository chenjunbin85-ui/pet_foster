import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

test.describe("页面加载与数据展示", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "admin", "admin123")
  })

  test("仪表盘统计卡片加载", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "寄养中宠物" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "待入店订单" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "本月订单" })).toBeVisible()
    await expect(page.getByRole("heading", { name: "本月寄养金额" })).toBeVisible()
  })

  test("首页标题区排版与其它页面保持一致", async ({ page }) => {
    /* 要求：首页「门店工作台 / 用心照护，从今天开始。/ 每一份托付…」这一块的
       「区域边距、字体大小、排版」必须与其它页面的 .dashboard-welcome 完全一致
       （参考页：客户档案「每一份信任，都用心记录。」）。
       踩坑：曾经为了「矮屏不超屏」，在 @media (max-height:680px) 里把首页 h1 压到 19px、
       p 压到 11px —— 首页标题于是比全站所有页面都小一号，肉眼一眼能看出不一致。
       现改为「只压缩外边距与其它模块，绝不改标题字号」。
       本用例在若干视口高度下逐一比对首页与客户页的计算样式。 */
    const readHeader = (page: import("@playwright/test").Page) =>
      page.locator(".dashboard-welcome").evaluate((el) => {
        const pick = (sel: string) => {
          const n = el.querySelector(sel) as HTMLElement | null
          if (!n) return null
          const c = getComputedStyle(n)
          return { fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, ls: c.letterSpacing, mt: c.marginTop, mb: c.marginBottom }
        }
        return { kicker: pick(".section-kicker"), h1: pick("h1"), p: pick("p") }
      })

    for (const height of [900, 800, 720, 680, 650, 600]) {
      await page.setViewportSize({ width: 1440, height })
      // 清掉上一轮的登录态，并把页面拉到登录页，保证 login() 一定能看到账号/密码输入框
      await page.goto("/")
      await page.evaluate(() => localStorage.clear())
      await page.goto("/login")
      await login(page, "admin", "admin123")
      await expect(page.locator(".dashboard-welcome")).toBeVisible()
      const home = await readHeader(page)

      await navigateTo(page, "客户信息管理")
      await expect(page.locator(".dashboard-welcome")).toBeVisible()
      const other = await readHeader(page)

      expect(home.h1, `1440×${height} 首页 h1 字号与其它页面不一致`).toEqual(other.h1)
      expect(home.p, `1440×${height} 首页副标题字号与其它页面不一致`).toEqual(other.p)
      expect(home.kicker, `1440×${height} 首页 kicker 与其它页面不一致`).toEqual(other.kicker)
    }
  })

  test("仪表盘天气面板显示真实天气且无占位符", async ({ page }) => {
    // 断网兜底：外部天气/定位接口在 CI 里可能不可达，此时应显示「天气获取失败」，
    // 而不是退回旧的「天气暂未获取 / —」占位符。
    await expect(page.locator(".weather-status")).toBeVisible()
    // 等加载态结束（成功或失败都算结束）
    await expect(page.locator(".weather-status")).not.toHaveClass(/is-loading/, { timeout: 30000 })

    const status = page.locator(".weather-status")
    const cls = (await status.getAttribute("class")) ?? ""

    if (cls.includes("is-error")) {
      await expect(status).toHaveText(/天气获取失败/)
    } else {
      // 成功：必须有天气现象 + 温度数字（°），不允许出现 "—"
      await expect(status.locator(".weather-temperature")).toHaveText(/^-?\d+°$/)
      await expect(status.locator(".weather-text")).not.toBeEmpty()
      await expect(status).not.toContainText("—")
    }
    // 旧占位符在任何情况下都不应出现
    await expect(page.locator("body")).not.toContainText("天气暂未获取")
  })

  test("客户管理页加载真实数据", async ({ page }) => {
    await navigateTo(page, "客户信息管理")
    await expect(page.locator(".section-kicker")).toHaveText("客户档案")
    const rows = page.locator("table tbody tr:not(.empty-row)")
    await expect(rows.first()).toBeVisible()
  })

  test("宠物档案页加载真实数据", async ({ page }) => {
    await navigateTo(page, "宠物档案管理")
    await expect(page.locator(".section-kicker")).toHaveText("宠物档案管理")
    const rows = page.locator("table tbody tr:not(.empty-row)")
    await expect(rows.first()).toBeVisible()
  })

  test("寄养订单页加载真实数据", async ({ page }) => {
    await navigateTo(page, "寄养订单管理")
    await expect(page.locator(".section-kicker")).toHaveText("寄养订单管理")
    const rowCount = await page.locator(".customer-table tbody tr").count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test("健康档案页加载真实数据", async ({ page }) => {
    await navigateTo(page, "健康档案管理")
    await expect(page.locator(".section-kicker")).toHaveText("健康档案管理")
    const rowCount = await page.locator(".customer-table tbody tr").count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test("寄养服务记录页加载", async ({ page }) => {
    await navigateTo(page, "寄养服务记录")
    await expect(page.locator(".section-kicker")).toHaveText("寄养服务记录")
  })

  test("统计分析页图表加载", async ({ page }) => {
    await navigateTo(page, "统计分析")
    await expect(page.getByText("寄养订单趋势")).toBeVisible()
    await expect(page.getByText("宠物品种分布")).toBeVisible()
  })

  test("品种分布环形图完整不裁切且居中自适应", async ({ page }) => {
    await navigateTo(page, "统计分析")
    const wrap = page.locator(".donut-wrap")
    await expect(wrap.locator(".donut-center")).toContainText("在档宠物")

    // 画布必须是正方形。曾出现 svg 被撑成 140×200，
    // 而圆环半径按短边算 → 左右被裁成直线边，看着像个缺口的 C。
    const square = wrap.locator("[data-chart]")
    const box = (await square.boundingBox())!
    expect(Math.abs(box.width - box.height), "环形画布不是正方形").toBeLessThanOrEqual(1)
    // 内部响应式：画布应吃掉卡片剩余空间，明显大于设计稿原始的 140px
    expect(box.width, "环形画布没有随卡片放大").toBeGreaterThan(180)

    // 画布在环形图区里垂直居中（上下留白相等），避免空白全堆在图下方
    const geo = await wrap.evaluate((el) => {
      const s = el.querySelector("[data-chart]")!.getBoundingClientRect()
      const r = el.getBoundingClientRect()
      return { above: s.top - r.top, below: r.bottom - s.bottom }
    })
    expect(Math.abs(geo.above - geo.below), "环形图未垂直居中").toBeLessThanOrEqual(2)

    // 扇区是 recharts 挂载动画里渲染出来的：先等它们真正出现，
    // 否则会在动画首帧读到 0 个 path.recharts-sector 而误判为异常。
    await expect(square.locator("path.recharts-sector").first()).toBeVisible()

    const clipped = await square.locator("svg").evaluate((svg) => {
      const [, , w, h] = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number)
      const sectors = [...svg.querySelectorAll("path.recharts-sector")]
      if (sectors.length === 0) return "no-sector"
      const outside = sectors.filter((el) => {
        const b = (el as SVGGraphicsElement).getBBox()
        return b.x < -0.5 || b.y < -0.5 || b.x + b.width > w + 0.5 || b.y + b.height > h + 0.5
      })
      return outside.length ? `clipped:${outside.length}` : false
    })
    expect(clipped, "圆环被画布裁切").toBe(false)
  })

  test("快捷入口插图保持原始宽高比不变形", async ({ page }) => {
    // 曾照抄设计稿的 width:100% + height:clamp(56px,6vw,100px) 双定尺寸，
    // 1440 视口下容器被压成 93×86（≈1.08:1），而原图是 440×258（≈1.70:1）→ 纵向拉伸变形。
    await expect(page.locator(".quick-illustration").first()).toBeVisible()
    // 等待所有插图加载完成（naturalWidth > 0），避免竞态
    await page.waitForFunction(() => {
      const imgs = document.querySelectorAll(".quick-illustration")
      return imgs.length === 6 && Array.from(imgs).every((img) => (img as HTMLImageElement).naturalWidth > 0)
    }, null, { timeout: 15000 })
    const rows = await page.locator(".quick-illustration").evaluateAll((els) =>
      els.map((el) => {
        const img = el as HTMLImageElement
        const r = img.getBoundingClientRect()
        return { w: r.width, h: r.height, nw: img.naturalWidth, nh: img.naturalHeight }
      }),
    )
    expect(rows.length, "快捷入口插图数量不对").toBe(6)
    for (const r of rows) {
      expect(r.nw, "插图未加载").toBeGreaterThan(0)
      const render = r.w / r.h
      const natural = r.nw / r.nh
      expect(
        Math.abs(render - natural),
        `插图被拉伸：渲染比 ${render.toFixed(3)} vs 原始比 ${natural.toFixed(3)}`,
      ).toBeLessThanOrEqual(0.02)
    }
  })

  test("环形图 tooltip 浮现在所悬浮的扇区旁，而不是从图表左上角滑入", async ({ page }) => {
    /* recharts 的 tooltip 定位很特殊：wrapper 的 style.top / style.left 恒为 0px，
       真实位置只写在 transform: translate(x, y) 上，并默认挂一条 `transition: transform 400ms`
       （见 recharts/component/TooltipBoundingBox.js 的 resolveTransitionProperty）。
       于是：首次 hover 时 tooltip 从 translate(0,0)（= 图表左上角）斜着「飞」到扇区上；
       换扇区时又横穿图表滑过去 —— 用户看到的就是「统一从左上角同一处浮现」。
       修法：给 <ChartTooltip> 传 isAnimationActive={false}（并在 index.css 里再兜一层
       transition:none!important，因为 recharts 是写在内联 style 上）。
       本用例锁住「切换扇区时 tooltip 不产生中间过渡位置」这个不变量。 */
    await navigateTo(page, "统计分析")
    const wrap = page.locator(".donut-wrap")
    await expect(wrap.locator("path.recharts-sector").first()).toBeVisible()

    const centers = await wrap.locator("path.recharts-sector").evaluateAll((els) =>
      els.map((el) => {
        const r = (el as SVGPathElement).getBoundingClientRect()
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 }
      }),
    )
    expect(centers.length, "环形图扇区数量不对").toBeGreaterThan(1)

    // 用 rAF 逐帧采样 tooltip 的实际矩形，统计它出现过几种位置
    const watch = async (cx: number, cy: number) => {
      await page.evaluate(() => ((window as any).__tipPositions = []))
      await page.mouse.move(cx, cy)
      await page.waitForTimeout(500)
      return page.evaluate(() =>
        Array.from(
          new Set(((window as any).__tipPositions as string[]).filter(Boolean)),
        ),
      )
    }
    await page.evaluate(() => {
      const tick = () => {
        const t = document.querySelector(".donut-wrap .recharts-tooltip-wrapper") as HTMLElement | null
        if (t && getComputedStyle(t).visibility !== "hidden") {
          const r = t.getBoundingClientRect()
          ;((window as any).__tipPositions ||= []).push(`${Math.round(r.x)},${Math.round(r.y)}`)
        }
        ;(window as any).__raf = requestAnimationFrame(tick)
      }
      tick()
    })

    // 先把鼠标移开，保证下面测的是「首次出现」
    await page.mouse.move(10, 10)
    await page.waitForTimeout(300)

    const first = await watch(centers[1].cx, centers[1].cy)
    const second = await watch(centers[0].cx, centers[0].cy)
    await page.evaluate(() => cancelAnimationFrame((window as any).__raf))

    // transition 被关掉后，每一帧都应停在同一个坐标 → 去重后只剩 1 个位置
    expect(first.length, `首次出现时 tooltip 在滑动（出现 ${first.length} 个位置）`).toBeLessThanOrEqual(1)
    expect(second.length, `换扇区时 tooltip 横穿图表（出现 ${second.length} 个位置）`).toBeLessThanOrEqual(1)

    // 兜底断言：内联的 transform 过渡确实已被压掉
    const transition = await wrap
      .locator(".recharts-tooltip-wrapper")
      .evaluate((el) => getComputedStyle(el).transition)
    expect(transition, "tooltip 仍带位移动画").toBe("none")
  })

  test("今日待办/在店宠物插图不出现蒙版硬边", async ({ page }) => {
    /* 踩坑：卡片右侧插图曾出现一条竖直硬边（用户反馈「白蒙版边界露出来了」）。
       排查方式：用探针脚本逐层开关 ::before / ::after / overflow / img 的 transform，
       发现只有「去掉 img 的 transform」能让硬边消失，蒙版与 overflow 都无关。
       真凶是 <img> 上的 `transform: scale(1.2) translateY(-5%)`：
       这两张 PNG 有 ~59.5% 全透明区域，且透明像素的 RGB 并非 0（实测四角 (1,1,1,0)），
       施加 transform 会把 <img> 提升为独立合成层，缩放重采样后在 banner 矩形上
       压出一层极淡的彩色薄膜 —— 那就是肉眼看到的「边界」。
       现改用「布局尺寸 + object-fit: contain」实现放大观感，不产生合成层。
       这里锁住根因：插图元素不得再有 transform。
       （注：曾尝试用「沿中线扫一行像素、比较相邻亮度跳变」来断言，
         实测该指标被文字笔画主导、且硬边过于轻微，无法区分修复前后，故弃用。） */
    await expect(page.locator(".home-care-stack .care-card").first()).toBeVisible()

    const transforms = await page.locator(".home-care-stack .care-banner img").evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).transform),
    )
    expect(transforms.length, "没找到首页插图").toBeGreaterThan(0)
    for (const t of transforms) {
      expect(t, "插图又被加了 transform（会提升为合成层并压出可见薄膜）").toBe("none")
    }
  })

  test("系统管理页用户列表加载", async ({ page }) => {
    await navigateTo(page, "系统管理")
    await expect(page.locator(".section-kicker")).toHaveText("系统管理")
    const rowCount = await page.locator(".customer-table tbody tr").count()
    expect(rowCount).toBeGreaterThan(0)
  })
})

/**
 * 「一屏装下」回归：首页与统计分析页在宽屏（≥1001px）各高度档下，
 * .dashboard-body 不允许出现纵向溢出（scrollHeight > clientHeight）。
 *
 * 背景：统计页原本没有任何高度约束，1440×720 溢出 131px、1440×650 溢出 201px，
 * 底部图例被截断；首页 1440×650 溢出 18px、页脚被切掉。
 * 现两页都由 .{home,stats}-dashboard-body 撑成 flex 列，图表/卡片吃剩余高度。
 */
const NO_SCROLL_HEIGHTS = [1080, 900, 800, 720, 680, 650, 600]

test.describe("宽屏不超屏（响应式高度）", () => {
  for (const height of NO_SCROLL_HEIGHTS) {
    test(`首页在 1440×${height} 不出现纵向溢出`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height })
      await login(page, "admin", "admin123")
      await expect(page.locator(".home-work-grid")).toBeVisible()
      await page.waitForTimeout(600)
      const overflow = await page.evaluate(() => {
        const body = document.querySelector(".dashboard-body") as HTMLElement
        return body.scrollHeight - body.clientHeight
      })
      expect(overflow, `首页超出屏幕 ${overflow}px`).toBeLessThanOrEqual(1)
    })

    test(`统计分析页在 1440×${height} 不出现纵向溢出`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height })
      await login(page, "admin", "admin123")
      await navigateTo(page, "统计分析")
      await expect(page.locator(".statistics-page")).toBeVisible()
      await page.waitForTimeout(900)
      const overflow = await page.evaluate(() => {
        const body = document.querySelector(".dashboard-body") as HTMLElement
        return body.scrollHeight - body.clientHeight
      })
      expect(overflow, `统计分析页超出屏幕 ${overflow}px`).toBeLessThanOrEqual(1)

      // 图表必须真的渲染出来，而不是被压成 0 高度（"隐藏式"规避溢出的假通过）
      const chart = await page.locator(".donut-wrap > [data-chart]").boundingBox()
      expect(chart, "环形画布不存在").not.toBeNull()
      expect(chart!.width, "环形画布被压得过小").toBeGreaterThanOrEqual(200)
      expect(Math.abs(chart!.width - chart!.height), "环形画布不是正方形").toBeLessThanOrEqual(1)

      // 图例也要完整可见，不能被裁
      const legend = await page.locator(".breed-legend").boundingBox()
      const bodyBox = await page.locator(".dashboard-body").boundingBox()
      expect(legend!.y + legend!.height).toBeLessThanOrEqual(bodyBox!.y + bodyBox!.height + 1)
    })
  }
})
