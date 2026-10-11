# pet-foster 项目长期备忘

宠物寄养登记与健康档案管理系统（课程/毕设型全栈项目）。
- 前端：`pet-foster-ui-src/pet-foster-ui`（React 19 + TS + Vite + Tailwind v4 + shadcn **Base UI 版**）
- 后端：`pet-foster-server-src/pet-foster-server`（Spring Boot 3.2.5 + Java 17/21 + MyBatis-Plus + MySQL + JWT）

## 本地运行
| 组件 | 端口 | 启动方式 |
|---|---|---|
| 前端 dev | 5173 | `vite`（`npm run dev`） |
| 后端 | 8090 | `mvn spring-boot:run`（IDEA 里跑，或命令行） |
| MySQL | 3306 | 库 `pet_foster`，root/root |
| Redis | 6379 | `cd D:\Redis-8.6.0\4 && redis-server.exe redis.conf`（无密码） |

默认账号：`admin/admin123`（管理员）、`staff01/staff123`（工作人员）。

## 必须知道的坑

### 1. Base UI 的 *GroupLabel 必须包在 Group 里
`DropdownMenuLabel` / `SelectLabel` 等若直接放在 Content 下、没有外层 Group，Base UI 抛
`MenuGroupContext is missing` → **React 整棵树卸载 → 白屏**。

### 2. reicon 图标不能当 Base UI 的 render 元素
reicon-react 图标内部用 `dangerouslySetInnerHTML` 渲染 SVG 路径。若写成
`render={<ChevronDown />}`，Base UI 会额外注入 `children`，React 报
`Can only set one of children or props.dangerouslySetInnerHTML` → 整页白屏。
**必须把图标放进 children**（例如 `<SelectPrimitive.Icon><ChevronDown/></SelectPrimitive.Icon>`）。
判断经验：出现"某类页面集体白屏"，先看这些页面是否共用了某个 `ui/*` 组件。

### 2b. Base UI Positioner 专属 props 必须显式透传，跟 ...props 会静默失效
`ui/dropdown-menu.tsx` 的 `DropdownMenuContent` 只解构 `align/alignOffset/side/sideOffset` 给
`MenuPrimitive.Positioner`，其余（含 `anchor`/`collisionPadding`/`collisionAvoidance`）跟着
`...props` 落到 `Popup` 上 → Base UI **当作无效 DOM 属性静默忽略，无任何报错**。
表现为「anchor 写了但定位没变」。已修复为显式透传这三个 props。
另外：`DROPDOWN_COLLISION_AVOIDANCE` 在 `@base-ui/react/internals/constants`（私有路径），别 import。
角色菜单右边界对齐就靠这套：`anchor={profileRef}`（.profile 卡片）+ `align="end"` +
宽度走 Popup 自带 `w-(--anchor-width)`（=锚点宽度）+ `.sidebar-menu{min-width:208px}` 兜底收起态。
**不要给这个菜单加 alignOffset**（会往对齐反方向平移，右边界就偏了）。回归测试在 layout.spec.ts。

### 3. 沙箱里跑 Maven 要清掉 SERVER__PORT
本机环境有 `SERVER__PORT=56869`，Spring Boot 会把它解析成 `server.port` 覆盖 application.yml。
命令行启动后端要加 `env -u SERVER__PORT -u SERVER_PORT`。Maven 本身也要用
`java -cp $MAVEN_HOME/boot/plexus-classworlds-2.8.0.jar ... Launcher` 方式启动（见 skill `maven-gitbash-sandbox`）。

### 4. playwright.config.ts 的 baseURL 是 5174，但 dev server 实际在 5173
跑 e2e 时需要临时覆盖 baseURL（用一份 `_pw.config.ts` 指向 5173）。

