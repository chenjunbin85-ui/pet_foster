import { useState, useCallback } from "react"

/**
 * 表单提交hook - 防止重复提交 + 统一错误处理
 * @param action 提交动作（返回Promise）
 * @param onSuccess 成功回调
 * @param onError 错误回调（可选，默认alert提示）
 */
export function useSubmit<T = void>(
  action: () => Promise<T>,
  onSuccess?: (result: T) => void,
  onError?: (error: Error) => void
) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (submitting) return // 防止重复提交
    setSubmitting(true)
    setError(null)
    try {
      const result = await action()
      onSuccess?.(result)
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败，请重试"
      setError(msg)
      if (onError) {
        onError(e instanceof Error ? e : new Error(msg))
      } else {
        // 默认用alert提示错误（项目中可替换为toast）
        alert(msg)
      }
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [action, onSuccess, onError, submitting])

  return { submit, submitting, error }
}

/**
 * 带参数的表单提交hook
 */
export function useSubmitWithArgs<T = void, A = unknown>(
  action: (args: A) => Promise<T>,
  onSuccess?: (result: T) => void,
  onError?: (error: Error) => void
) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = useCallback(async (args: A) => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await action(args)
      onSuccess?.(result)
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : "操作失败，请重试"
      setError(msg)
      if (onError) {
        onError(e instanceof Error ? e : new Error(msg))
      } else {
        alert(msg)
      }
      throw e
    } finally {
      setSubmitting(false)
    }
  }, [action, onSuccess, onError, submitting])

  return { submit, submitting, error }
}
