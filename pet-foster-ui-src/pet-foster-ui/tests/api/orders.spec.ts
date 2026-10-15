import { test, expect } from './fixtures';

/** 按价位表计价：start 与 end 均计入（含首尾），共 end-start+1 天 */
function expectedTotal(pricePerDay: number, start: string, end: string): number {
  const days =
    (Date.parse(end) - Date.parse(start)) / (24 * 60 * 60 * 1000) + 1;
  return pricePerDay * days;
}

test.describe('寄养订单（固定价位计价 + 工作人员全流程）', () => {
  test('工作人员用 priceId 创建订单 → 自动按价位表计价（不接受前端自定义单价）', async ({ staff }) => {
    const res = await staff.post('/api/orders', {
      data: {
        customerId: 1,
        petId: 1,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        priceId: 1, // 标准间 ¥60/天
        // 即使前端传自定义单价，后端也忽略（DTO 已无 pricePerDay 字段）
        pricePerDay: 999,
        remark: '接口测试-标准间计价',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(200);
    const order = body.data;
    expect(order.pricePerDay).toBe(60);
    expect(order.priceId).toBe('1');
    expect(order.totalFee).toBe(expectedTotal(60, '2026-11-01', '2026-11-05')); // 5天*60=300
    expect(order.status).toBe('待入店');

    // 清理
    await staff.delete(`/api/orders/${order.id}`);
  });

  test('创建订单 - 换档位（豪华间 ¥120）计价正确', async ({ staff }) => {
    const res = await staff.post('/api/orders', {
      data: { customerId: 2, petId: 3, startDate: '2026-11-10', endDate: '2026-11-12', priceId: 3 },
    });
    expect(res.status()).toBe(200);
    const order = (await res.json()).data;
    expect(order.pricePerDay).toBe(120);
    expect(order.totalFee).toBe(360); // 3天*120
    await staff.delete(`/api/orders/${order.id}`);
  });

  test('创建订单 - 无效价位 ID → 400', async ({ staff }) => {
    const res = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02', priceId: 99999 },
    });
    expect(res.status()).toBe(400);
  });

  test('创建订单 - 缺少 priceId → 400（校验）', async ({ staff }) => {
    const res = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02' },
    });
    expect(res.status()).toBe(400);
  });

  test('管理员创建订单 → 403（运营层不执行业务）', async ({ admin }) => {
    const res = await admin.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-01', endDate: '2026-11-02', priceId: 1 },
    });
    expect(res.status()).toBe(403);
  });

  test('订单生命周期：详情 → 修改 → 入店 → 离店 → 支付（工作人员）', async ({ staff }) => {
    // 创建
    const createRes = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 2, startDate: '2026-11-01', endDate: '2026-11-03', priceId: 2 },
    });
    expect(createRes.status()).toBe(200);
    const order = (await createRes.json()).data;

    // 详情
    const detailRes = await staff.get(`/api/orders/${order.id}`);
    expect(detailRes.status()).toBe(200);
    const detail = (await detailRes.json()).data;
    expect(detail.orderNo).toBe(order.orderNo);
    expect(detail.customerName).toBeTruthy();
    expect(detail.petName).toBeTruthy();

    // 修改（换档位到标准间，日期不变）
    const updateRes = await staff.put(`/api/orders/${order.id}`, {
      data: { customerId: 1, petId: 2, startDate: '2026-11-01', endDate: '2026-11-03', priceId: 1, remark: '已改档位' },
    });
    expect(updateRes.status()).toBe(200);
    const afterUpdateBody = await (await staff.get(`/api/orders/${order.id}`)).json();
    expect(afterUpdateBody.data.pricePerDay).toBe(60);
    expect(afterUpdateBody.data.totalFee).toBe(180); // 3天*60

    // 入店
    expect((await staff.put(`/api/orders/${order.id}/check-in`)).status()).toBe(200);
    const afterCheckIn = await (await staff.get(`/api/orders/${order.id}`)).json();
    expect(afterCheckIn.data.status).toBe('寄养中');

    // 离店
    expect((await staff.put(`/api/orders/${order.id}/check-out`)).status()).toBe(200);
    const afterCheckOut = await (await staff.get(`/api/orders/${order.id}`)).json();
    expect(afterCheckOut.data.status).toBe('已完成');

    // 支付
    const payRes = await staff.post(`/api/orders/${order.id}/pay`, { data: { paymentMethod: '微信' } });
    expect(payRes.status()).toBe(200);
    const paid = (await payRes.json()).data;
    expect(paid.paymentStatus).toBe('已支付');
    expect(paid.paidAmount).toBe(180);

    // 清理（已完成订单仍可逻辑删除）
    await staff.delete(`/api/orders/${order.id}`);
  });

  test('取消订单 → 工作人员可取消（200），管理员被拒绝（403）', async ({ staff, admin }) => {
    // 工作人员创建
    const createRes = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-11-20', endDate: '2026-11-21', priceId: 1 },
    });
    const order = (await createRes.json()).data;

    // 管理员取消 → 403
    expect((await admin.put(`/api/orders/${order.id}/cancel`)).status()).toBe(403);

    // 工作人员取消 → 200
    expect((await staff.put(`/api/orders/${order.id}/cancel`)).status()).toBe(200);
    const afterCancel = await (await staff.get(`/api/orders/${order.id}`)).json();
    expect(afterCancel.data.status).toBe('已取消');

    // 已取消订单不能再次取消 → 400
    expect((await staff.put(`/api/orders/${order.id}/cancel`)).status()).toBe(400);

    // 清理
    await staff.delete(`/api/orders/${order.id}`);
  });

  test('软删除：删除订单后数据保留但页面接口不再返回', async ({ staff }) => {
    // 创建订单
    const createRes = await staff.post('/api/orders', {
      data: { customerId: 1, petId: 1, startDate: '2026-12-01', endDate: '2026-12-02', priceId: 1, remark: '软删除验证' },
    });
    expect(createRes.status()).toBe(200);
    const order = (await createRes.json()).data;

    // 删除前列表可见
    const beforePage = await staff.get('/api/orders?orderNo=' + order.orderNo);
    const beforeRecords = (await beforePage.json()).data.records as { id: string }[];
    expect(beforeRecords.some((r) => r.id === order.id)).toBe(true);

    // 工作人员删除 → 200（逻辑删除）
    const delRes = await staff.delete(`/api/orders/${order.id}`);
    expect(delRes.status()).toBe(200);

    // 删除后：详情查询返回 400（页面视为不存在）
    const detailRes = await staff.get(`/api/orders/${order.id}`);
    expect(detailRes.status()).toBe(400);

    // 删除后：列表不再返回该订单（页面不显示，达到删除效果）
    const afterPage = await staff.get('/api/orders?orderNo=' + order.orderNo);
    const afterRecords = (await afterPage.json()).data.records as { id: string }[];
    expect(afterRecords.some((r) => r.id === order.id)).toBe(false);

    // 注意：数据库行仍保留（deleted=1），由 SQL 侧验证
  });
});
