const api = require('../../utils/api')
const app = getApp()

const POLICIES = {
  用户协议: '欢迎使用「毛球旅馆」微信小程序。本产品用于宠物寄养预约服务演示，您提交的宠物与订单信息仅用于本演示系统，不用于真实业务。请勿填写真实敏感个人信息。',
  隐私政策: '手机号、宠物资料和订单仅用于本次预约服务。演示环境数据保存在本机演示数据库中，退出登录或刷新后本地凭据清除；疫苗名与日期为选填信息，仅用于照护核验。'
}

Page({
  data: {
    phone: '',
    password: '',
    password2: '',
    agreed: false,
    canSubmit: false,
    showPassword: false,
    loading: false,
    tip: '',
    showPolicy: false,
    policyTitle: '用户协议',
    policyContent: POLICIES['用户协议']
  },

  checkCanSubmit(phone, password, password2, agreed) {
    return /^1[3-9]\d{9}$/.test(phone)
      && password.length >= 6
      && password === password2
      && !!agreed
  },

  onPhoneInput(e) {
    this.setData({
      phone: e.detail.value,
      canSubmit: this.checkCanSubmit(e.detail.value, this.data.password, this.data.password2, this.data.agreed)
    })
  },
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value,
      canSubmit: this.checkCanSubmit(this.data.phone, e.detail.value, this.data.password2, this.data.agreed)
    })
  },
  onPassword2Input(e) {
    this.setData({
      password2: e.detail.value,
      canSubmit: this.checkCanSubmit(this.data.phone, this.data.password, e.detail.value, this.data.agreed)
    })
  },
  toggleAgree() {
    const agreed = !this.data.agreed
    this.setData({ agreed, canSubmit: this.checkCanSubmit(this.data.phone, this.data.password, this.data.password2, agreed) })
  },
  togglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  goLogin() {
    wx.navigateBack({ delta: 1 })
  },
  noop() {},

  openPolicy(e) {
    const kind = e.currentTarget.dataset.kind
    this.setData({ showPolicy: true, policyTitle: kind, policyContent: POLICIES[kind] })
  },
  closePolicy() {
    this.setData({ showPolicy: false })
  },

  async submit() {
    const { phone, password, password2, loading } = this.data
    if (loading) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      this.setData({ tip: '请输入正确的手机号' })
      return
    }
    if (password.length < 6) {
      this.setData({ tip: '密码至少 6 位' })
      return
    }
    if (password !== password2) {
      this.setData({ tip: '两次输入的密码不一致' })
      return
    }
    if (!this.data.agreed) {
      this.setData({ tip: '请先阅读并勾选用户协议' })
      return
    }
    this.setData({ loading: true, tip: '' })
    try {
      const res = await api.register(phone, password)
      app.setSession(res.token, res.customer)
      wx.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        wx.reLaunch({ url: '/pages/index/index' })
      }, 600)
    } catch (e) {
      this.setData({ tip: e.message || '注册失败，请稍后再试' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
