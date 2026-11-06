const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c6',
  title: '遛宠服务核销',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 16:30 · 户外遛放", "badge": "凭证", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      return { api: 'staffRedeem',
        args: [this.orderId(), { item: '遛宠', content: '遛宠服务已完成', photoUrls: photoUrls }],
        successTitle: '遛宠服务核销成功' }
    }
})
