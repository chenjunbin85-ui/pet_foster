import { test as base, expect, APIRequestContext } from '@playwright/test';

export interface ApiFixtures {
  /** 管理员（老板/运营层）登录后的 request context */
  admin: APIRequestContext;
  /** 工作人员（执行层）登录后的 request context */
  staff: APIRequestContext;
  /** 未登录的裸 request context */
  anonymous: APIRequestContext;
}

const API_BASE_URL = 'http://localhost:8090';

/** 登录并返回 JWT token */
export async function login(request: APIRequestContext, username: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status(), '登录接口应返回 200').toBe(200);
  const body = await res.json();
  expect(body.code, '登录响应 code 应为 200').toBe(200);
  expect(body.data.token, '登录应返回 token').toBeTruthy();
  return body.data.token as string;
}

/** 创建携带 Bearer token 的独立 APIRequestContext */
async function authedContext(playwright: any, token: string): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

export const test = base.extend<ApiFixtures>({
  admin: async ({ request, playwright }, use) => {
    const token = await login(request, 'admin', 'admin123');
    const ctx = await authedContext(playwright, token);
    await use(ctx);
    await ctx.dispose();
  },
  staff: async ({ request, playwright }, use) => {
    const token = await login(request, 'staff01', 'staff123');
    const ctx = await authedContext(playwright, token);
    await use(ctx);
    await ctx.dispose();
  },
  anonymous: async ({ request }, use) => {
    await use(request);
  },
});

export { expect };
