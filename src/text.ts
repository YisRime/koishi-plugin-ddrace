/**
 * DDNet玩家数据格式化模块
 */

import { Config } from '.'

/**
 * 基础格式化工具
 */
export const formatter = {
  /**
   * 时间转换为字符串
   * @param seconds 秒数(可包含小数)
   */
  time(seconds: number): string {
    if (typeof seconds !== 'number') return '未知时间'

    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000)

    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  },

  /**
   * 将Unix时间戳转换为日期字符串
   * @param timestamp Unix时间戳(秒)
   * @param format 格式类型
   */
  date(timestamp: number, format: 'short' | 'full' | 'year' = 'full'): string {
    if (!timestamp) return '未知时间'

    try {
      const date = new Date(timestamp * 1000)

      switch (format) {
        case 'short':
          return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
        case 'year':
          return `${date.getFullYear()}年${(date.getMonth()+1)}月${date.getDate()}日`
        case 'full':
        default:
          return date.toLocaleString('zh-CN')
      }
    } catch {
      return '日期格式错误'
    }
  },

  /**
   * 格式化部分标题
   * @param title 标题内容
   */
  section(title: string): string {
    return `\n${title}\n`
  },

  /**
   * 生成进度百分比
   * @param current 当前值
   * @param total 总值
   */
  percentage(current: number, total: number): string {
    if (!total) return `${current} 项`
    const percent = ((current / total) * 100).toFixed(1)
    return `${current}/${total} (${percent}%)`
  }
}

// 导出别名保持向后兼容
export const timeToString = formatter.time
export const dateToString = formatter.date

/**
 * 将玩家数据格式化为文本摘要
 * @param playerData - DDNet API返回的玩家数据对象
 * @param config - 显示配置
 * @returns 格式化后的文本字符串
 */
