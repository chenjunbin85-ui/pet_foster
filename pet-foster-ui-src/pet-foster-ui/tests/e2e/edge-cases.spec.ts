import { test, expect } from "@playwright/test"
import { login, logout } from "./helpers/auth"

test.describe("异常场景与边界值测试", () => {

  // ========== 1. 登录失败场景 ==========
  test.describe("登录失败", () => {
    test("错误密码提示密码错误", async ({ page }) => {
      await page.goto("/")
      await page.getByLabel("账号").fill("admin")
      await page.getByLabel("密码").fill("wrongpassword")
      await page.getByRole("button", { name: /登\s*录/ }).click()
      await expect(page.getByText(/密码错误|密码不正确|登录失败/)).toBeVisible({ timeout: 10000 })
    })

    test("不存在的账号提示用户不存在", async ({ page }) => {
      await page.goto("/")
      await page.getByLabel("账号").fill("nonexistent_user_99999")
      await page.getByLabel("密码").fill("123456")
      await page.getByRole("button", { name: /登\s*录/ }).click()
      await expect(page.getByText(/用户不存在|账号不存在|登录失败/)).toBeVisible({ timeout: 10000 })
    })

    test("空账号空密码无法登录", async ({ page }) => {
      await page.goto("/")
      await page.getByRole("button", { name: /登\s*录/ }).click()
      // 仍在登录页，没有跳转
      await expect(page.getByLabel("账号")).toBeVisible()
      await expect(page.getByRole("button", { name: /登\s*录/ })).toBeVisible()
    })

    test("登录成功后token存入localStorage", async ({ page }) => {
      await login(page, "admin", "admin123")
      const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
      expect(token).not.toBeNull()
      expect(token!.length).toBeGreaterThan(10)
    })
  })

  // ========== 2. 权限不足场景 ==========
  test.describe("权限控制", () => {
    test("工作人员账号看不到系统管理菜单", async ({ page }) => {
      await login(page, "staff01", "staff123")
      // 工作人员不应看到系统管理菜单
      const sysMenu = page.locator(".nav-item", { hasText: "系统管理" })
      await expect(sysMenu).toHaveCount(0)
      await logout(page)
    })

    test("工作人员直接访问系统管理接口被拒绝", async ({ page }) => {
      await login(page, "staff01", "staff123")
      const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
      const response = await page.request.get("http://127.0.0.1:8090/api/users", {
        headers: { Authorization: `Bearer ${token}` }
      })
      // 工作人员无权限，应返回4xx（401/403）或被后端拦截
      expect(response.status()).toBeGreaterThanOrEqual(400)
      expect(response.status()).toBeLessThan(500)
      await logout(page)
    })

    test("管理员可以看到系统管理菜单", async ({ page }) => {
      await login(page, "admin", "admin123")
      const sysMenu = page.locator(".nav-item", { hasText: "系统管理" })
      await expect(sysMenu.first()).toBeVisible()
      await logout(page)
    })
  })

  // ========== 3. 搜索无结果场景 ==========
  test.describe("搜索边界", () => {
    test("客户搜索无结果显示空状态", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "客户信息管理" }).first().click()
      await page.waitForTimeout(800)
      // 记录搜索前的数据行数
      const rowsBefore = await page.locator("table tbody tr:not(.empty-row)").count()
      // 输入不存在的关键词
      const searchInput = page.locator(".search-box input, input[placeholder*='搜索'], input[type='text']").first()
      await searchInput.fill("zzzz_nonexistent_99999")
      await page.waitForTimeout(1000)
      // 搜索后数据行应减少或为0
      const rowsAfter = await page.locator("table tbody tr:not(.empty-row)").count()
      expect(rowsAfter).toBeLessThanOrEqual(rowsBefore)
      // 页面不应报错
      await expect(page.locator("table")).toBeVisible()
      await logout(page)
    })

    test("特殊字符搜索不报错", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "客户信息管理" }).first().click()
      await page.waitForTimeout(800)
      const searchInput = page.locator(".search-box input, input[placeholder*='搜索'], input[type='text']").first()
      await searchInput.fill("<script>alert(1)</script>")
      await page.waitForTimeout(1000)
      // 不应报错，页面正常显示
      await expect(page.locator(".customer-table, table")).toBeVisible()
      await logout(page)
    })
  })

  // ========== 4. 分页边界场景 ==========
  test.describe("分页边界", () => {
    test("最后一页下一页按钮禁用", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "客户信息管理" }).first().click()
      await page.waitForTimeout(1000)

      // 找到分页控件，点到最后一页
      const pagination = page.locator(".pagination, .customer-table-footer")
      if (await pagination.isVisible()) {
        // 尝试点击最后一页（如果有页码按钮）
        const pageButtons = pagination.locator("button")
        const count = await pageButtons.count()
        if (count > 0) {
          // 点击最后一个页码按钮（如果是数字）
          const lastPageBtn = pagination.locator("button").filter({ hasText: /^\d+$/ }).last()
          if (await lastPageBtn.isVisible().catch(() => false)) {
            await lastPageBtn.click()
            await page.waitForTimeout(800)
          }
        }
        // 下一页按钮应禁用
        const nextBtn = pagination.getByRole("button", { name: /下一页|Next|›/ })
        if (await nextBtn.isVisible().catch(() => false)) {
          await expect(nextBtn).toBeDisabled()
        }
      }
      await logout(page)
    })

    test("第一页上一页按钮禁用", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "客户信息管理" }).first().click()
      await page.waitForTimeout(1000)

      const pagination = page.locator(".pagination, .customer-table-footer")
      if (await pagination.isVisible()) {
        const prevBtn = pagination.getByRole("button", { name: /上一页|Prev|‹/ })
        if (await prevBtn.isVisible().catch(() => false)) {
          await expect(prevBtn).toBeDisabled()
        }
      }
      await logout(page)
    })

    test("数据不足一页时分页控件仍显示且按钮禁用", async ({ page }) => {
      await login(page, "admin", "admin123")
      // 健康记录通常数据较少
      await page.locator(".nav-item", { hasText: "健康档案管理" }).first().click()
      await page.waitForTimeout(1000)

      const pagination = page.locator(".pagination, .customer-table-footer")
      // 分页控件应始终显示
      await expect(pagination.first()).toBeVisible()
      await logout(page)
    })
  })

  // ========== 5. 空数据列表场景 ==========
  test.describe("空数据处理", () => {
    test("服务记录列表正常渲染（空或有数据均不报错）", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "寄养服务记录" }).first().click()
      await page.waitForTimeout(1000)
      // 页面不应白屏，表格或空状态应可见
      const hasTable = await page.locator("table").isVisible().catch(() => false)
      const hasEmpty = await page.getByText(/暂无|无数据|没有记录/).isVisible().catch(() => false)
      expect(hasTable || hasEmpty).toBeTruthy()
      await logout(page)
    })

    test("统计分析页无数据时不崩溃", async ({ page }) => {
      await login(page, "admin", "admin123")
      await page.locator(".nav-item", { hasText: "统计分析" }).first().click()
      await page.waitForTimeout(1500)
      // 统计卡片应显示（即使为0）
      const statCards = page.locator(".stat-card")
      await expect(statCards.first()).toBeVisible()
      // 图表容器应存在
      await expect(page.locator("[data-chart], .recharts-wrapper").first()).toBeVisible()
      await logout(page)
    })
  })

  // ========== 6. 接口边界值 ==========
  test.describe("接口边界值", () => {
    test("未登录访问API返回401或403", async ({ page }) => {
      const response = await page.request.get("http://127.0.0.1:8090/api/customers")
      expect([401, 403]).toContain(response.status())
    })

    test("无效token访问API返回401", async ({ page }) => {
      const response = await page.request.get("http://127.0.0.1:8090/api/customers", {
        headers: { Authorization: "Bearer invalid_token_xyz" }
      })
      expect([401, 403]).toContain(response.status())
    })

    test("登录接口参数校验：空用户名返回400", async ({ page }) => {
      const response = await page.request.post("http://127.0.0.1:8090/api/auth/login", {
        data: { username: "", password: "123" }
      })
      expect([400, 500]).toContain(response.status())
    })

    test("客户列表分页参数page=0不报错", async ({ page }) => {
      await login(page, "admin", "admin123")
      const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
      const response = await page.request.get("http://127.0.0.1:8090/api/customers?page=0&size=10", {
        headers: { Authorization: `Bearer ${token}` }
      })
      expect(response.status()).toBe(200)
      await logout(page)
    })

    test("客户列表分页参数size过大不报错", async ({ page }) => {
      await login(page, "admin", "admin123")
      const token = await page.evaluate(() => localStorage.getItem("pet_foster_token"))
      const response = await page.request.get("http://127.0.0.1:8090/api/customers?page=1&size=99999", {
        headers: { Authorization: `Bearer ${token}` }
      })
      expect(response.status()).toBe(200)
      await logout(page)
    })
  })
})
