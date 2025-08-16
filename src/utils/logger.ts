import type { Context } from 'koishi'
import type Config from '../config'

export type DebugLevel = 0 | 1 | 2 | 3

export function getLogger(ctx: Context, config: Config) {
  const base = (ctx as any).logger?.('ysyunhei') ?? console
  const level: DebugLevel = ((config as any).debug_level ?? 0) as DebugLevel

  return {
    info: (...args: any[]) => base.info?.(...args) ?? console.log(...args),
    warn: (...args: any[]) => base.warn?.(...args) ?? console.warn(...args),
    error: (...args: any[]) => base.error?.(...args) ?? console.error(...args),
    debug: (lv: DebugLevel, ...args: any[]) => {
      if (level >= lv) {
        if (typeof base.debug === 'function') base.debug(...args)
        else (console.debug?.(...args) ?? console.log(...args))
      }
    },
    level,
  }
}