export function formatPlayerSummary(playerData: any, config?: Config): string {
  const playerId = playerData.player
  let summary = `🏆 ${playerId} 的 DDNet 信息\n`

  // 应用默认配置（如果未提供）
  const displayConfig = {
    showRankInfo: config?.showRankInfo !== false,
    showActivityInfo: config?.showActivityInfo !== false,
    showGameInfo: config?.showGameInfo !== false,
    showMapTypeStats: config?.showMapTypeStats !== false,
    showRecentFinishes: config?.showRecentFinishes !== false,
    showFavoritePartners: config?.showFavoritePartners !== false,
    showActivityStats: config?.showActivityStats !== false,
    showMapDetails: config?.showMapDetails !== false
  }

  // 排名与分数信息
  if (displayConfig.showRankInfo) {
    summary += formatter.section('📊 排名与分数')

    // 总分信息
    if (playerData.points && typeof playerData.points === 'object') {
      const total = playerData.points.total || 0
      const rank = playerData.points.rank || '未排名'
      const points = playerData.points.points || 0
      summary += `• 总分: ${points}/${total} (全球第 ${rank} 名)\n`
    }

    // 个人与团队排名
    if (playerData.rank?.rank) {
      summary += `• 个人排名: 第 ${playerData.rank.rank} 名 (${playerData.rank.points || 0} 分)\n`
    }

    if (playerData.team_rank?.rank) {
      summary += `• 团队排名: 第 ${playerData.team_rank.rank} 名 (${playerData.team_rank.points || 0} 分)\n`
    }
  }

  // 最近活跃度
  if (displayConfig.showActivityInfo) {
    const hasRecentActivity = playerData.points_last_year || playerData.points_last_month || playerData.points_last_week
    if (hasRecentActivity) {
      summary += formatter.section('📅 最近活跃度')

      if (playerData.points_last_year?.points) {
        summary += `• 过去一年: ${playerData.points_last_year.points} 分 (第 ${playerData.points_last_year.rank || '?'} 名)\n`
      }

      if (playerData.points_last_month?.points) {
        summary += `• 过去一月: ${playerData.points_last_month.points} 分 (第 ${playerData.points_last_month.rank || '?'} 名)\n`
      }

      if (playerData.points_last_week?.rank) {
        summary += `• 过去一周: ${playerData.points_last_week.points || 0} 分 (第 ${playerData.points_last_week.rank} 名)\n`
      } else {
        summary += `• 过去一周: 暂无排名\n`
      }
    }
  }

  // 游戏基本信息
  if (displayConfig.showGameInfo) {
    summary += formatter.section('🎮 游戏信息')

    // 常用服务器
    if (playerData.favorite_server) {
      const server = typeof playerData.favorite_server === 'object'
        ? (playerData.favorite_server.server || JSON.stringify(playerData.favorite_server))
        : playerData.favorite_server
      summary += `• 常用服务器: ${server}\n`
    }

    // 游戏时间
    if (playerData.hours_played_past_365_days !== undefined) {
      summary += `• 年度游戏时间: ${playerData.hours_played_past_365_days} 小时\n`
    }

    // 首次完成
    if (playerData.first_finish) {
      const formattedDate = formatter.date(playerData.first_finish.timestamp, 'year')
      const map = playerData.first_finish.map
      const timeStr = formatter.time(playerData.first_finish.time)
      summary += `• 首次完成: ${formattedDate} ${map} (${timeStr})\n`
    }
  }

  // 地图统计
  if (displayConfig.showMapTypeStats && playerData.types && typeof playerData.types === 'object') {
    summary += formatter.section('🗺️ 地图类型统计')

    Object.entries(playerData.types).forEach(([typeName, typeInfo]: [string, any]) => {
      if (!typeInfo?.maps) return

      const mapCount = Object.keys(typeInfo.maps).length
      let typePoints = 0
      let typeRank = '未排名'

      // 计算分数
      if (typeInfo.points) {
        if (typeof typeInfo.points === 'object') {
          typePoints = typeInfo.points.points || typeInfo.points.total || 0
        } else {
          typePoints = typeInfo.points
        }
      }

      // 解析排名
      if (typeInfo.rank?.rank) {
        typeRank = `第 ${typeInfo.rank.rank} 名`
      }

      // 显示地图统计
      summary += `• ${typeName}: ${typePoints} 分 (${typeRank}), 完成 ${mapCount} 张地图\n`

      // 列出部分地图
      if (mapCount > 0 && displayConfig.showMapDetails) {
        const mapNames = Object.keys(typeInfo.maps).slice(0, 10)
        summary += `  包括: ${mapNames.join(', ')}${mapCount > 10 ? ' 等...' : ''}\n`
      }
    })
  }

  // 最近完成记录
  if (displayConfig.showRecentFinishes && playerData.last_finishes?.length > 0) {
    summary += formatter.section(`🏁 最近完成记录 (${playerData.last_finishes.length}项)`)

    const records = playerData.last_finishes.slice(0, 5)
    records.forEach((finish: any) => {
      if (finish.timestamp && finish.map) {
        const formattedDate = formatter.date(finish.timestamp, 'short')
        const timeStr = formatter.time(finish.time)
        summary += `• ${finish.map} (${finish.country || ''} ${finish.type || ''}) - ${formattedDate} - ${timeStr}\n`
      }
    })
  }

  // 常用队友
  if (displayConfig.showFavoritePartners && playerData.favorite_partners?.length > 0) {
    summary += formatter.section(`👥 常用队友 (${playerData.favorite_partners.length}位)`)

    playerData.favorite_partners.slice(0, 5).forEach((partner: any) => {
      if (partner.name && partner.finishes) {
        summary += `• ${partner.name}: ${partner.finishes} 次合作\n`
      }
    })
  }

  // 活跃度统计
  if (displayConfig.showActivityStats && playerData.activity?.length > 0) {
    let totalHours = 0
    let maxHours = 0
    let activeDays = 0
    let activeMonths = new Set()

    playerData.activity.forEach((day: any) => {
      if (day?.hours_played) {
        totalHours += day.hours_played
        maxHours = Math.max(maxHours, day.hours_played)

        if (day.hours_played > 0) {
          activeDays++
          if (day.date) {
            const month = day.date.substring(0, 7)
            activeMonths.add(month)
          }
        }
      }
    })

    const avgHours = activeDays > 0 ? (totalHours / activeDays).toFixed(1) : "0"

    summary += formatter.section('📊 活跃度统计')
    summary += `• 活跃天数: ${activeDays} 天\n`
    summary += `• 活跃月数: ${activeMonths.size} 个月\n`
    summary += `• 单日最长游戏: ${maxHours} 小时\n`
    summary += `• 平均每日游戏: ${avgHours} 小时\n`
  }

  return summary
}

