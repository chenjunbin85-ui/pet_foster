/**
 * 统一导航入口（方案 B）。原生 tabBar 已移除，全端禁止调用已废弃的 tab 切换 API。
 * 讨论稿 §9.4：tab 之间一律 reLaunch，一级页 → 二级页用 navigateTo，返回用 navigateBack。
 */
const CLIENT_ROOT = '/pages/index/index'
const STAFF_ROOT = '/pages/staff/today/today'

function isStaff() {
  return !!wx.getStorageSync('staffToken')
}

function root() {
  return isStaff() ? STAFF_ROOT : CLIENT_ROOT
}

function goTab(url) {
  wx.reLaunch({ url: url })
}

function goHome() {
  goTab(root())
}

function goDetail(url) {
  wx.navigateTo({ url: url })
}

function goBack(fallback) {
  const pages = getCurrentPages()
  if (pages.length > 1) wx.navigateBack()
  else goTab(fallback || root())
}

/** 一级页 onShow 调用：刷新组件会话态并同步选中项 */
function syncTabBar(page, index) {
  if (!page || typeof page.selectComponent !== 'function') return
  const bar = page.selectComponent('#tabbar')
  if (!bar) return
  if (typeof bar.refresh === 'function') bar.refresh()
  if (typeof bar.setSelected === 'function') bar.setSelected(index)
}

module.exports = {
  CLIENT_ROOT: CLIENT_ROOT,
  STAFF_ROOT: STAFF_ROOT,
  isStaff: isStaff,
  root: root,
  goTab: goTab,
  goHome: goHome,
  goDetail: goDetail,
  goBack: goBack,
  syncTabBar: syncTabBar
}
