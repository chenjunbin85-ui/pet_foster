const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c2',
  title: '巡视打卡',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"temperature": "38.5", "spirit": "正常", "appetite": "正常", "stool": "正常", "coat": "毛发光顺，未见红肿及脱毛", "abnormal": ""},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 18:02 · B-108", "badge": "现场", "url": ""}, {"uid": "p1_1", "wm": "11-06 18:03 · B-108", "badge": "环境", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffCareLog',
        args: [this.orderId(), Object.assign({}, f, {
          shift: this.data.today.shift || '早',
          defecation: f.defecation || f.stool,
          temperature: f.temperature || f.temperatureInput,
          photoUrls: photoUrls
        })], successTitle: '巡视已提交' }
    }
})
