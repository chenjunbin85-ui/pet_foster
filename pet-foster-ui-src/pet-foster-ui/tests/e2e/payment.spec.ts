import { test, expect, type APIRequestContext, type Page } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

/**
 * 模拟支付模块 e2e 测试
 *
 * 被测对象：寄养订单「收银台」弹窗（OrdersPage.tsx 的支付模块）
 *   - 列表行「待收款」入口、订单详情「立即支付」入口、新建订单保存后自动弹出收银台
 *   - 微信 / 支付宝支付方式切换（二维码与提示联动）
 *   - 「模拟扫码完成支付」：1.5s 处理动画 → 调用 POST /api/orders/{id}/pay → 成功提示并刷新列表
 *   - 后端边界：重复支付、已取消订单支付、不存在订单支付均被拒绝（HTTP 400）
 *
 * 数据策略：每个用例通过后端 API 创建独立的「客户 + 宠物 + 待支付订单」
 * （客户名 / 手机号带时间戳保证唯一），用例结束后统一清理，互不依赖。
 */

const API_BASE = "http://127.0.0.1:8090"
const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` })

interface TestOrder {
  customerId: string
  customerName: string
  phone: string
  petId: string
  petName: string
  orderId: string
  orderNo: string
  totalFee: number
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

async function apiLogin(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { username: "admin", password: "admin123" },
  })
  expect(res.status(), "管理员登录失败").toBe(200)
  const body = (await res.json()) as { data: { token: string } }
  return body.data.token
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

/** 通过后端 API 创建一笔「待支付」订单（3 天 × 100 元/天 = 300 元） */
async function createPayableOrder(
  request: APIRequestContext,
  token: string
): Promise<TestOrder> {
  const base = await createCustomerPet(request, token)
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
      pricePerDay: 100,
      remark: "支付模块e2e测试",
    },
  })
  expect(oRes.status(), "创建订单失败").toBe(200)

  // 订单号由后端生成，按 customerId 查列表取最新一笔（orderNo 字典序最大 = 最新）
  const latest = await fetchLatestOrder(request, token, base.customerId)
  return { ...base, ...latest }
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

async function cleanup(request: APIRequestContext, token: string, created: TestOrder[]) {
  for (const o of created) {
    // orderId 为空说明订单尚未创建（例如用例中途失败），跳过订单清理
    if (o.orderId) {
      try {
        await request.delete(`${API_BASE}/api/orders/${o.orderId}`, { headers: authHeader(token) })
      } catch {
        // 清理失败不阻塞其它清理
      }
    }
    try {
      await request.delete(`${API_BASE}/api/pets/${o.petId}`, { headers: authHeader(token) })
    } catch {
      // ignore
    }
    try {
      await request.delete(`${API_BASE}/api/customers/${o.customerId}`, { headers: authHeader(token) })
    } catch {
      // ignore
    }
  }
}

// ---------- UI helpers ----------

async function openOrders(page: Page) {
  await login(page, "admin", "admin123")
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

/** 从列表行「待收款」入口打开收银台 */
async function openCheckoutFromRow(page: Page, orderNo: string) {
  const row = await searchOrder(page, orderNo)
  await row.locator(".pay-due-tag").click()
  await expect(page.locator(".pay-dialog-modal")).toBeVisible()
  return row
}

/** 订单详情弹窗中某个字段（dt）对应的值（dd） */
function detailValue(page: Page, label: string) {
  return page
    .locator(".customer-dialog .customer-detail > div")
    .filter({ has: page.locator("dt", { hasText: label }) })
    .locator("dd")
}

// ---------- 测试 ----------

test.describe("模拟支付模块（收银台）", () => {
  let token: string
  const created: TestOrder[] = []

  test.beforeAll(async ({ request }) => {
    token = await apiLogin(request)
  })

  test.afterAll(async ({ request }) => {
    if (!token) return
    await cleanup(request, token, created)
  })

  test("收银台弹窗展示订单金额与订单号，默认微信支付", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    await openCheckoutFromRow(page, order.orderNo)

    const payDialog = page.locator(".pay-dialog-modal")
    await expect(payDialog.locator(".pay-header h3")).toHaveText("收银台")
    await expect(payDialog.locator(".pay-number")).toHaveText(String(order.totalFee))
    await expect(payDialog.locator(".pay-order-meta")).toContainText(order.orderNo)

    // 默认选中微信，展示微信二维码与提示
    await expect(payDialog.locator(".pay-method-tab.wechat")).toHaveClass(/active/)
    await expect(payDialog.locator(".pay-qr-image")).toHaveAttribute("src", /wechat-qr\.png/)
    await expect(payDialog.locator(".pay-qr-tip")).toContainText("微信")
  })

  test("支付方式可在微信与支付宝间切换，二维码与提示联动", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    await openCheckoutFromRow(page, order.orderNo)

    const payDialog = page.locator(".pay-dialog-modal")
    await expect(payDialog.locator(".pay-method-tab.wechat")).toHaveClass(/active/)

    // 切换到支付宝
    await payDialog.locator(".pay-method-tab.alipay").click()
    await expect(payDialog.locator(".pay-method-tab.alipay")).toHaveClass(/active/)
    await expect(payDialog.locator(".pay-method-tab.wechat")).not.toHaveClass(/active/)
    await expect(payDialog.locator(".pay-qr-image")).toHaveAttribute("src", /alipay-qr\.png/)
    await expect(payDialog.locator(".pay-qr-tip")).toContainText("支付宝")

    // 切回微信
    await payDialog.locator(".pay-method-tab.wechat").click()
    await expect(payDialog.locator(".pay-method-tab.wechat")).toHaveClass(/active/)
    await expect(payDialog.locator(".pay-qr-image")).toHaveAttribute("src", /wechat-qr\.png/)
  })

  test("微信模拟支付成功：处理动画、成功提示、列表与详情状态刷新", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    const row = await openCheckoutFromRow(page, order.orderNo)

    await page.locator(".pay-simulate-btn").click()
    // 支付中动画
    await expect(page.locator(".pay-processing")).toBeVisible()
    // 成功提示 + 收银台关闭 + 列表刷新后待收款消失
    await expect(page.locator(".customer-notice")).toContainText(`支付成功（微信）`, { timeout: 15000 })
    await expect(page.locator(".pay-dialog-modal")).not.toBeVisible()
    await expect(row.locator(".pay-due-tag")).toHaveCount(0)

    // 详情弹窗：支付状态 / 支付方式 / 支付时间
    await row.getByRole("button", { name: `查看${order.orderNo}` }).click()
    const dialog = page.locator(".customer-dialog")
    await expect(dialog).toBeVisible()
    await expect(detailValue(page, "支付状态")).toHaveText("已支付")
    await expect(detailValue(page, "支付方式")).toHaveText("微信")
    await expect(detailValue(page, "支付时间")).not.toHaveText("—")
  })

  test("支付宝模拟支付成功并写入支付方式与实收金额", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    const row = await openCheckoutFromRow(page, order.orderNo)

    await page.locator(".pay-method-tab.alipay").click()
    await expect(page.locator(".pay-method-tab.alipay")).toHaveClass(/active/)
    await page.locator(".pay-simulate-btn").click()

    await expect(page.locator(".customer-notice")).toContainText("支付成功（支付宝）", { timeout: 15000 })
    await expect(page.locator(".pay-dialog-modal")).not.toBeVisible()
    await expect(row.locator(".pay-due-tag")).toHaveCount(0)

    // 后端落库校验
    const res = await request.get(`${API_BASE}/api/orders/${order.orderId}`, { headers: authHeader(token) })
    expect(res.status()).toBe(200)
    const body = (await res.json()) as {
      data: { paymentStatus: string; paymentMethod: string; paidAmount: number | string; paymentTime: string | null }
    }
    expect(body.data.paymentStatus).toBe("已支付")
    expect(body.data.paymentMethod).toBe("支付宝")
    expect(Number(body.data.paidAmount)).toBe(order.totalFee)
    expect(body.data.paymentTime).toBeTruthy()
  })

  test("稍后支付关闭收银台且订单保持待支付", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    const row = await openCheckoutFromRow(page, order.orderNo)

    await page.locator(".pay-dialog-modal .pay-later").click()
    await expect(page.locator(".pay-dialog-modal")).not.toBeVisible()
    // 列表仍显示待收款，可再次打开
    await expect(row.locator(".pay-due-tag")).toBeVisible()
    await row.locator(".pay-due-tag").click()
    await expect(page.locator(".pay-dialog-modal")).toBeVisible()
    await page.locator(".pay-dialog-modal .pay-later").click()

    // 后端校验仍未支付
    const res = await request.get(`${API_BASE}/api/orders/${order.orderId}`, { headers: authHeader(token) })
    const body = (await res.json()) as { data: { paymentStatus?: string | null } }
    expect(body.data.paymentStatus).not.toBe("已支付")
  })

  test("订单详情弹窗提供「立即支付」入口并正确带出金额", async ({ page, request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    await openOrders(page)
    const row = await searchOrder(page, order.orderNo)
    await row.getByRole("button", { name: `查看${order.orderNo}` }).click()

    const dialog = page.locator(".customer-dialog")
    await expect(dialog).toBeVisible()
    const payBtn = dialog.getByRole("button", { name: /立即支付/ })
    await expect(payBtn).toContainText(String(order.totalFee))
    await payBtn.click()

    const payDialog = page.locator(".pay-dialog-modal")
    await expect(payDialog).toBeVisible()
    await expect(payDialog.locator(".pay-number")).toHaveText(String(order.totalFee))
    await expect(payDialog.locator(".pay-order-meta")).toContainText(order.orderNo)
    await payDialog.locator(".pay-later").click()
  })

  test("新建订单保存成功、费用自动计算并出现在列表待收款", async ({ page, request }) => {
    const base = await createCustomerPet(request, token)
    // 先登记客户/宠物资源，保证用例中途失败也能清理（orderId 留空，清理时跳过）
    created.push({ ...base, orderId: "", orderNo: "", totalFee: 0 })

    await openOrders(page)
    await page.locator(".primary-action", { hasText: "新建寄养订单" }).click()
    const dialog = page.locator(".customer-dialog")
    await expect(dialog).toBeVisible()

    // 选择客户后自动带出宠物（option 元素无可见性，用数量断言等待加载完成）
    await dialog.locator("#order-customer").selectOption({ label: `${base.customerName}（${base.phone}）` })
    await expect(dialog.locator("#order-pet option", { hasText: base.petName })).toHaveCount(1)
    await dialog.locator("#order-pet").selectOption({ label: `${base.petName}（金毛）` })

    // 2 天 × 100 元/天 = 200 元（验证前端自动计算）
    const start = new Date()
    start.setDate(start.getDate() + 1)
    const end = new Date()
    end.setDate(end.getDate() + 2)
    await dialog.locator("#order-start").fill(fmtDate(start))
    await dialog.locator("#order-end").fill(fmtDate(end))
    await dialog.locator("#order-price").fill("100")

    await dialog.getByRole("button", { name: "保存订单" }).click()

    // 创建成功提示
    await expect(page.locator(".customer-notice")).toContainText("订单已创建，请完成支付。", { timeout: 10000 })
    // 立即登记新订单（无论后续断言成败都能清理）
    const latest = await fetchLatestOrder(request, token, base.customerId)
    created[created.length - 1] = { ...base, ...latest }

    // 列表出现该订单，且后端按 2 天 × 100 元自动计算总费用 200
    const row = await searchOrder(page, latest.orderNo)
    await expect(row.locator(".pay-due-tag")).toContainText("¥200")
  })

  test("新建订单保存后自动弹出收银台且金额为自动计算结果", async ({ page, request }) => {
    // 修复后的行为：POST /api/orders 返回新订单 VO，前端 save() 拿到 created.id，
    // 「自动弹出支付弹窗」逻辑生效（此前后端返回 data=null，该功能永不触发）。
    const base = await createCustomerPet(request, token)
    created.push({ ...base, orderId: "", orderNo: "", totalFee: 0 })

    await openOrders(page)
    await page.locator(".primary-action", { hasText: "新建寄养订单" }).click()
    const dialog = page.locator(".customer-dialog")
    await expect(dialog).toBeVisible()

    await dialog.locator("#order-customer").selectOption({ label: `${base.customerName}（${base.phone}）` })
    await expect(dialog.locator("#order-pet option", { hasText: base.petName })).toHaveCount(1)
    await dialog.locator("#order-pet").selectOption({ label: `${base.petName}（金毛）` })

    // 2 天 × 100 元/天 = 200 元（前端自动计算）
    const start = new Date()
    start.setDate(start.getDate() + 1)
    const end = new Date()
    end.setDate(end.getDate() + 2)
    await dialog.locator("#order-start").fill(fmtDate(start))
    await dialog.locator("#order-end").fill(fmtDate(end))
    await dialog.locator("#order-price").fill("100")

    await dialog.getByRole("button", { name: "保存订单" }).click()

    // 立即登记新订单（无论后续断言成败都能清理）
    const latest = await fetchLatestOrder(request, token, base.customerId)
    created[created.length - 1] = { ...base, ...latest }

    // 保存后自动弹出收银台，金额与自动计算一致
    const payDialog = page.locator(".pay-dialog-modal")
    await expect(payDialog).toBeVisible()
    await expect(payDialog.locator(".pay-number")).toHaveText("200")
    await expect(payDialog.locator(".pay-order-meta")).toContainText(latest.orderNo)
    await payDialog.locator(".pay-later").click()
    await expect(payDialog).not.toBeVisible()
  })

  // ---------- 后端支付接口边界 ----------

  test("API：已支付订单重复支付被拒绝", async ({ request }) => {
    const order = await createPayableOrder(request, token)
    created.push(order)

    const first = await request.post(`${API_BASE}/api/orders/${order.orderId}/pay`, {
      headers: authHeader(token),
      data: { paymentMethod: "微信" },
    })
    expect(first.status()).toBe(200)

    const second = await request.post(`${API_BASE}/api/orders/${order.orderId}/pay`, {
      headers: authHeader(token),
      data: { paymentMethod: "支付宝" },
    })
    expect(second.status()).toBe(400)
    const body = (await second.json()) as { message: string }
    expect(body.message).toContain("请勿重复支付")
  })

  test("API：已取消订单无法支付", async ({ request }) => {
    const order = await createPayableOrder(request, token)
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
    const body = (await pay.json()) as { message: string }
    expect(body.message).toContain("已取消订单无法支付")
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
})
