# Web 端 Playwright 全量回归报告

日期：2026-11-06　项目：宠物旅馆管理系统（Web 管理端）　执行方式：`playwright-skill`（testdino Playwright Skill v2.5.0）+ 本机代理绕行经验

## 1. 结论

| 轮次 | 用例总数 | 通过 | 失败 | 耗时 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 第一轮基线 | 120 | 110 | 10 | ≈12.7 min | **FAIL**，10 条全部集中在 `payment.spec.ts` |
| 支付模块基线复现 | 11 | 1 | 10 | 3.6 min | **FAIL**，收银台入口不存在 |
| 支付模块修复后 | 11 | 11 | 0 | 29.2 s | **PASS** |
| 全量回归（修复后） | 120 | **120** | **0** | 8.2 min | **PASS**，无 skip、无 flaky |

**根因不是功能 bug，是测试套件与产品现状脱节**：2026-10-15「明确角色权限划分」把订单改为「创建即已支付」，收银台入口随之移除，但 `payment.spec.ts` 仍按「待支付」写，因此从第一条 UI 用例开始超时。本次按**只修测试、不动后端与产品行为**的最保守方案处置。

## 2. 环境与执行方式

| 项 | 值 |
| --- | --- |
| 前端 | Vite `127.0.0.1:5175`（`npx vite --port 5175 --strictPort --host 127.0.0.1`） |
| 后端 | Spring Boot 3.2.5 `127.0.0.1:8090`（项目自带 `run-backend.bat`，启动时 `env -u PORT -u SERVER_PORT -u SERVER__PORT` 避免环境变量覆盖端口） |
| 数据库 | MySQL 3306 / `pet_foster` / root |
| Redis | 6379，启动参数 `--stop-writes-on-bgsave-error no --save "" --appendonly no`（沙箱禁写 RDB 会导致 INCR 被拒、登录限流静默失效） |
| 测试 | `_pw.config.ts`，`baseURL=http://127.0.0.1:5175`，`workers:1`（并行触发登录限流），`@playwright/test` + Chromium |
| 代理 | 清 `http_proxy/https_proxy/HTTP_PROXY/HTTPS_PROXY` + `NO_PROXY=127.0.0.1,localhost`；Chromium 加 `--no-proxy-server`。全局代理 `127.0.0.1:64306` 会拦 localhost 并返回 502 |

执行链路：启动三端 → 单 spec 冒烟 → 基线全量 → 定位 → 修测试 → 单 spec 复测 → 全量回归。

## 3. 第一轮基线结果

`npx playwright test --config=_pw.config.ts --reporter=line` → **120 条，110 通过 / 10 失败**。

| 失败文件 | 失败数 | 表现 |
| --- | --- | --- |
| `tests/e2e/payment.spec.ts` | 10 | 8 条 UI 用例等 `.pay-due-tag` 30 s 超时；2 条 API 用例断言与返回文案不符 |
| 其它 12 个 spec | 0 | 全通过 |

## 4. 已修正的口径漂移（非产品缺陷）

跑基线前先修了两处「测试写死旧值」，否则 110 条也过不了：

| 项 | 旧值（测试） | 新值（`schema.sql` / 产品现状） | 影响面 |
| --- | --- | --- | --- |
| 演示账号 | `admin/admin123`、`staff01/staff123` | `13800138000/123456`、`13800138011/123456`（种子全部手机号制，密码统一 `123456`） | 16 个文件 67 处 + `src/components/RoleSwitchDialog.tsx` 的预填默认值 |
| 页面名 | 「统计分析」 | 「经营数据」（commit `2d924cc` 已更名） | 9 个文件 35 处 |

`tests/api/auth.spec.ts` 里的角色断言（返回值 `role`）保持不变，只改账号与密码。

## 5. 支付模块 10 条失败的根因

### 5.1 时间线

| 日期 | commit | 变更 |
| --- | --- | --- |
| 10-14 | `7aadcdb` | 新增「模拟支付 / 收银台」，同时写 `payment.spec.ts`，假设新订单是**待支付** |
| 10-15 | `7b4d3ba` | 「明确角色权限划分」改为：**前台创建订单即完成收款（演示）** |
| 11-05 | `10410e7` | 小程序日期修复，未动支付 |

### 5.2 代码证据（文件 / 行号）