### 4b. ⚠️ 本机有全局代理（127.0.0.1:64306），localhost 会被拦成 502 / ERR_PROXY_CONNECTION_FAILED
环境变量 `http_proxy` / `https_proxy` / `HTTP_PROXY` / `HTTPS_PROXY` 均指向 `http://127.0.0.1:64306`（WorkBuddy 注入）。
现象：`curl http://localhost:5173/` 返回 **502**（代理转发的错误），而 `curl --noproxy '*' http://127.0.0.1:5173/` 返回 200；
Playwright 里报 `net::ERR_PROXY_CONNECTION_FAILED`，全部用例挂在 `page.goto("/")`。
**注意：`curl` 报 502 不代表 dev server 挂了**，先用 `netstat -ano | grep :5173 | grep -i LISTEN` 确认是否真有监听。
**跑 e2e 的正确姿势**（两个条件缺一不可）：
1. Chromium 启动参数加 `--no-proxy-server`（写在 `launchOptions.args`；
   `proxy: { server: "direct://" }` **不可靠**，环境变量仍会覆盖）；
2. Node 进程清掉代理环境变量并以 127.0.0.1 作 baseURL：
```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
    NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" \
    npx playwright test --config=_pw.config.ts
```
`_pw.config.ts` 关键内容：`baseURL: "http://127.0.0.1:5173"` + `workers: 1`（并行会触发登录限流）
+ `launchOptions.args: ["--no-proxy-server"]`。
**另一个坑**：dev server 用 `nohup`/`cmd start /B` 启在 Bash 工具里**会随该次调用结束而被回收**，
必须用 `run_in_background: true` 启（`npx vite --port 5173 --strictPort --host 127.0.0.1`），
并在同一轮里跑测试；否则测试跑到一半 dev server 就没了。
**清理测试产物**：`rm -rf test-results playwright-report` 在沙箱里会撞 `[safe-delete] ... ETIMEDOUT`，
加 `dangerouslyDisableSandbox: true` 即可。

### 5. 沙箱里启动 Redis 会因 RDB 快照写不出去而 MISCONF
沙箱不允许 Redis 往 `D:\Redis-8.6.0\4\dump.rdb` 写盘，导致
`MISCONF ... unable to persist to disk`，**所有写命令（INCR）被拒**，登录限流会静默失效。
启动时加参数即可（不改用户的 redis.conf）：
`redis-server.exe redis.conf --stop-writes-on-bgsave-error no`

### 6. recharts 环形图必须放在**正方形**画布内
`<Pie>` 的 `innerRadius/outerRadius` 百分比按 `min(宽,高)/2` 换算（`PolarUtils.getMaxRadius`）。
若容器不是正方（例如 `h-[200px] w-full` 碰到外层 `.donut-wrap{max-width:140px}` → 140×200），
半径只按短边算，**长边方向溢出画布 → 圆环左右被裁成直线边**，看着像个缺口的「C」。
正确写法：`className="aspect-square w-full"`（覆盖 ChartContainer 默认的 `aspect-video`）+ 百分比半径。
- `<PieChart>` 默认 `margin:5`，会再吃掉 10px 可用半径；要对齐设计稿需显式 `margin={{top:0,right:0,bottom:0,left:0}}`。
- 扇区方向：recharts 默认从 **3 点钟起逆时针**；设计稿是从 **12 点钟起顺时针**（顺序与图例一致），
  需加 `startAngle={90} endAngle={-270}`。
- 中心合计（设计稿的「4 / 在档宠物」）recharts 没有内置，用 `.donut-wrap{position:relative}` + 绝对定位
  `.donut-center` 叠层实现（比 SVG `<text>` 清晰）。
- 回归测试见 `pages.spec.ts › 品种分布环形图完整不裁切且带中心合计`（校验画布正方形 + 扇区 bbox 不超出 viewBox）。

### 2b. Base UI Positioner 专属 props 必须显式透传
`DropdownMenuContent` 这类封装里，只解构 `align/alignOffset/side/sideOffset` 传给 `MenuPrimitive.Positioner` ——
`anchor` / `collisionPadding` / `collisionAvoidance` 若跟着 `...props` 落到 `Primitive.Popup`，
Base UI **不报错**、当作无效 DOM 属性静默忽略，表现是「anchor 写了但定位没变」。已修好并加了注释。
另：`DROPDOWN_COLLISION_AVOIDANCE` 位于私有路径 `@base-ui/react/internals/constants`，不要 import。

