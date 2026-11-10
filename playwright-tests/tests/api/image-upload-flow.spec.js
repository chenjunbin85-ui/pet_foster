// 图片上传全链路（API 层）：上传 → 落库 → 读取 → 客户端可见 → 异常与越权
// 前置：后端 8090、MySQL 3306 运行；账号 13800138001 / 123456、员工 13800138011 / 123456
const { test, expect } = require('@playwright/test')
const { query } = require('./db')

const CUSTOMER = { phone: '13800138001', password: '123456' }
const OTHER_CUSTOMER = { phone: '13900139002', password: '123456' }
const STAFF = { username: '13800138011', password: '123456' }

// 1×1 透明 PNG：文件头 89 50 4E 47 0D 0A 1A 0A，后端会做魔术字节校验
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

async function loginCustomer(request, account = CUSTOMER) {
  const res = await request.post('/api/mp/auth/login', { data: account })
  const body = await res.json()
  expect(body.code, `客户登录失败：${body.message}`).toBe(200)
  return body.data.token
}

async function loginStaff(request) {
  const res = await request.post('/api/auth/login', { data: STAFF })
  const body = await res.json()
  expect(body.code, `员工登录失败：${body.message}`).toBe(200)
  return body.data.token
}

/** multipart 上传；返回原始响应，便于断言状态码与业务码 */
function upload(request, token, { name = 'chain.png', mimeType = 'image/png', buffer = PNG } = {}) {
  return request.post('/api/files/upload', {
    multipart: { file: { name, mimeType, buffer } },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

async function createPet(request, token, payload) {
  return request.post('/api/mp/pets', {
    headers: { Authorization: `Bearer ${token}` },
    data: payload,
  })
}

function uniquePetName(prefix) {
  return `${prefix}${String(Date.now()).slice(-6)}`
}

test.describe('图片上传 · 接口与校验', () => {
  test('客户上传 PNG：返回相对地址，免登录可读取', async ({ request }) => {
    const token = await loginCustomer(request)
    const res = await upload(request, token)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.code).toBe(200)
    expect(body.data.url).toMatch(/^\/api\/files\/[a-f0-9]{32}\.png$/)
    expect(body.data.contentType).toBe('image/png')
    expect(body.data.size).toBe(PNG.length)

    const image = await request.get(body.data.url)
    expect(image.status(), '上传后的图片应可直接 GET').toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')
    expect(Number(image.headers()['content-length'])).toBe(PNG.length)
    expect(image.headers()['cache-control']).toContain('max-age')
  })

  test('员工上传 JPEG 成功', async ({ request }) => {
    const token = await loginStaff(request)
    const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex')
    const res = await upload(request, token, { name: 'care.jpg', mimeType: 'image/jpeg', buffer: jpeg })
    const body = await res.json()
    expect(body.code, body.message).toBe(200)
    expect(body.data.url).toMatch(/\.jpg$/)
    expect((await request.get(body.data.url)).status()).toBe(200)
  })

  test('未登录上传被拒绝', async ({ request }) => {
    const res = await upload(request, null)
    expect(res.status()).toBe(401)
  })

  test('非 jpg/png 扩展名被拒绝', async ({ request }) => {
    const token = await loginCustomer(request)
    const res = await upload(request, token, { name: 'shell.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('仅支持 jpg / png')
  })

  test('伪造扩展名（文本冒充 PNG）被魔术字节校验拦下', async ({ request }) => {
    const token = await loginCustomer(request)
    const res = await upload(request, token, { name: 'fake.png', buffer: Buffer.from('<script>alert(1)</script>') })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('不是有效的')
  })

  test('超过 2MB 被拒绝', async ({ request }) => {
    const token = await loginCustomer(request)
    const oversized = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)])
    const res = await upload(request, token, { name: 'big.png', buffer: oversized })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('2MB')
  })

  test('非法图片地址不能写入宠物档案', async ({ request }) => {
    const token = await loginCustomer(request)
    const res = await createPet(request, token, {
      name: uniquePetName('非法地址'),
      breed: '中华田园猫',
      gender: '公',
      age: 2,
      weight: 3.2,
      photoUrl: 'javascript:alert(1)',
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.message).toContain('图片地址不合法')
  })

  test('客户不能读取他人订单的照护记录', async ({ request }) => {
    const [order] = await query(
      "SELECT order_id, customer_id FROM foster_order WHERE status = '寄养中' AND customer_id = 1 LIMIT 1"
    )
    test.skip(!order, '缺少寄养中订单，跳过越权用例')

    const otherToken = await loginCustomer(request, OTHER_CUSTOMER)
    const res = await request.get(`/api/mp/orders/${order.order_id}/care`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).message).toContain('无权查看')
  })
})

test.describe('图片上传 · 宠物头像全链路', () => {
  test('上传 → 绑定宠物 → 列表返回 → 落库 → 图片可访问', async ({ request }) => {
    const token = await loginCustomer(request)
    const uploaded = await (await upload(request, token, { name: 'avatar.png' })).json()
    const name = uniquePetName('头像链路')

    const created = await createPet(request, token, {
      name,
      breed: '布偶猫',
      gender: '母',
      age: 2,
      weight: 3.6,
      color: '奶白',
      photoUrl: uploaded.data.url,
      vaccineProofUrl: uploaded.data.url,
    })
    expect((await created.json()).code).toBe(200)

    const list = await (await request.get('/api/mp/pets', { headers: { Authorization: `Bearer ${token}` } })).json()
    const pet = list.data.find((p) => p.name === name)
    expect(pet, '新建宠物应出现在列表').toBeTruthy()
    expect(pet.photoUrl).toBe(uploaded.data.url)
    expect(pet.vaccineProofUrl).toBe(uploaded.data.url)

    const [row] = await query('SELECT photo_url, vaccine_proof_url FROM pet WHERE pet_id = ?', [pet.id])
    expect(row.photo_url).toBe(uploaded.data.url)
    expect(row.vaccine_proof_url).toBe(uploaded.data.url)

    const image = await request.get(pet.photoUrl)
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')

    // 清理：测试自建的宠物档案
    await request.delete(`/api/mp/pets/${pet.id}`, { headers: { Authorization: `Bearer ${token}` } })
  })

  test('更换头像：旧地址被新地址覆盖', async ({ request }) => {
    const token = await loginCustomer(request)
    const first = (await (await upload(request, token, { name: 'v1.png' })).json()).data.url
    const second = (await (await upload(request, token, { name: 'v2.png' })).json()).data.url
    const name = uniquePetName('换头像')

    const created = await createPet(request, token, {
      name, breed: '金毛', gender: '公', age: 3, weight: 28, photoUrl: first,
    })
    expect((await created.json()).code).toBe(200)

    const list = (await (await request.get('/api/mp/pets', { headers: { Authorization: `Bearer ${token}` } })).json()).data
    const pet = list.find((p) => p.name === name)

    const updated = await request.put(`/api/mp/pets/${pet.id}`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, breed: '金毛', gender: '公', age: 3, weight: 28, photoUrl: second },
    })
    expect((await updated.json()).code).toBe(200)

    const [row] = await query('SELECT photo_url FROM pet WHERE pet_id = ?', [pet.id])
    expect(row.photo_url).toBe(second)

    await request.delete(`/api/mp/pets/${pet.id}`, { headers: { Authorization: `Bearer ${token}` } })
  })
})

