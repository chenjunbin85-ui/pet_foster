# pet-foster 项目长期备忘

宠物旅馆管理系统（原「宠物寄养登记与健康档案管理系统」）毕设全栈项目。
- 前端 `pet-foster-ui-src/pet-foster-ui`：React 19 + TS + Vite + Tailwind v4 + shadcn **Base UI 版**
- 后端 `pet-foster-server-src/pet-foster-server`：Spring Boot 3.2.5 + Java 17/21 + MyBatis-Plus + MySQL + JWT
- 前端 5173 `npm run dev`；后端 8090 `mvn spring-boot:run`；MySQL 3306 库 `pet_foster` root/root；Redis 6379 `D:\Redis-8.6.0\4`；账号 `admin/admin123`、`staff01/staff123`
- 目录：`护宠宝-项目源文件/` 01-需求…07-参考、`论文配图/`、脚本 `_thesis_work/`/`_thesis_code_work/`/`_report_work/` **已于 10-19 清理**，现仅存前后端源码；论文/报告/答辩表成品都在**桌面**，临时脚本放 `%TEMP%`

## 坑 1：Base UI（白屏 / 定位失效）
- **\*GroupLabel 必须包 Group**：`DropdownMenuLabel`/`SelectLabel` 直放 Content → `MenuGroupContext is missing` → 整树卸载白屏。
- **reicon 图标不能当 render 元素**：内部 `dangerouslySetInnerHTML` → 白屏；只能放 children。**某类页面集体白屏 → 先查共用的 `ui/*` 组件。**
- **Positioner props 必须显式透传**：`DropdownMenuContent` 只把 `align/alignOffset/side/sideOffset` 交给 Positioner，`anchor`/`collisionPadding` 落到 Popup 被**静默忽略**。角色菜单 `anchor={profileRef}`+`align="end"`+`.sidebar-menu{min-width:208px}`。`DROPDOWN_COLLISION_AVOIDANCE` 在私有路径，别 import。

## 坑 2：沙箱（e2e / Maven / Redis）
- 全局代理 `127.0.0.1:64306` 拦 localhost → 502 / `ERR_PROXY_CONNECTION_FAILED`。**curl 502 ≠ server 挂了**，先 `netstat -ano | grep :5173`。
- Playwright：Chromium 加 `--no-proxy-server`（`proxy:{server:"direct://"}` 不可靠）+ 清代理变量后跑：
  `env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" npx playwright test --config=_pw.config.ts`
  `_pw.config.ts`：baseURL `http://127.0.0.1:5173`、`workers:1`（并行触发登录限流）。dev server 用 `run_in_background: true` 启。清 `test-results` 撞 `[safe-delete] ETIMEDOUT` → 加 `dangerouslyDisableSandbox: true`。
- Maven：`SERVER__PORT=56869` 会覆盖 `server.port` → `env -u SERVER__PORT -u SERVER_PORT`；`mvn` 需 `java -cp $MAVEN_HOME/boot/plexus-classworlds-2.8.0.jar ... Launcher`（skill `maven-gitbash-sandbox`）。
- Redis：沙箱不让写 RDB → `MISCONF` → INCR 被拒、登录限流静默失效 → 加 `--stop-writes-on-bgsave-error no`。

## 坑 3：recharts 环形图
- 必须正方形画布（`<Pie>` 半径按 `min(宽,高)/2`，非正方即被裁成直线边）：`aspect-square w-full`（覆盖默认 `aspect-video`）+ 百分比半径；`margin` 全 0；`startAngle={90} endAngle={-270}`（默认 3 点钟逆时针）。中心合计用 `.donut-wrap{position:relative}` + 绝对定位 `.donut-center`。
- **tooltip 斜飞**：wrapper 的 `top/left` 恒 `0px`，位置只写 inline `transform`，`isAnimationActive && active` 时带 `transition: transform 400ms`。✅ 两处都修：`<ChartTooltip isAnimationActive={false} />` + `.donut-wrap .recharts-tooltip-wrapper{transition:none!important}`，淡入改关键帧。只对 `.donut-wrap`，趋势图横滑合理。

