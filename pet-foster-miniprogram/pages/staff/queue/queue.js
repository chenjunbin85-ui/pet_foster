/**
 * 一级·岗位台「队列」（讨论稿 §2.1 / §9.2）。
 * 一套页面按岗位渲染不同内容，正面回应「一岗一人」与「各岗位同一视角」的缺陷：
 * tab2 文案由 components/tabbar 按 positions 决定，队列内容由本页按 activePos 决定。
 */
const api = require('../../../utils/api.js')
const auth = require('../../../utils/auth.js')
const nav = require('../../../utils/nav.js')
const queueState = require('../../../utils/queue-state.js')

const CONFIG = {
  OWNER:  { label: '门店', desc: '门店红标与兜底处理', title: '在住与待入店订单', action: '查看',   path: '/pages/staff/c5/c5', badge: '在店' },
  FRONT:  { label: '交接', desc: '入离店交接与客户签字', title: '交接队列',         action: '去交接', path: '/pages/staff/c5/c5', badge: '待交接' },
  CARE:   { label: '巡视', desc: '每班 3 次巡视与照护记录', title: '待巡视 / 待交接', action: '开始巡视', path: '/pages/staff/c2/c2', badge: '待巡视' },
  VET:    { label: '复核', desc: '入店评估、异常复核与离店签署', title: '待评估 / 待复核', action: '去复核', path: '/pages/staff/v3/v3', badge: '待复核' },
  GROOM:  { label: '洗护', desc: '洗护作业与服务核销',   title: '待洗护 / 待核销',   action: '开始作业', path: '/pages/staff/g2/g2', badge: '待洗护' },
  DRIVER: { label: '接送', desc: '到场打卡与送达交接',   title: '今日趟次',           action: '到场打卡', path: '/pages/staff/d2/d2', badge: '待出发' }
}
const ORDER = ['OWNER', 'FRONT', 'CARE', 'VET', 'GROOM', 'DRIVER']

function primary(positions) {
  if (positions.indexOf('OWNER') >= 0) return 'OWNER'
  return positions[0] || 'OWNER'
}

Page({
  data: {
    loading: true,
    error: '',
    segments: [],
    activePos: 'OWNER',
    roleLabel: '岗位',
    roleDesc: '',
    queueTitle: '',
    action: '查看',
    isOwner: false,
    counts: { todo: 0, doing: 0, done: 0 },
    alerts: [],
    cards: [],
    badges: {}
  },

  onLoad() {
    const s = auth.guard(this, 'staff/queue')
    if (!s) return
    const ps = s.positions.filter(function (p) { return ORDER.indexOf(p) >= 0 })
    const segments = ps.map(function (p) { return { key: p, label: CONFIG[p].label } })
    this.positions = ps
    this.setData({ segments: segments, activePos: primary(ps) })
    this.load()
  },

  onShow() {
    nav.syncTabBar(this, 1)
    if (!this.positions) return
    this.load()
  },

  reload() { this.load() },

  switchSegment(e) {
    const pos = e.currentTarget.dataset.pos
    if (!pos || !CONFIG[pos]) return
    this.setData({ activePos: pos })
    this.render(this.lastToday || {})
  },

  load() {
    const that = this
    this.setData({ loading: true, error: '' })
    api.staffToday().then(function (today) {
      that.lastToday = today || {}
      that.setData({ loading: false, error: '' })
      that.render(that.lastToday)
    }).catch(function (e) {
      that.setData({ loading: false, error: (e && e.message) || '请检查网络或稍后重试' })
    })
  },

  render(today) {
    const pos = this.data.activePos
    const cfg = CONFIG[pos] || CONFIG.OWNER
    const done = queueState.doneIds()
    const orders = (today.orders || []).filter(function (o) { return done.indexOf(String(o.id)) < 0 })
    const cards = orders.map(function (o) {
      const fostering = o.status === '寄养中'
      return {
        id: o.id,
        orderNo: o.orderNo || '—',
        petName: o.petName || '宠物',
        petInitial: String(o.petName || '宠').slice(0, 1),
        roomLabel: o.roomNo || o.roomType || '—',
        roomType: o.roomType || '—',
        status: o.status || '—',
        customerName: o.customerName || '—',
        startDate: o.startDate || '—',
        badge: cfg.badge,
        tagClass: fostering ? 'tag-blue' : 'tag-orange',
        hint: fostering ? '本班待处理' : '待入店 / 待接单',
        path: cfg.path
      }
    })
    const patrol = today.patrol || {}
    const counts = {
      todo: Number(today.pendingCount) || 0,
      doing: Number(today.fosteringCount) || 0,
      done: Math.max(Number(patrol.done) || 0, queueState.doneCount())
    }
    const alerts = [
      { label: '无在岗兽医', value: (today.vet && today.vet.vetReady) ? 0 : 1 },
      { label: '证照 60 天到期', value: 0 },
      { label: '待退款', value: 0 },
      { label: '隔离中', value: 0 }
    ]
    this.setData({
      roleLabel: cfg.label,
      roleDesc: cfg.desc,
      queueTitle: cfg.title,
      action: cfg.action,
      isOwner: pos === 'OWNER',
      counts: counts,
      alerts: alerts,
      cards: cards,
      badges: { queue: counts.todo }
    })
  },

  goTask(e) {
    const ds = e.currentTarget.dataset
    if (!ds.path) return
    nav.goDetail(ds.path + (ds.id ? '?id=' + ds.id : ''))
  }
})
