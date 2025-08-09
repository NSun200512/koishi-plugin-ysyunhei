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

机器人的禁言与踢群功能需要群内管理员及以上的权限。

## 指令列表

### 在云黑中添加账号

`yunhei.add <qqnum> <level> <desc> [bantime]`

将指定的账号添加到云黑中。

- `qqnum`:需要添加的QQ号
- `level`:违规严重程度，取值1/2/3，分别对应轻微、中等、严重。在达到“严重”等级后，云黑会自动将该账号从所在的群里踢出，并自动拒绝该账号加入群聊。
- `desc`:违规描述，用于记录违规行为。
- `bantime`:禁言时长（可选）。当该项有值，机器人会给该账号设置所在的群里指定的禁言时长。

### 在云黑中查询账号

`yunhei.chk [qqnum]`

当填写了`qqnum`时，机器人会查询该账号是否在云黑中，如果有则给出相应信息。如果没有给`qqnum`填写值，则会查询群内的所有普通用户。在执行后一种检查操作时，如果存在等级为“严重”的账号，机器人同样会将该账号从所在的群里踢出。

### 管理员操作

云黑的功能半独立于群内的管理员，有一套自己的管理员列表，这套列表可以根据不同的群单独配置。只有处于这个管理员列表的成员才能使用云黑。

`yunhei.admin --add <addid> --name <name> --del <delid> --list`

在执行添加操作时，使用可选项`--add`指定添加为云黑管理员的QQ号友ID。使用`--name`这一QQ号在管理员列表中的昵称，方便记录登记人，若未填写则默认使用QQ号本身的昵称。使用`--del`删除指定的管理员（不需要指定名称）。使用`--list`查看管理员列表。

注意：`--add`、`--del`、`--list`选项在同一次发出指令时只能使用一个。

在机器人加入群聊时，会自动将群主、管理员添加进云黑管理员名单里，防止没有管理员的情况下无法添加管理员。
