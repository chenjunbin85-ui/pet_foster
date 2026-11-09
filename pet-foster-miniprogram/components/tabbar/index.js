/**
 * 两端共用的自绘底部导航（方案 B）。
 *
 * 约定（docs/员工端页面结构重设-讨论稿-2026-11-07.md §9.3）：
 *  - 只在 6 个一级页挂载，二级页永不出现底栏；
 *  - 会话由 staffToken 决定，tab2 文案由 staffInfo.positions 决定；
 *  - tab 之间一律 wx.reLaunch（原生 tabBar 已移除，switchTab 会失败）；
 *  - 组件不拉业务数据，角标由页面通过 badges 传入。
 */
const auth = require('../../utils/auth.js')

const CLIENT_TABS = [
  { pagePath: '/pages/index/index', text: '首页', iconPath: '/images/tab-home.png', selectedIconPath: '/images/tab-home-active.png' },
  { pagePath: '/pages/orders/orders', text: '历史订单', iconPath: '/images/tab-calendar.png', selectedIconPath: '/images/tab-calendar-active.png' },
  { pagePath: '/pages/mine/mine', text: '我的', iconPath: '/images/tab-user.png', selectedIconPath: '/images/tab-user-active.png' }
]

// 9.2：一个岗位一个视角；一人多岗时统一叫「岗位」，由 queue 页内分段
const QUEUE_LABEL = {
  CARE: '巡视', VET: '复核', GROOM: '洗护', DRIVER: '接送', FRONT: '交接', OWNER: '门店'
}

function staffTabs() {
  const positions = auth.normalize(wx.getStorageSync('staffInfo') || {})
  const label = positions.length === 1 ? (QUEUE_LABEL[positions[0]] || '岗位') : '岗位'
  return [
    { pagePath: '/pages/staff/today/today', text: '今日', iconPath: '/images/tab-home.png', selectedIconPath: '/images/tab-home-active.png' },
    { pagePath: '/pages/staff/queue/queue', text: label, iconPath: '/images/tab-calendar.png', selectedIconPath: '/images/tab-calendar-active.png' },
    { pagePath: '/pages/staff/mine/mine', text: '我的', iconPath: '/images/tab-user.png', selectedIconPath: '/images/tab-user-active.png' }
  ]
}

Component({
  properties: {
    mode: { type: String, value: 'client' },        // client | staff
    selected: { type: Number, value: 0 },
    badges: { type: Object, value: {} }             // { today, queue, mine }
  },

  data: {
    staff: false,
    list: []
  },

  observers: {
    'badges': function () { this.refresh() }
  },

  attached() {
    this.refresh()
  },

  methods: {
    refresh() {
      const staff = !!wx.getStorageSync('staffToken')
      const source = staff ? staffTabs() : CLIENT_TABS
      const badges = this.data.badges || {}
      const keys = staff ? ['today', 'queue', 'mine'] : ['', '', '']
      const list = source.map(function (item, i) {
        const n = Number(keys[i] && badges[keys[i]]) || 0
        return Object.assign({}, item, { badge: n > 0 ? n : 0 })
      })
      const patch = { staff: staff, list: list }
      if (this.data.selected >= list.length) patch.selected = 0
      this.setData(patch)
    },

    setSelected(index) {
      if (this.data.selected === index) return
      this.setData({ selected: index })
    },

    onTap(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item) return
      if (index === this.data.selected) return   // 点当前项 no-op
      // 选中态先行，再重建页面栈（9.7 无系统级点击反馈的处置）
      this.setData({ selected: index })
      wx.reLaunch({ url: item.pagePath })
    }
  }
})
