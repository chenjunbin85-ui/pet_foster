// Uses the existing preview server and a separately running test Chromium.
import assert from "node:assert/strict"

const appUrl = new URL(process.env.APP_URL || "http://localhost:3000")
appUrl.searchParams.set("demo", "1")
const cdpUrl = process.env.CDP_URL || "http://localhost:9222"
const target = (await (await fetch(`${cdpUrl}/json/list`)).json()).find(
  (t) => t.type === "page",
)
assert.ok(target, "Start test Chromium with --remote-debugging-port=9222")
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => {
  socket.onopen = resolve
})
let sequence = 0
const pending = new Map()
const exceptions = []
socket.onmessage = (event) => {
  const message = JSON.parse(event.data)
  if (message.id) {
    pending.get(message.id)?.(message)
    pending.delete(message.id)
  }
  if (message.method === "Runtime.exceptionThrown")
    exceptions.push(message.params.exceptionDetails.text)
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, (response) =>
      response.error
        ? reject(new Error(JSON.stringify(response.error)))
        : resolve(response.result),
    )
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await command("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result.value
}
async function waitFor(expression) {
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return
    await delay(70)
  }
  throw new Error(`Timed out: ${expression}`)
}
async function check(expression, label) {
  assert.equal(await evaluate(expression), true, label)
  console.log(`PASS ${label}`)
}
async function click(text) {
  await evaluate(`(() => {
    const root = document.querySelector('[role=dialog]') || document;
    const button = [...root.querySelectorAll('button')].find(b => b.getClientRects().length && b.textContent.trim() === ${JSON.stringify(text)});
    if (!button || button.disabled) throw Error('Missing or disabled button: '+${JSON.stringify(text)});
    button.click();
  })()`)
  await delay(70)
}
async function select(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
  await delay(70)
}
async function fill(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    if (!input || input.disabled || input.readOnly) throw Error('Unavailable input: '+${JSON.stringify(selector)});
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, ${JSON.stringify(value)});
    input.dispatchEvent(new Event('input', {bubbles:true}));
  })()`)
  await delay(70)
}
async function setWidth(width) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 800 ? 760 : 1100,
    deviceScaleFactor: 1,
    mobile: width < 800,
  })
  await delay(70)
}
const screens = new Set()
async function ready(selector) {
  await waitFor(
    `document.querySelector('main')?.getAttribute('aria-busy') === 'false' && !!document.querySelector(${JSON.stringify(selector)})`,
  )
  await delay(70)
  if (screens.has(selector)) return
  screens.add(selector)
  for (const width of [320, 375, 390, 1440]) {
    await setWidth(width)
    await check(
      "document.documentElement.scrollWidth <= innerWidth",
      `${selector} at ${width}px has no page overflow`,
    )
    if (selector === ".booking-store-bar" && width < 800) {
      await check(
        "document.querySelector('.action-bar').getBoundingClientRect().bottom <= document.querySelector('.mobile-nav').getBoundingClientRect().top + 1",
        "Home payment CTA sits above tabs without overlap",
      )
    }
  }
  await setWidth(375)
}
async function failNext() {
  await evaluate("document.querySelector('.demo-controls').open = true")
  await select(".demo-controls input")
}
async function setOffline(offline) {
  await command("Network.emulateNetworkConditions", {
    offline,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
}

try {
  await command("Runtime.enable")
  await command("Page.enable")
  await command("Network.enable")
  await command("Network.setCacheDisabled", { cacheDisabled: true })
  await setOffline(false)
  await setWidth(375)
  await command("Page.navigate", { url: "about:blank" })
  await waitFor(
    "location.href==='about:blank' && !document.querySelector('main')",
  )
  await command("Page.navigate", { url: appUrl.href })
  await ready(".booking-store-bar")
  await evaluate("document.fonts.ready.then(()=>true)")
  await check(
    "document.querySelectorAll('main > .panel').length === 3 && !document.querySelector('.quick-links, .stepper, .hero')",
    "Home directly contains pet, date and room selection",
  )
  await check(
    "document.querySelector('.action-summary strong').textContent==='¥240.00'",
    "Default booking remains ¥240",
  )
  await check(
    "document.querySelector('.pet-select.selected').textContent.includes('柯基 · 公 · 3岁 · 12kg')",
    "Home pet cards include requested details",
  )
  await check(
    "JSON.stringify([...document.querySelectorAll('.mobile-nav button span')].map(e=>e.textContent))===JSON.stringify(['首页','我的预约','我的'])",
    "Exactly three requested primary tabs",
  )
  await click("门店地址")
  await check(
    "document.querySelector('.modal-copy').textContent.includes('毛球路')",
    "Store address opens",
  )
  await click("我知道了")
  await click("我的")
  await ready(".profile-stats")
  await check(
    "JSON.stringify([...document.querySelectorAll('.profile-stats b')].map(e=>e.textContent))===JSON.stringify(['1','1','2','3'])",
    "Stats stay consistent with the same source orders",
  )
  await check(
    "document.querySelectorAll('.settings-list > button').length===5 && document.body.innerText.includes('账号与安全')",
    "Profile includes account/security and About",
  )
  await click("关于我们")
  await check(
    "document.querySelector('.modal-copy').textContent.includes('v1.0.0')",
    "About has version and contact information",
  )
  await click("我知道了")
  await select(".profile-stats button:last-child")
  await ready(".order-list")
  await check(
    "document.querySelectorAll('.order-card').length===3",
    "Cumulative count includes only boarding and completed",
  )
  await click("首页")
  await ready(".booking-store-bar")
  await select(".compact-rooms button:nth-child(3)")
  await check(
    "document.querySelector('.action-summary strong').textContent==='¥360.00'",
    "Room changes update the home estimate",
  )
  await select(".compact-rooms button:nth-child(2)")
  await fill(".date-fields label:last-child input", "2026-11-10")
  await check(
    "document.querySelector('.action-summary strong').textContent==='¥80.00'",
    "Same-date stay is one billed day",
  )
  await fill(".date-fields label:last-child input", "2026-11-09")
  await check(
    "document.querySelector('.action-bar button').disabled",
    "Reversed dates cannot proceed",
  )
  await fill(".date-fields label:last-child input", "2026-11-13")
  await click("确认订单并支付")
  await ready(".checkout-info")
  await check(
    "document.querySelector('.page-heading h1').textContent==='确认并支付' && !!document.querySelector('.payment-method') && !!document.querySelector('textarea')",
    "Confirmation, payment method and note share one screen",
  )
  await check(
    "document.querySelector('.total-row strong').textContent==='¥240.00'",
    "Combined checkout matches home amount",
  )
  await check(
    "!document.querySelector('.consent-row input').checked && document.querySelector('.action-bar button').disabled",
    "Service agreement is explicitly required",
  )
  await click("《寄养服务协议》")
  await check(
    "document.querySelectorAll('[role=tab]').length===3 && document.querySelector('[role=tabpanel]').textContent.includes('按晚')",
    "Combined policy reader remains functional",
  )
  await click("隐私政策")
  await check(
    "document.querySelector('[role=tabpanel]').textContent.includes('内存')",
    "Policy tab switches content",
  )
  await click("我知道了")
  await fill("textarea", "怕生，请温柔陪伴")
  await select(".consent-row input")
  await failNext()
  await evaluate(
    "(()=>{const b=document.querySelector('.action-bar button');b.click();b.click();b.click()})()",
  )
  await check(
    "!!document.querySelector('.spinner')",
    "Payment immediately enters guarded loading state",
  )
  await waitFor(
    "!!document.querySelector('.inline-error') && !document.querySelector('.spinner')",
  )
  await check(
    "document.querySelector('textarea').value==='怕生，请温柔陪伴' && document.querySelector('textarea').readOnly",
    "Failed payment preserves created order and immutable note",
  )
  await select(".back-button")
  await ready(".order-list")
  await click("全部")
  await check(
    "document.querySelectorAll('.order-card').length===5 && document.querySelector('.order-card:first-child').textContent.includes('未支付')",
    "Rapid clicks and payment failure create only one unpaid order",
  )
  await click("首页")
  await ready(".booking-store-bar")
  await select(".compact-rooms button:nth-child(3)")
  await click("我的预约")
  await ready(".order-list")
  await select(".order-card:first-child .order-actions .button:last-child")
  await ready(".checkout-info")
  await check(
    "document.querySelector('.total-row strong').textContent==='¥240.00'",
    "Resume payment uses original order, not the changed home draft",
  )
  await select(".consent-row input")
  await failNext()
  await click("确认支付")
  await waitFor(
    "!!document.querySelector('.inline-error') && !document.querySelector('.spinner')",
  )
  await select(".consent-row input")
  await check(
    "document.querySelector('.inline-error button').disabled",
    "Unchecking consent also disables retry",
  )
  await select(".consent-row input")
  await click("重试")
  await ready(".payment-result")
  await check(
    "document.querySelector('.payment-result h2').textContent==='支付成功' && document.querySelector('.payment-result strong').textContent==='¥240.00'",
    "Payment has an independent success screen",
  )
  await check(
    "document.querySelector('.result-tip').textContent.includes('未产生真实扣款') && !document.body.innerText.includes('沙箱')",
    "Result clearly states simulated payment",
  )
  await click("查看我的预约")
  await ready(".order-list")
  await check(
    "document.querySelectorAll('.order-card').length===5 && document.querySelector('.order-card:first-child').textContent.includes('已支付')",
    "Successful retry never creates a second order",
  )
  await select(".order-card:first-child .order-pet")
  await ready(".status-panel")
  await check(
    "document.querySelectorAll('.info-grid > div').length===7 && document.body.innerText.includes('怕生，请温柔陪伴')",
    "Detail contains all seven order fields and saved note",
  )
  await click("取消预约")
  await select(".modal-overlay")
  await check(
    "!!document.querySelector('[role=dialog]')",
    "Cancellation cannot be dismissed by backdrop",
  )
  await click("继续核对退款")
  await check(
    "document.querySelector('.modal-copy').textContent.includes('¥240.00')",
    "Refund confirmation uses paid amount",
  )
  await click("确认取消并退款")
  await ready(".order-list")
  await check(
    "document.querySelector('.order-card:first-child').classList.contains('border-gray')",
    "Cancelled paid order returns gray with refund status",
  )
  await select(".order-card:nth-child(2) .order-actions .button:last-child")
  await ready(".checkout-info")
  await evaluate("document.querySelector('.demo-controls').open=true")
  await click("演示支付超时")
  await check(
    "document.querySelector('.action-bar').textContent.includes('订单已关闭') && ![...document.querySelectorAll('.action-bar button')].some(b=>b.textContent==='确认支付')",
    "Expired existing order cannot be paid",
  )
  await click("订单已关闭，重新预约")
  await ready(".booking-store-bar")
  await select(".compact-rooms button:nth-child(2)")
  await click("确认订单并支付")
  await ready(".checkout-info")
  await select(".consent-row input")
  await failNext()
  await click("确认支付")
  await waitFor(
    "!!document.querySelector('.inline-error') && !document.querySelector('.spinner')",
  )
  await select(".back-button")
  await ready(".order-list")
  await select(".order-card:first-child .order-actions .button:first-child")
  await check(
    "document.querySelector('.modal-copy').textContent.includes('不涉及退款')",
    "Unpaid cancellation has its own message",
  )
  await click("确认取消")
  await waitFor(
    "document.querySelector('main').getAttribute('aria-busy')==='false' && !document.querySelector('.modal')",
  )
  await fill("input[type=search]", "不存在的宠物")
  await check(
    "document.querySelector('.empty-state h3').textContent==='没有找到相关预约'",
    "No-results search state",
  )
  await click("清除搜索")
  await click("我的")
  await ready(".profile-stats")
  await click("我的宠物")
  await ready(".pet-profile")
  await check(
    "document.querySelector('.pet-profile').textContent.includes('狂犬疫苗 2026-03') && document.querySelectorAll('.pet-profile').length===2",
    "Pet cards show vaccine month from stored text",
  )
  await evaluate(
    "document.querySelectorAll('.pet-profile .text-link')[1].click()",
  )
  await ready(".form-grid")
  await check(
    "document.querySelector('#pet-name').disabled && document.querySelector('.pet-delete button').disabled && !document.querySelector('input[type=file]')",
    "Active pets keep identity/delete protection and no unsupported upload",
  )
  await fill("#pet-note", "新增照护备注")
  await select(".back-button")
  await check(
    "document.querySelector('#modal-title').textContent==='离开前保存一下？'",
    "Unsaved pet form is protected",
  )
  await click("继续编辑")
  await click("保 存")
  await ready(".pet-profile")
  await check(
    "document.body.innerText.includes('新增照护备注')",
    "Allowed pet notes can be updated",
  )
  await click("新增宠物")
  await ready(".form-grid")
  await check(
    "document.querySelector('.action-bar button').disabled",
    "Incomplete pet form cannot save",
  )
  await fill("#pet-name", "奶糖")
  await fill("#pet-breed", "比熊")
  await fill("#pet-age", "0")
  await fill("#pet-weight", "3.5")
  await select('[role="switch"]')
  await fill(
    '.vaccine-fields input[placeholder="如：狂犬疫苗、猫三联"]',
    "狂犬疫苗",
  )
  await fill("#pet-vaccine", "2099-01-01")
  await evaluate(
    "document.getElementById('pet-vaccine').focus();document.getElementById('pet-vaccine').blur()",
  )
  await waitFor(
    "document.getElementById('error-vaccine')?.textContent.includes('晚于今天')",
  )
  await check(
    "!!document.getElementById('error-vaccine') && document.querySelector('.action-bar button').disabled",
    "Vaccine date validation is inline",
  )
  await fill("#pet-vaccine", "2026-03-01")
  await evaluate(
    "document.getElementById('pet-vaccine').focus();document.getElementById('pet-vaccine').blur()",
  )
  await click("保 存")
  await ready(".pet-profile")
  await check(
    "document.querySelectorAll('.pet-profile').length===3",
    "Pet creation succeeds",
  )
  await select(".pet-profile:last-of-type .text-link")
  await ready(".form-grid")
  await check(
    "!document.querySelector('.pet-delete button').disabled",
    "Pet without active reservations can be deleted",
  )
  await click("删除宠物档案")
  await click("确认删除")
  await ready(".pet-profile")
  await select(".back-button")
  await ready(".profile-stats")
  await click("首页")
  await ready(".booking-store-bar")
  await click("新增宠物")
  await ready(".form-grid")
  await fill("#pet-name", "小白")
  await fill("#pet-breed", "比熊")
  await fill("#pet-age", "1")
  await fill("#pet-weight", "4.5")
  await click("保 存")
  await ready(".booking-store-bar")
  await check(
    "document.querySelector('.pet-select.selected b').textContent==='小白' && document.querySelector('.action-bar button').disabled",
    "Home-created pet is selected; unvaccinated pet cannot book",
  )
  await click("我的")
  await ready(".profile-stats")
  await click("退出登录")
  await click("退出登录")
  await ready(".booking-store-bar")
  await check(
    "!!document.querySelector('.empty-state') && document.querySelector('.action-bar button').disabled",
    "Logged-out home has safe empty booking state",
  )
  await click("我的")
  await ready(".login-form")
  await check(
    "!document.querySelector('.consent-row input').checked",
    "Login consent remains explicit and initially unchecked",
  )
  await click("忘记密码？")
  await check(
    "document.querySelector('.modal a').getAttribute('href')==='tel:4000806060'",
    "Password reset directs to store contact",
  )
  await click("我知道了")
  await fill("#login-phone", "13812348888")
  await fill("#login-password", "demo123")
  await select('[aria-label="显示密码"]')
  await check(
    "document.querySelector('#login-password').type==='text'",
    "Password can be revealed",
  )
  await select(".consent-row input")
  for (let i = 0; i < 3; i++) {
    await failNext()
    await click("登 录")
    await waitFor(
      "!!document.querySelector('.inline-error') && !document.querySelector('.spinner')",
    )
  }
  await check(
    "document.body.innerText.includes('还可尝试2次')",
    "Repeated failure warning is preserved",
  )
  await click("重试")
  await ready(".profile-stats")
  await check(
    "document.querySelector('.page-heading h1').textContent==='个人中心'",
    "Login returns to protected source page",
  )
  await click("我的宠物")
  await ready(".pet-profile")
  await check(
    "document.querySelectorAll('.pet-profile').length===2 && !document.body.innerText.includes('小白')",
    "Logout cleared the previous session",
  )
  await evaluate("document.querySelector('.demo-controls').open=true")
  await click("展示无宠物")
  await check(
    "document.querySelector('.empty-state h3').textContent==='还没有毛孩子的档案'",
    "Pet empty state",
  )
  await select(".back-button")
  await ready(".profile-stats")
  await click("我的预约")
  await ready(".order-list")
  await evaluate("document.querySelector('.demo-controls').open=true")
  await click("展示无预约")
  await check(
    "document.querySelector('.empty-state h3').textContent==='这里还没有预约'",
    "Order empty state",
  )
  await click("新增预约")
  await ready(".booking-store-bar")
  await setOffline(true)
  await waitFor("!!document.querySelector('.offline-banner')")
  await click("我的预约")
  await ready(".empty-state")
  await check(
    "document.querySelector('.empty-state h3').textContent==='暂时无法打开页面'",
    "Offline page loading offers retry",
  )
  await setOffline(false)
  await click("重新加载")
  await ready(".order-list")
  await click("首页")
  await ready(".booking-store-bar")
  await check(
    "document.querySelector('.date-fields input').value==='2026-11-10'",
    "Booking dates survive navigation and network retry",
  )
  assert.deepEqual(exceptions, [])
  console.log("PASS All 9 screens and merged booking/payment flows")
} finally {
  await setOffline(false)
  socket.close()
}
