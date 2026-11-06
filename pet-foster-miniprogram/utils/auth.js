/**
 * 毛球旅馆 · 员工端页面鉴权（单一事实源）
 *
 * 依据：
 *  - docs/PRD.md 3.1 六岗位字典 / 3.3 员工端 5 页权限矩阵 / 3.4 字段级权限 / 3.6 硬性规则
 *  - docs/业务补齐方案.md 11.12「每个岗位做什么、能进哪些页面」
 *  - docs/员工端UI设计提示词.md「重要业务限制」
 *
 * 原则：
 *  1. 岗位存代码不存中文；admin 落点 OWNER；空岗位 fail closed（不给任何员工页）。
 *  2. 菜单隐藏只是礼貌，每页 onLoad 都要 guard 一次，防止直接改路由 / 扫码越权进入。
 *  3. 后端每个写接口再判一次（StaffAuth.require），403 才是真正的墙。
 */

const POSITIONS = ['OWNER', 'FRONT', 'CARE', 'VET', 'GROOM', 'DRIVER']
const ALL = POSITIONS.slice()

const LABEL = {
  OWNER: '店长／管理员',
  FRONT: '前台',
  CARE: '护理员',
  VET: '兽医',
  GROOM: '美容师',
  DRIVER: '外勤接送'
}

// 中文旧值 → 岗位代码（PRD 3.1 旧 position 映射）
const CN_MAP = {
  店长: ['OWNER'], 管理员: ['OWNER'], 店长管理员: ['OWNER'],
  前台: ['FRONT'],
  护理员: ['CARE'],
  兽医: ['VET'], 兽医助理: ['VET', 'CARE'],
  美容师: ['GROOM'],
  外勤: ['DRIVER'], 司机: ['DRIVER'], 接送: ['DRIVER']
}

/** PRD 3.3：员工端 5 个模块 × 6 岗位。●=write，○=read，—=none */
const MODULE_MATRIX = {
  todo:     { OWNER: 'write', FRONT: 'write', CARE: 'write', VET: 'write', GROOM: 'write', DRIVER: 'write' },
  handover: { OWNER: 'write', FRONT: 'write', CARE: 'write', VET: 'write', GROOM: 'none',  DRIVER: 'write' },
  patrol:   { OWNER: 'read',  FRONT: 'none',  CARE: 'write', VET: 'read',  GROOM: 'none',  DRIVER: 'none'  },
  incident: { OWNER: 'write', FRONT: 'read',  CARE: 'write', VET: 'write', GROOM: 'none',  DRIVER: 'none'  },
  redeem:   { OWNER: 'write', FRONT: 'none',  CARE: 'write', VET: 'none',  GROOM: 'write', DRIVER: 'write' }
}

// 原型 17 页中，兽医评估签署与洗护作业是 5 模块内的岗位专属能力组，单独标注
const MODULES = [
  { key: 'todo', label: '今日待办' },
  { key: 'handover', label: '入离店交接' },
  { key: 'patrol', label: '巡视打卡与照护' },
  { key: 'incident', label: '异常上报与复核' },
  { key: 'redeem', label: '服务核销' },
  { key: 'assess', label: '兽医评估签署（仅 VET）' },
  { key: 'groom', label: '洗护作业（仅 GROOM）' }
]

/**
 * 17 页原型 + 员工工作台的页面级规则。
 * positions 是允许进入的岗位白名单；mode 可写 write / 只读 read。
 * 未列入本表的页面一律拒绝（fail closed）。
 */
