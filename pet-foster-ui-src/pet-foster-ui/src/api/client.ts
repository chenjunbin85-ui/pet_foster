// API 客户端 —— 连接后端 Spring Boot 服务
const BASE_URL = "http://127.0.0.1:8090"

const TOKEN_KEY = "pet_foster_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function clearAuthState() {
  clearToken()
  localStorage.removeItem("pet_foster_role")
  localStorage.removeItem("pet_foster_user_name")
  localStorage.removeItem("pet_foster_page")
}

interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  status: number
  code?: number
  constructor(status: number, message: string, code?: number) {
    super(message)
    this.status = status
    this.code = code
    this.name = "ApiError"
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers["Authorization"] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    })
  } catch (e) {
    // 网络错误
    throw new ApiError(0, "网络连接失败，请检查网络后重试")
  }

  // 401 未登录或token过期：清除登录态并跳转登录页
  if (res.status === 401) {
    clearAuthState()
    if (!path.includes("/auth/login")) {
      // 跳转登录页，避免reload后路由守卫再跳一次
      window.location.href = "/login"
    }
    throw new ApiError(401, "登录已过期，请重新登录")
  }

  // 403 权限不足
  if (res.status === 403) {
    throw new ApiError(403, "没有权限执行该操作")
  }

  const body = (await res.json().catch(() => ({}))) as ApiResponse<T>

  // 500 服务器错误
  if (res.status === 500) {
    throw new ApiError(500, body.message || "服务器内部错误，请稍后重试")
  }

  if (!res.ok) {
    throw new ApiError(res.status, body.message || `请求失败 (${res.status})`, body.code)
  }
  if (body.code !== 200) {
    throw new ApiError(res.status, body.message || "业务错误", body.code)
  }
  return body.data
}

export function get<T>(path: string) {
  return request<T>(path, { method: "GET" })
}

export function post<T>(path: string, data?: unknown) {
  return request<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined })
}

export function put<T>(path: string, data?: unknown) {
  return request<T>(path, { method: "PUT", body: data ? JSON.stringify(data) : undefined })
}

export function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" })
}
