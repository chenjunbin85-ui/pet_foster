import { useEffect, useState } from "react"
import { statsDashboard, orderPage, type OrderVO, type DashboardStats } from "@/api"
import { loadWeather, type WeatherInfo } from "@/lib/weather"
import type { PageKey } from "@/components/AppLayout"

interface DashboardPageProps {
  onNavigate: (page: PageKey) => void
  onQuickAction: (page: PageKey) => void
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 天气图标 —— 按「白天/夜间 + 天气现象」选择，避免占位符 */
function WeatherIcon({ weather }: { weather: WeatherInfo }) {
  const { text, isDay } = weather

  // 晴天：白天用太阳，夜间用月亮
  if (text.includes("晴") && !text.includes("阵")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isDay ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </>
        ) : (
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        )}
      </svg>
    )
  }

  // 雨 / 雷
  if (text.includes("雨") || text.includes("雷")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 15a5 5 0 1 1 1-10 7 7 0 0 1 13 3 4 4 0 0 1-1 7" />
        <path d="M8 19v2M12 19v3M16 19v2" />
      </svg>
    )
  }

  // 雪
  if (text.includes("雪")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 15a5 5 0 1 1 1-10 7 7 0 0 1 13 3 4 4 0 0 1-1 7" />
        <path d="M9 19h.01M12 21h.01M15 19h.01M12 18h.01" />
      </svg>
    )
  }

  // 雾
  if (text.includes("雾")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 9h14M3 13h18M6 17h12" />
      </svg>
    )
  }

  // 默认（多云 / 阴 / 未知）：云朵
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 19a5 5 0 1 1 1-10 7 7 0 0 1 13 3 4 4 0 0 1-1 7Z" />
    </svg>
  )
}

/** 首页在用的几个内联 SVG 路径（避免为几个小图标引入图标库依赖） */
/** 快捷入口插图：离线裁好的独立小图（见 public/images/quick-entry/）。
    不沿用设计稿里「SVG <image> + viewBox 从拼图裁格子」的写法 —— 那套 viewBox 坐标是按
    1568×865 写的，实际拼图是 1946×1074，会对不上、裁到隔壁卡片的文字。 */
const SHORTCUT_ICONS: Record<PageKey, string> = {
  orders: "/images/quick-entry/orders.png",
  customers: "/images/quick-entry/customers.png",
  pets: "/images/quick-entry/pets.png",
  health: "/images/quick-entry/health.png",
  services: "/images/quick-entry/services.png",
  stats: "/images/quick-entry/stats.png",
  dashboard: "/images/quick-entry/orders.png",
  system: "/images/quick-entry/stats.png",
}

function ShortcutIllustration({ page }: { page: PageKey }) {
  return <img className="quick-illustration" src={SHORTCUT_ICONS[page]} alt="" loading="lazy" decoding="async" />
}

