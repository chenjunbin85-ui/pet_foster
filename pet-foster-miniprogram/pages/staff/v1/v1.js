const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/v1',
  title: '兽医工作台 · 在岗确认',
  tabs: [],
  needSummary: false,
  needDuty: true,
  data: {
    form: {},
    photos: {}
  }
})
