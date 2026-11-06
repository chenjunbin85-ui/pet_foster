// PRD 联调 · 按天计费 / 增值服务入账 / 定金 / 防超订（真实后端 8090 + MySQL 落库断言）
const { test, expect } = require('@playwright/test')
const { query } = require('./db')

const PHONE = '13800138001'
const PASSWORD = '123456'

async function login(request) {
  const res = await request.post('/api/mp/auth/login', { data: { phone: PHONE, password: PASSWORD } })
  expect(res.ok()).toBeTruthy()
  const body = await res.json()
  expect(body.code).toBe(200)
  return body.data.token
}

// 清理：订单 + 房间占用 + 账单明细
async function cleanupOrder(orderId) {
  await query('DELETE FROM foster_bill_item WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_room_booking WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_order WHERE order_id = ?', [orderId])
}

test.describe('PRD · 增值服务入账与定金（U19）', () => {
  test('舒适间4天 + 遛宠20/日 + 洗护30：房费320、增值110、应收430、定金96、落3条明细', async ({ request }) => {
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
        endDate: '2026-11-23', // 含离店日 = 4 个照护日
        priceId: comfort.id,
        serviceCodes: ['WALK', 'BATH'],
        remark: 'PRD联调-增值服务',
      },
    })
    const body = await res.json()
    expect(body.code).toBe(200)
    const order = body.data
    try {
      expect(order.stayDays).toBe(4)
      expect(Number(order.totalFee)).toBe(430) // 房费320 + 增值110
      expect(Number(order.extraFee)).toBe(110) // 遛宠80 + 洗护30
      expect(Number(order.depositFee)).toBe(96) // round(320*0.3,2)

      // 账单明细落库：房费 + 2 条增值
      const items = await query(
        "SELECT item_code, item_type, unit_price, quantity, amount, status FROM foster_bill_item WHERE order_id = ? ORDER BY item_code",
        [order.id]
      )
      const byCode = Object.fromEntries(items.map((i) => [i.item_code, i]))
      expect(byCode.ROOM).toBeTruthy()
      expect(Number(byCode.ROOM.amount)).toBe(320)
      expect(byCode.SERVICE_WALK).toBeTruthy()
      expect(Number(byCode.SERVICE_WALK.unit_price)).toBe(20)
      expect(Number(byCode.SERVICE_WALK.quantity)).toBe(4) // day × charge_days
      expect(Number(byCode.SERVICE_WALK.amount)).toBe(80)
      expect(byCode.SERVICE_BATH).toBeTruthy()
      expect(Number(byCode.SERVICE_BATH.quantity)).toBe(1) // once × 1
      expect(Number(byCode.SERVICE_BATH.amount)).toBe(30)

      // 房间已占用
      const booking = await query('SELECT room_id, status, occupy_start, occupy_end FROM foster_room_booking WHERE order_id = ?', [order.id])
      expect(booking).toHaveLength(1)
      expect(booking[0].status).toBe('占用')
      const occ = new Date(booking[0].occupy_start)
      const occStr = `${occ.getFullYear()}-${String(occ.getMonth() + 1).padStart(2, '0')}-${String(occ.getDate()).padStart(2, '0')}`
      expect(occStr).toBe('2026-11-20')

      // 取消 → 占用释放、明细转已退款
      const cancel = await (await request.post(`/api/mp/orders/${order.id}/cancel`, { headers: auth })).json()
      expect(cancel.code).toBe(200)
      const bk = await query('SELECT status FROM foster_room_booking WHERE order_id = ?', [order.id])
      expect(bk[0].status).toBe('释放')
      const refunded = await query("SELECT COUNT(*) AS c FROM foster_bill_item WHERE order_id = ? AND status='已退款'", [order.id])
      expect(Number(refunded[0].c)).toBe(3)
    } finally {
      await cleanupOrder(order.id)
    }
  })

  test('增值服务价目接口返回 4 个启用项', async ({ request }) => {
    const token = await login(request)
    const res = await (await request.get('/api/mp/services/options', { headers: { Authorization: `Bearer ${token}` } })).json()
    expect(res.code).toBe(200)
    const codes = res.data.map((s) => s.serviceCode).sort()
    expect(codes).toEqual(['BATH', 'MEDICATION', 'PICKUP', 'WALK'])
  })
})

test.describe('PRD · 防超订（U2）', () => {
  test('舒适间仅 3 间：连下 3 单后第 4 单被拒且不生成订单', async ({ request }) => {
    const token = await login(request)
    const auth = { Authorization: `Bearer ${token}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: auth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: auth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const comfort = prices.find((p) => p.levelName === '舒适间')

    // 舒适间犬舍仅 2 间（B-01/B-02；B-03 为猫舍，犬不可用 → U15 猫犬分区）
    const bookedIds = []
    for (let i = 0; i < 2; i++) {
      const r = await request.post('/api/mp/orders', {
        headers: auth,
        data: { petId: puding.id, startDate: '2026-12-01', endDate: '2026-12-03', priceId: comfort.id, remark: `PRD联调-超订${i}` },
      })
      const b = await r.json()
      expect(b.code).toBe(200)
      bookedIds.push(b.data.id)
    }

    try {
      // 第 3 单：犬舍已满（猫舍对犬不可用）
      const overflow = await request.post('/api/mp/orders', {
        headers: auth,
        data: { petId: puding.id, startDate: '2026-12-01', endDate: '2026-12-03', priceId: comfort.id, remark: 'PRD联调-超订溢出' },
      })
      const ob = await overflow.json()
      expect(ob.code).toBe(500)
      expect(ob.message).toContain('无可用房')
      // 未生成订单
      const rows = await query("SELECT COUNT(*) AS c FROM foster_order WHERE remark='PRD联调-超订溢出' AND deleted=0")
      expect(Number(rows[0].c)).toBe(0)
    } finally {
      for (const id of bookedIds) await cleanupOrder(id)
    }
  })
})
