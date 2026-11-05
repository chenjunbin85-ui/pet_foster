import { useEffect, type ReactNode } from "react"
import { PetArt } from "./PetArt"

export type IconName = "home" | "calendar" | "paw" | "orders" | "user" | "arrow" | "chevron" | "back" | "check" | "shield" | "heart" | "chat" | "bell" | "plus" | "logout" | "clock" | "pin" | "lock" | "close" | "phone" | "eye" | "refresh" | "search" | "camera"

export function Icon({
  name,
  size = 22,
}: Record<"name", IconName> & { size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    camera: <><path d="M3 7h4l2-3h6l2 3h4v14H3Z" /><circle cx="12" cy="13" r="4" /></>,
    home: (
      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" />
      </>
    ),
    paw: (
      <>
        <ellipse cx="6" cy="8" rx="2" ry="3" transform="rotate(-25 6 8)" />
        <ellipse cx="11" cy="5" rx="2" ry="3" />
        <ellipse cx="17" cy="6" rx="2" ry="3" transform="rotate(20 17 6)" />
        <ellipse
          cx="21"
          cy="11"
          rx="1.7"
          ry="2.5"
          transform="rotate(30 21 11)"
        />
        <path d="M6 17c0-3 4-7 7-6 3 0 6 4 6 7 0 4-4 2-6 2s-7 2-7-3Z" />
      </>
    ),
    orders: (
      <>
        <rect x="5" y="4" width="14" height="18" rx="3" />
        <path d="M9 4V2h6v2M9 10h6m-6 5h6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    back: <path d="m15 5-7 7 7 7" />,
    check: <path d="m5 12 4 4L19 6" />,
    shield: (
      <>
        <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    heart: (
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    ),
    chat: (
      <>
        <path d="M21 11a9 9 0 0 1-9 9 12 12 0 0 1-4-.7L3 21l1.7-5A9 9 0 1 1 21 11Z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" />
      </>
    ),
    bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />,
    plus: <path d="M12 4v16M4 12h16" />,
    logout: <path d="M10 3H4v18h6m-1-9h12m-4-4 4 4-4 4" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    pin: (
      <>
        <path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="9" r="2" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    phone: (
      <>
        <rect x="6" y="2" width="12" height="20" rx="3" />
        <path d="M11 18h2" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7V2m0 5h-5M4 17v5m0-5h5" />
        <path d="M20 7a9 9 0 0 0-16 3m0 7a9 9 0 0 0 16-3" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function Button({
  children,
  onClick,
  secondary = false,
  danger = false,
  type = "button",
  disabled = false,
  loading = false,
}: {
  children: ReactNode
  onClick?: () => void
  secondary?: boolean
  danger?: boolean
  type?: "button" | "submit"
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={`button ${secondary ? "secondary" : ""} ${
        danger ? "danger" : ""
      }`}
    >
      {loading && <span className="spinner" />}
      {children}
    </button>
  )
}

export function SectionTitle({
  children,
  aside,
}: {
  children: ReactNode
  aside?: ReactNode
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {aside}
    </div>
  )
}

export function PetAvatar({ cat = false, photo }: Partial<Record<"cat", boolean>> & { photo?: string }) {
  return (
    <div className={`pet-avatar ${cat ? "cat" : ""}`}>
      {photo ? <img src={photo} alt="宠物照片" /> : <PetArt single={cat ? "cat" : "dog"} />}
    </div>
  )
}

export function InfoRows({
  rows,
  grid = false,
}: {
  rows: [string, ReactNode][]
  grid?: boolean
}) {
  return (
    <dl className={`info-rows ${grid ? "info-grid" : ""}`}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function RoomIcon({ variant }: { variant: number }) {
  return (
    <svg
      width="39"
      height="33"
      viewBox="0 0 42 36"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 31V15L21 4l16 11v16H5Z" />
      <path d="M2 16 21 2l19 14M16 31V20a5 5 0 0 1 10 0v11" />
      {variant > 0 && (
        <>
          <path d="M9 20h3m18 0h3M9 24h3m18 0h3" />
          <circle cx="21" cy="11" r="2" />
        </>
      )}
      {variant === 2 && <path d="m15 4-1-3 7 2 7-2-1 3M3 34h36" />}
    </svg>
  )
}

export function Skeleton() {
  return (
    <div className="skeleton" role="status" aria-label="正在加载演示内容">
      <span />
      <span />
      <span />
      <p>正在加载…</p>
    </div>
  )
}

export function Dialog({
  title,
  children,
  actions,
  close,
  destructive = false,
}: {
  title: string
  children: ReactNode
  actions: ReactNode
  close: () => void
  destructive?: boolean
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>("[role=dialog]")
    const items = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), a[href]",
        ) || [],
      )
    const frame = requestAnimationFrame(() =>
      (dialog?.querySelector<HTMLElement>("input") || items()[0])?.focus(),
    )
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !destructive) close()
      if (e.key !== "Tab") return
      const list = items()
      if (e.shiftKey && document.activeElement === list[0]) {
        e.preventDefault()
        list.at(-1)?.focus()
      }
      if (!e.shiftKey && document.activeElement === list.at(-1)) {
        e.preventDefault()
        list[0]?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = oldOverflow
      document.removeEventListener("keydown", onKey)
      previous?.focus()
    }
  }, [close, destructive])
  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!destructive) close()
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {!destructive && (
          <button className="modal-close" aria-label="关闭弹窗" onClick={close}>
            <Icon name="close" size={20} />
          </button>
        )}
        <span className="modal-icon">
          <Icon name={destructive ? "shield" : "paw"} size={28} />
        </span>
        <h2 id="modal-title">{title}</h2>
        <div className="modal-copy">{children}</div>
        <div className="modal-actions">{actions}</div>
      </section>
    </div>
  )
}
