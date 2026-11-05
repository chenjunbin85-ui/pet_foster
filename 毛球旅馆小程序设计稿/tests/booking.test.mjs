import assert from "node:assert/strict"
import test from "node:test"
import {
  calcDays,
  countdown,
  createDemoOrders,
  expireOrders,
  hasActiveOrder,
  initialPets,
  matchesFilter,
  totalFee,
  validatePet,
  stayLabel,
  vaccineDetails,
  vaccineText,
} from "../src/booking.ts"

test("跨日按晚：默认3晚240元；同日按1天", () => {
  assert.equal(calcDays("2026-11-10", "2026-11-13"), 3)
  assert.equal(
    totalFee({ start: "2026-11-10", end: "2026-11-13", room: 1 }),
    240,
  )
  assert.equal(calcDays("2026-11-10", "2026-11-10"), 1)
  assert.equal(calcDays("2026-12-31", "2027-01-01"), 1)
  assert.equal(calcDays("2028-02-28", "2028-03-01"), 2)
  assert.equal(stayLabel("2026-11-10", "2026-11-13"), "3晚")
  assert.equal(stayLabel("2026-11-10", "2026-11-10"), "1天")
})

test("疫苗记录使用单个文本字段，兼容旧状态且不将JSON显示到卡片", () => {
  assert.deepEqual(vaccineDetails("已接种"), {
    vaccinated: true,
    name: "",
    date: "",
  })
  assert.equal(vaccineDetails("未接种").vaccinated, false)
  assert.equal(vaccineDetails("null").vaccinated, false)
  const vaccine = vaccineText("狂犬疫苗", "2026-03-01")
  assert.ok(vaccine.length <= 255)
  assert.deepEqual(vaccineDetails(vaccine), {
    vaccinated: true,
    name: "狂犬疫苗",
    date: "2026-03-01",
  })
  assert.deepEqual(validatePet({ ...initialPets[0], vaccine }), {})
  assert.ok(
    validatePet({
      ...initialPets[0],
      vaccine: vaccineText("狂犬", "2099-01-01"),
    }).vaccine,
  )
})

test("无效、空、倒置或非DATE输入不可计费", () => {
  for (const [from, to] of [
    ["", ""],
    ["2026-11-13", "2026-11-10"],
    ["2026-02-30", "2026-03-04"],
    ["2026-11-10T10:00", "2026-11-13"],
  ])
    assert.equal(calcDays(from, to), 0)
  assert.equal(
    totalFee({ start: "2026-11-10", end: "2026-11-13", room: 99 }),
    0,
  )
})

test("累计寄养仅包含寄养中与已完成，卡片与统计同源", () => {
  const orders = createDemoOrders(1000000)
  assert.equal(orders.filter((o) => matchesFilter(o, "待入店")).length, 1)
  assert.equal(orders.filter((o) => matchesFilter(o, "寄养中")).length, 1)
  assert.equal(orders.filter((o) => matchesFilter(o, "已完成")).length, 2)
  assert.equal(orders.filter((o) => matchesFilter(o, "累计寄养")).length, 3)
  assert.equal(orders.filter((o) => matchesFilter(o, "待支付")).length, 1)
  assert.equal(totalFee(orders[1]), 1320)
  assert.equal(totalFee(orders[2]), 120)
})

test("超时仅关闭未支付待入店单，付款后不可被计时器关闭", () => {
  const now = 1000000
  const orders = createDemoOrders(now)
  const expired = expireOrders(orders, now + 15 * 60000)
  assert.equal(expired[0].status, "已取消")
  assert.equal(expired[1].status, "寄养中")
  assert.equal(
    expireOrders([{ ...orders[0], paid: true }], now + 20 * 60000)[0].status,
    "待入店",
  )
  assert.equal(orders[0].status, "待入店")
  assert.equal(countdown(now + 15 * 60000, now), "15:00")
  assert.equal(countdown(now - 1, now), "00:00")
})

test("进行中预约锁定宠物关键信息，历史预约不阻止删除", () => {
  const orders = createDemoOrders(1000000)
  assert.equal(hasActiveOrder(1, orders), true)
  assert.equal(hasActiveOrder(2, orders), true)
  assert.equal(
    hasActiveOrder(
      1,
      orders.filter((o) => o.status === "已完成"),
    ),
    false,
  )
  assert.equal(hasActiveOrder(999, orders), false)
})

test("宠物字段校验与页面禁用条件一致", () => {
  assert.deepEqual(validatePet(initialPets[0]), {})
  const errors = validatePet({
    ...initialPets[0],
    name: " ",
    breed: "",
    age: "0.5",
    weight: "4.25",
    note: "x".repeat(256),
  })
  assert.deepEqual(Object.keys(errors), [
    "name",
    "breed",
    "age",
    "weight",
    "note",
  ])
  assert.deepEqual(
    validatePet({ ...initialPets[0], age: "0", weight: "0.1" }),
    {},
  )
})
