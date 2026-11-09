/**
 * 毛球旅馆小程序 · 全量界面截图脚本（可复用）
 *
 * 前置条件：
 *   1. 微信开发者工具已通过 cli auto 开启自动化端口（默认 9420）
 *      D:\微信web开发者工具\cli.bat auto --project <项目路径> --auto-port 9420 --trust-project
 *   2. 后端服务运行在 127.0.0.1:8090
 *   3. playwright-tests 目录已 npm install miniprogram-automator
 *
 * 用法：
 *   node shoot_miniprogram.js            # 截全部页面
 *   node shoot_miniprogram.js customer   # 只截客户端
 *   node shoot_miniprogram.js staff      # 只截员工端
 *
 * 输出：docs/对比截图/小程序/*.png（390x844 模拟器视口，2x 清晰度）
 */
const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')
const http = require('http')

// ============ 配置区 ============
const WS_ENDPOINT = 'ws://127.0.0.1:9420'
const BACKEND = { host: '127.0.0.1', port: 8090 }
const OUT_DIR = 'C:/Users/chen/Desktop/毕业设计/pet-foster/docs/对比截图/小程序'

// 测试账号（来自 schema.sql，密码统一 123456）
const CUSTOMER = { phone: '13800138001', password: '123456' }

// 客户端页面：[路由, 输出文件名, 渲染等待ms]
const CUSTOMER_PAGES = [
  ['/pages/login/login',         '01_登录页',     5000],
  ['/pages/register/register',   '02_注册页',     4000],
  ['/pages/index/index',         '03_首页',       4000],
  ['/pages/checkout/checkout',   '04_确认订单',   4000],
  ['/pages/pay/pay',             '05_支付页',     4000],
  ['/pages/payResult/payResult', '06_支付结果',   4000],
  ['/pages/orders/orders',       '07_历史订单',   4000],
  ['/pages/orderDetail/orderDetail', '08_订单详情', 4000],
  ['/pages/pets/pets',           '09_我的宠物',   4000],
  ['/pages/petEdit/petEdit',     '10_编辑宠物',   4000],
  ['/pages/mine/mine',           '11_个人中心',   4000],
]

// 员工端按岗位分组：每个岗位用对应账号登录后截自己的页面
// [账号, 页面清单([路由, 文件名, 等待ms])]
const STAFF_GROUPS = [
  { username: '13800138011', label: '护理员小陈', pages: [
    ['/pages/staff/today/today', '20_员工_今日工作台', 4000],
    ['/pages/staff/queue/queue', '21_员工_在住订单', 4000],
    ['/pages/staff/home/home',   '22_员工_系统首页', 4000],
    ['/pages/staff/mine/mine',   '23_员工_岗位权限', 4000],
    ['/pages/staff/c1/c1',       '24_护理_工作台待办', 4000],
    ['/pages/staff/c2/c2',       '25_护理_巡视打卡', 4000],
    ['/pages/staff/c3/c3',       '26_护理_日常护理记录', 4000],
    ['/pages/staff/c4/c4',       '27_护理_异常上报', 4000],
    ['/pages/staff/c5/c5',       '28_护理_交接签字', 4000],
    ['/pages/staff/c6/c6',       '29_护理_遛宠核销', 4000],
  ]},
  { username: '13800138013', label: '兽医小李', pages: [
    ['/pages/staff/v1/v1', '30_兽医_在岗确认', 4000],
    ['/pages/staff/v2/v2', '31_兽医_健康评估', 4000],
    ['/pages/staff/v3/v3', '32_兽医_异常复核', 4000],
    ['/pages/staff/v4/v4', '33_兽医_送医授权', 4000],
    ['/pages/staff/v5/v5', '34_兽医_离店评估', 4000],
  ]},
  { username: '13800138014', label: '美容师小王', pages: [
    ['/pages/staff/g1/g1', '35_洗护_任务工作台', 4000],
    ['/pages/staff/g2/g2', '36_洗护_作业记录', 4000],
    ['/pages/staff/g3/g3', '37_洗护_服务核销', 4000],
  ]},
  { username: '13800138015', label: '司机小赵', pages: [
    ['/pages/staff/d1/d1', '38_司机_接送工作台', 4000],
    ['/pages/staff/d2/d2', '39_司机_交接拍照', 4000],
    ['/pages/staff/d3/d3', '40_司机_服务核销', 4000],
  ]},
]