/**
 * 格式化玩家的分数信息（简洁版本）
 * @param playerData - DDNet API返回的玩家数据对象
 * @param config - 显示配置
 * @returns 格式化后的简洁分数文本
 */
export function formatScoreBrief(playerData: any, config?: Config): string {
  const playerId = playerData.player || "未知玩家ID"
  let result = `🎮 ${playerId} 的分数统计\n\n`

  if (playerData.points?.points !== undefined) {
    result += `总分: ${playerData.points.points}/${playerData.points.total} (全球第 ${playerData.points.rank} 名)\n`
  }

  if (playerData.rank?.points) {
    result += `个人排名: 第 ${playerData.rank.rank} 名 (${playerData.rank.points} 分)\n`
  }

  if (playerData.team_rank?.points) {
    result += `团队排名: 第 ${playerData.team_rank.rank} 名 (${playerData.team_rank.points} 分)\n`
  }

  return result
}

/**
 * 格式化玩家的详细分数信息
 * @param playerData - DDNet API返回的玩家数据对象
 * @param config - 显示配置
 * @returns 格式化后的详细分数文本
 */
export function formatScoreDetailed(playerData: any, config?: Config): string {
  const playerId = playerData.player || "未知玩家ID"
  let result = `🏆 ${playerId} 的详细分数信息\n\n`

  // 应用默认配置（如果未提供）
  const displayConfig = {
    showRankInfo: config?.showRankInfo !== false,
    showActivityInfo: config?.showActivityInfo !== false,
    showRecentFinishes: config?.showRecentFinishes !== false
  }

  // 总分与排名
  if (displayConfig.showRankInfo) {
    if (playerData.points?.points !== undefined) {
      result += `📊 总分: ${playerData.points.points}/${playerData.points.total} (全球第 ${playerData.points.rank} 名)\n`
    }

    // 个人与团队排名
    if (playerData.rank?.points) {
      result += `个人排名: 第 ${playerData.rank.rank} 名 (${playerData.rank.points} 分)\n`
    }

    if (playerData.team_rank?.points) {
      result += `团队排名: 第 ${playerData.team_rank.rank} 名 (${playerData.team_rank.points} 分)\n`
    }
  }

  // 近一年/月/周分数
  if (displayConfig.showActivityInfo) {
    result += formatter.section('📅 近期活跃度')

    if (playerData.points_last_year?.points) {
      result += `过去一年: ${playerData.points_last_year.points} 分 (第 ${playerData.points_last_year.rank} 名)\n`
    }

    if (playerData.points_last_month?.points) {
      result += `过去一月: ${playerData.points_last_month.points} 分 (第 ${playerData.points_last_month.rank} 名)\n`
    }

    if (playerData.points_last_week?.points) {
      result += `过去一周: ${playerData.points_last_week.points} 分 (第 ${playerData.points_last_week.rank} 名)\n`
    }
  }

  // 最近完成记录
  if (displayConfig.showRecentFinishes && playerData.last_finishes?.length > 0) {
    result += formatter.section('🏁 最近完成')

    playerData.last_finishes.slice(0, 5).forEach((finish: any, index: number) => {
      if (!finish.timestamp || !finish.map) return

      const formattedDate = formatter.date(finish.timestamp, 'short')
      const timeStr = formatter.time(finish.time)
      result += `${index + 1}. ${finish.map} (${finish.type || '未知'}) - ${timeStr} - ${formattedDate}\n`
    })
  }

  return result
}

/**
 * 格式化玩家在特定地图的排名信息
 * @param mapData - 地图数据
 * @param playerRecord - 玩家完成记录
 * @returns 格式化后的地图排名文本
 */
