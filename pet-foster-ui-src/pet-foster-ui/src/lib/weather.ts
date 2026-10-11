// 天气服务 —— 定位（GPS 优先，IP 兜底）+ 和风天气实时天气
//
// 和风天气接入要点（均经 curl 实测确认，非按文档猜测）：
//   · API Host 是「每个开发者账号独立」的，本项目的 Host 见下方 QWEATHER_HOST。
//   · 鉴权用请求头 `X-QW-Api-Key: <key>`；
//     ⚠️ 不要用 `Authorization: Bearer <key>` —— 那样会返回 401
//        （Bearer 是给 JWT 凭据用的，API KEY 必须走 X-QW-Api-Key）。
//   · 实时天气：GET {host}/weather/v1/current/{lat}/{lon}?lang=zh
//   · 城市名反查：GET {host}/geo/v2/city/lookup?location={lon},{lat}&lang=zh
//   · 湿度是 0~1 的小数（不是百分数）；风速单位 m/s（界面按 km/h 展示）

export type WeatherSource = "gps" | "ip"

export interface WeatherInfo {
  /** 摄氏度 */
  temperature: number
  /** 体感温度 */
  feelsLike: number
  /** 中文天气描述，如「晴」「多云」 */
  text: string
  /** 相对湿度 % */
  humidity: number
  /** 风速 km/h */
  windSpeed: number
  /** 是否为白天（决定用太阳还是月亮图标） */
  isDay: boolean
  /** 定位到的城市名，如「泉州市」 */
  city: string
  /** 定位来源，便于界面上区分「精确定位 / 大致定位」 */
  source: WeatherSource
}

interface Coordinates {
  latitude: number
  longitude: number
  city: string
  source: WeatherSource
}

// ===== 和风天气配置 =====
// Host 与 Key 均为开发者账号专属。Key 属于客户端公开凭据（纯前端直连必须暴露），
// 其安全性依赖「Host + Key 配对」——只泄露 Key 而不知道 Host 无法调用。
const QWEATHER_HOST = "pr3yfuur7u.re.qweatherapi.com"
const QWEATHER_KEY = "ecab3ff9f51f4890b14202f685211693"

const qweatherHeaders = { "X-QW-Api-Key": QWEATHER_KEY }

/** 带超时的 fetch —— 避免定位/天气接口卡住整个面板 */
function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/** 通过坐标反查城市名（和风 GeoAPI）。失败返回空串 —— 城市名缺失不应让整个面板失败 */
async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const res = await fetchWithTimeout(
      `https://${QWEATHER_HOST}/geo/v2/city/lookup?location=${longitude.toFixed(2)},${latitude.toFixed(2)}&lang=zh`,
      { headers: qweatherHeaders },
      6000
    )
    if (!res.ok) return ""
    const data = (await res.json()) as {
      code?: string
      location?: Array<{ name?: string; adm2?: string }>
    }
    if (data.code !== "200" || !data.location?.length) return ""
    const loc = data.location[0]
    // 优先「上级行政区」（泉州），避免只显示区县（丰泽）
    return loc.adm2 || loc.name || ""
  } catch {
    return ""
  }
}

/**
 * 通过 IP 反查所在城市与坐标。
 * 先用 ip-api.com（中文、仅 HTTP），失败再用 ipwho.is（HTTPS、英文）兜底，
 * 保证在 http 与 https 两种部署下都可用。
 */
async function locateByIP(): Promise<Coordinates> {
  // 主：ip-api.com —— 支持中文城市名
  try {
    const res = await fetchWithTimeout(
      "http://ip-api.com/json/?lang=zh-CN&fields=status,country,regionName,city,lat,lon"
    )
    const data = (await res.json()) as {
      status?: string
      regionName?: string
      city?: string
      lat?: number
      lon?: number
    }
    if (data.status === "success" && typeof data.lat === "number" && typeof data.lon === "number") {
      return {
        latitude: data.lat,
        longitude: data.lon,
        city: data.city || data.regionName || "未知位置",
        source: "ip",
      }
    }
  } catch {
    // 落到备选
  }

  // 备：ipwho.is —— HTTPS，字段为英文
  const res = await fetchWithTimeout("https://ipwho.is/")
  const data = (await res.json()) as {
    success?: boolean
    city?: string
    region?: string
    latitude?: number
    longitude?: number
  }
  if (data.success && typeof data.latitude === "number" && typeof data.longitude === "number") {
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city || data.region || "未知位置",
      source: "ip",
    }
  }
  throw new Error("无法通过 IP 定位")
}

/**
 * 获取定位：优先 GPS 精确定位，失败/拒绝/超时时自动降级到 IP 大致定位。
 * 无论哪条路径最终失败都会抛出错误，由调用方决定如何展示。
 */
export function getLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      locateByIP().then(resolve).catch(reject)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        // GPS 只给坐标 → 反查城市名；反查失败也不影响天气本身
        const city = await reverseGeocode(latitude, longitude)
        resolve({ latitude, longitude, city, source: "gps" })
      },
      () => {
        // 用户拒绝授权 / 定位不可用 / 超时 —— 一律降级到 IP
        locateByIP().then(resolve).catch(reject)
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
    )
  })
}

/** 根据坐标拉取和风实时天气 */
export async function fetchWeather(coords: Coordinates): Promise<WeatherInfo> {
  const lat = coords.latitude.toFixed(2)
  const lon = coords.longitude.toFixed(2)
  const res = await fetchWithTimeout(
    `https://${QWEATHER_HOST}/weather/v1/current/${lat}/${lon}?lang=zh`,
    { headers: qweatherHeaders }
  )
  if (!res.ok) throw new Error(`天气服务返回 ${res.status}`)

  const data = (await res.json()) as {
    condition?: { text?: string; code?: string }
    temperature?: { value?: number }
    feelsLike?: { value?: number }
    humidity?: number
    wind?: { speed?: { value?: number } }
  }
  if (typeof data.temperature?.value !== "number") throw new Error("天气数据格式异常")

  const code = Number(data.condition?.code ?? "0")
  const temperature = data.temperature.value

  return {
    temperature: Math.round(temperature),
    feelsLike: Math.round(data.feelsLike?.value ?? temperature),
    text: data.condition?.text ?? "未知",
    humidity: Math.round((data.humidity ?? 0) * 100), // 和风返回 0~1 小数
    windSpeed: Math.round((data.wind?.speed?.value ?? 0) * 3.6), // m/s → km/h
    isDay: isDaytime(code),
    city: coords.city,
    source: coords.source,
  }
}

/**
 * 判断白天/夜间，仅用于选图标（判错也只是换张图，不影响数据）。
 * 和风图标码末位区分昼夜：常用码 100(晴)/101(多云)/102(少云)/103(晴间多云) 为白天，104 为夜间。
 */
function isDaytime(code: number): boolean {
  if (code === 100 || code === 101 || code === 102 || code === 103) return true
  if (code === 104) return false
  const h = new Date().getHours()
  return h >= 6 && h < 18
}

/** 一步到位：定位 + 取天气 */
export async function loadWeather(): Promise<WeatherInfo> {
  const coords = await getLocation()
  try {
    return await fetchWeather(coords)
  } catch (err) {
    // GPS 拿到坐标但天气请求失败时，再退回 IP 定位重试一次（排除定位点本身不可用的情况）
    if (coords.source === "gps") {
      const fallback = await locateByIP()
      return await fetchWeather(fallback)
    }
    throw err
  }
}
