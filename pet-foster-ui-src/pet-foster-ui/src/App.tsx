import { useEffect, useMemo, useState } from "react"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { LoadingScreen } from "@/components/LoadingScreen"
import { LoginPage } from "@/components/LoginPage"
import { AppLayout, ROLE_LABELS, type PageKey } from "@/components/AppLayout"
import { RoleSwitchDialog } from "@/components/RoleSwitchDialog"
import { DashboardPage } from "@/components/DashboardPage"
import { CustomersPage } from "@/components/CustomersPage"
import { PetsPage } from "@/components/PetsPage"
import { OrdersPage } from "@/components/OrdersPage"
import { HealthPage } from "@/components/HealthPage"
import { ServicesPage } from "@/components/ServicesPage"
import { StatsPage } from "@/components/StatsPage"
import { SystemPage } from "@/components/SystemPage"
import { loginApi, getCurrentUser, setToken, clearToken, getToken, type Role } from "@/api"
import {
  resolveCapabilities, hasWebWorkbench, normalizePositions, POSITION_LABELS,
  type WebModule,
} from "@/lib/webPermissions"

const LS = {
  role: "pet_foster_role",
  userName: "pet_foster_user_name",
  page: "pet_foster_page",
  positions: "pet_foster_positions",
}

/** 纯 DRIVER 等外勤岗位：登录端点与小程序共用，Web 端只在这里拦进入，不挡登录。 */
function NoWebWorkbench({ label, onLogout }: { label: string; onLogout: () => void }) {
  return (
    <div className="no-web-workbench">
      <div className="no-web-workbench-card">
        <span className="section-kicker">员工端专用</span>
        <h1>当前岗位没有 Web 工位。</h1>
        <p>
          「{label}」的接送任务、到场交接与服务核销都在<strong>微信小程序员工端</strong>完成。
          按 PRD 3.2，该岗位在 Web 后台不开放任何页面；如需查询请由前台或店长代查。
        </p>
        <button className="primary-action" onClick={onLogout}>退出登录，改用小程序</button>
      </div>
    </div>
  )
}

