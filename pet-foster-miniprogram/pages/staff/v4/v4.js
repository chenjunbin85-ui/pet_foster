const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/v4',
  title: '隔离 / 送医授权',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"notified": true, "channel": "电话", "notifyTime": "2026-11-06 18:36", "authtype": "隔离", "hospital": "", "reason": "复核定级为需处置，需短期隔离观察食欲与饮水情况。"},
    photos: {}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffAuthorizeIncident', requireIncident: true,
        args: [this.incidentId(), Object.assign({}, f, {
          notified: !!f.notified, notifyChannel: f.channel || '电话',
          type: f.authtype || '隔离', signed: !!f.signed
        })], successTitle: '授权已提交' }
    }
})
