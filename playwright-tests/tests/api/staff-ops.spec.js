// PRD 联调 · 门店运营：交接单(U3) / 巡视(U4) / 岗位权限(U9) / 异常(U5) / 导出脱敏留痕(U17)
const { test, expect } = require('@playwright/test')
const { query } = require('./db')

const CUSTOMER = { phone: '13800138001', password: '123456' }

async function customerLogin(request) {
  const r = await request.post('/api/mp/auth/login', { data: CUSTOMER })
  return (await r.json()).data.token
}
async function staffLogin(request, username) {
  const r = await request.post('/api/auth/login', { data: { username, password: '123456' } })
  const b = await r.json()
  expect(b.code).toBe(200)
  return b.data.token
}
async function cleanupOrder(orderId) {
  await query('DELETE FROM foster_bill_item WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_care_log WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_incident WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_handover WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_room_booking WHERE order_id = ?', [orderId])
  await query('DELETE FROM foster_order WHERE order_id = ?', [orderId])
}

test.describe('PRD · 门店运营全链路', () => {
  test('入店交接→巡视(护理可录/前台403)→异常(前台可录/送医需兽医403)→离店交接→导出脱敏留痕', async ({ request }) => {
    // 客户下单（待入店）
    const cToken = await customerLogin(request)
    const cAuth = { Authorization: `Bearer ${cToken}` }
    const pets = (await (await request.get('/api/mp/pets', { headers: cAuth })).json()).data
    const prices = (await (await request.get('/api/mp/prices', { headers: cAuth })).json()).data
    const puding = pets.find((p) => p.name === '布丁')
    const standard = prices.find((p) => p.levelName === '标准间')
    const create = await (await request.post('/api/mp/orders', {
      headers: cAuth,
      data: { petId: puding.id, startDate: '2026-12-10', endDate: '2026-12-11', priceId: standard.id, remark: 'PRD联调-运营链路' },
    })).json()
    const orderId = create.data.id

    const careToken = await staffLogin(request, 'care01')
    const frontToken = await staffLogin(request, 'front01')
    const careAuth = { Authorization: `Bearer ${careToken}` }
    const frontAuth = { Authorization: `Bearer ${frontToken}` }

    try {
      // U3 入店交接
      const inHand = await (await request.post(`/api/staff/orders/${orderId}/handover`, {
        headers: careAuth, data: { type: '入店', customerSign: true, remark: '毛发整洁' },
      })).json()
      expect(inHand.code).toBe(200)
      let row = await query('SELECT status, check_in_time FROM foster_order WHERE order_id=?', [orderId])
      expect(row[0].status).toBe('寄养中')
      expect(row[0].check_in_time).toBeTruthy()
      const hRow = await query("SELECT type, signer_position FROM foster_handover WHERE order_id=? AND type='入店'", [orderId])
      expect(hRow).toHaveLength(1)
      expect(hRow[0].signer_position).toBe('CARE')

      // U4 巡视：护理岗可录
      const logRes = await (await request.post(`/api/staff/orders/${orderId}/care-log`, {
        headers: careAuth, data: { shift: '早', spirit: '活泼', appetite: '正常', abnormal: '' },
      })).json()
      expect(logRes.code).toBe(200)
      const logRow = await query('SELECT shift, recorder_position FROM foster_care_log WHERE order_id=?', [orderId])
      expect(logRow[0].shift).toBe('早')

      // U9 权限：前台录巡视 → 403
      const frontLog = await request.post(`/api/staff/orders/${orderId}/care-log`, {
        headers: frontAuth, data: { shift: '中' },
      })
      expect(frontLog.status()).toBe(403)

      // U5 异常：前台可登记普通异常
      const inc = await (await request.post(`/api/staff/orders/${orderId}/incident`, {
        headers: frontAuth, data: { category: '健康', description: '轻微腹泻观察', action: '禁食观察', cost: 0 },
      })).json()
      expect(inc.code).toBe(200)

      // U9：前台标记送医(needVet) → 403（需执业兽医/店长）
      const vetForbid = await request.post(`/api/staff/orders/${orderId}/incident`, {
        headers: frontAuth, data: { category: '健康', description: '需送医', needVet: true },
      })
      expect(vetForbid.status()).toBe(403)

      // U3 离店交接
      const outHand = await (await request.post(`/api/staff/orders/${orderId}/handover`, {
        headers: careAuth, data: { type: '离店', customerSign: true },
      })).json()
      expect(outHand.code).toBe(200)
      row = await query('SELECT status, check_out_time FROM foster_order WHERE order_id=?', [orderId])
      expect(row[0].status).toBe('已完成')
      expect(row[0].check_out_time).toBeTruthy()
      const bk = await query('SELECT status FROM foster_room_booking WHERE order_id=?', [orderId])
      expect(bk[0].status).toBe('释放')

      // U17 导出：手机号脱敏 + 留痕
      const before = Number((await query('SELECT COUNT(*) AS c FROM data_export_log'))[0].c)
      const csvRes = await request.get('/api/staff/export/orders.csv', {
        headers: frontAuth, params: { purpose: '月末盘点联调' },
      })
      expect(csvRes.status()).toBe(200)
      const csv = await csvRes.text()
      expect(csv).toContain('138****8001')
      expect(csv).not.toContain('13800138001')
      const after = Number((await query('SELECT COUNT(*) AS c FROM data_export_log'))[0].c)
      expect(after).toBe(before + 1)
    } finally {
      await cleanupOrder(orderId)
    }
  })
})
