import fs from 'fs/promises'
import { Context, Schema,Session } from 'koishi'
import type { OneBot } from 'koishi-plugin-adapter-onebot'
import path from 'path'


export const name = 'ysyunhei'

//填入api key
export interface Config {
  api_key:string
  admin_qqs: string[]
}

export const Config: Schema<Config> = Schema.object({
  api_key:Schema.string().description('你在云黑系统中的API Key。').required(),
  admin_qqs: Schema.array(Schema.string()).description('插件管理员的 QQ 号列表。只有在此列表中的用户才能使用插件的全部功能。'),
  usage: Schema.string().role('markdown').description('使用说明').content(`
## 指令列表
### 在云黑中添加账号
\`yunhei.add <qqnum> <level> <desc> [bantime]\`

将指定的账号添加到云黑中。
* \`qqnum\`:需要添加的QQ号
* \`level\`:违规严重程度，取值1/2/3，分别对应轻微、中等、严重。在达到“严重”等级后，云黑会自动将该账号从所在的群里踢出，并自动拒绝该账号加入群聊。
* \`desc\`:违规描述，用于记录违规行为。
* \`bantime\`:禁言时长（可选）。当该项有值，机器人会给该账号设置所在的群里指定的禁言时长。
### 在云黑中查询账号
\`yunhei.chk [qqnum]\`

当填写了\`qqnum\`时，机器人会查询该账号是否在云黑中，如果有则给出相应信息。如果没有给\`qqnum\`填写值，则会查询群内的所有普通用户。在执行后一种检查操作时，如果存在等级为“严重”的账号，机器人同样会将该账号从所在的群里踢出。
`)
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

//描述添加日期，在多个描述存在时方便整理发生时间
function dayRecord(desc:string): string {
  const now = new Date(); // 获取当前日期对象
  const year = now.getFullYear(); // 获取完整年份（4位数）
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 月份补零（0 → "01"）
  const day = String(now.getDate()).padStart(2, '0'); // 日期补零（5 → "05"）
  return `${desc}（${year}-${month}-${day}）`; // 返回 YYYY-MM-DD
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
    return `错误：检查机器人权限失败，可能是机器人未加入该群或API出现问题。原因：${error.message}`
  }

  //检查使用者是否为管理
  if (!config.admin_qqs.includes(meta.userId)) {
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

    const user = await meta.bot.getLogin()
    const registration = config.admin_qqs.includes(meta.userId) ? meta.userId : user.userId
    let post=await ctx.http.post(`https://yunhei.youshou.wiki/add_platform_users?api_key=${config.api_key}&account_type=1&name=${qqnum}&level=${level}&registration=${registration}&expiration=${expiration}&desc=${dayRecord(desc)}`)
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
        return `踢出用户失败，可能是权限不足或对方是群主/管理员。错误信息：${error.message}`
      }
    }
    //禁言处理
    if (!(bantime == undefined)){
      try {
        await meta.onebot.setGroupBan(meta.guildId, qqnum, time2Seconds(bantime))
        measure += `并禁言${bantime}`
      } catch (error) {
        return `禁言用户失败，可能是权限不足或对方是群主/管理员。错误信息：${error.message}`
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
    return `错误：执行添加操作时遇到意外。原因：${error.message}`
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
    return `错误：检查机器人权限失败，可能是机器人未加入该群或API出现问题。原因：${error.message}`
  }

  //检查使用者是否为管理
  if (!config.admin_qqs.includes(meta.userId)) {
    return '错误：您没有使用该命令的权限。'
  }
  //查询所有用户信息
  if (qqnum===undefined) {
    meta.send(`正在检查群内所有人员……`)
    let group_members
    try {
      group_members = await meta.onebot.getGroupMemberList(meta.guildId)
    } catch (error) {
      return `错误：获取群成员列表失败。原因：${error.message}`
    }

    let detectnum:number=0,light:number=0,moderate:number=0,severe:number=0,severe_users:string[]=[], api_errors: string[] = []
    const membersToCheck = group_members.filter(member => member.role === 'member');

    await processInBatches(membersToCheck, async (member: OneBot.GroupMemberInfo) => {
      try {
        const res = await ctx.http.get(
          `https://yunhei.youshou.wiki/get_platform_users?api_key=${config.api_key}&mode=1&search_type=1&account_type=1&account=${member.user_id}`
        )
        if (res.code !== 1 && res.data?.length === 0) {
          // 记录API错误，但不中断整个流程
          if (!api_errors.length) { // 只记录第一条，避免刷屏
            api_errors.push(res.msg || '未知API错误');
          }
          return;
        }
        //等级判定
        if (!(res.data.length === 0)) {
          detectnum+=1
          if (res.data.level==`轻微`) {
            light+=1
          } else if (res.data.level==`中等`) {
            moderate+=1
          } else if (res.data.level==`严重`) {
            severe+=1
            //构建严重用户信息并尝试踢群
            severe_users.push(`${member.nickname}（${member.user_id}）\n违规原因：${res.data.describe}\n登记人：${res.data.registration}\n上黑时间：${res.data.add_time}`)
            try {
              await meta.onebot.setGroupKick(meta.guildId, member.user_id, false)
            } catch (error) {
              severe_users.push(`  - 踢出用户 ${member.nickname}（${member.user_id}）失败: ${error.message}`);
            }
          }
        }
      } catch (error) {
        if (!api_errors.length) { // 只记录第一条网络错误
          api_errors.push(error.message);
        }
      }
    }, 20)
    //生成报告
    let report:string
    if (detectnum == 0) {
      report = "未检查出任何位于黑名单内的成员。"
    } else {
        report = `检测到${detectnum}名违规用户。其中等级轻微者${light}人，等级中等者${moderate}人，等级严重者${severe}人。`
        if (!(severe_users.length === 0)){
          report += `\n严重用户列表及处理结果：\n${severe_users.join('\n')}\n列表中等级为“严重”的用户已尝试踢出群聊。`
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
    } catch (error) {return `错误：查询用户失败，请检查网络连接或API状态。原因：${error.message}`}
  }
}

export function apply(ctx: Context,config: Config) {
  ctx.command('yunhei.add <qqnum> <level:number> <desc> [bantime]')
    .action(({ session }, qqnum, level, desc, bantime) => add(ctx, session, qqnum, level, desc, bantime, config))
  ctx.command('yunhei.chk [qqnum]')
    .action(({ session }, qqnum) => check(ctx, session, qqnum, config))
}