// ============ 工具函数 ============
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function apiPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    if (token) headers['Authorization'] = 'Bearer ' + token
    const req = http.request({ ...BACKEND, path, method: 'POST', headers }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('error', reject); req.write(data); req.end()
  })
}
function apiGet(path, token) {
  return new Promise((resolve, reject) => {
    const headers = {}
    if (token) headers['Authorization'] = 'Bearer ' + token
    const req = http.request({ ...BACKEND, path, method: 'GET', headers }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('error', reject); req.end()
  })
}

let mini

async function shot(route, name, waitMs) {
  process.stdout.write(`  -> ${name} ... `)
  try { await mini.reLaunch(route) } catch (e) {}
  await sleep(waitMs)
  try {
    await mini.screenshot({ path: path.join(OUT_DIR, `${name}.png`) })
    console.log(`✓ ${(fs.statSync(path.join(OUT_DIR, `${name}.png`)).size / 1024).toFixed(0)}KB`)
  } catch (e) {
    console.log(`✗ ${e.message}`)
  }
}

async function staffLogin(username) {
  const res = await apiPost('/api/auth/login', { username, password: '123456' })
  if (res.code !== 200) { console.log(`  登录失败 ${username}:`, res.message); return }
  await mini.evaluate(({ t, info }) => {
    const app = getApp()
    app.clearSession()
    app.setStaffSession(t, info)
  }, { t: res.data.token, info: res.data.userInfo }).catch(() => {})
  await sleep(2000)
}

// ============ 主流程 ============
;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const mode = process.argv[2] || 'all'

  console.log('连接微信开发者工具自动化端口...')
  mini = await automator.connect({ wsEndpoint: WS_ENDPOINT })
  await sleep(3000)
  console.log('已连接\n')

  if (mode === 'all' || mode === 'customer') {
    console.log('=== 客户端页面 ===')
    await mini.evaluate(() => { getApp().clearSession(); getApp().clearStaffSession() }).catch(() => {})
    await sleep(1000)
    await shot(...CUSTOMER_PAGES[0])
    await shot(...CUSTOMER_PAGES[1])

    console.log('  登录客户账号...')
    const cust = await apiPost('/api/mp/auth/login', CUSTOMER)
    if (cust.code === 200) {
      await mini.evaluate(({ t, c }) => { getApp().setSession(t, c) }, { t: cust.data.token, c: cust.data.customer }).catch(() => {})
      await sleep(1500)
    }

    let orderId = ''
    try {
      const orders = await apiGet('/api/mp/orders', cust.data.token)
      if (orders.data && orders.data.length > 0) orderId = orders.data[0].id
    } catch (e) {}

    for (let i = 2; i < CUSTOMER_PAGES.length; i++) {
      let [route, name, wait] = CUSTOMER_PAGES[i]
      if (route.includes('orderDetail') && orderId) route = `${route}?id=${orderId}`
      await shot(route, name, wait)
    }
    console.log('')
  }

  if (mode === 'all' || mode === 'staff') {
    console.log('=== 员工端页面（按岗位登录）===')
    for (const group of STAFF_GROUPS) {
      console.log(`  -- ${group.label} (${group.username}) --`)
      await staffLogin(group.username)
      for (const [route, name, wait] of group.pages) {
        await shot(route, name, wait)
      }
    }
    console.log('')
  }

  await mini.disconnect()
  console.log(`完成！截图保存在: ${OUT_DIR}`)
})().catch(e => { console.error('FATAL:', e.message); process.exit(1) })
