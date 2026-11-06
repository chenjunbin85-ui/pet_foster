const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/g1',
  title: '洗护任务工作台',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {}
  }
})