const PAGE_RULES = {
  'staff/home': { title: '员工工作台', module: 'todo', group: '工作台', positions: ALL, mode: 'write', workbench: false },

  // ---- 护理员 CARE（6 页）----
  'staff/c1': { title: '护理工作台 · 班次待办', module: 'todo', group: 'CARE', positions: ['CARE', 'OWNER'], mode: { CARE: 'write', OWNER: 'read' }, workbench: true },
  'staff/c2': { title: '巡视打卡', module: 'patrol', group: 'CARE', positions: ['CARE', 'VET', 'OWNER'], mode: { CARE: 'write', VET: 'read', OWNER: 'read' } },
  'staff/c3': { title: '日常护理记录', module: 'patrol', group: 'CARE', positions: ['CARE', 'VET', 'OWNER'], mode: { CARE: 'write', VET: 'read', OWNER: 'read' } },
  'staff/c4': { title: '异常上报', module: 'incident', group: 'CARE', positions: ['CARE', 'VET', 'FRONT', 'OWNER'], mode: { CARE: 'write', VET: 'write', FRONT: 'read', OWNER: 'write' } },
  'staff/c5': { title: '入店 / 离店交接签字', module: 'handover', group: 'CARE', positions: ['FRONT', 'CARE', 'VET', 'OWNER'], mode: { FRONT: 'write', CARE: 'write', VET: 'read', OWNER: 'write' } },
  'staff/c6': { title: '遛宠服务核销', module: 'redeem', group: 'CARE', positions: ['CARE', 'OWNER'], mode: 'write' },

  // ---- 兽医 VET（5 页）----
  'staff/v1': { title: '兽医工作台 · 在岗确认', module: 'todo', group: 'VET', positions: ['VET', 'OWNER'], mode: { VET: 'write', OWNER: 'read' }, workbench: true },
  'staff/v2': { title: '入店健康评估签署', module: 'assess', group: 'VET', positions: ['VET', 'OWNER'], mode: { VET: 'write', OWNER: 'read' } },
  'staff/v3': { title: '异常复核与处置', module: 'incident', group: 'VET', positions: ['VET', 'CARE', 'OWNER'], mode: { VET: 'write', CARE: 'read', OWNER: 'write' } },
  'staff/v4': { title: '隔离 / 送医授权', module: 'assess', group: 'VET', positions: ['VET', 'OWNER'], mode: { VET: 'write', OWNER: 'write' } },
  'staff/v5': { title: '离店评估签署', module: 'assess', group: 'VET', positions: ['VET', 'OWNER'], mode: { VET: 'write', OWNER: 'read' } },

  // ---- 美容师 GROOM（3 页）----
  'staff/g1': { title: '洗护任务工作台', module: 'todo', group: 'GROOM', positions: ['GROOM', 'OWNER'], mode: { GROOM: 'write', OWNER: 'read' }, workbench: true },
  'staff/g2': { title: '洗护作业记录', module: 'groom', group: 'GROOM', positions: ['GROOM', 'OWNER'], mode: { GROOM: 'write', OWNER: 'read' } },
  'staff/g3': { title: '洗护服务核销', module: 'redeem', group: 'GROOM', positions: ['GROOM', 'OWNER'], mode: 'write' },

  // ---- 外勤 DRIVER（3 页）----
  'staff/d1': { title: '司机接送工作台', module: 'todo', group: 'DRIVER', positions: ['DRIVER', 'OWNER'], mode: { DRIVER: 'write', OWNER: 'read' }, workbench: true },
  'staff/d2': { title: '到场 / 送达交接拍照', module: 'handover', group: 'DRIVER', positions: ['DRIVER', 'OWNER'], mode: 'write' },
  'staff/d3': { title: '接送服务核销', module: 'redeem', group: 'DRIVER', positions: ['DRIVER', 'OWNER'], mode: 'write' }
}

function normalize(info) {
  if (!info) return []
  if (info.role === 'admin' || info.role === 'ADMIN') return ['OWNER']
  let raw = info.positions || info.position || ''
  if (Array.isArray(raw)) raw = raw.join(',')
  const out = []
  String(raw).split(/[,，;；\s]+/).forEach(function (part) {
    const origin = part.trim()
    if (!origin) return
    const codes = CN_MAP[origin] || [origin.toUpperCase()]
    codes.forEach(function (c) {
      if (POSITIONS.indexOf(c) >= 0 && out.indexOf(c) < 0) out.push(c)
    })
  })
  return out
}

function getSession() {
  const token = wx.getStorageSync('staffToken') || ''
  const info = wx.getStorageSync('staffInfo') || null
  const positions = normalize(info)
  return {
    token: token,
    info: info,
    positions: positions,
    label: positions.map(function (p) { return LABEL[p] || p }).join('、') || '未分配岗位',
    name: (info && (info.name || info.realName)) || '员工'
  }
}

function clearStaffSession() {
  wx.removeStorageSync('staffToken')
  wx.removeStorageSync('staffInfo')
}

function hasPosition(positions, need) {
  const list = Array.isArray(need) ? need : [need]
  for (let i = 0; i < list.length; i++) {
    if (positions.indexOf(list[i]) >= 0) return true
  }
  return false
}

function moduleMode(module, positions) {
  const matrix = MODULE_MATRIX[module]
  if (!matrix) return 'write' // assess / groom 由页面白名单单独控制
  let best = 'none'
  positions.forEach(function (p) {
    const m = matrix[p] || 'none'
    if (m === 'write') best = 'write'
    else if (m === 'read' && best === 'none') best = 'read'
  })
  return best
}

