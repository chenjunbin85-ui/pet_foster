import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

/**
 * 订单支付状态 e2e 测试（创建即已支付）
 *
 * 产品行为：自 2026-10-15「明确角色权限划分」起，工作人员创建订单时即完成收款（演示口径），
 * 订单落库即 paymentStatus=已支付 / paymentMethod=微信 / paidAmount=totalFee，不再产生
 * 「待支付」订单。前端「待收款」标签、详情「立即支付」按钮与收银台 <dialog> 均已移除
 * （2026-11-07 清理死代码，详见 docs/Playwright全量回归报告-2026-11-06.md §9）。
 *
 * 因此本文件不再覆盖收银台交互，改为验证：
 *   - API：POST /api/orders 与 GET /api/orders/{id} 的支付字段
 *   - API：POST /api/orders/{id}/pay 的拒绝边界（重复支付 / 已取消 / 不存在）
 *   - UI：订单列表、详情弹窗、新建订单流程均按「已完成收款」呈现
 *
 * 数据策略：每个用例创建独立的「客户 + 宠物 + 订单」，afterAll 按客户反查全部订单统一清理，
 * 避免用例中途失败、订单号未登记而漏删（旧版 cleanup 曾因此残留订单）。
 */

const API_BASE = "http://127.0.0.1:8090"
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

interface OrderVO {
  id: string
  orderNo: string
  totalFee: number | string
  status: string
  paymentStatus: string
  paymentMethod: string
  paidAmount: number | string | null
  paymentTime: string | null
  chargeDays: number
}

interface TestOrder {
  customerId: string
  customerName: string
  phone: string
  petId: string
  petName: string
  orderId: string
  orderNo: string
  totalFee: number
  createdVO?: OrderVO
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function apiLogin(request: APIRequestContext): Promise<string> {
  // 订单为客户接待执行层业务，由工作人员账号驱动
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: "13800138011", password: "123456" },
  })
  expect(res.status(), "工作人员登录失败").toBe(200)
  const body = (await res.json()) as { data: { token: string } }
  return body.data.token
}

/** 获取第一个启用中的价位档位（后端计价以价位表为准） */
async function getDefaultPrice(request: APIRequestContext, token: string): Promise<{ id: string; pricePerDay: number }> {
  const res = await request.get(`${API_BASE}/api/prices/options`, { headers: authHeader(token) })
  expect(res.status(), "获取价位档位失败").toBe(200)
  const body = (await res.json()) as { data: Array<{ id: string; levelName: string; pricePerDay: number; status: number }> }
  const enabled = body.data.filter((p) => p.status === 1)
  expect(enabled.length, "没有启用中的价位档位").toBeGreaterThan(0)
  return { id: String(enabled[0].id), pricePerDay: Number(enabled[0].pricePerDay) }
}

/** 通过后端 API 创建「客户 + 宠物」（不建订单） */
async function createCustomerPet(
  request: APIRequestContext,
  token: string
): Promise<Pick<TestOrder, "customerId" | "customerName" | "phone" | "petId" | "petName">> {
  const suffix = String(Date.now()).slice(-8)
  const customerName = `支付测试客户${suffix}`
  const phone = `139${suffix}`
  const petName = `支付测试宠物${suffix}`

  const cRes = await request.post(`${API_BASE}/api/customers`, {
    headers: authHeader(token),
    data: { name: customerName, phone, address: "自动化测试地址", remark: "支付模块e2e测试数据" },
  })
  expect(cRes.status(), "创建客户失败").toBe(200)
  const cList = await request.get(
    `${API_BASE}/api/customers?page=1&size=50&keyword=${encodeURIComponent(customerName)}`,
    { headers: authHeader(token) }
  )
  const cBody = (await cList.json()) as {
    data: { records: Array<{ id: string; name: string; phone: string }> }
  }
  const customer = cBody.data.records.find((r) => r.name === customerName)
  expect(customer, "未查询到测试客户").toBeTruthy()

  const pRes = await request.post(`${API_BASE}/api/pets`, {
    headers: authHeader(token),
    data: {
      customerId: Number((customer as { id: string }).id),
      name: petName,
      breed: "金毛",
      gender: "公",
      age: 2,
      weight: 12.5,
      color: "金色",
      vaccine: "已接种",
      history: "支付模块测试宠物",
    },
  })
  expect(pRes.status(), "创建宠物失败").toBe(200)
  const pList = await request.get(
    `${API_BASE}/api/pets?page=1&size=50&name=${encodeURIComponent(petName)}`,
    { headers: authHeader(token) }
  )
  const pBody = (await pList.json()) as {
    data: { records: Array<{ id: string; name: string }> }
  }
  const pet = pBody.data.records.find((r) => r.name === petName)
  expect(pet, "未查询到测试宠物").toBeTruthy()

  return {
    customerId: (customer as { id: string }).id,
    customerName,
    phone,
    petId: (pet as { id: string }).id,
    petName,
  }
}