### 2c. 设计稿里的 SVG viewBox 裁切不能照抄
`Text Formatting Enhancement` 设计稿用 `<svg><image>` + `viewBox` 从拼图裁小图，
但其 viewBox 坐标按 1568×865 写，实际拼图 `quick-entry-reference.png` 是 1946×1074 → 会裁错、带上邻格文字。
正确做法：用 Pillow 量出真实卡片边界、离线裁成独立 PNG，组件里用普通 `<img>`（见 `public/images/quick-entry/`）。

### 2d. 位图插图绝不能同时写死 width 和 height（会变形）
设计稿 `.quick-illustration` 是 `width:100% + height:clamp(56px,6vw,100px)` 双定尺寸 ——
设计稿原型是**矢量图**，非等比拉伸看不出来；换成位图就暴露：1440 视口下容器被压成
93×86（≈1.08:1），而原图 440×258（≈1.70:1）→ 纵向拉伸变形。
✅ 正确写法：只定一维（`width: min(100%, 112px); height: auto;`）+ `aspect-ratio: 440 / 258;`
+ `object-fit: contain` 兜底。**不要再用媒体查询二次覆盖 height**，等于又把比例钉死。
本项目快捷入口插图在 `public/images/quick-entry/*.png`（440×258），
e2e 守护：`pages.spec.ts › 快捷入口插图保持原始宽高比不变形`（逐个比对 renderRatio vs naturalRatio，容差 0.02）。
另：`.home-quick-card` 高度被左栏拉到 566px，`.home-quick-list` 用
`grid-template-rows:none; grid-auto-rows:min-content; align-content:center` 避免格子被 1fr 撑爆。

## 布局：一屏装下（响应式高度）

外壳是 `.workspace{height:100dvh;overflow:hidden}` + `.workspace-main` → `.dashboard-body{flex:1;min-height:0;overflow-y:auto}`，
**容器天然一屏高**；页面只要把根节点挂上对应 body 类，就能走「flex 列 + 子块吃剩余高度」的链：
- 首页 `page==="dashboard"` → `.home-dashboard-body`（`.home-work-grid{flex:1;min-height:344px}`）
- 统计页 `page==="stats"` → `.stats-dashboard-body`（`.analytics-grid{flex:1;min-height:0}`）
两套都在 `App.tsx` 的 `bodyClassName` 三元里切换。
**命门是 `min-height: 0`** —— grid/flex 子项默认 `min-height:auto` 会被内容顶开，不写它 flex:1 完全失效。
图表用 container query `min(100cqw,100cqh,上限)` 定尺寸，窗口越矮图越小。
窄屏（≤1000px）**不锁一屏**，退回自然流 + 滚动（单列堆叠本就该滚）。
e2e 守护：`pages.spec.ts › 宽屏不超屏（响应式高度）`，断 `scrollHeight-clientHeight ≤ 1`；
统计页另断「环形画布 ≥200px 且正方形」防止把图表压成 0 高度来假通过。

### 2e. 给插图加蒙版时，蒙版色必须与卡片底色同源
首页 care-card 插图（`.care-banner`）的蒙版用 `color-mix(in srgb, var(--care-background) 18%, transparent)`
放在 **`::before`**（`::after` 已被底部垂直渐隐占用，两层叠加 = 整体洗淡 + 底部融入背景）。
❌ 不要用黑色/纯白做蒙版 —— 会在插图上压出可见异色块；✅ 用卡片自己的背景色变量。
`z-index:1` 盖住 img、`pointer-events:none` 不挡 hover。验证蒙版是否真的生效：
临时注入 `.care-banner::before{display:none!important}` 做 A/B 截图对比。

### 2f. aspect-ratio 必须对齐磁盘上文件的**实际**尺寸
快捷入口插图文件早已换成 **2508×1672（3:2 = 1.500）** 的高清版，但代码里沿用了注释中
「440×258（1.705）」的旧数字写死 `aspect-ratio` → **图长期被横向压扁**，肉眼不易察觉，
是 e2e 断 `renderRatio ≈ naturalRatio` 抓出来的。
✅ 复核方式：浏览器读 `naturalWidth/naturalHeight`，或本地读 PNG 头（`readUInt32BE(16)`/`(20)`）。
❌ 别信注释里的旧尺寸。
另外两个相关坑：
- **「定宽 + max-height」不能保持比例** —— 砍高度时宽度不跟着缩（实测破坏成 2.07）。
  正确做法是把宽高写进同一个 `min()`，两边用同一比例：
  `width: min(100%, 200px, calc((100cqh - 44px) * 3 / 2)); height: auto; aspect-ratio: 3 / 2;`
  （父级要 `container-type: size`，cqh 才生效）
