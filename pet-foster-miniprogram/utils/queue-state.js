/**
 * 本地作业队列状态（讨论稿 §2.2 规则 7「闭环归队」）。
 * 记录当日已提交的作业单，today / queue 页据此过滤卡片并更新进度。
 * 只存 orderId，不存业务数据；换日自动失效，后端按人归属字段落地后可移除。
 */
function key() {
  const d = new Date()
  const p = function (n) { return n < 10 ? '0' + n : '' + n }
  return 'pf_queue_done_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
}

function doneIds() {
  const list = wx.getStorageSync(key())
  return Array.isArray(list) ? list.map(String) : []
}

function markDone(id, pageKey) {
  if (id === undefined || id === null || id === '') return
  const list = doneIds()
  const k = String(id)
  if (list.indexOf(k) < 0) list.push(k)
  wx.setStorageSync(key(), list.slice(-100))
  const log = wx.getStorageSync('pf_queue_log') || []
  log.push({ id: k, page: pageKey || '', at: Date.now() })
  wx.setStorageSync('pf_queue_log', log.slice(-100))
}

function doneCount() {
  return doneIds().length
}

function reset() {
  wx.removeStorageSync(key())
  wx.removeStorageSync('pf_queue_log')
}

module.exports = {
  doneIds: doneIds,
  markDone: markDone,
  doneCount: doneCount,
  reset: reset
}
