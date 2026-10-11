import { useEffect, useRef } from "react"

interface LoadingScreenProps {
  onDone: () => void
  /** 最短显示时间（ms），避免闪烁 */
  minDuration?: number
  /** 最长显示时间（ms），超时强制结束 */
  maxDuration?: number
}

/**
 * 护宠宝加载页
 * - 出现时机：首次进入应用，等待关键资源加载完成
 * - 策略：window.onload + 最短800ms防闪烁，最长3秒兜底
 * - 刷新/已有登录态时由调用方决定是否跳过
 */
export function LoadingScreen({ onDone, minDuration = 800, maxDuration = 3000 }: LoadingScreenProps) {
  const startTimeRef = useRef(Date.now())

  useEffect(() => {
    let finished = false

    const finish = () => {
      if (finished) return
      finished = true
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, minDuration - elapsed)
      setTimeout(onDone, remaining)
    }

    // 最长兜底：3秒后强制结束
    const maxTimer = setTimeout(finish, maxDuration)

    // 资源加载完成：window.onload
    if (document.readyState === "complete") {
      finish()
    } else {
      window.addEventListener("load", finish, { once: true })
    }

    return () => {
      clearTimeout(maxTimer)
      window.removeEventListener("load", finish)
    }
  }, [onDone, minDuration, maxDuration])

  return (
    <div className="loading-screen" role="status" aria-label="加载中">
      <div className="loading-content">
        <img
          src="/images/loading-illustration.png"
          alt="护宠宝"
          className="loading-illustration"
        />
        <h1 className="loading-brand">护宠宝</h1>
        <p className="loading-slogan">每一份托付，都用心守护</p>
        <div className="paw-progress" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="paw-dot"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