- `FosterOrderService.java:79-84` —— `create()` 直接置 `status=待入店`、`paymentStatus=已支付`、`paymentMethod=微信`、`paymentTime=now()`，注释原文「前台创建订单即完成收款（演示），不再产生未支付订单」；`:88-89` 计算 `totalFee` 并写入 `paidAmount`。
- `FosterOrderService.java:155-158` —— `calcTotalFee()` = `pricePerDay × (DATEDIFF+1)`，**不写 `charge_days`**（只有小程序端 `MpOrderService` 落该字段）。
- `MpOrderService.java:153` —— 小程序下单一模一样，也置 `PAID`。
- `FosterOrderService.java:168-172` —— `pay()` **先判 `PAID`、再判 `CANCELLED`**。
- `FosterOrderController.java:43-48` —— `POST /api/orders` 返回 `Result<FosterOrderVO>`，含完整支付字段。
- `OrdersPage.tsx:215` —— 保存提示是「订单已创建并完成收款。」（不是「请完成支付。」）。
- `OrdersPage.tsx:670-671` —— 收银台 `<dialog>` 由 `{payOrder && ...}` 条件渲染，而 `payOrder` 已无任何赋值点；`:476-496` 详情弹窗也已无「支付状态 / 支付方式 / 支付时间」字段，「立即支付」按钮和 `.pay-due-tag` 全部移除。
- `docs/项目文档.md` §7.3 早已写明「订单创建即置待入店 / 已支付 / 微信」——**文档是对的，只有测试没跟上**。

### 5.3 数据与接口复现

库里本轮测试新建的订单 `payment_status` 全为「已支付」，全表「未支付」只剩 2 条 10 月初种子订单。对现存订单 138 实测：

```
GET  /api/orders/138  →  status=待入店, paymentStatus=已支付
POST /api/orders/138/pay → HTTP 400 {"message":"订单已支付，请勿重复支付"}
```

### 5.4 10 条用例怎么挂的

| 类型 | 条数 | 原因 |
| --- | --- | --- |
| UI：收银台弹窗 / 支付切换 / 模拟支付 / 稍后支付 / 详情立即支付 / 新建订单待收款 | 8 | `createPayableOrder()` 造出的订单已支付，列表无 `.pay-due-tag`，`searchOrder()` 等 30 s 超时；新建订单的 `.customer-notice` 文案也已变更 |
| API：重复支付被拒绝 | 1 | 期望首次 200、二次 400，实际首次即 400 |
| API：已取消订单无法支付 | 1 | 期望「已取消订单无法支付」，实际「订单已支付，请勿重复支付」——`PAID` 判断排在 `CANCELLED` 前面 |

## 6. 处置决策

**选择：只改测试，不动后端、不改产品行为、不重启服务重编译。**

理由：

1. `create()` 的注释明确写「演示」，是有意的产品设计，不是回归缺陷；`docs/项目文档.md` §7.3 与代码一致。
2. 恢复模拟支付需改 `FosterOrderService` + `MpOrderService` 两处、重新编译并重启 8090，还会改变演示订单数据与经营数据营收口径，属于产品决策，不擅自执行。
3. 测试套件的职责是守住当前行为；把过时的「待支付」断言换成「创建即已支付」的回归护栏，收益最大、风险最小。

**可回滚路径**：若要恢复收银台流程，改 `FosterOrderService.java:81-83` 与 `MpOrderService.java:153` 为 `UNPAID`，前端补回 `.pay-due-tag` 与 `setPayOrder(created)`，再用本文件 git 历史中的旧版 `payment.spec.ts` 恢复 10 条交互用例。

## 7. 缺陷修复清单

| # | 文件 | 修复 |
| --- | --- | --- |
| 1 | `tests/e2e/payment.spec.ts` | 整份重写为「订单支付状态（创建即已支付）」：11 条用例覆盖 API 支付字段 / 拒绝边界 / UI 列表 / 详情 / 新建流程 / 旧收银台不回归 |
| 2 | 同上 `cleanup()` | **修漏删订单**：旧版只依赖用例内登记的 `orderId`，用例在 `fetchLatestOrder()` 前失败就漏删（实测残留 3 笔）。新版按 `customerId` 反查该客户全部订单再逐个删除，并保留已登记 ID 作兜底 |
| 3 | 同上 helpers | 抽出 `fillNewOrderForm()` 消除两条 UI 用例的重复表单代码；`createPayableOrder` → `createPaidOrder` 并保留创建接口返回的 VO 供断言 |
| 4 | 同上断言 | 「计费天数」按产品真实现状断言：Web 端不写 `charge_days`，详情显示「—」，总费用改按 `3 × pricePerDay` 校验（首轮复测曾误按小程序口径断言 `3 天`，已修正） |

