# koishi-plugin-ddrace

[![npm](https://img.shields.io/npm/v/koishi-plugin-ddrace?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ddrace)

DDRaceNetwork 玩家数据查询，支持以图片形式返回查询结果

## 功能特性

- 查询玩家基本信息、分数统计
- 查询地图信息和排行榜
- 支持玩家 ID 绑定
- 可选择图片或文字方式展示结果

## 配置项

- `useImage` (boolean): 是否默认以图片形式渲染结果。需要 puppeteer 服务可用。默认值: `true`

## 命令列表

### ddr

主命令: `ddr [玩家ID]` - 查询玩家基本信息

子命令:

- `.bind [玩家ID]` - 绑定或解绑 DDNet 玩家ID
- `.points [玩家ID]` - 查询玩家分数概览
- `.pointsAll [玩家ID]` - 查询玩家详细分数信息
- `.maprank <地图名> [玩家ID]` - 查询玩家在特定地图的排名
- `.map <地图名>` - 查询地图详细信息
- `.topmap <地图名>` - 查询地图的全球排行榜
- `.MapFinish [玩家ID]` - 查询玩家的地图完成度统计

所有带 `[玩家ID]` 的命令，如果已绑定玩家ID则可以省略此参数。

## 依赖服务

- `puppeteer` (可选): 用于生成图片展示
