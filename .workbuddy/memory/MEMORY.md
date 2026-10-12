# pet-foster 项目长期备忘

宠物寄养登记与健康档案管理系统（课程/毕设型全栈项目）。
- 前端：`pet-foster-ui-src/pet-foster-ui`（React 19 + TS + Vite + Tailwind v4 + shadcn **Base UI 版**）
- 后端：`pet-foster-server-src/pet-foster-server`（Spring Boot 3.2.5 + Java 17/21 + MyBatis-Plus + MySQL + JWT）

## 本地运行
| 组件 | 端口 | 启动方式 |
|---|---|---|
| 前端 dev | 5173 | `npm run dev` |
| 后端 | 8090 | `mvn spring-boot:run` |
| MySQL | 3306 | 库 `pet_foster`，root/root |
| Redis | 6379 | `cd D:\Redis-8.6.0\4 && redis-server.exe redis.conf` |

默认账号：`admin/admin123`（管理员）、`staff01/staff123`（工作人员）。

## 必须知道的坑

### 1. Base UI 三连坑（白屏 / 定位失效）
- **\*GroupLabel 必须包在 Group 里**：`DropdownMenuLabel`/`SelectLabel` 直接放 Content 下会抛
  `MenuGroupContext is missing` → React 整树卸载 → 白屏。
- **reicon 图标不能当 render 元素**：reicon-react 内部用 `dangerouslySetInnerHTML`，写
  `render={<ChevronDown/>}` 会触发 `Can only set one of children or props.dangerouslySetInnerHTML` → 白屏。
  必须放进 children。**判断经验：某类页面集体白屏 → 先查它们共用的 `ui/*` 组件。**
- **Positioner 专属 props 必须显式透传**：`DropdownMenuContent` 只解构 `align/alignOffset/side/sideOffset`
  给 `MenuPrimitive.Positioner`，`anchor`/`collisionPadding` 等跟 `...props` 落到 Popup 会被**静默忽略**（无报错）。
  角色菜单靠 `anchor={profileRef}` + `align="end"` + `.sidebar-menu{min-width:208px}` 对齐，**不加 alignOffset**。
  `DROPDOWN_COLLISION_AVOIDANCE` 在 `@base-ui/react/internals/constants`（私有路径），别 import。

### 2. 沙箱环境（跑 e2e / Maven / Redis 前必读）
- **全局代理**：`http_proxy` 等均指向 `http://127.0.0.1:64306`，localhost 被拦成 502 /
  `ERR_PROXY_CONNECTION_FAILED`。**curl 报 502 ≠ dev server 挂了**，先 `netstat -ano | grep :5173 | grep -i LISTEN`。
  跑 Playwright 必须：① Chromium 加 `--no-proxy-server`（`proxy:{server:"direct://"}` **不可靠**）；
  ② Node 清代理变量并指向 127.0.0.1：
  ```bash
  env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
      NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" \
      npx playwright test --config=_pw.config.ts
  ```
  `_pw.config.ts`：baseURL `http://127.0.0.1:5173` + `workers:1`（并行触发登录限流）+ 上述 args。
  ⚠️ dev server 必须用 `run_in_background: true` 启（nohup/cmd start 会随该次调用被回收）。
  清理 `test-results`：`rm -rf` 会撞 `[safe-delete] ETIMEDOUT`，加 `dangerouslyDisableSandbox: true`。
- **Maven**：本机有 `SERVER__PORT=56869` 会覆盖 `server.port`，启动加 `env -u SERVER__PORT -u SERVER_PORT`；
  Maven 本身要用 `java -cp $MAVEN_HOME/boot/plexus-classworlds-2.8.0.jar ... Launcher`（见 skill `maven-gitbash-sandbox`）。
- **Redis**：沙箱不让写 RDB → `MISCONF` → 写命令（INCR）全被拒、登录限流静默失效。
  启动加 `--stop-writes-on-bgsave-error no`。

### 3. recharts 环形图必须放在正方形画布内
`<Pie>` 半径按 `min(宽,高)/2` 算，容器非正方 → 长边方向溢出、圆环被裁成直线边（像个缺口的「C」）。
- `className="aspect-square w-full"`（覆盖 ChartContainer 默认 `aspect-video`）+ 百分比半径。
- `<PieChart>` 默认 `margin:5`（吃掉 10px 半径），对齐设计稿要显式 `margin={{top:0,right:0,bottom:0,left:0}}`。
- recharts 默认从 **3 点钟起逆时针**；设计稿是 **12 点钟起顺时针** → `startAngle={90} endAngle={-270}`。
- 中心合计用 `.donut-wrap{position:relative}` + 绝对定位 `.donut-center` 叠层（比 SVG `<text>` 清晰）。
- 回归：`pages.spec.ts › 品种分布环形图完整不裁切且带中心合计`。

