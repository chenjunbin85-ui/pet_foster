import { useEffect, useState } from "react"

/**
 * 根据视口高度动态计算每页显示条数
 * - 表格行高约 64px
 * - 顶部区域（标题+搜索栏）约 200px
 * - 分页栏约 60px
 * - 页脚约 40px
 * - 安全边距约 40px
 * - 最小 5 条，最大 50 条
 */
export function useDynamicPageSize(min = 5, max = 50) {
  const [pageSize, setPageSize] = useState(() => calcPageSize(min, max))

  useEffect(() => {
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setPageSize(calcPageSize(min, max)))
    }
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [min, max])

  return pageSize
}

function calcPageSize(min: number, max: number): number {
  if (typeof window === "undefined") return min
  const ROW_HEIGHT = 64
  const HEADER_HEIGHT = 48
  const TOP_AREA = 220 // 标题区 + 搜索栏（保守）
  const FOOTER_AREA = 140 // 分页栏 + 页脚 + 安全边距（保守）
  const available = window.innerHeight - TOP_AREA - FOOTER_AREA - HEADER_HEIGHT
  const rows = Math.floor(available / ROW_HEIGHT)
  return Math.max(min, Math.min(max, rows))
}
