export type Pet = {
  id: number
  name: string
  breed: string
  sex: string
  age: string
  weight: string
  color: string
  vaccine: string
  note: string
}

export type Order = {
  id: string
  petId: number
  pet: string
  room: number
  start: string
  end: string
  status: "待入店" | "寄养中" | "已完成" | "已取消"
  paid: boolean
  note: string
  createdAt: number
  expiresAt: number
  cancelReason?: string
}

export const rooms = [
  {
    name: "标准间",
    price: 60,
    desc: "自在小窝，舒适陪伴",
    size: "独立空间 · 基础照护",
  },
  {
    name: "舒适间",
    price: 80,
    desc: "多一点空间，多一份宠爱",
    size: "宽敞空间 · 贴心照护",
  },
  {
    name: "豪华间",
    price: 120,
    desc: "专属大空间，尽享自在",
    size: "独立套间 · 专属照护",
  },
]

function dateNumber(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const parsed = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(parsed) &&
    new Date(parsed).toISOString().slice(0, 10) === value
    ? parsed
    : NaN
}

// Cross-date stays use nights; same-date stays have a one-day minimum.
export function calcDays(start: string, end: string) {
  const from = dateNumber(start)
  const to = dateNumber(end)
  return Number.isFinite(from) && Number.isFinite(to) && to >= from
    ? Math.max(1, Math.round((to - from) / 86400000))
    : 0
}

export function stayLabel(start: string, end: string) {
  const count = calcDays(start, end)
  return count ? `${count}${start === end ? "天" : "晚"}` : "—"
}

export function vaccineDetails(value: string) {
  if (value === "已接种") return { vaccinated: true, name: "", date: "" }
  try {
    const parsed = JSON.parse(value)
    if (parsed && parsed.status === "已接种")
      return {
        vaccinated: true,
        name: typeof parsed.name === "string" ? parsed.name : "",
        date: typeof parsed.date === "string" ? parsed.date : "",
      }
  } catch {
    /* Legacy records may contain a plain status string. */
  }
  return { vaccinated: false, name: "", date: "" }
}

export function vaccineText(name: string, date: string) {
  return JSON.stringify({ status: "已接种", name: name.trim(), date })
}

export function totalFee(order: Pick<Order, "start" | "end" | "room">) {
  return calcDays(order.start, order.end) * (rooms[order.room]?.price || 0)
}

export function isActiveOrder(order: Order) {
  return order.status === "待入店" || order.status === "寄养中"
}

export function hasActiveOrder(petId: number, orders: Order[]) {
  return orders.some((order) => order.petId === petId && isActiveOrder(order))
}

export function matchesFilter(order: Order, filter: string) {
  if (filter === "全部") return true
  if (filter === "待支付") return order.status === "待入店" && !order.paid
  if (filter === "累计寄养")
    return order.status === "寄养中" || order.status === "已完成"
  return order.status === filter
}

export function expireOrders(orders: Order[], now: number) {
  return orders.map((order) =>
    order.status === "待入店" && !order.paid && order.expiresAt <= now
      ? {
          ...order,
          status: "已取消" as const,
          cancelReason: "支付超时，订单已自动关闭",
        }
      : order,
  )
}

export function countdown(expiresAt: number, now: number) {
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`
}

export function validatePet(pet: Pet): Partial<Record<keyof Pet, string>> {
  const errors: Partial<Record<keyof Pet, string>> = {}
  if (!pet.name.trim() || pet.name.trim().length > 20)
    errors.name = "请填写1–20字的宠物昵称"
  if (!pet.breed.trim() || pet.breed.trim().length > 30)
    errors.breed = "请填写1–30字的品种"
  if (
    !pet.age ||
    !Number.isInteger(Number(pet.age)) ||
    Number(pet.age) < 0 ||
    Number(pet.age) > 40
  )
    errors.age = "请填写0–40之间的整数年龄"
  if (
    !pet.weight ||
    !/^\d+(\.\d)?$/.test(pet.weight) ||
    Number(pet.weight) < 0.1 ||
    Number(pet.weight) > 150
  )
    errors.weight = "请填写0.1–150kg，保留最多1位小数"
  if (pet.note.length > 255) errors.note = "备注最多255字"
  const vaccine = vaccineDetails(pet.vaccine)
  if (pet.vaccine.length > 255 || vaccine.name.length > 40)
    errors.vaccine = "疫苗名最多40字，接种记录最多255字"
  if (
    vaccine.date &&
    (!Number.isFinite(dateNumber(vaccine.date)) ||
      dateNumber(vaccine.date) > Date.now())
  )
    errors.vaccine = "接种日期无效或晚于今天，请核对"
  return errors
}

export const initialPets: Pet[] = [
  {
    id: 1,
    name: "豆豆",
    breed: "柯基",
    sex: "公",
    age: "3",
    weight: "12",
    color: "黄白",
    vaccine: vaccineText("狂犬疫苗", "2026-03-01"),
    note: "温顺，喜欢散步",
  },
  {
    id: 2,
    name: "团子",
    breed: "布偶猫",
    sex: "母",
    age: "2",
    weight: "4",
    color: "蓝白",
    vaccine: vaccineText("猫三联", "2026-05-01"),
    note: "粘人，需要温柔陪伴",
  },
]

export function createDemoOrders(now: number): Order[] {
  const common = {
    note: "",
    createdAt: now - 60000,
    expiresAt: now + 15 * 60000,
  }
  return [
    {
      ...common,
      id: "FO20261110001",
      petId: 1,
      pet: "豆豆",
      room: 1,
      start: "2026-11-10",
      end: "2026-11-13",
      status: "待入店",
      paid: false,
    },
    {
      ...common,
      id: "FO20261025002",
      petId: 2,
      pet: "团子",
      room: 2,
      start: "2026-10-25",
      end: "2026-11-05",
      status: "寄养中",
      paid: true,
    },
    {
      ...common,
      id: "FO20260918003",
      petId: 1,
      pet: "豆豆",
      room: 0,
      start: "2026-09-18",
      end: "2026-09-20",
      status: "已完成",
      paid: true,
    },
    {
      ...common,
      id: "FO20260910004",
      petId: 2,
      pet: "团子",
      room: 1,
      start: "2026-09-10",
      end: "2026-09-11",
      status: "已完成",
      paid: true,
    },
  ]
}
