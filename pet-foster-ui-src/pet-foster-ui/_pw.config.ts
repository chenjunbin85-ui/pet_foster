import { defineConfig, devices } from "@playwright/test"
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "off",
    screenshot: "only-on-failure",
    launchOptions: { args: ["--no-proxy-server"] },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
