App({
  globalData: {
    token: '',
    customer: null,
    // 员工端与客户会话隔离：同一小程序按角色分流，互不串号
    staffToken: '',
    staffInfo: null
  },

  onLaunch() {
    this.globalData.token = wx.getStorageSync('token') || ''
    this.globalData.customer = wx.getStorageSync('customer') || null
    this.globalData.staffToken = wx.getStorageSync('staffToken') || ''
    this.globalData.staffInfo = wx.getStorageSync('staffInfo') || null
  },

  setSession(token, customer) {
    this.globalData.token = token
    this.globalData.customer = customer
    wx.setStorageSync('token', token)
    wx.setStorageSync('customer', customer)
  },

  clearSession() {
    this.globalData.token = ''
    this.globalData.customer = null
    wx.removeStorageSync('token')
    wx.removeStorageSync('customer')
    wx.removeStorageSync('draft')
    wx.removeStorageSync('currentOrder')
  },

  isLoggedIn() {
    return !!this.globalData.token
  },

  setStaffSession(token, info) {
    this.globalData.staffToken = token
    this.globalData.staffInfo = info
    wx.setStorageSync('staffToken', token)
    wx.setStorageSync('staffInfo', info)
  },

  clearStaffSession() {
    this.globalData.staffToken = ''
    this.globalData.staffInfo = null
    wx.removeStorageSync('staffToken')
    wx.removeStorageSync('staffInfo')
  },

  isStaffLoggedIn() {
    return !!this.globalData.staffToken
  }
})
