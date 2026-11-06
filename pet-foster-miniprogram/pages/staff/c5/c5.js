const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c5',
  title: '入店 / 离店交接签字',
  tabs: [{"group": "handover", "initial": "in"}],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"chk1": true, "chk2": true, "chk3": false},
    photos: {}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      const out = this.data.tab.handover === 'out' ? '离店' : '入店'
      return { api: 'staffHandover',
        args: [this.orderId(), {
          type: out, signed: !!f.signed, customerSign: !!f.signed,
          belongings: JSON.stringify({ keys: !!f.chk1, food: !!f.chk2, collar: !!f.chk3 }),
          checkItems: JSON.stringify(this.data.form), photoUrls: photoUrls,
          legacyExempt: false
        }], successTitle: '交接已确认' }
    }
})
