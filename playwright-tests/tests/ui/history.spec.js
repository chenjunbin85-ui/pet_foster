// 用户端单端测试 · 历史订单（筛选/搜索/订单卡/继续支付）
const { test, expect } = require('@playwright/test')

test.describe('历史订单', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '历史订单' }).click()
    await expect(page.getByRole('searchbox', { name: '搜索宠物昵称或订单号' })).toBeVisible()
  })

  test('订单列表渲染：状态/房型/金额/支付倒计时', async ({ page }) => {
    await expect(page.getByText('共 4 笔演示订单')).toBeVisible()
    // 待入店未支付单：FO20261110001 · 豆豆 · 舒适间 · ¥240.00 · 倒计时
    await expect(page.getByText('FO20261110001').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /豆豆 舒适间 2026-11-10 → 2026-11-13共3晚 ¥240.00/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '去支付' })).toBeVisible()
    await expect(page.getByRole('button', { name: '取消预约' })).toBeVisible()
    await expect(page.getByText(/剩余 \d+:\d+/)).toBeVisible()
    // 寄养中单
    await expect(page.getByText('FO20261025002').first()).toBeVisible()
    await expect(page.getByText('团子').first()).toBeVisible()
  })

  test('状态筛选：切换筛选后订单列表随之变化', async ({ page }) => {
    const filter = page.getByRole('navigation', { name: '预约状态筛选' })
    for (const status of ['全部', '待入店', '寄养中', '已完成', '已取消']) {
      await expect(filter.getByRole('button', { name: status, exact: true })).toBeVisible()
    }
    // 切到"已完成"：待入店单消失，已完成单保留
    await filter.getByRole('button', { name: '已完成', exact: true }).click()
    await expect(page.getByRole('button', { name: /豆豆 舒适间 2026-11-10 → 2026-11-13共3晚/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /豆豆 标准间 2026-09-18 → 2026-09-20共2晚/ })).toBeVisible()
  })

  test('关键词搜索过滤订单', async ({ page }) => {
    const search = page.getByRole('searchbox', { name: '搜索宠物昵称或订单号' })
    await search.fill('豆豆')
    await expect(page.getByText('FO20261110001').first()).toBeVisible()
    await expect(page.getByText('FO20261025002').first()).toHaveCount(0) // 团子单被过滤

    await search.fill('不存在的宠物xyz')
    await expect(page.getByText('FO20261110001').first()).toHaveCount(0)
  })

  test('待支付订单可继续支付（进入演示支付页）', async ({ page }) => {
    await page.getByRole('button', { name: '去支付' }).click()
    await expect(page.getByText('订单金额')).toBeVisible()
    await expect(page.getByText('演示环境：本次支付为模拟支付，不会产生真实扣款。')).toBeVisible()
  })
})