/** 查询某客户最新一笔订单（orderNo 字典序最大） */
async function fetchLatestOrder(
  request: APIRequestContext,
  token: string,
  customerId: string
): Promise<{ orderId: string; orderNo: string; totalFee: number }> {
  const oList = await request.get(
    `${API_BASE}/api/orders?page=1&size=100&customerId=${customerId}`,
    { headers: authHeader(token) }
  )
  const oBody = (await oList.json()) as {
    data: { records: Array<{ id: string; orderNo: string; customerId: string; totalFee: number }> }
  }
  const orders = oBody.data.records.filter((r) => r.customerId === customerId)
  expect(orders.length, "未查询到测试订单").toBeGreaterThan(0)
  const order = orders.sort((a, b) => (a.orderNo < b.orderNo ? -1 : 1))[orders.length - 1]
  expect(order, "测试订单解析失败").toBeTruthy()
  return {
    orderId: (order as { id: string }).id,
    orderNo: (order as { orderNo: string }).orderNo,
    totalFee: Number((order as { totalFee: number }).totalFee),
  }
}

/** 创建一笔订单：产品现状是「创建即已支付」，返回创建接口 VO 供支付字段断言 */
async function createPaidOrder(
  request: APIRequestContext,
  token: string
): Promise<TestOrder> {
  const base = await createCustomerPet(request, token)
  const price = await getDefaultPrice(request, token)
  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date()
  end.setDate(end.getDate() + 3)

  const oRes = await request.post(`${API_BASE}/api/orders`, {
    headers: authHeader(token),
    data: {
      customerId: Number(base.customerId),
      petId: Number(base.petId),
      startDate: fmtDate(start),
      endDate: fmtDate(end),
      priceId: Number(price.id),
      remark: "支付模块e2e测试",
    },
  })
  expect(oRes.status(), "创建订单失败").toBe(200)
  const oBody = (await oRes.json()) as { data: OrderVO }
  expect(oBody.data && oBody.data.id, "创建订单未返回订单 VO").toBeTruthy()

  // 订单号由后端生成，按 customerId 查列表取最新一笔（orderNo 字典序最大 = 最新）
  const latest = await fetchLatestOrder(request, token, base.customerId)
  return { ...base, ...latest, createdVO: oBody.data }
}

/** 按客户反查并清理该用例产生的全部订单，再删宠物与客户 */
async function cleanup(request: APIRequestContext, token: string, created: TestOrder[]) {
  for (const item of created) {
    const orderIds: string[] = []
    try {
      const list = await request.get(
        `${API_BASE}/api/orders?page=1&size=100&customerId=${item.customerId}`,
        { headers: authHeader(token) }
      )
      const body = (await list.json()) as { data?: { records?: Array<{ id: string }> } }
      for (const r of body.data?.records ?? []) orderIds.push(String(r.id))
    } catch {
      // 查询失败时回退到用例内已登记的订单号
    }
    if (item.orderId && !orderIds.includes(String(item.orderId))) orderIds.push(String(item.orderId))
    for (const id of orderIds) {
      try {
        await request.delete(`${API_BASE}/api/orders/${id}`, { headers: authHeader(token) })
      } catch {
        // 清理失败不阻塞其它清理
      }
    }
    try {
      await request.delete(`${API_BASE}/api/pets/${item.petId}`, { headers: authHeader(token) })
    } catch {
      // ignore
    }
    try {
      await request.delete(`${API_BASE}/api/customers/${item.customerId}`, { headers: authHeader(token) })
    } catch {
      // ignore
    }
  }
}

// ---------- UI helpers ----------

async function openOrders(page: Page) {
  await login(page, "13800138011", "123456")
  await navigateTo(page, "寄养订单管理")
}

async function searchOrder(page: Page, orderNo: string) {
  const input = page.getByPlaceholder("按订单编号搜索")
  await input.fill(orderNo)
  await input.press("Enter")
  const row = page.locator(".customer-table tbody tr", { hasText: orderNo })
  await expect(row).toBeVisible()
  return row
}

/** 订单详情弹窗中某个字段（dt）对应的值（dd） */
function detailValue(page: Page, label: string) {
  return page
    .locator(".customer-dialog .customer-detail > div")
    .filter({ has: page.locator("dt", { hasText: label }) })
    .locator("dd")
}

