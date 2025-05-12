import { Config } from './index'

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
   * 生成进度百分比
   * @param current 当前值
   * @param total 总值
   */
  percentage(current: number, total: number): string {
    if (!total) return `${current} 项`
    const percent = ((current / total) * 100).toFixed(1)
    return `${current}/${total} (${percent}%)`
  },

  /**
   * 地图类型映射
   * @param type 英文地图类型
   * @returns 中文地图类型
   */
  mapType(type: string): string {
    const typeMapping: Record<string, string> = {
      'Novice': '简单',
      'Moderate': '中阶',
      'Brutal': '高阶',
      'Insane': '疯狂',
      'Dummy': '分身',
      'DDmaX.Easy': '古典.Easy',
      'DDmaX.Next': '古典.Next',
      'DDmaX.Pro': '古典.Pro',
      'DDmaX.Nut': '古典.Nut',
      'Oldschool': '传统',
      'Solo':'单人',
      'Race': '竞速',
      'Fun': '娱乐'
    }
    return typeMapping[type] || type
  }
}

/**
 * 将玩家数据格式化为文本摘要
 * @param playerData - DDRace API返回的玩家数据对象
 * @param config - 显示配置
 * @returns 格式化后的文本字符串
 */
export function formatPlayerSummary(playerData: any, config?: Config): string {
  const playerId = playerData.player
  let summary = `🏆 ${playerId} 的 DDRace 个人资料\n`
  // 应用默认配置
  const displayConfig = {
    showRankInfo: config?.showRankInfo !== false,
    showActivityInfo: config?.showActivityInfo !== false,
    showGameInfo: config?.showGameInfo !== false,
    showMapTypeStats: config?.showMapTypeStats !== false,
    recentFinishesCount: config?.recentFinishesCount ?? 5,
    favoritePartnersCount: config?.favoritePartnersCount ?? 5,
    showActivityStats: config?.showActivityStats !== false,
    mapDetailsCount: config?.mapDetailsCount ?? 6
  }
  // 排名与积分信息
  if (displayConfig.showRankInfo) {
    summary += `\n📊 排名与积分\n`
    // 总积分信息
    if (playerData.points && typeof playerData.points === 'object') {
      const total = playerData.points.total || 0
      const rank = playerData.points.rank || '未排名'
      const points = playerData.points.points || 0
      summary += `• 总积分: ${points}/${total} (全球第 ${rank} 名)\n`
    }
    // 个人与团队排名
    if (playerData.rank?.rank) {
      summary += `• 个人排名: 第 ${playerData.rank.rank} 名 (${playerData.rank.points || 0} 积分)\n`
    }
    if (playerData.team_rank?.rank) {
      summary += `• 团队排名: 第 ${playerData.team_rank.rank} 名 (${playerData.team_rank.points || 0} 积分)\n`
    }
  }
  // 最近活跃度
  if (displayConfig.showActivityInfo) {
    const hasRecentActivity = playerData.points_last_year || playerData.points_last_month || playerData.points_last_week
    if (hasRecentActivity) {
      summary += `\n📅 近期活跃度\n`
      if (playerData.points_last_year?.points) {
        summary += `• 过去一年: ${playerData.points_last_year.points} 积分 (第 ${playerData.points_last_year.rank || '?'} 名)\n`
      }
      if (playerData.points_last_month?.points) {
        summary += `• 过去一月: ${playerData.points_last_month.points} 积分 (第 ${playerData.points_last_month.rank || '?'} 名)\n`
      }
      if (playerData.points_last_week?.rank) {
        summary += `• 过去一周: ${playerData.points_last_week.points || 0} 积分 (第 ${playerData.points_last_week.rank} 名)\n`
      } else {
        summary += `• 过去一周: 暂无排名\n`
      }
    }
  }
  // 游戏基本信息
  if (displayConfig.showGameInfo) {
    summary += `\n🎮 游戏信息\n`
    // 常用服务器
    if (playerData.favorite_server) {
      const server = typeof playerData.favorite_server === 'object'
        ? (playerData.favorite_server.server || JSON.stringify(playerData.favorite_server))
        : playerData.favorite_server
      summary += `• 常用服务器: ${server}\n`
    }
    // 游戏时间
    if (playerData.hours_played_past_365_days !== undefined) {
      summary += `• 年度游戏时长: ${playerData.hours_played_past_365_days} 小时\n`
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
    summary += `\n🗺️ 地图完成统计\n`
    Object.entries(playerData.types).forEach(([typeName, typeInfo]: [string, any]) => {
      if (!typeInfo?.maps) return
      // 计算完成地图数量和总地图数量
      const mapEntries = Object.entries(typeInfo.maps)
      const completedMaps = mapEntries.filter(([_, mapData]: [string, any]) =>
        mapData.finishes && mapData.finishes > 0
      )
      const completedMapCount = completedMaps.length
      const totalMapCount = mapEntries.length
      let typePoints = 0
      let earnedPoints = 0
      let typeRank = '未排名'
      // 计算积分
      if (typeInfo.points) {
        if (typeof typeInfo.points === 'object') {
          earnedPoints = typeInfo.points.points || 0
          typePoints = typeInfo.points.total || 0
          if (typeInfo.points.rank) {
            typeRank = `第 ${typeInfo.points.rank} 名`
          }
        } else {
          earnedPoints = typeInfo.points
          typePoints = typeInfo.points
        }
      }
      // 显示地图统计
      const displayTypeName = formatter.mapType(typeName)
      summary += `• ${displayTypeName}: ${earnedPoints}/${typePoints} 积分 (${typeRank}), 已完成 ${completedMapCount}/${totalMapCount} 张地图\n`
      // 列出部分地图及其详情
      if (totalMapCount > 0 && displayConfig.mapDetailsCount !== 0) {
        const limit = displayConfig.mapDetailsCount === -1 ? totalMapCount : Math.min(displayConfig.mapDetailsCount, totalMapCount)
        // 找出已完成的地图
        if (completedMaps.length > 0) {
          const shownCompletedMaps = completedMaps.slice(0, limit)
          summary += `  已完成地图:\n`
          shownCompletedMaps.forEach(([mapName, mapData]: [string, any]) => {
            const finishesText = mapData.finishes > 1 ? `完成${mapData.finishes}次` : '已完成'
            const rankText = mapData.rank ? `排名#${mapData.rank}` : ''
            const timeText = mapData.time ? `(${formatter.time(mapData.time)})` : ''
            const pointsText = mapData.points ? `[${mapData.points}分]` : ''
            summary += `   - ${mapName} ${pointsText} ${finishesText} ${rankText} ${timeText}\n`
          })
          const hasMore = completedMaps.length > limit && displayConfig.mapDetailsCount !== -1
          if (hasMore) {
            summary += `   ... 以及其他 ${completedMaps.length - limit} 张已完成地图\n`
          }
        }
        // 找出未完成但有数据的地图
        const uncompletedMaps = mapEntries.filter(([_, mapData]: [string, any]) =>
          !mapData.finishes || mapData.finishes === 0
        )
        if (uncompletedMaps.length > 0) {
          const shownUncompletedMaps = uncompletedMaps.slice(0, limit)
          summary += `  未完成地图:\n`
          shownUncompletedMaps.forEach(([mapName, mapData]: [string, any]) => {
            const pointsText = mapData.points ? `[${mapData.points}分]` : ''
            const totalFinishes = mapData.total_finishes ? `共${mapData.total_finishes}人完成` : ''
            summary += `   - ${mapName} ${pointsText} ${totalFinishes}\n`
          })
          const hasMore = uncompletedMaps.length > limit && displayConfig.mapDetailsCount !== -1
          if (hasMore) {
            summary += `   ... 以及其他 ${uncompletedMaps.length - limit} 张未完成地图\n`
          }
        }
      }
    })
  }
  // 最近完成记录
  if (displayConfig.recentFinishesCount !== 0 && playerData.last_finishes?.length > 0) {
    summary += `\n🏁 最近通关记录 (${playerData.last_finishes.length}项)\n`
    const limit = displayConfig.recentFinishesCount === -1
      ? playerData.last_finishes.length
      : Math.min(displayConfig.recentFinishesCount, playerData.last_finishes.length)
    const records = playerData.last_finishes.slice(0, limit)
    records.forEach((finish: any) => {
      if (finish.timestamp && finish.map) {
        const formattedDate = formatter.date(finish.timestamp, 'short')
        const timeStr = formatter.time(finish.time)
        const displayType = formatter.mapType(finish.type || '')
        const countryTag = finish.country ? `${finish.country} ` : ''
        summary += `• ${finish.map} (${countryTag}${displayType}) - ${timeStr} [${formattedDate}]\n`
      }
    })
  }
  // 常用队友
  if (displayConfig.favoritePartnersCount !== 0 && playerData.favorite_partners?.length > 0) {
    summary += `\n👥 常用队友 (共${playerData.favorite_partners.length}位)\n`
    const limit = displayConfig.favoritePartnersCount === -1
      ? playerData.favorite_partners.length
      : Math.min(displayConfig.favoritePartnersCount, playerData.favorite_partners.length)
    playerData.favorite_partners.slice(0, limit).forEach((partner: any) => {
      if (partner.name && partner.finishes) {
        summary += `• ${partner.name}: 合作完成 ${partner.finishes} 次\n`
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
    summary += `\n📊 活跃度统计\n`
    summary += `• 活跃天数: ${activeDays} 天\n`
    summary += `• 活跃月数: ${activeMonths.size} 个月\n`
    summary += `• 单日最长游戏: ${maxHours} 小时\n`
    summary += `• 平均每日游戏: ${avgHours} 小时\n`
  }
  return summary
}

/**
 * 格式化地图详细信息
 * @param mapData - 地图数据
 * @param config - 显示配置
 * @returns 格式化后的地图信息文本
 */
export function formatMapInfo(mapData: any, config?: Config): string {
  // 应用默认配置
  const displayConfig = {
    showMapBasicInfo: config?.showMapBasicInfo !== false,
    showMapStats: config?.showMapStats !== false,
    globalRanksCount: config?.globalRanksCount ?? 5,
    chinaRanksCount: config?.chinaRanksCount ?? 5,
    teamRanksCount: config?.teamRanksCount ?? 3,
    multiFinishersCount: config?.multiFinishersCount ?? 3,
    showMapFeatures: config?.showMapFeatures !== false,
    showMapLinks: config?.showMapLinks !== false
  }
  const stars = '★'.repeat(mapData.difficulty || 0) + '☆'.repeat(Math.max(0, 5 - (mapData.difficulty || 0)))
  let result = `🗺️ 地图「${mapData.name}」详细信息\n\n`
  // 基本信息
  if (displayConfig.showMapBasicInfo) {
    const displayType = formatter.mapType(mapData.type || '未知')
    result += `类型: ${displayType} (${stars})\n`
    result += `作者: ${mapData.mapper || '未知'}\n`
    result += `难度: ${mapData.difficulty || 0}/5 • 积分值: ${mapData.points || 0}\n`
    // 发布日期
    if (mapData.release) {
      result += `发布日期: ${formatter.date(mapData.release, 'short')}\n`
    }
  }
  // 完成统计
  if (displayConfig.showMapStats) {
    result += `\n📊 完成统计\n`
    result += `总完成次数: ${mapData.finishes || 0}\n`
    result += `完成玩家数: ${mapData.finishers || 0}\n`
    if (mapData.median_time) {
      result += `平均完成时间: ${formatter.time(mapData.median_time)}\n`
    }
    if (mapData.first_finish) {
      result += `首次完成日期: ${formatter.date(mapData.first_finish, 'short')}\n`
    }
    if (mapData.last_finish) {
      result += `最近完成日期: ${formatter.date(mapData.last_finish, 'short')}\n`
    }
    if (mapData.biggest_team) {
      result += `最大团队规模: ${mapData.biggest_team} 人\n`
    }
  }
  // 排行榜
  if (displayConfig.globalRanksCount !== 0 && mapData.ranks && mapData.ranks.length > 0) {
    const limit = displayConfig.globalRanksCount === -1
      ? mapData.ranks.length
      : Math.min(displayConfig.globalRanksCount, mapData.ranks.length)
    result += `\n🏆 全球排名\n`
    const topRanks = mapData.ranks.slice(0, limit)
    topRanks.forEach((rank, idx) => {
      if (rank.player && rank.time) {
        const countryTag = rank.country ? `[${rank.country}] ` : ''
        const timeStr = formatter.time(rank.time)
        const dateStr = rank.timestamp ? ` [${formatter.date(rank.timestamp, 'short')}]` : ''
        result += `${idx + 1}. ${countryTag}${rank.player} - ${timeStr}${dateStr}\n`
      }
    })
    // 是否有更多玩家完成
    const remainingPlayers = (mapData.ranks.length - limit)
    if (remainingPlayers > 0 && displayConfig.globalRanksCount !== -1) {
      result += `... 以及其他 ${remainingPlayers} 名玩家\n`
    }
  }
  // 国服玩家专属排行
  if (displayConfig.chinaRanksCount !== 0) {
    const chinaPlayers = mapData.ranks?.filter(r => r.country === 'CHN') || []
    if (chinaPlayers.length > 0) {
      const limit = displayConfig.chinaRanksCount === -1
        ? chinaPlayers.length
        : Math.min(displayConfig.chinaRanksCount, chinaPlayers.length)
      result += `\n🇨🇳 国服排名\n`
      chinaPlayers.slice(0, limit).forEach((rank, idx) => {
        const timeStr = formatter.time(rank.time)
        const globalRank = mapData.ranks.findIndex(r => r.player === rank.player) + 1
        result += `${idx + 1}. ${rank.player} - ${timeStr} (全球第 ${globalRank} 名)\n`
      })
      // 是否有更多中国玩家
      const remaining = chinaPlayers.length - limit
      if (remaining > 0 && displayConfig.chinaRanksCount !== -1) {
        result += `... 以及其他 ${remaining} 名国服玩家\n`
      }
    }
  }
  // 团队排名
  if (displayConfig.teamRanksCount !== 0 && mapData.team_ranks && mapData.team_ranks.length > 0) {
    const limit = displayConfig.teamRanksCount === -1
      ? mapData.team_ranks.length
      : Math.min(displayConfig.teamRanksCount, mapData.team_ranks.length)
    result += `\n👥 团队排名\n`
    const topTeams = mapData.team_ranks.slice(0, limit)
    topTeams.forEach((teamRank, idx) => {
      if (teamRank.players && teamRank.time) {
        const countryTag = teamRank.country ? `[${teamRank.country}] ` : ''
        const timeStr = formatter.time(teamRank.time)
        const playersStr = teamRank.players.join(', ')
        result += `${idx + 1}. ${countryTag}${playersStr} - ${timeStr}\n`
      }
    })
    const remaining = mapData.team_ranks.length - limit
    if (remaining > 0 && displayConfig.teamRanksCount !== -1) {
      result += `... 以及其他 ${remaining} 支团队\n`
    }
  }
  // 多次完成玩家
  if (displayConfig.multiFinishersCount !== 0 && mapData.max_finishes && mapData.max_finishes.length > 0) {
    const limit = displayConfig.multiFinishersCount === -1
      ? mapData.max_finishes.length
      : Math.min(displayConfig.multiFinishersCount, mapData.max_finishes.length)
    result += `\n🔄 多次完成玩家\n`
    const topFinishers = mapData.max_finishes.slice(0, limit)
    topFinishers.forEach((finisher) => {
      if (finisher.player && finisher.num) {
        result += `• ${finisher.player}: 完成 ${finisher.num} 次\n`
      }
    })
    const remaining = mapData.max_finishes.length - limit
    if (remaining > 0 && displayConfig.multiFinishersCount !== -1) {
      result += `... 以及其他多次完成玩家\n`
    }
  }
  // 地图特性
  if (displayConfig.showMapFeatures && mapData.tiles && mapData.tiles.length > 0) {
    result += `\n🧩 地图特性\n`
    result += `尺寸: ${mapData.width || '?'} × ${mapData.height || '?'}\n`
    result += `特殊方块: ${mapData.tiles.join(', ')}\n`
  }
  // 链接信息
  if (displayConfig.showMapLinks) {
    result += `\n🔗 相关链接\n`
    if (mapData.website) {
      result += `• 详细信息: ${mapData.website}\n`
    }
    if (mapData.web_preview) {
      result += `• 地图预览: ${mapData.web_preview}\n`
    }
    if (mapData.thumbnail) {
      result += `• 地图缩略图: ${mapData.thumbnail}\n`
    }
  }
  return result
}