export function formatPlayerMapRecord(mapData: any, playerRecord: any): string {
  const playerId = playerRecord.name || "未知玩家ID"
  let result = `🗺️ ${playerId} 在地图 ${mapData.name} 的排名\n\n`
  const timeStr = formatter.time(playerRecord.time)

  result += `排名: 第 ${playerRecord.rank} 名 (共 ${mapData.finishes.length} 人完成)\n`
  result += `完成时间: ${timeStr}\n`
  result += `地图类型: ${mapData.type || '未知'}\n`
  result += `难度级别: ${mapData.difficulty || '未知'}\n`

  if (playerRecord.timestamp) {
    result += `完成日期: ${formatter.date(playerRecord.timestamp, 'short')}\n`
  }

  return result
}

/**
 * 格式化地图详细信息
 * @param mapData - 地图数据
 * @returns 格式化后的地图信息文本
 */
export function formatMapInfo(mapData: any): string {
  if (!mapData || !mapData.name) {
    return '地图数据不完整或无效'
  }

  const stars = '★'.repeat(mapData.difficulty || 0) + '☆'.repeat(Math.max(0, 5 - (mapData.difficulty || 0)))
  let result = `🗺️ 地图「${mapData.name}」信息\n\n`

  // 基本信息
  result += `类型: ${mapData.type || '未知'} (${stars})\n`
  result += `作者: ${mapData.mapper || '未知'}\n`
  result += `分值: ${mapData.points || 0} 分\n`

  // 发布日期
  if (mapData.release) {
    result += `发布日期: ${formatter.date(mapData.release, 'short')}\n`
  }

  // 完成统计
  result += formatter.section('📊 完成统计')
  result += `总完成次数: ${mapData.finishes || 0}\n`
  result += `完成玩家数: ${mapData.finishers || 0}\n`

  if (mapData.median_time) {
    result += `平均完成时间: ${formatter.time(mapData.median_time)}\n`
  }

  if (mapData.first_finish) {
    result += `首次完成时间: ${formatter.date(mapData.first_finish, 'short')}\n`
  }

  // 排行榜 - 全球前五
  if (mapData.ranks && mapData.ranks.length > 0) {
    result += formatter.section('🏆 全球排名')

    const topRanks = mapData.ranks.slice(0, 5)
    topRanks.forEach((rank, idx) => {
      if (rank.player && rank.time) {
        const countryTag = rank.country ? `[${rank.country}] ` : ''
        const timeStr = formatter.time(rank.time)
        const dateStr = rank.timestamp ? ` (${formatter.date(rank.timestamp, 'short')})` : ''
        result += `${idx + 1}. ${countryTag}${rank.player} - ${timeStr}${dateStr}\n`
      }
    })

    // 是否有更多玩家完成
    const remainingPlayers = (mapData.ranks.length - 5)
    if (remainingPlayers > 0) {
      result += `... 及其他 ${remainingPlayers} 名玩家\n`
    }
  }

  // 国服玩家专属排行
  const chinaPlayers = mapData.ranks?.filter(r => r.country === 'CHN') || []
  if (chinaPlayers.length > 0) {
    result += formatter.section('🇨🇳 国服排名')

    chinaPlayers.slice(0, 5).forEach((rank, idx) => {
      const timeStr = formatter.time(rank.time)
      const globalRank = mapData.ranks.findIndex(r => r.player === rank.player) + 1
      result += `${idx + 1}. ${rank.player} - ${timeStr} (全球第 ${globalRank} 名)\n`
    })

    // 是否有更多中国玩家
    if (chinaPlayers.length > 5) {
      result += `... 及其他 ${chinaPlayers.length - 5} 名国服玩家\n`
    }
  }

  // 地图特性
  if (mapData.tiles && mapData.tiles.length > 0) {
    result += formatter.section('🧩 地图特性')
    result += `尺寸: ${mapData.width || '?'} × ${mapData.height || '?'}\n`
    result += `特殊方块: ${mapData.tiles.slice(0, 6).join(', ')}${mapData.tiles.length > 6 ? ' 等' : ''}\n`
  }

  // 链接信息
  result += formatter.section('🔗 相关链接')
  if (mapData.website) {
    result += `• 地图详情: ${mapData.website}\n`
  }
  if (mapData.web_preview) {
    result += `• 地图预览: ${mapData.web_preview}\n`
  }

  return result
}

