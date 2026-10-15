import { test, expect } from './fixtures';

test.describe('寄养价位（固定价位，管理员可修改）', () => {
  test('工作人员可查看启用档位选项（下单下拉用）', async ({ staff }) => {
    const res = await staff.get('/api/prices/options');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const options = body.data as { id: string; levelName: string; pricePerDay: number }[];
    expect(options.length).toBeGreaterThanOrEqual(3);
    const standard = options.find((o) => o.pricePerDay === 60);
    expect(standard, '应包含标准间 ¥60').toBeTruthy();
  });

  test('管理员同样可查看档位选项', async ({ admin }) => {
    const res = await admin.get('/api/prices/options');
    expect(res.status()).toBe(200);
  });

  test('档位分页管理仅管理员可见', async ({ admin, staff }) => {
    expect((await staff.get('/api/prices')).status()).toBe(403);
    expect((await staff.get('/api/prices/1')).status()).toBe(403);
    const res = await admin.get('/api/prices');
    expect(res.status()).toBe(200);
  });

  test('管理员新增/修改/删除档位，工作人员被拒绝', async ({ admin, staff }) => {
    // 工作人员新增 → 403
    expect((await staff.post('/api/prices', { data: { levelName: '测试房', pricePerDay: 55, status: 1 } })).status()).toBe(403);

    // 管理员新增
    const createRes = await admin.post('/api/prices', {
      data: { levelName: '测试房', pricePerDay: 55, status: 1, sort: 9, remark: '接口测试创建' },
    });
    expect(createRes.status()).toBe(200);
    // 通过分页查询找到新建档位 id
    const pageRes = await admin.get('/api/prices?keyword=测试房');
    const records = (await pageRes.json()).data.records as { id: string; levelName: string; pricePerDay: number }[];
    const created = records.find((r) => r.levelName === '测试房');
    expect(created).toBeTruthy();

    // 管理员修改
    const updRes = await admin.put(`/api/prices/${created.id}`, {
      data: { levelName: '测试房改', pricePerDay: 66, status: 1, sort: 9 },
    });
    expect(updRes.status()).toBe(200);

    // 工作人员修改 → 403
    expect((await staff.put(`/api/prices/${created.id}`, { data: { levelName: 'x', pricePerDay: 1, status: 1 } })).status()).toBe(403);

    // 管理员删除（清理）
    expect((await admin.delete(`/api/prices/${created.id}`)).status()).toBe(200);
  });

  test('管理员停用档位后，工作人员用该档位下单被拒绝', async ({ admin, staff }) => {
    // 准备一个临时档位
    const createRes = await admin.post('/api/prices', {
      data: { levelName: '临时房', pricePerDay: 70, status: 1, sort: 8, remark: '停用验证' },
    });
    expect(createRes.status()).toBe(200);
    const pageRes = await admin.get('/api/prices?keyword=临时房');
    const records = (await pageRes.json()).data.records as { id: string }[];
    const priceId = records[0].id;

    // 启用状态下可下单
    const okRes = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02', priceId: Number(priceId) },
    });
    expect(okRes.status()).toBe(200);
    const order = (await okRes.json()).data;
    await staff.delete(`/api/orders/${order.id}`); // 清理订单

    // 管理员停用
    const disRes = await admin.put(`/api/prices/${priceId}`, {
      data: { levelName: '临时房', pricePerDay: 70, status: 0, sort: 8 },
    });
    expect(disRes.status()).toBe(200);

    // 停用后下单 → 400 提示停用
    const failRes = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02', priceId: Number(priceId) },
    });
    expect(failRes.status()).toBe(400);
    const failBody = await failRes.json();
    expect(String(failBody.message)).toContain('停用');

    // 清理临时档位
    expect((await admin.delete(`/api/prices/${priceId}`)).status()).toBe(200);
  });
});
