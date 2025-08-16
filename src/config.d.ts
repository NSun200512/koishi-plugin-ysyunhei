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
  browser_path?: string
  // 主题自动切换（浅色主题）开始小时（本地时间，0-23）
  theme_start_hour?: number
  // 主题自动切换（浅色主题）结束小时（本地时间，0-23）
  theme_end_hour?: number
  // 浅色主题背景色
  theme_light_color?: string
  // 深色主题背景色
  theme_dark_color?: string
  // 日志级别阈值
  log_level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  // 调试日志级别：0 关闭，1 基本，2 详细，3 最详细
  debug_level?: number
}
