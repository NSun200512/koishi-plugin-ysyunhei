//填入api key
export default interface Config {
  api_key:string
  // 管理员 QQ 到登记人昵称的映射
  admin_qqs: Record<string, string>
  // 精致睡眠开始小时（北京时间，0-23）
  sleep_start_hour?: number
  // 精致睡眠结束小时（北京时间，0-23）
  sleep_end_hour?: number
  // 精致睡眠禁言时长（小时）
  sleep_mute_hours?: number
  // 是否将主要文本输出渲染为图片（推荐安装 @koishijs/plugin-puppeteer；无法使用时会自动回落为文本）
  render_as_image?: boolean
  // 图片渲染服务偏好：auto（默认，优先 puppeteer，失败回退 canvas）、puppeteer、canvas
  render_service_preference?: 'auto' | 'puppeteer' | 'canvas'
  // 浏览器路径配置
  browser_path: string
  // 主题自动切换时间
  theme_date?: string

  theme_color?: string
}
