// 用户端单端测试 · 首页（设计稿 React 原型，纯前端 mock；默认已登录，宠物为豆豆/团子）
const { test, expect } = require('@playwright/test')

test.describe('首页 · 立即预订', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '立即预订' })).toBeVisible()
  })

  test('门店信息完整展示（营业状态/到店时段/计费说明）', async ({ page }) => {
    await expect(page.getByText('营业中 09:00–21:00')).toBeVisible()
    // 入住/离店建议时段（"10:00 建议"同一元素内）
    await expect(page.getByText(/10:00\s*建议/)).toBeVisible()
    await expect(page.getByText(/18:00\s*建议/)).toBeVisible()
    // 计费口径说明（原型展示版；真实口径见联调测试与 PRD）
    await expect(page.getByText('跨天按晚计费，同日按1天；到店时间为建议时段。')).toBeVisible()
  })

  test('宠物选择：默认豆豆，可切换至团子', async ({ page }) => {
    await expect(page.getByRole('button', { name: /宠物 豆豆（柯基）/ })).toBeVisible()
    await page.getByRole('button', { name: /宠物 豆豆（柯基）/ }).click()
    // 选择弹窗列出全部宠物（均已免疫）
    await expect(page.getByRole('dialog', { name: '选择入住宠物' })).toBeVisible()
    await expect(page.getByRole('button', { name: /豆豆 柯基 · 公 · 3岁 · 12kg 已免疫/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /团子 布偶猫 · 母 · 2岁 · 4kg 已免疫/ })).toBeVisible()
    // 点击宠物即选中并关闭弹窗（无"完成选择"步骤）
    await page.getByRole('button', { name: /团子 布偶猫/ }).click()
    await expect(page.getByRole('button', { name: /宠物 团子（布偶猫）/ })).toBeVisible()
  })

  test('房型选择与预估金额联动', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '热门房型' })).toBeVisible()
    const rooms = page.getByRole('group', { name: '选择房型' })
    await expect(rooms.getByRole('button', { name: /标准间/ })).toBeVisible()
    await expect(rooms.getByRole('button', { name: /舒适间/ })).toBeVisible()
    await expect(rooms.getByRole('button', { name: /豪华间/ })).toBeVisible()

    // 默认舒适间（80/晚 × 3晚 = 240）
    await expect(rooms.getByRole('button', { name: /舒适间/ })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('预估金额 · 3晚')).toBeVisible()
    await expect(page.locator('.action-summary strong')).toHaveText('¥240.00')

    // 切到标准间（60 × 3 = 180）
    await rooms.getByRole('button', { name: /标准间/ }).click()
    await expect(page.locator('.action-summary strong')).toHaveText('¥180.00')
  })

  test('底部 Tab 导航：首页/历史订单/我的', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: '底部主导航' })
    await expect(nav.getByRole('button', { name: '首页' })).toBeVisible()
    await expect(nav.getByRole('button', { name: '历史订单' })).toBeVisible()
    await expect(nav.getByRole('button', { name: '我的' })).toBeVisible()

    await nav.getByRole('button', { name: '历史订单' }).click()
    await expect(page.getByRole('searchbox', { name: '搜索宠物昵称或订单号' })).toBeVisible()

    await nav.getByRole('button', { name: '我的' }).click()
    await expect(page.getByRole('heading', { name: '个人中心' })).toBeVisible()
  })
})
