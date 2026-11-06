const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/g2',
  title: '洗护作业记录',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {"coat": "正常", "skin": "正常", "f1": "基础清洁、吹干、耳道清理、脚底毛与造型修剪。", "supplies": "低敏香波、护毛素、止血粉"},
    photos: {"p1": {"items": [{"uid": "p1_0", "wm": "11-06 16:32 · 作业前", "badge": "前", "url": ""}]}, "p2": {"items": [{"uid": "p2_0", "wm": "11-06 17:18 · 作业后", "badge": "后", "url": ""}]}}
  }
  ,build: function (photoUrls) {
      const f = this.data.form
      return { api: 'staffGroomLog',
        args: [this.orderId(), Object.assign({}, f, {
          skinAlert: !!(f.skinAlert || f.skin === '红肿' || f.skin === '寄生虫'),
          photoUrls: photoUrls
        })], successTitle: '洗护作业已记录' }
    }
})
