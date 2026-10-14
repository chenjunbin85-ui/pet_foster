# pet-foster 项目长期备忘

宠物寄养登记与健康档案管理系统（毕设全栈项目）。
- 前端：`pet-foster-ui-src/pet-foster-ui`（React 19 + TS + Vite + Tailwind v4 + shadcn **Base UI 版**）
- 后端：`pet-foster-server-src/pet-foster-server`（Spring Boot 3.2.5 + Java 17/21 + MyBatis-Plus + MySQL + JWT）

## 目录结构（2026-10-13 重整）
- `护宠宝-项目源文件/`：01-需求文档 / 02-论文 / 03-系统设计图 / 04-前端源码 / 05-后端源码 / 06-设计素材 / 07-参考资料
- `论文配图/` 与 `_diagram_work/output/`：**同一套 20 张图**，每张 `PNG + SVG + VSDX`（PNG/SVG 均从 Visio 导出，不用生成式图片里的文字）。原图备份在 `论文配图/原图备份_20261013/`
- `_thesis_work/`：论文流水线中间件（`working.docx`→`prepared.docx`→成稿；`edit.py`/`embed2.py`）；`_diagram_work/`：画图脚本 `redraw.py` + `diagram-model.json`
- 学校版式母版：`信息管理与信息系统专业设计类论文模板.doc`（内页是公寓示例；**图全部是 `Visio.Drawing.15` OLE 内嵌**；A4、页眉页脚、页码、TOC 域齐全）

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

### 3. recharts 环形图
- **必须在正方形画布内**：`<Pie>` 半径按 `min(宽,高)/2` 算，容器非正方 → 长边溢出、圆环被裁成直线边。
  `className="aspect-square w-full"`（覆盖 ChartContainer 默认 `aspect-video`）+ 百分比半径。
- `<PieChart>` 默认 `margin:5`，对齐设计稿要显式 `margin={{top:0,right:0,bottom:0,left:0}}`。
- 默认从 **3 点钟起逆时针**；设计稿是 **12 点钟起顺时针** → `startAngle={90} endAngle={-270}`。
- 中心合计用 `.donut-wrap{position:relative}` + 绝对定位 `.donut-center` 叠层（比 SVG `<text>` 清晰）。
- **tooltip 定位机制**：wrapper `style.top/left` 恒为 `0px`，真实位置只写在 **inline `transform: translate()`**；
  `TooltipBoundingBox.js` 在 `isAnimationActive && active`（默认成立）时把 `transition: transform 400ms` 写进内联 style
  → 首次 hover 从图表左上角斜飞进扇区。✅ 修法两处都要：`<ChartTooltip isAnimationActive={false} />`（断根）
  + `.donut-wrap .recharts-tooltip-wrapper{transition:none!important}`（**必须 `!important`** 压内联），淡入改用
  `donut-tooltip-in` 关键帧。**只对 `.donut-wrap` 生效**，趋势图横向滑动是合理的，别一起关。
- 回归：`pages.spec.ts › 品种分布环形图完整不裁切且带中心合计`、`› 环形图 tooltip 浮现在所悬浮的扇区旁…`（rAF 逐帧采样，断言去重后只剩 1 个位置）。

### 4. 设计稿→代码移植
- **SVG viewBox 裁切不能照抄**：设计稿用 `<svg><image>`+viewBox 裁小图，坐标按 1568×865 写而实际拼图
  1946×1074 → 裁错。正解：Pillow 量真实边界、离线裁独立 PNG，组件里用普通 `<img>`。
- **位图绝不能同时写死 width 和 height**：只定一维 + `aspect-ratio` + `object-fit: contain`；**不要用媒体查询二次覆盖 height**。
- **`aspect-ratio` 必须对齐磁盘上文件的实际尺寸**（插图已换成 2508×1672，注释里却写着 440×258）。
  用 `naturalWidth/naturalHeight` 或 PNG 头 `struct.unpack('>II', d[16:24])` 复核。**别信注释里的旧数字。**
  「定宽 + max-height」同样保不住比例；正解是把宽高写进同一个 `min()`：
  `width: min(100%, 200px, calc((100cqh - 44px) * 3 / 2)); height:auto; aspect-ratio: 3/2;`（父级 `container-type: size`）。

