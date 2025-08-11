// SPDX-License-Identifier: MIT
import fs from 'fs/promises'
import { Context, Schema, Session, segment } from 'koishi'
import type { OneBot } from 'koishi-plugin-adapter-onebot'
import path from 'path'
import https from 'https'


export const name = 'ysyunhei'

// 控制台展示用使用说明（遵循官方插件的写法）
export const usage = `
## 指令列表
### 在云黑中添加账号
\`yunhei.add <qqnum> <level> <desc> [bantime]\`

将指定的账号添加到云黑中。
* \`qqnum\`:需要添加的QQ号
* \`level\`:违规严重程度，取值1/2/3，分别对应轻微、中等、严重。在达到“严重”等级后，云黑会自动将该账号从所在的群里踢出，并自动拒绝该账号加入群聊。
* \`desc\`:违规描述，用于记录违规行为。
* \`bantime\`:禁言时长（可选）。当该项有值，机器人会给该账号设置所在的群里指定的禁言时长。
### 在云黑中查询账号
\`yunhei.chk [qqnum]\`（别名：\`yunhei.cx\`）

当填写了\`qqnum\`时，机器人会查询该账号是否在云黑中，如果有则给出相应信息。如果没有给\`qqnum\`填写值，则会查询群内的所有成员（包括管理员与群主）。在执行后一种检查操作时，如果存在等级为“严重”的账号，机器人同样会将该账号从所在的群里踢出。
\n### 查看插件信息\n\`yunhei.about\`\n\n显示当前插件版本、贡献者列表，并检查云黑官网可用性。
\n### 趣味：精致睡眠\n\`yunhei.sleepwell [confirm]\`\n\n- 作用：在北京时间 22:00-02:00 期间，对自己执行 8 小时禁言。\n- 使用：在时间段内，直接输入 \`yunhei.sleepwell\` 会提示确认信息，输入 \`yunhei.sleepwell confirm\` 即执行。\n- 限制：仅群聊可用；非上述时间段调用将不会有任何输出。
`

//填入api key
export interface Config {
  api_key:string
  // 管理员 QQ 到登记人昵称的映射
  admin_qqs: Record<string, string>
  // 精致睡眠开始小时（北京时间，0-23）
  sleep_start_hour?: number
  // 精致睡眠结束小时（北京时间，0-23）
  sleep_end_hour?: number
  // 精致睡眠禁言时长（小时）
  sleep_mute_hours?: number
  // 是否将主要文本输出渲染为图片（需要安装 @koishijs/plugin-canvas，无法使用时会自动回落为文本）
  render_as_image?: boolean
}

export const Config: Schema<Config> = Schema.object({
  api_key:Schema.string().role('secret').description('你在云黑系统中的API Key。').required(),
  admin_qqs: Schema.dict(Schema.string()).description('管理员 QQ 到“登记人昵称”的映射。只有键中包含的 QQ 能使用全部功能；登记时会用其对应的昵称作为登记人上报云黑。').default({}),
  sleep_start_hour: Schema.number().min(0).max(23).default(22).description('精致睡眠开始时间（北京时间小时，0-23）。'),
  sleep_end_hour: Schema.number().min(0).max(23).default(2).description('精致睡眠结束时间（北京时间小时，0-23）。'),
  sleep_mute_hours: Schema.number().min(1).max(24).default(8).description('精致睡眠禁言时长（小时）。'),
  render_as_image: Schema.boolean().default(false).description('将主要输出（如查询/添加结果、about）渲染为图片消息（需装 @koishijs/plugin-canvas）。'),
})

