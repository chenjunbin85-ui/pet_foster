/**
 * 毛球旅馆 · 通用工具
 * 计费口径（与设计稿一致）：跨天按晚计费，同日按 1 天
 *   晚数 = 离店日期 - 入住日期（同日 1，至少 1）
 *   金额 = 单价（元/晚） × 晚数
 */
const DAY = 86400000

function parseDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN
  const t = Date.parse(value + 'T00:00:00Z')
  return Number.isFinite(t) ? t : NaN
}

/** 跨天按晚计费：晚数；同日至少 1 */
function calcDays(start, end) {
  const from = parseDate(start)
  const to = parseDate(end)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  if (to < from) return 0
  return Math.max(1, Math.round((to - from) / DAY))
}

/** 文案：跨天 N 晚，同日 1 天（需要“共”前缀时由调用方拼接） */
function stayLabel(start, end) {
  const days = calcDays(start, end)
  if (!days) return '—'
  return start === end ? days + '天' : days + '晚'
}

function money(value) {
  const n = Number(value || 0)
  return n.toFixed(2)
}

/** 疫苗 JSON 解析（兼容旧状态文本）：返回 { vaccinated, name, date } */
function vaccineDetails(value) {
  if (value === '已接种') return { vaccinated: true, name: '', date: '' }
  if (!value) return { vaccinated: false, name: '', date: '' }
  try {
    const parsed = JSON.parse(value)
    if (parsed && parsed.status === '已接种') {
      return {
        vaccinated: true,
        name: typeof parsed.name === 'string' ? parsed.name : '',
        date: typeof parsed.date === 'string' ? parsed.date : ''
      }
    }
  } catch (e) {
    // 旧状态文本或其他描述
  }
  return { vaccinated: false, name: '', date: '' }
}

/** 疫苗编码为 JSON */
function vaccineText(name, date) {
  return JSON.stringify({ status: '已接种', name: (name || '').trim(), date: date || '' })
}

/** 统一时间解析：兼容 LocalDateTime("2026-11-04T23:47:00")、"2026-11-04 23:47"、毫秒数 */
function toMs(value) {
  if (typeof value === 'number') return value
  if (!value) return NaN
  const s = String(value).trim().replace('T', ' ')
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/)
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime()
  }
  return Date.parse(s.replace(/-/g, '/'))
}

/** 支付倒计时 mm:ss */
function countdown(expiresAt, now) {
  if (!expiresAt) return '00:00'
  const target = typeof expiresAt === 'string' ? toMs(expiresAt) : expiresAt
  if (!Number.isFinite(target)) return '00:00'
  const seconds = Math.max(0, Math.ceil((target - (now || Date.now())) / 1000))
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return mm + ':' + ss
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** LocalDate "2026-11-10" → "11-10"（首页日期展示） */
function shortDate(value) {
  return value ? value.slice(5) : ''
}

/** LocalDateTime "2026-11-10 09:00:00" → "2026-11-10" */
function datePart(value) {
  return value ? String(value).slice(0, 10) : ''
}

module.exports = {
  calcDays,
  stayLabel,
  money,
  vaccineDetails,
  vaccineText,
  countdown,
  toMs,
  shortDate,
  datePart,
  pad2
}