### 5. ⚠️ 给「大片透明区」的 PNG 加 transform = 压出可见薄膜（用户说的"白蒙版边界"）
真凶不是蒙版，是 `<img>` 上的 `transform: scale(...)`：`todo-illustration.png`/`pet-status-illustration.png`
**59.5% 像素全透明且透明像素 RGB 非 0**（四角实测 `(1,1,1,0)`）→ 提升为独立合成层 → 缩放重采样 → 在 banner 矩形上压出极淡彩色薄膜。
**定位法（最有效）**：逐条注入 `.care-banner::before{display:none}` / `::after` / `overflow:visible` / `img{transform:none}`，
A/B 截图 —— 只有去掉 img 的 transform 硬边才消失。
✅ 正解：用「布局尺寸 + `object-fit`」代替 transform。⚠️ **只改 width/height 不重置 transform 没用**，必须显式 `transform: none`
（曾有一条同特异性的 `.todo-care-card .care-banner img{transform:scale(1.35)}`，已删除）。
❌ 别用"沿中线扫像素比亮度跳变"做断言：该指标被文字笔画主导（>90），硬边只有几个 RGB 单位差异。

### 6. care-card 蒙版与百分比
- 蒙版色**必须与卡片底色同源**：`color-mix(in srgb, var(--care-background) 18%, transparent)`，放在 **`::before`**
  （`::after` 已被底部垂直渐隐占用）；❌ 用黑/白会压出异色块。`z-index:1` 盖 img、`pointer-events:none`。
- **插图% + 文字% ≤ 100%**：原设计 58%+62%=120% → 相撞。现为 **插图 40% + 文字 68%**。
  ⚠️ 是否真重叠**必须看截图**：PNG 有大量透明留白，bbox 相交 ≠ 视觉冲突。

### 7. 首页标题区排版已与全站统一（矮屏曾擅自缩小）
首页 `.dashboard-welcome` 曾在 `@media (max-height:680px)` 把 h1 压到 19px、p 压到 11px，其它页仍 27px/12px。
✅ 现规则：**标题字号/行距/字距/内边距一律不动**，矮屏只压缩**外边距**与其它模块。基准：kicker `10px`/`ls 1.2px`、
h1 `27px/600/lh 40.5px/ls .035em/margin 10px 0`、p `12px/lh 21.6px`。
回归：`pages.spec.ts › 首页标题区排版与其它页面保持一致`（900/800/720/680/650/600 逐一比对计算样式）。

## 布局：一屏装下（响应式高度）
`.workspace{height:100dvh;overflow:hidden}` → `.workspace-main` → `.dashboard-body{flex:1;min-height:0;overflow-y:auto}`。
页面根节点挂对应 body 类即可走「flex 列 + 子块吃剩余高度」：首页 `page==="dashboard"` → `.home-dashboard-body`
（`.home-work-grid{flex:1;min-height:344px}`）；统计页 `page==="stats"` → `.stats-dashboard-body`（`.analytics-grid{flex:1;min-height:0}`）。
两套在 `App.tsx` 的 `bodyClassName` 三元里切换。**命门是 `min-height: 0`** —— grid/flex 子项默认 `min-height:auto` 会被内容顶开。
图表用 container query `min(100cqw,100cqh,上限)` 定尺寸；窄屏（≤1000px）**不锁一屏**，退回自然流 + 滚动。
e2e：`pages.spec.ts › 宽屏不超屏（响应式高度）` 断 `scrollHeight-clientHeight ≤ 1`；统计页另断「环形画布 ≥200px 且正方形」。

## 界面与技术约定
- **整站界面**按《Text Formatting Enhancement》设计稿还原（**仅登录页例外**）。外壳 `.workspace` + 可折叠 `.sidebar`
  （`.nav-item` 带 `data-nav`）+ `.dashboard-body`。所有页面样式是**自定义 class**（`.customer-*`/`.business-*`/`.stat-card`/
  `.care-card`/`.chart-*`/`.system-*`），集中在 `src/index.css`「新版界面」分段，**不要改写成 Tailwind 工具类**。
  标题结构 `.section-kicker` + 句子式 `h1`。弹窗用**原生 `<dialog>` + `showModal()`**。角色切换/退出在侧边栏底部 `.profile` 下拉菜单。
