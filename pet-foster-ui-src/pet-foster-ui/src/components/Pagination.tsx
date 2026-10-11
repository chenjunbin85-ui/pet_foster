interface PaginationProps {
  page: number
  pageCount: number
  total: number
  unit?: string
  onPageChange: (page: number) => void
}

/** 生成页码列表，最多显示7个页码，超出用省略号 */
function getPageNumbers(pageCount: number, page: number): (number | "...")[] {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, i) => i + 1)
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "...", pageCount]
  }
  if (page >= pageCount - 3) {
    return [1, "...", pageCount - 4, pageCount - 3, pageCount - 2, pageCount - 1, pageCount]
  }
  return [1, "...", page - 1, page, page + 1, "...", pageCount]
}

/**
 * 统一分页组件
 * - 暖橙风格，与系统整体配色一致
 * - 页码按钮 + 上一页/下一页
 * - 当前页高亮，禁用态置灰
 * - 即使只有一页也显示控件（按钮禁用），保持布局一致
 */
export function Pagination({ page, pageCount, total, unit = "条", onPageChange }: PaginationProps) {
  const safePageCount = Math.max(1, pageCount)
  const pages = getPageNumbers(safePageCount, page)

  return (
    <div className="pagination-footer">
      <span className="pagination-total">共 {total} {unit}</span>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="上一页"
        >
          上一页
        </button>
        <div className="pagination-numbers">
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
            ) : (
              <button
                key={p}
                className={`pagination-page ${p === page ? "active" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            )
          )}
        </div>
        <button
          className="pagination-btn"
          disabled={page >= safePageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label="下一页"
        >
          下一页
        </button>
      </div>
    </div>
  )
}