### 3b. recharts tooltip 的定位机制（环形图必读）
wrapper `style.top/left` **恒为 0px**，真实位置**只写在 `transform: translate(x,y)`** 上；
`TooltipBoundingBox.js` 在 `isAnimationActive && active`（默认成立，`animationDuration` 默认 400ms）时
把 `transition: transform 400ms` **写在内联 style** 上。后果：首次 hover 从 `translate(0,0)`（图表左上角）
斜飞进扇区，换扇区又横穿图表滑过去 —— 就是「tooltip 不该统一从左上角浮现」。
✅ 修法（两处都要）：`<ChartTooltip isAnimationActive={false} />`（断根）+ CSS
`.donut-wrap .recharts-tooltip-wrapper{transition:none!important}`（兜底，**必须 `!important`** 压内联），
淡入改用 `donut-tooltip-in` 关键帧。**只对 `.donut-wrap` 生效**，趋势图横向滑动是合理的，别一起关。
回归：`pages.spec.ts › 环形图 tooltip 浮现在所悬浮的扇区旁…`（rAF 逐帧采样，断言去重后只剩 1 个位置）。

### 4. 设计稿→代码移植的三个坑
- **SVG viewBox 裁切不能照抄**：设计稿用 `<svg><image>`+viewBox 裁小图，坐标按 1568×865 写，实际拼图
  1946×1074 → 裁错、带上邻格文字。正确做法：Pillow 量真实边界、离线裁独立 PNG，组件里用普通 `<img>`。
- **位图绝不能同时写死 width 和 height**：设计稿 `width:100% + height:clamp(...)` 双定尺寸，矢量图看不出，
  换成位图就变形。✅ 只定一维 + `aspect-ratio` + `object-fit: contain`；**不要用媒体查询二次覆盖 height**。
- **`aspect-ratio` 必须对齐磁盘上文件的实际尺寸**：插图早换成 2508×1672（3:2），代码仍按注释里
  「440×258（1.705）」写死 → 图长期被横向压扁。✅ 用 `naturalWidth/naturalHeight` 或读 PNG 头
  （`struct.unpack('>II', d[16:24])`）复核。**别信注释里的旧数字。**
  「定宽 + max-height」同样保不住比例（实测破坏成 2.07）；正解是把宽高写进同一个 `min()` 共用比例：
  `width: min(100%, 200px, calc((100cqh - 44px) * 3 / 2)); height:auto; aspect-ratio: 3/2;`（父级要 `container-type: size`）。

### 5. ⚠️ 给「大片透明区」的 PNG 加 transform = 压出可见薄膜（用户说的"白蒙版边界"）
用户反馈「插图白蒙版边界露出来了」，排查发现**跟蒙版无关**。真凶是 `<img>` 上的 `transform: scale(...)`：
`todo-illustration.png`(1536×1024) / `pet-status-illustration.png`(1280×1280) **59.5% 像素全透明，
且透明像素 RGB 不是 0**（四角实测 `(1,1,1,0)`）→ 施加 transform 提升为**独立合成层** → 缩放重采样
→ 在整个 banner 矩形上压出一层极淡彩色薄膜，矩形边界就是肉眼看到的"边"。
**定位方法（最有效）**：逐条注入 `.care-banner::before{display:none}` / `::after{display:none}` /
`overflow:visible` / `img{transform:none}`，A/B 截图 → **只有去掉 img 的 transform 硬边才消失**。
✅ 正解：用「布局尺寸 + `object-fit`」代替 transform 放大。⚠️ **只改 width/height 不重置 transform 没用**，
必须显式 `transform: none`（项目里曾有同特异性的 `.todo-care-card .care-banner img{transform:scale(1.35)}`，
CSS 不会因为你没提就清掉它 —— 该规则已删除）。
❌ 别用"沿中线扫像素比亮度跳变"做断言：该指标被文字笔画主导（>90），硬边只有几个 RGB 单位差异，区分不出。
已改用「img 上不得有 transform」断根因。

