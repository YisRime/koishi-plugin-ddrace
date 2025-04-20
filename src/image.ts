import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { formatter } from './text'
import { Config } from './index'

/**
 * 将HTML内容渲染为图片
 */
export async function htmlToImage(html: string, ctx: Context): Promise<Buffer> {
  let page = null
  try {
    page = await ctx.puppeteer.page()
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Arial', 'PingFang SC', 'Microsoft YaHei', sans-serif;
              background: transparent;
              color: #333;
              padding: 0;
              margin: 0;
              display: flex;
              justify-content: center;
            }
            .container {
              width: 960px;
              background-color: rgba(255, 255, 255);
              border-radius: 10px;
              padding: 12px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              padding-bottom: 10px;
              border-bottom: 1px solid #eaeaea;
              margin-bottom: 12px;
            }
            .header h1 {
              margin: 0;
              color: #4a76a8;
              font-size: 22px;
              font-weight: 600;
            }
            .section {
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #eaeaea;
            }
            .section:last-child {
              border-bottom: none;
              margin-bottom: 0;
            }
            .section-title {
              font-weight: 600;
              color: #4a76a8;
              margin-bottom: 8px;
              font-size: 17px;
            }
            .stat-item {
              margin-bottom: 6px;
              line-height: 1.4;
            }
            .map-list {
              font-size: 13px;
              color: #666;
              margin-left: 15px;
              margin-top: 2px;
            }
            .small {
              font-size: 13px;
            }
            .highlight {
              font-weight: 600;
              color: #3b5998;
            }
            .recent-finishes {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(370px, 1fr));
              gap: 8px;
            }
            .finish-card, .partner-card, .finisher-card, .rank-item {
              background: rgba(249, 249, 249, 0.7);
              border-radius: 6px;
              padding: 8px;
              border-left: 3px solid #4a76a8;
            }
            .finish-time, .rank-time {
              color: #e63946;
              font-weight: 600;
              font-size: 13px;
            }
            .finish-date, .rank-date {
              color: #666;
              font-size: 12px;
            }
            .partners-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .partner-card {
              display: flex;
              align-items: center;
              flex: 1 0 calc(20% - 8px);
              max-width: calc(20% - 8px);
              box-sizing: border-box;
            }
            .partner-count, .finisher-count {
              margin-left: auto;
              background: #4a76a8;
              color: white;
              border-radius: 10px;
              padding: 2px 8px;
              font-size: 12px;
              font-weight: 600;
            }
            .stats-container {
              display: flex;
              gap: 15px;
            }
            .stats-column {
              flex: 1;
            }
            .stats-column .section {
              height: 100%;
            }
            .rank-list-vertical {
              list-style-type: none;
              padding: 0;
              margin: 0;
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .rank-item {
              display: flex;
              align-items: flex-start;
              padding: 6px 10px;
            }
            .rank-position {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 24px;
              height: 24px;
              border-radius: 50%;
              margin-right: 10px;
              font-weight: bold;
              font-size: 14px;
              color: #777;
            }
            .position-1 {
              background: linear-gradient(135deg, #ffd700, #e6b800);
              box-shadow: 0 2px 4px rgba(230, 184, 0, 0.3);
              color: #fff;
            }
            .position-2 {
              background: linear-gradient(135deg, #c0c0c0, #a0a0a0);
              box-shadow: 0 2px 4px rgba(160, 160, 160, 0.3);
              color: #fff;
            }
            .position-3 {
              background: linear-gradient(135deg, #cd7f32, #a06020);
              box-shadow: 0 2px 4px rgba(160, 96, 32, 0.3);
              color: #fff;
            }
            .rank-player {
              flex: 1;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              padding-right: 5px;
            }
            .rank-time-container {
              display: flex;
              flex-direction: column;
              align-items: flex-end;
              min-width: 65px;
            }
            .finisher-grid {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 8px;
            }
            .finisher-card {
              display: flex;
              align-items: center;
            }
            .url-link {
              display: inline-block;
              background: rgba(249, 249, 249, 0.7);
              padding: 6px 10px;
              border-radius: 6px;
              margin-bottom: 6px;
              border-left: 3px solid #4a76a8;
              word-break: break-all;
              color: #4a76a8;
              font-weight: 500;
            }
            .thumbnail {
              max-width: 100%;
              margin-top: 10px;
              border-radius: 6px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${html}
          </div>
        </body>
      </html>
    `, { waitUntil: 'networkidle0', timeout: 3000 })
    // 等待内容加载并截图
    const rect = await page.evaluate(() => {
      const container = document.querySelector('.container')
      const rect = container.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
    await page.setViewport({
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
      deviceScaleFactor: 1.75
    })
    return await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: { x: 0, y: 0, width: Math.ceil(rect.width), height: Math.ceil(rect.height) },
      omitBackground: true
    })
  } catch (error) {
    ctx.logger.error('图片渲染出错:', error)
  } finally {
    if (page) await page.close().catch(() => {})
  }
}

/**
 * 将玩家数据转换为HTML展示格式
 * @param playerData DDRace API返回的玩家数据对象
 * @param config 显示配置
 * @returns 格式化后的HTML字符串
 */
export function playerDataToHtml(playerData: any, config?: Config): string {
  const playerId = playerData.player
  let htmlContent = `
    <div class="header">
      <h1>🏆 ${playerId} 的 DDRace 个人资料</h1>
    </div>
  `;
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
  // 游戏信息和排名积分
  if (displayConfig.showRankInfo || displayConfig.showGameInfo) {
    htmlContent += `<div class="section"><div class="section-title">📊 排名与游戏信息</div>`;
    // 排名与积分信息
    if (displayConfig.showRankInfo) {
      // 总积分信息
      if (playerData.points && typeof playerData.points === 'object') {
        const total = playerData.points.total || 0;
        const rank = playerData.points.rank || '未排名';
        const points = playerData.points.points || 0;
        htmlContent += `<div class="stat-item">• 总积分: <span class="highlight">${points}/${total}</span> (全球第 ${rank} 名)</div>`;
      }
      // 个人与团队排名
      if (playerData.rank?.rank) {
        htmlContent += `<div class="stat-item">• 个人排名: 第 <span class="highlight">${playerData.rank.rank}</span> 名 (${playerData.rank.points || 0} 积分)</div>`;
      }
      if (playerData.team_rank?.rank) {
        htmlContent += `<div class="stat-item">• 团队排名: 第 <span class="highlight">${playerData.team_rank.rank}</span> 名 (${playerData.team_rank.points || 0} 积分)</div>`;
      }
    }
    // 游戏信息
    if (displayConfig.showGameInfo) {
      if (playerData.favorite_server) {
        const server = typeof playerData.favorite_server === 'object' ?
                    (playerData.favorite_server.server || JSON.stringify(playerData.favorite_server)) :
                    playerData.favorite_server;
        htmlContent += `<div class="stat-item">• 常用服务器: <span class="highlight">${server}</span></div>`;
      }
      if (playerData.hours_played_past_365_days !== undefined) {
        htmlContent += `<div class="stat-item">• 年度游戏时长: <span class="highlight">${playerData.hours_played_past_365_days}</span> 小时</div>`;
      }
      if (playerData.first_finish) {
        const formattedDate = formatter.date(playerData.first_finish.timestamp, 'year');
        const map = playerData.first_finish.map;
        const timeString = formatter.time(playerData.first_finish.time);
        htmlContent += `<div class="stat-item">• 首次完成: ${formattedDate} - <span class="highlight">${map}</span> (${timeString})</div>`;
      }
    }
    htmlContent += `</div>`;
  }
  // 活跃度统计和近期活跃度
  const hasActivityInfo = displayConfig.showActivityInfo && (
    playerData.points_last_year || playerData.points_last_month || playerData.points_last_week
  );
  const hasActivityStats = displayConfig.showActivityStats && playerData.activity?.length > 0;
  if (hasActivityInfo || hasActivityStats) {
    htmlContent += `<div class="section"><div class="stats-container">`;
    // 左列：活跃度统计
    if (hasActivityStats) {
      htmlContent += `<div class="stats-column">`;
      htmlContent += `<div class="section-title">📊 活跃度统计</div>`;
      let totalHours = 0;
      let maxHours = 0;
      let activeDays = 0;
      let activeMonths = new Set();
      playerData.activity.forEach((day: any) => {
        if (day?.hours_played) {
          totalHours += day.hours_played;
          maxHours = Math.max(maxHours, day.hours_played);
          if (day.hours_played > 0) {
            activeDays++;
            if (day.date) {
              const month = day.date.substring(0, 7);
              activeMonths.add(month);
            }
          }
        }
      });
      const avgHours = activeDays > 0 ? (totalHours / activeDays).toFixed(1) : "0";
      htmlContent += `
        <div class="stat-item">• 活跃天数: <span class="highlight">${activeDays}</span> 天</div>
        <div class="stat-item">• 活跃月数: <span class="highlight">${activeMonths.size}</span> 个月</div>
        <div class="stat-item">• 单日最长游戏: <span class="highlight">${maxHours}</span> 小时</div>
        <div class="stat-item">• 平均每日游戏: <span class="highlight">${avgHours}</span> 小时</div>
      `;
      htmlContent += `</div>`;
    }
    // 右列：近期活跃度
    if (hasActivityInfo) {
      htmlContent += `<div class="stats-column">`;
      htmlContent += `<div class="section-title">📅 近期活跃度</div>`;
      if (playerData.points_last_year?.points) {
        htmlContent += `<div class="stat-item">• 过去一年: <span class="highlight">${playerData.points_last_year.points}</span> 积分 (第 ${playerData.points_last_year.rank || '?'} 名)</div>`;
      }
      if (playerData.points_last_month?.points) {
        htmlContent += `<div class="stat-item">• 过去一月: <span class="highlight">${playerData.points_last_month.points}</span> 积分 (第 ${playerData.points_last_month.rank || '?'} 名)</div>`;
      }
      if (playerData.points_last_week?.rank) {
        htmlContent += `<div class="stat-item">• 过去一周: <span class="highlight">${playerData.points_last_week.points || 0}</span> 积分 (第 ${playerData.points_last_week.rank} 名)</div>`;
      } else {
        htmlContent += `<div class="stat-item">• 过去一周: 暂无排名</div>`;
      }
      htmlContent += `</div>`;
    }
    htmlContent += `</div></div>`;
  }
  // 地图完成详细统计
  if (displayConfig.showMapTypeStats && playerData.types && typeof playerData.types === 'object') {
    htmlContent += `<div class="section"><div class="section-title">🗺️ 地图完成统计</div>`;
    const typesEntries = Object.entries(playerData.types);
    typesEntries.forEach(([typeName, typeInfo]: [string, any]) => {
      if (!typeInfo?.maps) return;
      const mapCount = Object.keys(typeInfo.maps).length;
      let typePoints = 0;
      let typeRank = '未排名';
      if (typeInfo.points) {
        if (typeof typeInfo.points === 'object') {
          typePoints = typeInfo.points.points || typeInfo.points.total || 0;
        } else {
          typePoints = typeInfo.points;
        }
      }
      if (typeInfo.rank?.rank) {
        typeRank = `第 ${typeInfo.rank.rank} 名`;
      }
      htmlContent += `<div class="stat-item">• ${typeName}: <span class="highlight">${typePoints}</span> 积分 (${typeRank}), 已完成 <span class="highlight">${mapCount}</span> 张地图</div>`;
      // 列出地图名称
      if (mapCount > 0 && displayConfig.mapDetailsCount !== 0) {
        const mapNames = Object.keys(typeInfo.maps);
        const limit = displayConfig.mapDetailsCount === -1 ? mapCount : Math.min(displayConfig.mapDetailsCount, mapCount);
        const displayMaps = mapNames.slice(0, limit);
        const hasMore = mapCount > limit && displayConfig.mapDetailsCount !== -1;
        htmlContent += `<div class="map-list">最近完成: ${displayMaps.join(', ')}${hasMore ? ' ...' : ''}</div>`;
      }
    });
    htmlContent += `</div>`;
  }
  // 最近完成记录
  if (displayConfig.recentFinishesCount !== 0 && playerData.last_finishes?.length > 0) {
    const limit = displayConfig.recentFinishesCount === -1
      ? playerData.last_finishes.length
      : Math.min(displayConfig.recentFinishesCount, playerData.last_finishes.length);
    htmlContent += `
      <div class="section">
        <div class="section-title">🏁 最近通关记录 (${playerData.last_finishes.length}项)</div>
        <div class="recent-finishes">
    `;
    playerData.last_finishes.slice(0, limit).forEach((finish: any) => {
      if (finish.timestamp && finish.map) {
        const formattedDate = formatter.date(finish.timestamp, 'short');
        const timeString = formatter.time(finish.time);
        const countryFlag = finish.country ? `${finish.country} ` : '';
        htmlContent += `
          <div class="finish-card">
            <div>${finish.map} (${finish.type || '未知'}) <span class="finish-time">${timeString}</span></div>
            <div class="finish-date">${formattedDate} - ${countryFlag}服务器</div>
          </div>
        `;
      }
    });
    htmlContent += `</div></div>`;
  }
  // 常用队友
  if (displayConfig.favoritePartnersCount !== 0 && playerData.favorite_partners?.length > 0) {
    const limit = displayConfig.favoritePartnersCount === -1
      ? playerData.favorite_partners.length
      : Math.min(displayConfig.favoritePartnersCount, playerData.favorite_partners.length);
    htmlContent += `
      <div class="section">
        <div class="section-title">👥 常用队友 (共${playerData.favorite_partners.length}位)</div>
        <div class="partners-grid">
    `;
    playerData.favorite_partners.slice(0, limit).forEach((partner: any) => {
      if (partner.name && partner.finishes) {
        htmlContent += `
          <div class="partner-card">
            ${partner.name} <span class="partner-count">${partner.finishes}次</span>
          </div>
        `;
      }
    });
    htmlContent += `</div></div>`;
  }
  return htmlContent;
}

/**
 * 将地图详细信息转换为HTML格式
 * @param mapData 地图数据
 * @param config 显示配置
 * @returns 格式化后的HTML字符串
 */
export function mapInfoToHtml(mapData: any, config?: Config): string {
  const displayConfig = {
    showMapBasicInfo: config?.showMapBasicInfo !== false,
    showMapStats: config?.showMapStats !== false,
    globalRanksCount: config?.globalRanksCount ?? 5,
    chinaRanksCount: config?.chinaRanksCount ?? 5,
    teamRanksCount: config?.teamRanksCount ?? 3,
    multiFinishersCount: config?.multiFinishersCount ?? 5,
    showMapFeatures: config?.showMapFeatures !== false,
    showMapLinks: config?.showMapLinks !== false
  }
  const stars = '★'.repeat(mapData.difficulty || 0) + '☆'.repeat(Math.max(0, 5 - (mapData.difficulty || 0)));
  let htmlContent = `
    <div class="header">
      <h1>🗺️ 地图「${mapData.name}」详细信息</h1>
    </div>
  `;
  // 基本信息
  if (displayConfig.showMapBasicInfo) {
    htmlContent += `<div class="section">
      <div class="stat-item">类型: <span class="highlight">${mapData.type || '未知'}</span> (${stars})</div>
      <div class="stat-item">作者: <span class="highlight">${mapData.mapper || '未知'}</span></div>
      <div class="stat-item">难度: ${mapData.difficulty || 0}/5 • 积分值: ${mapData.points || 0}</div>
    `;
    // 发布日期
    if (mapData.release) {
      htmlContent += `<div class="stat-item">发布日期: ${formatter.date(mapData.release, 'short')}</div>`;
    }
    htmlContent += `</div>`;
  }
  // 地图特性和相关链接
  if ((displayConfig.showMapFeatures && mapData.tiles && mapData.tiles.length > 0) ||
      displayConfig.showMapLinks) {
    htmlContent += `<div class="section">
      <div class="section-title">🧩 地图特性及相关链接</div>`;
    // 地图特性
    if (displayConfig.showMapFeatures && mapData.tiles && mapData.tiles.length > 0) {
      htmlContent += `
        <div class="stat-item">尺寸: ${mapData.width || '?'} × ${mapData.height || '?'}</div>
        <div class="stat-item">特殊方块: ${mapData.tiles.join(', ')}</div>
      `;
    }
    // 链接信息
    if (displayConfig.showMapLinks) {
      if (mapData.website) {
        htmlContent += `<div class="url-link">详细信息: ${mapData.website}</div>`;
      }
      if (mapData.web_preview) {
        htmlContent += `<div class="url-link">地图预览: ${mapData.web_preview}</div>`;
      }
      if (mapData.thumbnail) {
        htmlContent += `
          <div class="stat-item">地图缩略图:</div>
          <div><img src="${mapData.thumbnail}" alt="地图缩略图" class="thumbnail"></div>
        `;
      }
    }
    htmlContent += `</div>`;
  }
  // 完成统计
  if (displayConfig.showMapStats) {
    htmlContent += `<div class="section">
      <div class="section-title">📊 完成统计</div>
      <div class="stats-container">
        <div class="stats-column">
          <div class="stat-item">总完成次数: <span class="highlight">${mapData.finishes || 0}</span></div>
          <div class="stat-item">完成玩家数: <span class="highlight">${mapData.finishers || 0}</span></div>
          ${mapData.median_time ? `<div class="stat-item">平均时间: <span class="highlight">${formatter.time(mapData.median_time)}</span></div>` : ''}
        </div>
        <div class="stats-column">
          ${mapData.first_finish ? `<div class="stat-item">首次完成: ${formatter.date(mapData.first_finish, 'short')}</div>` : ''}
          ${mapData.last_finish ? `<div class="stat-item">最近完成: ${formatter.date(mapData.last_finish, 'short')}</div>` : ''}
          ${mapData.biggest_team ? `<div class="stat-item">最大团队: <span class="highlight">${mapData.biggest_team}</span> 人</div>` : ''}
        </div>
      </div>
    </div>`;
  }
  // 排行榜
  const hasGlobalRanks = displayConfig.globalRanksCount !== 0 && mapData.ranks && mapData.ranks.length > 0;
  const hasChinaRanks = displayConfig.chinaRanksCount !== 0 && mapData.ranks?.filter(r => r.country === 'CHN')?.length > 0;
  const hasTeamRanks = displayConfig.teamRanksCount !== 0 && mapData.team_ranks && mapData.team_ranks.length > 0;
  if (hasGlobalRanks || hasChinaRanks || hasTeamRanks) {
    htmlContent += `<div class="section">
      <div class="section-title">🏆 排行榜</div>
      <div class="stats-container">`;
    // 生成排名函数
    const generateRanking = (title, ranks, limit, getPlayerName = (r) => r.player) => {
      htmlContent += `<div class="stats-column">
        <div class="section-title">${title}</div>
        <ul class="rank-list-vertical">`;
      ranks.slice(0, limit).forEach((rank, idx) => {
        const playerName = getPlayerName(rank);
        if (playerName && rank.time) {
          const countryTag = rank.country ? `[${rank.country}] ` : '';
          const timeStr = formatter.time(rank.time);
          const dateStr = rank.timestamp ? formatter.date(rank.timestamp, 'short') : '';
          const positionClass = idx < 3 ? `position-${idx+1}` : '';
          htmlContent += `
            <li class="rank-item">
              <div class="rank-position ${positionClass}">${idx + 1}</div>
              <div class="rank-player">${countryTag}${playerName}</div>
              <div class="rank-time-container">
                <span class="rank-time">${timeStr}</span>
                ${dateStr ? `<span class="rank-date">${dateStr}</span>` : ''}
              </div>
            </li>`;
        }
      });
      htmlContent += `</ul></div>`;
    };
    // 第一列：全球排名
    if (hasGlobalRanks) {
      const limit = displayConfig.globalRanksCount === -1
        ? mapData.ranks.length
        : Math.min(displayConfig.globalRanksCount, mapData.ranks.length);
      generateRanking('全球排名', mapData.ranks, limit);
    }
    // 第二列：国服排名
    if (hasChinaRanks) {
      const chinaPlayers = mapData.ranks.filter(r => r.country === 'CHN') || [];
      const limit = displayConfig.chinaRanksCount === -1
        ? chinaPlayers.length
        : Math.min(displayConfig.chinaRanksCount, chinaPlayers.length);
      generateRanking('🇨🇳 国服排名', chinaPlayers, limit);
    }
    // 第三列：团队排名
    if (hasTeamRanks) {
      const limit = displayConfig.teamRanksCount === -1
        ? mapData.team_ranks.length
        : Math.min(displayConfig.teamRanksCount, mapData.team_ranks.length);
      generateRanking('👥 团队排名', mapData.team_ranks, limit,
        (teamRank) => teamRank.players ? teamRank.players.join(', ') : '');
    }
    htmlContent += `</div></div>`;
  }
  // 多次完成玩家
  if (displayConfig.multiFinishersCount !== 0 && mapData.max_finishes && mapData.max_finishes.length > 0) {
    const limit = displayConfig.multiFinishersCount === -1
      ? mapData.max_finishes.length
      : Math.min(displayConfig.multiFinishersCount, mapData.max_finishes.length);
    htmlContent += `<div class="section">
      <div class="section-title">🔄 多次完成玩家</div>
      <div class="finisher-grid">
    `;
    mapData.max_finishes.slice(0, limit).forEach((finisher) => {
      if (finisher.player && finisher.num) {
        htmlContent += `
          <div class="finisher-card">
            <span>${finisher.player}</span>
            <span class="finisher-count">${finisher.num}次</span>
          </div>`;
      }
    });
    htmlContent += `</div></div>`;
  }
  return htmlContent;
}