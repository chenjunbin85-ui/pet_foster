const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/v2',
  title: '入店健康评估签署',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"temperature": "38.4", "skinExam": "被毛完整，无体外寄生虫及皮肤破损", "v2spirit": "正常", "screen": "通过", "note": "精神、食欲、排便均正常，符合入店寄养条件。"},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 09:12 · 疫苗证明", "badge": "证明", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffHealthAssessment',
        args: [this.orderId(), Object.assign({}, f, {
          type: '入店评估', spirit: f.spirit || f.v2spirit,
          screening: f.screen, signed: !!f.signed, photoUrls: photoUrls
        })], successTitle: '入店评估已签署' }
    }
})