### 6. care-card 蒙版与百分比
- 蒙版色**必须与卡片底色同源**：`color-mix(in srgb, var(--care-background) 18%, transparent)`，放在
  **`::before`**（`::after` 已被底部垂直渐隐占用）。❌ 用黑/白会压出异色块。`z-index:1` 盖 img、`pointer-events:none`。
- **插图% + 文字% ≤ 100%**：原设计 58%+62%=120%，两栏宽度互换后左栏变窄就相撞。现为 **插图 40% + 文字 68%**。
  ⚠️ 判断是否真重叠**必须看截图**：PNG 有大量透明留白，bbox 相交 ≠ 视觉冲突（bbox 重叠 142px 实则分离）。

### 7. 首页标题区排版已与全站统一（矮屏曾擅自缩小）
首页 `.dashboard-welcome` 曾在 `@media (max-height:680px)` 把 h1 压到 19px、p 压到 11px，而其它页仍是
27px/12px → 一眼可见不一致。✅ 现规则：**标题字号/行距/字距/内边距一律不动**，矮屏只压缩**外边距**与其它模块。
基准：kicker `10px`/`ls 1.2px`、h1 `27px/600/lh 40.5px/ls .035em/margin 10px 0`、p `12px/lh 21.6px`。
回归：`pages.spec.ts › 首页标题区排版与其它页面保持一致`（900/800/720/680/650/600 逐一比对计算样式）。

## 布局：一屏装下（响应式高度）
`.workspace{height:100dvh;overflow:hidden}` → `.workspace-main` → `.dashboard-body{flex:1;min-height:0;overflow-y:auto}`，
容器天然一屏高；页面根节点挂对应 body 类即可走「flex 列 + 子块吃剩余高度」：
- 首页 `page==="dashboard"` → `.home-dashboard-body`（`.home-work-grid{flex:1;min-height:344px}`）
- 统计页 `page==="stats"` → `.stats-dashboard-body`（`.analytics-grid{flex:1;min-height:0}`）
两套在 `App.tsx` 的 `bodyClassName` 三元里切换。
**命门是 `min-height: 0`** —— grid/flex 子项默认 `min-height:auto` 会被内容顶开，不写它 flex:1 完全失效。
图表用 container query `min(100cqw,100cqh,上限)` 定尺寸；窄屏（≤1000px）**不锁一屏**，退回自然流 + 滚动。
e2e：`pages.spec.ts › 宽屏不超屏（响应式高度）`断 `scrollHeight-clientHeight ≤ 1`；
统计页另断「环形画布 ≥200px 且正方形」，防止把图表压成 0 高度假通过。

## 界面与技术约定
- **整站界面**按《Text Formatting Enhancement》设计稿还原（**仅登录页例外**）。外壳 `.workspace` + 可折叠
  `.sidebar`（`.nav-item` 带 `data-nav`）+ `.dashboard-body`。所有页面样式是**自定义 class**
  （`.customer-*`/`.business-*`/`.stat-card`/`.care-card`/`.chart-*`/`.system-*`），集中在
  `src/index.css`「新版界面」分段，**不要改写成 Tailwind 工具类**。标题结构 `.section-kicker` + 句子式 `h1`。
  弹窗用**原生 `<dialog>` + `showModal()`**。角色切换/退出在侧边栏底部 `.profile` 的「更多操作」下拉菜单。
- **配色**：OKLCH 变量在 `src/index.css`（`:root` / `.dark`）。主色 `oklch(0.55 0.15 45)` ≈ **#B64E10**
  暖橙（色相统一 45°），暗色 `oklch(0.85 0.12 45)`；中性面 #FFFFFF/#FAFAFA（暗 #171717）；
  border 亮 #EADAD3 / 暗 `oklch(1 0 0 / 10%)`；destructive #E7000B（暗 #FF6467）；
  图表 `--chart-1..5` = 橙#D95800 / 黄#E7B643 / 绿#2E9E52 / 蓝#158DD9 / 灰蓝#4F5661。
  字体 Geist Variable，`--radius: 0.625rem`。新版另有 `--radius-xs..2xl`(4/8/12/16/20/24px)、`--radius-pill`、
  `--button-*`、`--status-active`。⚠️ 这套 `--radius-*` 与 Tailwind `@theme inline` 的 `calc(var(--radius)*k)`
  **重名但不冲突**。亮色 `--chart-2` 已改为 `oklch(0.62 0.14 85)`（#AC7D00，对比度 3.69:1）。
  完整说明见根目录《宠物寄养系统-配色方案.html》。
