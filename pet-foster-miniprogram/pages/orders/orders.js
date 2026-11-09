const nav = require('../../utils/nav.js')
const api = require('../../utils/api')
const util = require('../../utils/util')
const app = getApp()

// 业务态：全部 / 待支付 / 待入住 / 寄养中 / 已完成 / 已关闭
const FILTERS = ['全部', '待入住', '寄养中', '已完成', '已关闭']
const STATUS_CLASS = { 待入店: 'badge-orange', 寄养中: 'badge-blue', 已完成: 'badge-green', 已取消: 'badge-gray' }
// 设计稿订单卡左侧 3px 彩条
const BAR_CLASS = { 待入店: 'bar-orange', 寄养中: 'bar-blue', 已完成: 'bar-green', 已取消: 'bar-gray' }

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}
// LocalDateTime → MM-DD HH:mm
function createdAtText(v) {
  if (!v) return '—'
  const s = String(v).replace('T', ' ')
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/)
  return m ? `${m[2]}-${m[3]} ${m[4]}:${m[5]}` : s
}
// 支付截止 → MM/DD HH:mm
function deadlineText(v) {
  if (!v) return ''
  const s = String(v).replace('T', ' ')
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2})/)
  return m ? `${m[2]}/${m[3]} ${m[4]}:${m[5]}` : s
}

Page({
  data: {
    filters: FILTERS,
    activeFilter: '全部',
    keyword: '',
    list: [],
    total: 0,
    loading: false,
    finished: false
  },

  onShow() {
    nav.syncTabBar(this, 1)
    if (!app.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    const pf = wx.getStorageSync('pendingFilter')
    wx.removeStorageSync('pendingFilter')
    const activeFilter = FILTERS.indexOf(pf) > -1 ? pf : '全部'
    this.page = 1
    this.setData({ activeFilter, list: [], finished: false, filters: FILTERS })
    this.load()
  },

  onUnload() {
    if (this.cdTimer) clearInterval(this.cdTimer)
  },

  switchFilter(e) {
    const f = e.currentTarget.dataset.filter
    if (f === this.data.activeFilter) return
    this.page = 1
    this.setData({ activeFilter: f, list: [], finished: false, filters: FILTERS })
    this.load()
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value })
    if (this.searchTimer) clearTimeout(this.searchTimer)
    this.searchTimer = setTimeout(() => {
      this.page = 1
      this.setData({ list: [], finished: false })
      this.load()
    }, 500)
  },

  clearKeyword() {
    this.setData({ keyword: '' })
    this.page = 1
    this.setData({ list: [], finished: false })
    this.load()
  },

  buildParams(page) {
    const { activeFilter, keyword } = this.data
    const params = { page, size: 10 }
    // 前端筛选口径 → 后端 status（订单创建即已支付，不再区分支付态）
    if (activeFilter === '待入住') params.status = '待入店'
    else if (activeFilter === '寄养中' || activeFilter === '已完成') params.status = activeFilter
    else if (activeFilter === '已关闭') params.status = '已取消'
    if (keyword && keyword.trim()) params.keyword = keyword.trim()
    return params
  },

  async load() {
    if (this.data.loading || this.data.finished) return
    this.setData({ loading: true })
    try {
      // 宠物档案用于头像品种映射（订单 VO 未带品种）
      if (!this.petMap) {
        try {
          const pets = await api.pets()
          const map = {}
          ;(pets || []).forEach((p) => { map[String(p.id)] = p })
          this.petMap = map
        } catch (err) {
          this.petMap = {}
        }
      }
      const res = await api.orders(this.buildParams(this.page))
      let records = (res.records || []).map((o) => this.decorate(o))
      const list = this.page === 1 ? records : this.data.list.concat(records)
      this.setData({
        list,
        total: this.page === 1 ? (res.total != null ? res.total : records.length) : this.data.total,
        finished: this.page * res.size >= res.total || records.length === 0
      })
      this.startCountdown()
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading) return
    this.page += 1
    this.load()
  },

  onPullDownRefresh() {
    this.page = 1
    this.setData({ list: [], finished: false })
    this.load().then(() => wx.stopPullDownRefresh())
  },

  decorate(o) {
    // 订单创建即已支付，不再有未支付/超时概念
    const unpaid = false
    const expired = false
    const cls = STATUS_CLASS[o.status] || 'badge-gray'
    const bar = BAR_CLASS[o.status] || 'bar-gray'
    const pet = this.petMap ? this.petMap[String(o.petId)] : null
    let action = ''
    // 业务状态展示：已取消统一为 已关闭，待入店展示为 待入住
    const bizStatus = o.status === '已取消' ? '已关闭' : (o.status === '待入店' ? '待入住' : o.status)
    // 卡片状态以左侧竖条 + 顶部标签表达，不再铺底色
    if (o.status === '已取消') action = '已关闭'
    else action = '查看详情'
    return Object.assign({}, o, {
      bizStatus,
      statusClass: cls,
      barClass: bar,
      unpaid,
      expired,
      action,
      totalFeeText: util.money(o.totalFee),
      remainText: '',
      payText: '',
      dateText: (util.shortDate(o.startDate) || '—') + ' → ' + (util.shortDate(o.endDate) || '—'),
      stayText: '共' + util.stayLabel(o.startDate, o.endDate),
      roomText: o.priceLevelName || '寄养房型',
      createdText: createdAtText(o.createdAt),
      deadlineText: '',
      petArt: pet && String(pet.species || '').indexOf('猫') > -1 ? 'cat' : 'dog',
      breedText: pet && pet.breed ? '（' + pet.breed + '）' : '',
      cancellable: o.status === '待入店'
    })
  },

  isExpired(o) {
    if (!o.expiresAt) return false
    const t = util.toMs(o.expiresAt)
    return Number.isFinite(t) && t <= Date.now()
  },

  startCountdown() {
    if (this.cdTimer) clearInterval(this.cdTimer)
    this.cdTimer = setInterval(() => {
      const list = this.data.list.map((o) => {
        if (o.unpaid && !o.expired) {
          return Object.assign({}, o, { remainText: util.countdown(o.expiresAt) })
        }
        return o
      })
      this.setData({ list })
    }, 1000)
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/orderDetail/orderDetail?id=' + id })
  },

  goPay(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/pay/pay?orderId=' + id })
  },

  cancelOrder(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消这笔预约？',
      content: '取消后名额将释放，需重新预约。',
      confirmText: '取消预约',
      confirmColor: '#d92d20',
      success: async (r) => {
        if (!r.confirm) return
        try {
          await api.cancelOrder(id)
          wx.showToast({ title: '已取消预约', icon: 'success' })
          this.page = 1
          this.setData({ list: [], finished: false })
          this.load()
        } catch (err) {
          wx.showToast({ title: err.message || '取消失败', icon: 'none' })
        }
      }
    })
  },

  bookAgain() {
    wx.reLaunch({ url: '/pages/index/index' })
  }
})
