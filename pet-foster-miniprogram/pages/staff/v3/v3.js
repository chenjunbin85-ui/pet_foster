const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/v3',
  title: '异常复核与处置',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"level": "需处置", "treatment": "", "instruction": ""},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 18:05 · 食盆", "badge": "现场", "url": ""}, {"uid": "p1_1", "wm": "11-06 18:06 · 宠物", "badge": "现场", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffReviewIncident', requireIncident: true,
        args: [this.incidentId(), Object.assign({}, f, {
          signed: !!f.signed, close: false, photoUrls: photoUrls
        })], successTitle: '复核处置已提交' }
    }
})
