// 用户端单端测试 · 下单全流程（首页 → 确认订单 → 支付 → 支付结果）
const { test, expect } = require('@playwright/test')

test.describe('下单全流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: '立即预订' })).toBeVisible()
  })

  test('完整走通：立即预订 → 确认订单 → 支付页（演示文案）→ 支付结果', async ({ page }) => {
    // 1. 首页（默认豆豆 + 舒适间）→ 立即预订
    await page.getByRole('button', { name: '立即预订', exact: true }).click()

    // 2. 确认订单页：订单摘要
    await expect(page.getByRole('heading', { name: '确认订单' })).toBeVisible()
    await expect(page.getByText('入住宠物')).toBeVisible()
    await expect(page.getByText('豆豆（柯基）')).toBeVisible()
    await expect(page.getByText('寄养房型')).toBeVisible()
    await expect(page.getByText('舒适间').first()).toBeVisible()
    await expect(page.getByText('寄养 3晚')).toBeVisible()

    // 3. 未勾选协议时提交按钮禁用，勾选后可用
    const submit = page.getByRole('button', { name: '提交订单' })
    await expect(submit).toBeDisabled()
    await page.getByRole('checkbox', { name: '已阅读并同意' }).check()
    await expect(submit).toBeEnabled()
    await submit.click()

    // 4. 支付页：演示环境文案 + 微信支付
    await expect(page.getByText('订单金额')).toBeVisible()
    await expect(page.getByText('微信支付', { exact: true })).toBeVisible()
    await expect(page.getByText('演示环境：本次支付为模拟支付，不会产生真实扣款。')).toBeVisible()
    await expect(page.getByText(/请在 \d+:\d+ 内完成支付/)).toBeVisible() // 支付倒计时

    // 5. 确认支付 → 支付结果页（演示提示）
    await page.getByRole('button', { name: '确认支付' }).click()
    await expect(page.getByText(/本次为演示环境模拟支付/)).toBeVisible()
    await expect(page.getByText(/正式支付须接入服务端及微信支付能力后另行启用/)).toBeVisible()
  })

  test('支付页金额展示与订单号一致', async ({ page }) => {
    await page.getByRole('button', { name: '立即预订', exact: true }).click()
    await page.getByRole('checkbox', { name: '已阅读并同意' }).check()
    await page.getByRole('button', { name: '提交订单' }).click()

    await expect(page.getByText('订单金额')).toBeVisible()
    // 舒适间 80 × 3晚 = 240
    await expect(page.locator('.payment-amount h2')).toHaveText('¥240.00')
  })
})
