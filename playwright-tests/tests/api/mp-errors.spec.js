// 多端联调测试 · 错误路径与安全边界（认证/幂等/锁定提示）
const { test, expect } = require('@playwright/test')
const { query } = require('./db')

const PHONE = '13800138001'
const PASSWORD = '123456'

test.describe('多端联调 · 认证与安全', () => {
  test('未登录访问用户端接口返回 401（JWT 拦截）', async ({ request }) => {
    for (const path of ['/api/mp/pets', '/api/mp/orders', '/api/mp/orders/stats', '/api/mp/auth/me']) {
      const res = await request.get(path)
      expect(res.status(), path).toBe(401)
    }
  })

  test('错误密码：提示剩余可尝试次数（Redis 登录锁定链路）', async ({ request }) => {
    const res = await request.post('/api/mp/auth/login', {
      data: { phone: PHONE, password: 'wrong6' },
    })
    const body = await res.json()
    expect(body.code).toBe(500)
    // 首次失败提示「密码错误」，累积到阈值后提示「还可尝试 N 次」；两者均为正确拒绝
    expect(body.message).toMatch(/密码错误|还可尝试/)
  })

  test('手机号不存在：明确报错', async ({ request }) => {
    const res = await request.post('/api/mp/auth/login', {
      data: { phone: '13900000000', password: '123456' },
    })
    const body = await res.json()
    expect(body.code).toBe(500)
    expect(body.message).toBeTruthy()
  })

  test('缺少手机号/密码：参数校验报错', async ({ request }) => {
    const res = await request.post('/api/mp/auth/login', { data: { phone: '' } })
    const body = await res.json()
    expect(body.code).not.toBe(200)
  })
})

test.describe('多端联调 · 幂等与状态机', () => {
  async function login(request) {
    const res = await request.post('/api/mp/auth/login', {
      data: { phone: PHONE, password: PASSWORD },
    })
    return (await res.json()).data.token
  }
  async function cleanup(orderId) {
    await query('DELETE FROM foster_order WHERE order_id = ?', [orderId])
  }

  test('重复支付被拦截：下单即已支付，再次 /pay 被拒（已支付不可二次支付）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const created = (await (await request.post('/api/mp/orders', {
      headers: auth,
      data: { petId: puding.id, startDate: '2026-11-21', endDate: '2026-11-21', priceId: comfort.id, remark: 'PW联调测试-幂等' },
    })).json()).data

    try {
      // PRD 2.3：下单即视为已支付；直接再次 /pay 应命中「订单已支付」拦截
      const second = await (await request.post(`/api/mp/orders/${created.id}/pay`, { headers: auth })).json()
      expect(second.code).toBe(500)
      expect(second.message).toContain('已支付')
    } finally {
      cleanup(created.id)
    }
  })

  test('已支付订单取消走演示退款（状态机：待入店→已取消/已退款）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const created = (await (await request.post('/api/mp/orders', {
      headers: auth,
      data: { petId: puding.id, startDate: '2026-11-22', endDate: '2026-11-22', priceId: comfort.id, remark: 'PW联调测试-取消' },
    })).json()).data

    try {
      const cancel = await (await request.post(`/api/mp/orders/${created.id}/cancel`, { headers: auth })).json()
      expect(cancel.code).toBe(200)
      expect(cancel.data.status).toBe('已取消')
      expect(cancel.data.paymentStatus).toBe('已退款')

      const row = (await query('SELECT status, payment_status FROM foster_order WHERE order_id = ?', [created.id]))[0]
      expect(row.status).toBe('已取消')
      expect(row.payment_status).toBe('已退款')
    } finally {
      cleanup(created.id)
    }
  })

  test('跨账号不可见：他人订单返回无权操作，不存在订单返回不存在（数据隔离）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    // 订单 id=2/3 归属其他客户（customer_id != 1），C 端不可见
    const other = await (await request.get('/api/mp/orders/2', { headers: auth })).json()
    expect(other.code).toBe(500)
    expect(other.message).toContain('无权操作')

    const missing = await (await request.get('/api/mp/orders/99999', { headers: auth })).json()
    expect(missing.code).toBe(500)
    expect(missing.message).toContain('不存在')
  })
})