## 坑 4：设计稿→代码 / 透明 PNG 薄膜
- **SVG viewBox 裁切不能照抄**：坐标与拼图实际尺寸不符会裁错 → 用 Pillow 量真实边界离线裁独立 PNG，组件用普通 `<img>`。
- **位图不能同时写死 width+height**：只定一维 + `aspect-ratio` + `object-fit:contain`，别用媒体查询覆盖 height；`aspect-ratio` 必须对齐磁盘实际尺寸（`naturalWidth/naturalHeight` 或 `struct.unpack('>II', d[16:24])` 复核，别信注释）。「定宽+max-height」保不住比例，正解把宽高写进同一个 `min()`：`width: min(100%, 200px, calc((100cqh - 44px)*3/2)); aspect-ratio:3/2;`（父级 `container-type:size`）。
- **⚠️ 大片透明区的 PNG 加 transform = 压出可见薄膜（用户说的"白蒙版边界"）**：真凶是 `transform: scale()`（`todo-illustration.png` 59.5% 像素全透明且透明像素 RGB 非 0 → 独立合成层重采样）。定位：逐条注入 `::before{display:none}`/`::after`/`overflow:visible`/`img{transform:none}` A/B 截图。✅ 用「布局尺寸 + object-fit」；⚠️ **只改 width/height 不重置 transform 没用**。❌ 别用"中线扫像素比亮度跳变"断言（被文字笔画主导）。

## 坑 5：care-card 蒙版
蒙版色**与卡片底色同源** `color-mix(in srgb, var(--care-background) 18%, transparent)`，放 **`::before`**（`::after` 已被底部渐隐占用），`z-index:1`、`pointer-events:none`；黑白会压出异色块。**插图% + 文字% ≤ 100%**（现 40%+68%）；是否真重叠**必须看截图**（PNG 大量透明留白，bbox 相交 ≠ 视觉冲突）。

## 坑 6：首页标题区排版与全站统一
曾 `@media (max-height:680px)` 把 h1 压到 19px。✅ 规则：**字号/行距/字距/内边距一律不动**，矮屏只压外边距等其它模块。基准 kicker `10px/ls1.2px`、h1 `27px/600/lh40.5px/ls.035em/margin 10px 0`、p `12px/lh21.6px`。回归 `首页标题区排版与其它页面保持一致`。

## 布局：一屏装下
`.workspace{height:100dvh;overflow:hidden}` → `.workspace-main` → `.dashboard-body{flex:1;min-height:0;overflow-y:auto}`；首页/统计页由 `App.tsx` 的 `bodyClassName` 三元切 `.home-dashboard-body`/`.stats-dashboard-body`。**命门 `min-height:0`**（默认 `auto` 被内容顶开）。图表尺寸用 container query `min(100cqw,100cqh,上限)`；窄屏 ≤1000px 退回自然流 + 滚动。e2e：`宽屏不超屏` 断 `scrollHeight-clientHeight ≤ 1`。

## 界面与技术约定
- 整站按《Text Formatting Enhancement》设计稿还原（**仅登录页例外**）：`.workspace` + 可折叠 `.sidebar`（`.nav-item[data-nav]`）+ `.dashboard-body`。样式全为**自定义 class**（`.customer-*`/`.business-*`/`.stat-card`/`.care-card`/`.chart-*`/`.system-*`），集中在 `src/index.css`「新版界面」段，**不要改写成 Tailwind 工具类**。标题 `.section-kicker` + 句子式 `h1`。弹窗用**原生 `<dialog>`+`showModal()`**（top layer 盖住 sonner toast → 先 `setState(null)` 再 `toast.success()`）。
- **配色**（OKLCH，`src/index.css`）：主色 `oklch(0.55 0.15 45)`≈**#B64E10**（色相统一 45°），暗 `oklch(0.85 0.12 45)`；中性 #FFFFFF/#FAFAFA（暗 #171717）；border 亮 #EADAD3 / 暗 `oklch(1 0 0/10%)`；destructive #E7000B（暗 #FF6467）；`--chart-1..5`=橙#D95800/黄#E7B643/绿#2E9E52/蓝#158DD9/灰蓝#4F5661。字体 Geist Variable，`--radius:0.625rem`。详见《宠物寄养系统-配色方案.html》。
- 图标 **reicon-react**（无 `Icon` 后缀），已移除 lucide-react。角色切换＝用目标账号密码重登 `/api/auth/login` 换发新 token；当前角色项用 Base UI `disabled` 真禁用。登录限流 Redis `pet:foster:login:fail:{账号}`/`:lock:{账号}`（5 分钟 5 次锁 5 分钟，Redis 挂了只告警）。后端统一 `Result{code,message,data}`，业务异常走 `GlobalExceptionHandler` 返 400。
- **登录页**：双栏 `.login-shell`/`.story-panel`/`.form-panel`（`index.css` 末尾），素材 `public/images/`，失败在 `.form-message`（`role="alert"`），按钮可访问名「登录」。**严格一屏** `100dvh;overflow:hidden` + 照片 `object-fit:cover`；矮屏 `(max-height:800px)` 必须同时限定 `min-width:701px`；验收要同时量页面滚动与 `.form-panel` 自身溢出。
- **天气** `src/lib/weather.ts`（和风）：API Host 每账号独立，⚠️ 文档里的 `abc.xyz.qweatherapi.com` 全是占位示例；鉴权头 **`X-QW-Api-Key`**（`Authorization: Bearer` 返 401）。`GET {host}/weather/v1/current/{lat}/{lon}?lang=zh`，反查 `/geo/v2/city/lookup?location={lon},{lat}` 取 `adm2`。GPS 优先，失败降级 IP。三态 `is-loading/ready/is-error`，**禁止「天气暂未获取」与「—」占位符**。