/** 走一遍 UI 新建订单表单，返回自动计算的预期金额 */
async function fillNewOrderForm(
  page: Page,
  base: Pick<TestOrder, "customerId" | "customerName" | "phone" | "petId" | "petName">,
  price: { id: string; pricePerDay: number }
) {
  await page.locator(".primary-action", { hasText: "新建寄养订单" }).click()
  const dialog = page.locator(".customer-dialog")
  await expect(dialog).toBeVisible()

  await dialog.locator("#order-customer").selectOption({ label: `${base.customerName}（${base.phone}）` })
  await expect(dialog.locator("#order-pet option", { hasText: base.petName })).toHaveCount(1)
  await dialog.locator("#order-pet").selectOption({ label: `${base.petName}（金毛）` })

  const start = new Date()
  start.setDate(start.getDate() + 1)
  const end = new Date()
  end.setDate(end.getDate() + 2)
  await dialog.locator("#order-start").fill(fmtDate(start))
  await dialog.locator("#order-end").fill(fmtDate(end))
  await dialog.locator("#order-price").selectOption({ value: price.id })

  return { dialog, expectedFee: 2 * price.pricePerDay }
}

// ---------- 测试 ----------

test.describe("订单支付状态（创建即已支付）", () => {
  let token: string
  const created: TestOrder[] = []

  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test.afterAll(async ({ request }) => {
    if (!token) return
    await cleanup(request, token, created)
  })

  // ---------- API：创建即已支付 ----------

  test("API：新建订单返回值即为已支付（微信）", async ({ request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    const vo = order.createdVO!
    expect(vo.paymentStatus).toBe("已支付")
    expect(vo.paymentMethod).toBe("微信")
    expect(Number(vo.paidAmount)).toBe(order.totalFee)
    expect(vo.paymentTime).toBeTruthy()
    expect(vo.status).toBe("待入店")
  })

  test("API：新建订单详情字段与创建返回一致且总费用按天计算", async ({ request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)
    const price = await getDefaultPrice(request, token)

    const res = await request.get(`${API_BASE}/api/orders/${order.orderId}`, { headers: authHeader(token) })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { data: OrderVO }
    expect(body.data.paymentStatus).toBe("已支付")
    expect(body.data.paymentMethod).toBe("微信")
    expect(Number(body.data.paidAmount)).toBe(order.totalFee)
    expect(body.data.paymentTime).toBeTruthy()
    // 起止日期 +1 ~ +3，计费天数 = DATEDIFF + 1 = 3；Web/小程序统一落 charge_days 快照
    expect(Number(body.data.totalFee)).toBe(3 * price.pricePerDay)
    expect(body.data.chargeDays).toBe(3)
  })

  test("API：已支付订单重复支付被拒绝且不改写支付方式", async ({ request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    for (const method of ["微信", "支付宝"]) {
      const res = await request.post(`${API_BASE}/api/orders/${order.orderId}/pay`, {
        headers: authHeader(token),
        data: { paymentMethod: method },
      })
      expect(res.status()).toBe(400)
      const body = (await res.json()) as { message: string }
      expect(body.message).toContain("请勿重复支付")
    }

    const detail = await request.get(`${API_BASE}/api/orders/${order.orderId}`, { headers: authHeader(token) })
    const vo = ((await detail.json()) as { data: OrderVO }).data
    expect(vo.paymentMethod).toBe("微信")
    expect(Number(vo.paidAmount)).toBe(order.totalFee)
  })

  test("API：已取消订单支付被拒绝（订单状态优先判定）", async ({ request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    const cancel = await request.put(`${API_BASE}/api/orders/${order.orderId}/cancel`, {
      headers: authHeader(token),
    })
    expect(cancel.status()).toBe(200)

    const pay = await request.post(`${API_BASE}/api/orders/${order.orderId}/pay`, {
      headers: authHeader(token),
      data: { paymentMethod: "微信" },
    })
    expect(pay.status()).toBe(400)
    // pay() 先判订单状态再判支付状态：已取消订单应给出准确文案，而非误报「重复支付」
    const body = (await pay.json()) as { message: string }
    expect(body.message).toContain("已取消订单无法支付")
    expect(body.message).not.toContain("请勿重复支付")

    const detail = await request.get(`${API_BASE}/api/orders/${order.orderId}`, { headers: authHeader(token) })
    const vo = ((await detail.json()) as { data: OrderVO }).data
    expect(vo.status).toBe("已取消")
  })

  test("API：不存在的订单支付返回错误", async ({ request }) => {
    const res = await request.post(`${API_BASE}/api/orders/999999999/pay`, {
      headers: authHeader(token),
      data: { paymentMethod: "微信" },
    })
    expect(res.status()).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toContain("订单不存在")
  })

  // ---------- UI：不再有待收款 / 收银台入口 ----------

  test("UI：订单列表无待收款入口且收银台不渲染", async ({ page, request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    await openOrders(page)
    const row = await searchOrder(page, order.orderNo)

    await expect(row.locator(".pay-due-tag")).toHaveCount(0)
    await expect(page.locator(".pay-dialog-modal")).toHaveCount(0)
    await expect(row.locator(".soft-badge")).toHaveText("待入店")
    await expect(row.getByRole("button", { name: /立即支付/ })).toHaveCount(0)
  })

  test("UI：订单详情字段完整且无立即支付入口", async ({ page, request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)
    const price = await getDefaultPrice(request, token)

    await openOrders(page)
    const row = await searchOrder(page, order.orderNo)
    await row.getByRole("button", { name: `查看${order.orderNo}` }).click()

    await expect(page.locator(".customer-dialog")).toBeVisible()
    await expect(detailValue(page, "总费用")).toContainText(String(order.totalFee))
    await expect(detailValue(page, "每日单价")).toContainText(String(price.pricePerDay))
    // Web 与小程序端均落 charge_days 快照；本用例订单为 +1 ~ +3，共 3 天
    await expect(detailValue(page, "计费天数")).toHaveText("3 天")
    await expect(detailValue(page, "状态")).toHaveText("待入店")
    await expect(page.locator(".customer-dialog").getByRole("button", { name: /立即支付/ })).toHaveCount(0)
  })

  test("UI：新建订单保存成功、费用自动计算并提示已完成收款", async ({ page, request }) => {
    const base = await createCustomerPet(request, token)
    created.push({ ...base, orderId: "", orderNo: "", totalFee: 0 })
    const price = await getDefaultPrice(request, token)

    await openOrders(page)
    const { expectedFee } = await fillNewOrderForm(page, base, price)
    await page.getByRole("button", { name: "保存订单" }).click()

    await expect(page.locator(".customer-notice")).toContainText("订单已创建并完成收款。", { timeout: 10000 })

    const latest = await fetchLatestOrder(request, token, base.customerId)
    created[created.length - 1] = { ...base, ...latest }

    const row = await searchOrder(page, latest.orderNo)
    const feeText = await row.locator("td").nth(4).innerText()
    expect(Number(feeText.replace(/,/g, ""))).toBe(expectedFee)
    await expect(row.locator(".pay-due-tag")).toHaveCount(0)
  })

  test("UI：新建订单后不弹收银台且后端立即为已支付", async ({ page, request }) => {
    const base = await createCustomerPet(request, token)
    created.push({ ...base, orderId: "", orderNo: "", totalFee: 0 })
    const price = await getDefaultPrice(request, token)

    await openOrders(page)
    const { expectedFee } = await fillNewOrderForm(page, base, price)
    await page.getByRole("button", { name: "保存订单" }).click()
    await expect(page.locator(".customer-notice")).toContainText("订单已创建并完成收款。", { timeout: 10000 })

    const latest = await fetchLatestOrder(request, token, base.customerId)
    created[created.length - 1] = { ...base, ...latest }

    await expect(page.locator(".pay-dialog-modal")).toHaveCount(0)
    const detail = await request.get(`${API_BASE}/api/orders/${latest.orderId}`, { headers: authHeader(token) })
    const vo = ((await detail.json()) as { data: OrderVO }).data
    expect(vo.paymentStatus).toBe("已支付")
    expect(vo.paymentMethod).toBe("微信")
    expect(Number(vo.paidAmount)).toBe(expectedFee)
  })

  test("UI：订单编号搜索唯一定位且与详情金额一致", async ({ page, request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    await openOrders(page)
    const rows = page.locator(".customer-table tbody tr", { hasText: order.orderNo })
    await expect(rows).toHaveCount(1)
    await rows.first().getByRole("button", { name: `查看${order.orderNo}` }).click()
    await expect(detailValue(page, "总费用")).toContainText(String(order.totalFee))
  })

  test("UI：收银台支付方式控件不再渲染（防止旧交互回归）", async ({ page, request }) => {
    const order = await createPaidOrder(request, token)
    created.push(order)

    await openOrders(page)
    await searchOrder(page, order.orderNo)

    for (const selector of [".pay-method-tab", ".pay-qr-image", ".pay-simulate-btn", ".pay-later"]) {
      await expect(page.locator(selector)).toHaveCount(0)
    }
  })
})
