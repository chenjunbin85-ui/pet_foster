import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { formatDateTime } from "@/lib/utils"
import {
  dictPage,
  operLogPage,
  userCreate,
  userPage,
  userUpdate,
  type DictVO,
  type OperLogVO,
  type Role,
  type SysUserVO,
} from "@/api"

const TABS = ["用户账号", "操作日志", "数据字典"] as const
type Tab = (typeof TABS)[number]

/** 后端 SysUserDTO：realName / password / status(Integer)，与列表 VO 字段不同，调用处显式转换 */
type UserPayload = {
  username?: string
  password?: string
  realName?: string
  role?: string
  status?: number
  remark?: string
}

export function SystemPage({ role }: { role: Role }) {
  const [tab, setTab] = useState<Tab>("用户账号")
  const [users, setUsers] = useState<SysUserVO[]>([])
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<OperLogVO[]>([])
  const [dicts, setDicts] = useState<DictVO[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [dialogError, setDialogError] = useState("")
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingUser, setEditingUser] = useState<SysUserVO | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, l, d] = await Promise.all([userPage(1, 100), operLogPage(1, 100), dictPage(1, 200)])
      setUsers(u.records)
      setTotal(u.total)
      setLogs(l.records)
      setDicts(d.records)
      setError("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "系统数据加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (role === "admin") void load()
  }, [load, role])

  useEffect(() => {
    if (adding || editingUser) dialog.current?.showModal()
  }, [adding, editingUser])

  const closeDialog = () => {
    dialog.current?.close()
    setAdding(false)
    setEditingUser(null)
  }

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const payload: UserPayload = {
      username: String(data.get("username") ?? "").trim(),
      password: String(data.get("password") ?? "").trim(),
      realName: String(data.get("realName") ?? "").trim(),
      role: String(data.get("role") ?? "staff"),
      status: 1,
      remark: String(data.get("remark") ?? "").trim(),
    }
    if (!payload.username || !payload.realName) {
      setDialogError("请填写用户名与真实姓名")
      return
    }
    if (!editingUser && !payload.password) {
      setDialogError("新增用户时密码不能为空")
      return
    }
    setSaving(true)
    try {
      if (editingUser) {
        const updatePayload: UserPayload = { ...payload }
        if (!updatePayload.password) delete updatePayload.password
        await userUpdate(editingUser.id, updatePayload as unknown as Partial<SysUserVO>)
        setNotice(`已更新用户：${payload.realName}。`)
      } else {
        await userCreate(payload as unknown as Partial<SysUserVO>)
        setNotice(`新增用户：${payload.realName}。`)
      }
      closeDialog()
      await load()
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "保存失败")
    } finally {
      setSaving(false)
    }
  }

  const toggleUser = async (user: SysUserVO) => {
    const next = user.status === "启用" ? 0 : 1
    const payload: UserPayload = {
      username: user.username,
      realName: user.name,
      role: user.role,
      status: next,
      remark: user.remark,
    }
    try {
      await userUpdate(user.id, payload as unknown as Partial<SysUserVO>)
      setNotice(`${next === 1 ? "启用" : "禁用"}用户：${user.name}。`)
      setError("")
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败")
    }
  }

  if (role !== "admin") {
    return (
      <section className="dashboard-card module-preview">
        <span className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2l9 4v6c0 6-9 10-9 10S3 18 3 12V6z M8 12l3 3 5-6" />
          </svg>
        </span>
        <h1>仅管理员可访问</h1>
        <p>当前为工作人员账号，无法管理用户及系统配置。</p>
      </section>
    )
  }

  const dictGroups = Array.from(
    dicts.reduce((map, d) => {
      const list = map.get(d.typeCode) ?? []
      list.push(d)
      map.set(d.typeCode, list)
      return map
    }, new Map<string, DictVO[]>())
  )

  return (
    <section>
      <div className="dashboard-welcome">
        <div>
          <span className="section-kicker">系统管理</span>
          <h1>安全有序，让管理更安心。</h1>
          <p>管理用户权限、查看操作日志与数据字典。</p>
        </div>
        <span className="soft-badge">管理员专属</span>
      </div>

      <div className="system-tab-toolbar">
        <div className="system-tabs" role="tablist" aria-label="系统管理分类">
          {TABS.map((item) => (
            <button
              role="tab"
              aria-selected={tab === item}
              id={`tab-${item}`}
              aria-controls="system-panel"
              key={item}
              onClick={() => setTab(item)}
              className={tab === item ? "active" : ""}
            >
              {item}
            </button>
          ))}
        </div>
        {tab === "用户账号" && (
          <button
            className="primary-action"
            onClick={() => {
              setDialogError("")
              setAdding(true)
            }}
          >
            ＋ 新增用户
          </button>
        )}
      </div>

      <div className="customer-list" role="tabpanel" id="system-panel" aria-labelledby={`tab-${tab}`}>
        <div className="customer-toolbar">
          <div className="customer-list-title">
            <h2>
              {tab}
              <span className="count-badge">
                {tab === "用户账号" ? total : tab === "操作日志" ? logs.length : dicts.length}
              </span>
            </h2>
            <p>
              {tab === "用户账号"
                ? "合理分配权限，协同完成日常照护"
                : tab === "操作日志"
                  ? "系统操作留痕，便于追溯"
                  : "统一业务字段与状态定义"}
            </p>
          </div>
        </div>

        {tab === "用户账号" ? (
          <div className="customer-table-scroll">
            <table className="customer-table system-user-table">
              <colgroup>
                <col style={{ width: "14%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  {["用户名", "真实姓名", "角色", "账号状态", "备注", "操作"].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      <div className="customer-name">
                        <strong>{user.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className="soft-badge">{user.role === "admin" ? "管理员" : "工作人员"}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${user.status === "启用" ? "enabled" : "disabled"}`}>
                        {user.status === "启用" ? "● 启用" : "○ 禁用"}
                      </span>
                    </td>
                    <td>{user.remark || "—"}</td>
                    <td>
                      <div className="system-actions">
                        <button
                          className="system-action-btn edit"
                          onClick={() => {
                            setDialogError("")
                            setEditingUser(user)
                          }}
                          aria-label={`编辑${user.name}`}
                        >
                          编辑
                        </button>
                        <button
                          role="switch"
                          aria-checked={user.status === "启用"}
                          aria-label={`${user.status === "启用" ? "禁用" : "启用"}${user.name}`}
                          className={`account-switch ${user.status === "启用" ? "enabled" : ""}`}
                          onClick={() => toggleUser(user)}
                        >
                          <span />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && users.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-state">
                        <h3>暂无用户</h3>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : tab === "操作日志" ? (
          <div className="system-log">
            {logs.length ? (
              logs.map((log) => (
                <div key={log.id}>
                  <span className="count-badge">{log.module}</span>
                  <p>
                    {log.content}
                    {log.ip ? ` · ${log.ip}` : ""}
                  </p>
                  <span className="soft-badge">{formatDateTime(log.requestTime)}</span>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>暂无操作日志</h3>
                <p>新增用户或切换账号状态后，操作将在这里显示。</p>
              </div>
            )}
          </div>
        ) : (
          <div className="dictionary-list">
            {dictGroups.length ? (
              dictGroups.map(([typeCode, items]) => (
                <div key={typeCode}>
                  <strong>{typeCode}</strong>
                  <p>{items.map((d) => d.label).join("、")}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <h3>暂无数据字典</h3>
              </div>
            )}
          </div>
        )}

        <div className="customer-table-footer">
          <span>系统管理 · 数据实时同步自服务端</span>
          <span>{tab === "用户账号" ? `共 ${total} 个账号` : tab === "操作日志" ? `共 ${logs.length} 条日志` : `共 ${dictGroups.length} 类字典`}</span>
        </div>
      </div>

      <p className="customer-notice" role="status">
        {error || notice}
      </p>

      <footer className="dashboard-footer">
        <span>专业照护 · 温暖相伴</span>
        <span>用心管理每一份信任</span>
      </footer>

      {(adding || editingUser) && (
        <dialog ref={dialog} className="customer-dialog" onCancel={() => { setAdding(false); setEditingUser(null); }} onClose={() => { setAdding(false); setEditingUser(null); }}>
          <div className="customer-dialog-heading">
            <h2>{editingUser ? "编辑用户" : "新增用户"}</h2>
            <button aria-label="关闭弹窗" onClick={closeDialog}>
              ×
            </button>
          </div>
          <form className="customer-form" onSubmit={saveUser}>
            <p>{editingUser ? "修改用户信息，留空密码则不更改。" : "创建后可用新账号登录系统，请牢记密码。"}</p>
            <label htmlFor="new-username">用户名</label>
            <input id="new-username" name="username" required maxLength={30} placeholder="请输入用户名" defaultValue={editingUser?.username} />
            <label htmlFor="new-password">密码{editingUser ? "（留空不修改）" : ""}</label>
            <input id="new-password" name="password" type="password" minLength={editingUser ? 0 : 6} maxLength={30} placeholder={editingUser ? "留空则保持原密码" : "请输入密码（至少 6 位）"} />
            <label htmlFor="new-real-name">真实姓名</label>
            <input id="new-real-name" name="realName" required maxLength={30} placeholder="请输入真实姓名" defaultValue={editingUser?.name} />
            <label htmlFor="new-role">角色</label>
            <select className="business-select form-select" id="new-role" name="role" defaultValue={editingUser?.role ?? "staff"}>
              <option value="staff">工作人员</option>
              <option value="admin">管理员</option>
            </select>
            <label htmlFor="new-remark">备注</label>
            <input id="new-remark" name="remark" maxLength={100} placeholder="补充说明（选填）" defaultValue={editingUser?.remark} />
            {dialogError && <p role="alert">{dialogError}</p>}
            <div className="dialog-actions">
              <button type="button" className="secondary-action" onClick={closeDialog}>
                取消
              </button>
              <button className="primary-action" type="submit" disabled={saving}>
                {editingUser ? "保存修改" : "保存用户"}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}
