/**
 * 护宠宝 · 微信云托管反向代理
 *
 * 作用：让小程序通过 wx.cloud.callContainer 走微信内网专线访问现有 Render 后端，
 *       从而绕开「境外域名未 ICP 备案 → 体验版/正式版服务器域名校验失败」的问题。
 *       后端 Spring Boot、TiDB Cloud、Web 端均不改动。
 *
 * 环境变量（云托管控制台「服务设置 - 环境变量」中配置）：
 *   UPSTREAM_ORIGIN  上游后端，默认 https://pet-foster-server.onrender.com
 *   PORT             监听端口，云托管平台注入，默认 80（控制台填的端口必须与之一致）
 *   PREHEAT_MS       Render 预热间隔，默认 600000（10 分钟）
 *
 * 官方约束备忘：
 *   - callContainer 超时上限 15s，故转发超时设 12s 留余量
 *   - 返回包上限 1000KiB，本代理不缓存、不截断
 *   - 不开启公网入站不影响容器向外访问公网，因此可直连 Render / TiDB
 */
const http = require('http')

const UPSTREAM = (process.env.UPSTREAM_ORIGIN || 'https://pet-foster-server.onrender.com').replace(/\/$/, '')
const PORT = Number(process.env.PORT || 80)
const PREHEAT_MS = Number(process.env.PREHEAT_MS || 10 * 60 * 1000)
const UPSTREAM_TIMEOUT_MS = 12000
const MAX_BODY_BYTES = 24 * 1024 * 1024

/** Render 免费实例闲置会休眠（冷启动 50s+），定时预热保证 callContainer 15s 内返回 */
async function preheat() {
  try {
    const res = await fetch(UPSTREAM + '/health', { signal: AbortSignal.timeout(8000) })
    console.log('[preheat] upstream /health ->', res.status)
  } catch (err) {
    console.warn('[preheat] failed:', err.message)
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

/** callContainer 不支持 multipart：把 base64 JSON 转成后端 /api/files/upload 需要的 multipart */
function buildMultipart(payload) {
  const { file, filename, contentType } = payload
  if (typeof file !== 'string' || !file) throw new Error('missing base64 file')
  const safeName = String(filename || 'photo.jpg').replace(/["\r\n]/g, '_')
  const type = String(contentType || 'image/jpeg').replace(/["\r\n]/g, '')
  const boundary = '----pfcloudrun' + Date.now().toString(36)
  const head = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${safeName}"\r\n` +
    `Content-Type: ${type}\r\n\r\n`
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    body: Buffer.concat([head, Buffer.from(file, 'base64'), tail]),
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

/** 过滤微信链路注入的头与 hop-by-hop 头，避免污染上游请求 */
function forwardHeaders(req) {
  const skip = new Set([
    'host', 'connection', 'content-length', 'transfer-encoding',
    'x-wx-service', 'x-wx-source', 'x-wx-openid', 'x-wx-unionid',
    'x-wx-appid', 'x-wx-from', 'x-forwarded-for', 'x-forwarded-proto'
  ])
  const out = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (!skip.has(key) && value !== undefined) out[key] = value
  }
  return out
}

const server = http.createServer(async (req, res) => {
  const incoming = new URL(req.url, 'http://localhost')

  if (incoming.pathname === '/__health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'UP', upstream: UPSTREAM }))
    return
  }

  let pathname = incoming.pathname
  let body
  const headers = forwardHeaders(req)

  try {
    const raw = await readBody(req)

    if (pathname === '/__upload' && req.method === 'POST') {
      const payload = JSON.parse(raw.toString('utf8') || '{}')
      const multipart = buildMultipart(payload)
      body = multipart.body
      headers['content-type'] = multipart.contentType
      pathname = '/api/files/upload'
    } else {
      body = raw.length ? raw : undefined
    }

    const target = UPSTREAM + pathname + incoming.search
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
    })

    const buf = Buffer.from(await upstream.arrayBuffer())
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8'
    res.writeHead(upstream.status, { 'Content-Type': contentType })
    res.end(buf)
    console.log(req.method, pathname, '->', upstream.status, buf.length, 'bytes')
  } catch (err) {
    console.error('[proxy]', req.method, pathname, err.message)
    const status = err.message === 'request body too large' ? 413 : 502
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ code: 502, message: '云托管代理转发失败: ' + err.message, data: null }))
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log('[proxy] listening on 0.0.0.0:' + PORT + ' -> ' + UPSTREAM)
  preheat()
  if (PREHEAT_MS > 0) {
    const timer = setInterval(preheat, PREHEAT_MS)
    if (typeof timer.unref === 'function') timer.unref()
  }
})
