const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/d3',
  title: '接送服务核销',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 16:03 · 宠物现场", "badge": "宠物", "url": ""}, {"uid": "p1_1", "wm": "11-06 16:04 · 交接场景", "badge": "场景", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      return { api: 'staffRedeem',
        args: [this.orderId(), { item: '接送', content: '接送服务已完成', photoUrls: photoUrls }],
        successTitle: '接送服务核销成功' }
    }
})
