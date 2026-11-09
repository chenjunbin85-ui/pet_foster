const auth = require('../../../utils/auth.js')
const nav = require('../../../utils/nav.js')
const api = require('../../../utils/api.js')
const app = getApp()

const WORKBENCH_LABEL = { CARE: '护理', VET: '兽医', GROOM: '洗护', DRIVER: '接送' }
const WORKBENCH_TITLE = { CARE: '护理工作台', VET: '兽医工作台', GROOM: '洗护工作台', DRIVER: '司机接送' }

function decorate(list) {
  return (list || []).map(function (w) {
    return Object.assign({}, w, {
      shortLabel: WORKBENCH_LABEL[w.group] || '岗位',
      shortTitle: WORKBENCH_TITLE[w.group] || w.title
    })
  })
}

Page({
  data: {
    meName: '', meInitial: '员', positionLabel: '', positions: [], isVet: false,
    workbenches: [], groups: [], menuCount: 0, today: {}
  },

  onLoad() {
    const s = auth.guard(this, 'staff/home')
    if (!s) return
    this.setData({
      meName: s.name,
      meInitial: (s.name || '员工').slice(0, 1),
      positionLabel: s.label,
      positions: s.positions,
      isVet: s.positions.indexOf('VET') >= 0,
      workbenches: decorate(auth.workbenches(s.positions))
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
        meName: s.name,
        meInitial: (s.name || '员工').slice(0, 1),
        positionLabel: ps.map((p) => auth.LABEL[p]).join('、') || '未分配岗位',
        positions: ps,
        isVet: ps.indexOf('VET') >= 0,
        workbenches: decorate(auth.workbenches(ps))
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

  goToday() {
    nav.goTab('/pages/staff/today/today')
  }
})
