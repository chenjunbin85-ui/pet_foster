import { useState, useCallback, useEffect } from "react"

/**
 * 通用分页hook - 统一各列表页的分页状态管理
 * @param fetchData 数据获取函数，接收page和size，返回{records, total}
 * @param defaultSize 默认每页条数
 * @param deps 额外的依赖项（如搜索关键词变化时重新加载）
 */
export function usePagination<T>(
  fetchData: (page: number, size: number) => Promise<{ records: T[]; total: number }>,
  defaultSize = 10,
  deps: unknown[] = []
) {
  const [records, setRecords] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(defaultSize)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p = page, s = size) => {
    setLoading(true)
    try {
      const result = await fetchData(p, s)
      setRecords(result.records)
      setTotal(result.total)
    } finally {
      setLoading(false)
    }
  }, [fetchData, page, size])

  // 页码或每页条数变化时重新加载
  useEffect(() => {
    load(page, size)
  }, [page, size, ...deps])

  const goToPage = useCallback((p: number) => {
    setPage(Math.max(1, p))
  }, [])

  const nextPage = useCallback(() => {
    const maxPage = Math.ceil(total / size) || 1
    if (page < maxPage) setPage(page + 1)
  }, [page, size, total])

  const prevPage = useCallback(() => {
    if (page > 1) setPage(page - 1)
  }, [page])

  const changeSize = useCallback((s: number) => {
    setSize(s)
    setPage(1) // 改变每页条数时回到第一页
  }, [])

  const totalPages = Math.ceil(total / size) || 1
  const isFirstPage = page <= 1
  const isLastPage = page >= totalPages

  return {
    records,
    total,
    page,
    size,
    loading,
    totalPages,
    isFirstPage,
    isLastPage,
    goToPage,
    nextPage,
    prevPage,
    changeSize,
    reload: () => load(page, size),
  }
}
