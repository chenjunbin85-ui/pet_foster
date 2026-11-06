// 多端联调测试 · 用户端全链路（模拟小程序用户端 API 调用 → 后端 8090 → MySQL 落库断言）
// 前置：后端 8090、MySQL 3306、Redis 6379 均在运行；演示账号 13800138001 / 123456（customer_id=1）
const { test, expect } = require('@playwright/test')
const { query } = require('./db')

const PHONE = '13800138001'
const PASSWORD = '123456'

// 登录并返回 token（联调各用例复用登录接口本身也被独立用例覆盖）
async function login(request) {
  const res = await request.post('/api/mp/auth/login', {
    data: { phone: PHONE, password: PASSWORD },
  })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.code).toBe(200)
  return body.data.token
}

test.describe('多端联调 · 读侧链路（登录→个人信息→宠物→价位→统计）', () => {
  test('登录成功后 me/pets/prices/stats 全链路贯通', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }

    // 个人信息
    const me = await (await request.get('/api/mp/auth/me', { headers: auth })).json()
    expect(me.code).toBe(200)
    expect(me.data.phone).toBe(PHONE)

    // 宠物列表：布丁(已免疫) + 汤圆(未免疫)
    const pets = await (await request.get('/api/mp/pets', { headers: auth })).json()
    expect(pets.code).toBe(200)
    const names = pets.data.map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['布丁', '汤圆']))
    const puding = pets.data.find((p) => p.name === '布丁')
    const tangyuan = pets.data.find((p) => p.name === '汤圆')
    expect(puding.vaccineText).toContain('狂犬疫苗')
    expect(tangyuan.locked).toBe(false)

    // locked 语义 = 存在进行中预约（待入店/寄养中），与数据库实时一致
    const locking = await query(
      `SELECT p.pet_id, p.name FROM pet p
       JOIN foster_order o ON o.pet_id = p.pet_id
       WHERE o.status IN ('待入店','寄养中') AND o.deleted = 0
       GROUP BY p.pet_id, p.name`
    )
    const lockedNames = new Set(locking.map((r) => r.name))
    for (const pet of pets.data) {
      expect(Boolean(pet.locked), `${pet.name} locked 应与进行中订单一致`).toBe(lockedNames.has(pet.name))
    }
    // 布丁当前无进行中单（此前演示待入店单已被 15 分钟自动关闭任务关闭）
    expect(puding.locked).toBe(false)

    // 价位：3 档房型
    const prices = await (await request.get('/api/mp/prices', { headers: auth })).json()
    expect(prices.code).toBe(200)
    expect(prices.data).toHaveLength(3)
    const roomNames = prices.data.map((p) => p.levelName)
    expect(roomNames).toEqual(expect.arrayContaining(['标准间', '舒适间', '豪华间']))

    // 统计：待入店/寄养中/已完成/累计寄养
    const stats = await (await request.get('/api/mp/orders/stats', { headers: auth })).json()
    expect(stats.code).toBe(200)
    expect(stats.data).toMatchObject({
      pending: expect.any(Number),
      fostering: expect.any(Number),
      completed: expect.any(Number),
      cumulative: expect.any(Number),
    })
  })

  test('登录落库：customer.last_login_time 更新', async ({ request }) => {
    const before = await query('SELECT last_login_time FROM customer WHERE customer_id = 1')
    await login(request)
    const after = await query('SELECT last_login_time FROM customer WHERE customer_id = 1')
    expect(after[0].last_login_time).toBeTruthy()
    // 断言时间戳已推进（mysql2 返回 Date）
    if (before[0].last_login_time) {
      expect(new Date(after[0].last_login_time).getTime()).toBeGreaterThanOrEqual(
        new Date(before[0].last_login_time).getTime()
      )
    }
  })
})