- **配色**：OKLCH 变量在 `src/index.css`（`:root` / `.dark`）。主色 `oklch(0.55 0.15 45)` ≈ **#B64E10** 暖橙（色相统一 45°），
  暗色 `oklch(0.85 0.12 45)`；中性面 #FFFFFF/#FAFAFA（暗 #171717）；border 亮 #EADAD3 / 暗 `oklch(1 0 0 / 10%)`；
  destructive #E7000B（暗 #FF6467）；图表 `--chart-1..5` = 橙#D95800 / 黄#E7B643 / 绿#2E9E52 / 蓝#158DD9 / 灰蓝#4F5661。
  字体 Geist Variable，`--radius: 0.625rem`。新版另有 `--radius-xs..2xl`(4/8/12/16/20/24px)、`--radius-pill`、`--button-*`、`--status-active`。
  ⚠️ 这套 `--radius-*` 与 Tailwind `@theme inline` 的 `calc(var(--radius)*k)` **重名但不冲突**。
  亮色 `--chart-2` 已改为 `oklch(0.62 0.14 85)`（#AC7D00，对比度 3.69:1）。完整说明见根目录《宠物寄养系统-配色方案.html》。
- 图标库 **reicon-react**（命名无 `Icon` 后缀），已彻底移除 lucide-react；图标不能被 `render`（见坑 1）。
- 登录失败限制：Redis 键 `pet:foster:login:fail:{账号}` / `:lock:{账号}`，5 分钟窗口内 5 次失败锁 5 分钟；
  Redis 挂了只告警不阻断（`LoginAttemptService`）。
- 角色切换＝用目标账号密码重新登录（`/api/auth/login`），成功后**换发新 token**，保证与后端 `@PreAuthorize("hasRole('ADMIN')")` 一致。
  当前角色菜单项用 Base UI 的 `disabled` 真禁用（不是只加灰色 class）。
- 后端统一返回体 `Result{code,message,data}`；业务异常走 `GlobalExceptionHandler` 返 HTTP 400。
- **登录页**：双栏（左照片故事板 + 右表单），自定义 class `.login-shell`/`.story-panel`/`.form-panel` 写在 `src/index.css` 末尾。
  素材 `public/images/`（`logo.png`/`pets.jpg`），相对路径 `./images/...`。失败在 `.form-message`（`role="alert"`）提示。
  按钮可访问名是「登录」，e2e 用 `/登\s*录/`。**严格一屏**：`height:100dvh;overflow:hidden` + 照片 `height:100% + object-fit:cover`。
  ⚠️ 矮屏 `(max-height:800px)` 必须同时限定 `min-width:701px`，否则覆盖手机 `.form-panel` padding。
  矮屏三档：`≤800px` / `≤620px` / 手机 `≤700px 宽 & ≤720px 高`。**验收要同时量页面滚动和 `.form-panel` 自身溢出**。
- **天气模块**：`src/lib/weather.ts`，和风天气。API Host 每账号独立（控制台「设置」页看），⚠️ 文档里的 `abc.xyz.qweatherapi.com` **全是占位示例**。
  鉴权用请求头 **`X-QW-Api-Key`**，⚠️ **不能**用 `Authorization: Bearer`（返 401）。`GET {host}/weather/v1/current/{lat}/{lon}?lang=zh`；
  城市反查 `GET {host}/geo/v2/city/lookup?location={lon},{lat}&lang=zh` 取 `adm2`（泉州）优先。定位 GPS 优先，失败降级 IP（主 ip-api.com / 备 ipwho.is）。
  三态 `is-loading`/`ready`/`is-error`，**禁止再出现「天气暂未获取」与「—」占位符**，有 e2e 守护。

## 测试
`tests/e2e/*.spec.ts`（12 个文件 / 87 个 test / 0 skip）：认证、客户 CRUD、订单、各页面加载、权限控制、布局与角色菜单、
登录失败锁定、统计页环形图完整性、快捷入口插图等比回归、宽屏不超屏（7 档高度 × 首页/统计页）、首页标题区排版一致性、
环形图 tooltip 浮现位置、插图无 transform 硬边。跑法见坑 2。