export function DashboardPage({ onNavigate, onQuickAction }: DashboardPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [pendingOrders, setPendingOrders] = useState<OrderVO[]>([])
  const [fosteringOrders, setFosteringOrders] = useState<OrderVO[]>([])
  const [error, setError] = useState("")
  const [weather, setWeather] = useState<WeatherInfo | null>(null)
  // idle→loading→ready：只在首次加载时显示「定位中」，避免成功后被无谓刷新
  const [weatherState, setWeatherState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    Promise.all([statsDashboard(), orderPage(1, 50, "待入店"), orderPage(1, 50, "寄养中")])
      .then(([s, pending, fostering]) => {
        setStats(s)
        setPendingOrders(pending.records)
        setFosteringOrders(fostering.records)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "数据加载失败"))
  }, [])

  useEffect(() => {
    let alive = true
    loadWeather()
      .then((w) => {
        if (!alive) return
        setWeather(w)
        setWeatherState("ready")
      })
      .catch(() => {
        if (!alive) return
        setWeatherState("error")
      })
    return () => {
      alive = false
    }
  }, [])

  const now = new Date()
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日 ${WEEKDAYS[now.getDay()]}`
  const dateValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const cards = [
    ["寄养中宠物", stats ? String(stats.fosteringCount) : "—", "只", "当前在店的小伙伴"],
    ["待入店订单", stats ? String(stats.pendingCount) : "—", "单", "等待安排入住"],
    ["本月订单", stats ? String(stats.monthlyOrderCount) : "—", "单", "本月累计寄养订单"],
    ["本月寄养金额", stats ? stats.monthlyRevenue.toLocaleString("zh-CN") : "—", "元", "本月累计寄养收入"],
  ]

  // 快捷入口：与设计稿一致的六项（顺序也一致）
  const shortcuts: Array<[string, PageKey]> = [
    ["新建寄养订单", "orders"],
    ["新增客户", "customers"],
    ["新增宠物档案", "pets"],
    ["登记健康记录", "health"],
    ["登记服务记录", "services"],
    ["查看报表", "stats"],
  ]

  return (
    <>
      <section className="dashboard-welcome">
        <div>
          <span className="section-kicker">门店工作台</span>
          <h1>用心照护，从今天开始。</h1>
          <p>每一份托付，都值得被认真对待。今日门店动态，一目了然。</p>
        </div>
        <div className="date-weather">
          <time dateTime={dateValue}>{dateText}</time>
          {weatherState === "ready" && weather ? (
            <div className="weather-status" title={`${weather.city || "当前位置"} · ${weather.text}`}>
              <WeatherIcon weather={weather} />
              <span className="weather-text">{weather.text}</span>
              <span className="weather-temperature">{weather.temperature}°</span>
              {weather.city && <span className="weather-city">{weather.city}</span>}
            </div>
          ) : weatherState === "loading" ? (
            <div className="weather-status is-loading" aria-live="polite">
              <span className="weather-spinner" aria-hidden="true" />
              <span>定位中…</span>
            </div>
          ) : (
            <div className="weather-status is-error" aria-live="polite">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 19a5 5 0 1 1 1-10 7 7 0 0 1 13 3 4 4 0 0 1-1 7" />
                <path d="M12 12v3M12 18h.01" />
              </svg>
              <span>天气获取失败</span>
            </div>
          )}
        </div>
      </section>

      <section className="stat-grid home-stat-grid" aria-label="门店数据概览">
        {cards.map(([label, value, unit, note]) => (
          <article className="stat-card" key={label}>
            <h2 className="stat-top">{label}</h2>
            <div className="stat-value">
              {value}
              <small>{unit}</small>
            </div>
            <p>{note}</p>
          </article>
        ))}
      </section>

      {error && (
        <p className="customer-notice" role="alert">
          {error}
        </p>
      )}

      <section className="home-work-grid">
        <div className="home-care-stack">
          <article className="care-card todo-care-card care-card-clickable" onClick={() => onNavigate("orders")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("orders"); } }}>
            <div className="care-title-row">
              <h2>今日待办</h2>
            </div>
            <div className="care-banner">
              <img src="/images/todo-illustration.png" width="1000" height="667" alt="" fetchpriority="high" decoding="async" />
            </div>
            <div className="care-count">
              <strong>{pendingOrders.length}</strong>
              <span>项待处理</span>
            </div>
          </article>

          <article className="care-card pet-care-card care-card-clickable" onClick={() => onNavigate("pets")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onNavigate("pets"); } }}>
            <div className="care-title-row">
              <h2>在店宠物状态</h2>
            </div>
            <div className="care-banner">
              <img src="/images/pet-status-illustration.png" width="1000" height="1000" alt="" fetchpriority="high" decoding="async" />
            </div>
            <div className="care-count">
              <strong>{fosteringOrders.length}</strong>
              <span>只在寄养中</span>
            </div>
          </article>
        </div>

        <section className="dashboard-card shortcuts-card home-quick-card" aria-label="系统快捷入口">
          <div className="card-heading">
            <h2>
              <span className="quick-heading-bar" aria-hidden="true" />
              快捷入口
            </h2>
          </div>
          <div className="home-quick-list">
            {shortcuts.map(([label, page]) => (
              <button className="home-quick-action" key={label} onClick={() => page === "stats" ? onNavigate(page) : onQuickAction(page)}>
                <ShortcutIllustration page={page} />
                <span className="home-quick-copy">
                  <strong>{label}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
      </section>

      <footer className="dashboard-footer">
        <span>专业照护 · 温暖相伴</span>
        <span>护宠宝</span>
      </footer>
    </>
  )
}