test.describe('图片上传 · 员工拍照到顾客可见', () => {
  test('员工上传现场照片 → 巡视落库 → 顾客照护记录可见并可查看图片', async ({ request }) => {
    const [order] = await query(
      "SELECT order_id, customer_id, start_date FROM foster_order WHERE status = '寄养中' ORDER BY order_id DESC LIMIT 1"
    )
    test.skip(!order, '缺少寄养中订单，跳过照片消费链路')

    const staffToken = await loginStaff(request)
    const uploaded = (await (await upload(request, staffToken, { name: 'care.png' })).json()).data.url
    const today = new Date().toISOString().slice(0, 10)

    const logRes = await request.post(`/api/staff/orders/${order.order_id}/care-log`, {
      headers: { Authorization: `Bearer ${staffToken}` },
      data: {
        logDate: today,
        shift: '晚',
        spirit: '活泼',
        appetite: '正常',
        defecation: '正常',
        photoUrls: uploaded,
      },
    })
    const logBody = await logRes.json()
    expect(logBody.code, logBody.message).toBe(200)

    const [logRow] = await query(
      'SELECT care_log_id, photo_urls FROM foster_care_log WHERE order_id = ? AND log_date = ? AND shift = ? ORDER BY care_log_id DESC LIMIT 1',
      [order.order_id, today, '晚']
    )
    expect(logRow.photo_urls).toBe(uploaded)

    const customerToken = await loginCustomer(request)
    const careRes = await request.get(`/api/mp/orders/${order.order_id}/care`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    })
    const careBody = await careRes.json()
    expect(careBody.code, careBody.message).toBe(200)

    const record = careBody.data.find((r) => r.recordId === `CL-${logRow.care_log_id}`)
    expect(record, '顾客端应看到该条巡视').toBeTruthy()
    expect(record.type).toBe('巡视')
    expect(record.shift).toBe('晚')
    expect(record.photos).toContain(uploaded)
    expect(record.content).toContain('精神 活泼')

    const photo = await request.get(record.photos[0])
    expect(photo.status(), '顾客端拿到的照片地址应可直接展示').toBe(200)
    expect(photo.headers()['content-type']).toContain('image/png')

    // 清理：这条巡视是测试写入演示库的，避免污染顾客端时间线
    await query('DELETE FROM foster_care_log WHERE care_log_id = ?', [logRow.care_log_id])
  })
})
