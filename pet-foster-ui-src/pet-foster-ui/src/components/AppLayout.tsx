import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Cat,
  ChartBar,
  ClipboardList,
  HandHeart,
  HeartPulse,
  Logout,
  Settings,
  Users,
  Widget,
} from "reicon-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Role } from "@/api"

export type PageKey =
  | "dashboard"
  | "customers"
  | "pets"
  | "orders"
  | "health"
  | "services"
  | "stats"
  | "system"

export const ROLE_LABELS: Record<Role, string> = { admin: "管理员", staff: "工作人员" }

/** 角色切换菜单项：当前角色会被置灰，切换必须先通过密码校验 */
const roleSwitchItems: Array<{ role: Role; label: string }> = [
  { role: "admin", label: "切换为管理员" },
  { role: "staff", label: "切换为工作人员" },
]

interface AppLayoutProps {
  role: Role
  userName: string
  page: PageKey
  onNavigate: (page: PageKey) => void
  /** 发起角色切换请求（由上层弹出密码校验浮窗），组件本身不直接切换角色 */
  onRequestSwitchRole: (role: Role) => void
  onLogout: () => void
  /** 追加到 .dashboard-body 的类名（首页用它挂 .home-dashboard-body 紧凑档样式） */
  bodyClassName?: string
  children: ReactNode
}

const menus: Array<{
  label: string
  adminOnly?: boolean
  items: Array<{ key: PageKey; title: string; icon: typeof Users }>
}> = [
  {
    label: "工作台",
    items: [{ key: "dashboard", title: "系统首页", icon: Widget }],
  },
  {
    label: "业务管理",
    items: [
      { key: "customers", title: "客户信息管理", icon: Users },
      { key: "pets", title: "宠物档案管理", icon: Cat },
      { key: "orders", title: "寄养订单管理", icon: ClipboardList },
      { key: "health", title: "健康档案管理", icon: HeartPulse },
      { key: "services", title: "寄养服务记录", icon: HandHeart },
    ],
  },
  {
    label: "数据统计",
    items: [{ key: "stats", title: "统计分析", icon: ChartBar }],
  },
  {
    label: "系统管理",
    adminOnly: true,
    items: [{ key: "system", title: "系统管理", icon: Settings }],
  },
]

export function AppLayout({
  role,
  userName,
  page,
  onNavigate,
  onRequestSwitchRole,
  onLogout,
  bodyClassName,
  children,
}: AppLayoutProps) {
  const [logoutConfirm, setLogoutConfirm] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [collapseRequested, setCollapseRequested] = useState(false)
  const [sidebarTextHidden, setSidebarTextHidden] = useState(false)
  /* 角色切换菜单的定位锚点。
     需求：菜单右边界与侧边栏右边界对齐（而不是贴「更多操作」按钮）。
     Base UI 默认锚的是 Trigger，所以这里显式把 anchor 指向 .profile 卡片本身，
     再配合 align="end" ⇒ 菜单右边界 = .profile 右边界 = 侧边栏内容右边界。 */
  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reducedMotion) {
      setSidebarCollapsed(collapseRequested)
      setSidebarTextHidden(collapseRequested)
      return
    }
    let timer: number
    if (collapseRequested) {
      setSidebarTextHidden(true)
      timer = window.setTimeout(() => setSidebarCollapsed(true), 140)
    } else {
      setSidebarCollapsed(false)
      timer = window.setTimeout(() => setSidebarTextHidden(false), 240)
    }
    return () => window.clearTimeout(timer)
  }, [collapseRequested])

  return (
    <div className="workspace">
      <aside
        className={`sidebar${sidebarCollapsed ? " is-collapsed" : ""}${sidebarTextHidden ? " text-hidden" : ""}`}
      >
        <div className="sidebar-brand">
          <button
            className="sidebar-logo-toggle"
            onClick={() => setCollapseRequested((value) => !value)}
            aria-label={collapseRequested ? "展开侧边栏" : "收起侧边栏"}
            aria-expanded={!collapseRequested}
            aria-controls="sidebar-navigation"
            title={collapseRequested ? "展开侧边栏" : "收起侧边栏"}
          >
            <img src="./images/logo.png" alt="" decoding="async" />
          </button>
          <div>
            <strong>护宠宝</strong>
            <p>每一份托付，都用心守护</p>
          </div>
        </div>

        <nav id="sidebar-navigation" aria-label="主导航">
          {menus.map((group) => {
            if (group.adminOnly && role !== "admin") return null
            return (
              <div className="nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.items.map((item) => (
                  <button
                    key={item.key}
                    data-nav={item.key}
                    className={page === item.key ? "nav-item selected" : "nav-item"}
                    onClick={() => onNavigate(item.key)}
                    aria-label={item.title}
                    aria-current={page === item.key ? "page" : undefined}
                    title={sidebarCollapsed ? item.title : undefined}
                  >
                    <item.icon />
                    <span className="nav-label">{item.title}</span>
                    {page === item.key && <span className="nav-dot" />}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="profile" ref={profileRef}>
            <span className="avatar">{role === "admin" ? "管" : "员"}</span>
            <div>
              <strong>{userName}</strong>
              <small>{ROLE_LABELS[role]}</small>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button />} aria-label="更多操作" title="更多操作">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="2" />
                  <circle cx="12" cy="12" r="2" />
                  <circle cx="19" cy="12" r="2" />
                </svg>
              </DropdownMenuTrigger>
              {/* anchor 指向 .profile 卡片 + align="end" ⇒ 右边界与侧边栏内容右边界齐平（见 profileRef 注释）。
                  宽度不再写死 w-56：Base UI 会把 --anchor-width 设为锚点（也就是 .profile）的宽度，
                  Popup 自带的 w-(--anchor-width) 正好让菜单与卡片同宽、且随侧边栏宽度自适应。
                  ⚠️ 不要加 alignOffset —— 实测会把菜单再往左推 8px，右边界就对不上了。 */}
              <DropdownMenuContent anchor={profileRef} align="end" side="top" sideOffset={8} className="sidebar-menu">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-2">
                    当前角色：{ROLE_LABELS[role]}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {roleSwitchItems.map((item) => (
                    <DropdownMenuItem
                      key={item.role}
                      /* 「当前角色」这一项语义上就是不可选：交给 Base UI 的 disabled 处理，
                         它会输出 aria-disabled="true" + data-disabled，键盘导航也会跳过它。
                         ⚠️ 之前只挂了一个 CSS 类（role-item-disabled）而没有真正 disabled，
                         导致 layout.spec.ts 的「当前角色的菜单项置灰不可点」长期是红的。 */
                      disabled={item.role === role}
                      onClick={() => onRequestSwitchRole(item.role)}
                      className={`flex items-center justify-between ${item.role === role ? "role-item-disabled" : ""}`}
                    >
                      <span>{item.label}</span>
                      {item.role === role && (
                        <span className="current-role-tag">当前</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setLogoutConfirm(true)}>
                    <Logout />
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p>每一份托付，都用心守护</p>
        </div>
      </aside>

      <main className="workspace-main">
        <div className={bodyClassName ? `dashboard-body ${bodyClassName}` : "dashboard-body"}>{children}</div>
      </main>

      <AlertDialog open={logoutConfirm} onOpenChange={setLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认退出登录？</AlertDialogTitle>
            <AlertDialogDescription>
              退出后需要重新输入账号密码才能进入系统。当前未保存的操作将不会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={onLogout}>确认退出</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
