import { useState } from "react"
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
import { loginApi, setToken, clearToken, getToken, type Role } from "@/api"

const LS = {
  role: "pet_foster_role",
  userName: "pet_foster_user_name",
  page: "pet_foster_page",
}

export function App() {
  // 有登录态时跳过加载页（资源已缓存，直接进入）；首次进入显示加载页
  const [loading, setLoading] = useState(() => !getToken())
  const [loggedIn, setLoggedIn] = useState(() => !!getToken())
  const [role, setRole] = useState<Role>(() => (localStorage.getItem(LS.role) as Role) || "admin")
  const [userName, setUserName] = useState(() => localStorage.getItem(LS.userName) || "系统管理员")
  const [page, setPage] = useState<PageKey>(() => {
    const saved = localStorage.getItem(LS.page) as PageKey | null
    // 工作人员不能停留在系统管理页
    if (saved === "system" && localStorage.getItem(LS.role) !== "admin") return "dashboard"
    return saved || "dashboard"
  })
  // 待切换的目标角色，非空时展示密码校验浮窗
  const [switchTarget, setSwitchTarget] = useState<Role | null>(null)
  // 快捷操作：从首页快捷入口点击后，导航到对应页面并自动打开新增弹窗
  const [quickAction, setQuickAction] = useState<PageKey | null>(null)

  const navigate = (p: PageKey) => {
    setPage(p)
    localStorage.setItem(LS.page, p)
  }

  /** 首页快捷入口：导航到对应页面并自动打开新增弹窗 */
  const handleQuickAction = (p: PageKey) => {
    setQuickAction(p)
    navigate(p)
  }

  const clearQuickAction = () => setQuickAction(null)

  const handleLogin = async (username: string, password: string) => {
    // 登录失败会直接抛出，由登录页在表单内提示（不额外 toast，避免重复提示）
    const result = await loginApi(username, password)
    setToken(result.token)
    const r = (result.userInfo.role as Role) || "staff"
    const name = result.userInfo.name || result.userInfo.username
    setRole(r)
    setUserName(name)
    localStorage.setItem(LS.role, r)
    localStorage.setItem(LS.userName, name)
    localStorage.setItem(LS.page, "dashboard")
    setLoggedIn(true)
    setPage("dashboard")
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
    const name = result.userInfo.name || result.userInfo.username
    setRole(realRole)
    setUserName(name)
    localStorage.setItem(LS.role, realRole)
    localStorage.setItem(LS.userName, name)
    // 切换到非管理员后不能再停留在系统管理页
    if (realRole !== "admin" && page === "system") navigate("dashboard")
    setSwitchTarget(null)
    toast.success(`已切换为${ROLE_LABELS[realRole]}：${name}`)
  }

  const handleLogout = () => {
    clearToken()
    localStorage.removeItem(LS.role)
    localStorage.removeItem(LS.userName)
    localStorage.removeItem(LS.page)
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

  return (
    <>
      <AppLayout role={role} userName={userName} page={page} onNavigate={navigate} onRequestSwitchRole={handleRequestSwitchRole} onLogout={handleLogout} bodyClassName={page === "dashboard" ? "home-dashboard-body" : page === "stats" ? "stats-dashboard-body" : undefined}>
        {page === "dashboard" && <DashboardPage onNavigate={navigate} onQuickAction={handleQuickAction} />}
        {page === "customers" && <CustomersPage quickAction={quickAction === "customers" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "pets" && <PetsPage quickAction={quickAction === "pets" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "orders" && <OrdersPage role={role} quickAction={quickAction === "orders" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "health" && <HealthPage quickAction={quickAction === "health" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "services" && <ServicesPage quickAction={quickAction === "services" ? "add" : null} onQuickActionDone={clearQuickAction} />}
        {page === "stats" && <StatsPage />}
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
