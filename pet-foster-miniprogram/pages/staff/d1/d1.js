const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/d1',
  title: '司机接送工作台',
  tabs: [],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {}
  }
})
