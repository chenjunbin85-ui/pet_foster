import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, Pen, Trash2 } from "reicon-react"
import {
  orderPage,
  petPage,
  serviceCreate,
  serviceDelete,
  servicePage,
  serviceUpdate,
  type OrderVO,
  type PetVO,
  type ServiceRecordVO,
} from "@/api"
import { Pagination } from "@/components/Pagination"
import { useDynamicPageSize } from "@/hooks/useDynamicPageSize"

type Mode = "add" | "view" | "edit" | "delete" | null

const SERVICES = ["日常遛狗", "喂食", "清洁护理", "陪伴玩耍", "洗澡美容"]
const EMPTY = { orderId: "", petId: "", serviceName: "日常遛狗", description: "" }

interface ServicesPageProps {
  quickAction?: "add" | null
  onQuickActionDone?: () => void
}

export function ServicesPage({ quickAction, onQuickActionDone }: ServicesPageProps = {}) {
  const pageSize = useDynamicPageSize()
  const [rows, setRows] = useState<ServiceRecordVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [orderFilter, setOrderFilter] = useState("")
  const [orders, setOrders] = useState<OrderVO[]>([])
  const [pets, setPets] = useState<PetVO[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<ServiceRecordVO | null>(null)
  const [draft, setDraft] = useState(EMPTY)
  const dialog = useRef<HTMLDialogElement>(null)

  const petName = useCallback((id?: string) => pets.find((p) => p.id === id)?.name ?? "—", [pets])
  const orderNo = useCallback((id?: string) => orders.find((o) => o.id === id)?.orderNo ?? "—", [orders])

  const load = useCallback(async (targetPage: number, orderId: string) => {
    setLoading(true)
    try {
      const result = await servicePage(targetPage, pageSize, orderId || undefined)
      setRows(result.records)
      setTotal(result.total)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "服务记录加载失败")
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    void load(page, orderFilter)
  }, [load, page, orderFilter])

  useEffect(() => {
    orderPage(1, 200)
      .then((r) => setOrders(r.records))
      .catch(() => setOrders([]))
    petPage(1, 200)
      .then((r) => setPets(r.records))
      .catch(() => setPets([]))
  }, [])

  useEffect(() => {
    if (mode) dialog.current?.showModal()
  }, [mode])

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

  const open = (next: NonNullable<Mode>, row?: ServiceRecordVO) => {
    setSelected(row ?? null)
    setDialogError("")
    setDraft(
      row
        ? {
            orderId: row.orderId ?? "",
            petId: row.petId ?? "",
            serviceName: row.serviceName ?? "日常遛狗",
            description: row.description ?? "",
          }
        : { ...EMPTY, orderId: orders[0]?.id ?? "", petId: orders[0]?.petId ?? "" }
    )
    setMode(next)
  }

  const close = () => {
    dialog.current?.close()
    closeDialog()
  }

  const onOrderChange = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId)
    setDraft((prev) => ({ ...prev, orderId, petId: order?.petId ?? "" }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.orderId || !draft.description.trim()) {
      setDialogError("请选择关联订单并填写服务内容")
      return
    }
    const payload = {
      orderId: draft.orderId,
      petId: draft.petId,
      serviceName: draft.serviceName,
      description: draft.description.trim(),
    }
    setSaving(true)
    try {
      if (mode === "edit" && selected) {
        await serviceUpdate(selected.id, payload)
        setNotice("服务记录已更新。")
      } else {
        await serviceCreate(payload)
        setNotice("服务记录已登记。")
      }
      close()
      await load(page, orderFilter)
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await serviceDelete(selected.id)
      setNotice("服务记录已删除。")
      close()
      await load(page, orderFilter)
    } catch (e) {
      close()
      setError(e instanceof Error ? e.message : "删除失败")
    } finally {
      setSaving(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <section>
      <div className="dashboard-welcome">
        <div>
          <span className="section-kicker">寄养服务记录</span>
          <h1>用心照护，认真记录。</h1>
          <p>每一次喂养、清洁与陪伴，都是值得记录的关怀。</p>
        </div>
        <button className="primary-action" onClick={() => open("add")}>
          ＋ 登记服务记录
        </button>
      </div>

      <div className="customer-list">
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              服务记录 <span className="count-badge">{total}</span>
            </h2>
            <p>集中管理每一份照护信息</p>
          </div>
          <div className="business-filters">
            <select
              className="business-select"
              aria-label="全部订单"
              value={orderFilter}
              onChange={(e) => {
                setOrderFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">全部订单</option>
              {orders.map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNo}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table business-table service-table">
            <thead>
              <tr>
                {["服务时间", "关联订单", "宠物", "服务项目", "服务内容", "看护人员", "操作"].map((col) => (
                  <th key={col} scope="col">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="customer-created">{row.serviceTime}</td>
                  <td>{orderNo(row.orderId)}</td>
                  <td>
                    <div className="customer-name">
                      <strong>{petName(row.petId)}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="soft-badge">{row.serviceName}</span>
                  </td>
                  <td>{row.description || "暂未填写"}</td>
                  <td>{row.keeper || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button title="查看详情" aria-label="查看服务记录" onClick={() => open("view", row)}>
                        <Eye />
                      </button>
                      <button title="编辑记录" aria-label="编辑服务记录" onClick={() => open("edit", row)}>
                        <Pen />
                      </button>
                      <button
                        className="delete-action"
                        title="删除记录"
                        aria-label="删除服务记录"
                        onClick={() => open("delete", row)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* 不足一页时补空行，保持表格高度一致 */}
              {!loading && rows.length > 0 && rows.length < pageSize &&
                Array.from({ length: pageSize - rows.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="empty-row">
                    <td colSpan={7}>&nbsp;</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <h3>暂无匹配记录</h3>
                      <p>请调整筛选条件，或登记一条新的服务记录。</p>
                      <button className="text-action" onClick={() => setOrderFilter("")}>
                        清空筛选
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={7}>
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
            <h2>{({ add: "登记服务记录", view: "服务记录详情", edit: "编辑服务记录", delete: "删除服务记录" } as const)[mode]}</h2>
            <button onClick={close} aria-label="关闭弹窗">
              ×
            </button>
          </div>

          {mode === "delete" ? (
            <>
              <p>确定删除这条服务记录吗？此操作不可撤销。</p>
              <div className="dialog-actions">
                <button className="secondary-action" onClick={close}>
                  取消
                </button>
                <button className="danger-action" onClick={confirmDelete} disabled={saving}>
                  确认删除
                </button>
              </div>
            </>
          ) : mode === "view" ? (
            <>
              <dl className="customer-detail">
                {[
                  ["服务时间", selected?.serviceTime],
                  ["关联订单", orderNo(selected?.orderId)],
                  ["宠物", petName(selected?.petId)],
                  ["服务项目", selected?.serviceName],
                  ["服务内容", selected?.description || "暂未填写"],
                  ["看护人员", selected?.keeper || "—"],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>{value === "" || value === undefined || value === null ? "—" : String(value)}</dd>
                  </div>
                ))}
              </dl>
              <div className="dialog-actions">
                <button className="primary-action" onClick={close}>
                  关闭
                </button>
              </div>
            </>
          ) : (
            <form className="customer-form" onSubmit={save}>
              <p>选择关联订单后自动带出宠物，填写本次服务内容。</p>
              <div>
                <label htmlFor="service-order">关联订单</label>
                <select
                  id="service-order"
                  className="business-select form-select"
                  value={draft.orderId}
                  onChange={(e) => onOrderChange(e.target.value)}
                  required
                >
                  <option value="">请选择订单</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNo}（{order.customerName} · {order.petName}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="service-pet">宠物</label>
                <input
                  id="service-pet"
                  className="business-form-input"
                  value={draft.petId ? petName(draft.petId) : "请先选择订单"}
                  disabled
                />
              </div>
              <div>
                <label htmlFor="service-name">服务项目</label>
                <select
                  id="service-name"
                  className="business-select form-select"
                  value={draft.serviceName}
                  onChange={(e) => setDraft({ ...draft, serviceName: e.target.value })}
                  required
                >
                  {SERVICES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="service-description">服务内容</label>
                <input
                  id="service-description"
                  className="business-form-input"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  maxLength={150}
                  placeholder="如 上午下午各遛一次，每次 30 分钟"
                />
              </div>
              {dialogError && <p role="alert">{dialogError}</p>}
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={close}>
                  取消
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  保存记录
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </section>
  )
}
