import { Context, Schema, h } from 'koishi'
import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { formatPlayerInfo } from './formatter'
import { formatPlayerInfoToHtml, renderToImage } from './renderer'

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
interface BindingsData {
  [userId: string]: string
}

export async function apply(ctx: Context, config: Config) {
  const bindingsFilePath = path.join(ctx.baseDir, 'data', 'ddrace.json')
  const hasRendering = ctx.puppeteer != null

  // 加载绑定数据
  function loadBindings(): BindingsData {
    try {
      if (fs.existsSync(bindingsFilePath)) {
        return JSON.parse(fs.readFileSync(bindingsFilePath, 'utf8')) as BindingsData
      }
    } catch (error) {
      ctx.logger.error(`无法加载绑定数据: ${error}`)
    }
    return {}
  }

  // 保存绑定数据
  function saveBindings(data: BindingsData): void {
    try {
      fs.writeFileSync(bindingsFilePath, JSON.stringify(data, null, 2), 'utf8')
    } catch (error) {
      ctx.logger.error(`无法保存绑定数据: ${error}`)
    }
  }

  // 获取绑定昵称
  function getBoundNickname(userId: string): string | null {
    const data = loadBindings()
    return data[userId] || null
  }

  // 绑定昵称
  function bindNickname(userId: string, nickname: string): void {
    const data = loadBindings()
    data[userId] = nickname
    saveBindings(data)
  }

  // 解除绑定
  function unbindNickname(userId: string): boolean {
    const data = loadBindings()
    if (userId in data) {
      delete data[userId]
      saveBindings(data)
      return true
    }
    return false
  }

  /**
   * 查询玩家数据
   * @param playerName 玩家名称
   * @returns 玩家数据对象
   * @throws 如果查询失败或玩家不存在
   */
  async function queryPlayer(playerName: string): Promise<any> {
    const url = `https://ddnet.org/players/?json2=${encodeURIComponent(playerName)}`
    const response = await axios.get(url)
    const data = response.data

    if (!data || !data.player) {
      throw new Error(`未找到玩家 ${playerName}`)
    }

    return data
  }

  /**
   * 处理图片渲染请求
   * @param data 玩家数据
   * @param session 会话对象
   * @returns 渲染后的图片元素
   */
  async function handleImageRequest(data: any, session: any): Promise<h> {
    await session.send(`正在生成玩家 ${data.player} 的信息，请稍候...`)
    const html = formatPlayerInfoToHtml(data)
    const imageBuffer = await renderToImage(html, ctx)
    return h.image(imageBuffer, 'image/png')
  }

  // 简化后的命令组
  const cmd = ctx.command('ddr [player:string]', '查询 DDNet 玩家信息')
    .action(async ({ session }, player) => {
      if (!player) {
        if (!session?.userId) {
          return '请输入要查询的玩家昵称'
        }

        const boundNickname = getBoundNickname(session.userId)
        if (!boundNickname) {
          return '请先绑定玩家，或输入要查询的玩家昵称'
        }
        player = boundNickname
      }

      try {
        const data = await queryPlayer(player)
        const useImage = config.useImage && hasRendering

        if (useImage) {
          try {
            return await handleImageRequest(data, session)
          } catch (error) {
            ctx.logger.error('图片生成失败:', error)
            await session.send('图片生成失败，将以文字显示...')
            return formatPlayerInfo(data)
          }
        } else {
          return formatPlayerInfo(data)
        }
      } catch (error) {
        ctx.logger.error('查询失败:', error)
        return typeof error === 'object' && error.message
          ? error.message
          : '查询失败，请检查昵称或稍后重试'
      }
    })

  cmd.subcommand('.bind [player:string]', '绑定或解绑 DDNet 玩家')
    .action(async ({ session }, player) => {
      if (!player) {
        const boundNickname = getBoundNickname(session.userId)
        if (!boundNickname) {
          return '您尚未绑定 DDNet 玩家'
        }

        if (unbindNickname(session.userId)) {
          return `已成功解绑玩家 ${boundNickname}`
        } else {
          return '解绑失败'
        }
      }

      try {
        const { data } = await axios.get(`https://ddnet.org/players/?json2=${encodeURIComponent(player)}`)
        if (!data?.player) {
          return `未找到玩家 ${player}，请检查昵称或稍后重试`
        }

        bindNickname(session.userId, data.player)
        return `已成功绑定玩家 ${data.player}`
      } catch (error) {
        return '绑定失败，请检查昵称或稍后重试'
      }
    })
}
