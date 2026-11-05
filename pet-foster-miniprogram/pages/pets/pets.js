const api = require('../../utils/api')
const util = require('../../utils/util')
const app = getApp()

Page({
  data: {
    pets: [],
    loading: true,
    deletingId: null,
    showDelete: false,
    deletePet: null
  },

  onShow() {
    if (!app.isLoggedIn()) {
      wx.redirectTo({ url: '/pages/login/login' })
      return
    }
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      // 并行拉取宠物与进行中订单，用于「预约中」锁定标记
      const [pets, pendingRes, fosteringRes] = await Promise.all([
        api.pets(),
        api.orders({ page: 1, size: 50, status: '待入店' }).catch(() => ({ records: [] })),
        api.orders({ page: 1, size: 50, status: '寄养中' }).catch(() => ({ records: [] }))
      ])
      const bookingIds = {}
      ;((pendingRes && pendingRes.records) || [])
        .concat((fosteringRes && fosteringRes.records) || [])
        .forEach((o) => { if (o.petId) bookingIds[String(o.petId)] = true })
      const decorated = (pets || []).map((p) => {
        const v = util.vaccineDetails(p.vaccine)
        const cat = String(p.breed || '').indexOf('猫') > -1 || String(p.species || '').indexOf('猫') > -1
        const metaParts = [p.breed || '未知品种', p.gender || '未知', (p.age || '—') + '岁', (p.weight || '—') + 'kg']
        if (p.color) metaParts.push(p.color)
        return Object.assign({}, p, {
          v: v.vaccinated,
          vaccineLine: v.name ? v.name + (v.date ? ' ' + v.date.slice(0, 7) : '') : '',
          sexText: p.gender || '未知',
          petArt: cat ? 'cat' : 'dog',
          metaLine: metaParts.join(' · '),
          booking: !!bookingIds[String(p.id)]
        })
      })
      this.setData({ pets: decorated, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  backHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  noop() {},

  addPet() {
    wx.navigateTo({ url: '/pages/petEdit/petEdit' })
  },

  editPet(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/petEdit/petEdit?id=' + id })
  },

  openDelete(e) {
    const id = e.currentTarget.dataset.id
    const pet = this.data.pets.find((p) => String(p.id) === String(id))
    this.setData({ showDelete: true, deletePet: pet })
  },
  closeDelete() {
    this.setData({ showDelete: false, deletePet: null })
  },

  async confirmDelete() {
    const pet = this.data.deletePet
    if (!pet) return
    this.setData({ deletingId: pet.id })
    try {
      await api.deletePet(pet.id)
      this.setData({ showDelete: false, deletePet: null })
      wx.showToast({ title: '宠物档案已删除', icon: 'none' })
      this.load()
    } catch (e) {
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
      this.setData({ showDelete: false, deletePet: null })
    } finally {
      this.setData({ deletingId: null })
    }
  }
})
