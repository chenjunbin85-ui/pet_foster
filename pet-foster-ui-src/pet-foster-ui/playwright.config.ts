import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:8090",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5173" },
    },
    {
      // 接口测试：不启动浏览器，直接通过 request fixture 调用后端
      name: "api",
      testDir: "./tests/api",
      use: { baseURL: "http://localhost:8090" },
    },
  ],
})
