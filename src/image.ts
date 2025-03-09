import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { formatter } from './text'

/**
 * 将HTML内容渲染为图片
 * @param html HTML内容
 * @param ctx Koishi上下文对象
 * @returns 渲染后的图片Buffer
 * @throws 如果渲染过程出错
 */
export async function htmlToImage(html: string, ctx: Context): Promise<Buffer> {
  try {
    const page = await ctx.puppeteer.page()

    // 设置完整的HTML内容
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Arial', sans-serif;
              background-color: #f0f2f5;
              color: #333;
              padding: 0;
              margin: 0;
            }
            .container {
              width: 800px;
              margin: 0 auto;
              background-color: #fff;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
              padding: 20px;
              overflow: hidden;
            }
            .header {
              text-align: center;
              padding-bottom: 10px;
              border-bottom: 1px solid #eee;
              margin-bottom: 15px;
            }
            .header h1 {
              margin: 0;
              color: #4a76a8;
              font-size: 24px;
            }
            .section {
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 1px solid #eee;
            }
            .section-title {
              font-weight: bold;
              color: #4a76a8;
              margin-bottom: 10px;
              font-size: 18px;
            }
            .stat-item {
              margin-bottom: 8px;
              line-height: 1.5;
            }
            .map-list {
              font-size: 13px;
              color: #666;
              margin-left: 15px;
              margin-top: 3px;
            }
            .small {
              font-size: 13px;
            }
            .highlight {
              font-weight: bold;
              color: #3b5998;
            }
            .recent-finishes {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
              gap: 8px;
            }
            .finish-card {
              background: #f9f9f9;
              border-radius: 6px;
              padding: 8px;
              border-left: 3px solid #4a76a8;
            }
            .finish-time {
              color: #e63946;
              font-weight: bold;
            }
            .finish-date {
              color: #666;
              font-size: 12px;
            }
            .partners-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
              gap: 8px;
            }
            .partner-card {
              background: #f9f9f9;
              border-radius: 6px;
              padding: 8px;
              display: flex;
              align-items: center;
            }
            .partner-count {
              margin-left: auto;
              background: #4a76a8;
              color: white;
              border-radius: 12px;
              padding: 2px 8px;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            ${html}
          </div>
        </body>
      </html>
    `, { waitUntil: 'networkidle0' })

    // 等待内容加载并获取容器大小
    await page.waitForSelector('.container')
    const rect = await page.evaluate(() => {
      const container = document.querySelector('.container')
      const rect = container.getBoundingClientRect()
      return {
        width: rect.width,
        height: rect.height,
        paddingTop: parseInt(getComputedStyle(container).paddingTop),
        paddingBottom: parseInt(getComputedStyle(container).paddingBottom),
        paddingLeft: parseInt(getComputedStyle(container).paddingLeft),
        paddingRight: parseInt(getComputedStyle(container).paddingRight)
      }
    })

    // 设置视口并截图
    await page.setViewport({
      width: Math.ceil(rect.width) + 20,
      height: Math.ceil(rect.height) + 20,
      deviceScaleFactor: 2.0
    })

    const imageBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,
      clip: {
        x: 0,
        y: 0,
        width: Math.ceil(rect.width) + 20,
        height: Math.ceil(rect.height) + 20
      },
      omitBackground: false
    })

    await page.close()
    return imageBuffer

  } catch (error) {
    ctx.logger.error('图片渲染出错:', error)
    throw new Error('生成玩家信息图时遇到问题，请稍后重试')
  }
}

/**
 * 将玩家数据转换为HTML展示格式
 * @param playerData DDNet API返回的玩家数据对象
 * @returns 格式化后的HTML字符串
 */
export function playerDataToHtml(playerData: any): string {
  const playerId = playerData.player
  let htmlContent = `
    <div class="header">
      <h1>🏆 ${playerId} 的 DDNet 信息</h1>
    </div>
  `;

  // 合并显示排名和分数信息
  htmlContent += `
    <div class="section">
      <div class="section-title">📊 排名与分数</div>
  `;

  // 总分信息
  if (playerData.points && typeof playerData.points === 'object') {
    const total = playerData.points.total || 0;
    const rank = playerData.points.rank || '未排名';
    const points = playerData.points.points || 0;
    htmlContent += `<div class="stat-item">• 总分: <span class="highlight">${points}/${total}</span> (全球第 ${rank} 名)</div>`;
  }

  // 个人与团队排名合并显示
  if (playerData.rank && typeof playerData.rank === 'object') {
    htmlContent += `<div class="stat-item">• 个人排名: 第 <span class="highlight">${playerData.rank.rank || '?'}</span> 名 (${playerData.rank.points || 0} 分)</div>`;
  }

  if (playerData.team_rank && typeof playerData.team_rank === 'object') {
    htmlContent += `<div class="stat-item">• 团队排名: 第 <span class="highlight">${playerData.team_rank.rank || '?'}</span> 名 (${playerData.team_rank.points || 0} 分)</div>`;
  }

  htmlContent += `</div>`;

  // 最近时间段成绩合并显示
  if (playerData.points_last_year || playerData.points_last_month || playerData.points_last_week) {
    htmlContent += `
      <div class="section">
        <div class="section-title">📅 最近活跃度</div>
    `;

    if (playerData.points_last_year && playerData.points_last_year.points) {
      htmlContent += `<div class="stat-item">• 过去一年: <span class="highlight">${playerData.points_last_year.points}</span> 分 (第 ${playerData.points_last_year.rank || '?'} 名)</div>`;
    }

    if (playerData.points_last_month && playerData.points_last_month.points) {
      htmlContent += `<div class="stat-item">• 过去一月: <span class="highlight">${playerData.points_last_month.points}</span> 分 (第 ${playerData.points_last_month.rank || '?'} 名)</div>`;
    }

    if (playerData.points_last_week && playerData.points_last_week.rank) {
      htmlContent += `<div class="stat-item">• 过去一周: <span class="highlight">${playerData.points_last_week.points || 0}</span> 分 (第 ${playerData.points_last_week.rank} 名)</div>`;
    } else {
      htmlContent += `<div class="stat-item">• 过去一周: 暂无排名</div>`;
    }

    htmlContent += `</div>`;
  }

  // 首次完成和常用服务器
  htmlContent += `
    <div class="section">
      <div class="section-title">🎮 游戏信息</div>
  `;

  if (playerData.favorite_server) {
    const server = typeof playerData.favorite_server === 'object' ?
                  (playerData.favorite_server.server || JSON.stringify(playerData.favorite_server)) :
                  playerData.favorite_server;
    htmlContent += `<div class="stat-item">• 常用服务器: <span class="highlight">${server}</span></div>`;
  }

  if (playerData.hours_played_past_365_days !== undefined) {
    htmlContent += `<div class="stat-item">• 年度游戏时间: <span class="highlight">${playerData.hours_played_past_365_days}</span> 小时</div>`;
  }

  if (playerData.first_finish) {
    const date = new Date(playerData.first_finish.timestamp * 1000);
    const formattedDate = `${date.getFullYear()}年${(date.getMonth()+1)}月${date.getDate()}日`;
    const map = playerData.first_finish.map;
    const timeString = formatter.time(playerData.first_finish.time);

    htmlContent += `<div class="stat-item">• 首次完成: ${formattedDate} - <span class="highlight">${map}</span> (${timeString})</div>`;
  }

  htmlContent += `</div>`;

  // 地图完成详细统计 - 显示所有地图类型的详细信息
  if (playerData.types && typeof playerData.types === 'object') {
    htmlContent += `
      <div class="section">
        <div class="section-title">🗺️ 地图类型统计</div>
    `;

    const typesEntries = Object.entries(playerData.types);

    if (typesEntries.length > 0) {
      typesEntries.forEach(([typeName, typeInfo]: [string, any]) => {
        if (typeInfo) {
          // 获取类型的点数和排名信息
          let typePoints = 0;
          let typeRank = '未排名';
          let mapCount = 0;

          if (typeInfo.points) {
            if (typeof typeInfo.points === 'object') {
              typePoints = typeInfo.points.points || typeInfo.points.total || 0;
            } else {
              typePoints = typeInfo.points;
            }
          }

          if (typeInfo.rank && typeInfo.rank.rank) {
            typeRank = `第 ${typeInfo.rank.rank} 名`;
          }

          // 地图数量和列表
          if (typeInfo.maps) {
            mapCount = Object.keys(typeInfo.maps).length;
            htmlContent += `<div class="stat-item">• ${typeName}: <span class="highlight">${typePoints}</span> 分 (${typeRank}), 完成 <span class="highlight">${mapCount}</span> 张地图</div>`;

            // 列出地图名称
            if (mapCount > 0) {
              const mapNames: string[] = Object.keys(typeInfo.maps).slice(0, 10);
              htmlContent += `<div class="map-list">包括: ${mapNames.join(', ')}${mapCount > 10 ? ' 等...' : ''}</div>`;
            }
          }
        }
      });
    }

    htmlContent += `</div>`;
  }

  // 最近完成的地图
  if (playerData.last_finishes && Array.isArray(playerData.last_finishes) && playerData.last_finishes.length > 0) {
    htmlContent += `
      <div class="section">
        <div class="section-title">🏁 最近完成记录 (${playerData.last_finishes.length}项)</div>
        <div class="recent-finishes">
    `;

    // 最近记录
    const recentFinishes = playerData.last_finishes.slice(0, 8);

    recentFinishes.forEach((finish: any) => {
      if (finish.timestamp && finish.map) {
        const date = new Date(finish.timestamp * 1000);
        const formattedDate = `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
        const timeString = formatter.time(finish.time);

        htmlContent += `
          <div class="finish-card">
            <div>${finish.map} (${finish.type || '未知'}) <span class="finish-time">${timeString}</span></div>
            <div class="finish-date">${formattedDate} - ${finish.country || '未知'} 服务器</div>
          </div>
        `;
      }
    });

    htmlContent += `</div></div>`;
  }

  // 最常合作的伙伴
  if (playerData.favorite_partners && Array.isArray(playerData.favorite_partners) && playerData.favorite_partners.length > 0) {
    htmlContent += `
      <div class="section">
        <div class="section-title">👥 常用队友 (${playerData.favorite_partners.length}位)</div>
        <div class="partners-grid">
    `;

    const partners = playerData.favorite_partners.slice(0, 8);
    partners.forEach((partner: any) => {
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

  // 活跃度信息
  if (playerData.activity && Array.isArray(playerData.activity) && playerData.activity.length > 0) {
    let totalHours = 0;
    let maxHours = 0;
    let activeDays = 0;
    let activeMonths = new Set();

    playerData.activity.forEach((day: any) => {
      if (day && day.hours_played) {
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

    const avgHoursPerActiveDay = activeDays > 0 ? (totalHours / activeDays).toFixed(1) : "0";

    htmlContent += `
      <div class="section">
        <div class="section-title">📊 活跃度统计</div>
        <div class="stat-item">• 活跃天数: <span class="highlight">${activeDays}</span> 天</div>
        <div class="stat-item">• 活跃月数: <span class="highlight">${activeMonths.size}</span> 个月</div>
        <div class="stat-item">• 单日最长游戏: <span class="highlight">${maxHours}</span> 小时</div>
        <div class="stat-item">• 平均每日游戏: <span class="highlight">${avgHoursPerActiveDay}</span> 小时</div>
      </div>
    `;
  }

  return htmlContent;
}
