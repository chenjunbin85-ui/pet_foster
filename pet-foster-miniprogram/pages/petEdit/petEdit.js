const api = require('../../utils/api')
const util = require('../../utils/util')

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + util.pad2(d.getMonth() + 1) + '-' + util.pad2(d.getDate())
}

Page({
  data: {
    id: null,
    isEdit: false,
    locked: false,
    name: '',
    breed: '',
    gender: '公',
    genderIndex: 0,
    birthDate: '',
    age: '',
    weight: '',
    color: '',
    vaccinated: false,
    vaccineName: '',
    vaccineDate: '',
    vaccineProof: '',
    today: todayStr(),
    neuterOptions: ['未绝育', '已绝育', '不详'],
    neuterIndex: 2,
    personality: '',
    diet: '',
    allergy: '',
    medical: '',
    history: '',
    saving: false,
    showDelete: false,
    // 图片上传
    petArt: 'dog',
    photoUrl: '',
    avatarPreview: '',
    avatarUploading: false,
    vaccineProofUrl: '',
    vaccineProofPreview: '',
    proofUploading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ id: options.id, isEdit: true })
      this.loadPet(options.id)
    }
  },

  async loadPet(id) {
    try {
      const p = await api.petDetail(id)
      const v = util.vaccineDetails(p.vaccine)
      const isCat = (p.breed || '').indexOf('猫') > -1
      this.setData({
        name: p.name || '',
        breed: p.breed || '',
        gender: p.gender === '母' ? '母' : '公',
        genderIndex: p.gender === '母' ? 1 : 0,
        age: p.age != null ? String(p.age) : '',
        weight: p.weight != null ? String(p.weight) : '',
        color: p.color || '',
        vaccinated: v.vaccinated,
        vaccineName: v.name || '',
        vaccineDate: v.date || '',
        history: p.history || '',
        locked: !!p.locked,
        petArt: isCat ? 'cat' : 'dog',
        photoUrl: p.photoUrl || '',
        avatarPreview: api.fileUrl(p.photoUrl),
        vaccineProofUrl: p.vaccineProofUrl || '',
        vaccineProofPreview: api.fileUrl(p.vaccineProofUrl)
      })
    } catch (e) {
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    }
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onBreedInput(e) { this.setData({ breed: e.detail.value }) },
  onAgeInput(e) { this.setData({ age: e.detail.value }) },
  onWeightInput(e) { this.setData({ weight: e.detail.value }) },
  onColorInput(e) { this.setData({ color: e.detail.value }) },
  onPersonalityInput(e) { this.setData({ personality: e.detail.value }) },
  onDietInput(e) { this.setData({ diet: e.detail.value }) },
  onAllergyInput(e) { this.setData({ allergy: e.detail.value }) },
  onMedicalInput(e) { this.setData({ medical: e.detail.value }) },
  onNeuterChange(e) { this.setData({ neuterIndex: Number(e.detail.value) }) },
  onHistoryInput(e) { this.setData({ history: e.detail.value }) },
  onGenderChange(e) {
    const idx = Number(e.detail.value)
    this.setData({ genderIndex: idx, gender: idx === 1 ? '母' : '公' })
  },
  toggleVaccinated() {
    if (this.data.locked) return
    this.setData({ vaccinated: !this.data.vaccinated })
  },
  onVaccineNameInput(e) { this.setData({ vaccineName: e.detail.value }) },
  onVaccineDateChange(e) { this.setData({ vaccineDate: e.detail.value }) },
  onBirthDateChange(e) {
    const birth = e.detail.value
    let age = ''
    if (birth) {
      const b = new Date(birth + 'T00:00:00')
      const now = new Date()
      let years = now.getFullYear() - b.getFullYear()
      const mDiff = now.getMonth() - b.getMonth()
      if (mDiff < 0 || (mDiff === 0 && now.getDate() < b.getDate())) years -= 1
      age = Math.max(0, years) + ''
    }
    this.setData({ birthDate: birth, age })
  },
  /**
   * 选图：优先 chooseMedia（可同时压缩），低版本基础库回退 chooseImage。
   * 返回本地临时路径，供上传前即时预览。
   */
  chooseLocalImage() {
    return new Promise((resolve, reject) => {
      if (wx.chooseMedia) {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => resolve(res.tempFiles[0].tempFilePath),
          fail: reject
        })
      } else {
        wx.chooseImage({
          count: 1,
          sizeType: ['compressed'],
          sourceType: ['album', 'camera'],
          success: (res) => resolve(res.tempFilePaths[0]),
          fail: reject
        })
      }
    })
  },

  /** 宠物头像：选图 → 即时预览 → 上传 → 回填 photoUrl（保存时随档案落库） */
  async chooseAvatar() {
    if (this.data.avatarUploading) return
    let localPath
    try {
      localPath = await this.chooseLocalImage()
    } catch (e) {
      return // 用户取消选图
    }
    this.setData({ avatarPreview: localPath, avatarUploading: true })
    wx.showLoading({ title: '上传中', mask: true })
    try {
      const uploaded = await api.customerUpload(localPath)
      this.setData({ photoUrl: uploaded.url, avatarPreview: api.fileUrl(uploaded.url) })
      wx.hideLoading()
      wx.showToast({ title: '头像已上传', icon: 'none' })
    } catch (e) {
      wx.hideLoading()
      this.setData({ avatarPreview: api.fileUrl(this.data.photoUrl) })
      wx.showToast({ title: e.message || '头像上传失败', icon: 'none' })
    } finally {
      this.setData({ avatarUploading: false })
    }
  },

  removeAvatar() {
    if (this.data.avatarUploading) return
    this.setData({ photoUrl: '', avatarPreview: '' })
  },

  /** 疫苗/驱虫证明：同样先上传拿到地址，再随档案一起保存 */
  async chooseVaccineProof() {
    if (this.data.proofUploading) return
    let localPath
    try {
      localPath = await this.chooseLocalImage()
    } catch (e) {
      return
    }
    this.setData({ vaccineProofPreview: localPath, proofUploading: true })
    wx.showLoading({ title: '上传中', mask: true })
    try {
      const uploaded = await api.customerUpload(localPath)
      this.setData({ vaccineProofUrl: uploaded.url, vaccineProofPreview: api.fileUrl(uploaded.url) })
      wx.hideLoading()
      wx.showToast({ title: '证明已上传', icon: 'none' })
    } catch (e) {
      wx.hideLoading()
      this.setData({ vaccineProofPreview: api.fileUrl(this.data.vaccineProofUrl) })
      wx.showToast({ title: e.message || '证明上传失败', icon: 'none' })
    } finally {
      this.setData({ proofUploading: false })
    }
  },

  validate() {
    const { name, breed, age, weight, vaccineName, vaccineDate, vaccinated, history } = this.data
    if (!name.trim() || name.trim().length > 20) return '昵称需为 1-20 个字符'
    if (!breed.trim() || breed.trim().length > 30) return '品种需为 1-30 个字符'
    const ageNum = Number(age)
    if (age === '' || !Number.isInteger(ageNum) || ageNum < 0 || ageNum > 40) return '年龄需为 0-40 的整数'
    const weightNum = Number(weight)
    if (weight === '' || Number.isNaN(weightNum) || weightNum < 0.1 || weightNum > 150) return '体重需在 0.1-150kg 之间'
    if (history && history.length > 255) return '备注最多 255 字'
    if (vaccinated) {
      if (vaccineName.trim().length > 40) return '疫苗名最多 40 字'
      if (vaccineDate && vaccineDate > this.data.today) return '接种日期不能晚于今天'
    }
    return ''
  },

  async save() {
    const { saving, id, isEdit, locked, neuterIndex, neuterOptions, personality, diet, allergy, medical, history } = this.data
    if (saving) return
    const err = this.validate()
    if (err) {
      wx.showToast({ title: err, icon: 'none' })
      return
    }
    // 打包扩展字段到 history（后端未单独建列）
    const parts = []
    const neuter = neuterOptions[neuterIndex]
    if (neuter && neuter !== '不详') parts.push('绝育：' + neuter)
    if (personality.trim()) parts.push('性格：' + personality.trim())
    if (diet.trim()) parts.push('饮食：' + diet.trim())
    if (allergy.trim()) parts.push('过敏：' + allergy.trim())
    if (medical.trim()) parts.push('病史：' + medical.trim())
    if (history.trim()) parts.push(history.trim())
    const packed = parts.join('；').slice(0, 255)
    const payload = {
      name: this.data.name.trim(),
      breed: this.data.breed.trim(),
      gender: this.data.gender,
      age: Number(this.data.age),
      weight: Number(this.data.weight),
      color: this.data.color.trim(),
      photoUrl: this.data.photoUrl || '',
      vaccineProofUrl: this.data.vaccineProofUrl || '',
      history: packed
    }
    if (this.data.vaccinated) {
      payload.vaccine = util.vaccineText(this.data.vaccineName, this.data.vaccineDate)
    } else {
      payload.vaccine = '未接种'
    }
    this.setData({ saving: true })
    try {
      if (isEdit) {
        await api.updatePet(id, payload)
      } else {
        await api.createPet(payload)
      }
      wx.showToast({ title: locked ? '已保存（仅更新可修改项）' : '已保存', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) {
      wx.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  openDelete() {
    this.setData({ showDelete: true })
  },  closeDelete() {
    this.setData({ showDelete: false })
  },
  back() {
    wx.navigateBack()
  },
  noop() {},
  async confirmDelete() {
    try {
      await api.deletePet(this.data.id)
      this.setData({ showDelete: false })
      wx.showToast({ title: '已删除', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) {
      wx.showToast({ title: e.message || '删除失败', icon: 'none' })
      this.setData({ showDelete: false })
    }
  }
})