## 论文流水线与本地 Office 文档处理
毕业设计文档在 `护宠宝-项目源文件/02-论文/`。
- **文书链路**：`workbuddy-office-routing` → `workbuddy-local-office-edit`，脚本 `D:\WorkBuddy\...\skills\workbuddy-local-office-edit\edsdk.py`（managed python 跑）。
- **`.doc`（OLE 97-2003）能打开并读**（`doc_find`/`doc_get_outline`/`doc_list_sections`/`doc_get_paragraph_property` 正常）；
  但 `save_file` 写回原路径会被内核拒（只写 OOXML），需 `allow_format_change=true`。
- ⚠️ **`doc_find` 返回键是 `locations`（不是 `matches`），总数在 `total`** —— 用错键会误判成「0 命中」。
- ⚠️ `open_file` 默认**非阻塞**，只回 "open started"；要等可读传 `wait=true`。
- ⚠️ `doc_get_images` **只扫 OOXML 的 `w:drawing`，扫不到 VML `w:pict` 和 OLE 对象**；`.doc` 一律返回空数组 —— 别据此判断"没有图"。
- ⚠️ `doc_resolve_document_structure` 只给 compact 结构（不含普通段落），**不能**用它按 idx 反查任意段落区间；用整段 `doc_find` 更可靠。
- **改 docx 表格**：`doc_set_table_cells` 只传 `text`+`inherit:false`，**字号/居中全保留**；改行数先 `doc_delete_table_row` 底部往上删；
  增行用 `doc_insert_table_rows`（⚠️ 实测会多出 1 行，写完后要再删末尾空行）。整段替换用**整段原文**做 key（片段会命中共用句）。
- ⚠️ 论文正文用 **ASCII 直引号 `"`**，不是中文引号。
- **排版基准**（对齐学校模板）：A4 595.3×841.9pt；正文宋体 12pt / `alignment=both` / `first_line_indent=2字符` / `line_spacing=1.5`；
  章标题黑体 16pt、二级 14pt、三级 12pt；图注居中小五。
- **已成稿**：`232022226陈俊斌_论文_补充配图版.docx`（+ 同名 `.doc` / `.pdf`）= `prepared.docx` + 20 张 vsdx 以 **Visio OLE** 内嵌。
  文字侧：表3-1~3-8 按 `sql/schema.sql`+`entity/*.java` 重写；模块数统一「八大」；E2E 用例数 87；黑盒用例 37 条；段落 39 处 + 表格 11 张。
  巡检/对照报告：根目录 `论文初稿_内容巡检报告.html`、`论文初稿_内容修正清单.html`。
- ⚠️ **仍有版式欠账**：无 A4 问题的 docx 已带页眉页脚页码；但 `论文初稿.docx` 仍是 Letter 且无页码，别拿它当母版。

### ⚠️ Visio OLE 嵌入的三个坑（2026-10-13 踩过）
用 `win32com` 驱动 WPS（ProgID **`kwps.Application`**，`GetActiveObject`；系统 Python 3.14 有 pywin32，managed 3.13 **没有**）：
1. **`Range.Collapse` 的常量是反直觉的**：`wdCollapseEnd=0`、`wdCollapseStart=1`。想定位到 token 起点要传 **1**。
2. **不要先 `r.Text=''` 再 `Collapse(1)`** —— 在 WPS 里这样会让 range 落回**文档开头**，
   结果是 20 个对象**全被插到正文最前面**（body 第 0 个元素），图注前一个图都没有。正确顺序：
   `Find.Execute(token)` → `Collapse(1)` → `AddOLEObject(Range=r)` → 再 `Find`+`Text=''` 删残留 token。
3. 尺寸按版心算：`w = min(453.55, 685.95/ratio)`（`ratio = h/w`，`LockAspectRatio=True` 后再设 `Width`）；
   段落格式对齐 1、`FirstLineIndent=0`、`KeepWithNext=True`。
- 插入后 `TablesOfContents.Update()` → `Repaginate()` → `UpdatePageNumbers()`，再 `SaveAs2(path, 16)`(docx) / `(path, 0)`(.doc)。
- **验证手段**：用系统 Python 的 `fitz`(PyMuPDF, 1.28) 把导出的 PDF 渲染成 PNG 逐页看；
  或解包 docx，按 `body` 子元素顺序打印「`w:object` 出现在哪个段落」，**这是发现"对象插到开头"最快的方法**。
- `doc_to_image`（editor_sdk 的转图接口）走腾讯云，偶发 `code 50000 服务繁忙`，重试即可。
