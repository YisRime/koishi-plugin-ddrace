import { Context, Schema, h } from 'koishi'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import {
  formatPlayerSummary,
  formatScoreBrief,
  formatScoreDetailed,
  formatPlayerMapRecord,
  formatMapLeaderboard,
  formatMapCompletion,
  formatMapInfo
} from './text'
import { playerDataToHtml, htmlToImage } from './image'

export const name = 'ddrace'
export const inject = { optional: ['puppeteer'] }

/**
 * 插件配置接口
 */
export interface Config {
  useImage?: boolean
}

export const Config: Schema<Config> = Schema.object({
  useImage: Schema.boolean()
    .default(true)
    .description('是否默认以图片渲染结果')
})

/**
 * 用户绑定数据结构
 */
interface BindData {
  [userId: string]: string
}

export async function apply(ctx: Context, config: Config) {
  const bindFilePath = path.join(ctx.baseDir, 'data', 'ddrace.json')
  const canRenderImages = ctx.puppeteer != null

  // 加载绑定数据
  function loadBindData(): BindData {
    try {
      if (fs.existsSync(bindFilePath)) {
        return JSON.parse(fs.readFileSync(bindFilePath, 'utf8')) as BindData
      }
    } catch (error) {
      ctx.logger.error(`无法加载绑定数据: ${error}`)
    }
    return {}
  }

  // 保存绑定数据
  function saveBindData(data: BindData): void {
    try {
      fs.writeFileSync(bindFilePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      ctx.logger.error(`无法保存绑定数据: ${error}`)
    }
  }

  // 获取绑定ID
  function getBoundId(userId: string): string | null {
    const data = loadBindData()
    return data[userId] || null
  }

  // 绑定ID
  function bindPlayerId(userId: string, playerId: string): void {
    const data = loadBindData()
    data[userId] = playerId
    saveBindData(data)
  }

  // 解除绑定
  function unbindPlayerId(userId: string): boolean {
    const data = loadBindData()
    if (userId in data) {
      delete data[userId]
      saveBindData(data)
      return true
    }
    return false
  }

  /**
   * 获取玩家数据
   * @param playerId 玩家ID
   * @returns 玩家数据对象
   * @throws 如果请求失败或玩家不存在
   */
  async function fetchPlayerData(playerId: string): Promise<any> {
    const url = `https://ddnet.org/players/?json2=${encodeURIComponent(playerId)}`
    const response = await axios.get(url)
    const playerData = response.data

    if (!playerData || !playerData.player) {
      throw new Error(`未找到玩家 ${playerId}`)
    }

    return playerData
  }

  /**
   * 获取地图数据
   * @param mapName 地图名称
   * @returns 地图数据
   * @throws 如果请求失败或地图不存在
   */
  async function fetchMapData(mapName: string): Promise<any> {
    const url = `https://ddnet.org/maps/?json=${encodeURIComponent(mapName)}`
    const response = await axios.get(url)
    const mapData = response.data

    if (!mapData || !mapData.name) {
      throw new Error(`未找到地图 ${mapName}`)
    }

    return mapData
  }

  /**
   * 获取玩家在特定地图的记录
   * @param mapName 地图名称
   * @param playerId 玩家ID
   * @returns 玩家在该地图的记录数据
   */
  async function fetchPlayerMapRecord(mapName: string, playerId: string): Promise<any> {
    const mapData = await fetchMapData(mapName)

    if (!mapData.finishes) {
      throw new Error(`地图 ${mapName} 没有完成记录`)
    }

    // 查找玩家在该地图的记录
    const playerRecord = mapData.finishes.find(finish => finish.name.toLowerCase() === playerId.toLowerCase())
    if (!playerRecord) {
      throw new Error(`玩家 ${playerId} 在地图 ${mapName} 上没有完成记录`)
    }

    return {
      map: mapData,
      player: playerRecord
    }
  }

  /**
   * 生成玩家信息图片
   * @param playerData 玩家数据
   * @param session 会话对象
   * @returns 渲染后的图片元素
   */
  async function generatePlayerImage(playerData: any, session: any): Promise<h> {
    await session.send(`正在生成玩家 ${playerData.player} 的信息，请稍候...`)
    const htmlContent = playerDataToHtml(playerData)
    const imageBuffer = await htmlToImage(htmlContent, ctx)
    return h.image(imageBuffer, 'image/png')
  }

  // 主命令组
  const cmd = ctx.command('ddr [player:string]', '查询 DDNet 玩家信息')
    .action(async ({ session }, player) => {
      if (!player) {
        if (!session?.userId) {
          return '请输入要查询的玩家ID'
        }

        const boundId = getBoundId(session.userId)
        if (!boundId) {
          return '请先绑定玩家ID，或直接输入要查询的玩家ID'
        }
        player = boundId
      }

      try {
        const playerData = await fetchPlayerData(player)
        const useImage = config.useImage && canRenderImages

        if (useImage) {
          try {
            return await generatePlayerImage(playerData, session)
          } catch (error) {
            ctx.logger.error('图片生成失败:', error)
            await session.send('图片生成失败，将以文字显示...')
            return formatPlayerSummary(playerData)
          }
        } else {
          return formatPlayerSummary(playerData)
        }
      } catch (error) {
        ctx.logger.error('查询失败:', error)
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  // 其他子命令
  cmd.subcommand('.bind [player:string]', '绑定或解绑 DDNet 玩家')
    .action(async ({ session }, player) => {
      if (!player) {
        const boundId = getBoundId(session.userId)
        if (!boundId) {
          return '您尚未绑定 DDNet 玩家ID'
        }

        if (unbindPlayerId(session.userId)) {
          return `已成功解绑玩家 ${boundId}`
        } else {
          return '解绑失败'
        }
      }

      try {
        const { data } = await axios.get(`https://ddnet.org/players/?json2=${encodeURIComponent(player)}`)
        if (!data?.player) {
          return `未找到玩家 ${player}，请检查ID或稍后重试`
        }

        bindPlayerId(session.userId, data.player)
        return `已成功绑定玩家 ${data.player}`
      } catch (error) {
        return '绑定失败，请检查玩家ID或稍后重试'
      }
    })

  cmd.subcommand('.points [player:string]', '查询玩家的分数')
    .action(async ({ session }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        return formatScoreBrief(playerData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  cmd.subcommand('.pointsAll [player:string]', '查询玩家的详细分数信息')
    .action(async ({ session }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        return formatScoreDetailed(playerData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  cmd.subcommand('.maprank <map:string> [player:string]', '查询玩家在特定地图的排名')
    .action(async ({ session }, map, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      if (!map) {
        return '请指定地图名称'
      }

      try {
        const recordData = await fetchPlayerMapRecord(map, player)
        return formatPlayerMapRecord(recordData.map, recordData.player)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称和玩家ID是否正确'
      }
    })

  // 添加地图信息查询命令
  cmd.subcommand('.map <map:string>', '查询地图详细信息')
    .action(async ({ }, map) => {
      if (!map) {
        return '请指定地图名称'
      }

      try {
        const mapData = await fetchMapData(map)
        return formatMapInfo(mapData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称'
      }
    })

  // 修改原有地图排行榜查询，使用优化后的展示
  cmd.subcommand('.topmap <map:string>', '查询地图的全球排行榜')
    .action(async ({ }, map) => {
      if (!map) {
        return '请指定地图名称'
      }

      try {
        const mapData = await fetchMapData(map)
        return formatMapLeaderboard(mapData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称'
      }
    })

  cmd.subcommand('.MapFinish [player:string]', '查询玩家的地图完成度统计')
    .action(async ({ session }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        return formatMapCompletion(playerData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })
}
