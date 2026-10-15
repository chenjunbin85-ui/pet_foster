// 各模块 API 函数
import { get, post, put, del, setToken, clearToken, getToken } from "./client"

export { setToken, clearToken, getToken }

// ===== 通用类型 =====
export type Role = "admin" | "staff"
export type OrderStatus = "待入店" | "寄养中" | "已完成" | "已取消"
export type HealthType = "入店记录" | "寄养观测记录" | "离店记录"
export type PetGender = "公" | "母"

export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

// ===== 认证 =====
export interface LoginResult {
  token: string
  userInfo: { id: string; username: string; name: string; role: string; status: string }
}
export const loginApi = (username: string, password: string) =>
  post<LoginResult>("/api/auth/login", { username, password })

export const getCurrentUser = () => get("/api/auth/info")

export const changePassword = (oldPassword: string, newPassword: string) =>
  put("/api/auth/password", { oldPassword, newPassword })

// ===== 客户 =====
export interface CustomerVO {
  id: string; name: string; phone: string; address: string; remark?: string; createdAt: string
}
export const customerPage = (page: number, size: number, keyword?: string) =>
  get<PageResult<CustomerVO>>(`/api/customers?page=${page}&size=${size}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`)
export const customerCreate = (data: Partial<CustomerVO>) => post("/api/customers", data)
export const customerUpdate = (id: string, data: Partial<CustomerVO>) => put(`/api/customers/${id}`, data)
export const customerDelete = (id: string) => del(`/api/customers/${id}`)

// ===== 宠物 =====
export interface PetVO {
  id: string; customerId: string; name: string; breed: string; gender: string
  age: number; weight: number; color: string; vaccine: string; history?: string; createdAt: string
}
export const petPage = (page: number, size: number, customerId?: string, name?: string) =>
  get<PageResult<PetVO>>(`/api/pets?page=${page}&size=${size}${customerId ? `&customerId=${customerId}` : ""}${name ? `&name=${encodeURIComponent(name)}` : ""}`)
export const petListByCustomer = (customerId: string) =>
  get<PetVO[]>(`/api/pets/customer/${customerId}`)
export const petCreate = (data: Partial<PetVO>) => post("/api/pets", data)
export const petUpdate = (id: string, data: Partial<PetVO>) => put(`/api/pets/${id}`, data)
export const petDelete = (id: string) => del(`/api/pets/${id}`)

// ===== 订单 =====
export interface OrderVO {
  id: string; orderNo: string; customerId: string; petId: string; customerName?: string; petName?: string
  startDate: string; endDate: string; priceId?: number; pricePerDay: number; totalFee: number
  status: string; remark?: string; creatorId?: string; createdAt: string
  paymentStatus?: string; paymentMethod?: string; paymentTime?: string; paidAmount?: number
}
export const orderPage = (page: number, size: number, status?: string, customerId?: string, orderNo?: string) =>
  get<PageResult<OrderVO>>(`/api/orders?page=${page}&size=${size}${status ? `&status=${encodeURIComponent(status)}` : ""}${customerId ? `&customerId=${customerId}` : ""}${orderNo ? `&orderNo=${orderNo}` : ""}`)
export const orderCreate = (data: Partial<OrderVO>) => post("/api/orders", data)
export const orderUpdate = (id: string, data: Partial<OrderVO>) => put(`/api/orders/${id}`, data)
export const orderDelete = (id: string) => del(`/api/orders/${id}`)
export const orderCheckIn = (id: string) => put(`/api/orders/${id}/check-in`)
export const orderCheckOut = (id: string) => put(`/api/orders/${id}/check-out`)
export const orderCancel = (id: string) => put(`/api/orders/${id}/cancel`)
export const orderPay = (id: string, paymentMethod: string) => post(`/api/orders/${id}/pay`, { paymentMethod })

