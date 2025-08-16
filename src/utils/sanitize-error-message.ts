import type Config from "../config"

/**
 * 错误信息脱敏，避免 api_key 等敏感信息泄露
 * @param err 错误对象或消息
 * @param config 配置对象（可选）
 * @returns string
 */
export default function sanitizeErrorMessage(err: any, config?: Config): string {
  try {
    let msg = (err && typeof err === 'object' && 'message' in err) ? String((err as any).message) : String(err ?? '')
    if (!msg) return '未知错误'
    // 隐去 query 中的 api_key
    msg = msg.replace(/api_key=[^&\s"']+/gi, 'api_key=[REDACTED]')
    // 隐去明文出现在消息中的 api_key 本体
    if (config?.api_key) {
      const key = config.api_key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      msg = msg.replace(new RegExp(key, 'g'), '[REDACTED]')
    }
    return msg
  } catch {
    return '未知错误'
  }
}
