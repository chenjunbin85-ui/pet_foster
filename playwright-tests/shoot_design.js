// 对比基准：截设计稿原型各页（390x844）
const { chromium } = require('@playwright/test')
const fs = require('fs')

const DIR = 'C:/Users/chen/Desktop/毕业设计/pet-foster/docs/对比截图/设计稿'
fs.mkdirSync(DIR, { recursive: true })

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  const shot = async (name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false }) }

  await page.goto('http://127.0.0.1:8443/')
  await page.waitForSelector('text=立即预订', { timeout: 20000 })
  await shot('01_首页')

  // 宠物弹窗
  await page.getByRole('button', { name: /宠物 豆豆（柯基）/ }).click()
  await shot('02_宠物选择弹窗')
  await page.keyboard.press('Escape')

  // 确认订单
  await page.getByRole('button', { name: '立即预订', exact: true }).click()
  await shot('03_确认订单')

  // 支付页
  await page.getByRole('checkbox', { name: '已阅读并同意' }).check()
  await page.getByRole('button', { name: '提交订单' }).click()
  await shot('04_支付页')

  // 历史订单
  await page.goto('http://127.0.0.1:8443/')
  await page.waitForSelector('text=立即预订')
  await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '历史订单' }).click()
  await shot('05_历史订单')

  // 个人中心
  await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '我的' }).click()
  await shot('06_个人中心')

  // 我的宠物
  await page.getByRole('button', { name: '我的宠物' }).click()
  await shot('07_我的宠物')

  // 登录页
  await page.goto('http://127.0.0.1:8443/')
  await page.waitForSelector('text=立即预订')
  await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '我的' }).click()
  await page.getByRole('button', { name: '退出登录' }).first().click()
  await page.getByRole('button', { name: '退出登录' }).last().click()
  await page.getByRole('navigation', { name: '底部主导航' }).getByRole('button', { name: '我的' }).click()
  await shot('08_登录页')

  await browser.close()
  console.log('shots done')
})()
