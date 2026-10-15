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

服务默认启动在 **8080** 端口。

## 默认账号

| 用户名 | 密码 | 角色 | 权限 |
|--------|------|------|------|
| admin  | admin123 | admin | 全部模块 + 系统管理 |
| staff01 | staff123 | staff | 业务模块（客户/宠物/订单/健康/服务/统计） |

## 接口文档

启动后访问 Swagger UI：

- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **OpenAPI JSON**: http://localhost:8080/v3/api-docs

## 核心接口

### 认证
- `POST /api/auth/login` — 登录，返回 JWT token
- `GET /api/auth/info` — 获取当前登录用户信息

### 业务模块
- `GET/POST/PUT/DELETE /api/customers` — 客户管理
- `GET/POST/PUT/DELETE /api/pets` — 宠物档案
- `GET/POST/PUT/DELETE /api/orders` — 寄养订单
- `PUT /api/orders/{id}/check-in` — 确认入店（待入店→寄养中）
- `PUT /api/orders/{id}/check-out` — 确认离店（寄养中→已完成）
- `PUT /api/orders/{id}/cancel` — 取消订单
- `GET/POST/PUT/DELETE /api/health-records` — 健康档案
- `GET/POST/PUT/DELETE /api/service-records` — 服务记录

### 统计分析
- `GET /api/stats/dashboard` — 首页看板数据
- `GET /api/stats/order-trend` — 近5个月订单趋势
- `GET /api/stats/breed-distribution` — 宠物品种分布

### 系统管理（仅 admin）
- `GET/POST/PUT/DELETE /api/users` — 用户管理
- `GET/POST/PUT/DELETE /api/dicts` — 数据字典

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
