import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, Search } from "reicon-react"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/utils"
import {
  customerPage,
  healthPage,
  orderCancel,
  orderCheckIn,
  orderCheckOut,
  orderCreate,
  orderPage,
  orderPay,
  petListByCustomer,
  servicePage,
  type CustomerVO,
  type HealthRecordVO,
  type OrderVO,
  type PetVO,
  type Role,
  type ServiceRecordVO,
} from "@/api"
import { Pagination } from "@/components/Pagination"
import { useDynamicPageSize } from "@/hooks/useDynamicPageSize"

type Mode = "add" | "view" | null

const STATUSES = ["待入店", "寄养中", "已完成", "已取消"]
const EMPTY = {
  customerId: "",
  petId: "",
  startDate: "",
  endDate: "",
  pricePerDay: "",
  remark: "",
}

function calcFee(startDate: string, endDate: string, pricePerDay: string): number {
  const price = Number(pricePerDay)
  if (!startDate || !endDate || !price || price <= 0) return 0
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  const days = Math.round((end - start) / 86400000) + 1
  return days * price
}

interface OrdersPageProps {
  role: Role
  quickAction?: "add" | null
  onQuickActionDone?: () => void
}

export function OrdersPage({ role, quickAction, onQuickActionDone }: OrdersPageProps) {
  const pageSize = useDynamicPageSize()
  const [rows, setRows] = useState<OrderVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [customers, setCustomers] = useState<CustomerVO[]>([])
  const [formPets, setFormPets] = useState<PetVO[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<OrderVO | null>(null)
  const [payOrder, setPayOrder] = useState<OrderVO | null>(null)
  const [payMethod, setPayMethod] = useState("微信")
  const [paying, setPaying] = useState(false)
  const [detailHealth, setDetailHealth] = useState<HealthRecordVO[]>([])
  const [detailServices, setDetailServices] = useState<ServiceRecordVO[]>([])
  const [draft, setDraft] = useState(EMPTY)
  const dialog = useRef<HTMLDialogElement>(null)
  const payDialogRef = useRef<HTMLDialogElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(
    async (targetPage: number, keyword: string, status: string) => {
      setLoading(true)
      try {
        const result = await orderPage(
          targetPage,
          pageSize,
          status || undefined,
          undefined,
          keyword || undefined
        )
        setRows(result.records)
        setTotal(result.total)
        setError("")
      } catch (e) {
        setError(e instanceof Error ? e.message : "订单列表加载失败")
      } finally {
        setLoading(false)
      }
    },
    [pageSize]
  )

  useEffect(() => {
    void load(page, query, statusFilter)
  }, [load, page, query, statusFilter])

  useEffect(() => {
    customerPage(1, 200)
      .then((r) => setCustomers(r.records))
      .catch(() => setCustomers([]))
  }, [])

  useEffect(() => {
    if (mode) dialog.current?.showModal()
  }, [mode])

  useEffect(() => {
    if (payOrder) payDialogRef.current?.showModal()
    else payDialogRef.current?.close()
  }, [payOrder])

  // 首页快捷入口触发：自动打开新增弹窗
  useEffect(() => {
    if (quickAction === "add") {
      setDraft(EMPTY)
      setSelected(null)
      setDialogError("")
      setMode("add")
    }
  }, [quickAction])

  const closeDialog = useCallback(() => {
    setMode(null)
    onQuickActionDone?.()
  }, [onQuickActionDone])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onQueryChange = (value: string) => {
    setInput(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setQuery(value)
      setPage(1)
    }, 250)
  }

  const onCustomerChange = (customerId: string) => {
    setDraft((prev) => ({ ...prev, customerId, petId: "" }))
    if (customerId) {
      petListByCustomer(customerId)
        .then(setFormPets)
        .catch(() => setFormPets([]))
    } else {
      setFormPets([])
    }
  }

  const openAdd = () => {
    setDraft(EMPTY)
    setFormPets([])
    setDialogError("")
    setMode("add")
  }

  const openDetail = async (row: OrderVO) => {
    setSelected(row)
    setDialogError("")
    setMode("view")
    const [health, services] = await Promise.all([
      healthPage(1, 100, undefined, row.id).catch(() => ({ records: [] as HealthRecordVO[] })),
      servicePage(1, 100, row.id).catch(() => ({ records: [] as ServiceRecordVO[] })),
    ])
    setDetailHealth(health.records)
    setDetailServices(services.records)
  }

  const close = () => {
    dialog.current?.close()
    setSelected(null)
    closeDialog()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.customerId || !draft.petId || !draft.startDate || !draft.endDate || !draft.pricePerDay) {
      setDialogError("请完整填写客户、宠物、寄养时间与单价")
      return
    }
    if (new Date(draft.endDate) < new Date(draft.startDate)) {
      setDialogError("结束日期不能早于开始日期")
      return
    }
    setSaving(true)
    try {
      const created = await orderCreate({
        customerId: draft.customerId,
        petId: draft.petId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        pricePerDay: Number(draft.pricePerDay),
        totalFee: calcFee(draft.startDate, draft.endDate, draft.pricePerDay),
        remark: draft.remark.trim(),
      }) as OrderVO
      setNotice("订单已创建，请完成支付。")
      close()
      await load(page, query, statusFilter)
      // 自动弹出支付弹窗
      if (created && created.id) {
        setPayOrder(created)
        setPayMethod("微信")
        setDialogError("")
      }
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  const doAction = async (id: string, action: "check-in" | "check-out" | "cancel", message: string) => {
    try {
      if (action === "check-in") await orderCheckIn(id)
      else if (action === "check-out") await orderCheckOut(id)
      else await orderCancel(id)
      setNotice(message)
      setError("")
      close()
      await load(page, query, statusFilter)
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败")
    }
  }

  const doPay = async () => {
    if (!payOrder) return
    setPaying(true)
    setDialogError("")
    // 模拟支付过程
    await new Promise((r) => setTimeout(r, 1500))
    try {
      await orderPay(payOrder.id, payMethod)
      const paid = payOrder
      // 先关掉收银台再弹提示：<dialog> 处于 top layer，会盖住 toast
      setPayOrder(null)
      setPaying(false)
      setNotice("")
      toast.success("支付成功", {
        description: `订单 ${paid.orderNo} 已通过${payMethod}收款 ¥${Number(paid.totalFee).toLocaleString("zh-CN")}`,
      })
      await load(page, query, statusFilter)
    } catch (e) {
      setPaying(false)
      setDialogError(e instanceof Error ? e.message : "支付失败")
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const isAdmin = role === "admin"

  return (
    <section>
      <div className="dashboard-welcome">
        <div>
          <span className="section-kicker">寄养订单管理</span>
          <h1>每一次入住，都安心安排。</h1>
          <p>有序管理寄养计划，轻松掌握每一笔订单。</p>
        </div>
        <button className="primary-action" onClick={openAdd}>
          ＋ 新建寄养订单
        </button>
      </div>

      <div className="customer-list">
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              寄养订单 <span className="count-badge">{total}</span>
            </h2>
            <p>集中管理每一份照护信息</p>
          </div>
          <div className="business-filters">
            <div className="customer-search">
              <Search />
              <input
                aria-label="按订单号搜索"
                placeholder="按订单编号搜索"
                value={input}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    window.clearTimeout(timer.current)
                    setQuery(input)
                    setPage(1)
                  }
                }}
              />
              {input && (
                <button
                  onClick={() => {
                    window.clearTimeout(timer.current)
                    setInput("")
                    setQuery("")
                    setPage(1)
                  }}
                  aria-label="清空搜索"
                >
                  ×
                </button>
              )}
            </div>
            <select
              className="business-select"
              aria-label="全部状态"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">全部状态</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table business-table">
            <thead>
              <tr>
                {["订单编号", "客户", "宠物", "寄养时间", "总费用（元）", "状态", "创建时间", "操作"].map((col) => (
                  <th key={col} scope="col">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="customer-name">
                      <strong>{row.orderNo}</strong>
                    </div>
                  </td>
                  <td>{row.customerName}</td>
                  <td>{row.petName}</td>
                  <td>
                    {row.startDate} 至 {row.endDate}
                  </td>
                  <td>{Number(row.totalFee).toLocaleString("zh-CN")}</td>
                  <td>
                    <div className="order-status-col">
                      <span className="soft-badge">{row.status}</span>
                      {/* 已收款是默认期待状态，不占第二行；只有待收款才提示，且带上金额 */}
                      {row.paymentStatus !== "已支付" && row.status !== "已取消" && (
                        <button
                          type="button"
                          className={`pay-due-tag${row.status === "已完成" ? " overdue" : ""}`}
                          title={
                            row.status === "已完成"
                              ? `已完成但尚未收款，点击补收 ¥${Number(row.totalFee).toLocaleString("zh-CN")}`
                              : `点击打开收银台，收取 ¥${Number(row.totalFee).toLocaleString("zh-CN")}`
                          }
                          onClick={() => {
                            setPayOrder(row)
                            setPayMethod("微信")
                            setDialogError("")
                          }}
                        >
                          <span className="pay-due-dot"></span>
                          待收款 ¥{Number(row.totalFee).toLocaleString("zh-CN")}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="customer-created">{formatDateTime(row.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button title="查看详情" aria-label={`查看${row.orderNo}`} onClick={() => openDetail(row)}>
                        <Eye />
                      </button>
                      {isAdmin && row.status === "待入店" && (
                        <>
                          <button
                            className="text-action"
                            onClick={() => doAction(row.id, "check-in", `订单 ${row.orderNo} 已确认入店。`)}
                          >
                            确认入店
                          </button>
                          <button
                            className="text-action"
                            onClick={() => doAction(row.id, "cancel", `订单 ${row.orderNo} 已取消。`)}
                          >
                            取消
                          </button>
                        </>
                      )}
                      {isAdmin && row.status === "寄养中" && (
                        <button
                          className="text-action"
                          onClick={() => doAction(row.id, "check-out", `订单 ${row.orderNo} 已完成离店。`)}
                        >
                          完成离店
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {/* 不足一页时补空行，保持表格高度一致 */}
              {!loading && rows.length > 0 && rows.length < pageSize &&
                Array.from({ length: pageSize - rows.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="empty-row">
                    <td colSpan={8}>&nbsp;</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <h3>暂无匹配记录</h3>
                      <p>请调整搜索或筛选条件，或新建一条寄养订单。</p>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <h3>加载中…</h3>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="customer-table-footer">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            unit="条记录"
            onPageChange={setPage}
          />
        </div>
      </div>

      <p className="customer-notice" role="status">
        {error || notice}
      </p>

      <footer className="dashboard-footer">
        <span>专业照护 · 温暖相伴</span>
        <span>数据实时同步自服务端</span>
      </footer>

      {mode && (
        <dialog ref={dialog} className="customer-dialog" onCancel={closeDialog} onClose={closeDialog}>
          <div className="customer-dialog-heading">
            <h2>{mode === "add" ? "新建寄养订单" : `订单详情：${selected?.orderNo ?? ""}`}</h2>
            <button onClick={close} aria-label="关闭弹窗">
              ×
            </button>
          </div>

          {mode === "view" ? (
            <>
              <dl className="customer-detail">
                {[
                  ["订单编号", selected?.orderNo],
                  ["客户", selected?.customerName],
                  ["宠物", selected?.petName],
                  ["寄养时间", `${selected?.startDate ?? ""} 至 ${selected?.endDate ?? ""}`],
                  ["每日单价", `${selected?.pricePerDay ?? ""} 元`],
                  ["总费用", `${selected?.totalFee ?? ""} 元`],
                  ["状态", selected?.status],
                  ["支付状态", selected?.paymentStatus || "未支付"],
                  ["支付方式", selected?.paymentMethod || "—"],
                  ["支付时间", selected?.paymentTime ? formatDateTime(selected.paymentTime) : "—"],
                  ["特殊备注", selected?.remark || "—"],
                  ["创建时间", selected?.createdAt ? formatDateTime(selected.createdAt) : "—"],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>{value === "" || value === undefined || value === null ? "—" : String(value)}</dd>
                  </div>
                ))}
              </dl>

              <div className="system-tabs" style={{ marginTop: 20 }}>
                <span className="soft-badge">健康记录 {detailHealth.length}</span>
                <span className="soft-badge">服务记录 {detailServices.length}</span>
              </div>
              <div className="dictionary-list">
                {detailHealth.map((h) => (
                  <div key={h.id}>
                    <strong>
                      {h.recordTime} · {h.type}
                    </strong>
                    <p>
                      体温 {h.temperature} ℃ · 精神 {h.spirit} · 食欲 {h.appetite} · 记录人 {h.recorder}
                    </p>
                  </div>
                ))}
                {detailServices.map((s) => (
                  <div key={s.id}>
                    <strong>
                      {s.serviceTime} · {s.serviceName}
                    </strong>
                    <p>
                      {s.description || "暂未填写"} · 看护人 {s.keeper}
                    </p>
                  </div>
                ))}
                {detailHealth.length === 0 && detailServices.length === 0 && (
                  <div>
                    <strong>暂无关联记录</strong>
                    <p>该订单还没有健康记录或服务记录。</p>
                  </div>
                )}
              </div>

              {isAdmin && selected?.status === "待入店" && (
                <div className="dialog-actions">
                  <button className="primary-action" onClick={() => doAction(selected.id, "check-in", `订单 ${selected.orderNo} 已确认入店。`)}>
                    确认入店
                  </button>
                  <button className="secondary-action" onClick={() => doAction(selected.id, "cancel", `订单 ${selected.orderNo} 已取消。`)}>
                    取消订单
                  </button>
                </div>
              )}
              {isAdmin && selected?.status === "寄养中" && (
                <div className="dialog-actions">
                  <button className="primary-action" onClick={() => doAction(selected.id, "check-out", `订单 ${selected.orderNo} 已完成离店。`)}>
                    完成离店
                  </button>
                </div>
              )}
              {selected?.paymentStatus !== "已支付" && selected?.status !== "已取消" && (
                <div className="dialog-actions">
                  <button className="primary-action pay-dialog-btn" onClick={() => { setPayOrder(selected); setPayMethod("微信"); setDialogError("") }}>
                    立即支付 ¥{selected?.totalFee}
                  </button>
                </div>
              )}
              <div className="dialog-actions">
                <button className="secondary-action" onClick={close}>
                  关闭
                </button>
              </div>
            </>
          ) : (
            <form className="customer-form" onSubmit={save}>
              <p>选择客户后自动带出该客户宠物，系统按寄养天数自动计算总费用。</p>
              <div>
                <label htmlFor="order-customer">客户</label>
                <select
                  id="order-customer"
                  className="business-select form-select"
                  value={draft.customerId}
                  onChange={(e) => onCustomerChange(e.target.value)}
                  required
                >
                  <option value="">请选择客户</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}（{c.phone}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="order-pet">宠物</label>
                <select
                  id="order-pet"
                  className="business-select form-select"
                  value={draft.petId}
                  onChange={(e) => setDraft({ ...draft, petId: e.target.value })}
                  required
                  disabled={!draft.customerId}
                >
                  <option value="">{draft.customerId ? "请选择宠物" : "请先选择客户"}</option>
                  {formPets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}（{p.breed}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="order-start">寄养开始日期</label>
                <input
                  id="order-start"
                  className="business-form-input"
                  type="date"
                  value={draft.startDate}
                  onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="order-end">寄养结束日期</label>
                <input
                  id="order-end"
                  className="business-form-input"
                  type="date"
                  value={draft.endDate}
                  onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label htmlFor="order-price">单日单价（元）</label>
                <input
                  id="order-price"
                  className="business-form-input"
                  type="number"
                  min="0"
                  step="any"
                  value={draft.pricePerDay}
                  onChange={(e) => setDraft({ ...draft, pricePerDay: e.target.value })}
                  required
                  placeholder="请输入单日单价"
                />
              </div>
              <div>
                <label htmlFor="order-fee">总费用（自动计算）</label>
                <input
                  id="order-fee"
                  className="business-form-input"
                  value={
                    calcFee(draft.startDate, draft.endDate, draft.pricePerDay)
                      ? `¥${calcFee(draft.startDate, draft.endDate, draft.pricePerDay)}`
                      : "—"
                  }
                  disabled
                />
              </div>
              <div>
                <label htmlFor="order-remark">特殊寄养备注</label>
                <input
                  id="order-remark"
                  className="business-form-input"
                  value={draft.remark}
                  onChange={(e) => setDraft({ ...draft, remark: e.target.value })}
                  maxLength={200}
                  placeholder="如喂食习惯、遛狗频率等"
                />
              </div>
              {dialogError && <p role="alert">{dialogError}</p>}
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={close}>
                  取消
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  保存订单
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}

      {/* 支付弹窗 - 收银台 */}
      {payOrder && (
        <dialog ref={payDialogRef} className="pay-dialog-modal" onClick={(e) => { if (e.target === e.currentTarget) setPayOrder(null) }}>
          <div className="pay-checkout">
            {/* 顶部标题栏 */}
            <div className="pay-header">
              <div className="pay-header-left">
                <img src="./images/logo.png" alt="" className="pay-header-logo" />
                <div>
                  <h3>收银台</h3>
                  <p>毛球旅馆 · 订单支付</p>
                </div>
              </div>
              <button className="pay-close" onClick={() => setPayOrder(null)} disabled={paying}>×</button>
            </div>

            {/* 金额展示 */}
            <div className="pay-amount-section">
              <span className="pay-amount-label">应付金额</span>
              <div className="pay-amount-value">
                <span className="pay-currency">¥</span>
                <span className="pay-number">{payOrder.totalFee}</span>
              </div>
              <div className="pay-order-meta">
                <span>订单号：{payOrder.orderNo}</span>
                <span>{payOrder.customerName} · {payOrder.petName}</span>
              </div>
            </div>

            {/* 支付方式切换 */}
            <div className="pay-method-tabs">
              <button
                type="button"
                className={`pay-method-tab wechat ${payMethod === "微信" ? "active" : ""}`}
                onClick={() => setPayMethod("微信")}
                aria-label="微信支付"
                title="微信支付"
              >
                <img src="./images/wechat-icon.png" alt="微信支付" className="pay-method-icon-img" />
              </button>
              <button
                type="button"
                className={`pay-method-tab alipay ${payMethod === "支付宝" ? "active" : ""}`}
                onClick={() => setPayMethod("支付宝")}
                aria-label="支付宝支付"
                title="支付宝支付"
              >
                <img src="./images/alipay-icon.png" alt="支付宝支付" className="pay-method-icon-img" />
              </button>
            </div>

            {/* 二维码扫码区域 */}
            {!paying && (
              <div className="pay-qr-section">
                <div className="pay-qr-wrapper">
                  <img
                    src={payMethod === "微信" ? "./images/wechat-qr.png" : "./images/alipay-qr.png"}
                    alt={`${payMethod}支付二维码`}
                    className="pay-qr-image"
                  />
                  <div className="pay-qr-scan-line"></div>
                </div>
                <p className="pay-qr-tip">
                  请使用<span style={{ color: payMethod === "微信" ? "#07C160" : "#1677FF", fontWeight: 600 }}>{payMethod}</span>扫码支付
                </p>
                <button className="pay-simulate-btn" onClick={doPay}>
                  模拟扫码完成支付
                </button>
              </div>
            )}

            {/* 支付中动画 */}
            {paying && (
              <div className="pay-processing">
                <div className="pay-processing-ring"></div>
                <p>正在处理支付...</p>
                <span>请稍候，勿关闭窗口</span>
              </div>
            )}

            {/* 错误提示 */}
            {dialogError && <p role="alert" className="pay-error-text">{dialogError}</p>}

            {/* 底部 */}
            <div className="pay-footer">
              <button className="pay-later" onClick={() => setPayOrder(null)} disabled={paying}>
                稍后支付
              </button>
            </div>
          </div>
        </dialog>
      )}
    </section>
  )
}
