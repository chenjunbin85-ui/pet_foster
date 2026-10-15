import { test, expect } from './fixtures';

test.describe('认证接口', () => {
  test('管理员登录成功，返回 token 与 admin 角色', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: 'admin', password: 'admin123' } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(200);
    expect(body.data.token).toBeTruthy();
    expect(body.data.userInfo.role).toBe('admin');
  });

  test('工作人员登录成功，返回 token 与 staff 角色', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: 'staff01', password: 'staff123' } });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.code).toBe(200);
    expect(body.data.token).toBeTruthy();
    expect(body.data.userInfo.role).toBe('staff');
  });

  test('密码错误返回 400', async ({ request }) => {
    const res = await request.post('/api/auth/login', { data: { username: 'staff01', password: 'definitely-wrong' } });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).not.toBe(200);
  });

  test('未携带 token 访问受保护接口返回 401', async ({ anonymous }) => {
    const res = await anonymous.get('/api/orders');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe(401);
  });

  test('登录后可获取当前用户信息', async ({ staff }) => {
    const res = await staff.get('/api/auth/info');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.username).toBe('staff01');
    expect(body.data.role).toBe('staff');
  });
});
