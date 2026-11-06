const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/v5',
  title: '离店评估签署',
  tabs: [],
  needSummary: true,
  needDuty: false,
  data: {
    form: {"conclusion": "健康可放行", "healthState": "精神良好，食欲与排便正常", "advice": "维持原有喂食节奏，离店后 3 日内观察排便情况。", "prescriptionRef": ""},
    photos: {}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffHealthAssessment',
        args: [this.orderId(), Object.assign({}, f, {
          type: '离店评估', conclusion: f.conclusion || f.f1,
          signed: !!f.signed, photoUrls: photoUrls
        })], successTitle: '离店评估已签署' }
    }
})
