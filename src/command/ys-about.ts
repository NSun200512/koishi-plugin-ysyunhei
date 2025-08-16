import readPackageMeta from "../utils/read-package-meta"
import checkWebsiteStatus from "../utils/check-website-status"

/**
 * about 指令实现
 * @returns Promise<string>
 */
export default async function about(): Promise<string> {
  const meta = await readPackageMeta()
  const status = await checkWebsiteStatus('https://yunhei.youshou.wiki')

  const intro = `Ysy cloud blacklist plugin for OICQ`
  const versionLine = `版本：v${meta.version}`
  const contribLine = `贡献者：${meta.contributors.length ? meta.contributors.join('、') : '（无）'}`
  const statusLine = status.ok
    ? `云黑服务：✅ 正常 (HTTP 200)`
    : `云黑服务：❌ 异常 (${status.status ? 'HTTP ' + status.status : status.error || '未知错误'})`

  return [intro, versionLine, contribLine, statusLine].join('\n')
}
