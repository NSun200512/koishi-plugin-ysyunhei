import type { Session } from 'koishi'

// 简单的每用户-每指令冷却（单位：毫秒）
const COOLDOWN_MS = 30_000

const lastInvoke = new Map<string, number>()
export default function checkAndSetCooldown(meta: Session, cmd: string): string | null {
  try {
    const user = meta?.userId || 'unknown'
    const key = `${user}:${cmd}`
    const now = Date.now()
    const last = lastInvoke.get(key) || 0
    const diff = now - last
    if (diff < COOLDOWN_MS) {
      const remain = Math.ceil((COOLDOWN_MS - diff) / 1000)
      return `操作过于频繁（${cmd}），请在${remain}秒后再试。`
    }
    lastInvoke.set(key, now)
    return null
  } catch {
    return null
  }
}
