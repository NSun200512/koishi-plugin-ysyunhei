import https from 'https'

import sanitizeErrorMessage from './sanitize-error-message'

/**
 * 检查官网可用性（优先 HEAD，若不支持则回退 GET）
 * @param url 要检查的 URL
 * @returns Promise<{ ok: boolean; status?: number; error?: string }>
 */
export default async function checkWebsiteStatus(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  function requestStatus(method: 'HEAD' | 'GET', url: string, timeout = 8000): Promise<number> {
    return new Promise((resolve, reject) => {
      const req = https.request(url, { method }, (res) => {
        const code = res.statusCode || 0
        // 消耗并丢弃响应体，尽快结束连接
        res.resume()
        resolve(code)
      })
      req.on('error', reject)
      req.setTimeout(timeout, () => {
        req.destroy(new Error('timeout'))
      })
      req.end()
    })
  }
  try {
    let status = await requestStatus('HEAD', url)
    if (status === 405 || status === 0) {
      // 不支持 HEAD 或未知，回退 GET
      status = await requestStatus('GET', url)
    }
    return { ok: status >= 200 && status < 300, status }
  } catch (err) {
    return { ok: false, error: sanitizeErrorMessage(err) }
  }
}