- 图标库 **reicon-react**（命名无 `Icon` 后缀），已彻底移除 lucide-react；图标不能被 `render`（见坑 1）。
- 登录失败限制：Redis 键 `pet:foster:login:fail:{账号}` / `:lock:{账号}`，5 分钟窗口内 5 次失败锁 5 分钟；
  Redis 挂了只告警不阻断（`LoginAttemptService`）。
- 角色切换＝用目标账号密码重新登录（`/api/auth/login`），成功后**换发新 token**，保证与后端
  `@PreAuthorize("hasRole('ADMIN')")` 一致。当前角色菜单项用 Base UI 的 `disabled` 真禁用（不是只加灰色 class）。
- 后端统一返回体 `Result{code,message,data}`；业务异常走 `GlobalExceptionHandler` 返 HTTP 400。
- **登录页**：双栏（左照片故事板 + 右表单），自定义 class `.login-shell`/`.story-panel`/`.form-panel`
  写在 `src/index.css` 末尾「登录页」分段。素材 `public/images/`（`logo.png`/`pets.jpg`），相对路径 `./images/...`。
  登录失败在 `.form-message`（`role="alert"`）提示，不弹 toast。按钮可访问名是「登录」，e2e 用 `/登\s*录/`。
  **严格一屏**：`height:100dvh;overflow:hidden` + 照片 `height:100% + object-fit:cover`。
  ⚠️ 矮屏 `(max-height:800px)` 必须同时限定 `min-width:701px`，否则覆盖手机 `.form-panel` padding。
  矮屏三档：`≤800px` / `≤620px` / 手机 `≤700px 宽 & ≤720px 高`。**验收要同时量页面滚动和 `.form-panel` 自身溢出**。
- **天气模块**：`src/lib/weather.ts`，用和风天气。API Host 每个账号独立（控制台「设置」页看），
  ⚠️ 文档里的 `abc.xyz.qweatherapi.com` 等**全是占位示例**。鉴权用请求头 **`X-QW-Api-Key`**，
  ⚠️ **不能**用 `Authorization: Bearer`（返 401）。界面：`GET {host}/weather/v1/current/{lat}/{lon}?lang=zh`；
  城市反查 `GET {host}/geo/v2/city/lookup?location={lon},{lat}&lang=zh` 取 `adm2`（泉州）优先。
  定位 GPS 优先，失败降级 IP（主 ip-api.com / 备 ipwho.is）。三态 `is-loading`/`ready`/`is-error`，
  **禁止再出现「天气暂未获取」与「—」占位符**，有 e2e 守护。

## 测试
`tests/e2e/*.spec.ts`，覆盖认证、客户 CRUD、订单、各页面加载、权限控制、布局与角色菜单、登录失败锁定、
统计页环形图完整性、快捷入口插图等比回归、宽屏不超屏（7 档高度 × 首页/统计页）、
首页标题区排版一致性、环形图 tooltip 浮现位置、插图无 transform 硬边。跑法见坑 2。

## 本地 Office 文档处理（editor_sdk）
课程/毕设文档在 `~/Desktop/pet-foster` 根目录。走 skill `tencent-docs-routing` → `tencent-local-office-edit`，
脚本 `D:\WorkBuddy\...\skills\tencent-local-office-edit\edsdk.py`（用 managed python 跑）。
- **`.doc`（OLE 97-2003）能打开并读**（`doc_find` / `doc_get_outline` / `doc_list_sections` /
  `doc_get_paragraph_property` 都正常）；但 `save_file` 写回原路径会被内核拒（只写 OOXML），需 `allow_format_change=true`。
- ⚠️ **`doc_find` 返回键是 `locations`（不是 `matches`），总数在 `total`** —— 用错键会误判成「0 命中」。
- ⚠️ `open_file` 默认**非阻塞**，只回 "open started"；要等可读传 `wait=true`，或先 `get_pool_status` 确认。
- 根目录的 `论文全文.txt` 是导出文本，**用 `\r` 换行**（2200 CR / 1 LF），直接 Read 会显示成"一整行"，
  先归一化 `\r\n|\r` → `\n` 再读。
- 毕设相关文件：`232022226陈俊斌_..._论文.doc`（公寓模板，封面已换成宠物题目）、
  `宠物寄养登记与健康档案管理系统_论文初稿.docx`（本人正文稿）、`论文源文件_转换.docx` / `论文全文.txt`（转换件）。
