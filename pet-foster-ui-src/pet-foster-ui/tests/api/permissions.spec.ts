import { test, expect } from './fixtures';

/**
 * 角色权限矩阵（依据《角色重定义需求分析方案.md》定稿）：
 * 管理员（ADMIN）= 首页运营仪表盘 + 订单流水只读 + 统计 + 订单导出 + 系统管理（用户/日志/寄养价位）
 * 工作人员（STAFF）= 客户/宠物/健康/服务全接口 + 订单全流程(增改删/入店/离店/收费/取消) + 客户/宠物导出
 * 员工不可触统计、订单导出、系统管理、价位维护；管理员不可触业务模块增删改
 */
test.describe('角色权限矩阵', () => {
  test.describe('经营数据（统计）→ 仅管理员', () => {
    for (const path of ['/api/stats/dashboard', '/api/stats/order-trend', '/api/stats/breed-distribution']) {
      test(`staff 访问 ${path} → 403`, async ({ staff }) => {
        const res = await staff.get(path);
        expect(res.status(), `${path} 应被拒绝`).toBe(403);
      });
      test(`admin 访问 ${path} → 200`, async ({ admin }) => {
        const res = await admin.get(path);
        expect(res.status(), `${path} 应可访问`).toBe(200);
      });
    }
  });

  test.describe('业务模块（客户/宠物/健康/服务）→ 仅工作人员', () => {
    const businessApis = ['/api/customers', '/api/pets', '/api/health-records', '/api/service-records'];
    for (const path of businessApis) {
      test(`staff 访问 ${path} → 200`, async ({ staff }) => {
        const res = await staff.get(path);
        expect(res.status(), `${path} 工作人员应可访问`).toBe(200);
      });
      test(`admin 访问 ${path} → 403（管理员不接触业务执行）`, async ({ admin }) => {
        const res = await admin.get(path);
        expect(res.status(), `${path} 管理员应被拒绝`).toBe(403);
      });
    }
  });

  test.describe('订单模块 → 双方可读，写操作仅工作人员', () => {
    test('staff 分页查询订单 → 200', async ({ staff }) => {
      const res = await staff.get('/api/orders?page=1&size=10');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.total).toBeGreaterThanOrEqual(0);
    });

    test('admin 分页查询订单流水 → 200（管理员只看订单流水）', async ({ admin }) => {
      const res = await admin.get('/api/orders?page=1&size=10');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.data.records).toBeInstanceOf(Array);
    });

    test('admin 新增订单 → 403', async ({ admin }) => {
      const res = await admin.post('/api/orders', {
        data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-03', priceId: 1 },
      });
      expect(res.status()).toBe(403);
    });

    test('admin 取消订单 → 403（取消订单是工作人员的事）', async ({ admin }) => {
      const res = await admin.put('/api/orders/1/cancel');
      expect(res.status()).toBe(403);
    });

    test('admin 确认入店/离店/支付/删除订单 → 403', async ({ admin }) => {
      expect((await admin.put('/api/orders/1/check-in')).status()).toBe(403);
      expect((await admin.put('/api/orders/1/check-out')).status()).toBe(403);
      expect((await admin.post('/api/orders/1/pay', { data: { paymentMethod: '微信' } })).status()).toBe(403);
      expect((await admin.delete('/api/orders/1')).status()).toBe(403);
    });

    test('staff 修改订单 → 200（执行层事务）', async ({ staff }) => {
      const created = await staff.post('/api/orders', {
        data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02', priceId: 1 },
      });
      expect(created.status()).toBe(200);
      const order = (await created.json()).data;
      const res = await staff.put(`/api/orders/${order.id}`, {
        data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-04', priceId: 2 },
      });
      expect(res.status()).toBe(200);
      // 清理
      await staff.delete(`/api/orders/${order.id}`);
    });
  });

  test.describe('系统管理（用户）→ 仅管理员', () => {
    test('staff 访问系统用户 → 403', async ({ staff }) => {
      expect((await staff.get('/api/users')).status()).toBe(403);
    });
    test('admin 访问系统用户 → 200', async ({ admin }) => {
      expect((await admin.get('/api/users')).status()).toBe(200);
    });
  });

  test.describe('本月寄养金额（首页金额卡）→ 双方可见（轻量口径接口）', () => {
    test('staff 访问 /api/stats/monthly-revenue → 200', async ({ staff }) => {
      const res = await staff.get('/api/stats/monthly-revenue');
      expect(res.status(), '工作人员首页金额卡应可访问').toBe(200);
      const body = await res.json();
      expect(typeof body.data).toBe('number');
    });
    test('admin 访问 /api/stats/monthly-revenue → 200', async ({ admin }) => {
      const res = await admin.get('/api/stats/monthly-revenue');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(typeof body.data).toBe('number');
    });
  });

  test.describe('数据字典 → 已移除', () => {
    test('字典接口已删除 → 404', async ({ admin, staff }) => {
      expect((await admin.get('/api/dicts')).status()).toBe(404);
      expect((await staff.get('/api/dicts')).status()).toBe(404);
    });
  });
});
