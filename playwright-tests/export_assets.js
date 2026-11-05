// 从设计稿 SVG 定义导出小程序所需 PNG 素材
const { chromium } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

const DIR = 'C:/Users/chen/Desktop/毕业设计/pet-foster/pet-foster-miniprogram/images'
fs.mkdirSync(DIR, { recursive: true })

const ICONS = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  paw: '<ellipse cx="6" cy="8" rx="2" ry="3" transform="rotate(-25 6 8)"/><ellipse cx="11" cy="5" rx="2" ry="3"/><ellipse cx="17" cy="6" rx="2" ry="3" transform="rotate(20 17 6)"/><ellipse cx="21" cy="11" rx="1.7" ry="2.5" transform="rotate(30 21 11)"/><path d="M6 17c0-3 4-7 7-6 3 0 6 4 6 7 0 4-4 2-6 2s-7 2-7-3Z"/>',
  orders: '<rect x="5" y="4" width="14" height="18" rx="3"/><path d="M9 4V2h6v2M9 10h6m-6 5h6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
  chat: '<path d="M21 11a9 9 0 0 1-9 9 12 12 0 0 1-4-.7L3 21l1.7-5A9 9 0 1 1 21 11Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6Z"/><path d="m8 12 3 3 5-6"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  plus: '<path d="M12 4v16M4 12h16"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  pin: '<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0 1 14 0Z"/><circle cx="12" cy="9" r="2"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  logout: '<path d="M10 3H4v18h6m-1-9h12m-4-4 4 4-4 4"/>',
  refresh: '<path d="M20 7V2m0 5h-5M4 17v5m0-5h5"/><path d="M20 7a9 9 0 0 0-16 3m0 7a9 9 0 0 0 16-3"/>',
}

const DOG = `<g>
<path d="M122 184c-24-21-30-54-16-68 16-12 35 9 39 29" fill="#D88E4C"/>
<ellipse cx="181" cy="216" rx="75" ry="73" fill="#E9AB68"/>
<path d="M159 175c-24 15-37 59-29 90 17 19 57 25 88 8 4-30-9-79-35-98" fill="#FFF9EF"/>
<path d="M121 126c-17-29-28-67-17-80 14-7 40 25 48 50M204 94c9-29 35-57 46-50 12 13 4 53-12 81" fill="#DC995A"/>
<path d="M119 92c-8-16-13-30-11-33 7 0 20 17 27 32M221 90c7-16 19-29 23-30 1 9-5 26-12 38" fill="#EFBE98"/>
<path d="M111 119c9-34 43-45 70-44 42-1 69 19 72 50 14 46-16 77-67 79-54 0-93-25-75-85Z" fill="#E9AB68"/>
<path d="M178 78c-3 20-13 33-17 50-9 9-28 6-41 16-12 19 8 47 50 50 46 7 73-14 72-33-2-16-27-20-39-33-12-12-13-32-17-50" fill="#FFF9EF"/>
<ellipse cx="145" cy="130" rx="4.5" ry="6" fill="#4B3E33"/>
<ellipse cx="215" cy="129" rx="4.5" ry="6" fill="#4B3E33"/>
<path d="M170 148c-1-8 22-8 22-1 0 5-8 10-11 10s-10-4-11-9Z" fill="#554337"/>
<path d="M181 157v8m0 0c-9 6-16 1-17-3m17 3c7 6 15 2 17-3" fill="none" stroke="#685044" stroke-width="2.3" stroke-linecap="round"/>
<path d="M173 168c2 15 17 15 19-1" fill="#DE9081"/>
<ellipse cx="131" cy="148" rx="10" ry="5" fill="#E79C7E" opacity=".6"/>
<ellipse cx="227" cy="147" rx="10" ry="5" fill="#E79C7E" opacity=".6"/>
<path d="M129 231c-9 8-17 33-12 46 8 8 24 9 32 1l7-41M209 235l4 43c10 10 26 7 30-1 3-17-6-38-15-46" fill="#FFF9EF"/>
<path d="m127 276 1 7m9-7v7m86-7 1 7m8-8v7" stroke="#D9C2A8" stroke-width="1.6"/>
<path d="M145 195c21 10 46 12 68-1" fill="none" stroke="#A7764F" stroke-width="7"/>
<circle cx="181" cy="205" r="9" fill="#EFC471"/>
<path d="m178 205 2 2 4-5" fill="none" stroke="#A9793D" stroke-width="1.5"/>
</g>`