//并发控制函数
async function processInBatches<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  batchSize: number = 10
): Promise<any[]> {
  const results: any[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}
//时间转换为秒，禁言用
function time2Seconds(timeStr: string) {
    if (!timeStr) return 0;

    const regex = /(\d+)\s*(天|小时|时|分钟|分)/g;
    let totalSeconds = 0;
    let match;

    while ((match = regex.exec(timeStr)) !== null) {
        const num = parseInt(match[1], 10);
        const unit = match[2];

        if (unit === '天') {
            totalSeconds += num * 86400;  // 1天 = 86400秒
        } else if (unit === '小时' || unit === '时') {
            totalSeconds += num * 3600;   // 1小时 = 3600秒
        } else if (unit === '分钟' || unit === '分') {
            totalSeconds += num * 60;     // 1分钟 = 60秒
        }
    }
    return totalSeconds;
}

// 错误信息脱敏，避免 api_key 等敏感信息泄露
function sanitizeErrorMessage(err: any, config?: Config): string {
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

//描述添加日期，在多个描述存在时方便整理发生时间
function dayRecord(desc:string): string {
  const now = new Date(); // 获取当前日期对象
  const year = now.getFullYear(); // 获取完整年份（4位数）
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份补零（0 → "01"）
  const day = String(now.getDate()).padStart(2, '0'); // 日期补零（5 → "05"）
  return `${desc}（${year}-${month}-${day}）`; // 返回 YYYY-MM-DD
}

// 简单的每用户-每指令冷却（单位：毫秒）
const COOLDOWN_MS = 30_000
const lastInvoke = new Map<string, number>()
function checkAndSetCooldown(meta: Session, cmd: string): string | null {
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

// 轻量防抖：仅用于 yunhei.sleepwell 的 confirm 分支，避免短时间重复执行禁言
const SLEEPWELL_CONFIRM_DEBOUNCE_MS = 2000
const lastSleepwellConfirm = new Map<string, number>()
function hitSleepwellDebounce(session: Session): boolean {
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

// 读取 package.json 的版本与贡献者
async function readPackageMeta(): Promise<{ version: string; contributors: string[] }> {
  try {
    const pkgPath = path.resolve(__dirname, '../package.json')
    const raw = await fs.readFile(pkgPath, 'utf-8')
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
    return { version, contributors }
  } catch {
    return { version: '未知', contributors: [] }
  }
}

// 检查官网可用性（优先 HEAD，若不支持则回退 GET）
async function checkWebsiteStatus(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
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

// about 指令实现
export async function about(ctx: Context): Promise<string> {
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

// 将纯文本渲染为图片卡片（若可用），否则回落为文本
async function maybeRenderAsImage(
  ctx: Context,
  config: Config,
  text: string,
  options?: { title?: string }
): Promise<any> {
  try {
    if (!config.render_as_image) return text
    const canvas: any = (ctx as any).canvas
    if (!canvas || typeof canvas.render !== 'function') return text
    const title = options?.title ?? '云黑结果'
    // 拆分为行，构造简单卡片（使用 h()，避免 .ts 中使用 JSX）
    const lines = String(text ?? '').split('\n')
    // 动态加载 @satorijs/element，未安装则回落
    let h: any
    try {
      const mod: any = await import('@satorijs/element')
      h = mod?.h
    } catch {
      return text
    }
    if (typeof h !== 'function') return text
  const vnode = h(
      'div',
      {
        style: {
          width: 900,
          padding: 32,
          background: '#0f1218',
          color: '#e8edf2',
          fontSize: 28,
          fontFamily: 'Microsoft YaHei, Segoe UI, Arial, sans-serif',
          lineHeight: 1.6,
        },
      },
      h('div', { style: { fontSize: 34, fontWeight: 700, marginBottom: 16 } }, title),
      h('div', { style: { height: 2, background: '#2a3340', marginBottom: 16 } }),
      ...lines.map((ln, i) =>
        h(
          'div',
          { key: String(i), style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } },
          ln || ' '
        )
      ),
      h('div', { style: { marginTop: 16, color: '#7b8794', fontSize: 22 } }, '由 koishi-plugin-ysyunhei 生成')
    )
    const buf: Buffer = await canvas.render(vnode)
  return segment.image(buf as any, 'image/png')
  } catch {
    return text
  }
}

//添加黑名单用户
export async function add(ctx: Context, meta: Session, qqnum: string, level: number, desc: string, bantime: string,config: Config) {
  // 检查参数
  if (!qqnum || !level || !desc) {
    return '错误：缺少必要的参数。请使用 `help yunhei.add` 查看正确的指令格式。';
  }
  //检查是否为群聊环境
  if (meta.guildId === undefined) {
    return '错误：请在群组内使用命令。'
  }
  //检查机器人权限
  try {
    let bot: OneBot.GroupMemberInfo = await meta.onebot.getGroupMemberInfo(meta.guildId, meta.selfId)
    if (bot.role == 'member') {
      return '错误：本功能需要机器人为群组管理员，请联系群主设置。'
    }
  } catch (error) {
  return `错误：检查机器人权限失败，可能是机器人未加入该群或API出现问题。原因：${sanitizeErrorMessage(error, config)}`
  }

  //检查使用者是否为管理
  if (!config.admin_qqs || !(meta.userId in config.admin_qqs)) {
    return '错误：您没有使用该命令的权限。'
  }
  //检查等级参数
  if (![1, 2, 3].includes(level)) {
    return '错误：等级参数错误，应为1~3。'
  }
  //封禁时长设置，如果等级为1则设置为一年（31536000s），如果大于1则为永久（0s）
  let expiration: number = level == 1 ? 31536000 : 0
  //获取黑名单用户信息
  try {
    const apiCheck = await ctx.http.get(`https://yunhei.youshou.wiki/get_platform_users?api_key=${config.api_key}&mode=1&search_type=1&account_type=1&account=${qqnum}`)
    if (apiCheck.code !== 1 && apiCheck.data?.length > 0) {
      // 用户已存在于黑名单中，这在 get 接口中可能不算一个“错误”
    } else if (apiCheck.code !== 1 && apiCheck.data?.length === 0) {
      return `错误：无法与云黑系统通信。API返回：${apiCheck.msg || '未知错误'}`;
    }

  // 仅管理员可调用此命令，这里使用配置中映射的“登记人昵称”
  const registration = config.admin_qqs[meta.userId]
    let post=await ctx.http.post(`https://yunhei.youshou.wiki/add_platform_users?api_key=${config.api_key}&account_type=1&name=${qqnum}&level=${level}&registration=${encodeURIComponent(registration)}&expiration=${expiration}&desc=${encodeURIComponent(dayRecord(desc))}`)
    if (post.code !== 1) {
      return `错误：添加用户失败。API返回：${post.msg || '未知错误'}`
    }

    //显示记录违规时长并执行相关操作
    let measure:string=`记录违规信息`
    if (level==1) {  //1级（轻微）仅记录时长一年
      measure += `，时长一年`
    } else if (level==2) {  //2级（中等）记录时长永久并禁言
      measure = '永久' + measure
    } else if (level==3) {  //3级（严重）记录时长永久并踢群
      try {
        await meta.onebot.setGroupKick(meta.guildId, qqnum, false)
        measure = '踢出群并永久' + measure
      } catch (error) {
  return `踢出用户失败，可能是权限不足或对方是群主/管理员。错误信息：${sanitizeErrorMessage(error, config)}`
      }
    }
    //禁言处理
    if (!(bantime == undefined)){
      try {
        await meta.onebot.setGroupBan(meta.guildId, qqnum, time2Seconds(bantime))
        measure += `并禁言${bantime}`
      } catch (error) {
  return `禁言用户失败，可能是权限不足或对方是群主/管理员。错误信息：${sanitizeErrorMessage(error, config)}`
      }
    }
    //显示处理结果部分
    const finalCheck = await ctx.http.get(`https://yunhei.youshou.wiki/get_platform_users?api_key=${config.api_key}&mode=1&search_type=1&account_type=1&account=${qqnum}`)
    if (finalCheck.code !== 1) {
        return `成功添加用户到云黑，但获取最终信息时出错。API返回：${finalCheck.msg || '未知错误'}`;
    }
    let data = finalCheck.data
    let nickname:string = (await meta.onebot.getStrangerInfo(data.account_name)).nickname
    return `已将${nickname}（${qqnum}）${measure}。\n违规原因：${data.describe}\n严重程度：${data.level}\n措施：${measure}\n登记人：${data.registration}\n上黑时间：${data.add_time}`

  } catch (error) {
    return `错误：执行添加操作时遇到意外。原因：${sanitizeErrorMessage(error, config)}`
  }
}


//查询黑名单用户
export async function check(ctx: Context, meta: Session, qqnum: string, config: Config) {
  //检查是否为群聊环境
  if (meta.guildId === undefined) {
    return '错误：请在群组内使用命令。'
  }
  //检查机器人权限
  try {
    let bot: OneBot.GroupMemberInfo = await meta.onebot.getGroupMemberInfo(meta.guildId, meta.selfId)
    if (bot.role == 'member') {
      return '错误：本功能需要机器人为群组管理员，请联系群主设置。'
    }
  } catch (error) {
  return `错误：检查机器人权限失败，可能是机器人未加入该群或API出现问题。原因：${sanitizeErrorMessage(error, config)}`
  }

  //检查使用者是否为管理
  if (!config.admin_qqs || !(meta.userId in config.admin_qqs)) {
    return '错误：您没有使用该命令的权限。'
  }
  //查询所有用户信息
  if (qqnum===undefined) {
    let group_members
    try {
      group_members = await meta.onebot.getGroupMemberList(meta.guildId)
    } catch (error) {
  return `错误：获取群成员列表失败。原因：${sanitizeErrorMessage(error, config)}`
    }

  const membersToCheck = group_members
  const totalToCheck = membersToCheck.length
  // 开始时输出群员数量及将要检查的人数（包含管理员与群主）
  meta.send(`正在检查群内所有人员（共${totalToCheck}人）……`)

    let detectnum:number=0,light:number=0,moderate:number=0,severe:number=0,severe_users:string[]=[], api_errors: string[] = []
    // 进度统计与阈值（25%、50%、75%）
    let processedCount = 0
    const thresholds = [0.25, 0.5, 0.75]
    let nextThresholdIndex = 0

    await processInBatches(membersToCheck, async (member: OneBot.GroupMemberInfo) => {
      try {
        const res = await ctx.http.get(
          `https://yunhei.youshou.wiki/get_platform_users?api_key=${config.api_key}&mode=1&search_type=1&account_type=1&account=${member.user_id}`
        )
        if (res.code !== 1 && res.data?.length === 0) {
          // 记录API错误，但不中断整个流程
          if (!api_errors.length) { // 只记录第一条，避免刷屏
            api_errors.push(sanitizeErrorMessage(res.msg || '未知API错误', config));
          }
          return;
        }
        // 等级判定
        if (!(res.data.length === 0)) {
          detectnum += 1
          if (res.data.level == `轻微`) {
            light += 1
          } else if (res.data.level == `中等`) {
            moderate += 1
          } else if (res.data.level == `严重`) {
            severe += 1
            // 构建严重用户信息并尝试踢群
            severe_users.push(`${member.nickname}（${member.user_id}）\n违规原因：${res.data.describe}\n登记人：${res.data.registration}\n上黑时间：${res.data.add_time}`)
            if (member.role && member.role !== 'member') {
              // 群主或管理员，机器人通常无权操作
              severe_users.push(`  - 该成员为群主/管理员，机器人无权进行踢出操作，请手动处理。`)
            } else {
              try {
                await meta.onebot.setGroupKick(meta.guildId, member.user_id, false)
              } catch (error) {
                severe_users.push(`  - 踢出用户 ${member.nickname}（${member.user_id}）失败: ${sanitizeErrorMessage(error, config)}`);
              }
            }
          }
        }
      } catch (error) {
        if (!api_errors.length) { // 只记录第一条网络错误
          api_errors.push(sanitizeErrorMessage(error, config));
        }
      } finally {
        // 进度更新（放在 finally，确保无论成功或失败都统计进度）
        if (totalToCheck > 0) {
          processedCount += 1
          const ratio = processedCount / totalToCheck
          while (nextThresholdIndex < thresholds.length && ratio >= thresholds[nextThresholdIndex]) {
            const percent = Math.round(thresholds[nextThresholdIndex] * 100)
            meta.send(`进度：已完成${percent}%（${processedCount}/${totalToCheck}）`)
            nextThresholdIndex += 1
          }
        }
      }
    }, 10)
    //生成报告
    let report:string
    if (detectnum == 0) {
      report = "未检查出任何位于黑名单内的成员。"
    } else {
        report = `检测到${detectnum}名违规用户。其中等级轻微者${light}人，等级中等者${moderate}人，等级严重者${severe}人。`
        if (!(severe_users.length === 0)){
          report += `\n严重用户列表及处理结果：\n${severe_users.join('\n')}\n其中普通成员已尝试踢出；若为群主/管理员，请手动处理。`
        }
    }
    if (api_errors.length > 0) {
      report += `\n\n在检查过程中遇到一个或多个错误，可能导致部分用户未被正确查询。遇到的第一个错误是：${api_errors[0]}`
    }
    meta.send(`${report}\n检查完毕，感谢您的使用。`)
  } else {
    //查询单个用户信息
    try {
      let blacklist_person=await ctx.http.get(`https://yunhei.youshou.wiki/get_platform_users?api_key=${config.api_key}&mode=1&search_type=1&account_type=1&account=${qqnum}`)
      if (blacklist_person.code !== 1) {
        return `错误：查询用户失败。API返回：${blacklist_person.msg || '未知错误'}`
      }
      if (blacklist_person.data.length === 0) {
        return `查询成功，该用户不在黑名单中。`
      } else {
        let data=blacklist_person.data
        let nickname:string = (await meta.onebot.getStrangerInfo(data.account_name)).nickname
        let res:string=`账号类型：${data.platform}\n用户名：${nickname}\nQQ号：${data.account_name}\n违规原因：${data.describe}\n严重等级：${data.level}\n登记人：${data.registration}\n上黑时间：${data.add_time}\n过期时间：${data.expiration}\n查询云黑请见：https://yunhei.youshou.wiki`
        return res
      }
  } catch (error) {return `错误：查询用户失败，请检查网络连接或API状态。原因：${sanitizeErrorMessage(error, config)}`}
  }
}

export function apply(ctx: Context,config: Config) {
  ctx.command('yunhei.add <qqnum> <level:number> <desc> [bantime]')
    .action(async ({ session }, qqnum, level, desc, bantime) => {
      const tip = checkAndSetCooldown(session, 'yunhei.add')
      if (tip) return tip
      const res = await add(ctx, session, qqnum, level, desc, bantime, config)
      return maybeRenderAsImage(ctx, config, res, { title: '云黑添加结果' })
    })
  ctx.command('yunhei.chk [qqnum]')
  .alias('yunhei.cx')
    .action(async ({ session }, qqnum) => {
      const tip = checkAndSetCooldown(session, 'yunhei.chk')
      if (tip) return tip
      const res = await check(ctx, session, qqnum, config)
      // 当检查整个群时，函数内部会主动分批发送并返回 void，此时不做图片渲染
      if (res == null) return
      return maybeRenderAsImage(ctx, config, res, { title: '云黑查询结果' })
    })
  ctx.command('yunhei.about')
    .action(async ({ session }) => {
      const tip = checkAndSetCooldown(session, 'yunhei.about')
      if (tip) return tip
      const res = await about(ctx)
      return maybeRenderAsImage(ctx, config, res, { title: '关于本插件' })
    })

  ctx.command('yunhei.sleepwell [confirm]')
    .action(async ({ session }, confirm) => {
      // 仅群聊可用；若不是群聊则静默
      if (!session.guildId) return
      // 获取北京时间（UTC+8）
      const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
      const hour = now.getUTCHours()
      // 精致睡眠区间（来自配置；默认 22-02）
      const start = Math.max(0, Math.min(23, (config.sleep_start_hour ?? 22) | 0))
      const end = Math.max(0, Math.min(23, (config.sleep_end_hour ?? 2) | 0))
      const inSleepTime = start === end
        ? true
        : (start < end ? (hour >= start && hour < end) : (hour >= start || hour < end))
      if (!inSleepTime) {
        // 不在时间段则完全不响应
        return
      }
      // 命中时间段后，先检查机器人自身是否为群管；若不是，则无法执行禁言
      try {
        const botInfo = await session.onebot.getGroupMemberInfo(session.guildId, session.selfId)
        if (!botInfo || botInfo.role === 'member') {
          return '对不起，做不到'
        }
      } catch {
        return '对不起，做不到'
      }
      const muteHours = Math.max(1, ((config.sleep_mute_hours ?? 8) | 0))
      const baseMsg = `本命令将会针对执行一个${muteHours}小时的禁言，正所谓精致睡眠。`
      if (!confirm) {
  return `${baseMsg}\n\n当前已在精致睡眠时间段（${start}:00-${end}:00），如果确认，请输入以下命令。注意，此操作不可撤销！\n*yunhei.sleepwell confirm`
      }
      if (String(confirm).toLowerCase() === 'confirm') {
        // 轻量防抖：2 秒内重复 confirm 将被拒绝
        if (hitSleepwellDebounce(session)) {
          return '操作过于频繁，请稍后再试。'
        }
        try {
          // 先判断是否为群管，若是，仅提示且不执行禁言
          try {
            const info = await session.onebot.getGroupMemberInfo(session.guildId, session.userId)
            if (info?.role && info.role !== 'member') {
              return '你已经是一个成熟的群管了，要学会以身作则按时休息！'
            }
          } catch {}

          const seconds = muteHours * 60 * 60
          await session.onebot.setGroupBan(session.guildId, session.userId, seconds)
          return `${muteHours}小时精致睡眠已到账，晚安~`
        } catch (e) {
          return '禁言失败，可能是机器人权限不足。'
        }
      }
      return
    })
}
