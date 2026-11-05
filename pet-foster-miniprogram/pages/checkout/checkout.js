const api = require('../../utils/api')
const util = require('../../utils/util')

const POLICY_SERVICE = '跨天寄养按晚计费：晚数 = 离店日期 - 入住日期；同日寄养按 1 天计费。含每日喂养、基础照护与清洁，无押金，不含医疗及另行协商服务。入住须携带有效免疫证明，未免疫宠物不可下单。入住前 24 小时可免费取消并原路退款；逾期取消按 1 晚房费收取手续费。演示支付及退款不产生真实资金流转。'
const POLICY_NOTICE = '到店时间建议为 10:00（入住）与 18:00（离店），具体以门店确认为准。请携带宠物常用粮、疫苗证明与牵引用品；猫狗独立分区不混住。寄养期间门店将每日拍摄照片并记录饮食、活动与健康状态，可在订单详情中查看。如宠物出现发热、腹泻、拒食等异常，门店将第一时间联系紧急联系人并就近送医，相关医疗费用由寄养家庭承担。'

Page({
  data: {
    pet: null,
    price: null,
    start: '',
    end: '',
    days: 0,
    stayLabel: '—',
    totalFee: '0.00',
    roomFee: '0.00',
    extraFee: '0.00',
    extraItems: [],
    priceLabel: '',
    contactName: '',
    contactPhone: '',
    emergencyPhone: '',
    remark: '',
    store: null,
    coupons: [],
    selectedCoupon: null,
    discountFee: '0.00',
    agreed: false,
    submitting: false,
    showPolicy: false,
    policyTitle: '宠物寄养服务协议'
  },

  onLoad() {
    this.setData({ POLICY_TEXT: POLICY_SERVICE, policyTitle: '宠物寄养服务协议' })
    const draft = wx.getStorageSync('draft') || {}
    if (!draft.petId || !draft.priceId || !draft.start || !draft.end) {
      wx.showToast({ title: '预约信息不完整，请重新选择', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
      return
    }
    this.draft = draft
    // 联系人默认取登录客户
    const app = getApp()
    const customer = app.globalData.customer || {}
    this.setData({
      start: draft.start, end: draft.end,
      contactName: customer.name || '',
      contactPhone: customer.phone || '',
      remark: draft.remark || ''
    })
    this.loadDetail()
    this.loadExtras()
  },

  async loadExtras() {
    try {
      const [stores, coupons] = await Promise.all([
        api.stores().catch(() => []),
        api.coupons().catch(() => [])
      ])
      const store = (stores || [])[0] || null
      const unused = (coupons || []).filter((c) => c.status === 'UNUSED')
      this.setData({ store, coupons: unused })
    } catch (e) {}
  },

  async loadDetail() {
    const draft = this.draft
    try {
      const [pets, prices] = await Promise.all([api.pets(), api.prices()])
      const pet = pets.find((p) => String(p.id) === String(draft.petId)) || null
      const price = prices.find((p) => String(p.id) === String(draft.priceId)) || null
      if (!pet || !price) {
        wx.showToast({ title: '宠物或房型已失效，请重新选择', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 600)
        return
      }
      const days = util.calcDays(draft.start, draft.end)
      const roomFee = days * Number(price.pricePerDay)
      const extrasDef = [
        { id: 'bath', name: '洗护美容', price: 30 },
        { id: 'walk', name: '每日遛宠', price: 20 },
        { id: 'pickup', name: '上门接送', price: 40 }
      ]
      const sel = draft.extras || {}
      const extraItems = extrasDef.filter((e) => sel[e.id])
      const extraFee = extraItems.reduce((s, e) => s + e.price, 0)
      const total = roomFee + extraFee
      this.setData({
        pet,
        price,
        days,
        stayLabel: util.stayLabel(draft.start, draft.end),
        totalFee: total.toFixed(2),
        roomFee: roomFee.toFixed(2),
        extraFee: extraFee.toFixed(2),
        extraItems,
        priceLabel: price.levelName + ' ¥' + Number(price.pricePerDay).toFixed(2) + '/晚'
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    }
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value })
  },
  onContactNameInput(e) {
    this.setData({ contactName: e.detail.value })
  },
  onContactPhoneInput(e) {
    this.setData({ contactPhone: e.detail.value })
  },
  onEmergencyPhoneInput(e) {
    this.setData({ emergencyPhone: e.detail.value })
  },

  selectCoupon(e) {
    const id = e.currentTarget.dataset.id
    const coupon = this.data.coupons.find((c) => String(c.couponId) === String(id)) || null
    const discountFee = coupon ? Number(coupon.discount).toFixed(2) : '0.00'
    // 重新计算实付
    const roomFee = parseFloat(this.data.roomFee) || 0
    const extraFee = parseFloat(this.data.extraFee) || 0
    const total = Math.max(0, roomFee + extraFee - (coupon ? Number(coupon.discount) : 0))
    this.setData({ selectedCoupon: coupon, discountFee, totalFee: total.toFixed(2) })
  },
  back() {
    wx.navigateBack()
  },
  noop() {},
  toggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },
  openPolicy(e) {
    const type = (e.currentTarget.dataset || {}).type || 'service'
    const isNotice = type === 'notice'
    this.setData({
      showPolicy: true,
      policyTitle: isNotice ? '用户须知' : '宠物寄养服务协议',
      POLICY_TEXT: isNotice ? POLICY_NOTICE : POLICY_SERVICE
    })
  },
  closePolicy() {
    this.setData({ showPolicy: false })
  },

  async submit() {
    const { pet, price, start, end, remark, contactName, contactPhone, emergencyPhone, agreed, submitting } = this.data
    if (submitting) return
    if (!agreed) {
      wx.showToast({ title: '请先阅读并勾选寄养服务协议', icon: 'none' })
      return
    }
    if (!pet || !price) return
    if (!contactName.trim()) {
      wx.showToast({ title: '请填写联系人姓名', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(contactPhone)) {
      wx.showToast({ title: '请填写正确的联系电话', icon: 'none' })
      return
    }
    if (remark && remark.length > 200) {
      wx.showToast({ title: '备注最多 200 字', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      // 打包演示字段：联系人/增值服务/备注 → remark
      const parts = []
      parts.push('联系人：' + contactName.trim() + ' ' + contactPhone)
      if (emergencyPhone.trim()) parts.push('紧急联系人：' + emergencyPhone.trim())
      if (this.data.extraItems && this.data.extraItems.length) {
        parts.push('增值服务：' + this.data.extraItems.map((e) => e.name).join('、'))
      }
      if (remark.trim()) parts.push('照护备注：' + remark.trim())
      const packedRemark = parts.join('；').slice(0, 255)
      const order = await api.createOrder({
        petId: pet.id,
        startDate: start,
        endDate: end,
        priceId: price.id,
        storeId: this.data.store ? this.data.store.storeId : 1,
        couponId: this.data.selectedCoupon ? this.data.selectedCoupon.couponId : null,
        remark: packedRemark
      })
      wx.setStorageSync('currentOrder', order)
      // 订单创建即完成微信收款（演示），直接进入支付成功页
      wx.redirectTo({ url: '/pages/payResult/payResult?orderId=' + order.id })
    } catch (e) {
      wx.showToast({ title: e.message || '下单失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
