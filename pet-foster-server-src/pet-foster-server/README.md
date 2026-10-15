# 宠物寄养登记与健康档案管理系统 - 后端

## 技术栈

- **框架**: Spring Boot 3.2.x + Java 17
- **ORM**: MyBatis-Plus 3.5.x
- **数据库**: MySQL 8.0
- **鉴权**: Spring Security 6.x + JWT (jjwt 0.12.x)
- **接口文档**: SpringDoc OpenAPI 2.x (Swagger UI)
- **构建**: Maven 3.9+

## 快速启动

### 1. 准备数据库

```bash
mysql -u root -p < sql/schema.sql
```

该脚本会自动创建 `pet_foster` 数据库、8 张表，并插入初始数据。

### 2. 修改配置

编辑 `src/main/resources/application.yml`，确认数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/pet_foster?useUnicode=true&characterEncoding=utf-8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
    username: root
    password: root
```

### 3. 构建并运行

```bash
# 构建
mvn clean package -DskipTests

# 运行
java -jar target/pet-foster-server-1.0.0.jar
```

服务默认启动在 **8090** 端口。

## 默认账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin  | admin123 | admin | 全部模块 + 统计分析 + 系统管理（用户/价位）+ 订单流水导出 |
| staff01 | staff123 | staff | 业务模块（客户/宠物/订单/健康/服务）+ 本月寄养金额（轻量口径） |

## 接口文档

启动后访问 Swagger UI（服务端口为 8090）：

- **Swagger UI**: http://localhost:8090/swagger-ui.html
- **OpenAPI JSON**: http://localhost:8090/v3/api-docs

## 核心接口

> 权限标注：`[ADMIN]`=仅管理员，`[STAFF]`=仅工作人员，`[登录]`=登录即可访问，`[公开]`=无需登录。

### 认证
- `POST /api/auth/login` — 登录，返回 JWT token `[公开]`
- `GET /api/auth/info` — 获取当前登录用户信息 `[登录]`
- `PUT /api/auth/password` — 修改当前用户密码 `[登录]`

### 健康检查
- `GET /health` — 服务存活检查 `[公开]`

### 客户管理（工作人员）
- `GET/POST/PUT/DELETE /api/customers`、`GET /api/customers/{id}` — 客户信息增删改查 `[STAFF]`

### 宠物档案（工作人员）
- `GET /api/pets`、`GET /api/pets/{id}`、`GET /api/pets/customer/{customerId}` — 查询 `[STAFF]`
- `POST/PUT/DELETE /api/pets`、`/api/pets/{id}` — 增删改（删除受订单引用保护）`[STAFF]`

### 寄养订单（读=双方，写=工作人员）
- `GET /api/orders`、`GET /api/orders/{id}` — 查询订单流水 `[登录]`
- `POST /api/orders` — 创建订单（固定价位下单，停用档位被拒绝）`[STAFF]`
- `PUT /api/orders/{id}` — 修改订单 `[STAFF]`
- `DELETE /api/orders/{id}` — 取消删除（软删除，deleted=1 页面不显示）`[STAFF]`
- `PUT /api/orders/{id}/check-in` — 确认入店（待入店→寄养中）`[STAFF]`
- `PUT /api/orders/{id}/check-out` — 确认离店（寄养中→已完成）`[STAFF]`
- `PUT /api/orders/{id}/cancel` — 取消订单 `[STAFF]`
- `POST /api/orders/{id}/pay` — 模拟支付 `[STAFF]`

### 健康档案 / 服务记录（工作人员）
- `GET/POST/PUT/DELETE /api/health-records`、`/api/health-records/{id}` — 健康档案管理 `[STAFF]`
- `GET/POST/PUT/DELETE /api/service-records`、`/api/service-records/{id}` — 寄养服务记录 `[STAFF]`

### 统计分析（管理员）
- `GET /api/stats/dashboard` — 首页看板/统计四卡数据 `[ADMIN]`
- `GET /api/stats/order-trend` — 近 5 个月订单数与收入趋势（可选 startDate/endDate）`[ADMIN]`
- `GET /api/stats/breed-distribution` — 宠物品种分布 `[ADMIN]`
- `GET /api/stats/monthly-revenue` — 本月寄养金额（本月非已取消订单费用合计，员工首页金额卡用）`[登录]`

> 统计口径：全部统计 SQL 显式过滤软删订单（deleted=0）；趋势收入、总营收与本月寄养金额口径一致（均排除已取消订单）。

### 系统管理（仅管理员）
- `GET/POST/PUT/DELETE /api/users`、`/api/users/{id}` — 用户账号管理 `[ADMIN]`
- `GET /api/prices/options` — 启用档位下拉选项（下单用）`[登录]`
- `GET/POST/PUT/DELETE /api/prices`、`/api/prices/{id}` — 寄养固定价位管理（管理员可改）`[ADMIN]`

### 数据导出
- `GET /api/export/customers` — 客户列表导出 `[STAFF]`
- `GET /api/export/pets` — 宠物档案导出 `[STAFF]`
- `GET /api/export/orders` — 门店经营数据导出 `[ADMIN]`（文件名「门店经营数据.xlsx」，sheet1 经营数据 / sheet2 订单数据）

## 认证方式

请求头携带 JWT token：

```
Authorization: Bearer <token>
```

## 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": {}
}
```

分页数据：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [],
    "total": 100,
    "page": 1,
    "size": 10
  }
}
```

## 订单业务规则

- 订单号自动生成：`FO + yyyyMMdd + 3位序号`（如 FO20261008001）
- 总费用 = 单日单价 × (endDate - startDate + 1)，后端自动计算
- 状态流转：待入店 → 寄养中 → 已完成，任意状态可取消为已取消
- 已完成/已取消订单不可修改
