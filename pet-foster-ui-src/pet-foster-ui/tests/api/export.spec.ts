import { test, expect } from './fixtures';

test.describe('数据导出（订单→仅管理员；客户/宠物→仅工作人员）', () => {
  test('订单导出 → 管理员 200 / 工作人员 403', async ({ admin, staff }) => {
    const staffRes = await staff.get('/api/export/orders');
    expect(staffRes.status(), '工作人员导出订单应被拒绝（营业数据）').toBe(403);

    const adminRes = await admin.get('/api/export/orders');
    expect(adminRes.status()).toBe(200);
    expect(adminRes.headers()['content-type'] || '').toContain('spreadsheetml');
  });

  test('客户导出 → 工作人员 200 / 管理员 403', async ({ admin, staff }) => {
    expect((await admin.get('/api/export/customers')).status()).toBe(403);
    const staffRes = await staff.get('/api/export/customers');
    expect(staffRes.status()).toBe(200);
    expect(staffRes.headers()['content-type'] || '').toContain('spreadsheetml');
  });

  test('宠物导出 → 工作人员 200 / 管理员 403', async ({ admin, staff }) => {
    expect((await admin.get('/api/export/pets')).status()).toBe(403);
    const staffRes = await staff.get('/api/export/pets');
    expect(staffRes.status()).toBe(200);
    expect(staffRes.headers()['content-type'] || '').toContain('spreadsheetml');
  });
});
