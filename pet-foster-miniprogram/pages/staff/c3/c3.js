const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c3',
  title: '日常护理记录',
  tabs: [{"group": "care", "initial": "feed"}],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"food": "皇家室内成猫粮", "amount": "60", "eat": "正常", "remark": "", "startTime": "2026-11-06 16:30", "duration": "30", "walkstool": "正常", "exercise": "", "remark2": "", "part": "", "supplies": "", "cleanstate": "已完成", "remark3": "", "recordTime": "2026-11-06 19:05"},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 19:05 · B-102", "badge": "", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      return { api: 'staffCareRecord',
        args: [this.orderId(), Object.assign({}, this.data.form, {
          type: { feed: '喂食', walk: '遛放', clean: '清洁' }[this.data.tab.care] || '喂食',
          photoUrls: photoUrls
        })], successTitle: '护理记录已保存' }
    }
})
