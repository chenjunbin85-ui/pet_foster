const api = require('../../utils/api')
const util = require('../../utils/util')

const STATUS_CLASS = { 待入店: 'badge-orange', 寄养中: 'badge-blue', 已完成: 'badge-green', 已取消: 'badge-gray' }

Page({
  data: {
    order: null,
    statusText: '',
    timeline: [],
    careRecords: [],
    showReview: false,
    rating: 5,
    reviewContent: '',
    existingReview: null,
    showConfirmCancel: false,
    showRefundNote: false,
    cancelling: false,
    showContact: false
  },

  onLoad(options) {
    this.orderId = options.id
    this.loadOrder()
  },

  async loadOrder() {
    try {
      const order = await api.orderDetail(this.orderId)
      const statusText = this.buildStatusText(order)
      const timeline = this.buildTimeline(order)
      // 寄养中/已完成的订单加载照护记录与评价
      const careRecords = await api.careRecords(order.id).catch(() => [])
      const existingReview = order.status === '已完成' ? await api.getReview(order.id).catch(() => null) : null
      this.setData({
        timeline,
        careRecords: careRecords || [],
        existingReview: existingReview || null,
        order: Object.assign({}, order, {
          statusClass: STATUS_CLASS[order.status] || 'badge-gray',
          payClass: order.paymentStatus === '已支付'
            ? 'badge-green'
            : (order.paymentStatus === '已退款' ? 'badge-gray' : 'badge-orange'),
          payText: order.paymentStatus === '已退款' ? '已退款（模拟）' : (order.paymentStatus === '已支付' ? '已支付' : '未支付'),
          expired: this.isExpired(order),
          totalFeeText: util.money(order.totalFee),
          dateText: (order.startDate || '—') + ' → ' + (order.endDate || '—'),
          stayText: util.stayLabel(order.startDate, order.endDate),
          createdText: String(order.createdAt || '').replace('T', ' ').slice(5, 16),
          remark: order.remark || ''
        }),
        statusText
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    }
  },

  buildStatusText(o) {
    if (o.status === '待入店') {
      if (o.paymentStatus !== '已支付') return '请及时完成支付，支付后预约生效。'
      return '预约成功，期待您的到来。建议 ' + (o.startDate || '入住当日') + ' 10:00 携带宠物到店。'
    }
    if (o.status === '寄养中') {
      return '毛孩子正在安心享受寄养服务，有问题请联系门店。'
    }
    if (o.status === '已完成') {
      return '本次寄养服务已完成，欢迎再次预约。'
    }
    if (o.status === '已取消') {
      return o.paymentStatus === '已退款' ? '预约已关闭，金额已模拟退回。' : '预约已关闭。'
    }
    return ''
  },

  // 寄养服务进度时间线：基于订单状态推导
  buildTimeline(o) {
    const steps = [
      { key: 'booked', label: '预约成功', desc: '订单已创建', done: true, current: false },
      { key: 'arrived', label: '宠物已送达', desc: '到店交接', done: false, current: false },
      { key: 'checked', label: '入住检查', desc: '健康与环境检查', done: false, current: false },
      { key: 'fostering', label: '寄养照护中', desc: '每日喂养·活动·健康记录', done: false, current: false },
      { key: 'ready', label: '待接宠', desc: '等待离店接回', done: false, current: false },
      { key: 'done', label: '已完成', desc: '离店交接完成', done: false, current: false }
    ]
    let idx = 0
    if (o.status === '已取消') {
      steps[0].current = false
      return steps
    }
    if (o.status === '待入店') idx = o.paymentStatus === '已支付' ? 1 : 0
    else if (o.status === '寄养中') idx = 3
    else if (o.status === '已完成') idx = 5
    steps.forEach((s, i) => {
      s.done = i < idx
      s.current = i === idx
    })
    return steps
  },

  isExpired(o) {
    if (!o || !o.expiresAt) return false
    const t = util.toMs(o.expiresAt)
    return Number.isFinite(t) && t <= Date.now()
  },

  goPay() {
    wx.navigateTo({ url: '/pages/pay/pay?orderId=' + this.data.order.id })
  },

  /* 取消预约 */
  openCancel() {
    this.setData({ showConfirmCancel: true })
  },
  closeConfirmCancel() {
    this.setData({ showConfirmCancel: false })
  },
  proceedRefundNote() {
    this.setData({ showConfirmCancel: false, showRefundNote: true })
  },
  closeRefundNote() {
    this.setData({ showRefundNote: false })
  },
  async doCancel() {
    const { order, cancelling } = this.data
    if (cancelling) return
    this.setData({ cancelling: true })
    try {
      await api.cancelOrder(order.id)
      this.setData({ showRefundNote: false })
      wx.showToast({
        title: order.paymentStatus === '已支付' ? '已取消并模拟退款' : '已取消',
        icon: 'none'
      })
      this.loadOrder()
    } catch (e) {
      wx.showToast({ title: e.message || '取消失败', icon: 'none' })
    } finally {
      this.setData({ cancelling: false })
    }
  },

  bookAgain() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  back() {
    wx.navigateBack()
  },
  scrollToCare() {
    wx.pageScrollTo({ selector: '#care-panel', duration: 300 })
  },
  noop() {},

  openContact() {
    this.setData({ showContact: true })
  },
  closeContact() {
    this.setData({ showContact: false })
  },
  callStore() {
    wx.makePhoneCall({ phoneNumber: '400-080-6060' })
  }
  ,

  openReview() {
    this.setData({ showReview: true, rating: 5, reviewContent: '' })
  },
  closeReview() {
    this.setData({ showReview: false })
  },
  setRating(e) {
    this.setData({ rating: Number(e.currentTarget.dataset.r) })
  },
  onReviewInput(e) {
    this.setData({ reviewContent: e.detail.value })
  },
  async submitReview() {
    if (this.data.submittingReview) return
    this.setData({ submittingReview: true })
    try {
      await api.submitReview(this.data.order.id, { rating: this.data.rating, content: this.data.reviewContent })
      wx.showToast({ title: '评价已提交', icon: 'success' })
      this.setData({ showReview: false })
      this.loadOrder()
    } catch (e) {
      wx.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      this.setData({ submittingReview: false })
    }
  }
})
