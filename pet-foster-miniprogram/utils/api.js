/**
 * 毛球旅馆 · 接口封装
 * 后端：pet-foster-server（Spring Boot，端口 8090）
 * 统一 Result: { code, message, data }；业务错误 code=500（message 为提示文案）
 */
const auth = require('./auth.js')
const BASE_URL = 'http://127.0.0.1:8090'

/** 后端 /api/files/** 返回的相对地址拼成小程序可直接显示的绝对地址 */
function fileUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return BASE_URL + path
}

function request(path, options = {}) {
  const { method = 'GET', data = {}, auth = true } = options
  return new Promise((resolve, reject) => {
    const header = { 'Content-Type': 'application/json' }
    const token = wx.getStorageSync('token')
    if (auth && token) header.Authorization = 'Bearer ' + token
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header,
      success(res) {
        if (res.statusCode === 401) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('customer')
          wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
          setTimeout(() => {
            wx.navigateTo({ url: '/pages/login/login' })
          }, 600)
          reject(new Error('未登录'))
          return
        }
        const body = res.data || {}
        if (body.code === 200) {
          resolve(body.data)
        } else {
          const err = new Error(body.message || '请求失败')
          err.code = body.code
          reject(err)
        }
      },
      fail() {
        reject(new Error('网络异常，请检查服务是否启动'))
      }
    })
  })
}

module.exports = {
  BASE_URL,
  fileUrl,

  // 认证
  login(phone, password) {
    return request('/api/mp/auth/login', { method: 'POST', data: { phone, password }, auth: false })
  },
  register(phone, password) {
    return request('/api/mp/auth/register', { method: 'POST', data: { phone, password }, auth: false })
  },
  me() {
    return request('/api/mp/auth/me')
  },

  // 宠物
  pets() {
    return request('/api/mp/pets')
  },
  petDetail(id) {
    return request('/api/mp/pets/' + id)
  },
  createPet(data) {
    return request('/api/mp/pets', { method: 'POST', data })
  },
  updatePet(id, data) {
    return request('/api/mp/pets/' + id, { method: 'PUT', data })
  },
  deletePet(id) {
    return request('/api/mp/pets/' + id, { method: 'DELETE' })
  },

  // 价位
  prices() {
    return request('/api/mp/prices')
  },

  // 订单
  orders(params = {}) {
    const q = []
    if (params.page) q.push('page=' + params.page)
    if (params.size) q.push('size=' + params.size)
    if (params.status) q.push('status=' + encodeURIComponent(params.status))
    if (params.keyword) q.push('keyword=' + encodeURIComponent(params.keyword))
    const qs = q.length ? '?' + q.join('&') : ''
    return request('/api/mp/orders' + qs)
  },
  orderDetail(id) {
    return request('/api/mp/orders/' + id)
  },
  createOrder(data) {
    return request('/api/mp/orders', { method: 'POST', data })
  },
  payOrder(id) {
    return request('/api/mp/orders/' + id + '/pay', { method: 'POST' })
  },
  cancelOrder(id) {
    return request('/api/mp/orders/' + id + '/cancel', { method: 'POST' })
  },
  stats() {
    return request('/api/mp/orders/stats')
  },

  // 门店
  stores() {
    return request('/api/mp/stores')
  },

  // 优惠券
  coupons() {
    return request('/api/mp/coupons')
  },

  // 照护记录
  careRecords(orderId) {
    return request('/api/mp/orders/' + orderId + '/care')
  },

  // 评价
  getReview(orderId) {
    return request('/api/mp/orders/' + orderId + '/review')
  },
  submitReview(orderId, data) {
    return request('/api/mp/orders/' + orderId + '/review', { method: 'POST', data })
  },

  // ===== 员工端（同一小程序按角色分流）=====
  staffRequest(path, options = {}) {
    const { method = 'GET', data = {} } = options
    return new Promise((resolve, reject) => {
      const header = { 'Content-Type': 'application/json' }
      const token = wx.getStorageSync('staffToken')
      if (token) header.Authorization = 'Bearer ' + token
      wx.request({
        url: BASE_URL + path,
        method,
        data,
        header,
        success(res) {
          if (res.statusCode === 401) {
            auth.clearStaffSession()
            wx.showToast({ title: '员工登录已过期', icon: 'none' })
            setTimeout(function () {
              wx.redirectTo({ url: '/pages/login/login' })
            }, 600)
            reject(new Error('未登录'))
            return
          }
          const body = res.data || {}
          if (body.code === 200) resolve(body.data)
          else {
            const err = new Error(body.message || '请求失败')
            err.code = body.code
            reject(err)
          }
        },
        fail() { reject(new Error('网络异常')) }
      })
    })
  },

  staffLogin(username, password) {
    return this.staffRequest('/api/auth/login', { method: 'POST', data: { username, password } })
  },
  // ===== 员工端聚合查询（同一账号、Web / 手机数据同源）=====
  staffMe() {
    return this.staffRequest('/api/staff/me')
  },
  staffToday() {
    return this.staffRequest('/api/staff/today')
  },
  staffOrderDetail(id) {
    return this.staffRequest('/api/staff/orders/' + id)
  },
  staffHealthSummary(id) {
    return this.staffRequest('/api/staff/orders/' + id + '/health-summary')
  },
  staffIncidentDetail(id) {
    return this.staffRequest('/api/staff/incidents/' + id)
  },
  staffDuty() {
    return this.staffRequest('/api/staff/duty')
  },
  staffServices() {
    return this.staffRequest('/api/staff/services')
  },

  // ===== 员工端现场动作 =====
  staffConfirmDuty() {
    return this.staffRequest('/api/staff/duty/confirm', { method: 'POST', data: {} })
  },
  staffCareRecord(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/care-record', { method: 'POST', data: body })
  },
  staffGroomLog(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/groom-log', { method: 'POST', data: body })
  },
  staffPickupHandover(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/pickup-handover', { method: 'POST', data: body })
  },
  staffHealthAssessment(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/health-assessment', { method: 'POST', data: body })
  },
  staffReviewIncident(id, body) {
    return this.staffRequest('/api/staff/incidents/' + id + '/review', { method: 'POST', data: body })
  },
  staffAuthorizeIncident(id, body) {
    return this.staffRequest('/api/staff/incidents/' + id + '/authorize', { method: 'POST', data: body })
  },

  /** 现场照片上传：wx.uploadFile 走 multipart，token 放 header */
  staffUpload(filePath) {
    return new Promise((resolve, reject) => {
      const header = {}
      const token = wx.getStorageSync('staffToken')
      if (token) header.Authorization = 'Bearer ' + token
      wx.uploadFile({
        url: BASE_URL + '/api/files/upload',
        filePath: filePath,
        name: 'file',
        header: header,
        success(res) {
          if (res.statusCode === 401) {
            auth.clearStaffSession()
            reject(new Error('员工登录已过期'))
            return
          }
          try {
            const body = JSON.parse(res.data)
            if (body.code === 200) resolve(body.data)
            else reject(new Error(body.message || '照片上传失败'))
          } catch (e) {
            reject(new Error('上传返回解析失败'))
          }
        },
        fail() { reject(new Error('照片上传失败，请检查网络与后端服务')) }
      })
    })
  },

  staffHandover(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/handover', { method: 'POST', data: body })
  },
  staffCareLog(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/care-log', { method: 'POST', data: body })
  },
  staffIncident(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/incident', { method: 'POST', data: body })
  },
  staffRedeem(orderId, body) {
    return this.staffRequest('/api/staff/orders/' + orderId + '/redeem', { method: 'POST', data: body })
  }
}