- **grid 子项 1fr 仍有内容最小高** —— 需配 `min-height: 0`，否则矮屏会被内容撑高、整页溢出。

### 2g. care-card 文字与插图的百分比之和不能 > 100%
`.care-banner` 绝对定位占 `width:58%`，文字 `max-width:62%`，合计 120% —— 宽栏下被
`::after` 渐隐盖住看不出问题，两栏宽度互换后左栏变窄就直接相撞（重叠 76~96px）。
现为 **插图 40% + 文字 68%**。⚠️ 判断是否真重叠**必须看截图**：
插图 PNG 有大量透明留白，几何 bbox 相交 ≠ 视觉冲突（bbox 显示重叠 142px 实则完全分离）。

### 2h. ⚠️ 给「大片透明区」的 PNG 加 transform = 压出一层可见薄膜（图上的"硬边/蒙版边界"）
用户反馈「插图**白蒙版边界露出来了**」，排查半天发现**跟蒙版无关**。
真凶是 `<img>` 上的 `transform: scale(...)`。项目里这两张是
`public/images/todo-illustration.png`(1536×1024) 与 `pet-status-illustration.png`(1280×1280)，
**59.5% 像素全透明，且透明像素的 RGB 不是 0**（实测四角 `(1,1,1,0)`/`(1,0,0,0)`）。
对这样的 img 施加 transform → 浏览器提升为**独立合成层** → 缩放时对透明区重采样
→ 在整个 banner 矩形上压出一层**极淡的彩色薄膜**，它的矩形边界就是肉眼看到的"边"。
**定位方法（逐层 A/B 开关，最有效）**：探针里逐条注入
`.care-banner::before{display:none}` / `::after{display:none}` / `overflow:visible` /
`img{transform:none}`，截图对比 → **只有去掉 img 的 transform 硬边才消失**。
✅ 正确做法：用「布局尺寸 + `object-fit`」代替 transform 放大。
⚠️ 只改 width/height **不重置 transform 是没用的** —— 必须显式写 `transform: none`，
因为项目里另有一条同特异性的 `.todo-care-card .care-banner img { transform: scale(1.35) ... }`
（已删除），CSS 不会因为你没提 transform 就清掉它。
顺带教训：**别用"沿中线扫像素比亮度跳变"做断言** —— 实测该指标被文字笔画主导（>90），
而硬边只有几个 RGB 单位的差异，完全区分不出修复前后。已改用"img 上不得有 transform"断根因。

### 2i. 首页标题区排版已与全站统一（矮屏曾擅自缩小）
首页 `.dashboard-welcome`（门店工作台 / 用心照护，从今天开始。/ 每一份托付…）
曾为了"矮屏不超屏"，在 `@media (max-height:680px)` 把 `h1` 压到 **19px**、`p` 压到 **11px**，
而其它页面在同样高度仍是 **27px / 12px** → 首页标题比全站小一号，一眼可见不一致。
✅ 现规则：**标题字号/行距/字距/内边距一律不动**，矮屏只压缩**外边距**与其它模块
（统计卡 padding、页脚、卡片 padding）。省空间靠这些，不靠缩字。
参考页基准（其它页 `.dashboard-welcome`）：kicker `10px`/`ls 1.2px`、
h1 `27px/600/lh 40.5px/ls .035em/margin 10px 0`、p `12px/lh 21.6px`。
回归测试：`pages.spec.ts › 首页标题区排版与其它页面保持一致`（在 900/800/720/680/650/600 逐一比对计算样式）。

