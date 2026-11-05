App({
  globalData: {
    token: '',
    customer: null
  },

  onLaunch() {
    this.globalData.token = wx.getStorageSync('token') || ''
    this.globalData.customer = wx.getStorageSync('customer') || null
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
  }
})
