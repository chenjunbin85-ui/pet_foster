/**
 * 毛球旅馆 · 接口封装
 * 后端：pet-foster-server（Spring Boot，端口 8090）
 * 统一 Result: { code, message, data }；业务错误 code=500（message 为提示文案）
 */
const BASE_URL = 'http://127.0.0.1:8090'

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
  }
}
