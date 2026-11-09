const api = require('../../utils/api')
const util = require('../../utils/util')

Page({
  data: {
    order: null
  },

  onLoad(options) {
    this.orderId = options.orderId
    this.loadOrder()
  },

  async loadOrder() {
    try {
      const order = await api.orderDetail(this.orderId)
      this.setData({ order: Object.assign({}, order, {
        totalFeeText: util.money(order.totalFee),
        stayText: util.stayLabel(order.startDate, order.endDate)
      }) })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },
  goOrders() {
    wx.reLaunch({ url: '/pages/orders/orders' })
  }
})
