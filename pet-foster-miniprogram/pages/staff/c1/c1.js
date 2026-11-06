const { createStaffPage } = require('../../../utils/staff-page.js')

createStaffPage({
  key: 'staff/c1',
  title: '护理工作台 · 班次待办',
  tabs: [{"group": "shift", "initial": "middle"}],
  needSummary: false,
  needDuty: false,
  data: {
    form: {},
    photos: {}
  }
})
