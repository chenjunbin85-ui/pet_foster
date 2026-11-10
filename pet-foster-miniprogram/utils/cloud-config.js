/**
 * 微信云托管接入配置（单一事实源）
 *
 * 使用：在云托管控制台建好环境后，把 CLOUD_ENV 填成环境 ID（形如 prod-01-xxxx），
 *       enabled 会自动变为 true，全站请求改走 wx.cloud.callContainer 微信内网专线。
 *       留空则保持原 wx.request 直连 Render（本地开发 / 旧版回退）。
 *
 * CLOUD_SERVICE 必须与云托管控制台里「服务名称」完全一致，
 * callContainer 靠 header 里的 X-WX-SERVICE 做服务路由。
 */
const CLOUD_ENV = 'pet-foster-proxy-d3enpmw10e73b02'
const CLOUD_SERVICE = 'pet-foster-proxy'

module.exports = {
  env: CLOUD_ENV,
  service: CLOUD_SERVICE,
  enabled: !!CLOUD_ENV
}
