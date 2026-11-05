// 用户端单端测试 · 我的（个人中心）/ 我的宠物 / 退出登录 → 登录校验
const { test, expect } = require('@playwright/test')

test.describe('个人中心（底部"我的"）', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '我的' }).click()
    await expect(page.getByRole('heading', { name: '个人中心' })).toBeVisible()
  })

  test('统计看板：待入店/寄养中/已完成/累计寄养', async ({ page }) => {
    await expect(page.getByRole('button', { name: '爱宠家长 138****8888 编辑资料' })).toBeVisible()
    for (const stat of ['1 待入店', '1 寄养中', '2 已完成', '3 累计寄养']) {
      await expect(page.getByRole('button', { name: stat })).toBeVisible()
    }
  })

  test('我的宠物入口：宠物档案与免疫状态', async ({ page }) => {
    await page.getByRole('button', { name: '我的宠物' }).click()
    // 宠物列表（豆豆/团子 均已接种，且均有进行中预约 → 预约中）
    await expect(page.getByRole('heading', { name: '我的宠物' })).toBeVisible()
    await expect(page.getByText('共2位毛孩子')).toBeVisible()
    await expect(page.getByRole('heading', { name: '豆豆' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '团子' })).toBeVisible()
    // 疫苗状态为嵌套文本节点，分段断言
    await expect(page.getByText(/狂犬疫苗/)).toBeVisible()
    await expect(page.getByText(/猫三联/)).toBeVisible()
    await expect(page.getByText(/预约中/).first()).toBeVisible()
    await expect(page.getByRole('button', { name: '新增宠物' }).first()).toBeVisible()
  })

  test('退出登录 → 未登录首页 → 登录页表单校验 → 登录成功', async ({ page }) => {
    // 1. 退出登录（确认弹窗）
    await page.getByRole('button', { name: '退出登录' }).first().click()
    await expect(page.getByText('确定退出登录？')).toBeVisible()
    await page.getByRole('button', { name: '退出登录' }).last().click()
    await expect(page.getByText('已退出演示账号，页面内个人数据已清除')).toBeVisible()

    // 2. 未登录首页：宠物位显示"登录后选择宠物"，立即预订禁用
    await expect(page.getByRole('button', { name: /宠物 登录后选择宠物/ })).toBeVisible()
    await expect(page.getByRole('button', { name: '立即预订', exact: true })).toBeDisabled()
    await expect(page.getByText('请先选择或新增宠物')).toBeVisible()

    // 3. 未登录进入个人中心 → 登录页
    await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '我的' }).click()
    await expect(page.getByPlaceholder('请输入手机号')).toBeVisible()
    await expect(page.getByPlaceholder('请输入密码')).toBeVisible()

    // 4. 空表单：登录按钮禁用 + 常驻校验提示
    await expect(page.getByRole('button', { name: '登 录' })).toBeDisabled()
    await expect(page.getByText('请先填写手机号、至少6位密码，并勾选协议。')).toBeVisible()

    // 5. 非法手机号 → 失焦触发字段校验（按钮仍禁用）
    await page.getByPlaceholder('请输入手机号').fill('123')
    await page.getByPlaceholder('请输入密码').fill('123456')
    await page.getByRole('checkbox', { name: '我已阅读并同意' }).check()
    await page.getByPlaceholder('请输入手机号').press('Tab') // 失焦
    await expect(page.getByText('请输入有效的11位手机号')).toBeVisible()
    await expect(page.getByRole('button', { name: '登 录' })).toBeDisabled()

    // 6. 合法手机号 + 密码 + 协议 → 登录成功（落在个人中心，账号更新为演示号）
    await page.getByPlaceholder('请输入手机号').fill('13800138000')
    await expect(page.getByRole('button', { name: '登 录' })).toBeEnabled()
    await page.getByRole('button', { name: '登 录' }).click()
    await expect(page.getByRole('heading', { name: '个人中心' })).toBeVisible()
    await expect(page.getByRole('button', { name: '爱宠家长 138****8000 编辑资料' })).toBeVisible()
    // 返回首页可正常预订
    await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '首页' }).click()
    await expect(page.getByRole('button', { name: '立即预订', exact: true })).toBeEnabled()
  })
})
