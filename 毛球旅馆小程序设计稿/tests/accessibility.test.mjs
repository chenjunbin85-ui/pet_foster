import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8")
const token = (name) => {
  const value = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1]
  assert.ok(value, `Missing CSS token ${name}`)
  return value
}
function luminance(hex) {
  const values = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
}
function contrast(a, b) {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

test("正文、橙字与关键状态文字达到AA小字对比度", () => {
  const combinations = [
    ["ink", "#ffffff"],
    ["muted", "#ffffff"],
    ["primary", "#ffffff"],
    ["primary", "#fff3ea"],
    ["green", "#e7f7ee"],
    ["blue", "#eaf2ff"],
    ["danger", "#ffffff"],
    ["muted", "#f7f8fa"],
  ]
  for (const [name, background] of combinations) {
    const ratio = contrast(token(name), background)
    assert.ok(
      ratio >= 4.5,
      `${name} on ${background}: ${ratio.toFixed(2)} < 4.5`,
    )
  }
})

test("主按钮采用指定600色，并使用大号加粗白字满足3:1门槛", () => {
  assert.equal(token("button"), "#d9480f")
  assert.ok(contrast(token("button"), "#ffffff") >= 3)
  assert.match(
    css,
    /\.button:not\(\.secondary\):not\(\.danger\)\s*\{\s*font-size:\s*19px;\s*font-weight:\s*600;/,
  )
})

test("焦点轮廓有足够对比度，装饰橙与正文橙分离", () => {
  assert.ok(contrast(token("primary"), "#ffffff") >= 3)
  assert.equal(token("accent"), "#ff7f3f")
  assert.equal(token("primary"), "#c2410c")
  assert.match(
    css,
    /:focus-visible\s*\{\s*outline:\s*2px solid var\(--primary\)/,
  )
})
