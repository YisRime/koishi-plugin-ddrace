import { Context, Schema, h } from 'koishi'
import https from 'https'
import { formatPlayerSummary, formatMapInfo } from './text'
import { playerDataToHtml, htmlToImage, mapInfoToHtml } from './image'

export const name = 'ddrace'
export const inject = { optional: ['puppeteer'] }

export const usage = `
<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #4a6ee0;">📌 插件说明</h2>
  <p>📖 <strong>使用文档</strong>：请点击左上角的 <strong>插件主页</strong> 查看插件使用文档</p>
  <p>🔍 <strong>更多插件</strong>：可访问 <a href="https://github.com/YisRime" style="color:#4a6ee0;text-decoration:none;">苡淞的 GitHub</a> 查看本人的所有插件</p>
</div>

<div style="border-radius: 10px; border: 1px solid #ddd; padding: 16px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
  <h2 style="margin-top: 0; color: #e0574a;">❤️ 支持与反馈</h2>
  <p>🌟 喜欢这个插件？请在 <a href="https://github.com/YisRime" style="color:#e0574a;text-decoration:none;">GitHub</a> 上给我一个 Star！</p>
  <p>🐛 遇到问题？请通过 <strong>Issues</strong> 提交反馈，或加入 QQ 群 <a href="https://qm.qq.com/q/PdLMx9Jowq" style="color:#e0574a;text-decoration:none;"><strong>855571375</strong></a> 进行交流</p>
</div>
`

/**
 * 插件配置接口
 */
export interface Config {
  // 消息发送配置
  messageSendType?: 'image' | 'forward' | 'text'
  // 玩家信息显示配置
  showRankInfo?: boolean
  showActivityInfo?: boolean
  showGameInfo?: boolean
  showMapTypeStats?: boolean
  recentFinishesCount?: number
  favoritePartnersCount?: number
  showActivityStats?: boolean
  mapDetailsCount?: number
  // 地图信息显示配置
  showMapBasicInfo?: boolean
  showMapStats?: boolean
  globalRanksCount?: number
  chinaRanksCount?: number
  teamRanksCount?: number
  multiFinishersCount?: number
  showMapFeatures?: boolean
  showMapLinks?: boolean
}

export const Config: Schema<Config> = Schema.intersect([
  // 消息发送配置
  Schema.object({
    messageSendType: Schema.union([
      Schema.const('image' as const).description('图片'),
      Schema.const('forward' as const).description('合并转发'),
      Schema.const('text' as const).description('文本')
    ]).description('消息发送形式').default('forward')
  }).description('消息发送配置'),
  // 玩家信息显示配置
  Schema.object({
    showRankInfo: Schema.boolean()
      .description('显示排名与积分').default(true),
    showGameInfo: Schema.boolean()
      .description('显示游戏信息').default(true),
    showActivityStats: Schema.boolean()
      .description('显示活跃度统计').default(true),
    showActivityInfo: Schema.boolean()
      .description('显示近期活跃度').default(true),
    showMapTypeStats: Schema.boolean()
      .description('显示地图完成统计').default(true),
    mapDetailsCount: Schema.number()
      .description('显示地图名称的数量').default(10),
    recentFinishesCount: Schema.number()
      .description('显示最近通关记录的数量').default(-1).max(10),
    favoritePartnersCount: Schema.number()
      .description('显示常用队友的数量').default(-1).max(10),
  }).description('玩家信息显示配置'),
  // 地图信息显示配置
  Schema.object({
    showMapBasicInfo: Schema.boolean()
      .description('显示地图信息').default(true),
    showMapFeatures: Schema.boolean()
      .description('显示地图特性').default(true),
    showMapLinks: Schema.boolean()
      .description('显示相关链接').default(true),
    showMapStats: Schema.boolean()
      .description('显示完成统计').default(true),
    globalRanksCount: Schema.number()
      .description('显示全球排名的数量').default(-1).max(20),
    chinaRanksCount: Schema.number()
      .description('显示国服排名的数量').default(-1).max(20),
    teamRanksCount: Schema.number()
      .description('显示团队排名的数量').default(-1).max(20),
    multiFinishersCount: Schema.number()
      .description('显示多次完成玩家的数量').default(-1).max(20),
  }).description('地图信息显示配置'),
])

