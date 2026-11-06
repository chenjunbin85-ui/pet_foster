const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/g3',
  title: '洗护服务核销',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 16:32 · 作业前", "badge": "前", "url": ""}, {"uid": "p1_1", "wm": "11-06 17:18 · 作业后", "badge": "后", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      return { api: 'staffRedeem',
        args: [this.orderId(), { item: '洗护', content: '洗护服务已完成', photoUrls: photoUrls }],
        successTitle: '洗护服务核销成功' }
    }
})
