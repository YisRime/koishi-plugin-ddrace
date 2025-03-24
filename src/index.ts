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
  showRankInfo?: boolean
  showActivityInfo?: boolean
  showGameInfo?: boolean
  showMapTypeStats?: boolean
  showRecentFinishes?: boolean
  showFavoritePartners?: boolean
  showActivityStats?: boolean
  showMapDetails?: boolean
  useForward?: boolean
  forwardName?: string
}

export const Config: Schema<Config> = Schema.object({
  useImage: Schema.boolean()
    .default(true)
    .description('是否默认以图片渲染结果'),
  useForward: Schema.boolean()
    .default(false)
    .description('是否合并转发文本消息'),
  forwardName: Schema.string()
    .default('DDRace 查询助手')
    .description('合并转发消息的发送者名称'),
  showRankInfo: Schema.boolean()
    .default(true)
    .description('是否显示排名与分数信息'),
  showActivityInfo: Schema.boolean()
    .default(true)
    .description('是否显示最近活跃度信息'),
  showGameInfo: Schema.boolean()
    .default(true)
    .description('是否显示游戏基本信息'),
  showMapTypeStats: Schema.boolean()
    .default(true)
    .description('是否显示地图类型统计'),
    showMapDetails: Schema.boolean()
    .default(false)
    .description('是否显示地图类型统计中的地图名称列表'),
  showRecentFinishes: Schema.boolean()
    .default(true)
    .description('是否显示最近完成记录'),
  showFavoritePartners: Schema.boolean()
    .default(true)
    .description('是否显示常用队友信息'),
  showActivityStats: Schema.boolean()
    .default(true)
    .description('是否显示活跃度统计'),
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
   * 根据配置和命令选项决定是否使用图片模式
   * @param useToggle 是否使用切换选项
   * @returns 是否使用图片模式
   */
  function shouldUseVisualMode(useToggle: boolean): boolean {
    // 默认模式
    const defaultMode = config.useImage && canRenderImages

    // 如果指定了-v选项，切换到相反的模式
    if (useToggle) {
      return !defaultMode
    }

    // 否则使用默认模式
    return defaultMode
  }

  /**
   * 发送合并转发消息
   * @param session 会话对象
   * @param content 消息内容
   * @param title 可选的标题
   * @returns 消息ID
   */
  async function sendForwardMessage(session: any, content: string, title?: string): Promise<string | number> {
    if (!session?.onebot) {
      return session.send(content)
    }

    // 如果消息较短，直接发送不用合并转发
    if (content.length < 100 && !title) {
      return session.send(content)
    }

    try {
      // 准备合并转发消息
      const messages = []

      // 如果有标题，添加标题节点
      if (title) {
        messages.push({
          type: 'node',
          data: {
            name: config.forwardName || 'DDRace 查询助手',
            uin: session.selfId,
            content: title
          }
        })
      }

      // 按内容块分隔消息
      const segments = splitByContentBlocks(content)
      for (const segment of segments) {
        messages.push({
          type: 'node',
          data: {
            name: config.forwardName || 'DDRace 查询助手',
            uin: session.selfId,
            content: segment
          }
        })
      }

      // 发送合并转发消息
      const result = await session.onebot._request('send_forward_msg', {
        message_type: session.isDirect ? 'private' : 'group',
        user_id: session.isDirect ? session.userId : undefined,
        group_id: session.isDirect ? undefined : session.guildId,
        messages: messages
      })

      return result.message_id
    } catch (error) {
      ctx.logger.error('发送合并转发消息失败:', error)
      // 失败时退回到普通消息发送
      return session.send(content)
    }
  }

  /**
   * 将内容按区块分隔
   * @param text 完整文本
   * @returns 分段后的文本数组
   */
  function splitByContentBlocks(text: string): string[] {
    // 如果文本很短，不用分割
    if (text.length < 100) return [text]

    const segments = []
    const lines = text.split('\n')
    let currentSegment = ''
    let currentTitle = ''

    // 检测标题行的正则表达式 - 匹配常见的emoji+标题格式
    // 例如：'📊 排名与分数'、'🗺️ 地图类型统计'、'🏁 最近完成记录'等
    const titleRegex = /^[^\w\s]*[\p{Emoji}\p{Emoji_Presentation}].*[：:].*/u
    const emojiTitleRegex = /^[^\w\s]*[\p{Emoji}\p{Emoji_Presentation}][\s\w]+/u

    // 标题前应该换行的关键词分组
    const groupTogether = {
      '基本信息': ['排名', '分数', '活跃度', '游戏'],
      '地图相关': ['地图类型', '地图统计'],
      '完成记录': ['最近完成', '完成记录'],
      '队友活跃': ['常用队友', '活跃度统计']
    }

    // 处理第一行 - 通常是标题
    if (lines.length > 0 && lines[0].trim()) {
      currentSegment = lines[0]
      currentTitle = 'header'
    }

    // 识别内容段落并分割
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()

      // 跳过空行但保持格式
      if (!line) {
        if (currentSegment) {
          currentSegment += '\n'
        }
        continue
      }

      // 检测是否是新的小节标题
      const isSectionTitle = line.startsWith('\n') || titleRegex.test(line) || emojiTitleRegex.test(line)

      // 如果是新小节，决定是新建段落还是合并到当前段落
      if (isSectionTitle) {
        const titleText = line.replace(/[\p{Emoji}\p{Emoji_Presentation}]/gu, '').trim()
        let shouldGroup = false

        // 检查当前标题是否应与现有段落分组
        for (const [group, keywords] of Object.entries(groupTogether)) {
          const isCurrentInGroup = keywords.some(keyword => currentTitle.includes(keyword))
          const isNewInGroup = keywords.some(keyword => titleText.includes(keyword))

          // 如果都属于同一个组，合并在一起
          if (isCurrentInGroup && isNewInGroup) {
            shouldGroup = true
            break
          }
        }

        // 根据分组逻辑决定是否保存当前段落
        if (!shouldGroup && currentSegment.trim()) {
          segments.push(currentSegment.trim())
          currentSegment = line
          currentTitle = titleText
        } else {
          // 合并到当前段落
          currentSegment += '\n' + line
          // 更新当前标题以便后续判断
          if (!currentTitle) currentTitle = titleText
        }
      } else {
        // 不是小节标题，继续添加到当前段落
        currentSegment += '\n' + line
      }
    }

    // 添加最后一个段落
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim())
    }

    // 处理特殊情况：如果只有一个段落但太长，尝试在内容上进行更智能的分割
    if (segments.length === 1 && segments[0].length > 500) {
      return smartSplitLongSegment(segments[0])
    }

    // 没有成功分段或分段结果不合理时，使用通用逻辑
    if (segments.length === 0 || (segments.length === 1 && text.length > 500)) {
      return genericSplit(text)
    }

    return segments
  }

  /**
   * 智能分割单个长段落
   * @param text 长文本段落
   * @returns 分段后的文本数组
   */
  function smartSplitLongSegment(text: string): string[] {
    const lines = text.split('\n')
    const segments = []
    let currentSegment = ''
    let lineCount = 0

    // 主标题始终单独成段
    if (lines.length > 0) {
      segments.push(lines[0])
      lines.shift()
    }

    // 尝试按逻辑内容分组
    for (const line of lines) {
      // 如果当前段落已经很长或行数超过15行，新起一段
      if ((currentSegment.length > 300 || lineCount > 15) && line.trim() && !line.startsWith('•')) {
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim())
        }
        currentSegment = line
        lineCount = 1
        continue
      }

      currentSegment += '\n' + line
      if (line.trim()) lineCount++
    }

    // 添加最后一个段落
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim())
    }

    return segments
  }

  /**
   * 通用文本分割算法
   * @param text 要分割的文本
   * @returns 分段后的文本数组
   */
  function genericSplit(text: string): string[] {
    // 如果文本不太长，直接返回
    if (text.length < 500) return [text]

    const segments = []
    const lines = text.split('\n')

    // 主标题单独一段
    if (lines.length > 0) {
      segments.push(lines[0])
      lines.shift()
    }

    let currentSegment = ''
    const maxLength = 500

    for (const line of lines) {
      // 如果加上当前行会超出长度限制，先保存当前段落
      if (currentSegment.length + line.length + 1 > maxLength && currentSegment.length > 0) {
        segments.push(currentSegment.trim())
        currentSegment = ''
      }

      // 添加当前行
      if (currentSegment.length > 0) {
        currentSegment += '\n' + line
      } else {
        currentSegment = line
      }
    }

    // 添加最后一个段落
    if (currentSegment.trim().length > 0) {
      segments.push(currentSegment.trim())
    }

    return segments
  }

  /**
   * 处理通用查询并根据配置决定返回文本或图片
   * @param data 待显示的数据
   * @param formatText 文本格式化函数
   * @param formatHtml 可选的HTML格式化函数
   * @param useToggle 是否切换显示模式
   * @param session 会话对象
   * @returns 格式化后的消息
   */
  async function handleQuery(data: any, formatText: (data: any, config?: Config) => string,
                           formatHtml?: (data: any, config?: Config) => string,
                           useToggle?: boolean, session?: any): Promise<string | h> {
    // 确定是否使用图片模式
    const useImage = shouldUseVisualMode(useToggle)

    if (useImage && formatHtml) {
      try {
        await session.send(`正在生成信息图片，请稍候...`)
        const htmlContent = formatHtml(data, config)
        const imageBuffer = await htmlToImage(htmlContent, ctx)
        return h.image(imageBuffer, 'image/png')
      } catch (error) {
        ctx.logger.error('图片生成失败:', error)
        await session.send('图片生成失败，将以文字显示...')
        const textContent = formatText(data, config)

        // 如果启用了合并转发，使用合并转发发送文本
        if (config.useForward && session?.onebot) {
          const title = `${data.player || data.name || '查询'} 的信息`
          await sendForwardMessage(session, textContent, title)
          return ''
        }
        return textContent
      }
    } else {
      const textContent = formatText(data, config)

      // 如果启用了合并转发，使用合并转发发送文本
      if (config.useForward && session?.onebot) {
        const title = `${data.player || data.name || '查询'} 的信息`
        await sendForwardMessage(session, textContent, title)
        return ''
      }
      return textContent
    }
  }

  // 获取描述-v选项的文字
  const toggleDescription = config.useImage
    ? '-v 切换为文本模式显示'
    : '-v 切换为图片模式显示'

  // 主命令组
  const cmd = ctx.command('ddr [player:text]', '查询 DDNet 玩家信息')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, player) => {
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
        return await handleQuery(
          playerData,
          formatPlayerSummary,
          playerDataToHtml,
          options.visual,
          session
        )
      } catch (error) {
        ctx.logger.error('查询失败:', error)
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  // 其他子命令
  cmd.subcommand('.bind [player:text]', '绑定或解绑 DDNet 玩家')
    .action(async ({ session }, player) => {
      // 不需要添加-v选项，绑定命令不涉及数据展示
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

  cmd.subcommand('.points [player:text]', '查询玩家的分数')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        // 分数信息较为简洁，不提供专门的HTML渲染，使用文本显示
        return formatScoreBrief(playerData, config)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  cmd.subcommand('.pointsAll [player:text]', '查询玩家的详细分数信息')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        // 可以为详细分数信息添加专门的HTML渲染函数，但当前先使用文本
        return formatScoreDetailed(playerData, config)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })

  cmd.subcommand('.maprank <map:text> [player:text]', '查询玩家在特定地图的排名')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, map, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      if (!map) {
        return '请指定地图名称'
      }

      try {
        const recordData = await fetchPlayerMapRecord(map, player)
        // 地图排名信息较简单，当前使用文本显示
        return formatPlayerMapRecord(recordData.map, recordData.player)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称和玩家ID是否正确'
      }
    })

  // 添加地图信息查询命令
  cmd.subcommand('.map <map:text>', '查询地图详细信息')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, map) => {
      if (!map) {
        return '请指定地图名称'
      }

      try {
        const mapData = await fetchMapData(map)
        // 地图信息较复杂，适合图片展示，但当前使用文本
        return formatMapInfo(mapData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称'
      }
    })

  // 修改原有地图排行榜查询，使用优化后的展示
  cmd.subcommand('.topmap <map:text>', '查询地图的全球排行榜')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, map) => {
      if (!map) {
        return '请指定地图名称'
      }

      try {
        const mapData = await fetchMapData(map)
        // 排行榜信息较表格化，适合图片展示，但当前使用文本
        return formatMapLeaderboard(mapData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查地图名称'
      }
    })

  cmd.subcommand('.MapFinish [player:text]', '查询玩家的地图完成度统计')
    .option('visual', toggleDescription, { fallback: undefined })
    .action(async ({ session, options }, player) => {
      player = player || getBoundId(session.userId)

      if (!player) {
        return '请指定玩家ID或先绑定玩家'
      }

      try {
        const playerData = await fetchPlayerData(player)
        // 地图完成度较简单，当前使用文本显示
        return formatMapCompletion(playerData)
      } catch (error) {
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查玩家ID或稍后重试'
      }
    })
}