## 技术约定
- **recharts tooltip 的定位机制（环形图必读）**：`recharts@3.8` 的 tooltip wrapper
  `style.top` / `style.left` **恒为 0px**，真实位置**只写在 `transform: translate(x,y)`** 上，
  且 `TooltipBoundingBox.js` 的 `resolveTransitionProperty()` 在
  `isAnimationActive && active`（默认都成立，`animationDuration` 默认 **400ms**）时
  返回 `transition: transform 400ms`，并**写在内联 style 上**。
  后果：首次 hover 时 tooltip 从 `translate(0,0)`（=**图表左上角**）斜着「飞」到扇区；
  换扇区时又**横穿图表**滑过去。用户反馈的「tooltip 不该统一从左上角同一处浮现」就是它。
  ✅ 修法（两处都要）：`<ChartTooltip isAnimationActive={false} />`（断根）+ CSS
  `.donut-wrap .recharts-tooltip-wrapper{transition:none!important}`（兜底，**必须 `!important`**，
  因为 recharts 是内联 style，普通类选择器压不住）。淡入改用 `donut-tooltip-in` 关键帧。
  ⚠️ 只对 `.donut-wrap` 生效 —— 趋势图是矩形图表，横向滑动反而合理，不要一起关。
  回归测试：`pages.spec.ts › 环形图 tooltip 浮现在所悬浮的扇区旁…`
  （rAF 逐帧采样 wrapper 的 rect，断言**去重后只剩 1 个位置**；同时断言 computed transition === "none"）。
- **天气模块**：`src/lib/weather.ts`，**用和风天气**。
  - **API Host**：`pr3yfuur7u.re.qweatherapi.com`（每个开发者账号独立，在控制台「设置」页看）；
    ⚠️ 官方文档里的 `abc.xyz.qweatherapi.com` / `my.wea.qweatherapi.com` / `h2a9cf3mhs.xy.qweatherapi.com` **全是占位示例**，
    都解析不出 DNS，别拿它们当真实值。
  - **鉴权**：请求头 **`X-QW-Api-Key: <key>`**。
    ⚠️ **不能用 `Authorization: Bearer <key>`** —— 会返回 401（Bearer 是给 JWT 凭据的）。
  - 界面用：`GET {host}/weather/v1/current/{lat}/{lon}?lang=zh`（字段 `condition.text` /
    `temperature.value` / `feelsLike.value` / `humidity`(0~1 小数) / `wind.speed.value`(m/s)）。
  - 城市名反查：`GET {host}/geo/v2/city/lookup?location={lon},{lat}&lang=zh`
    → 取 `location[0].adm2`（泉州）优先，没有再用 `.name`（丰泽），避免只显示区县。
  - 定位：GPS 优先（`navigator.geolocation`），失败/拒绝/超时降级 IP；
    IP 路径主用 **ip-api.com**（中文、CORS `*`、**仅 HTTP**）、备用 **ipwho.is**（HTTPS、英文）。
  - Dashboard 天气三态：`is-loading`（转圈+定位中…）/ `ready`（图标+现象+温度+城市）/
    `is-error`（天气获取失败）。**禁止再出现「天气暂未获取」与「—」占位符**，有 e2e 守护。
- **整站界面**：按《Text Formatting Enhancement》设计稿还原（**仅登录页例外**，登录页沿用上一版设计）。  应用外壳是 `.workspace` + 可折叠 `.sidebar`（导航项 `.nav-item`，带 `data-nav` 属性便于测试）+ `.dashboard-body`。
  所有页面样式都是**自定义 class**（`.customer-*` / `.business-*` / `.stat-card` / `.care-card` / `.chart-*` / `.system-*`），
  集中写在 `src/index.css` 的「新版界面（按设计稿还原）」分段里，**不要改写成 Tailwind 工具类**。
  页面标题结构：`.section-kicker`（放导航名）+ 句子式 `h1`（如「每一份信任，都用心记录。」）。
  弹窗用**原生 `<dialog>` + `showModal()`**，不是 Base UI Dialog。
  角色切换/退出登录入口在侧边栏底部头像区的 `.profile` 里的「更多操作」按钮（下拉菜单）。
