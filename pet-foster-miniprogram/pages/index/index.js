const api = require('../../utils/api')
const util = require('../../utils/util')
const app = getApp()

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate())
}

// 日期加减：LocalDate "YYYY-MM-DD" + n 天
function addDays(s, n) {
  const d = new Date(String(s).replace(/-/g, '/'))
  d.setDate(d.getDate() + n)
  return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate())
}

// 设计稿日期卡显示 MM-DD 短格式
function shortDate(s) {
  return s ? String(s).slice(5) : '请选择'
}

Page({
  data: {
    pets: [],
    prices: [],
    petId: null,
    pet: null,
    start: '',
    end: '',
    today: '',
    maxStart: '',
    maxEnd: '',
    startShort: '请选择',
    endShort: '请选择',
    priceId: null,
    price: null,
    showPetPicker: false,
    loading: true,
    bookingReason: '',
    stayLabel: '—',
    totalFee: '0.00',
    storeOpen: true
  },

  // 增值服务（演示）：洗护 / 遛宠 / 接送
  extras: [
    { id: 'bath', name: '洗护美容', price: 30 },
    { id: 'walk', name: '每日遛宠', price: 20 },
    { id: 'pickup', name: '上门接送', price: 40 }
  ],
  extrasSel: {},
  remark: '',

  onLoad() {
    const today = todayStr()
    const tomorrow = addDays(today, 1)
    // 明确可选范围：滚轮列短的日期区间，避免年份列过长导致滑动卡顿/回弹
    this.setData({
      start: today,
      end: tomorrow,
      today,
      maxStart: addDays(today, 180),
      maxEnd: addDays(tomorrow, 180),
      startShort: shortDate(today),
      endShort: shortDate(tomorrow)
    })
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.loadData()
  },

  async loadData() {
    this.setData({ loading: true })
    try {
      const [pets, prices] = await Promise.all([api.pets(), api.prices()])
      const petsV = (pets || []).map((p) => Object.assign({}, p, { v: util.vaccineDetails(p.vaccine).vaccinated }))
      // 恢复草稿选择；无草稿时默认选中第一只已免疫宠物（未免疫不可下单，优先展示可预约项）
      const draft = wx.getStorageSync('draft') || {}
      let petId = draft.petId
      if (!petId) {
        const firstReady = petsV.find((p) => p.v)
        petId = firstReady ? firstReady.id : (petsV.length ? petsV[0].id : null)
      }
      // 与设计稿一致：默认选中“舒适间”（第 2 个房型，带“人气”标记）
      let priceId = draft.priceId || (prices.length > 1 ? prices[1].id : (prices.length ? prices[0].id : null))
      const start = draft.start || this.data.start
      const end = draft.end || this.data.end
      const pet = petsV.find((p) => String(p.id) === String(petId)) || null
      const price = prices.find((p) => String(p.id) === String(priceId)) || null
      const draftExtras = draft.extras || {}
      const draftRemark = draft.remark || ''
      this.setData({ pets: petsV, prices, petId, priceId, pet, price, start, end, startShort: shortDate(start), endShort: shortDate(end), loading: false })
      this.setData({ extrasSel: draftExtras, remark: draftRemark })
      this.refreshAmount()
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  refreshAmount() {
    const { pet, price, start, end } = this.data
    const days = util.calcDays(start, end)
    let roomFee = days && price ? days * Number(price.pricePerDay) : 0
    let extraFee = 0
    Object.keys(this.data.extrasSel || {}).forEach((id) => {
      if (this.data.extrasSel[id]) {
        const ex = this.data.extras.find((e) => e.id === id)
        if (ex) extraFee += ex.price
      }
    })
    const total = roomFee + extraFee
    const reason = !pet ? '请选择入住宠物' : !pet.v ? '未接种疫苗暂不可预约，请先完善免疫信息' : !days ? '请选择有效日期，离店不能早于入住' : ''
    this.setData({
      stayLabel: util.stayLabel(start, end),
      totalFee: total.toFixed(2),
      roomFee: roomFee.toFixed(2),
      extraFee: extraFee.toFixed(2),
      bookingReason: reason
    })
  },

  openPetPicker() {
    this.setData({ showPetPicker: true })
  },
  closePetPicker() {
    this.setData({ showPetPicker: false })
  },
  selectPet(e) {
    const id = e.currentTarget.dataset.id
    const pet = this.data.pets.find((p) => String(p.id) === String(id)) || null
    this.setData({ petId: id, pet, showPetPicker: false })
    this.refreshAmount()
  },

  onStartChange(e) {
    const start = e.detail.value
    const end = start > this.data.end ? start : this.data.end
    this.setData({
      start,
      end,
      maxEnd: addDays(end, 180),
      startShort: shortDate(start),
      endShort: shortDate(end)
    })
    this.refreshAmount()
  },
  onEndChange(e) {
    const end = e.detail.value
    this.setData({ end, endShort: shortDate(end) })
    this.refreshAmount()
  },
  onStartToday() {
    const start = todayStr()
    this.setData({ start, startShort: shortDate(start) })
    this.refreshAmount()
  },

  noop() {},

  selectPrice(e) {
    const id = e.currentTarget.dataset.id
    const price = this.data.prices.find((p) => String(p.id) === String(id)) || null
    this.setData({ priceId: id, price })
    this.refreshAmount()
  },

  bookNow() {
    const { pet, price, start, end, bookingReason, loading } = this.data
    if (loading) return
    if (!pet || !price || bookingReason) {
      wx.showToast({ title: bookingReason || '请完善预订信息', icon: 'none' })
      return
    }
    const extras = {}
    Object.keys(this.data.extrasSel || {}).forEach((k) => { if (this.data.extrasSel[k]) extras[k] = true })
    const draft = {
      petId: pet.id, petName: pet.name, priceId: price.id, start, end,
      extras, remark: this.data.remark || '',
      roomFee: this.data.roomFee, extraFee: this.data.extraFee
    }
    wx.setStorageSync('draft', draft)
    wx.navigateTo({ url: '/pages/checkout/checkout' })
  },

  addPet() {
    wx.navigateTo({ url: '/pages/petEdit/petEdit' })
  },

  toggleExtra(e) {
    const id = e.currentTarget.dataset.id
    const sel = Object.assign({}, this.data.extrasSel)
    sel[id] = !sel[id]
    this.setData({ extrasSel: sel })
    this.refreshAmount()
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  }
})
