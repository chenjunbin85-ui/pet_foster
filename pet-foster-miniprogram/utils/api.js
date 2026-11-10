/**
 * 毛球旅馆 · 接口封装
 * 后端：pet-foster-server（Render https://pet-foster-server.onrender.com）
 * 统一 Result: { code, message, data }；业务错误 code=500（message 为提示文案）
 *
 * 双通道（由 utils/cloud-config.js 单一控制）：
 *   - 云托管已配置：走 wx.cloud.callContainer 微信内网专线，无需服务器域名/ICP 备案
 *   - 未配置：回退 wx.request 直连 Render，供本地开发与旧版使用
 * BASE_URL 保留，仅用于拼接/还原后端返回的 /api/files/** 相对地址，不再是请求基址。
 */
const auth = require('./auth.js')
const cloud = require('./cloud-config.js')
const BASE_URL = 'https://pet-foster-server.onrender.com'

/** 统一处理后端 Result 与 401 */
function handleResult(res, resolve, reject, onUnauthorized) {
  if (res.statusCode === 401) {
    onUnauthorized()
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
}

/** 微信云托管专线调用（callContainer 超时上限 15s，这里留 3s 余量） */
function callCloud(path, method, data, header, onUnauthorized) {
  return new Promise((resolve, reject) => {
    wx.cloud.callContainer({
      config: { env: cloud.env },
      path: path,
      method: method,
      data: data,
      header: Object.assign({
        'X-WX-SERVICE': cloud.service,
        'Content-Type': 'application/json'
      }, header),
      timeout: 12000,
      success(res) { handleResult(res, resolve, reject, onUnauthorized) },
      fail() { reject(new Error('网络异常，请检查云托管服务')) }
    })
  })
}

/** 传统 wx.request，未配置云托管或本地开发时回退 */
function callHttp(path, method, data, header, onUnauthorized) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method: method,
      data: data,
      header: Object.assign({ 'Content-Type': 'application/json' }, header),
      success(res) { handleResult(res, resolve, reject, onUnauthorized) },
      fail() { reject(new Error('网络异常，请检查服务是否启动')) }
    })
  })
}

function dispatch(path, method, data, header, onUnauthorized) {
  return cloud.enabled && wx.cloud
    ? callCloud(path, method, data, header, onUnauthorized)
    : callHttp(path, method, data, header, onUnauthorized)
}

/** 后端 /api/files/** 相对地址拼成绝对地址（仅兼容旧数据与回退通道） */
function fileUrl(path) {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return BASE_URL + path
}

/** 云托管通道的照片上传：callContainer 不支持 multipart，交给代理 /__upload 转协议 */
function cloudUpload(filePath, tokenKey, onUnauthorized) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: filePath,
      encoding: 'base64',
      success(file) {
        const ext = (String(filePath).match(/\.([a-zA-Z0-9]+)$/) || [, 'jpg'])[1]
        const header = { 'X-WX-SERVICE': cloud.service }
        const token = wx.getStorageSync(tokenKey)
        if (token) header.Authorization = 'Bearer ' + token
        wx.cloud.callContainer({
          config: { env: cloud.env },
          path: '/__upload',
          method: 'POST',
          header: header,
          data: {
            file: file.data,
            filename: 'photo_' + Date.now() + '.' + ext,
            contentType: ext.toLowerCase() === 'png' ? 'image/png' : 'image/jpeg'
          },
          timeout: 12000,
          success(res) {
            handleResult(res, resolve, reject, onUnauthorized)
          },
          fail() { reject(new Error('照片上传失败，请检查云托管服务')) }
        })
      },
      fail() { reject(new Error('读取照片失败')) }
    })
  })
}

/**
 * 通用图片上传：云托管走 base64 + 代理转 multipart；回退通道用 wx.uploadFile。
 * tokenKey 区分客户端（token）与员工端（staffToken）两套会话。
 */
function uploadBySession(filePath, tokenKey, onUnauthorized) {
  if (cloud.enabled && wx.cloud) {
    return cloudUpload(filePath, tokenKey, onUnauthorized)
  }
  return new Promise((resolve, reject) => {
    const header = {}
    const token = wx.getStorageSync(tokenKey)
    if (token) header.Authorization = 'Bearer ' + token
    wx.uploadFile({
      url: BASE_URL + '/api/files/upload',
      filePath: filePath,
      name: 'file',
      header: header,
      success(res) {
        if (res.statusCode === 401) {
          onUnauthorized && onUnauthorized()
          reject(new Error('登录已过期，请重新登录'))
          return
        }
        try {
          const body = JSON.parse(res.data)
          if (body.code === 200) {
            resolve(body.data)
          } else {
            reject(new Error(body.message || '图片上传失败'))
          }
        } catch (e) {
          reject(new Error('上传返回解析失败'))
        }
      },
      fail() { reject(new Error('图片上传失败，请检查网络与后端服务')) }
    })
  })
}

function request(path, options = {}) {
  const { method = 'GET', data = {}, auth = true } = options
  const header = {}
  const token = wx.getStorageSync('token')
  if (auth && token) header.Authorization = 'Bearer ' + token
  const onUnauthorized = function () {
    wx.removeStorageSync('token')
    wx.removeStorageSync('customer')
    wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
    setTimeout(() => {
      wx.navigateTo({ url: '/pages/login/login' })
    }, 600)
  }
  return dispatch(path, method, data, header, onUnauthorized)
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
    const header = {}
    const token = wx.getStorageSync('staffToken')
    if (token) header.Authorization = 'Bearer ' + token
    const onUnauthorized = function () {
      auth.clearStaffSession()
      wx.showToast({ title: '员工登录已过期', icon: 'none' })
      setTimeout(function () {
        wx.redirectTo({ url: '/pages/login/login' })
      }, 600)
    }
    return dispatch(path, method, data, header, onUnauthorized)
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

  /** 现场照片上传（员工端）：云托管走 base64 + 代理转 multipart；回退通道用 wx.uploadFile */
  staffUpload(filePath) {
    return uploadBySession(filePath, 'staffToken', function () { auth.clearStaffSession() })
  },

  /** 宠物头像 / 疫苗证明上传（客户端），返回 { url: 绝对地址 } */
  customerUpload(filePath) {
    return uploadBySession(filePath, 'token', function () {
      wx.removeStorageSync('token')
      wx.removeStorageSync('customer')
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      setTimeout(function () { wx.redirectTo({ url: '/pages/login/login' }) }, 600)
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
