/**
 * Web 后台岗位级权限（PRD 3.2「Web 端 8 页权限」）。
 *
 * 与后端 security/WebAuth.java 的 MATRIX 一一对应，改一处必须同步另一处。
 * 菜单隐藏只是第一层：后端 @PreAuthorize("@webAuth.can(...)") 才是真正的墙。
 * ●=write（读写均可）、○=read（只读）、—=none（不可见）。
 */
export type Capability = "write" | "read" | "none"
export type Position = "OWNER" | "FRONT" | "CARE" | "VET" | "GROOM" | "DRIVER"

export const WEB_MODULES = [
  "dashboard", "customers", "pets", "orders", "health", "services", "stats", "system",
] as const
export type WebModule = (typeof WEB_MODULES)[number]

export const POSITION_LABELS: Record<Position, string> = {
  OWNER: "店长／管理员", FRONT: "前台", CARE: "护理员",
  VET: "兽医", GROOM: "美容师", DRIVER: "外勤接送",
}

const W: Capability = "write"
const R: Capability = "read"

/** 未列出的岗位即 none：DRIVER 整行不可见，GROOM 无客户模块。 */
const MATRIX: Record<WebModule, Partial<Record<Position, Capability>>> = {
  dashboard: { OWNER: W, FRONT: W, CARE: W, VET: W, GROOM: W },
  customers: { OWNER: W, FRONT: W, CARE: R, VET: R },
  pets:      { OWNER: W, FRONT: W, CARE: R, VET: R, GROOM: R },
  orders:    { OWNER: W, FRONT: W, CARE: R, VET: R, GROOM: R },
  health:    { OWNER: W, FRONT: R, CARE: W, VET: W },
  services:  { OWNER: W, FRONT: R, CARE: W, VET: R, GROOM: W },
  stats:     { OWNER: W },
  system:    { OWNER: W },
}

const CN_MAP: Record<string, Position[]> = {
  店长: ["OWNER"], 管理员: ["OWNER"],
  前台: ["FRONT"], 护理员: ["CARE"], 兽医: ["VET"],
  兽医助理: ["VET", "CARE"], 美容师: ["GROOM"],
  外勤: ["DRIVER"], 司机: ["DRIVER"], 接送: ["DRIVER"],
}

/** admin 落点 OWNER；空岗位、未知值一律返回空数组（fail closed）。 */
export function normalizePositions(role: string, raw?: string | null): Position[] {
  if (role === "admin") return ["OWNER"]
  const out: Position[] = []
  String(raw || "").split(/[,，;；\s]+/).forEach((part) => {
    const key = part.trim()
    if (!key) return
    const codes = CN_MAP[key] || [key.toUpperCase() as Position]
    codes.forEach((c) => {
      if (c in POSITION_LABELS && !out.includes(c)) out.push(c)
    })
  })
  return out
}

/** 一人多岗取最高权限。 */
export function resolveCapabilities(role: string, raw?: string | null): Record<WebModule, Capability> {
  const positions = normalizePositions(role, raw)
  const out = {} as Record<WebModule, Capability>
  for (const module of WEB_MODULES) {
    let best: Capability = "none"
    for (const p of positions) {
      const m = MATRIX[module][p] || "none"
      if (m === "write") { best = "write"; break }
      if (m === "read") best = "read"
    }
    out[module] = best
  }
  return out
}

/** DRIVER 等无 Web 工位的岗位：八个模块全 none。 */
export function hasWebWorkbench(caps: Record<WebModule, Capability>): boolean {
  return WEB_MODULES.some((m) => caps[m] !== "none")
}
