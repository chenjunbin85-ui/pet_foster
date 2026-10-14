import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { Eye, Pen, Search, Trash2 } from "reicon-react"
import { formatDateTime } from "@/lib/utils"
import {
  customerCreate,
  customerDelete,
  customerPage,
  customerUpdate,
  type CustomerVO,
} from "@/api"
import { Pagination } from "@/components/Pagination"
import { useDynamicPageSize } from "@/hooks/useDynamicPageSize"

type Mode = "add" | "view" | "edit" | "delete" | null

const EMPTY_DRAFT = { name: "", phone: "", address: "", remark: "" }

interface CustomersPageProps {
  quickAction?: "add" | null
  onQuickActionDone?: () => void
}

export function CustomersPage({ quickAction, onQuickActionDone }: CustomersPageProps = {}) {
  const pageSize = useDynamicPageSize()
  const [customers, setCustomers] = useState<CustomerVO[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [mode, setMode] = useState<Mode>(null)
  const [selected, setSelected] = useState<CustomerVO | null>(null)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const timer = useRef<number | undefined>(undefined)

  const load = useCallback(async (targetPage: number, keyword: string) => {
    setLoading(true)
    try {
      const result = await customerPage(targetPage, pageSize, keyword || undefined)
      setCustomers(result.records)
      setTotal(result.total)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "客户列表加载失败")
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  useEffect(() => {
    void load(page, query)
  }, [load, page, query])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (mode) dialog.current?.showModal()
  }, [mode])

  // 首页快捷入口触发：自动打开新增弹窗
  useEffect(() => {
    if (quickAction === "add") {
      setDraft(EMPTY_DRAFT)
      setSelected(null)
      setMode("add")
    }
  }, [quickAction])

  const closeDialog = useCallback(() => {
    setMode(null)
    onQuickActionDone?.()
  }, [onQuickActionDone])

  /** 输入即搜（250ms 防抖），回车立即搜索 */
  const onQueryChange = (value: string) => {
    setInput(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setQuery(value)
      setPage(1)
    }, 250)
  }

  const searchNow = () => {
    window.clearTimeout(timer.current)
    setQuery(input)
    setPage(1)
  }

  const clearQuery = () => {
    window.clearTimeout(timer.current)
    setInput("")
    setQuery("")
    setPage(1)
  }

  const open = (next: NonNullable<Mode>, customer?: CustomerVO) => {
    setSelected(customer ?? null)
    setDraft(
      customer
        ? {
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? "",
            remark: customer.remark ?? "",
          }
        : EMPTY_DRAFT
    )
    setError("")
    setMode(next)
  }

  const close = () => {
    dialog.current?.close()
    closeDialog()
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      address: draft.address.trim(),
      remark: draft.remark.trim(),
    }
    if (!payload.name || !payload.phone) {
      setError("客户姓名与联系电话为必填项")
      return
    }
    setSaving(true)
    try {
      if (mode === "edit" && selected) {
        await customerUpdate(selected.id, payload)
        setNotice("客户信息已更新。")
      } else {
        await customerCreate(payload)
        setNotice("新客户已添加。")
      }
      close()
      await load(page, query)
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await customerDelete(selected.id)
      setNotice("客户信息已删除。")
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
    <section className="customers-page">
      <div className="dashboard-welcome">
        <div>
          <span className="section-kicker">客户档案</span>
          <h1>每一份信任，都用心记录。</h1>
          <p>管理客户联系信息，让每一次沟通更安心。</p>
        </div>
        <button className="primary-action" onClick={() => open("add")}>
          ＋ 新增客户
        </button>
      </div>

      <div className="customer-list">
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              客户列表 <span className="count-badge">{total}</span>
            </h2>
            <p>客户信息集中管理</p>
          </div>
          <div className="customer-search">
            <Search />
            <input
              aria-label="按客户姓名或手机号搜索"
              placeholder="按客户姓名 / 手机号搜索"
              value={input}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  searchNow()
                }
              }}
            />
            {input && (
              <button onClick={clearQuery} aria-label="清空搜索">
                ×
              </button>
            )}
          </div>
        </div>

        <div className="customer-table-scroll">
          <table className="customer-table">
            <thead>
              <tr>
                {["客户编号", "姓名", "联系电话", "居住地址", "备注", "创建时间", "操作"].map((text) => (
                  <th key={text} scope="col">
                    {text}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <span className="customer-id">{String(customer.id).padStart(3, "0")}</span>
                  </td>
                  <td>
                    <div className="customer-name">
                      <strong>{customer.name}</strong>
                    </div>
                  </td>
                  <td className="customer-phone">{customer.phone}</td>
                  <td>{customer.address || "暂未填写"}</td>
                  <td>{customer.remark || "—"}</td>
                  <td className="customer-created">{formatDateTime(customer.createdAt)}</td>
                  <td>
                    <div className="row-actions">
                      <button aria-label={`查看${customer.name}`} title="查看详情" onClick={() => open("view", customer)}>
                        <Eye />
                      </button>
                      <button aria-label={`编辑${customer.name}`} title="编辑客户" onClick={() => open("edit", customer)}>
                        <Pen />
                      </button>
                      <button
                        className="delete-action"
                        aria-label={`删除${customer.name}`}
                        title="删除客户"
                        onClick={() => open("delete", customer)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {/* 不足一页时补空行，保持表格高度一致 */}
              {!loading && customers.length > 0 && customers.length < pageSize &&
                Array.from({ length: pageSize - customers.length }).map((_, i) => (
                  <tr key={`empty-${i}`} className="empty-row">
                    <td colSpan={7}>&nbsp;</td>
                  </tr>
                ))}
              {!loading && customers.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <h3>{query ? "未找到匹配的客户" : "暂无客户信息"}</h3>
                      <p>{query ? "试试其他姓名或手机号，或清空搜索。" : "点击“新增客户”建立第一份客户档案。"}</p>
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
            unit="位客户"
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
        <dialog
          ref={dialog}
          className="customer-dialog"
          onCancel={closeDialog}
          onClose={closeDialog}
        >
          <div className="customer-dialog-heading">
            <h2>{({ add: "新增客户", view: "客户详情", edit: "编辑客户", delete: "删除客户" } as const)[mode]}</h2>
            <button onClick={close} aria-label="关闭弹窗">
              ×
            </button>
          </div>

          {mode === "delete" ? (
            <>
              <p>确定删除“{selected?.name}”的客户信息吗？此操作不可撤销。</p>
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
                  ["客户编号", String(selected?.id ?? "").padStart(3, "0")],
                  ["姓名", selected?.name],
                  ["联系电话", selected?.phone],
                  ["居住地址", selected?.address || "暂未填写"],
                  ["备注", selected?.remark || "—"],
                  ["创建时间", selected?.createdAt],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
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
              <p>请填写客户的基本联系信息。</p>
              <label htmlFor="customer-name">
                姓名 <span className="required-mark">必填</span>
              </label>
              <input
                id="customer-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                required
                maxLength={30}
                placeholder="请输入客户姓名"
              />
              <label htmlFor="customer-phone">
                联系电话 <span className="required-mark">必填</span>
              </label>
              <input
                id="customer-phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                required
                maxLength={20}
                placeholder="请输入手机号码"
              />
              <label htmlFor="customer-address">居住地址</label>
              <input
                id="customer-address"
                value={draft.address}
                onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                maxLength={150}
                placeholder="请输入居住地址（选填）"
              />
              <label htmlFor="customer-remark">备注</label>
              <input
                id="customer-remark"
                value={draft.remark}
                onChange={(e) => setDraft({ ...draft, remark: e.target.value })}
                maxLength={150}
                placeholder="补充说明（选填）"
              />
              {error && <p role="alert">{error}</p>}
              <div className="dialog-actions">
                <button type="button" className="secondary-action" onClick={close}>
                  取消
                </button>
                <button className="primary-action" type="submit" disabled={saving}>
                  保存客户
                </button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </section>
  )
}
