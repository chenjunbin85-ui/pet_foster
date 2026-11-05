// @ts-check
const { defineConfig } = require('@playwright/test')

/**
 * 毛球旅馆 · Playwright 测试配置
 * - ui  project：用户端单端测试（设计稿 React 高保真原型，vite dev :8443，模拟手机视口）
 * - api project：多端联调测试（真实后端 8090 + MySQL 落库断言，模拟小程序用户端 API 调用）
 */
module.exports = defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // 用户端单端测试：设计稿原型（纯前端 mock，不依赖后端）
      name: 'ui',
      testDir: './tests/ui',
      use: {
        baseURL: 'http://127.0.0.1:8443',
        browserName: 'chromium',
        channel: 'msedge', // 复用系统 Edge（无需下载浏览器）；如改用 chromium 删掉本行
        viewport: { width: 390, height: 844 }, // 手机竖屏视口，贴近小程序
        deviceScaleFactor: 2,
      },
      webServer: {
        command: 'npm run dev',
        cwd: 'C:\\Users\\chen\\Desktop\\毕业设计\\pet-foster\\毛球旅馆小程序设计稿',
        url: 'http://127.0.0.1:8443',
        reuseExistingServer: true,
        timeout: 120_000,
      },
    },
    {
      // 多端联调测试：真实后端 REST API（模拟小程序用户端调用）+ MySQL 落库断言
      name: 'api',
      testDir: './tests/api',
      use: {
        baseURL: 'http://127.0.0.1:8090',
        extraHTTPHeaders: { Accept: 'application/json' },
      },
    },
  ],
})
