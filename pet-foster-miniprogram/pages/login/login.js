const api = require('../../utils/api')
const app = getApp()

const POLICIES = {
  用户协议: '欢迎使用「毛球旅馆」微信小程序。本产品用于宠物寄养预约服务演示，您提交的宠物与订单信息仅用于本演示系统，不用于真实业务。请勿填写真实敏感个人信息。',
  隐私政策: '手机号、宠物资料和订单仅用于本次预约服务。演示环境数据保存在本机演示数据库中，退出登录或刷新后本地凭据清除；疫苗名与日期为选填信息，仅用于照护核验。',
  寄养服务协议: '跨天寄养按晚计费：晚数 = 离店日期 - 入住日期，同日寄养按 1 天计费。含每日喂养、基础照护与清洁，无押金，不含医疗及另行协商服务。入住须携带有效免疫证明，未免疫宠物不可下单。演示支付及退款不产生真实资金流转。'
}

Page({
  data: {
    phone: '',
    password: '',
    agreed: false,
    canSubmit: false,
    showPassword: false,
    loading: false,
    showContact: false,
    showPolicy: false,
    policyTitle: '寄养服务协议',
    policyContent: POLICIES['寄养服务协议']
  },

  onLoad() {
    if (app.isLoggedIn()) {
      wx.switchTab({ url: '/pages/index/index' })
    }
  },

  // 与设计稿一致：手机号合法 + 密码≥6位 + 勾选协议，按钮才由禁用转为主色
  checkCanSubmit(phone, password, agreed) {
    return /^1[3-9]\d{9}$/.test(phone) && password.length >= 6 && !!agreed
  },

  onPhoneInput(e) {
    const phone = e.detail.value
    this.setData({ phone, canSubmit: this.checkCanSubmit(phone, this.data.password, this.data.agreed) })
  },
  onPasswordInput(e) {
    const password = e.detail.value
    this.setData({ password, canSubmit: this.checkCanSubmit(this.data.phone, password, this.data.agreed) })
  },
  toggleAgree() {
    const agreed = !this.data.agreed
    this.setData({ agreed, canSubmit: this.checkCanSubmit(this.data.phone, this.data.password, agreed) })
  },
  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },
  goRegister() {
    wx.navigateTo({ url: '/pages/register/register' })
  },
  noop() {},

  openPolicy(e) {
    const kind = e.currentTarget.dataset.kind
    this.setData({ showPolicy: true, policyTitle: kind, policyContent: POLICIES[kind] })
  },
  closePolicy() {
    this.setData({ showPolicy: false })
  },

  openContact() {
    this.setData({ showContact: true })
  },
  closeContact() {
    this.setData({ showContact: false })
  },
  callStore() {
    wx.makePhoneCall({ phoneNumber: '400-080-6060' })
  },

  fillDemo() {
    this.setData({
      phone: '13800138001',
      password: '123456',
      canSubmit: this.checkCanSubmit('13800138001', '123456', this.data.agreed)
    })
  },

  async submit() {
    const { phone, password, agreed, loading } = this.data
    if (loading) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (password.length < 6) {
      wx.showToast({ title: '密码至少 6 位', icon: 'none' })
      return
    }
    if (!agreed) {
      wx.showToast({ title: '请先阅读并勾选服务协议', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const res = await api.login(phone, password)
      app.setSession(res.token, res.customer)
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 400)
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
