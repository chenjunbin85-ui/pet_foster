const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c4',
  title: '异常上报',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"abtype": "食欲", "f1": "18:00 巡视发现今日晚餐剩余约三分之二，饮水量较昨日减少，精神状态尚可。"},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 18:05 · B-108", "badge": "食盆", "url": ""}, {"uid": "p1_1", "wm": "11-06 18:06 · B-108", "badge": "宠物", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffIncident',
        args: [this.orderId(), {
          category: f.abtype || '其他', description: f.abnormal || f.description || f.f1 || '',
          needVet: false, cost: 0, photoUrls: photoUrls
        }], successTitle: '异常已上报，待兽医定级' }
    }
})
