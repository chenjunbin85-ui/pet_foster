import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, Pen, Trash2 } from "reicon-react"
import {
  healthCreate,
  healthDelete,
  healthPage,
  healthUpdate,
  orderPage,
  petPage,
  type HealthRecordVO,
  type OrderVO,
  type PetVO,
} from "@/api"
import { Pagination } from "@/components/Pagination"
import { useDynamicPageSize } from "@/hooks/useDynamicPageSize"

type Mode = "add" | "view" | "edit" | "delete" | null

const TYPES = ["入店记录", "寄养观测记录", "离店记录"]
const EMPTY = {
  type: "入店记录",
  petId: "",
  orderId: "",
  temperature: "",
  spirit: "",
  appetite: "",
  defecation: "",
  skin: "",
  abnormal: "",
  treatment: "",
}

interface HealthPageProps {
  quickAction?: "add" | null
  onQuickActionDone?: () => void
}

export function HealthPage({ quickAction, onQuickActionDone }: HealthPageProps = {}) {
  const pageSize = useDynamicPageSize()
  const [rows, setRows] = useState<HealthRecordVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [petFilter, setPetFilter] = useState("")
  const [pets, setPets] = useState<PetVO[]>([])
  const [orders, setOrders] = useState<OrderVO[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<HealthRecordVO | null>(null)
  const [draft, setDraft] = useState(EMPTY)
  const dialog = useRef<HTMLDialogElement>(null)

  const petName = useCallback((id?: string) => pets.find((p) => p.id === id)?.name ?? "—", [pets])

  const load = useCallback(async (targetPage: number, petId: string) => {
    setLoading(true)
    try {
      const result = await healthPage(targetPage, pageSize, petId || undefined)
      setRows(result.records)
      setTotal(result.total)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "健康档案加载失败")
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    void load(page, petFilter)
  }, [load, page, petFilter])

  useEffect(() => {
    petPage(1, 200)
      .then((r) => setPets(r.records))
      .catch(() => setPets([]))
    orderPage(1, 200)
      .then((r) => setOrders(r.records))
      .catch(() => setOrders([]))
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

  const availableOrders = draft.petId ? orders.filter((o) => o.petId === draft.petId) : []

  const open = (next: NonNullable<Mode>, row?: HealthRecordVO) => {
    setSelected(row ?? null)
    setDialogError("")
    setDraft(
      row
        ? {
            type: row.type ?? "入店记录",
            petId: row.petId ?? "",
            orderId: row.orderId ?? "",
            temperature: row.temperature ?? "",
            spirit: row.spirit ?? "",
            appetite: row.appetite ?? "",
            defecation: row.defecation ?? "",
            skin: row.skin ?? "",
            abnormal: row.abnormal ?? "",
            treatment: row.treatment ?? "",
          }
        : { ...EMPTY, petId: pets[0]?.id ?? "" }
    )
    setMode(next)
  }

  const close = () => {
    dialog.current?.close()
    closeDialog()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.petId || !draft.type) {
      setDialogError("请选择宠物与记录类型")
      return
    }
    const payload = {
      type: draft.type,
      petId: draft.petId,
      orderId: draft.orderId || undefined,
      temperature: draft.temperature.trim(),
      spirit: draft.spirit.trim(),
      appetite: draft.appetite.trim(),
      defecation: draft.defecation.trim(),
      skin: draft.skin.trim(),
      abnormal: draft.abnormal.trim(),
      treatment: draft.treatment.trim(),
    }
    setSaving(true)
    try {
      if (mode === "edit" && selected) {
        await healthUpdate(selected.id, payload)
        setNotice("健康记录已更新。")
      } else {
        await healthCreate(payload)
        setNotice(`已登记「${draft.type}」`)
      }
      close()
      await load(page, petFilter)
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
      await healthDelete(selected.id)
      setNotice("健康记录已删除。")
      close()
      await load(page, petFilter)
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
          <span className="section-kicker">健康档案管理</span>
          <h1>细心观察，守护每一天。</h1>
          <p>记录体温、精神与饮食，让健康变化有迹可循。</p>
        </div>
        <button className="primary-action" onClick={() => open("add")}>
          ＋ 新增健康记录
        </button>
      </div>

      <div className="customer-list">
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              健康记录 <span className="count-badge">{total}</span>
            </h2>
            <p>集中管理每一份照护信息</p>
          </div>
          <div className="business-filters">
            <select
              className="business-select"
              aria-label="全部宠物"
              value={petFilter}
              onChange={(e) => {
                setPetFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">全部宠物</option>
              {pets.map((pet) => (
                <option key={pet.id} value={pet.id}>
                  {pet.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table business-table">
            <thead>
              <tr>
                {["记录时间", "宠物", "记录类型", "体温（摄氏度）", "精神状态", "食欲", "异常与处理", "记录人", "操作"].map(
                  (col) => (
                    <th key={col} scope="col">
                      {col}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="customer-created">{row.recordTime}</td>
                  <td>
                    <div className="customer-name">
                      <strong>{petName(row.petId)}</strong>
                    </div>
                  </td>
                  <td>
                    <span className="soft-badge">{row.type}</span>
                  </td>
                  <td>{row.temperature || "—"}</td>
                  <td>{row.spirit || "—"}</td>
                  <td>{row.appetite || "—"}</td>
                  <td>
                    {row.abnormal || "无"}
                    {row.treatment ? `（${row.treatment}）` : ""}
                  </td>
                  <td>{row.recorder || "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button title="查看详情" aria-label="查看健康记录" onClick={() => open("view", row)}>
                        <Eye />
                      </button>
                      <button title="编辑记录" aria-label="编辑健康记录" onClick={() => open("edit", row)}>
                        <Pen />
                      </button>
                      <button
                        className="delete-action"
                        title="删除记录"
                        aria-label="删除健康记录"
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
                    <td colSpan={9}>&nbsp;</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <h3>暂无匹配记录</h3>
                      <p>请调整筛选条件，或新增一条健康记录。</p>
                      <button className="text-action" onClick={() => setPetFilter("")}>
                        清空筛选
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9}>
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
            <h2>{({ add: "新增健康记录", view: "健康记录详情", edit: "编辑健康记录", delete: "删除健康记录" } as const)[mode]}</h2>
            <button onClick={close} aria-label="关闭弹窗">
              ×
            </button>
          </div>

          {mode === "delete" ? (
            <>
              <p>确定删除这条健康记录吗？此操作不可撤销。</p>
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
                  ["记录时间", selected?.recordTime],
                  ["宠物", petName(selected?.petId)],
                  ["记录类型", selected?.type],
                  ["体温（摄氏度）", selected?.temperature || "—"],
                  ["精神状态", selected?.spirit || "—"],
                  ["食欲", selected?.appetite || "—"],
                  ["排便", selected?.defecation || "—"],
                  ["皮肤", selected?.skin || "—"],
                  ["异常与处理", selected?.abnormal || "无"],
                  ["处理措施", selected?.treatment || "无"],
                  ["记录人", selected?.recorder || "—"],
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
              <p>记录宠物的体温、精神与饮食情况，便于持续观察健康变化。</p>
              <div>
                <label htmlFor="health-type">记录类型</label>
                <select
                  id="health-type"
                  className="business-select form-select"
                  value={draft.type}
                  onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                  required
                >
                  {TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="health-pet">宠物</label>
                <select
                  id="health-pet"
                  className="business-select form-select"
                  value={draft.petId}
                  onChange={(e) => setDraft({ ...draft, petId: e.target.value, orderId: "" })}
                  required
                >
                  <option value="">请选择宠物</option>
                  {pets.map((pet) => (
                    <option key={pet.id} value={pet.id}>
                      {pet.name}（{pet.breed}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="health-order">关联订单</label>
                <select
                  id="health-order"
                  className="business-select form-select"
                  value={draft.orderId}
                  onChange={(e) => setDraft({ ...draft, orderId: e.target.value })}
                  disabled={!draft.petId}
                >
                  <option value="">{draft.petId ? "选择该宠物的订单（选填）" : "请先选择宠物"}</option>
                  {availableOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.orderNo}（{o.status}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="health-temperature">体温（摄氏度）</label>
                <input
                  id="health-temperature"
                  className="business-form-input"
                  value={draft.temperature}
                  onChange={(e) => setDraft({ ...draft, temperature: e.target.value })}
                  maxLength={10}
                  placeholder="如 38.6"
                />
              </div>
              <div>
                <label htmlFor="health-spirit">精神状态</label>
                <input
                  id="health-spirit"
                  className="business-form-input"
                  value={draft.spirit}
                  onChange={(e) => setDraft({ ...draft, spirit: e.target.value })}
                  maxLength={20}
                  placeholder="如 活泼 / 良好 / 一般"
                />
              </div>
              <div>
                <label htmlFor="health-appetite">食欲</label>
                <input
                  id="health-appetite"
                  className="business-form-input"
                  value={draft.appetite}
                  onChange={(e) => setDraft({ ...draft, appetite: e.target.value })}
                  maxLength={20}
                  placeholder="如 正常 / 略差"
                />
              </div>
              <div>
                <label htmlFor="health-defecation">排便情况</label>
                <input
                  id="health-defecation"
                  className="business-form-input"
                  value={draft.defecation}
                  onChange={(e) => setDraft({ ...draft, defecation: e.target.value })}
                  maxLength={50}
                  placeholder="如 正常"
                />
              </div>
              <div>
                <label htmlFor="health-skin">皮肤状况</label>
                <input
                  id="health-skin"
                  className="business-form-input"
                  value={draft.skin}
                  onChange={(e) => setDraft({ ...draft, skin: e.target.value })}
                  maxLength={50}
                  placeholder="如 无异常"
                />
              </div>
              <div>
                <label htmlFor="health-abnormal">异常情况</label>
                <input
                  id="health-abnormal"
                  className="business-form-input"
                  value={draft.abnormal}
                  onChange={(e) => setDraft({ ...draft, abnormal: e.target.value })}
                  maxLength={100}
                  placeholder="如 无（无需处理）"
                />
              </div>
              <div>
                <label htmlFor="health-treatment">处理措施</label>
                <input
                  id="health-treatment"
                  className="business-form-input"
                  value={draft.treatment}
                  onChange={(e) => setDraft({ ...draft, treatment: e.target.value })}
                  maxLength={100}
                  placeholder="如 无需处理"
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
