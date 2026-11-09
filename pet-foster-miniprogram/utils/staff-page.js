/**
 * 员工端页面工厂：17 个原型页共用的鉴权、数据加载、表单、照片、签名、提交逻辑。
 *
 * 页面 js 只声明配置（key / title / tabs / build），交互与权限由本文件统一提供，
 * 避免 17 份重复代码，也保证「每页 onLoad 都过 guard」不会被漏写。
 */
const api = require('./api.js')
const auth = require('./auth.js')
const nav = require('./nav.js')
const queueState = require('./queue-state.js')

function nowText() {
  const d = new Date()
  function p(n) { return n < 10 ? '0' + n : '' + n }
  return p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

function toast(title) {
  wx.showToast({ title: String(title || '操作失败').slice(0, 30), icon: 'none', duration: 2200 })
}

function createStaffPage(opts) {
  const base = {
    data: Object.assign({
      title: opts.title || '',
      readOnly: false,
      submitting: false,
      success: false,
      tab: {},
      form: {},
      photos: {},
      // 未带订单参数时沿用原型示例值，带 ?id= 时由 /api/staff/orders/{id} 覆盖为真实数据
      d: {
        orderNo: 'OD202611060018',
        petName: '豆豆',
        breed: '柯基',
        roomNo: 'A-203',
        customerName: '王女士',
        phoneMasked: '138****6621',
        status: '寄养中',
        startDate: '11-06',
        endDate: '11-12'
      },
      // 作业页统一主语头（讨论稿 §2.2 规则 1：一页一主语）
      subject: { petName: '宠物', roomNo: '—', round: 1, shift: '本班', context: '' },
      today: {},
      summary: {},
      incident: {},
      duty: {},
      me: null,
      meName: '',
      meInitial: '员',
      positionLabel: '',
      positions: [],
      query: {}
    }, opts.data || {}),

    onLoad(q) {
      const session = auth.guard(this, opts.key)
      if (!session) return
      this._session = session
      const tab = {}
      ;(opts.tabs || []).forEach(function (t) { tab[t.group] = t.initial })
      this.setData({
        query: q || {},
        tab: tab,
        title: opts.title || '',
        meInitial: String(session.name || '员工').slice(0, 1)
      })
      if (opts.onLoad) opts.onLoad.call(this, q || {}, session)
      this.loadData(q || {})
    },

    onShow() {
      // 调岗 / 资质变化后回到页面时刷新身份（PRD 3.7 多端同源）
      if (!this._session) return
      api.staffMe().then((me) => {
        wx.setStorageSync('staffInfo', Object.assign({}, wx.getStorageSync('staffInfo') || {}, me))
      }).catch(() => {})
    },

    /** 统一数据底座：今日待办 + 订单详情 + 异常详情 + 健康摘要 */
    loadData(q) {
      const that = this
      const jobs = [api.staffToday()]
      if (q.id) jobs.push(api.staffOrderDetail(q.id))
      if (q.incidentId) jobs.push(api.staffIncidentDetail(q.incidentId))
      if (q.id && opts.needSummary) jobs.push(api.staffHealthSummary(q.id))
      // V1 在岗确认页：读取当日班次与执业资质，决定「在岗 / 未确认」两套视图
      if (opts.needDuty) jobs.push(api.staffDuty())
      Promise.all(jobs.map(function (p) { return p.catch(function (e) { return { __error: e.message } }) }))
        .then(function (res) {
          const patch = {}
          if (res[0] && !res[0].__error) patch.today = res[0]
          let i = 1
          if (q.id && res[i]) {
            if (!res[i].__error) patch.d = res[i]
            else toast(res[i].__error)
            i++
          }
          if (q.incidentId && res[i]) {
            if (!res[i].__error) patch.incident = res[i]
            else toast(res[i].__error)
            i++
          }
          if (q.id && opts.needSummary && res[i] && !res[i].__error) patch.summary = res[i]
          if (opts.needDuty) {
            const dutyRes = res[res.length - 1]
            if (dutyRes && !dutyRes.__error) patch.duty = dutyRes
          }
          const d = patch.d || that.data.d || {}
          const t = patch.today || that.data.today || {}
          patch.subject = {
            petName: d.petName || '宠物',
            roomNo: d.roomNo || d.roomType || '—',
            round: 1,
            shift: (t.shift || '本班') + '班',
            context: t.dateText ? ('今日已完成 ' + (((t.patrol || {}).done) || 0) + ' 次') : ''
          }
          that.setData(patch)
          if (opts.afterLoad) opts.afterLoad.call(that, patch)
        })
        .catch(function (e) { toast(e.message) })
    },

    /** 分段控件 */
    switchSegment(e) {
      const ds = e.currentTarget.dataset
      if (!ds.tab) return
      this.setData({ ['tab.' + (ds.group || 'main')]: ds.tab })
    },

    /** 单选卡片 / 选项 */
    pick(e) {
      const ds = e.currentTarget.dataset
      if (!ds.field) return
      const patch = { ['form.' + ds.field]: ds.value }
      if (ds.alert) patch['form.skinAlert'] = true
      if (ds.clearAlert) patch['form.skinAlert'] = false
      this.setData(patch)
    },

    /** 勾选行 */
    toggle(e) {
      const ds = e.currentTarget.dataset
      if (!ds.field) return
      const cur = this.data.form[ds.field]
      this.setData({ ['form.' + ds.field]: !cur })
    },

    onField(e) {
      const field = e.currentTarget.dataset.field
      if (!field) return
      this.setData({ ['form.' + field]: e.detail.value })
    },

    /** 现场照片：先选本地图，提交时统一上传（弱网可重试） */
    choosePhoto(e) {
      const key = e.currentTarget.dataset.key || 'default'
      const that = this
      const list = (this.data.photos[key] && this.data.photos[key].items) || []
      const remain = Math.max(1, 6 - list.length)
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        success(res) {
          const items = list.slice()
          res.tempFiles.forEach(function (f) {
            items.push({ url: f.tempFilePath, wm: nowText() + ' · 现场照片', pending: true })
          })
          that.setData({ ['photos.' + key]: { items: items.slice(0, 6) } })
        },
        fail() { /* 用户取消不提示 */ }
      })
    },

    removePhoto(e) {
      const key = e.currentTarget.dataset.key || 'default'
      const idx = Number(e.currentTarget.dataset.index)
      const items = ((this.data.photos[key] || {}).items || []).slice()
      if (idx >= 0 && idx < items.length) items.splice(idx, 1)
      this.setData({ ['photos.' + key]: { items: items } })
    },

    previewPhoto(e) {
      const url = e.currentTarget.dataset.url
      if (!url) return
      const key = e.currentTarget.dataset.key || 'default'
      const urls = ((this.data.photos[key] || {}).items || []).map(function (p) { return p.url })
      wx.previewImage({ current: url, urls: urls.length ? urls : [url] })
    },

    /** 手写签名（旧版 canvas 接口，兼容性最好） */
    signStart(e) {
      this._signing = true
      this._ctx = wx.createCanvasContext(e.currentTarget.dataset.id || 'signCanvas', this)
      this._ctx.setStrokeStyle('#1A1A1A')
      this._ctx.setLineWidth(2.2)
      this._ctx.setLineCap('round')
      this._ctx.setLineJoin('round')
      this._last = { x: e.touches[0].x, y: e.touches[0].y }
      this._ctx.moveTo(this._last.x, this._last.y)
      this._ctx.lineTo(this._last.x + 0.1, this._last.y + 0.1)
      this._ctx.stroke()
      this._ctx.draw(true)
      this.setData({ 'form.signed': true })
    },
    signMove(e) {
      if (!this._signing || !this._ctx) return
      const p = { x: e.touches[0].x, y: e.touches[0].y }
      this._ctx.moveTo(this._last.x, this._last.y)
      this._ctx.lineTo(p.x, p.y)
      this._ctx.stroke()
      this._ctx.draw(true)
      this._last = p
    },
    signEnd() { this._signing = false },
    clearSign(e) {
      const id = (e && e.currentTarget && e.currentTarget.dataset.id) || 'signCanvas'
      const ctx = wx.createCanvasContext(id, this)
      ctx.clearRect(0, 0, 1000, 400)
      ctx.draw()
      this.setData({ 'form.signed': false })
    },

    /** V1 在岗确认：写当日 VET 班次，后端同时校验执业证有效期 */
    toggleDuty(e) {
      if (this.data.readOnly) { toast('当前岗位对该页面只有只读权限'); return }
      if (!e.detail.value) { toast('在岗确认后不可撤销，请重新登录后再操作'); return }
      const that = this
      api.staffConfirmDuty().then(function (res) {
        that.setData({ duty: res, 'form.onDuty': true })
        toast(res.message || '今日已确认在岗')
      }).catch(function (err) { toast(err.message) })
    },

    /** 通用提交：先上传照片 → 页面 build 出接口与参数 → 调用后端 → 成功态 */
    async submit() {
      if (this.data.readOnly) { toast('当前岗位对该页面只有只读权限'); return }
      if (this.data.submitting) return
      if (!opts.build) { toast('该页面为展示页'); return }
      this.setData({ submitting: true })
      try {
        // 收集所有照片组，逐张上传；单条最多 6 张
        const photoUrls = []
        const photos = this.data.photos || {}
        for (const key of Object.keys(photos)) {
          const items = (photos[key] || {}).items || []
          for (const it of items) {
            if (it.pending) {
              const up = await api.staffUpload(it.url)
              photoUrls.push(up.url)
              // it.url 保留微信本地临时路径，<image> 可直接显示，无需 downloadFile 合法域名
              it.remoteUrl = up.url
              it.pending = false
            } else if (it.remoteUrl) {
              photoUrls.push(it.remoteUrl)
            } else if (it.url && it.url.indexOf(api.BASE_URL) === 0) {
              photoUrls.push(it.url.replace(api.BASE_URL, ''))
            }
          }
        }
        const built = opts.build.call(this, photoUrls.join(','))
        if (!built || !built.api || typeof api[built.api] !== 'function') {
          toast('页面提交配置缺失')
          return
        }
        // 异常复核 / 授权页没有选中异常时不能打 /incidents/0，给出可读提示
        if (built.requireIncident && !built.args[0]) {
          toast('暂无待复核异常，请从工作台选择')
          return
        }
        const res = await api[built.api].apply(api, built.args || [])
        if (built.after) built.after.call(this, res)
        if (built.success !== false) this.setData({ success: true })
        queueState.markDone(this.orderId(), opts.key)
        toast(built.successTitle || '提交成功')
        this.afterSubmitDialog()
      } catch (err) {
        toast(err.message || '提交失败')
      } finally {
        this.setData({ submitting: false })
      }
    },

    /** 页面未带 ?id= 时取今日待办第一单，保证表单可以直接提交验证 */
    orderId() {
      const q = this.data.query || {}
      if (q.id) return q.id
      const list = (this.data.today && this.data.today.orders) || []
      return list.length ? list[0].id : 5
    },
    incidentId() {
      const q = this.data.query || {}
      if (q.incidentId) return q.incidentId
      const list = ((this.data.today || {}).vet || {}).reviewTasks || []
      return list.length ? list[0].incidentId : 0
    },

    /** 提交闭环：不再只是「保存成功请关闭页面」（讨论稿 §1.5 / §2.2 规则 7） */
    afterSubmitDialog() {
      const that = this
      wx.showModal({
        title: '这一单已完成',
        content: '作业已记录。继续下一只，还是回到今日队列？',
        confirmText: '下一只', cancelText: '回队列',
        success(res) {
          if (res.confirm) that.nextTask()
          else nav.goTab('/pages/staff/today/today')
        }
      })
    },
    nextTask() {
      const done = queueState.doneIds()
      const list = (this.data.today && this.data.today.orders) || []
      const next = list.filter(function (o) { return done.indexOf(String(o.id)) < 0 })[0]
      if (!next) {
        toast('今日队列已全部完成')
        nav.goTab('/pages/staff/today/today')
        return
      }
      const pages = getCurrentPages()
      const route = pages.length ? '/' + pages[pages.length - 1].route : ''
      if (!route) { nav.goTab('/pages/staff/today/today'); return }
      wx.redirectTo({ url: route + '?id=' + next.id })
    },
    goQueue() { nav.goTab('/pages/staff/today/today') },
    showSuccess() { this.setData({ success: true }) },
    resetSuccess() { this.setData({ success: false }) },

    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) wx.navigateBack()
      else wx.reLaunch({ url: '/pages/staff/today/today' })
    },
    goHome() { wx.reLaunch({ url: '/pages/staff/today/today' }) },
    go(e) {
      const ds = e.currentTarget.dataset
      if (!ds.path) return
      let url = ds.path
      if (ds.id) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'id=' + ds.id
      if (ds.incidentId) url += (url.indexOf('?') >= 0 ? '&' : '?') + 'incidentId=' + ds.incidentId
      wx.navigateTo({ url: url })
    },
    noop() {},
    toastMsg(e) { toast(e.currentTarget.dataset.msg || '演示环境暂不支持该操作') }
  }

  Page(Object.assign(base, opts.methods || {}))
}

module.exports = { createStaffPage: createStaffPage, toast: toast, nowText: nowText }
