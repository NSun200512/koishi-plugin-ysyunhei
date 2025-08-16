import fs from 'fs/promises'
import path from 'path'

/**
 * 读取 package.json 的版本与贡献者
 * @returns Promise<{ version: string; contributors: string[] }>
 */
// 在插件有信息有更新的时候一般会重载插件，所有使用缓存
let cache: { version: string; contributors: string[] } | null = null
export default async function readPackageMeta(): Promise<{ version: string; contributors: string[] }> {
  try {
    if (cache) return cache
    // 兼容多种运行目录与打包结构，尝试多条候选路径
    const candidates = [
      path.join(__dirname, '../../package.json'),
      path.join(__dirname, '../../../package.json'),
      path.join(__dirname, '../package.json'),
      path.join(process.cwd(), 'node_modules', 'koishi-plugin-ysyunhei', 'package.json'),
    ]
    let raw = ''
    for (const p of candidates) {
      try {
        raw = await fs.readFile(p, 'utf-8')
        if (raw) break
      } catch {}
    }
    if (!raw) throw new Error('package.json not found')
    const pkg = JSON.parse(raw)
    const version: string = String(pkg.version || '未知')
    const list: any[] = Array.isArray(pkg.contributors) ? pkg.contributors : []
    const contributors = list
      .map((c) => {
        if (!c) return ''
        if (typeof c === 'string') return c.split('<')[0].trim()
        if (typeof c === 'object') return String(c.name ?? '').trim() || String(c).trim()
        return String(c).trim()
      })
      .filter((s) => s)
    cache = { version, contributors }
    return cache
  } catch {
    return { version: '未知', contributors: [] }
  }
}
