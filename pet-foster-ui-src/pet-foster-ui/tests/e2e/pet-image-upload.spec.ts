import { test, expect } from "@playwright/test"
import { login, navigateTo } from "./helpers/auth"

// 与后端魔术字节校验一致的最小 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
)
const API = "http://127.0.0.1:8090"

function uniqueName(prefix: string) {
  return `${prefix}${String(Date.now()).slice(-6)}`
}

async function tokenOf(page: import("@playwright/test").Page) {
  return (await page.evaluate(() => localStorage.getItem("pet_foster_token"))) as string
}

/** 通过接口清理用例自建的宠物档案，避免污染演示数据 */
async function deletePet(page: import("@playwright/test").Page, name: string) {
  try {
    const token = await tokenOf(page)
    const res = await page.request.get(`${API}/api/pets?page=1&size=20&name=${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    const pet = body.data?.records?.find((p: { name: string }) => p.name === name)
    if (pet) {
      await page.request.delete(`${API}/api/pets/${pet.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  } catch {
    // 清理失败不影响用例结论
  }
}

test.describe("宠物档案图片上传", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, "13800138012", "123456")
    await navigateTo(page, "宠物档案管理")
  })

  test("新增宠物时上传头像：预览 → 保存 → 列表与详情均可见", async ({ page }) => {
    const name = uniqueName("头像上传")
    let created = false
    try {
      await page.getByRole("button", { name: /新增宠物档案/ }).click()
      const dialog = page.getByRole("dialog")
      await expect(dialog).toBeVisible()

      await dialog.getByLabel("宠物名").fill(name)
      await dialog.getByLabel("所属主人").selectOption({ index: 1 })
      await dialog.getByLabel("品种").fill("布偶猫")
      await dialog.getByLabel("年龄（岁）").fill("2")
      await dialog.getByLabel("体重（千克）").fill("3.6")

      // 上传头像：选择 → 上传 → 组件内即时预览
      await dialog.getByLabel("上传宠物头像").setInputFiles({
        name: "avatar.png",
        mimeType: "image/png",
        buffer: PNG,
      })
      const preview = dialog.getByRole("img", { name: "上传宠物头像预览" })
      await expect(preview).toBeVisible()
      await expect(preview).toHaveAttribute("src", /\/api\/files\/[a-f0-9]{32}\.png$/)

      await dialog.getByRole("button", { name: "保存档案" }).click()
      await expect(dialog).toBeHidden()
      await expect(page.getByText("宠物档案已新增。").first()).toBeVisible()
      created = true

      // 列表行内头像实际加载成功（不是仅地址正确）
      const row = page.locator("table tbody tr", { hasText: name })
      const avatar = row.getByRole("img", { name: `${name}头像` })
      await expect(avatar).toBeVisible()
      await expect
        .poll(async () => avatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true)

      // 刷新后仍从服务端回显
      await page.reload()
      await navigateTo(page, "宠物档案管理")
      await expect(page.locator("table tbody tr", { hasText: name }).getByRole("img", { name: `${name}头像` })).toBeVisible()

      // 详情弹窗展示头像
      await row.getByRole("button", { name: `查看${name}` }).click()
      await expect(page.getByRole("dialog").getByRole("img", { name: `${name}头像` })).toBeVisible()
    } finally {
      if (created) await deletePet(page, name)
    }
  })

  test("上传非图片文件时给出可读错误，不发起上传", async ({ page }) => {
    await page.getByRole("button", { name: /新增宠物档案/ }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("上传宠物头像").setInputFiles({
      name: "virus.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    })
    await expect(dialog.getByRole("alert")).toContainText("仅支持 jpg / png 格式图片")
    await expect(dialog.getByRole("img", { name: "上传宠物头像预览" })).toHaveCount(0)
    await dialog.getByRole("button", { name: "取消" }).click()
  })

  test("超过 2MB 的图片在客户端被拦下", async ({ page }) => {
    await page.getByRole("button", { name: /新增宠物档案/ }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("上传宠物头像").setInputFiles({
      name: "big.png",
      mimeType: "image/png",
      buffer: Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]),
    })
    await expect(dialog.getByRole("alert")).toContainText("单张图片不能超过 2MB")
    await dialog.getByRole("button", { name: "取消" }).click()
  })

  test("编辑档案可更换头像，保存后新图生效", async ({ page }) => {
    const name = uniqueName("更换头像")
    const token = await tokenOf(page)

    // 先通过接口建一份带旧头像的档案（同一份演示数据不手改）
    const oldUpload = await page.request.post(`${API}/api/files/upload`, {
      headers: { Authorization: `Bearer ${token}` },
      multipart: { file: { name: "old.png", mimeType: "image/png", buffer: PNG } },
    })
    const oldUrl = (await oldUpload.json()).data.url as string
    const owners = (await (await page.request.get(`${API}/api/customers?page=1&size=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()).data.records
    const created = await page.request.post(`${API}/api/pets`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { customerId: owners[0].id, name, breed: "金毛", gender: "公", age: 3, weight: 28, photoUrl: oldUrl },
    })
    expect(created.status()).toBe(200)

    try {
      await page.reload()
      await navigateTo(page, "宠物档案管理")
      await page.locator("table tbody tr", { hasText: name }).getByRole("button", { name: `编辑${name}` }).click()

      const dialog = page.getByRole("dialog")
      const preview = dialog.getByRole("img", { name: "上传宠物头像预览" })
      await expect(preview).toBeVisible()
      const oldSrc = await preview.getAttribute("src")
      await dialog.getByLabel("上传宠物头像").setInputFiles({
        name: "new.png",
        mimeType: "image/png",
        buffer: PNG,
      })
      // 上传是异步的：等 src 真正变化，而不是只匹配地址格式
      await expect(preview).not.toHaveAttribute("src", oldSrc!)
      const newSrc = await preview.getAttribute("src")
      expect(newSrc).toMatch(/\/api\/files\/[a-f0-9]{32}\.png$/)
      expect(newSrc).not.toBe(oldSrc)

      await dialog.getByRole("button", { name: "保存档案" }).click()
      await expect(dialog).toBeHidden()

      const rowAvatar = page.locator("table tbody tr", { hasText: name }).getByRole("img", { name: `${name}头像` })
      await expect(rowAvatar).toHaveAttribute("src", newSrc!)
      await expect
        .poll(async () => rowAvatar.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true)
    } finally {
      await deletePet(page, name)
    }
  })
})
