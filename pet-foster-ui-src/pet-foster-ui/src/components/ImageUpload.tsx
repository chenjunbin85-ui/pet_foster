import { useId, useRef, useState, type ChangeEvent } from "react"
import { CameraAdd, Trash2 } from "reicon-react"
import { resolveFileUrl, uploadPicture } from "@/api"

const MAX_SIZE = 2 * 1024 * 1024
const ACCEPT = "image/png,image/jpeg"

interface ImageUploadProps {
  /** 当前图片地址（后端相对地址或绝对地址） */
  value?: string
  /** 上传成功回调，回传后端返回的 /api/files/xxx 地址 */
  onChange: (url: string) => void
  /** 无障碍名称，也是测试定位入口 */
  label?: string
  hint?: string
  disabled?: boolean
  /** 预览尺寸：头像用 md，现场照片用 sm */
  size?: "md" | "sm"
}

/**
 * 图片上传控件（全链路：选择 → 校验 → POST /api/files/upload → 回显）。
 * 只负责单张图片；多图场景由调用方组合。
 */
export function ImageUpload({
  value,
  onChange,
  label = "上传图片",
  hint = "支持 jpg / png，单张不超过 2MB",
  disabled = false,
  size = "md",
}: ImageUploadProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")

  const pick = () => {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // 允许重复选择同一文件时再次触发 change
    event.target.value = ""
    if (!file) return

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("仅支持 jpg / png 格式图片")
      return
    }
    if (file.size > MAX_SIZE) {
      setError("单张图片不能超过 2MB")
      return
    }

    setError("")
    setUploading(true)
    try {
      const uploaded = await uploadPicture(file)
      onChange(uploaded.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "图片上传失败，请重试")
    } finally {
      setUploading(false)
    }
  }

  const clear = () => {
    setError("")
    onChange("")
  }

  return (
    <div className={`image-upload image-upload-${size}`}>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPT}
        aria-label={label}
        className="image-upload-input"
        disabled={disabled || uploading}
        onChange={handleFile}
      />

      {value ? (
        <div className="image-upload-preview">
          <img src={resolveFileUrl(value)} alt={`${label}预览`} />
          {!disabled && (
            <div className="image-upload-tools">
              <button type="button" onClick={pick} aria-label="更换图片" disabled={uploading}>
                {uploading ? <span className="image-upload-spinner" aria-hidden /> : "更换"}
              </button>
              <button type="button" className="danger" onClick={clear} aria-label="移除图片" disabled={uploading}>
                <Trash2 />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="image-upload-empty" onClick={pick} disabled={disabled || uploading}>
          {uploading ? <span className="image-upload-spinner" aria-hidden /> : <CameraAdd />}
          <span>{uploading ? "上传中…" : label}</span>
        </button>
      )}

      <p className="image-upload-hint">{hint}</p>
      {error && (
        <p className="image-upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
