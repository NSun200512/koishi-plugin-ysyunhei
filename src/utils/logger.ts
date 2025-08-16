import type { Context } from 'koishi'
import type Config from '../config'

type LevelName = 'debug' | 'info' | 'warn' | 'error' | 'fatal'
const ORDER: Record<LevelName, number> = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 }

function resolveThreshold(config: Config): LevelName {
  const lv = (config as any).log_level as LevelName | undefined
  if (lv && ORDER[lv]) return lv
  // 兼容旧的 debug_level 数字：0-3 分别映射到 info 阶梯之前
  const n = (config as any).debug_level
  if (typeof n === 'number') {
    // 0: 关闭(仅 warn+), 1: 基本(debug), 2: 详细(info), 3: 最详细(debug)
    if (n <= 0) return 'warn'
    if (n === 1) return 'debug'
    if (n === 2) return 'info'
    return 'debug'
  }
  return 'info'
}

export function getLogger(ctx: Context, config: Config) {
  const base = (ctx as any).logger?.('ysyunhei') ?? console
  const threshold = ORDER[resolveThreshold(config)]
  const allow = (lv: LevelName) => ORDER[lv] >= threshold

  return {
    debug: (...args: any[]) => {
      if (allow('debug')) (base.debug?.(...args) ?? console.log(...args))
    },
    info: (...args: any[]) => {
      if (allow('info')) (base.info?.(...args) ?? console.log(...args))
    },
    warn: (...args: any[]) => {
      if (allow('warn')) (base.warn?.(...args) ?? console.warn(...args))
    },
    error: (...args: any[]) => {
      if (allow('error')) (base.error?.(...args) ?? console.error(...args))
    },
    fatal: (...args: any[]) => {
      if (allow('fatal')) ((base.error ?? console.error).apply(null, args))
    },
  }
}
