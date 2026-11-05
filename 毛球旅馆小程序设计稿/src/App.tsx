import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Button,
  Dialog,
  Icon,
  InfoRows,
  PetAvatar,
  RoomIcon,
  SectionTitle,
  Skeleton,
  type IconName,
} from "./ui"
import {
  calcDays,
  countdown,
  createDemoOrders,
  expireOrders,
  hasActiveOrder,
  initialPets,
  matchesFilter,
  rooms,
  totalFee,
  stayLabel,
  vaccineDetails,
  vaccineText,
  validatePet,
  type Order,
  type Pet,
} from "./booking"

type Page = "home" | "login" | "checkout" | "payment" | "result" | "orders" | "detail" | "pets" | "editPet" | "profile"
type Modal = {
  title: string
  text: string
  kind?: "contact" | "cancel" | "refund" | "logout" | "profile" | "delete" | "discard" | "policy" | "petPicker"
  destination?: Page
}
const titles: Record<Page, string> = {
  home: "立即预订",
  login: "欢迎回来",
  checkout: "确认订单",
  payment: "在线支付",
  result: "支付结果",
  orders: "历史订单",
  detail: "订单详情",
  pets: "我的宠物",
  editPet: "新增宠物",
  profile: "个人中心",
}
const emptyPet = (): Pet => ({
  id: 0,
  name: "",
  breed: "",
  sex: "公",
  age: "",
  weight: "",
  color: "",
  vaccine: "未接种",
  note: "",
})
const navs = [
  { page: "home", icon: "home", label: "首页" },
  { page: "orders", icon: "orders", label: "历史订单" },
  { page: "pets", icon: "paw", label: "我的宠物" },
  { page: "profile", icon: "user", label: "个人中心" },
] as const
const money = (order: Pick<Order, "room" | "start" | "end">) =>
  `¥${totalFee(order).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
const timeText = (time: number) =>
  new Date(time).toLocaleString("zh-CN", {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
const statusClass = (status: string) =>
  status === "寄养中"
    ? "blue"
    : status === "已完成"
      ? "green"
      : status === "已取消"
        ? "gray"
        : "orange"
const storeAddress = "杭州市西湖区毛球路 16 号（演示地址）"
const showDemoControls =
  new URLSearchParams(window.location.search).get("demo") === "1"
const policyTabs = ["用户协议", "隐私政策", "寄养服务协议"] as const
const policies = {
  用户协议: "当前为毛球旅馆交互演示，不提供真实账户、床位预订或支付。请勿填写真实密码或敏感个人信息。正式服务条款须在接入业务前审核并单独确认。",
  隐私政策: "手机号、宠物资料和订单只保存在当前页面内存中，不传输至后台、不写入本地存储；退出登录或刷新后清除。疫苗名与日期为选填信息，仅用于照护核验。",
  寄养服务协议:
    "跨天寄养按晚计费：离店日期减入住日期；同日寄养按1天计费。11-10入住、11-13离店为3晚，舒适间¥80×3=¥240。含每日喂养、基础照护与清洁，无押金，不含医疗及另行协商服务。入住须携带有效免疫证明。演示支付及退款不产生真实资金流转。",
}

export default function App() {
  const [page, setPage] = useState<Page>("home")
  const [loggedIn, setLoggedIn] = useState(true)
  const [redirect, setRedirect] = useState<Page>("profile")
  const [pets, setPets] = useState<Pet[]>(initialPets)
  const [petPhotos, setPetPhotos] = useState<Record<number, string>>({})
  const [draftPhoto, setDraftPhoto] = useState("")
  const originalPhoto = useRef("")
  const photoReader = useRef<FileReader | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState("")
  const [orders, setOrders] = useState<Order[]>(() =>
    createDemoOrders(Date.now()),
  )
  const [petId, setPetId] = useState(1)
  const [room, setRoom] = useState(1)
  const [start, setStart] = useState("2026-11-10")
  const [end, setEnd] = useState("2026-11-13")
  const [note, setNote] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [loginAgreed, setLoginAgreed] = useState(false)
  const [filter, setFilter] = useState("全部")
  const [historyLimit, setHistoryLimit] = useState(3)
  const [selectedOrder, setSelectedOrder] = useState("FO20261110001")
  const [modal, setModal] = useState<Modal | null>(null)
  const [policyTab, setPolicyTab] =
    useState<"用户协议" | "隐私政策" | "寄养服务协议">("用户协议")
  const closeModal = useCallback(() => setModal(null), [])
  const [toast, setToast] = useState("")
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [draft, setDraft] = useState<Pet>(emptyPet)
  const draftOriginal = useRef(JSON.stringify(emptyPet()))
  const petOperationId = useRef(crypto.randomUUID())
  const [petErrors, setPetErrors] =
    useState<Partial<Record<keyof Pet, string>>>({})
  const [nickname, setNickname] = useState("爱宠家长")
  const [profileDraft, setProfileDraft] = useState(nickname)
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [loginErrors, setLoginErrors] = useState({ phone: "", password: "" })
  const [loginFailures, setLoginFailures] = useState(0)
  const [returnToBooking, setReturnToBooking] = useState(false)
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null)
  const checkoutOrderRef = useRef<string | null>(null)
  const bookingAttemptRef = useRef(crypto.randomUUID())
  const [pending, setPending] = useState("")
  const pendingRef = useRef(false)
  const lastSuccess = useRef(new Map<string, number>())
  const [actionError, setActionError] = useState("")
  const retryAction = useRef<(() => void) | null>(null)
  const [viewState, setViewState] = useState<"ready" | "loading" | "error">(
    "loading",
  )
  const [reloadKey, setReloadKey] = useState(0)
  const [simulateFailure, setSimulateFailure] = useState(false)
  const failureRef = useRef(false)
  const [now, setNow] = useState(Date.now())
  const [online, setOnline] = useState(navigator.onLine)
  const [search, setSearch] = useState("")
  const chosenPet = pets.find((p) => p.id === petId)
  const activeOrder = orders.find((o) => o.id === selectedOrder)
  const checkoutOrder = orders.find((o) => o.id === checkoutOrderId)
  const days = calcDays(start, end)
  const total = totalFee({ start, end, room })
  const bookingReason = !chosenPet
    ? "请先选择或新增宠物"
    : !vaccineDetails(chosenPet.vaccine).vaccinated
      ? "未接种疫苗暂不可预约，请先完善免疫信息"
      : !days
        ? "请选择有效日期，离店不能早于入住"
        : ""
  const petLocked = !!draft.id && hasActiveOrder(draft.id, orders)
  const dirty =
    page === "editPet" && (JSON.stringify(draft) !== draftOriginal.current || draftPhoto !== originalPhoto.current || photoLoading)
  const tabPage = ["home", "orders", "profile"].includes(page)
  const activeNav = ["checkout", "payment", "result"].includes(page)
    ? "home"
    : page === "detail"
      ? "orders"
      : page === "editPet"
        ? "pets"
        : page

  useEffect(() => {
    const timer = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      setOrders((current) =>
        current.some(
          (o) => o.status === "待入店" && !o.paid && o.expiresAt <= time,
        )
          ? expireOrders(current, time)
          : current,
      )
    }, 1000)
    const connection = () => setOnline(navigator.onLine)
    window.addEventListener("online", connection)
    window.addEventListener("offline", connection)
    return () => {
      clearInterval(timer)
      window.removeEventListener("online", connection)
      window.removeEventListener("offline", connection)
      if (toastTimer.current) clearTimeout(toastTimer.current)
      photoReader.current?.abort()
    }
  }, [])

  useEffect(() => {
    setViewState("loading")
    const timer = window.setTimeout(
      () => setViewState(navigator.onLine ? "ready" : "error"),
      320,
    )
    return () => clearTimeout(timer)
  }, [page, reloadKey])

  useEffect(() => {
    if (!dirty) return
    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", prevent)
    return () => window.removeEventListener("beforeunload", prevent)
  }, [dirty])

  useEffect(() => {
    const viewport = window.visualViewport
    const resize = () =>
      document.documentElement.style.setProperty(
        "--keyboard-lift",
        `${Math.max(0, window.innerHeight - (viewport?.height || window.innerHeight) - (viewport?.offsetTop || 0))}px`,
      )
    viewport?.addEventListener("resize", resize)
    viewport?.addEventListener("scroll", resize)
    return () => {
      viewport?.removeEventListener("resize", resize)
      viewport?.removeEventListener("scroll", resize)
      document.documentElement.style.removeProperty("--keyboard-lift")
    }
  }, [])

  function notify(text: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(text)
    toastTimer.current = setTimeout(() => setToast(""), 3500)
  }
  function navigate(next: Page) {
    setActionError("")
    retryAction.current = null
    if (next !== page) setViewState("loading")
    setPage(next)
    window.scrollTo({ top: 0, behavior: "instant" })
  }
  function go(next: Page) {
    if (pendingRef.current) return
    if (dirty && next !== "editPet") {
      setModal({
        title: "离开前保存一下？",
        text: "还有未保存的宠物资料，离开后本次修改将丢失。",
        kind: "discard",
        destination: next,
      })
      return
    }
    if (!loggedIn && !["home", "login"].includes(next)) {
      setRedirect(next)
      navigate("login")
      return
    }
    if (
      page === "payment" &&
      checkoutOrder &&
      !checkoutOrder.paid &&
      checkoutOrder.status === "待入店" &&
      next !== "payment"
    )
      notify("尚未支付，可在“历史订单”中继续支付")
    navigate(next)
  }
  function showInfo(title: string, text: string) {
    setModal({ title, text })
  }
  function contact() {
    setModal({
      title: "联系门店",
      text: "忘记密码或遇到问题，请到店或致电门店客服协助处理。\n每日 09:00–21:00 为您服务。\n下方电话为演示号码，正式上线前需替换。",
      kind: "contact",
    })
  }
  async function runAction(
    key: string,
    action: () => void,
    onFailure?: () => void,
  ) {
    if (
      pendingRef.current ||
      Date.now() - (lastSuccess.current.get(key) || 0) < 5000
    )
      return
    pendingRef.current = true
    setPending(key)
    setActionError("")
    retryAction.current = () => {
      void runAction(key, action, onFailure)
    }
    try {
      await new Promise((resolve) => setTimeout(resolve, 750))
      if (!navigator.onLine)
        throw new Error("网络已断开，请检查连接后重试。未提交任何数据。")
      if (failureRef.current) {
        failureRef.current = false
        setSimulateFailure(false)
        throw new Error("本次操作未完成（模拟服务超时），你的填写内容已保留。")
      }
      action()
      lastSuccess.current.set(key, Date.now())
    } catch (error) {
      onFailure?.()
      setActionError(
        error instanceof Error ? error.message : "操作未完成，请重试。",
      )
    } finally {
      pendingRef.current = false
      setPending("")
    }
  }
  function newPet(fromBooking = false) {
    photoReader.current?.abort()
    photoReader.current = null
    setDraftPhoto("")
    originalPhoto.current = ""
    setPhotoError("")
    setPhotoLoading(false)
    setReturnToBooking(fromBooking)
    petOperationId.current = crypto.randomUUID()
    const pet = emptyPet()
    setDraft(pet)
    draftOriginal.current = JSON.stringify(pet)
    setPetErrors({})
    go("editPet")
  }
  function editPet(pet: Pet) {
    photoReader.current?.abort()
    photoReader.current = null
    setDraftPhoto(petPhotos[pet.id] || "")
    originalPhoto.current = petPhotos[pet.id] || ""
    setPhotoError("")
    setPhotoLoading(false)
    setReturnToBooking(false)
    petOperationId.current = crypto.randomUUID()
    setDraft({ ...pet })
    draftOriginal.current = JSON.stringify(pet)
    setPetErrors({})
    go("editPet")
  }
  function previewPhoto(file?: File) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError("请选择5MB以内的JPG、PNG、WebP或GIF图片")
      return
    }
    photoReader.current?.abort()
    const reader = new FileReader()
    photoReader.current = reader
    setPhotoLoading(true)
    setPhotoError("")
    reader.onload = () => {
      if (photoReader.current !== reader) return
      const preview = String(reader.result)
      const image = new Image()
      image.onload = () => {
        if (photoReader.current !== reader) return
        setDraftPhoto(preview)
        setPhotoLoading(false)
        photoReader.current = null
      }
      image.onerror = () => {
        if (photoReader.current !== reader) return
        setPhotoError("图片无法识别，请重新选择")
        setPhotoLoading(false)
        photoReader.current = null
      }
      image.src = preview
    }
    reader.onerror = () => {
      if (photoReader.current !== reader) return
      setPhotoError("照片读取失败，请重新选择")
      setPhotoLoading(false)
      photoReader.current = null
    }
    reader.readAsDataURL(file)
  }
  function updateVaccine(value: string) {
    const next = { ...draft, vaccine: value }
    setDraft(next)
    setPetErrors((errors) => ({
      ...errors,
      vaccine: validatePet(next).vaccine,
    }))
  }
  function cancelOrder(order: Order) {
    setSelectedOrder(order.id)
    setModal({
      title: "确认取消订单？",
      text: order.paid
        ? `该订单已支付 ${money(order)}。取消后不可恢复；确认后将继续核对退款金额。`
        : "该订单尚未支付。取消后订单关闭，不可恢复；不涉及退款。",
      kind: "cancel",
    })
  }
  function enterCheckout(order?: Order) {
    if (!order && bookingReason) return
    const previous = orders.find((o) => o.id === checkoutOrderRef.current)
    const reusable =
      previous &&
      !previous.paid &&
      previous.status === "待入店" &&
      previous.petId === petId &&
      previous.room === room &&
      previous.start === start &&
      previous.end === end
        ? previous
        : undefined
    const target = order || reusable
    checkoutOrderRef.current = target?.id || null
    setCheckoutOrderId(target?.id || null)
    if (target) setSelectedOrder(target.id)
    setAgreed(false)
    if (!target) bookingAttemptRef.current = crypto.randomUUID()
    go(target ? "payment" : "checkout")
  }
  function savePet() {
    if (photoLoading) return
    const errors = validatePet(draft)
    setPetErrors(errors)
    if (Object.keys(errors).length) {
      const field = Object.keys(errors)[0]
      requestAnimationFrame(() => {
        const input = document.getElementById(`pet-${field}`)
        input?.scrollIntoView({ block: "center", behavior: "smooth" })
        input?.focus({ preventScroll: true })
      })
      return
    }
    void runAction(`pet-${petOperationId.current}`, () => {
      const saved = {
        ...draft,
        name: draft.name.trim(),
        breed: draft.breed.trim(),
        id: draft.id || Date.now(),
      }
      setPets((current) =>
        draft.id
          ? current.map((p) => (p.id === draft.id ? saved : p))
          : [...current, saved],
      )
      setPetPhotos(current => {
        const next = { ...current }
        if (draftPhoto) next[saved.id] = draftPhoto
        else delete next[saved.id]
        return next
      })
      originalPhoto.current = draftPhoto
      if (returnToBooking) setPetId(saved.id)
      draftOriginal.current = JSON.stringify(saved)
      notify("宠物档案已保存（演示）")
      navigate(returnToBooking ? "home" : "pets")
    })
  }
  function login() {
    const errors = {
      phone: /^1[3-9]\d{9}$/.test(phone) ? "" : "请输入有效的11位手机号",
      password: password.length >= 6 ? "" : "密码至少需要6位",
    }
    setLoginErrors(errors)
    if (errors.phone || errors.password || !loginAgreed || loginFailures >= 5)
      return
    void runAction(
      "login",
      () => {
        setLoggedIn(true)
        setPets(initialPets.map((p) => ({ ...p })))
        setPetPhotos({})
        setOrders(createDemoOrders(Date.now()))
        setPetId(1)
        setPassword("")
        setLoginFailures(0)
        notify("已进入演示账号，未连接真实登录服务")
        navigate(redirect)
      },
      () => setLoginFailures((count) => count + 1),
    )
  }
  function submitOrder() {
    if (pendingRef.current || !agreed || !online || bookingReason || !chosenPet) return
    const previous = orders.find(o => o.id === checkoutOrderRef.current)
    if (previous) { setSelectedOrder(previous.id); navigate("payment"); return }
    void runAction(`submit-${bookingAttemptRef.current}`, () => {
      const createdAt = Date.now()
      const order: Order = {
        id: `FO${createdAt}`,
        petId: chosenPet.id,
        pet: chosenPet.name,
        room,
        start,
        end,
        note,
        status: "待入店",
        paid: false,
        createdAt,
        expiresAt: createdAt + 15 * 60000,
      }
      checkoutOrderRef.current = order.id
      setCheckoutOrderId(order.id)
      setSelectedOrder(order.id)
      setOrders(current => [order, ...current])
      setFilter("全部")
      setSearch("")
      setHistoryLimit(3)
      setAgreed(false)
      navigate("payment")
    })
  }
  function payOrder() {
    if (pendingRef.current || !online) return
    const order = orders.find(o => o.id === checkoutOrderRef.current)
    if (!order) { notify("该订单已不可用，请返回历史订单"); return }
    if (order.paid || order.status !== "待入店") return
    const paymentOrder = order
    void runAction(`pay-${paymentOrder.id}`, () => {
      if (Date.now() >= paymentOrder.expiresAt)
        throw new Error("支付时间已结束，订单已关闭，请重新预约。")
      setOrders((current) =>
        current.map((o) =>
          o.id === paymentOrder.id && o.status === "待入店"
            ? { ...o, paid: true }
            : o,
        ),
      )
      setSelectedOrder(paymentOrder.id)
      setNote("")
      setAgreed(false)
      navigate("result")
    })
  }
  function actionFeedback() {
    return actionError ? (
      <div className="error-state inline-error" role="alert">
        <span>{actionError}</span>
        <button
          onClick={() =>
            page === "checkout" ? submitOrder() : page === "payment" ? payOrder() : retryAction.current?.()
          }
          disabled={!!pending || (page === "checkout" && !agreed)}
        >
          重试
        </button>
      </div>
    ) : null
  }
  function storeCard() {
    return (
      <div className="store-inline">
        <p>
          <Icon name="pin" size={16} />
          <span title={storeAddress}>{storeAddress}</span>
        </p>
        <div>
          <button className="text-link" onClick={contact}>
            电话
          </button>
          <a
            href={`https://uri.amap.com/search?keyword=${encodeURIComponent(storeAddress)}`}
            target="_blank"
            rel="noreferrer"
          >
            导航
          </a>
          <button
            className="text-link"
            onClick={() =>
              showInfo(
                "到店须知",
                `${storeAddress}\n建议10:00–18:00到店，请携带疫苗证明、常用粮和牵引用品。猫狗独立分区，不混住。\n营业时间：09:00–21:00；地址和电话均为演示资料。`,
              )
            }
          >
            到店须知
          </button>
        </div>
      </div>
    )
  }
  function policy(kind: "用户协议" | "隐私政策" | "寄养服务协议") {
    setPolicyTab(kind)
    setModal({ title: "协议与隐私", text: "", kind: "policy" })
  }
  function logout() {
    photoReader.current?.abort()
    photoReader.current = null
    setPetPhotos({})
    setDraftPhoto("")
    originalPhoto.current = ""
    setPhotoLoading(false)
    setPhotoError("")
    setLoggedIn(false)
    setPets([])
    setOrders([])
    setSelectedOrder("")
    setPhone("")
    setPassword("")
    setNickname("爱宠家长")
    setProfileDraft("")
    setDraft(emptyPet())
    draftOriginal.current = JSON.stringify(emptyPet())
    setNote("")
    setStart("2026-11-10")
    setEnd("2026-11-13")
    setRoom(1)
    setAgreed(false)
    setLoginAgreed(false)
    setLoginErrors({ phone: "", password: "" })
    setLoginFailures(0)
    setPasswordVisible(false)
    setPetId(0)
    setSearch("")
    setFilter("全部")
    setHistoryLimit(3)
    setCheckoutOrderId(null)
    checkoutOrderRef.current = null
    setReturnToBooking(false)
    setPetErrors({})
    setSimulateFailure(false)
    failureRef.current = false
    lastSuccess.current.clear()
    closeModal()
    navigate("home")
    notify("已退出演示账号，页面内个人数据已清除")
  }
  function confirmModal() {
    if (!modal) return
    if (modal.kind === "discard") {
      photoReader.current?.abort()
      photoReader.current = null
      setPhotoLoading(false)
      originalPhoto.current = draftPhoto
      draftOriginal.current = JSON.stringify(draft)
      closeModal()
      navigate(modal.destination || "pets")
      return
    }
    if (modal.kind === "logout") {
      logout()
      return
    }
    if (modal.kind === "profile") {
      if (!profileDraft.trim()) return
      setNickname(profileDraft.trim())
      closeModal()
      notify("昵称已更新")
      return
    }
    if (modal.kind === "cancel" && activeOrder?.paid) {
      setModal({
        title: "核对退款金额",
        text: `${money(activeOrder)} 将模拟原路退回。真实退款预计1–3个工作日到账；本次为演示退款，不发生真实资金变动。`,
        kind: "refund",
      })
      return
    }
    if ((modal.kind === "cancel" || modal.kind === "refund") && activeOrder) {
      closeModal()
      void runAction(`cancel-${activeOrder.id}`, () => {
        setOrders((current) =>
          current.map((o) =>
            o.id === activeOrder.id
              ? {
                  ...o,
                  status: "已取消",
                  cancelReason: o.paid
                    ? "用户取消，已模拟原路退款"
                    : "用户取消，未支付不涉及退款",
                }
              : o,
          ),
        )
        setFilter("全部")
        setSearch("")
        setHistoryLimit(Math.max(3, orders.findIndex(o => o.id === activeOrder.id) + 1))
        navigate("orders")
        notify(
          activeOrder.paid
            ? "预约已取消，金额已模拟退回"
            : "预约已取消，不涉及退款",
        )
      })
      return
    }
    if (modal.kind === "delete") {
      if (hasActiveOrder(draft.id, orders)) return
      closeModal()
      void runAction(`delete-${draft.id}`, () => {
        setPets((current) => current.filter((p) => p.id !== draft.id))
        setPetPhotos(current => { const next = { ...current }; delete next[draft.id]; return next })
        setDraftPhoto("")
        originalPhoto.current = ""
        if (petId === draft.id) setPetId(0)
        draftOriginal.current = JSON.stringify(draft)
        navigate("pets")
        notify("宠物档案已删除，历史订单保留原始信息")
      })
      return
    }
    closeModal()
  }

  function renderContent(): ReactNode {
    if (page === "login")
      return (
        <div className="login-page">
          <span className="login-logo">
            <Icon name="paw" size={38} />
          </span>
          <h2>毛球旅馆</h2>
          <p>宠物寄养 · 安心托管</p>
          <form
            className="panel login-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              login()
            }}
          >
            <label htmlFor="login-phone">
              手机号
              <input
                id="login-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value.replace(/\D/g, ""))
                  setLoginErrors((v) => ({ ...v, phone: "" }))
                }}
                onBlur={() =>
                  setLoginErrors((v) => ({
                    ...v,
                    phone:
                      phone && !/^1[3-9]\d{9}$/.test(phone)
                        ? "请输入有效的11位手机号"
                        : "",
                  }))
                }
                aria-invalid={!!loginErrors.phone}
                aria-describedby="phone-error"
              />
            </label>
            {loginErrors.phone && (
              <p className="field-error" id="phone-error">
                {loginErrors.phone}
              </p>
            )}
            <label htmlFor="login-password">
              密码
              <span className="password-field">
                <input
                  id="login-password"
                  type={passwordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setLoginErrors((v) => ({ ...v, password: "" }))
                  }}
                  onBlur={() =>
                    setLoginErrors((v) => ({
                      ...v,
                      password:
                        password && password.length < 6
                          ? "密码至少需要6位"
                          : "",
                    }))
                  }
                  aria-invalid={!!loginErrors.password}
                  aria-describedby="password-error"
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? "隐藏密码" : "显示密码"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((v) => !v)}
                >
                  <Icon name="eye" size={20} />
                </button>
              </span>
            </label>
            {loginErrors.password && (
              <p className="field-error" id="password-error">
                {loginErrors.password}
              </p>
            )}
            <button
              type="button"
              className="text-link forgot"
              onClick={contact}
            >
              忘记密码？
            </button>
            <div className="consent-row">
              <label>
                <input
                  type="checkbox"
                  checked={loginAgreed}
                  onChange={(e) => setLoginAgreed(e.target.checked)}
                />
                我已阅读并同意
              </label>
              <button
                type="button"
                className="text-link"
                onClick={() => policy("用户协议")}
              >
                《用户协议》
              </button>
              <span>和</span>
              <button
                type="button"
                className="text-link"
                onClick={() => policy("隐私政策")}
              >
                《隐私政策》
              </button>
            </div>
            {loginFailures >= 3 && (
              <p className="field-error" role="alert">
                {loginFailures >= 5
                  ? "尝试已达5次，请联系门店；重新载入可重置演示。"
                  : `连续操作失败${loginFailures}次，还可尝试${5 - loginFailures}次。`}
              </p>
            )}
            {actionFeedback()}
            <Button
              type="submit"
              loading={pending === "login"}
              disabled={
                !/^1[3-9]\d{9}$/.test(phone) ||
                password.length < 6 ||
                !loginAgreed ||
                loginFailures >= 5 ||
                !online
              }
            >
              {pending === "login" ? "登录中…" : "登 录"}
            </Button>
            <p className="form-hint">
              请先填写手机号、至少6位密码，并勾选协议。
            </p>
            <div className="login-links">
              <button
                type="button"
                onClick={() =>
                  showInfo(
                    "体验演示账号",
                    "使用有效格式手机号与任意6位以上非真实密码即可体验；不会创建或验证真实账户。注册服务需接入后端。",
                  )
                }
              >
                注册账号
              </button>
              <span>|</span>
              <button type="button" onClick={contact}>
                遇到问题？
              </button>
            </div>
          </form>
          <p className="demo-note">仅为交互演示，请勿使用真实密码。</p>
        </div>
      )
    if (page === "home") return <>
      <section className="hotel-heading"><h1>立即预订</h1><span className="store-open"><i />营业中 09:00–21:00</span></section>
      <section className="panel hotel-booking-panel" aria-label="预订信息">
        <button className="hotel-pet-row" aria-haspopup="dialog" onClick={() => {
          if (pets.length) setModal({ title: "选择入住宠物", text: "", kind: "petPicker" })
          else if (loggedIn) newPet(true)
          else { setRedirect("home"); go("login") }
        }}><span className="hotel-field-label"><Icon name="paw" size={18} />宠物</span><strong>{chosenPet ? `${chosenPet.name}（${chosenPet.breed}）` : loggedIn ? "请选择或新增宠物" : "登录后选择宠物"}</strong><Icon name="chevron" size={18} /></button>
        <div className="date-fields hotel-dates">
          <label><span>入住日期</span><strong className="hotel-date-value">{start.slice(5) || "请选择"}</strong><small>10:00 <em>建议</em></small><input className="hotel-date-input" aria-label="入住日期" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
          <span className="date-duration hotel-duration">共{stayLabel(start, end)}</span>
          <label><span>离店日期</span><strong className="hotel-date-value">{end.slice(5) || "请选择"}</strong><small>18:00 <em>建议</em></small><input className="hotel-date-input" aria-label="离店日期" type="date" min={start} value={end} aria-invalid={!!start && !!end && !days} onChange={e => setEnd(e.target.value)} /></label>
        </div>
        <p className={start && end && !days ? "field-error hotel-billing-note" : "hotel-billing-note"}>{start && end && !days ? "离店日期不能早于入住日期" : "跨天按晚计费，同日按1天；到店时间为建议时段。"}</p>
      </section>
      <section className="hotel-room-section"><SectionTitle>热门房型</SectionTitle><div className="hotel-room-grid" role="group" aria-label="选择房型">{rooms.map((r, i) => <button key={r.name} aria-pressed={room === i} className={`hotel-room-card ${room === i ? "selected" : ""}`} onClick={() => setRoom(i)}>{i === 1 && <span className="hotel-popular">人气</span>}<span className="hotel-room-icon"><RoomIcon variant={i} /></span><h3>{r.name}</h3><p className="hotel-room-price"><span>¥</span>{r.price}<small>/晚</small></p><small className="hotel-room-description">{["基础照护", "空间更大", "尊享服务"][i]}</small><span className="radio-dot">{room === i && <Icon name="check" size={12} />}</span></button>)}</div></section>
      <div className="hotel-assurances" role="list" aria-label="服务保障">{([{ icon: "clock", text: "24小时看护" }, { icon: "heart", text: "健康检查" }, { icon: "shield", text: "每日消毒" }] as const).map(item => <span key={item.text} role="listitem"><Icon name={item.icon} size={17} />{item.text}</span>)}</div>
      {actionFeedback()}
      <div className="action-bar hotel-actions"><div className="action-summary"><small>预估金额 · {stayLabel(start, end)}</small><strong>¥{total.toFixed(2)}</strong></div><Button disabled={!!bookingReason || !online} onClick={() => enterCheckout()}>立即预订</Button><Button secondary onClick={() => newPet(true)}><Icon name="plus" size={17} />新增宠物</Button>{bookingReason && <p className="action-reason">{bookingReason}</p>}</div>
    </>
    if (page === "checkout") {
      if (checkoutOrderId && !checkoutOrder)
        return (
          <Empty
            icon="orders"
            title="这笔预约已不可用"
            text="请返回历史订单查看最新状态。"
            action={<Button onClick={() => go("orders")}>查看历史订单</Button>}
          />
        )
      const summary = checkoutOrder
        ? {
            ...checkoutOrder,
            pet: `${checkoutOrder.pet}${
              pets.find((p) => p.id === checkoutOrder.petId)?.breed
                ? `（${pets.find((p) => p.id === checkoutOrder.petId)?.breed}）`
                : ""
            }`,
          }
        : {
            pet: chosenPet
              ? `${chosenPet.name}（${chosenPet.breed}）`
              : "未选择",
            room,
            start,
            end,
            note,
          }
      const amount = money(summary)
      const duration = stayLabel(summary.start, summary.end)
      const submitBlocked =
        !online ||
        !agreed ||
        (checkoutOrder
          ? checkoutOrder.paid ||
            checkoutOrder.status !== "待入店" ||
            checkoutOrder.expiresAt <= now
          : !!bookingReason)
      return (
        <>
          <div className="checkout-heading">
            <span className="checkout-symbol">
              <Icon name="shield" size={23} />
            </span>
            <div>
              <h2>确认这一次安心托付</h2>
              <p>核对入住信息，提交后前往在线支付。</p>
            </div>
          </div>
          <section className="panel checkout-info">
            <SectionTitle
              aside={
                checkoutOrder && (
                  <span
                    className={`badge ${statusClass(checkoutOrder.status)}`}
                  >
                    {checkoutOrder.status}
                  </span>
                )
              }
            >
              入住信息
            </SectionTitle>
            <InfoRows
              grid
              rows={[
                ["入住宠物", summary.pet],
                ["寄养房型", rooms[summary.room].name],
                ["入住时间", `${summary.start} 10:00`],
                ["离店时间", `${summary.end} 18:00`],
              ]}
            />
            <div className="stay-summary">
              <Icon name="clock" size={15} />
              <span>寄养 {duration}</span>
              <small>到店时间为建议时段，按日期计费</small>
            </div>
          </section>
          <section className="panel">
            <SectionTitle>价格明细</SectionTitle>
            <InfoRows
              rows={[
                [
                  rooms[summary.room].name,
                  `¥${rooms[summary.room].price} × ${duration}`,
                ],
              ]}
            />
            <div className="total-row">
              合计金额<strong>{amount}</strong>
            </div>
            <p className="form-hint">
              含每日喂养、基础照护与清洁，无押金；不含医疗及另行协商服务。
            </p>
          </section>
          <section className="panel">
            <label>
              备注 <span className="muted">（选填）</span>
              <textarea
                maxLength={255}
                value={checkoutOrder?.note ?? note}
                readOnly={!!checkoutOrder}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：挑食、怕生、需喂药；请注明照护方式…"
                rows={3}
              />
              <span className="field-counter">
                {(checkoutOrder?.note ?? note).length}/255
              </span>
            </label>
            {checkoutOrder && (
              <p className="form-hint">
                订单已创建，备注与预约信息已保留，继续支付不会重复下单。
              </p>
            )}
          </section>
          <div className="consent-row">
            <label>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              已阅读并同意
            </label>
            <button
              className="text-link"
              onClick={() => policy("寄养服务协议")}
            >
              《寄养服务协议》
            </button>
          </div>
          {actionFeedback()}
          <div className="action-bar">
            <div className="action-summary">
              <small>应付金额 · {duration}</small>
              <strong>{amount}</strong>
            </div>
            {checkoutOrder?.status === "已取消" ? (
              <Button onClick={() => go("home")}>订单已关闭，重新预约</Button>
            ) : checkoutOrder?.paid ? (
              <Button
                onClick={() => {
                  setSelectedOrder(checkoutOrder.id)
                  go("detail")
                }}
              >
                查看已支付订单
              </Button>
            ) : (
              <Button
                loading={pending.startsWith("submit-")}
                disabled={submitBlocked}
                onClick={submitOrder}
              >
                {pending.startsWith("submit-") ? "提交中…" : "提交订单"}
              </Button>
            )}
            {!agreed &&
              !checkoutOrder?.paid &&
              checkoutOrder?.status !== "已取消" && (
                <p className="action-reason">请先阅读并勾选寄养服务协议</p>
              )}
          </div>
        </>
      )
    }
    if (page === "payment") {
      if (!checkoutOrder) return <Empty icon="orders" title="这笔订单已不可用" text="请返回历史订单选择需要支付的订单。" action={<Button onClick={() => go("orders")}>查看历史订单</Button>} />
      return <>
        <div className="payment-amount"><span>订单金额</span><h2>{money(checkoutOrder)}</h2><p>{checkoutOrder.status === "已取消" ? "订单已关闭" : checkoutOrder.paid ? "该订单已支付" : <>请在 <b>{countdown(checkoutOrder.expiresAt, now)}</b> 内完成支付</>}</p></div>
        <section className="panel payment-order-summary"><InfoRows rows={[["订单编号", checkoutOrder.id], ["商品名称", `宠物寄养 · ${rooms[checkoutOrder.room].name} · ${stayLabel(checkoutOrder.start, checkoutOrder.end)}`]]} /><p className="form-hint">{checkoutOrder.pet} · {checkoutOrder.start} → {checkoutOrder.end}</p></section>
        <section className="panel"><SectionTitle>支付方式</SectionTitle><div className="payment-method"><span className="wechat"><Icon name="chat" size={27} /></span><span><b>微信支付</b><small>当前仅支持微信支付演示</small></span><span className="radio-dot"><Icon name="check" size={12} /></span></div><div className="demo-payment-tip"><Icon name="shield" size={19} /><p>演示环境：本次支付为模拟支付，不会产生真实扣款。</p></div></section>
        <p className="payment-resume-hint">中断后可在“历史订单”中继续支付。</p>{actionFeedback()}
        <div className="action-bar single-action">{checkoutOrder.status === "已取消" ? <Button onClick={() => go("home")}>订单已关闭，重新预订</Button> : checkoutOrder.paid ? <Button onClick={() => { setSelectedOrder(checkoutOrder.id); go("result") }}>查看支付结果</Button> : <Button loading={pending.startsWith("pay-")} disabled={!online || checkoutOrder.expiresAt <= now} onClick={payOrder}>{pending.startsWith("pay-") ? "支付处理中…" : "确认支付"}</Button>}</div>
      </>
    }
    if (page === "result" && activeOrder?.paid)
      return (
        <div className="payment-result">
          <span className="success-icon">
            <Icon name="check" size={36} />
          </span>
          <p className="eyebrow">PAYMENT COMPLETE</p>
          <h2>支付成功</h2>
          <strong>{money(activeOrder)}</strong>
          <p>预约已确认，期待与毛孩子见面。</p>
          <small>订单编号 {activeOrder.id}</small>
          <div className="demo-payment-tip result-tip">
            <Icon name="shield" size={19} />
            <p>
              本次为演示环境模拟支付，未产生真实扣款。正式支付须接入服务端及微信支付能力后另行启用。
            </p>
          </div>
          <div className="result-actions">
            <Button secondary onClick={() => go("home")}>
              返回首页
            </Button>
            <Button
              onClick={() => {
                setFilter("全部")
                setSearch("")
                go("orders")
              }}
            >
              查看历史订单
            </Button>
          </div>
        </div>
      )
    if (page === "orders") {
      const visible = orders.filter(
        (o) =>
          matchesFilter(o, filter) && `${o.pet}${o.id}`.includes(search.trim()),
      )
      return (
        <>
          <div className="list-toolbar">
            <span className="order-count">
              {filter === "累计寄养"
                ? "仅含寄养中与已完成"
                : `共 ${orders.length} 笔演示订单`}
            </span>
          </div>
          <label className="search-label">
            <span className="sr-only">搜索宠物昵称或订单号</span>
            <Icon name="search" size={19} />
            <input
              type="search"
              placeholder="搜索宠物昵称或订单号"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setHistoryLimit(3) }}
            />
          </label>
          <nav className="filter-tabs" aria-label="预约状态筛选">
            {[
              "全部",
              "待入店",
              "寄养中",
              "已完成",
              "已取消",
              ...(filter === "累计寄养" ? ["累计寄养"] : []),
            ].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f)
                  setHistoryLimit(3)
                  window.scrollTo({ top: 0, behavior: "instant" })
                }}
                className={filter === f ? "active" : ""}
              >
                {f}
              </button>
            ))}
          </nav>
          {actionFeedback()}
          <div className="order-list history-list">
            {visible.slice(0, historyLimit).map((o) => (
              <section
                key={o.id}
                className={`panel order-card border-${statusClass(o.status)}`}
              >
                <div className="order-top">
                  <span>{o.id}</span>
                  <div>
                    <span className={`badge ${statusClass(o.status)}`}>
                      {o.status}
                    </span>
                    <span className={`badge ${o.paid ? "green" : o.status === "待入店" ? "orange" : "gray"}`}>
                      {o.paid
                        ? o.status === "已取消"
                          ? "已退款（演示）"
                          : "已支付"
                        : "未支付"}
                    </span>
                  </div>
                </div>
                <button
                  className="order-pet"
                  onClick={() => {
                    setSelectedOrder(o.id)
                    go("detail")
                  }}
                >
                  <PetAvatar
                    photo={petPhotos[o.petId]}
                    cat={pets
                      .find((p) => p.id === o.petId)
                      ?.breed.includes("猫")}
                  />
                  <span>
                    <h3>
                      {o.pet}
                      <small>{rooms[o.room].name}</small>
                    </h3>
                    <p>
                      {o.start} → {o.end}
                      <span>共{stayLabel(o.start, o.end)}</span>
                    </p>
                  </span>
                  <strong>{money(o)}</strong>
                  <Icon name="chevron" size={16} />
                </button>
                <p className="order-meta">
                  下单 {timeText(o.createdAt)}
                  {!o.paid && o.status === "待入店" && (
                    <span className="order-deadline">
                      请于 {timeText(o.expiresAt)} 前支付 ·{" "}
                      剩余 {countdown(o.expiresAt, now)}
                    </span>
                  )}
                  {o.cancelReason && <span>{o.cancelReason}</span>}
                </p>
                <div className="order-actions">
                  {o.status === "待入店" ? (
                    <>
                      <Button secondary onClick={() => cancelOrder(o)}>
                        取消预约
                      </Button>
                      <Button
                        secondary
                        onClick={() => {
                          if (o.paid) {
                            setSelectedOrder(o.id)
                            go("detail")
                          } else enterCheckout(o)
                        }}
                      >
                        {o.paid ? "查看详情" : "去支付"}
                      </Button>
                    </>
                  ) : o.status === "寄养中" ? (
                    <Button
                      secondary
                      onClick={() => {
                        setSelectedOrder(o.id)
                        go("detail")
                      }}
                    >
                      查看详情
                    </Button>
                  ) : (
                    <Button
                      secondary
                      onClick={() => {
                        setRoom(o.room)
                        setPetId(
                          pets.some((p) => p.id === o.petId) ? o.petId : 0,
                        )
                        go("home")
                      }}
                    >
                      再次预约
                    </Button>
                  )}
                </div>
              </section>
            ))}
          </div>
          {visible.length > historyLimit && <button className="history-more" onClick={() => setHistoryLimit(limit => limit + 3)}>查看更早订单（{visible.length - historyLimit}）<Icon name="chevron" size={15} /></button>}
          {!visible.length && (
            <Empty
              icon="calendar"
              title={search ? "没有找到相关预约" : "这里还没有预约"}
              text={
                search
                  ? "换个昵称或订单号试试。"
                  : "每一段安心旅程，都从一次预约开始。"
              }
              action={
                search ? (
                  <Button secondary onClick={() => setSearch("")}>
                    清除搜索
                  </Button>
                ) : (
                  <Button onClick={() => go("home")}>预约入住</Button>
                )
              }
            />
          )}
        </>
      )
    }
    if (page === "detail" && activeOrder)
      return (
        <>
          <div className={`status-panel ${statusClass(activeOrder.status)}`}>
            <span className="status-icon">
              <Icon
                name={
                  activeOrder.status === "已取消"
                    ? "close"
                    : activeOrder.status === "已完成"
                      ? "check"
                      : "calendar"
                }
                size={26}
              />
            </span>
            <div>
              <h2>{activeOrder.status}</h2>
              <p>
                {activeOrder.status === "待入店"
                  ? `请于 ${activeOrder.start} 当日携带宠物到店；建议10:00–18:00抵达。`
                  : activeOrder.status === "寄养中"
                    ? "毛孩子正在享受安心假期，有问题请联系门店。"
                    : activeOrder.status === "已完成"
                      ? "感谢信任，期待与毛孩子再次相见。"
                      : activeOrder.cancelReason || "该订单已关闭。"}
              </p>
            </div>
          </div>
          <section className="panel">
            <SectionTitle>订单信息</SectionTitle>
            <InfoRows
              grid
              rows={[
                ["订单编号", activeOrder.id],
                ["下单时间", timeText(activeOrder.createdAt)],
                ["入住宠物", activeOrder.pet],
                ["寄养房型", rooms[activeOrder.room].name],
                ["入住时间", `${activeOrder.start} 10:00（建议）`],
                ["离店时间", `${activeOrder.end} 18:00（建议）`],
                ["寄养时长", stayLabel(activeOrder.start, activeOrder.end)],
              ]}
            />
            {activeOrder.note && (
              <p className="soft-tip">照护备注：{activeOrder.note}</p>
            )}
          </section>
          <section className="panel">
            <SectionTitle>费用信息</SectionTitle>
            <InfoRows
              rows={[
                [
                  "订单金额",
                  <span className="orange-text">{money(activeOrder)}</span>,
                ],
                ["支付方式", "微信支付（演示）"],
                [
                  "支付状态",
                  activeOrder.paid
                    ? activeOrder.status === "已取消"
                      ? "已退款（模拟）"
                      : "已支付"
                    : "未支付",
                ],
                [
                  activeOrder.paid
                    ? activeOrder.status === "已取消"
                      ? "已退金额"
                      : "已付金额"
                    : "待付金额",
                  activeOrder.status === "已取消" && !activeOrder.paid
                    ? "¥0.00"
                    : money(activeOrder),
                ],
              ]}
            />
          </section>
          {storeCard()}
          {actionFeedback()}
          <div
            className={`action-bar detail-actions ${
              activeOrder.status === "待入店" && !activeOrder.paid
                ? "has-payment"
                : ""
            }`}
          >
            {activeOrder.status === "待入店" ? (
              <>
                <Button
                  danger
                  secondary
                  onClick={() => cancelOrder(activeOrder)}
                >
                  取消订单
                </Button>
                {!activeOrder.paid && (
                  <Button onClick={() => enterCheckout(activeOrder)}>
                    去支付
                  </Button>
                )}
              </>
            ) : (
              <Button secondary onClick={() => go("orders")}>
                返回历史订单
              </Button>
            )}
          </div>
        </>
      )
    if (page === "pets")
      return (
        <>
          <div className="list-toolbar">
            <span>共{pets.length}位毛孩子</span>
            <Button secondary={!pets.length} onClick={() => newPet()}>
              <Icon name="plus" size={17} />
              新增宠物
            </Button>
          </div>
          {pets.map((p) => (
            <section className="panel pet-profile" key={p.id}>
              <div className="pet-profile-head">
                <PetAvatar cat={p.breed.includes("猫")} photo={petPhotos[p.id]} />
                <div>
                  <h2>
                    {p.name}
                    <span className="sex-tag">
                      {p.sex === "公" ? "♂" : "♀"}
                    </span>
                  </h2>
                  <p>
                    {p.breed} · {p.sex} · {p.age}岁 · {p.weight}kg
                    {p.color && ` · ${p.color}`}
                  </p>
                </div>
                <button className="text-link" onClick={() => editPet(p)}>
                  编辑
                  <Icon name="chevron" size={15} />
                </button>
              </div>
              <div className="pet-profile-details">
                <span
                  className={`badge ${
                    vaccineDetails(p.vaccine).vaccinated ? "green" : "gray"
                  }`}
                >
                  {vaccineDetails(p.vaccine).vaccinated ? "已接种" : "未接种"}
                </span>
                {vaccineDetails(p.vaccine).name && (
                  <span
                    className="vaccine-record"
                    title={`${vaccineDetails(p.vaccine).name} ${vaccineDetails(p.vaccine).date}`}
                  >
                    {vaccineDetails(p.vaccine).name}{" "}
                    {vaccineDetails(p.vaccine).date.slice(0, 7)}
                  </span>
                )}
                {hasActiveOrder(p.id, orders) && (
                  <span className="active-pet-note" title="该宠物有进行中预约">
                    <Icon name="lock" size={12} />
                    预约中
                  </span>
                )}
                <p title={p.note}>{p.note || "暂无特殊备注"}</p>
              </div>
            </section>
          ))}
          {!pets.length && (
            <Empty
              icon="paw"
              title="还没有毛孩子的档案"
              text="记录名字与习惯，让我们更懂它。"
              action={<Button onClick={() => newPet()}>新增宠物</Button>}
            />
          )}
          <p className="form-hint">
            宠物档案用于寄养；进行中预约涉及的宠物不能删除或修改关键信息。
          </p>
          {pets.length > 0 && (
            <div className="pet-add-footer">
              <Button secondary onClick={() => newPet()}>
                <Icon name="plus" size={18} />
                新增宠物
              </Button>
            </div>
          )}
          {actionFeedback()}
        </>
      )
    if (page === "editPet") {
      const valid = Object.keys(validatePet(draft)).length === 0
      const fieldError = (field: keyof Pet) =>
        petErrors[field] ? (
          <p className="field-error" id={`error-${field}`}>
            {petErrors[field]}
          </p>
        ) : null
      return (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            savePet()
          }}
        >
          <div className="photo-field"><label className="photo-uploader">{draftPhoto ? <img src={draftPhoto} alt="宠物照片预览" /> : <><Icon name="camera" size={25} /><span>{photoLoading ? "读取中…" : "上传照片"}</span></>}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="上传宠物照片" disabled={photoLoading || !!pending} onChange={e => { previewPhoto(e.target.files?.[0]); e.target.value = "" }} /></label><p>仅本次演示预览，照片不会上传到服务器</p>{draftPhoto && <button type="button" className="photo-remove" onClick={() => setDraftPhoto("")}>移除照片</button>}{photoError && <p className="field-error" role="alert">{photoError}</p>}</div>
          {petLocked && (
            <p className="soft-tip">
              <Icon name="lock" size={17} />
              该宠物有进行中预约，关键信息暂不可修改；仍可补充毛色与照护备注。
            </p>
          )}
          <section className="panel form-grid">
            <label htmlFor="pet-name">
              宠物昵称 <span className="required">*</span>
              <input
                id="pet-name"
                value={draft.name}
                disabled={petLocked}
                maxLength={20}
                placeholder="它叫什么名字？"
                aria-invalid={!!petErrors.name}
                aria-describedby="error-name"
                onBlur={() =>
                  setPetErrors((e) => ({ ...e, name: validatePet(draft).name }))
                }
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              {fieldError("name")}
            </label>
            <label htmlFor="pet-breed">
              品种 <span className="required">*</span>
              <input
                id="pet-breed"
                value={draft.breed}
                disabled={petLocked}
                maxLength={30}
                placeholder="如：柯基、布偶猫"
                aria-invalid={!!petErrors.breed}
                aria-describedby="error-breed"
                onBlur={() =>
                  setPetErrors((e) => ({
                    ...e,
                    breed: validatePet(draft).breed,
                  }))
                }
                onChange={(e) => setDraft({ ...draft, breed: e.target.value })}
              />
              <small className="form-hint">自由填写，最多30字</small>
              {fieldError("breed")}
            </label>
            <fieldset disabled={petLocked}>
              <legend>性别</legend>
              <div
                className="gender-buttons"
                role="group"
                aria-label="宠物性别"
              >
                {["公", "母"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={draft.sex === s}
                    className={draft.sex === s ? "selected" : ""}
                    onClick={() => setDraft({ ...draft, sex: s })}
                  >
                    {s === "公" ? "♂" : "♀"} {s}
                  </button>
                ))}
              </div>
            </fieldset>
            <label htmlFor="pet-age">
              年龄（周岁） <span className="required">*</span>
              <input
                id="pet-age"
                type="number"
                inputMode="numeric"
                value={draft.age}
                disabled={petLocked}
                min="0"
                max="40"
                step="1"
                placeholder="0–40岁"
                aria-invalid={!!petErrors.age}
                aria-describedby="error-age"
                onBlur={() =>
                  setPetErrors((e) => ({ ...e, age: validatePet(draft).age }))
                }
                onChange={(e) => setDraft({ ...draft, age: e.target.value })}
              />
              <small className="form-hint">未满1岁填0，并在备注注明月龄</small>
              {fieldError("age")}
            </label>
            <label htmlFor="pet-weight">
              体重（kg） <span className="required">*</span>
              <input
                id="pet-weight"
                type="number"
                inputMode="decimal"
                value={draft.weight}
                disabled={petLocked}
                min="0.1"
                max="150"
                step="0.1"
                placeholder="保留最多1位小数"
                aria-invalid={!!petErrors.weight}
                aria-describedby="error-weight"
                onBlur={() =>
                  setPetErrors((e) => ({
                    ...e,
                    weight: validatePet(draft).weight,
                  }))
                }
                onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
              />
              {fieldError("weight")}
            </label>
            <label>
              毛色 <span className="muted">（选填）</span>
              <input
                value={draft.color}
                maxLength={30}
                placeholder="如：黄白、蓝白"
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              />
            </label>
          </section>
          <section className="panel">
            <div className="toggle-row">
              <span>
                <b>已接种疫苗</b>
                <small>接种后可补充疫苗名与日期，到店核验证明</small>
              </span>
              <button
                type="button"
                role="switch"
                disabled={petLocked}
                aria-checked={vaccineDetails(draft.vaccine).vaccinated}
                aria-label="已接种疫苗"
                className={`toggle ${
                  vaccineDetails(draft.vaccine).vaccinated ? "on" : ""
                }`}
                onClick={() =>
                  updateVaccine(
                    vaccineDetails(draft.vaccine).vaccinated
                      ? "未接种"
                      : vaccineText("", ""),
                  )
                }
              >
                <span />
              </button>
            </div>
            {vaccineDetails(draft.vaccine).vaccinated && (
              <div className="vaccine-fields">
                <label>
                  疫苗名 <span className="muted">（选填）</span>
                  <input
                    maxLength={40}
                    disabled={petLocked}
                    aria-invalid={!!petErrors.vaccine}
                    aria-describedby="error-vaccine"
                    onBlur={() =>
                      setPetErrors((errors) => ({
                        ...errors,
                        vaccine: validatePet(draft).vaccine,
                      }))
                    }
                    placeholder="如：狂犬疫苗、猫三联"
                    value={vaccineDetails(draft.vaccine).name}
                    onChange={(e) =>
                      updateVaccine(
                        vaccineText(
                          e.target.value,
                          vaccineDetails(draft.vaccine).date,
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  接种日期 <span className="muted">（选填）</span>
                  <input
                    id="pet-vaccine"
                    type="date"
                    disabled={petLocked}
                    aria-invalid={!!petErrors.vaccine}
                    aria-describedby="error-vaccine"
                    onBlur={() =>
                      setPetErrors((errors) => ({
                        ...errors,
                        vaccine: validatePet(draft).vaccine,
                      }))
                    }
                    max={new Date().toISOString().slice(0, 10)}
                    value={vaccineDetails(draft.vaccine).date}
                    onChange={(e) =>
                      updateVaccine(
                        vaccineText(
                          vaccineDetails(draft.vaccine).name,
                          e.target.value,
                        ),
                      )
                    }
                  />
                </label>
              </div>
            )}
            {fieldError("vaccine")}
            <label htmlFor="pet-note">
              特殊病史 / 备注 <span className="muted">（选填）</span>
              <textarea
                id="pet-note"
                maxLength={255}
                rows={3}
                value={draft.note}
                placeholder="例如：3个月、怕生、饮食禁忌或需喂药…"
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              />
              <span className="field-counter">{draft.note.length}/255</span>
            </label>
          </section>
          {draft.id > 0 && (
            <div className="pet-delete">
              <Button
                danger
                secondary
                disabled={petLocked || !!pending || photoLoading}
                onClick={() =>
                  setModal({
                    title: `删除${draft.name}的档案？`,
                    text: "删除后不能恢复。历史预约中的宠物信息仍会保留。",
                    kind: "delete",
                  })
                }
              >
                删除宠物档案
              </Button>
              {petLocked && (
                <p className="form-hint">请在所有进行中预约结束后再删除。</p>
              )}
            </div>
          )}
          {actionFeedback()}
          <div className="action-bar single-action">
            <Button
              type="submit"
              loading={pending.startsWith("pet-")}
              disabled={!valid || !online || photoLoading}
            >
              {pending.startsWith("pet-") ? "保存中…" : "保 存"}
            </Button>
            {!valid && (
              <p className="action-reason">
                {Object.values(validatePet(draft))[0] || "请完善必填资料后保存"}
              </p>
            )}
          </div>
        </form>
      )
    }
    if (page === "profile")
      return (
        <>
          <section className="panel profile-overview">
            <button
              className="profile-card"
              onClick={() => {
                setProfileDraft(nickname)
                setModal({
                  title: "编辑资料",
                  text: "修改你的昵称，让我们更熟悉彼此。",
                  kind: "profile",
                })
              }}
            >
              <span className="profile-avatar">
                <Icon name="user" size={36} />
              </span>
              <span>
                <h2>{nickname}</h2>
                <p>
                  {phone
                    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
                    : "138****8888"}
                </p>
              </span>
              <span className="text-link">
                编辑资料
                <Icon name="chevron" size={16} />
              </span>
            </button>
            <section className="profile-stats">
              {["待入店", "寄养中", "已完成", "累计寄养"].map((s) => (
                <button
                  key={s}
                  className={s === "待入店" ? "attention" : ""}
                  onClick={() => {
                    setFilter(s)
                    setSearch("")
                    go("orders")
                  }}
                >
                  <b>{orders.filter((o) => matchesFilter(o, s)).length}</b>
                  <span>{s}</span>
                </button>
              ))}
            </section>
          </section>
          <section className="panel settings-list">
            {([
              { icon: "paw", label: "我的宠物", action: () => go("pets") },
              { icon: "orders", label: "历史订单", action: () => go("orders") },
              { icon: "lock", label: "账号与安全", action: contact },
              { icon: "chat", label: "联系客服", action: contact },
              {
                icon: "heart",
                label: "关于我们",
                action: () =>
                  showInfo(
                    "关于毛球旅馆",
                    "毛球旅馆 v1.0.0\n宠物寄养 · 安心托管\n每一份托付，都用爱回应。\n客服电话：400-080-6060（演示）\n当前为前端演示，不提供真实预订与扣款。",
                  ),
              },
            ] as const).map((item) => (
              <button key={item.label} onClick={item.action}>
                <Icon name={item.icon} size={22} />
                <b>{item.label}</b>
                <Icon name="chevron" size={17} />
              </button>
            ))}
          </section>
          <div className="logout-button profile-logout">
            <Button
              danger
              secondary
              onClick={() =>
                setModal({
                  title: "确定退出登录？",
                  text: "退出后会清除本次演示的个人资料、宠物和订单，返回未登录首页。",
                  kind: "logout",
                })
              }
            >
              <Icon name="logout" size={17} />
              退出登录
            </Button>
          </div>
          <footer className="profile-footer">毛球旅馆 v1.0.0</footer>
        </>
      )
    return (
      <Empty
        icon="orders"
        title="这笔预约已不可用"
        text="请返回列表，选择需要查看的预约。"
        action={<Button onClick={() => go("orders")}>返回历史订单</Button>}
      />
    )
  }

  const destructive =
    !!modal?.kind &&
    ["cancel", "refund", "delete", "logout", "discard"].includes(modal.kind)
  return (
    <div
      className={`app-shell ${tabPage ? "has-tabs" : "has-actions"} ${
        page === "home" ? "home-order-page hotel-home" : page === "orders" ? "history-page" : ""
      }`}
    >
      <aside className="sidebar">
        <button className="brand" onClick={() => go("home")}>
          <span className="brand-icon">
            <Icon name="paw" size={27} />
          </span>
          <span>
            <b>
              毛球旅馆<span className="brand-dot">.</span>
            </b>
            <small>A LITTLE HOME, A LOT OF LOVE</small>
          </span>
        </button>
        <div className="nav-label">与爱宠的每一天</div>
        <nav>
          {navs.map((n) => (
            <button
              key={n.page}
              className={activeNav === n.page ? "active" : ""}
              onClick={() => go(n.page)}
            >
              <Icon name={n.icon} />
              <span>{n.label}</span>
              {activeNav === n.page && <span className="nav-indicator" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <Icon name="chat" />
            <h3>有问题，随时找我们</h3>
            <p>每一份牵挂，我们都懂。</p>
            <button onClick={contact}>
              联系毛球管家
              <Icon name="arrow" size={16} />
            </button>
          </div>
          <button className="sidebar-user" onClick={() => go("profile")}>
            <span className="user-avatar">
              <Icon name="user" size={21} />
            </span>
            <span>
              <b>{loggedIn ? nickname : "登录后，安心托付"}</b>
              <small>
                {loggedIn ? "演示账号 · 不保存真实数据" : "点击登录演示账号"}
              </small>
            </span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="desktop-crumb">
              毛球旅馆<i>/</i>
            </span>
            {page !== "profile" && <span>{page === "home" ? "毛球旅馆" : titles[page]}</span>}
          </div>
          <div className="topbar-right">
            <span className="open-status">
              <i />
              演示门店<span>09:00–21:00</span>
            </span>
            <button aria-label="联系门店" onClick={contact}>
              <Icon name="chat" size={20} />
            </button>
            <button
              className="header-avatar"
              aria-label="个人中心"
              onClick={() => go("profile")}
            >
              <Icon name="user" size={21} />
            </button>
          </div>
          <span className="mini-capsule" aria-hidden="true">
            <span>•••</span>
            <i />
            <span>◉</span>
          </span>
        </header>
        <main
          className={`main-content ${page !== "home" ? "inner-content" : ""}`}
          aria-busy={viewState === "loading" || !!pending}
        >
          {page !== "home" && (
            <div className="page-heading">
              <div>
                <button
                  className="back-button"
                  aria-label="返回"
                  onClick={() =>
                    go(
                      page === "checkout"
                        ? "home"
                        : page === "payment" || page === "result" || page === "detail"
                          ? "orders"
                          : page === "editPet"
                            ? returnToBooking
                              ? "home"
                              : "pets"
                            : page === "pets"
                              ? "profile"
                              : "home",
                    )
                  }
                >
                  <Icon name="back" size={20} />
                </button>
                <h1>
                  {page === "editPet" && draft.id ? "编辑宠物" : titles[page]}
                </h1>
                {page === "orders" && <button className="history-add" onClick={() => go("home")}><Icon name="plus" size={16} />新增预约</button>}
              </div>
              <p>
                {page === "checkout"
                  ? "确认信息，安心托付。"
                  : page === "pets"
                    ? "了解每个小细节，照顾每份小心思。"
                    : page === "login"
                      ? "登录后继续刚才的旅程。"
                      : "每一份托付，我们都用心对待。"}
              </p>
            </div>
          )}
          {!online && (
            <div className="offline-banner" role="alert">
              当前网络已断开，操作暂不可用；连接恢复后可重试。
            </div>
          )}
          {viewState === "loading" ? (
            <Skeleton />
          ) : viewState === "error" ? (
            <Empty
              icon="refresh"
              title="暂时无法打开页面"
              text="网络连接不稳定，你的填写内容仍然保留。"
              action={
                <Button onClick={() => setReloadKey((k) => k + 1)}>
                  重新加载
                </Button>
              }
            />
          ) : (
            renderContent()
          )}
          {showDemoControls && page !== "home" && (
            <details className="demo-controls">
              <summary>原型状态演示</summary>
              <p>仅操作当前页面内存；无后台、真实支付或账户服务。</p>
              <label>
                <input
                  type="checkbox"
                  checked={simulateFailure}
                  onChange={(e) => {
                    setSimulateFailure(e.target.checked)
                    failureRef.current = e.target.checked
                  }}
                />
                下一次提交模拟失败，可点击重试
              </label>
              <div>
                <button
                  onClick={() => {
                    setViewState("error")
                  }}
                >
                  展示加载错误
                </button>
                <button
                  onClick={() => {
                    setReloadKey((k) => k + 1)
                  }}
                >
                  重新加载
                </button>
                {page === "pets" && (
                  <button
                    onClick={() => {
                      setPets([])
                      setPetId(0)
                    }}
                  >
                    展示无宠物
                  </button>
                )}
                {page === "orders" && (
                  <button onClick={() => setOrders([])}>展示无预约</button>
                )}
                {page === "payment" &&
                  checkoutOrder &&
                  !checkoutOrder.paid && (
                    <button
                      onClick={() =>
                        setOrders((current) =>
                          expireOrders(
                            current.map((o) =>
                              o.id === checkoutOrder.id
                                ? { ...o, expiresAt: Date.now() - 1 }
                                : o,
                            ),
                            Date.now(),
                          ),
                        )
                      }
                    >
                      演示支付超时
                    </button>
                  )}
              </div>
            </details>
          )}
        </main>
      </div>
      {tabPage && (
        <nav className="mobile-nav" aria-label="底部主导航">
          {([
            { page: "home", icon: "home", label: "首页" },
            { page: "orders", icon: "calendar", label: "历史订单" },
            { page: "profile", icon: "user", label: "我的" },
          ] as const).map((n) => (
            <button
              key={n.page}
              className={activeNav === n.page ? "active" : ""}
              onClick={() => go(n.page)}
            >
              <Icon name={n.icon} size={22} />
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
      )}
      {(pending.startsWith("cancel-") || pending.startsWith("delete-")) && (
        <div className="operation-progress" role="status">
          <span className="spinner" />
          {pending.startsWith("cancel-") ? "正在取消预约…" : "正在删除档案…"}
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {toast}
        </div>
      )}
      {modal && (
        <Dialog
          title={modal.title}
          close={closeModal}
          destructive={destructive}
          actions={
            modal.kind === "contact" ? (
              <>
                <Button secondary onClick={closeModal}>
                  我知道了
                </Button>
                <a className="button" href="tel:4000806060">
                  致电门店
                </a>
              </>
            ) : (
              <>
                {destructive && (
                  <Button secondary onClick={closeModal}>
                    {modal.kind === "discard" ? "继续编辑" : "再想想"}
                  </Button>
                )}
                <Button
                  danger={[
                    "cancel",
                    "refund",
                    "delete",
                    "logout",
                    "discard",
                  ].includes(modal.kind || "")}
                  disabled={modal.kind === "profile" && !profileDraft.trim()}
                  onClick={confirmModal}
                >
                  {modal.kind === "cancel"
                    ? activeOrder?.paid
                      ? "继续核对退款"
                      : "确认取消"
                    : modal.kind === "refund"
                      ? "确认取消并退款"
                      : modal.kind === "logout"
                        ? "退出登录"
                        : modal.kind === "delete"
                          ? "确认删除"
                          : modal.kind === "discard"
                            ? "放弃修改"
                            : modal.kind === "profile"
                              ? "保存资料"
                              : modal.kind === "petPicker" ? "完成选择" : "我知道了"}
                </Button>
              </>
            )
          }
        >
          {modal.kind === "petPicker" ? <div className="pet-picker-list">{pets.map(p => <button key={p.id} className={`pet-picker-option ${petId === p.id ? "selected" : ""}`} onClick={() => { setPetId(p.id); closeModal() }}><PetAvatar cat={p.breed.includes("猫")} photo={petPhotos[p.id]} /><span><b>{p.name}</b><small>{p.breed} · {p.sex} · {p.age}岁 · {p.weight}kg</small><span className={`badge ${vaccineDetails(p.vaccine).vaccinated ? "green" : "gray"}`}>{vaccineDetails(p.vaccine).vaccinated ? "已免疫" : "未免疫"}</span></span><span className="radio-dot">{petId === p.id && <Icon name="check" size={12} />}</span></button>)}</div> : modal.kind === "policy" ? (
            <div className="policy-reader">
              <nav
                className="policy-tabs"
                role="tablist"
                aria-label="选择协议"
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return
                  event.preventDefault()
                  const tabs = policyTabs
                  const index = tabs.indexOf(policyTab)
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 2
                        : (index + (event.key === "ArrowRight" ? 1 : -1) + 3) %
                          3
                  setPolicyTab(tabs[next])
                  requestAnimationFrame(() =>
                    document.getElementById(`policy-tab-${next}`)?.focus(),
                  )
                }}
              >
                {policyTabs.map((tab, index) => (
                  <button
                    key={tab}
                    id={`policy-tab-${index}`}
                    role="tab"
                    aria-selected={policyTab === tab}
                    aria-controls="policy-content"
                    tabIndex={policyTab === tab ? 0 : -1}
                    onClick={() => setPolicyTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
              <article
                id="policy-content"
                role="tabpanel"
                aria-labelledby={`policy-tab-${policyTabs.indexOf(policyTab)}`}
              >
                <h3>{policyTab}</h3>
                <p>{policies[policyTab]}</p>
              </article>
            </div>
          ) : (
            <p>{modal.text}</p>
          )}
          {modal.kind === "profile" && (
            <label>
              昵称
              <input
                value={profileDraft}
                onChange={(e) => setProfileDraft(e.target.value)}
                maxLength={20}
              />
              <small className="form-hint">最多20字，不能为空</small>
            </label>
          )}
        </Dialog>
      )}
    </div>
  )
}

function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName
  title: string
  text: string
  action: ReactNode
}) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={40} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