// ===== 健康记录 =====
export interface HealthRecordVO {
  id: string; petId: string; orderId?: string; type: string
  temperature?: string; spirit?: string; appetite?: string; defecation?: string
  skin?: string; abnormal?: string; treatment?: string; recorderId?: string; recorder?: string; recordTime: string
}
export const healthPage = (page: number, size: number, petId?: string, orderId?: string) =>
  get<PageResult<HealthRecordVO>>(`/api/health-records?page=${page}&size=${size}${petId ? `&petId=${petId}` : ""}${orderId ? `&orderId=${orderId}` : ""}`)
export const healthCreate = (data: Partial<HealthRecordVO>) => post("/api/health-records", data)
export const healthUpdate = (id: string, data: Partial<HealthRecordVO>) => put(`/api/health-records/${id}`, data)
export const healthDelete = (id: string) => del(`/api/health-records/${id}`)

// ===== 服务记录 =====
export interface ServiceRecordVO {
  id: string; orderId: string; petId: string; serviceName: string
  description?: string; serviceTime: string; keeperId?: string; keeper?: string
}
export const servicePage = (page: number, size: number, orderId?: string, petId?: string) =>
  get<PageResult<ServiceRecordVO>>(`/api/service-records?page=${page}&size=${size}${orderId ? `&orderId=${orderId}` : ""}${petId ? `&petId=${petId}` : ""}`)
export const serviceCreate = (data: Partial<ServiceRecordVO>) => post("/api/service-records", data)
export const serviceUpdate = (id: string, data: Partial<ServiceRecordVO>) => put(`/api/service-records/${id}`, data)
export const serviceDelete = (id: string) => del(`/api/service-records/${id}`)

// ===== 统计 =====
export interface DashboardStats {
  fosteringCount: number; pendingCount: number; monthlyOrderCount: number; monthlyRevenue: number
}
export const statsDashboard = () => get<DashboardStats>("/api/stats/dashboard")
/** 本月寄养金额（轻量口径）：首页金额卡双方可见 */
export const statsMonthlyRevenue = () => get<number>("/api/stats/monthly-revenue")

export interface OrderTrend { month: string; count: number; revenue: number }
export const statsOrderTrend = (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams()
  if (startDate) params.set("startDate", startDate)
  if (endDate) params.set("endDate", endDate)
  const qs = params.toString()
  return get<OrderTrend[]>(`/api/stats/order-trend${qs ? `?${qs}` : ""}`)
}

export interface BreedDistribution { breed: string; count: number }
export const statsBreedDistribution = () => get<BreedDistribution[]>("/api/stats/breed-distribution")

// ===== 系统管理（仅admin） =====
export interface SysUserVO {
  id: string; username: string; name: string; role: string; status: string; remark?: string; createdAt: string
}
export const userPage = (page: number, size: number, keyword?: string) =>
  get<PageResult<SysUserVO>>(`/api/users?page=${page}&size=${size}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`)
export const userCreate = (data: Partial<SysUserVO>) => post("/api/users", data)
export const userUpdate = (id: string, data: Partial<SysUserVO>) => put(`/api/users/${id}`, data)
export const userDelete = (id: string) => del(`/api/users/${id}`)

// ===== 寄养价位（固定价位，仅管理员维护；员工下单选择） =====
export interface FosterPriceVO {
  id: string; levelName: string; pricePerDay: number; status: number; sort: number; remark?: string
}
export const priceOptions = () => get<FosterPriceVO[]>("/api/prices/options")
export const pricePage = (page: number, size: number, keyword?: string) =>
  get<PageResult<FosterPriceVO>>(`/api/prices?page=${page}&size=${size}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`)
export const priceCreate = (data: Partial<FosterPriceVO>) => post("/api/prices", data)
export const priceUpdate = (id: string, data: Partial<FosterPriceVO>) => put(`/api/prices/${id}`, data)
export const priceDelete = (id: string) => del(`/api/prices/${id}`)
