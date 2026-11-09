const api = require('../../../utils/api.js')
const nav = require('../../../utils/nav.js')
const auth = require('../../../utils/auth.js')
const app = getApp()

function toast(title) {
  wx.showToast({ title: String(title || '操作失败').slice(0, 30), icon: 'none', duration: 2200 })
}

Page({
  data: {
    me: {},
    meName: '',
    meInitial: '员',
    positionLabel: '',
    roleLabel: '员工',
    isVet: false,
    today: {},
    onDuty: false,
    progress: { done: 0, todo: 0, upload: 0 },
    noticeCount: 0,
    badges: {},
    menuCount: 0,
    permissionText: '',
    version: '1.0.0'
  },

  onLoad() {
    const s = auth.guard(this, 'staff/mine')
    if (!s) return
    const groups = auth.menuFor(s.positions)
    let n = 0
    const lines = []
    groups.forEach(function (g) {
      n += g.items.length
      lines.push(g.label + '：' + g.items.map(function (i) { return i.title }).join('、'))
    })
    const role = (s.info && s.info.role) || ''
    this.setData({
      meName: s.name,
      meInitial: String(s.name || '员工').slice(0, 1),
      positionLabel: s.label,
      isVet: s.positions.indexOf('VET') >= 0,
      roleLabel: role.toLowerCase() === 'admin' ? '店长 / 管理员' : '员工',
      menuCount: n,
      permissionText: lines.join('\n') || '当前账号暂无可访问的员工端功能'
    })
  },

  onShow() {
    nav.syncTabBar(this, 2)
    if (!this.data.meName) return
    this.load()
  },

  load() {
    const that = this
    Promise.all([
      api.staffMe().catch(function (e) { return { __error: e } }),
      api.staffToday().catch(function (e) { return { __error: e } })
    ]).then(function (res) {
      const patch = {}
      if (res[0] && !res[0].__error) patch.me = res[0]
      if (res[1] && !res[1].__error) {
        const today = res[1]
        const patrol = today.patrol || {}
        patch.today = today
        patch.onDuty = !!(today.me && today.me.onDuty)
        patch.progress = {
          done: Number(patrol.done) || 0,
          todo: (Number(today.pendingCount) || 0) + (Number(patrol.pending) || 0),
          upload: 0
        }
        patch.badges = { mine: that.data.noticeCount }
      }
      that.setData(patch)
    }).catch(function (e) { toast(e.message) })
  },

  goWorkbench() {
    nav.goDetail('/pages/staff/home/home')
  },

  goDuty() {
    wx.navigateTo({ url: '/pages/staff/v1/v1' })
  },

  goMenus() {
    nav.goTab('/pages/staff/queue/queue')
  },

  comingSoon(name) {
    wx.showModal({
      title: name,
      content: '该模块属于阶段三补齐范围（需后端聚合接口），当前演示版本暂未开放。',
      showCancel: false, confirmText: '知道了', confirmColor: '#E8743B'
    })
  },
  goNotices() { this.comingSoon('消息') },
  goRecords() { this.comingSoon('我的记录') },
  goShift() { this.comingSoon('我的班次') },
  goTeam() { this.comingSoon('当班同事') },
  goSettings() { this.comingSoon('修改密码') },
  goNotifySettings() { this.comingSoon('通知设置') },

  showPermissions() {
    wx.showModal({
      title: '岗位权限范围',
      content: this.data.permissionText,
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#E8743B'
    })
  },

  switchAccount() {
    wx.showModal({
      title: '切换账号',
      content: '将退出当前员工账号并回到登录页，确定继续吗？',
      confirmColor: '#E8743B',
      success(res) {
        if (!res.confirm) return
        app.clearStaffSession()
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定退出员工账号吗？',
      confirmColor: '#E8743B',
      success(res) {
        if (!res.confirm) return
        app.clearStaffSession()
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  },

  about() {
    wx.showModal({
      title: '关于毛球旅馆',
      content: '员工端 v' + this.data.version + '\n现场作业工具：护理、巡视、异常、交接、核销。所有操作记录操作人与时间，按岗位授权。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#E8743B'
    })
  },

  help() {
    wx.showModal({
      title: '帮助与反馈',
      content: '演示环境：如需协助请联系门店管理员，服务电话 400-080-6060。',
      showCancel: false,
      confirmText: '知道了',
      confirmColor: '#E8743B'
    })
  }
})
