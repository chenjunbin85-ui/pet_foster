const auth = require('../../../utils/auth.js')
const api = require('../../../utils/api.js')
const app = getApp()

Page({
  data: {
    meName: '', positionLabel: '', positions: [], isVet: false,
    workbenches: [], groups: [], menuCount: 0, today: {}
  },

  onLoad() {
    const s = auth.guard(this, 'staff/home')
    if (!s) return
    this.setData({
      meName: s.name,
      positionLabel: s.label,
      positions: s.positions,
      isVet: s.positions.indexOf('VET') >= 0,
      workbenches: auth.workbenches(s.positions)
    })
    this.buildMenu(s.positions)
    this.load()
  },

  onShow() {
    const s = auth.getSession()
    if (!s.token) return
    // 调岗后回到工作台立即生效（PRD 3.7）
    api.staffMe().then((me) => {
      wx.setStorageSync('staffInfo', Object.assign({}, wx.getStorageSync('staffInfo') || {}, me))
      const ps = auth.normalize(wx.getStorageSync('staffInfo') || {})
      this.setData({
        positionLabel: ps.map((p) => auth.LABEL[p]).join('、') || '未分配岗位',
        positions: ps,
        isVet: ps.indexOf('VET') >= 0,
        workbenches: auth.workbenches(ps)
      })
      this.buildMenu(ps)
    }).catch(() => {})
  },

  buildMenu(positions) {
    const groups = auth.menuFor(positions)
    let n = 0
    groups.forEach((g) => { n += g.items.length })
    this.setData({ groups: groups, menuCount: n })
  },

  load() {
    api.staffToday().then((today) => {
      this.setData({ today: today })
    }).catch((e) => {
      wx.showToast({ title: e.message || '待办加载失败', icon: 'none' })
    })
  },

  go(e) {
    const p = e.currentTarget.dataset.path
    if (!p) return
    const first = (this.data.today.orders || [])[0]
    let url = p
    if (first && first.id && p.indexOf('/c1/') < 0 && p.indexOf('/v1/') < 0 &&
        p.indexOf('/g1/') < 0 && p.indexOf('/d1/') < 0) {
      url += '?id=' + first.id
    }
    wx.navigateTo({ url: url })
  },

  noop() {},

  logout() {
    wx.showModal({
      title: '退出登录', content: '确定退出员工账号吗？', confirmColor: '#E8743B',
      success: (res) => {
        if (!res.confirm) return
        app.clearStaffSession()
        wx.redirectTo({ url: '/pages/login/login' })
      }
    })
  }
})
