const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    order: null,
    countdownText: '--:--',
    canPay: false,
    paying: false,
    expired: false
  },

  onLoad(options) {
    let orderId = options.orderId
    if (!orderId) {
      const saved = wx.getStorageSync('currentOrder')
      if (saved && saved.id) orderId = saved.id
    }
    if (!orderId) {
      wx.showToast({ title: '未找到待支付订单', icon: 'none' })
      setTimeout(() => wx.reLaunch({ url: '/pages/orders/orders' }), 600)
      return
    }
    this.orderId = orderId
    this.loadOrder()
  },

  onUnload() {
    if (this.timer) clearInterval(this.timer)
  },

  async loadOrder() {
    try {
      const order = await api.orderDetail(this.orderId)
      this.setData({ order: Object.assign({}, order, {
        totalFeeText: util.money(order.totalFee),
        stayText: util.stayLabel(order.startDate, order.endDate)
      }) })
      this.refreshCountdown()
      this.timer = setInterval(() => this.refreshCountdown(), 1000)
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    }
  },

  refreshCountdown() {
    const { order } = this.data
    if (!order) return
    if (order.status === '已取消') {
      if (this.timer) clearInterval(this.timer)
      this.setData({ countdownText: '已关闭', canPay: false })
      return
    }
    if (order.paymentStatus === '已支付') {
      if (this.timer) clearInterval(this.timer)
      this.setData({ countdownText: '已支付', canPay: false })
      return
    }
    const expiresAt = order.expiresAt || order.payDeadline
    const now = Date.now()
    const target = expiresAt ? util.toMs(expiresAt) : NaN
    const left = Number.isFinite(target) ? target - now : 0
    if (left <= 0) {
      if (this.timer) clearInterval(this.timer)
      this.setData({ countdownText: '00:00', canPay: false, expired: true })
      return
    }
    this.setData({
      countdownText: util.countdown(expiresAt, now),
      canPay: true,
      expired: false
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
  viewResult() {
    wx.redirectTo({ url: '/pages/payResult/payResult?orderId=' + this.data.order.id })
  },

  async confirmPay() {
    const { order, paying, canPay } = this.data
    if (paying || !canPay || !order) return
    this.setData({ paying: true })
    try {
      await api.payOrder(order.id)
      wx.redirectTo({ url: '/pages/payResult/payResult?orderId=' + order.id })
    } catch (e) {
      wx.showToast({ title: e.message || '支付失败', icon: 'none' })
      this.setData({ paying: false })
    }
  }
})