const CAT = `<g>
<path d="M322 252c55 16 61-26 47-33-9-5-14 10-25 9" fill="none" stroke="#A7AFAB" stroke-width="21" stroke-linecap="round"/>
<ellipse cx="298" cy="231" rx="49" ry="54" fill="#CAD0C9"/>
<path d="M280 193c-15 14-18 47-14 76 18 14 41 14 56 0 0-30-5-63-21-76" fill="#FCFCF4"/>
<path d="m250 151-3-58c0-6 4-7 9-3l33 25m16-2 31-25c4-4 9-3 9 3l-3 63" fill="#A8B3AE"/>
<path d="m256 119-1-17 17 17m49-1 16-16-2 21" fill="#D3B6AD"/>
<path d="M245 147c4-23 21-37 49-37 30-1 50 15 54 37 5 35-18 58-53 58-35 0-59-23-50-58Z" fill="#CBD1CB"/>
<path d="M290 115c-2 20-9 29-16 36-14 0-23 8-20 20 6 20 24 28 41 28 22-1 39-12 43-27 2-13-13-20-23-22-6-10-12-20-14-35" fill="#FCFCF4"/>
<path d="m265 148 8 1m45 0 8-2" stroke="#566E65" stroke-width="3.5" stroke-linecap="round"/>
<path d="m288 164 7 5 7-5c-3-5-11-5-14 0Z" fill="#BF9B91"/>
<path d="M295 170v5m0 0c-6 4-10 1-11-1m11 1c5 4 9 1 11-1" stroke="#7A7F72" stroke-width="1.5" fill="none" stroke-linecap="round"/>
<path d="m274 170-27-4m26 11-28 3m69-10 28-5m-28 12 29 2" stroke="#919D90" stroke-width="1.3" stroke-linecap="round"/>
<path d="M265 247v27c2 7 14 8 22 3l2-30m17 0 2 29c7 6 19 5 21-2v-24" fill="#FCFCF4"/>
<path d="M271 201c14 6 34 6 46-1" stroke="#CF9E79" stroke-width="5" fill="none"/>
<circle cx="295" cy="209" r="6" fill="#D5B27A"/>
</g>`

const ROOM = (variant) => `<path d="M5 31V15L21 4l16 11v16H5Z"/><path d="M2 16 21 2l19 14M16 31V20a5 5 0 0 1 10 0v11"/>${variant > 0 ? '<path d="M9 20h3m18 0h3M9 24h3m18 0h3"/><circle cx="21" cy="11" r="2"/>' : ''}${variant === 2 ? '<path d="m15 4-1-3 7 2 7-2-1 3M3 34h36"/>' : ''}`

const strokeSvg = (body, color, vb = '0 0 24 24', sw = 1.65) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await browser.newPage({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 2 })

  const shot = async (name, svg, w, h) => {
    await page.setContent(
      `<body style="margin:0;background:transparent"><div id="t" style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center">${svg.replace(/<svg /, `<svg style="width:${w}px;height:${h}px" `)}</div></body>`
    )
    await page.locator('#t').screenshot({ path: path.join(DIR, `${name}.png`), omitBackground: true })
  }

  // 宠物插画（2x）
  await shot('pet-dog', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="83 38 180 255">${DOG}</svg>`, 96, 96)
  await shot('pet-cat', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="235 80 145 210">${CAT}</svg>`, 96, 96)

  // 房型图标：灰 #69745d / 橙 #ff7f3f（2x: 78x66）
  for (let v = 0; v < 3; v++) {
    await shot(`room-${v}`, strokeSvg(ROOM(v), '#69745d', '0 0 42 36', 1.5), 78, 66)
    await shot(`room-${v}-active`, strokeSvg(ROOM(v), '#ff7f3f', '0 0 42 36', 1.5), 78, 66)
  }

  // Tab：灰 #6b7280 / 橙 #c2410c（81x81 → 用 48px 渲染 2x=96）
  for (const [n, gray, active] of [['home', 'home', 'home'], ['calendar', 'calendar', 'calendar'], ['user', 'user', 'user']]) {
    await shot(`tab-${n}`, strokeSvg(ICONS[gray], '#6b7280'), 48, 48)
    await shot(`tab-${n}-active`, strokeSvg(ICONS[active], '#c2410c'), 48, 48)
  }

  // 菜单图标（灰绿 #69745d）
  for (const k of ['paw', 'orders', 'lock', 'chat', 'heart']) {
    await shot(`menu-${k}`, strokeSvg(ICONS[k], '#69745d'), 44, 44)
  }

  // 保障图标（#c2410c）
  for (const k of ['clock', 'heart', 'shield']) {
    await shot(`ass-${k}`, strokeSvg(ICONS[k], '#c2410c'), 34, 34)
  }

  // 常用小图标（灰）
  for (const k of ['search', 'chevron', 'back', 'plus', 'check', 'close', 'pin', 'logout', 'phone', 'eye', 'refresh', 'paw']) {
    await shot(`icon-${k}-gray`, strokeSvg(ICONS[k], '#6b7280'), 40, 40)
  }
  // 主色版本（需要强调处）
  for (const k of ['plus', 'chevron', 'back', 'check', 'pin']) {
    await shot(`icon-${k}-brand`, strokeSvg(ICONS[k], '#c2410c'), 40, 40)
  }

  await browser.close()
  const files = fs.readdirSync(DIR)
  console.log('exported:', files.length)
  console.log(files.join(', '))
})()