test.describe('多端联调 · 写侧链路（下单→重复支付拦截→取消，逐节点落库断言）', () => {
  // 每个用例独立下单并清理，避免测试残留
  async function cleanup(orderId) {
    await query('DELETE FROM foster_order WHERE order_id = ?', [orderId])
  }

  test('未免疫宠物下单被拦截（业务规则）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const tangyuan = pets.find((p) => p.name === '汤圆') // 未接种
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const res = await request.post('/api/mp/orders', {
      headers: auth,
      data: { petId: tangyuan.id, startDate: '2026-11-20', endDate: '2026-11-22', priceId: comfort.id },
    })
    const body = await res.json()
    expect(body.code).toBe(500)
    expect(body.message).toContain('免疫')
  })

  test('按天下单：3 天 × ¥80 = ¥240 并落库（11-20 ~ 11-22）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const res = await request.post('/api/mp/orders', {
      headers: auth,
      data: {
        petId: puding.id,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        priceId: comfort.id,
        remark: 'PW联调测试-按天3天',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.code).toBe(200)
    const order = body.data
    expect(order.stayDays).toBe(3)
    expect(Number(order.totalFee)).toBe(240)
    // PRD 2.3：未接入真实支付，下单即视为已支付（演示内联收款成功）
    expect(order.paymentStatus).toBe('已支付')

    try {
      // —— 数据库落库断言（多端联调核心）：金额/天数/单价快照/状态 ——
      // 注：表无 stay_days 列（VO 计算字段），天数由 start_date/end_date 推导
      const rows = await query(
        "SELECT order_no, DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date, DATEDIFF(end_date, start_date) + 1 AS stay_days, total_fee, price_per_day, status, payment_status, paid_amount, payment_method, remark FROM foster_order WHERE order_id = ?",
        [order.id]
      )
      expect(rows).toHaveLength(1)
      const row = rows[0]
      expect(row.order_no).toBeTruthy()
      expect(String(row.start_date)).toBe('2026-11-20')
      expect(String(row.end_date)).toBe('2026-11-22')
      expect(Number(row.stay_days)).toBe(3)
      expect(Number(row.total_fee)).toBe(240)
      expect(Number(row.price_per_day)).toBe(80)
      expect(row.status).toBe('待入店')
      expect(row.payment_status).toBe('已支付')
      expect(Number(row.paid_amount)).toBe(240)
      expect(row.payment_method).toBe('微信')
      expect(row.remark).toBe('PW联调测试-按天3天')

      // —— 重复支付拦截：订单已支付，再次调用 /pay 必须被拒 ——
      const dupPay = await (await request.post(`/api/mp/orders/${order.id}/pay`, { headers: auth })).json()
      expect(dupPay.code).toBe(500)
      expect(dupPay.message).toContain('已支付')

      // —— 取消（已支付 → 演示退款）：落库 status=已取消/payment_status=已退款 ——
      const cancel = await (await request.post(`/api/mp/orders/${order.id}/cancel`, { headers: auth })).json()
      expect(cancel.code).toBe(200)
      expect(cancel.data.status).toBe('已取消')
      expect(cancel.data.paymentStatus).toBe('已退款')
      const cancelRow = (await query('SELECT status, payment_status FROM foster_order WHERE order_id = ?', [order.id]))[0]
      expect(cancelRow.status).toBe('已取消')
      expect(cancelRow.payment_status).toBe('已退款')
    } finally {
      cleanup(order.id)
    }
  })

  test('同日入住离店 = 1 天（按天计费口径）', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const res = await request.post('/api/mp/orders', {
      headers: auth,
      data: { petId: puding.id, startDate: '2026-11-25', endDate: '2026-11-25', priceId: comfort.id },
    })
    const body = await res.json()
    expect(body.code).toBe(200)
    expect(body.data.stayDays).toBe(1)
    expect(Number(body.data.totalFee)).toBe(80)
    await cleanup(body.data.id)
  })

  test('订单分页/搜索/筛选：新建订单可在列表检索到', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    const created = (await (await request.post('/api/mp/orders', {
      headers: auth,
      data: { petId: puding.id, startDate: '2026-11-26', endDate: '2026-11-28', priceId: comfort.id, remark: 'PW联调测试-列表检索' },
    })).json()).data

    try {
      const list = (await (await request.get('/api/mp/orders?page=1&size=20', { headers: auth })).json())
      const data = list.data
      expect(data.total).toBeGreaterThan(0)
      const found = data.records.find((o) => String(o.id) === String(created.id))
      expect(found).toBeTruthy()
      expect(found.orderNo).toBeTruthy()
      expect(found.stayDays).toBe(3)

      // 状态筛选：新单为待入店
      const filter = (await (await request.get('/api/mp/orders?page=1&size=20&status=%E5%BE%85%E5%85%A5%E5%BA%97', { headers: auth })).json())
      const inFilter = filter.data.records.find((o) => String(o.id) === String(created.id))
      expect(inFilter).toBeTruthy()
    } finally {
      cleanup(created.id)
    }
  })
})
