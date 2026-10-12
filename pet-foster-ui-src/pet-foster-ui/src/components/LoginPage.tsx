import { useState, type FormEvent } from "react"
import { LockKeyhole, User } from "reicon-react"

interface LoginPageProps {
  onLogin: (username: string, password: string) => void | Promise<void>
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [account, setAccount] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  /** 左栏视频加载失败时置 true，退回静态图 */
  const [videoFailed, setVideoFailed] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!account.trim() || !password.trim()) {
      setError("请输入账号和密码")
      return
    }
    setError("")
    setLoading(true)
    try {
      await onLogin(account.trim(), password)
    } catch (e) {
      // 登录失败原因（密码错误 / 账号锁定 / 网络异常）在表单内提示
      setError(e instanceof Error ? e.message : "登录失败，请稍后重试")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-shell">
      <section className="story-panel" aria-label="护宠宝">
        {/* 左栏背景：动态展示视频 pets.mp4；加载/解码失败则退回原静态图 pets.jpg。
            · muted 必须有，否则浏览器自动播放策略会拦下来（实测去掉 muted 就不播）
            · loop：循环播放，播完自动从头开始
            · playsInline 避免 iOS 强制全屏
            · poster：视频起播前先显示原图，避免中间闪黑块
            · onError：文件缺失/编码不支持时置 videoFailed，换成 <img> 静态图 */}
        {videoFailed ? (
          <img
            className="pet-photo"
            src="./images/pets.jpg"
            width="1400"
            height="1866"
            alt="温暖的寄养空间里，一只金毛犬与橘猫相伴休息"
            decoding="async"
          />
        ) : (
          <video
            className="pet-photo"
            src="./images/pets.mp4"
            poster="./images/pets.jpg"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-label="温暖的寄养空间里，一只金毛犬与橘猫相伴休息"
            onError={() => setVideoFailed(true)}
          />
        )}
        <div className="photo-shade" />
        <div className="brand">
          <img className="brand-logo" src="./images/logo.png" alt="护宠宝标志" fetchPriority="high" decoding="async" />
          <span>
            护宠宝
            <small>每一份托付，都用心守护</small>
          </span>
        </div>
        <div className="story-copy">
          <span className="story-eyebrow">
            <span /> 每一份托付，都用心守护
          </span>
          <h1>
            安心寄养，<br />健康守护。
          </h1>
        </div>
        <div className="story-footer">
          <span>专业照护 · 温暖相伴</span>
          <span>守护每一位小伙伴</span>
        </div>
      </section>

      <section className="form-panel">
        <div className="login-content">
          <div className="welcome-icon">
            <img src="./images/logo.png" alt="护宠宝标志" fetchPriority="high" decoding="async" />
          </div>
          <header className="welcome-copy">
            <h2>欢迎登录</h2>
            <p>
              从这里开始，照顾好每一位小伙伴。
              <br />
              <span>门店工作人员与管理人员专属入口</span>
            </p>
          </header>

          <form onSubmit={submit}>
            <label htmlFor="account">账号</label>
            <div className="input-wrap">
              <User />
              <input
                id="account"
                autoComplete="username"
                placeholder="请输入账号"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
              />
            </div>

            <label htmlFor="password">密码</label>
            <div className="input-wrap">
              <LockKeyhole />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? "登录中" : "登录"}
              <span aria-hidden="true">→</span>
            </button>

            {error && (
              <p className="form-message" role="alert">
                {error}
              </p>
            )}
          </form>

          <p className="form-footer">
            <LockKeyhole /> 用心管理每一份信任
          </p>
        </div>
      </section>
    </main>
  )
}
