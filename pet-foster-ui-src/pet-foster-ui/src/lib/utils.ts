export { cn } from "cn"

/**
 * 把后端返回的 ISO 时间串（如 2026-10-14T21:33:06）格式化成「YYYY-MM-DD HH:mm」。
 * 非法/空值原样返回，避免把「—」之类的占位符改坏。
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return ""
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}
