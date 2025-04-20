# koishi-plugin-ddrace

[![npm](https://img.shields.io/npm/v/koishi-plugin-ddrace?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ddrace)

DDRaceNetwork 玩家和地图数据查询，支持文本和图片两种展示方式

## 功能特性

- 查询玩家信息：排名、积分、游戏统计、地图完成情况、活跃度等
- 查询地图信息：基本信息、完成统计、特性、相关链接等
- 智能查询：自动判断查询对象是玩家还是地图
- 自适应展示方式：在 puppeteer 可用时展示图片，否则使用文本
- 长文本自动使用合并转发消息展示

## 配置项

### 玩家信息显示配置

- `showRankInfo` (boolean): 显示排名与积分。默认值: `true`
- `showGameInfo` (boolean): 显示游戏信息。默认值: `true`
- `showActivityStats` (boolean): 显示活跃度统计。默认值: `true`
- `showActivityInfo` (boolean): 显示近期活跃度。默认值: `true`
- `showMapTypeStats` (boolean): 显示地图完成统计。默认值: `true`
- `mapDetailsCount` (number): 显示地图名称的数量。默认值: `10`
- `recentFinishesCount` (number): 显示最近通关记录的数量。默认值: `-1`（显示全部），最大值: `10`
- `favoritePartnersCount` (number): 显示常用队友的数量。默认值: `-1`（显示全部），最大值: `10`

### 地图信息显示配置

- `showMapBasicInfo` (boolean): 显示地图信息。默认值: `true`
- `showMapFeatures` (boolean): 显示地图特性。默认值: `true`
- `showMapLinks` (boolean): 显示相关链接。默认值: `true`
- `showMapStats` (boolean): 显示完成统计。默认值: `true`
- `globalRanksCount` (number): 显示全球排名的数量。默认值: `-1`（显示全部），最大值: `20`
- `chinaRanksCount` (number): 显示国服排名的数量。默认值: `-1`（显示全部），最大值: `20`
- `teamRanksCount` (number): 显示团队排名的数量。默认值: `-1`（显示全部），最大值: `20`
- `multiFinishersCount` (number): 显示多次完成玩家的数量。默认值: `-1`（显示全部），最大值: `20`

## 命令列表

### ddr

主命令: `ddr <查询内容>` - 查询 DDRace 中的玩家或地图信息

选项:

- `-p, --player` - 仅搜索玩家
- `-m, --map` - 仅搜索地图

使用示例:

- `ddr nameless tee` - 先尝试查询玩家 "nameless tee"，如果找不到则查询同名地图
- `ddr -p nameless tee` - 仅查询玩家 "nameless tee"
- `ddr -m Multeasymap` - 仅查询地图 "Multeasymap"

## 依赖服务

- `puppeteer` (可选): 用于生成图片展示，如果不可用则自动降级为文本模式
