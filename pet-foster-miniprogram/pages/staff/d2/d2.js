const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/d2',
  title: '到场 / 送达交接拍照',
  tabs: [{"group": "driver", "initial": "pickup"}],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"petstate": "状态良好", "f1": "交接时宠物状态平稳，随带宠物粮一袋。"},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 16:03 · 东海大街", "badge": "宠物", "url": ""}]}, "p2": {"items": [{"uid": "p2_0", "wm": "11-06 16:04 · 东海大街", "badge": "场景", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffPickupHandover',
        args: [this.orderId(), {
          type: this.data.tab.driver === 'delivery' ? '送回交接' : '接宠交接',
          located: true, signed: !!f.signed, address: this.data.d.address || '',
          photoUrls: photoUrls
        }], successTitle: '交接已确认' }
    }
})
