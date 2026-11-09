/**
 * 一级·聚合页「今日」（讨论稿 §2.1 / §3.1）。
 * 首屏回答「我下一步做什么」：班次一行 → 进度 → 按状态分组的队列 → 底部 tab。
 * 数据复用 /api/staff/today，不新增后端依赖；按人归属字段待后端补（讨论稿 §6 前置依赖）。
 */
const api = require('../../../utils/api.js')
const auth = require('../../../utils/auth.js')
const nav = require('../../../utils/nav.js')
const queueState = require('../../../utils/queue-state.js')

const TASK_PATH = {
  CARE: '/pages/staff/c2/c2',
  VET: '/pages/staff/v2/v2',
  GROOM: '/pages/staff/g2/g2',
  DRIVER: '/pages/staff/d2/d2',
  FRONT: '/pages/staff/c5/c5',
  OWNER: '/pages/staff/c5/c5'
}
const ACTION = {
  CARE: '开始巡视', VET: '去评估', GROOM: '开始作业',
  DRIVER: '到场打卡', FRONT: '去交接', OWNER: '查看'
}
const GROUP_TITLE = {
  CARE: { '寄养中': '待巡视 · 本班', '待入店': '待入店交接' },
  VET: { '寄养中': '待评估 / 待复核', '待入店': '入店健康评估' },
  GROOM: { '寄养中': '待洗护', '待入店': '待开始' },
  DRIVER: { '寄养中': '待送达', '待入店': '待接宠' },
  FRONT: { '寄养中': '待离店交接', '待入店': '待入店交接' },
  OWNER: { '寄养中': '在住订单', '待入店': '待入店' }
}

function primary(positions) {
  if (positions.indexOf('OWNER') >= 0) return 'OWNER'
  return positions[0] || 'OWNER'
}

Page({
  data: {
    loading: true,
    error: '',
    today: {},
    positionLabel: '',
    onDuty: false,
    progress: { done: 0, todo: 0, upload: 0 },
    sections: [],
    badges: {}
  },

  onLoad() {
    const s = auth.guard(this, 'staff/today')
    if (!s) return
    this.positions = s.positions
    this.setData({ positionLabel: s.label })
    this.load()
  },

  onShow() {
    nav.syncTabBar(this, 0)
    if (!this.positions) return
    this.load()
  },

  reload() { this.load() },

  load() {
    const that = this
    this.setData({ loading: true, error: '' })
    api.staffToday().then(function (today) {
      that.render(today || {})
    }).catch(function (e) {
      that.setData({ loading: false, error: (e && e.message) || '请检查网络或稍后重试' })
    })
  },

  render(today) {
    const pos = primary(this.positions || [])
    const titles = GROUP_TITLE[pos] || GROUP_TITLE.OWNER
    const path = TASK_PATH[pos]
    const action = ACTION[pos]
    const done = queueState.doneIds()
    const orders = (today.orders || []).filter(function (o) { return done.indexOf(String(o.id)) < 0 })
    const buckets = {}
    orders.forEach(function (o) {
      const key = o.status || '其他'
      const title = titles[key] || (key === '其他' ? key : key + '订单')
      if (!buckets[key]) buckets[key] = { key: key, title: title, items: [] }
      buckets[key].items.push({
        id: o.id,
        orderNo: o.orderNo || '—',
        petName: o.petName || '宠物',
        petInitial: String(o.petName || '宠').slice(0, 1),
        roomNo: o.roomNo || '',
        roomType: o.roomType || '',
        roomLabel: o.roomNo || o.roomType || '—',
        status: o.status || '—',
        customerName: o.customerName || '—',
        startDate: o.startDate || '—',
        action: action,
        tagClass: key === '待入店' ? 'tag-orange' : 'tag-blue',
        path: path
      })
    })
    const sections = Object.keys(buckets).map(function (k) { return buckets[k] })
    const patrol = today.patrol || {}
    const progress = {
      done: Math.max(Number(patrol.done) || 0, queueState.doneCount()),
      todo: Math.max(0, (Number(today.pendingCount) || 0) + (Number(patrol.pending) || 0) - queueState.doneCount()),
      upload: 0   // 离线补传队列待 P1，先占位
    }
    this.setData({
      loading: false,
      error: '',
      today: today,
      onDuty: !!(today.me && today.me.onDuty),
      progress: progress,
      sections: sections,
      badges: { today: progress.todo }
    })
  },

  goTask(e) {
    const ds = e.currentTarget.dataset
    if (!ds.path) return
    nav.goDetail(ds.path + (ds.id ? '?id=' + ds.id : ''))
  },

  goAll() { nav.goDetail('/pages/staff/home/home') },
  goQueue() { nav.goTab('/pages/staff/queue/queue') }
})
