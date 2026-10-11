import { useEffect, useState } from "react"
import { LockKeyhole, ShieldCheck, User } from "reicon-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { Role } from "@/api"

/**
 * 演示环境中每个角色对应的默认账号。
 * 账号可编辑，用于登录同一角色下的其它账号。
 */
const DEFAULT_USERNAME: Record<Role, string> = { admin: "admin", staff: "staff01" }

interface RoleSwitchDialogProps {
  /** 待切换的目标角色；为 null 时弹窗关闭 */
  target: Role | null
  roleLabel: Record<Role, string>
  onOpenChange: (open: boolean) => void
  /** 校验目标账号的账号密码，校验失败请抛出 Error（错误信息将展示在弹窗内） */
  onSubmit: (username: string, password: string) => Promise<void>
}

export function RoleSwitchDialog({ target, roleLabel, onOpenChange, onSubmit }: RoleSwitchDialogProps) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  // 每次打开时重置表单，并预填目标角色的默认账号
  useEffect(() => {
    if (target) {
      setUsername(DEFAULT_USERNAME[target])
      setPassword("")
      setError("")
      setLoading(false)
    }
  }, [target])

  const submit = async () => {
    if (!username.trim() || !password.trim()) {
      setError("请输入账号和密码")
      return
    }
    setError("")
    setLoading(true)
    try {
      await onSubmit(username.trim(), password)
      // 校验成功由父组件关闭弹窗
    } catch (e) {
      setError(e instanceof Error ? e.message : "切换失败")
      setLoading(false)
    }
  }

  const targetLabel = target ? roleLabel[target] : ""

  return (
    <Dialog open={!!target} onOpenChange={(open) => { if (!loading) onOpenChange(open) }}>
      <DialogContent className="role-switch-dialog sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>切换到{targetLabel}</DialogTitle>
          <DialogDescription>
            请输入{targetLabel}账号的密码进行身份校验，校验通过后才会切换账号。
          </DialogDescription>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="switch-username">账号</FieldLabel>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="switch-username"
                autoComplete="off"
                placeholder="请输入账号"
                className="pl-9"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="switch-password">密码</FieldLabel>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="switch-password"
                type="password"
                autoComplete="off"
                placeholder="请输入密码"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
              />
            </div>
            <FieldDescription className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
              切换后将换用该账号的真实角色与权限，当前登录态会被替换。
            </FieldDescription>
          </Field>

          {error && <FieldError>{error}</FieldError>}
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            取消
          </Button>
          <Button onClick={submit} disabled={loading}>
            {loading ? "校验中..." : "确认切换"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