export async function apply(ctx: Context, config: Config) {
  const canRenderImages = ctx.puppeteer != null

  /**
   * 通用 HTTP GET 请求函数
   * @param url 请求URL
   * @returns Promise 解析为响应数据
   */
  function httpGet(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        const statusCode = res.statusCode || 500
        // 检查状态码
        if (statusCode >= 400) {
          return reject(new Error(`请求失败，状态码: ${statusCode}`))
        }
        let data = '';
        // 接收数据
        res.on('data', (chunk) => {
          data += chunk;
        });
        // 数据接收完成
        res.on('end', () => {
          try {
            const parsedData = JSON.parse(data);
            resolve(parsedData);
          } catch (e) {
            reject(new Error('解析数据失败，请稍后重试'));
          }
        });
      }).on('error', (err) => {
        reject(new Error(`网络请求失败: ${err.message}`));
      });
    });
  }

  /**
   * 将长文本分割成合适大小的段落
   * @param text 要分割的文本
   * @returns 分割后的文本数组
   */
  function splitTextContent(text: string): string[] {
    if (text.length < 100) return [text];
    const blocks = text.split(/\n\n(?=[\p{Emoji}\p{Emoji_Presentation}])/u);
    const segments = [];
    let currentSegment = '';
    for (const block of blocks) {
      if (currentSegment.length + block.length > 800 && currentSegment.length > 0) {
        segments.push(currentSegment.trim());
        currentSegment = block;
      } else {
        currentSegment += (currentSegment ? '\n\n' : '') + block;
      }
    }
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }
    return segments.length ? segments : [text];
  }

  /**
   * 通过合并转发发送长文本
   * @param session 会话对象
   * @param textContent 文本内容
   * @param title 转发消息标题
   * @returns 消息ID或文本内容
   */
  async function sendForwardMsg(session: any, textContent: string, title?: string): Promise<string> {
    if (!session?.onebot) return textContent;
    try {
      const messages = [];
      if (title) {
        messages.push({
          type: 'node',
          data: {
            name: 'DDRace 查询',
            uin: session.selfId,
            content: title
          }
        });
      }
      const segments = splitTextContent(textContent);
      for (const segment of segments) {
        messages.push({
          type: 'node',
          data: {
            name: 'DDRace 查询',
            uin: session.selfId,
            content: segment
          }
        });
      }
      const result = await session.onebot._request('send_forward_msg', {
        message_type: session.isDirect ? 'private' : 'group',
        user_id: session.isDirect ? session.userId : undefined,
        group_id: session.isDirect ? undefined : session.guildId,
        messages: messages
      });
      return result.message_id;
    } catch (error) {
      ctx.logger.error('发送合并转发消息失败:', error);
      return textContent;
    }
  }

  /**
   * 处理通用查询并自动处理回退逻辑
   * @param data 待显示的数据
   * @param formatText 文本格式化函数
   * @param formatHtml 可选的HTML格式化函数
   * @param session 会话对象
   * @returns 格式化后的消息
   */
  async function handleQuery(data: any, formatText: (data: any, config?: Config) => string,
                           formatHtml?: (data: any, config?: Config) => string,
                           session?: any): Promise<string | h> {
    // 根据配置选择发送形式
    switch (config.messageSendType) {
      case 'image':
        // 尝试生成图片
        if (canRenderImages && formatHtml) {
          try {
            const htmlContent = formatHtml(data, config);
            const imageBuffer = await htmlToImage(htmlContent, ctx);
            return h.image(imageBuffer, 'image/png');
          } catch (error) {
            ctx.logger.error('图片生成失败，回退到合并转发:', error);
          }
        }
      case 'forward':
        // 仅当需要合并转发时才生成文本
        if (session) {
          const textContent = formatText(data, config);
          if (textContent.length > 100) {
            try {
              const title = `${data.player || data.name || '查询'} 的信息`;
              const result = await sendForwardMsg(session, textContent, title);
              return result;
            } catch (error) {
              ctx.logger.error('合并转发失败，回退到纯文本:', error);
              // 回退到纯文本
              return textContent;
            }
          }
          // 文本长度不足以合并转发
          return textContent;
        }
      default:
        // 文本模式，生成并返回文本
        return formatText(data, config);
    }
  }

  /**
   * 查询玩家信息
   * @param player 玩家ID
   * @param session 会话对象
   */
  async function queryPlayer(player: string, session: any) {
    try {
      const url = `https://ddnet.org/players/?json2=${encodeURIComponent(player)}`
      const playerData = await httpGet(url)
      if (!playerData || !playerData.player) {
        throw new Error(`未找到玩家 "${player}"`)
      }
      return await handleQuery(
        playerData,
        formatPlayerSummary,
        playerDataToHtml,
        session
      )
    } catch (error) {
      throw new Error(typeof error === 'object' && error.message
        ? error.message
        : `查询玩家 "${player}" 失败`)
    }
  }

  /**
   * 查询地图信息
   * @param map 地图名称
   * @param session 会话对象
   */
  async function queryMap(map: string, session: any) {
    try {
      const url = `https://ddnet.org/maps/?json=${encodeURIComponent(map)}`
      const mapData = await httpGet(url)
      if (!mapData || !mapData.name) {
        throw new Error(`未找到地图 "${map}"`)
      }
      return await handleQuery(
        mapData,
        formatMapInfo,
        mapInfoToHtml,
        session
      )
    } catch (error) {
      throw new Error(typeof error === 'object' && error.message
        ? error.message
        : `查询地图 "${map}" 失败`)
    }
  }

  // 支持玩家和地图查询
  ctx.command('ddr <query:text>', 'DDRace 查询')
    .option('player', '-p 仅搜索玩家', { type: 'boolean' })
    .option('map', '-m 仅搜索地图', { type: 'boolean' })
    .usage('查询 DDRace 中的玩家或地图信息\n先尝试查询玩家再尝试查询地图')
    .action(async ({ session, options }, query) => {
      if (!query) {
        return '请指定玩家或地图'
      }
      // 根据选项决定查询方式
      if (options.player) {
        // 仅查询玩家
        try {
          return await queryPlayer(query, session)
        } catch (error) {
          return typeof error === 'object' && error.message
            ? error.message
            : `查询玩家 "${query}" 失败`
        }
      } else if (options.map) {
        // 仅查询地图
        try {
          return await queryMap(query, session)
        } catch (error) {
          return typeof error === 'object' && error.message
            ? error.message
            : `查询地图 "${query}" 失败`
        }
      } else {
        // 先尝试查询玩家，再查询地图
        try {
          return await queryPlayer(query, session)
        } catch (playerError) {
          try {
            return await queryMap(query, session)
          } catch (mapError) {
            return `未找到与 "${query}" 匹配的玩家或地图`
          }
        }
      }
    })
}