import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, Pen, Search, Trash2 } from "reicon-react"
import {
  customerPage,
  petCreate,
  petDelete,
  petPage,
  petUpdate,
  type CustomerVO,
  type PetVO,
} from "@/api"
import { Pagination } from "@/components/Pagination"
import { useDynamicPageSize } from "@/hooks/useDynamicPageSize"

type Mode = "add" | "view" | "edit" | "delete" | null

const EMPTY = {
  name: "",
  customerId: "",
  breed: "",
  gender: "公",
  age: "",
  weight: "",
  color: "",
  vaccine: "",
  history: "",
}

interface PetsPageProps {
  quickAction?: "add" | null
  onQuickActionDone?: () => void
}

export function PetsPage({ quickAction, onQuickActionDone }: PetsPageProps = {}) {
  const pageSize = useDynamicPageSize()
  const [rows, setRows] = useState<PetVO[]>([])
  const [owners, setOwners] = useState<CustomerVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<PetVO | null>(null)
  const [draft, setDraft] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const ownerName = useCallback(
    (id: string) => owners.find((c) => c.id === id)?.name ?? id,
    [owners]
  )

  const load = useCallback(async (targetPage: number, keyword: string) => {
    setLoading(true)
    try {
      const result = await petPage(targetPage, pageSize, undefined, keyword || undefined)
      setRows(result.records)
      setTotal(result.total)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "宠物档案加载失败")
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    void load(page, query)
  }, [load, page, query])

  useEffect(() => {
    customerPage(1, 200)
      .then((r) => setOwners(r.records))
      .catch(() => setOwners([]))
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

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onQueryChange = (value: string) => {
    setInput(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setQuery(value)
      setPage(1)
    }, 250)
  }

  const open = (next: NonNullable<Mode>, row?: PetVO) => {
    setSelected(row ?? null)
    setDialogError("")
    setDraft(
      row
        ? {
            name: row.name,
            customerId: row.customerId,
            breed: row.breed ?? "",
            gender: row.gender ?? "公",
            age: row.age === undefined || row.age === null ? "" : String(row.age),
            weight: row.weight === undefined || row.weight === null ? "" : String(row.weight),
            color: row.color ?? "",
            vaccine: row.vaccine ?? "",
            history: row.history ?? "",
          }
        : { ...EMPTY, customerId: owners[0]?.id ?? "" }
    )
    setMode(next)
  }

  const close = () => {
    dialog.current?.close()
    closeDialog()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft.name.trim() || !draft.customerId || !draft.breed.trim()) {
      setDialogError("宠物名、所属主人与品种为必填项")
      return
    }
    const payload = {
      name: draft.name.trim(),
      customerId: draft.customerId,
      breed: draft.breed.trim(),
      gender: draft.gender,
      age: draft.age === "" ? 0 : Number(draft.age),
      weight: draft.weight === "" ? 0 : Number(draft.weight),
      color: draft.color.trim(),
      vaccine: draft.vaccine.trim(),
      history: draft.history.trim(),
    }
    setSaving(true)
    try {
      if (mode === "edit" && selected) {
        await petUpdate(selected.id, payload)
        setNotice("宠物档案已更新。")
      } else {
        await petCreate(payload)
        setNotice("宠物档案已新增。")
      }
      close()
      await load(page, query)
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
      await petDelete(selected.id)
      setNotice("宠物档案已删除。")
      close()
      await load(page, query)
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
          <span className="section-kicker">宠物档案管理</span>
          <h1>认识每一位小伙伴。</h1>
          <p>从基本信息到疫苗情况，建立完整的宠物照护档案。</p>
        </div>
        <button className="primary-action" onClick={() => open("add")}>
          ＋ 新增宠物档案
        </button>
      </div>

      <div className="customer-list">
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              宠物档案 <span className="count-badge">{total}</span>
            </h2>
            <p>集中管理每一份照护信息</p>
          </div>
          <div className="customer-search">
            <Search />
            <input
              aria-label="搜索宠物档案"
              placeholder="按宠物名搜索"
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
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table business-table pets-table">
            <thead>
              <tr>
                {["宠物名", "所属主人", "品种", "性别", "年龄（岁）", "体重（千克）", "疫苗情况", "操作"].map(
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
                  <td>
                    <div className="customer-name">
                      <strong>{row.name}</strong>
                    </div>
                  </td>
                  <td>{ownerName(row.customerId)}</td>
                  <td>{row.breed}</td>
                  <td>
                    <span className="soft-badge">{row.gender}</span>
                  </td>
                  <td>{row.age}</td>
                  <td>{row.weight}</td>
                  <td>{row.vaccine || "暂未填写"}</td>
                  <td>
                    <div className="row-actions">
                      <button title="查看详情" aria-label={`查看${row.name}`} onClick={() => open("view", row)}>
                        <Eye />
                      </button>
                      <button title="编辑档案" aria-label={`编辑${row.name}`} onClick={() => open("edit", row)}>
                        <Pen />
                      </button>
                      <button
                        className="delete-action"
                        title="删除档案"
                        aria-label={`删除${row.name}`}
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
                    <td colSpan={8}>&nbsp;</td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state">
                      <h3>{query ? "未找到匹配的宠物" : "暂无宠物档案"}</h3>
                      <p>{query ? "试试其他宠物名，或清空搜索。" : "点击“新增宠物档案”建立第一份宠物资料。"}</p>
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
            <h2>{({ add: "新增宠物档案", view: "宠物详情", edit: "编辑档案", delete: "删除档案" } as const)[mode]}</h2>
            <button onClick={close} aria-label="关闭弹窗">
              ×
            </button>
          </div>

          {mode === "delete" ? (
            <>
              <p>确定删除“{selected?.name}”的宠物档案吗？此操作不可撤销。</p>
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
                  ["宠物名", selected?.name],
                  ["所属主人", selected ? ownerName(selected.customerId) : ""],
                  ["品种", selected?.breed],
                  ["性别", selected?.gender],
                  ["年龄（岁）", selected?.age],
                  ["体重（千克）", selected?.weight],
                  ["毛色", selected?.color || "暂未填写"],
                  ["疫苗情况", selected?.vaccine || "暂未填写"],
                  ["既往病史", selected?.history || "暂无"],
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
              <p>请填写宠物的基础档案信息。</p>
              <div>
                <label htmlFor="pet-name">宠物名</label>
                <input
                  id="pet-name"
                  className="business-form-input"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                  maxLength={30}
                  placeholder="请输入宠物名"
                />
              </div>
              <div>
                <label htmlFor="pet-owner">所属主人</label>
                <select
                  id="pet-owner"
                  className="business-select form-select"
                  value={draft.customerId}
                  onChange={(e) => setDraft({ ...draft, customerId: e.target.value })}
                  required
                >
                  <option value="">请选择</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}（{owner.phone}）
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pet-breed">品种</label>
                <input
                  id="pet-breed"
                  className="business-form-input"
                  value={draft.breed}
                  onChange={(e) => setDraft({ ...draft, breed: e.target.value })}
                  required
                  maxLength={50}
                  placeholder="如 金毛寻回犬"
                />
              </div>
              <div>
                <label htmlFor="pet-gender">性别</label>
                <select
                  id="pet-gender"
                  className="business-select form-select"
                  value={draft.gender}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
                >
                  <option>公</option>
                  <option>母</option>
                </select>
              </div>
              <div>
                <label htmlFor="pet-age">年龄（岁）</label>
                <input
                  id="pet-age"
                  className="business-form-input"
                  type="number"
                  step="any"
                  min="0"
                  value={draft.age}
                  onChange={(e) => setDraft({ ...draft, age: e.target.value })}
                  placeholder="请输入年龄"
                />
              </div>
              <div>
                <label htmlFor="pet-weight">体重（千克）</label>
                <input
                  id="pet-weight"
                  className="business-form-input"
                  type="number"
                  step="any"
                  min="0"
                  value={draft.weight}
                  onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
                  placeholder="请输入体重"
                />
              </div>
              <div>
                <label htmlFor="pet-color">毛色</label>
                <input
                  id="pet-color"
                  className="business-form-input"
                  value={draft.color}
                  onChange={(e) => setDraft({ ...draft, color: e.target.value })}
                  maxLength={30}
                  placeholder="请输入毛色（选填）"
                />
              </div>
              <div>
                <label htmlFor="pet-vaccine">疫苗情况</label>
                <input
                  id="pet-vaccine"
                  className="business-form-input"
                  value={draft.vaccine}
                  onChange={(e) => setDraft({ ...draft, vaccine: e.target.value })}
                  maxLength={100}
                  placeholder="如 狂犬疫苗已接种"
                />
              </div>
              <div>
                <label htmlFor="pet-history">既往病史</label>
                <input
                  id="pet-history"
                  className="business-form-input"
                  value={draft.history}
                  onChange={(e) => setDraft({ ...draft, history: e.target.value })}
                  maxLength={200}
                  placeholder="请输入既往病史（选填）"
                />
              </div>
              {dialogError && <p role="alert">{dialogError}</p>}
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={close}>
                  取消
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  保存档案
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </section>
  )
}
