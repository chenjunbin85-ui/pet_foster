import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bar, CartesianGrid, Cell, Line, Pie, PieChart, XAxis, YAxis, ComposedChart } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  getToken,
  orderPage,
  statsBreedDistribution,
  statsOrderTrend,
  type BreedDistribution,
  type OrderTrend,
  type OrderVO,
} from "@/api"

const API_BASE = "http://127.0.0.1:8090"
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

export function StatsPage() {
  const [trend, setTrend] = useState<OrderTrend[]>([])
  const [breed, setBreed] = useState<BreedDistribution[]>([])
  const [orders, setOrders] = useState<OrderVO[]>([])
  const [error, setError] = useState("")
  const [period, setPeriod] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // 计算周期对应的日期范围
  const getDateRange = (p: string): [string, string] => {
    const now = new Date()
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    switch (p) {
      case "7d": {
        const s = new Date(now); s.setDate(s.getDate() - 6); return [fmt(s), fmt(now)]
      }
      case "30d": {
        const s = new Date(now); s.setDate(s.getDate() - 29); return [fmt(s), fmt(now)]
      }
      case "month": {
        const s = new Date(now.getFullYear(), now.getMonth(), 1); return [fmt(s), fmt(now)]
      }
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3); const s = new Date(now.getFullYear(), q * 3, 1); return [fmt(s), fmt(now)]
      }
      case "year": {
        const s = new Date(now.getFullYear(), 0, 1); return [fmt(s), fmt(now)]
      }
      default: return ["", ""]
    }
  }

  const handlePeriodChange = (p: string) => {
    setPeriod(p)
    if (p === "custom") return
    const [s, e] = getDateRange(p)
    setStartDate(s)
    setEndDate(e)
  }

  // 过滤订单数据
  const filteredOrders = orders.filter((o) => {
    if (!startDate && !endDate) return true
    const d = o.createdAt ? o.createdAt.slice(0, 10) : ""
    if (startDate && d < startDate) return false
    if (endDate && d > endDate) return false
    return true
  })

  useEffect(() => {
    Promise.all([statsOrderTrend(startDate || undefined, endDate || undefined), statsBreedDistribution(), orderPage(1, 500)]).then(
      ([t, b, o]) => {
        setTrend(t)
        setBreed(b)
        setOrders(o.records)
        // 默认日期：最早订单日期到今天
        if (!startDate && !endDate && o.records.length > 0) {
          const dates = o.records.map((r: OrderVO) => r.createdAt).filter(Boolean).sort()
          const earliest = dates[0]?.slice(0, 10) || ""
          const today = new Date().toISOString().slice(0, 10)
          if (earliest) {
            setStartDate(earliest)
            setEndDate(today)
          }
        }
      }
    ).catch((e: unknown) => setError(e instanceof Error ? e.message : "统计数据加载失败"))
  }, [startDate, endDate])

  const completed = filteredOrders.filter((o) => o.status === "已完成").length
  const cancelled = filteredOrders.filter((o) => o.status === "已取消").length
  const revenue = filteredOrders.filter((o) => o.status !== "已取消").reduce((sum, o) => sum + (o.totalFee ?? 0), 0)

  // 补全最近 5 个月（无数据月份填 0），避免图表只剩一根柱子
  const now = new Date()
  const last5: Array<{ key: string; label: string }> = []
  for (let i = 4; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    last5.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}月`,
    })
  }
  const trendMap = new Map(trend.map((t) => [t.month, t]))
  const trendData = last5.map(({ key, label }) => {
    const t = trendMap.get(key)
    return { month: label, 订单数: t?.count ?? 0, 金额: t?.revenue ?? 0 }
  })
  const breedData = breed.map((b) => ({ name: b.breed, value: b.count }))
  const breedTotal = breedData.reduce((sum, b) => sum + b.value, 0)

  const periodLabel = period === "all" ? "全部历史数据" :
    period === "7d" ? "近7天" : period === "30d" ? "近30天" :
    period === "month" ? "本月" : period === "quarter" ? "本季度" :
    period === "year" ? "本年" : "自定义"

  const exportExcel = () => {
    const token = getToken()
    fetch(`${API_BASE}/api/export/orders`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "寄养订单.xlsx"
        a.click()
        URL.revokeObjectURL(url)
        toast.success("订单数据已导出")
      })
      .catch(() => toast.error("导出失败"))
  }

  const cards = [
    ["订单总数", String(orders.length), "单"],
    ["已完成订单", String(completed), "单"],
    ["已取消订单", String(cancelled), "单"],
    ["总营收", revenue.toLocaleString("zh-CN"), "元"],
  ]

  return (
    <section className="statistics-page">
      <div className="dashboard-welcome">
        <div>
          <span className="section-kicker">统计分析</span>
          <h1>照护有温度，经营有方向。</h1>
          <p>统计范围：{periodLabel}，清晰了解门店经营状况。</p>
        </div>
        <div className="stats-filters">
          <select className="stats-period-select" value={period} onChange={(e) => handlePeriodChange(e.target.value)}>
            <option value="all">全部历史</option>
            <option value="7d">近7天</option>
            <option value="30d">近30天</option>
            <option value="month">本月</option>
            <option value="quarter">本季度</option>
            <option value="year">本年</option>
            <option value="custom">自定义</option>
          </select>
          <div className="stats-date-picker">
            <div className="stats-date-inline">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="stats-date-icon">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPeriod("custom") }} />
              <span className="stats-date-sep">至</span>
              <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPeriod("custom") }} />
            </div>
          </div>
          <button className="secondary-action" onClick={exportExcel}>
            导出订单 Excel
          </button>
        </div>
      </div>

      <div className="stat-grid home-stat-grid">
        {cards.map(([title, value, unit]) => (
          <article className="stat-card" key={title}>
            <h2 className="stat-top">{title}</h2>
            <div className="stat-value">
              {value}
              <small>{unit}</small>
            </div>
            <p>{periodLabel}</p>
          </article>
        ))}
      </div>

      {error && (
        <p className="customer-notice" role="alert">
          {error}
        </p>
      )}

      <div className="analytics-grid">
        <article className="dashboard-card">
          <div className="card-heading">
            <div>
              <h2>寄养订单趋势</h2>
              <p>近五个月寄养订单数量与收入趋势</p>
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-order" />
              订单数（单）
            </span>
            <span>
              <i className="legend-income" />
              收入（元）
            </span>
          </div>
          <ChartContainer config={{ 订单数: { label: "订单数", color: "var(--chart-1)" }, 金额: { label: "金额", color: "var(--chart-2)" } }}>
            <ComposedChart data={trendData} accessibilityLayer>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `¥${v}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar yAxisId="left" dataKey="订单数" fill="var(--color-订单数)" radius={[4, 4, 0, 0]} barSize={32} />
              <Line yAxisId="right" type="monotone" dataKey="金额" stroke="var(--color-金额)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ChartContainer>
        </article>

        <article className="dashboard-card">
          <div className="card-heading">
            <div>
              <h2>宠物品种分布</h2>
              <p>在档宠物品种占比</p>
            </div>
            <span className="soft-badge">共 {breedTotal} 只</span>
          </div>
          <div className="donut-wrap">
            <ChartContainer config={{ value: { label: "只数" } }} className="aspect-square w-full">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                {/* isAnimationActive={false} —— 关掉 recharts tooltip 自带的
                    `transition: transform 400ms`（写在 TooltipBoundingBox 的内联 style 上）。
                    recharts 只把位置写在 transform 上（top/left 恒为 0px），这条过渡会把
                    tooltip 从「上一个落点」斜着拖到当前扇区；首次 hover 更是从 translate(0,0)
                    （= 图表左上角）飞过来 —— 也就是用户看到的「统一从左上角浮现」。
                    环形图应当「悬浮哪个扇区，提示就浮现在那个扇区旁」，故取消位移动画；
                    保留一段极短的淡入（见 index.css 的 donut-tooltip-in 关键帧）。 */}
                <ChartTooltip content={<ChartTooltipContent />} isAnimationActive={false} />
                <Pie data={breedData} dataKey="value" nameKey="name" innerRadius="59%" outerRadius="85%" paddingAngle={2} startAngle={90} endAngle={-270}>
                  {breedData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            {breedTotal > 0 && (
              <div className="donut-center" aria-hidden="true">
                <strong>{breedTotal}</strong>
                <span>在档宠物</span>
              </div>
            )}
          </div>
          <div className="breed-legend">
            {breedData.map((d, i) => (
              <div key={d.name}>
                <span>
                  <i className={`breed-${i % 4}`} />
                  {d.name}
                </span>
                <strong>
                  {d.value} 只 <small>{breedTotal ? Math.round((d.value / breedTotal) * 100) : 0}%</small>
                </strong>
              </div>
            ))}
            {breedData.length === 0 && <p className="empty-state">暂无宠物档案数据</p>}
          </div>
        </article>
      </div>

      <footer className="dashboard-footer">
        <span>专业照护 · 温暖相伴</span>
        <span>数据实时同步自服务端</span>
      </footer>
    </section>
  )
}
