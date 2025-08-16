import type { Session } from "koishi"

/**
 * 轻量防抖：仅用于 yunhei.sleepwell 的 confirm 分支，避免短时间重复执行禁言
 */
const SLEEPWELL_CONFIRM_DEBOUNCE_MS = 2000
const lastSleepwellConfirm = new Map<string, number>()
export default function hitSleepwellDebounce(session: Session): boolean {
  try {
    const key = `${session.guildId || 'pm'}:${session.userId}`
    const now = Date.now()
    const last = lastSleepwellConfirm.get(key) || 0
    if (now - last < SLEEPWELL_CONFIRM_DEBOUNCE_MS) return true
    lastSleepwellConfirm.set(key, now)
    return false
  } catch {
    return false
  }
}