用例数保持 11 条，全量总数仍是 120。

## 8. 复测结果

- `tests/e2e/payment.spec.ts`：**11 passed / 0 failed，29.2 s**（基线 3.6 min，因不再等 30 s 超时）。
- 修复后 `cleanup()` 生效：复测结束查询 `deleted=0` 且 `order_no LIKE 'FO20261106%'` 的订单，**没有新增残留**，只剩历史遗留的 3 笔（见 §9）。
- **全量回归：`npx playwright test --config=_pw.config.ts --reporter=line` → 120 passed / 0 failed / 0 skipped，8.2 min。** 13 个 spec 全绿，其中 `[87/120]–[97/120]` 为重写后的支付模块 11 条。
- 回归后再次核对数据库：`deleted=0` 且 `order_no LIKE 'FO20261106%'` 的订单仍只有历史遗留的 3 笔，**全量测试没有新增残留**，新版 `cleanup()` 生效。

## 9. 遗留问题（本轮均未改，按优先级）

| 优先级 | 问题 | 证据 / 建议 |
| --- | --- | --- |
| P2 | 收银台是死代码 | `OrdersPage.tsx:670-760` 的 `<dialog>` 与 `payOrder/payMethod/paying` 等 state 无任何赋值点，约 90 行残留。建议：要么删除，要么恢复完整支付流程，不要留半截 |
| P2 | `pay()` 判断顺序导致文案不准 | `FosterOrderService.java:171` 的 `PAID` 在 `:172` 的 `CANCELLED` 之前，已取消的已支付订单返回「请勿重复支付」而非「已取消订单无法支付」。建议调换两行顺序（需重新编译重启） |
| P2 | Web / 小程序计费字段不一致 | Web 端 `FosterOrderService.create()` 只算 `total_fee`，`charge_days` 恒 NULL；小程序 `MpOrderService` 会落 `charge_days` 和账单明细。详情弹窗因此显示「—」 |
| P3 | 3 笔历史 e2e 残留订单 | `129 / FO20261106007`、`138 / FO20261106016`、`148 / FO20261106026`，均 `deleted=0`，是本轮修复前旧 `cleanup()` 漏删的测试产物。未动数据库；如需清理：`DELETE FROM foster_order WHERE order_id IN (129,138,148);`（建议先确认这三笔不是演示数据） |
| P3 | 小程序未做开发者工具编译 / 真机预览 | 本机未在常见路径检测到微信开发者工具；员工端 18 页只做过静态校验 + Node 打桩 111 断言 + 后端六岗位冒烟，源码级与接口级覆盖，非真机覆盖 |
| P3 | `test-results/.last-run.json` 曾被误纳入版本库 | 本次工作区已删除该文件，提交后从索引移除；`.gitignore` 已补 `playwright-tests/*-out.txt`、`dump.rdb`、`*.genie`、`.agents/`、`.creative-design/`、运行时 `uploads/` |

## 10. 提交与推送

见文末「提交记录」。

## 附录：执行命令

```bash
# 三端
cd D:/Redis-8.6.0/4 && ./redis-server.exe --port 6379 --stop-writes-on-bgsave-error no --save "" --appendonly no
cd pet-foster-ui-src/pet-foster-ui && npx vite --port 5175 --strictPort --host 127.0.0.1
cd pet-foster-server-src/pet-foster-server && env -u PORT -u SERVER_PORT -u SERVER__PORT cmd //c run-backend.bat

# 测试（清代理是关键）
cd pet-foster-ui-src/pet-foster-ui
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
  NO_PROXY="127.0.0.1,localhost" no_proxy="127.0.0.1,localhost" \
  npx playwright test --config=_pw.config.ts --reporter=line

# 单文件
... npx playwright test --config=_pw.config.ts tests/e2e/payment.spec.ts --reporter=line
```