## 测试
`tests/e2e/*.spec.ts`（13 spec / 108 test / 0 skip）：认证、客户 CRUD、订单、页面加载、权限、布局与角色菜单、登录锁定、环形图完整性与 tooltip 位置、插图等比与无 transform 硬边、宽屏不超屏、标题区排版一致性。

## Office 文档链路（本地）
路由 `workbuddy-office-routing` → `workbuddy-local-office-edit`（`edsdk.py`，managed python 跑）。
**铁律：改含图/含 OLE 的 docx 一律纯 OOXML 直改**（zipfile 读 `document.xml` → lxml 改 → 重写 zip）；**禁 WPS `doc.Save()`**（一次保存把 InlineShapes/embeddings/`w:object`/`w:pict` 翻倍、毁图）。
- `pPr` 子元素顺序：`pStyle, keepNext, keepLines, …, kinsoku, overflowPunct, topLinePunct, spacing, ind, jc, rPr`。
- **图题/文字被拆成多个 `w:t`**：改写前先 `''.join(t.text)` 整段合并再回写。
- **WPS 对含内嵌图片的段落忽略 `w:keepNext`/`w:keepLines`**：保证图题不掉页只有一招——图片段与题注段合并成一段（中间插 `<w:r><w:br/></w:r>`），临界图再单独缩放 `wp:extent`+`a:ext`。判断跨页：导 PDF 后 fitz `get_image_info()` 看图片是否在题注块上方。
- **WPS COM**：`kwps.Application`，`Documents.Open(p, ReadOnly=True)`、`ComputeStatistics(2)`页数 / `(3)`字符、`ExportAsFixedFormat(PDF, 17)`；`Visible=False` 时 `Hyperlink.Follow()` 后 `Selection.Start` 恒 0（不能用 COM 验跳转）；`Range.Collapse` 反直觉：`wdCollapseStart=1`。
  ⚠️ 取书签页码：`Bookmarks.ShowHidden=True` 后**枚举 `Bookmarks(i)` 建 Name→书签 字典**（`.Item(name)`/`Bookmarks(name)` 在本机 gen_py 报「发生意外」）；`Range.Information(3)`=物理页，印刷页需减前置页数。
  ⚠️ 改目录页码只替换段落末尾数字：`Range.End−1`=`\r`、`End−2`=字段结束符，数字块 = `Range(End−2−n, End−2)`；这样改**超链接不断、制表位点线不变**。
- **editor_sdk 坑**：`doc_find` 返回键是 **`locations`**（总数 `total`）；`open_file` 默认非阻塞（`wait=true`）；`doc_get_images` 只扫 `w:drawing`，扫不到 VML `w:pict`/OLE，`.doc` 返空；`doc_resolve_document_structure` 只给 compact 结构；`.doc` 的 `save_file` 写回原路径需 `allow_format_change=true`。改表格：`doc_set_table_cells` 只传 `text`+`inherit:false`，删行从底部往上，`doc_insert_table_rows` 会多出 1 行需再删末尾空行，整段替换用**整段原文**做 key。

## 论文与实训报告（已完成，留要点）
- 论文成稿在项目根目录《宠物旅馆管理系统》66 页：35 个书签 `_Toc9000001..35` + 目录整行 `<w:hyperlink w:anchor>` 做点击跳转；页码 3 节（封面无 / I~III / 1~61）。⚠️ 禁 `TablesOfContents(1).Update()`（会把正文收进目录）；⚠️ 删分节符后要给 body `sectPr` 补 `footerReference`。
- 桌面实训报告：24 页 / 17618 字符 / 25 图。桌面答辩记录表：表格0 R8＝「指导教师评语」单元格（`trHeight 6267 atLeast`，标签与签名段 10pt/`pStyle 7`，签名段含签名图 `rId4`）。填评语：删中间空占位段 → 克隆标签段写正文（`spacing line=228`、`ind left=117 firstLine=400 firstLineChars=200`、`jc both`、`sz 20`）→ 签名段前补 N 个空段把签名压到距底边 ~11pt（每段 ≈12.33pt）。
- **遗留未改（用户明确不动）**：正文「外键约束」与实库 0 个 FOREIGN KEY 不符；「七个核心实体」但属性图仅 6 张；「八个功能模块」但图仅 7 分支；「12 个测试文件 87 条用例」实为 13/108；图12 位图内 P5 误标 D6 寄养价位表；封面「实验XXX」占位符、指导教师「曾盛熒/曾盛荧」不一致；英文 Keywords 双逗号。
