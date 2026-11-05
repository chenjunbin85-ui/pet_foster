const api = require('../../utils/api')
const app = getApp()

// 设计稿展示 138****8888 形态
function maskPhone(phone) {
  const s = String(phone || '')
  return s.length === 11 ? s.slice(0, 3) + '****' + s.slice(7) : s || '—'
}

Page({
  data: {
    customer: null,
    phoneText: '—',
    avatarText: '宠',
    stats: { pending: 0, fostering: 0, completed: 0, cumulative: 0 },
    showAbout: false,
    showContact: false,
    showProfile: false,
    showDemoModal: false,
    demoTitle: '',
    demoText: ''
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const customer = app.globalData.customer
    const name = (customer && customer.name) || '爱宠家长'
    this.setData({
      customer,
      phoneText: maskPhone(customer && customer.phone),
      avatarText: name.charAt(0)
    })
    this.loadStats()
  },

  async loadStats() {
    try {
      const stats = await api.stats()
      this.setData({ stats })
    } catch (e) {
      // 统计失败不阻塞页面
    }
  },

  goPets() {
    wx.navigateTo({ url: '/pages/pets/pets' })
  },
  goOrders(e) {
    const filter = e.currentTarget.dataset.filter
    if (filter) wx.setStorageSync('pendingFilter', filter)
    wx.switchTab({ url: '/pages/orders/orders' })
  },

  openContact() {
    this.setData({ showContact: true })
  },
  closeContact() {
    this.setData({ showContact: false })
  },
  openProfile() {
    this.setData({ showProfile: true })
  },
  closeProfile() {
    this.setData({ showProfile: false })
  },
  openAbout() {
    this.setData({ showAbout: true })
  },
  closeAbout() {
    this.setData({ showAbout: false })
  },
  callStore() {
    wx.makePhoneCall({ phoneNumber: '400-080-6060' })
  },

  openCoupons() {
    api.coupons().then((list) => {
      const unused = (list || []).filter((c) => c.status === 'UNUSED')
      const text = unused.length ? unused.map((c) => c.name + ' -' + c.discount).join('；') : '当前没有可用优惠券。'
      this.setData({ showDemoModal: true, demoTitle: '我的优惠券', demoText: text })
    }).catch(() => {
      this.setData({ showDemoModal: true, demoTitle: '我的优惠券', demoText: '暂无可用优惠券。' })
    })
  },
  openReviews() {
    this.setData({ showDemoModal: true, demoTitle: '我的评价', demoText: '已完成的寄养订单可在订单详情中提交评价。当前演示环境暂不展示评价列表。' })
  },
  openHelp() {
    this.setData({ showDemoModal: true, demoTitle: '客服与帮助', demoText: '营业时间 09:00–21:00。客服电话 400-080-6060（演示）。常见问题：取消退款、接送范围、疫苗要求见订单页服务协议。' })
  },
  closeDemoModal() {
    this.setData({ showDemoModal: false })
  },

  noop() {},

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出当前账号吗？',
      confirmColor: '#d92d20',
      success: (res) => {
        if (res.confirm) {
          app.clearSession()
          wx.redirectTo({ url: '/pages/login/login' })
        }
      }
    })
  }
})
