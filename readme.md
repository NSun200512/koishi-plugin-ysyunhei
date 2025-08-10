# koishi-plugin-ysyunhei

[![npm](https://img.shields.io/npm/v/koishi-plugin-ysyunhei?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ysyunhei)

## 介绍

通过Koishi实现对[有兽焉云黑系统](https://yunhei.youshou.wiki/#/)添加和查询人员的机器人插件。

目前仅支持OneBot，在使用该插件前请先安装[适配器](https://github.com/koishijs/koishi-plugin-adapter-onebot)。

## 安装与配置

你可以使用 yarn 或 npm 手动安装本插件：

```bash
$ yarn add koishi-plugin-ysyunhei
# 或者
$ npm install --save koishi-plugin-ysyunhei
```

配置项：

- `api_key`：你在云黑系统中的 API Key。
- `admin_qqs`：管理员 QQ 到“登记人昵称”的映射。只有键中包含的 QQ 能使用全部功能；执行 yunhei.add 时会用其对应的昵称作为“登记人”上报到云黑，而不是直接使用 QQ 号。
- `sleep_start_hour`：精致睡眠开始时间（北京时间整点，0-23，默认 22）。
- `sleep_end_hour`：精致睡眠结束时间（北京时间整点，0-23，默认 2）。
- `sleep_mute_hours`：精致睡眠禁言时长（小时，1-24，默认 8）。

机器人的禁言与踢群功能需要群内管理员及以上的权限。

## 指令列表

### 在云黑中添加账号

`yunhei.add <qqnum> <level> <desc> [bantime]`

将指定的账号添加到云黑中。

- `qqnum`:需要添加的QQ号
- `level`:违规严重程度，取值1/2/3，分别对应轻微、中等、严重。在达到“严重”等级后，云黑会自动将该账号从所在的群里踢出，并自动拒绝该账号加入群聊。
- `desc`:违规描述，用于记录违规行为。
- `bantime`:禁言时长（可选）。当该项有值，机器人会给该账号设置所在的群里指定的禁言时长。

补充说明：

- 登记人会使用 `admin_qqs` 中为调用者配置的昵称上报云黑。
- 依据等级设置处理时长：`level=1` 记录时长一年；`level>=2` 为永久。
- 可选参数 `bantime` 的写法支持中文单位组合：`天`、`小时/时`、`分钟/分`。例如：`1天2小时30分`、`45分`、`2小时`。
- 需要机器人为群管理员或以上，且调用者必须在 `admin_qqs` 列表内。

### 在云黑中查询账号

`yunhei.chk [qqnum]`（别名：`yunhei.cx`）

当填写了 `qqnum` 时，机器人会查询该账号是否在云黑中，如果有则给出相应信息。若未提供 `qqnum`，则会检查群内的所有成员（包括管理员与群主），期间会分阶段汇报进度。在执行全量检查时：

- 检测到“严重”的账号会尝试踢出群聊；
- 若该成员为群主/管理员，机器人通常无权操作，会在结果中提示需手动处理。

调用者必须在 `admin_qqs` 列表内，且需要机器人为群管理员或以上。

### 查看插件信息

`yunhei.about`

显示当前插件版本、贡献者列表，并检查云黑官网可用性。

### 趣味：精致睡眠

`yunhei.sleepwell [confirm]`

- 作用：在北京时间 `sleep_start_hour` 至 `sleep_end_hour` 期间，对自己执行 `sleep_mute_hours` 小时禁言（默认 22:00-02:00，禁言 8 小时）。
- 使用：在时间段内，直接输入 `yunhei.sleepwell` 会提示确认信息，输入 `yunhei.sleepwell confirm` 即执行。
- 限制：仅群聊可用；非上述时间段调用将不会有任何输出；需要机器人为群管理员或以上；若执行者为群主/管理员，将不会执行禁言。

## 使用限制与冷却

- 权限：调用 `yunhei.add` / `yunhei.chk` 需要调用者在 `admin_qqs` 中；涉及禁言/踢人均需要机器人在群内具备管理员及以上权限。
- 场景：`yunhei.add` / `yunhei.chk` 仅群聊可用。
- 冷却：为避免刷屏，单个用户对于同一指令存在 30 秒冷却时间。

## 许可

MIT