export function App() {
  // 有登录态时跳过加载页（资源已缓存，直接进入）；首次进入显示加载页
  const [loading, setLoading] = useState(() => !getToken())
  const [loggedIn, setLoggedIn] = useState(() => !!getToken())
  const [role, setRole] = useState<Role>(() => (localStorage.getItem(LS.role) as Role) || "admin")
  const [userName, setUserName] = useState(() => localStorage.getItem(LS.userName) || "系统管理员")
  // 岗位代码（逗号分隔）：登录时由后端下发，刷新时用 /api/auth/info 校正，调岗即时生效
  const [positions, setPositions] = useState(() => localStorage.getItem(LS.positions) || "")
  const [page, setPage] = useState<PageKey>(() => {
    const saved = localStorage.getItem(LS.page) as PageKey | null
    const savedRole = (localStorage.getItem(LS.role) as Role) || "admin"
    const caps = resolveCapabilities(savedRole, localStorage.getItem(LS.positions) || "")
    if (saved && caps[saved as WebModule] !== "none") return saved
    return savedRole === "admin" ? "stats" : "dashboard"
  })
  const capabilities = useMemo(() => resolveCapabilities(role, positions), [role, positions])
  // 待切换的目标角色，非空时展示密码校验浮窗
  const [switchTarget, setSwitchTarget] = useState<Role | null>(null)
  // 快捷操作：从首页快捷入口点击后，导航到对应页面并自动打开新增弹窗
  const [quickAction, setQuickAction] = useState<PageKey | null>(null)
  // 从统计分析卡片点击进入订单流水时的初始状态筛选
  const [ordersStatus, setOrdersStatus] = useState("")

  // 调岗后无需重新登录：刷新身份快照里的岗位（PRD 3.7 多端同步）
  useEffect(() => {
    if (!loggedIn) return
    getCurrentUser()
      .then((info) => {
        const raw = (info as { positions?: string } | undefined)?.positions
        if (typeof raw === "string" && raw && raw !== positions) {
          setPositions(raw)
          localStorage.setItem(LS.positions, raw)
          // 岗位变更后若当前页面已不可见，退回默认落地页
          const next = resolveCapabilities(role, raw)
          if (next[page as WebModule] === "none") setPage(role === "admin" ? "stats" : "dashboard")
        }
      })
      .catch(() => { /* 网络异常时沿用本地快照，不阻断使用 */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn])

  const navigate = (p: PageKey, status?: string) => {
    setPage(p)
    localStorage.setItem(LS.page, p)
    if (p === "orders") setOrdersStatus(status ?? "")
  }

  /** 首页快捷入口：导航到对应页面并自动打开新增弹窗 */
  const handleQuickAction = (p: PageKey) => {
    if (capabilities[p as WebModule] !== "write") {
      toast.info("当前岗位在该模块只有只读权限")
      navigate(p)
      return
    }
    setQuickAction(p)
    navigate(p)
  }

  const clearQuickAction = () => setQuickAction(null)

  const saveIdentity = (r: Role, name: string, rawPositions?: string) => {
    const p = rawPositions || (r === "admin" ? "OWNER" : "")
    setRole(r)
    setUserName(name)
    setPositions(p)
    localStorage.setItem(LS.role, r)
    localStorage.setItem(LS.userName, name)
    localStorage.setItem(LS.positions, p)
  }

  const handleLogin = async (username: string, password: string) => {
    // 登录失败会直接抛出，由登录页在表单内提示（不额外 toast，避免重复提示）
    const result = await loginApi(username, password)
    setToken(result.token)
    const r = (result.userInfo.role as Role) || "staff"
    const name = result.userInfo.name || result.userInfo.username
    saveIdentity(r, name, result.userInfo.positions)
    // 管理员默认展示界面为统计分析，工作人员为系统首页
    const landing: PageKey = r === "admin" ? "stats" : "dashboard"
    localStorage.setItem(LS.page, landing)
    setLoggedIn(true)
    setPage(landing)
    toast.success("登录成功")
  }

  /** 点击角色菜单：只发起切换请求，由浮窗完成密码校验后才真正切换 */
  const handleRequestSwitchRole = (r: Role) => {
    if (r === role) {
      toast.info(`当前已是${ROLE_LABELS[r]}账号`)
      return
    }
    setSwitchTarget(r)
  }

  /** 密码校验：使用目标账号登录，校验真实角色与目标一致后才切换 */
  const handleConfirmSwitchRole = async (username: string, password: string) => {
    const target = switchTarget
    if (!target) return

    const result = await loginApi(username, password)
    const realRole = (result.userInfo.role as Role) || "staff"

    // 角色权限校验：账号真实角色必须与目标角色一致，防止越权切换
    if (realRole !== target) {
      throw new Error(`该账号的角色为「${ROLE_LABELS[realRole]}」，无法切换为「${ROLE_LABELS[target]}」`)
    }

    // 校验通过：换发新 token，保证前端角色与后端接口权限一致
    setToken(result.token)
    saveIdentity(realRole, result.userInfo.name || result.userInfo.username, result.userInfo.positions)
    const next = resolveCapabilities(realRole, result.userInfo.positions)
    if (next[page as WebModule] === "none") navigate(realRole === "admin" ? "stats" : "dashboard")
    setSwitchTarget(null)
    toast.success(`已切换为${ROLE_LABELS[realRole]}：${result.userInfo.name || result.userInfo.username}`)
  }

  const handleLogout = () => {
    clearToken()
    Object.values(LS).forEach((k) => localStorage.removeItem(k))
    setPositions("")
    setLoggedIn(false)
  }

  if (loading) {
    return <LoadingScreen onDone={() => setLoading(false)} />
  }

  if (!loggedIn) {
    return (
      <>
        <LoginPage onLogin={handleLogin} />
        <Toaster position="top-center" richColors />
      </>
    )
  }

  // 登录端点与小程序员工端共用，不能在登录时拒绝；这里按岗位拦住「进入 Web 工作区」
  if (!hasWebWorkbench(capabilities)) {
    const label = normalizePositions(role, positions).map((p) => POSITION_LABELS[p]).join("、") || "未分配岗位"
    return <NoWebWorkbench label={label} onLogout={handleLogout} />
  }

  return (
    <>
      <AppLayout
        role={role} userName={userName} page={page} capabilities={capabilities}
        positionLabel={normalizePositions(role, positions).map((p) => POSITION_LABELS[p]).join("、")}
        onNavigate={navigate} onRequestSwitchRole={handleRequestSwitchRole} onLogout={handleLogout}
        bodyClassName={page === "dashboard" ? "home-dashboard-body" : page === "stats" ? "stats-dashboard-body" : undefined}
      >
        {page === "dashboard" && <DashboardPage role={role} onNavigate={navigate} onQuickAction={handleQuickAction} />}
        {page === "customers" && <CustomersPage readOnly={capabilities.customers !== "write"} quickAction={quickAction === "customers" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "pets" && <PetsPage readOnly={capabilities.pets !== "write"} quickAction={quickAction === "pets" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "orders" && <OrdersPage role={role} readOnly={capabilities.orders !== "write"} initialStatus={ordersStatus} onBack={() => navigate(role === "admin" ? "stats" : "dashboard")} quickAction={quickAction === "orders" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "health" && <HealthPage readOnly={capabilities.health !== "write"} quickAction={quickAction === "health" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "services" && <ServicesPage readOnly={capabilities.services !== "write"} quickAction={quickAction === "services" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "stats" && <StatsPage onNavigate={(status?: string) => navigate("orders", status)} />}
        {page === "system" && <SystemPage role={role} />}
      </AppLayout>
      <RoleSwitchDialog
        target={switchTarget}
        roleLabel={ROLE_LABELS}
        onOpenChange={(open) => { if (!open) setSwitchTarget(null) }}
        onSubmit={handleConfirmSwitchRole}
      />
      <Toaster position="top-center" richColors />
    </>
  )
}

export default App