- **配色**：OKLCH 主题变量全部定义在 `src/index.css`（`:root` 亮色 / `.dark` 暗色），
  主色 `oklch(0.55 0.15 45)` ≈ **#B64E10** 暖橙（色相统一 45°），暗色模式提亮为 `oklch(0.85 0.12 45)` ≈ **#FFB48B**；
  中性面 #FFFFFF / #FAFAFA（暗色 #171717）；border 亮色 #EADAD3、暗色 `oklch(1 0 0 / 10%)`；
  destructive #E7000B（暗色 #FF6467）；图表 `--chart-1..5` = 橙 #D95800 / 黄 #E7B643 / 绿 #2E9E52 / 蓝 #158DD9 / 灰蓝 #4F5661；
  字体 Geist Variable，基础圆角 `--radius: 0.625rem`。
  新版界面另有一套 token：`--radius-xs..2xl`(4/8/12/16/20/24px)、`--radius-pill`、`--button-height/padding/font-size`、`--status-active`。
  ⚠️ 这套 `--radius-*` 与 Tailwind `@theme inline` 的 `calc(var(--radius)*k)` **重名但不冲突**（inline 会把表达式内联进工具类）。
  亮色 `--chart-2` 已按配色文档建议改为 `oklch(0.62 0.14 85)`（#AC7D00，对比度 3.69:1）。
  完整说明见工作区根目录《宠物寄养系统-配色方案.html》。
- 图标库：**reicon-react**（`npm i reicon-react`），命名无 `Icon` 后缀，props：`size`/`weight`/`color`/`className`；
  SVG 自带 width/height 属性，用 Tailwind `size-4` 之类的类名可覆盖。已彻底移除 lucide-react。
- 图标不能被 `render`（见坑 2）。
- 登录失败次数限制：Redis 键 `pet:foster:login:fail:{账号}` / `pet:foster:login:lock:{账号}`，
  5 分钟窗口内 5 次失败锁定 5 分钟；Redis 挂了只告警不阻断登录（`LoginAttemptService`）。
- 角色切换＝用目标账号密码重新登录（`/api/auth/login`），校验通过后**换发新 token**，
  保证前端角色与后端 `@PreAuthorize("hasRole('ADMIN')")` 权限一致。
- 后端统一返回体 `Result{code,message,data}`；业务异常走 `GlobalExceptionHandler` 返回 HTTP 400。
- **登录页**：按设计稿还原的双栏布局（左照片故事板 + 右表单）。样式**不走 Tailwind 工具类**，
  而是以 `.login-shell` / `.story-panel` / `.form-panel` 等自定义 class 集中写在 `src/index.css`
  末尾的「登录页」分隔段里；素材在 `public/images/`（`logo.png`、`pets.jpg`），用相对路径 `./images/...` 引用。
  登录失败在表单内 `.form-message`（`role="alert"`）提示，不再弹 toast（`App.handleLogin` 里没有 try/catch）。
  登录按钮的可访问名是「登录」（不是「登 录」），e2e 用 `/登\s*录/` 匹配。
  **严格一屏**：`.login-shell` 用 `height:100svh; height:100dvh` + `overflow:hidden`，照片 `height:100% + object-fit:cover`（靠裁切而非撑高）。
  ⚠️ 矮屏媒体查询 `(max-height:800px)` 必须同时限定 `min-width:701px`，否则会覆盖手机的 `.form-panel` padding。
  矮屏共三档：`≤800px`（桌面压缩留白）、`≤620px`（大幅压缩表单，避免 `.form-panel` 出现内部滚动条）、
  手机 `≤700px 宽 & ≤720px 高`。**验收要同时量页面滚动和 `.form-panel` 自身溢出**，窗口拉小到 ~500px 高最容易暴露问题。

## 测试
`tests/e2e/*.spec.ts`，共 **54 条**，覆盖认证（含登录页渲染）、客户 CRUD、订单、各页面加载、权限控制、
布局与角色菜单（含密码校验浮层、**菜单右边界与侧边栏对齐回归**）、登录失败锁定、统计页环形图完整性、
**快捷入口插图等比回归**、**宽屏不超屏（7 档高度 × 首页/统计页）**。跑法：见坑 4。