/**
 * 格式化地图排行榜信息（基于已有函数优化）
 * @param mapData - 地图数据
 * @returns 格式化后的地图排行榜文本
 */
export function formatMapLeaderboard(mapData: any): string {
  let result = `🏆 地图 ${mapData.name} 的排行榜\n\n`

  // 地图基本信息
  const stars = '★'.repeat(mapData.difficulty || 0) + '☆'.repeat(Math.max(0, 5 - (mapData.difficulty || 0)))
  result += `类型: ${mapData.type || '未知'} (${stars})\n`
  result += `难度: ${mapData.difficulty || '未知'}/5 • 分值: ${mapData.points || 0}\n\n`

  if (!mapData.ranks?.length) {
    return `${result}该地图暂无完成记录`
  }

  // 全球前十
  result += '🌍 全球前十:\n'
  mapData.ranks.slice(0, 10).forEach((finish: any, index: number) => {
    const timeStr = formatter.time(finish.time)
    const dateStr = finish.timestamp ? ` (${formatter.date(finish.timestamp, 'short')})` : ''
    result += `${index + 1}. ${finish.player} - ${timeStr} ${finish.country ? `[${finish.country}]` : ''}${dateStr}\n`
  })

  // 中国服务器前五
  const chinaFinishes = mapData.ranks.filter((finish: any) => finish.country === 'CHN')
  if (chinaFinishes.length > 0) {
    result += '\n🇨🇳 国服前五:\n'
    chinaFinishes.slice(0, 5).forEach((finish: any, index: number) => {
      const timeStr = formatter.time(finish.time)
      const globalRank = mapData.ranks.findIndex((f: any) => f.player === finish.player) + 1
      result += `${index + 1}. ${finish.name || finish.player} - ${timeStr} (全球第 ${globalRank} 名)\n`
    })
  } else {
    result += '\n🇨🇳 国服暂无完成记录'
  }

  // 地图统计数据
  result += formatter.section('📊 地图统计')
  result += `总完成次数: ${mapData.finishes || 0}\n`
  result += `完成玩家数: ${mapData.finishers || 0}\n`

  if (mapData.median_time) {
    result += `平均完成时间: ${formatter.time(mapData.median_time)}\n`
  }

  return result
}

/**
 * 格式化玩家地图完成度统计
 * @param playerData - DDNet API返回的玩家数据对象
 * @returns 格式化后的地图完成度文本
 */
export function formatMapCompletion(playerData: any): string {
  const playerId = playerData.player || "未知玩家ID"

  if (!playerData.types) {
    return `${playerId} 尚未完成任何地图`
  }

  let result = `🗺️ ${playerId} 的地图完成度统计\n\n`

  // 计算总完成情况
  let completedMaps = 0
  let totalTypes = 0

  Object.entries(playerData.types).forEach(([, typeInfo]: [string, any]) => {
    if (typeInfo?.maps) {
      completedMaps += Object.keys(typeInfo.maps).length
      totalTypes++
    }
  })

  // 估算总地图数量和完成度
  const totalMaps = playerData.points?.total || completedMaps
  if (totalMaps) {
    result += `总完成度: ${formatter.percentage(completedMaps, totalMaps)}\n\n`
  } else {
    result += `总地图完成数: ${completedMaps}\n\n`
  }

  // 按地图类型显示
  result += '各难度完成度:\n'

  Object.entries(playerData.types).forEach(([typeName, typeInfo]: [string, any]) => {
    if (!typeInfo?.maps) return

    const mapCount = Object.keys(typeInfo.maps).length
    const totalTypePoints = typeInfo.points?.total

    let typeCompletion = totalTypePoints
      ? formatter.percentage(mapCount, totalTypePoints)
      : `${mapCount} 张`

    result += `• ${typeName}: ${typeCompletion}\n`
  })

  return result
}