function pageMode(rule, positions) {
  if (!rule) return 'none'
  if (typeof rule.mode === 'string') return rule.mode
  if (rule.mode) {
    let best = 'none'
    positions.forEach(function (p) {
      const m = rule.mode[p] || 'none'
      if (m === 'write') best = 'write'
      else if (m === 'read' && best === 'none') best = 'read'
    })
    if (best !== 'none') return best
  }
  return moduleMode(rule.module, positions)
}

function can(key, positions) {
  const rule = PAGE_RULES[key]
  if (!rule) return false
  return hasPosition(positions, rule.positions)
}

/** 工作台菜单：按岗位过滤后的分组列表（菜单隐藏只是第一层）。 */
function menuFor(positions) {
  const groups = []
  MODULES.forEach(function (mod) {
    const items = []
    Object.keys(PAGE_RULES).forEach(function (key) {
      const rule = PAGE_RULES[key]
      if (rule.module !== mod.key || key === 'staff/home' || rule.workbench) return
      if (!can(key, positions)) return
      items.push({
        key: key,
        path: '/pages/' + key + '/' + key.split('/')[1],
        title: rule.title,
        mode: pageMode(rule, positions),
        readOnly: pageMode(rule, positions) === 'read'
      })
    })
    if (items.length) groups.push({ key: mod.key, label: mod.label, items: items })
  })
  return groups
}

/** 四个岗位专属工作台入口。FRONT / OWNER 没有专属原型页，用统一工作台。 */
function workbenches(positions) {
  const out = []
  Object.keys(PAGE_RULES).forEach(function (key) {
    const rule = PAGE_RULES[key]
    if (!rule.workbench || !can(key, positions)) return
    out.push({
      key: key,
      path: '/pages/' + key + '/' + key.split('/')[1],
      title: rule.title,
      group: rule.group
    })
  })
  return out
}

/**
 * 页面级硬拦截。每个员工页 onLoad 必须调用；返回 null 表示已跳转/拒绝。
 * 未登录 → 登录页；空岗位 → 清会话回登录页；无权 → 提示后回工作台。
 */
function guard(page, key) {
  const session = getSession()
  const fallback = '/pages/staff/home/home'

  if (!session.token) {
    wx.redirectTo({ url: '/pages/login/login' })
    return null
  }
  if (!session.positions.length) {
    wx.showModal({
      title: '未分配岗位',
      content: '当前账号没有分配岗位，按合规要求不能访问员工端页面，请联系店长在 Web 端维护岗位。',
      showCancel: false,
      complete: function () {
        clearStaffSession()
        wx.redirectTo({ url: '/pages/login/login' })
      }
    })
    return null
  }
  const rule = PAGE_RULES[key]
  if (!rule || !can(key, session.positions)) {
    const need = rule ? rule.positions.map(function (p) { return LABEL[p] }).join(' / ') : '对应岗位'
    wx.showModal({
      title: '无权访问该页面',
      content: '当前岗位（' + session.label + '）无权访问「' + (rule ? rule.title : '该页面') + '」，需要「' + need + '」岗位。',
      showCancel: false,
      complete: function () {
        if (key === 'staff/home') {
          clearStaffSession()
          wx.redirectTo({ url: '/pages/login/login' })
        } else {
          wx.redirectTo({ url: fallback })
        }
      }
    })
    return null
  }

  const mode = pageMode(rule, session.positions)
  const vm = {
    me: session.info,
    meName: session.name,
    positionLabel: session.label,
    positions: session.positions,
    readOnly: mode === 'read',
    mode: mode
  }
  if (page && typeof page.setData === 'function') page.setData(vm)
  return Object.assign({}, session, { mode: mode, rule: rule, vm: vm })
}

module.exports = {
  POSITIONS: POSITIONS,
  ALL: ALL,
  LABEL: LABEL,
  MODULES: MODULES,
  MODULE_MATRIX: MODULE_MATRIX,
  PAGE_RULES: PAGE_RULES,
  normalize: normalize,
  getSession: getSession,
  clearStaffSession: clearStaffSession,
  hasPosition: hasPosition,
  moduleMode: moduleMode,
  pageMode: pageMode,
  can: can,
  menuFor: menuFor,
  workbenches: workbenches,
  guard: guard
}
