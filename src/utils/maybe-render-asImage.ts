import { h } from 'koishi';

import xh from './h/h';
import puppeteerUtile from './puppeteer/puppeteer';
import { getLogger } from './logger'

import type { Context } from 'koishi';
import type Config from '../config';
/**
 * 将纯文本渲染为图片卡片（若可用），否则回落为文本
 * @param ctx 上下文
 * @param config
 * @param text
 * @param options
 * @returns
 */
export default async function maybeRenderAsImage(
  ctx: Context,
  config: Config,
  text: string,
  options?: { title?: string }
): Promise<any> {
  try {
    const logger = getLogger(ctx, config)
  if (!config.render_as_image) { logger.info('[render] disabled by config'); return text }
  // 未配置浏览器路径时跳过渲染，回退为文本
  if (!config.browser_path) { logger.warn('[render] skip: missing browser_path'); return text }
    const title = options?.title ?? '云黑结果'
    // 拆分为行，构造简单卡片（使用 h()，避免 .ts 中使用 JSX）
    const lines = String(text ?? '').split('\n')
    let url = ''
    const li = []
    for (const line of lines) {
      const zz = line.match(/(http|https):\/\/[^\s]+$/)
      if (zz) {
        // url = zz[0]
        url = line
      } else {
        li.push(xh('div', { style: { marginBottom: '8px' } }, line))
      }
    }

  // 主题颜色与时间段：使用新配置
  const lightColor = config.theme_light_color ?? '#e8edf2'
  const darkColor = config.theme_dark_color ?? '#252525'
  const startHour = (config.theme_start_hour ?? 8) | 0
  const endHour = (config.theme_end_hour ?? 20) | 0
  const colorTx = colorByHour(startHour, endHour, lightColor, darkColor)
    // koishi 的 h() 函数不支持传入css
    const vnode = xh(
      'div',
      {
        style: {
          width: '900px',
          padding: '32px',
          background: colorTx(true),
          color: colorTx(false),
          fontSize: '28px',
          fontFamily: 'Microsoft YaHei, Segoe UI, Arial, sans-serif',
          lineHeight: 1.6,
        },
      },
  xh('div', { style: { fontSize: '34px', fontWeight: '700', marginBottom: '16px' } }, title),
      xh('div', { style: { height: '2px', background: '#2a3340', marginBottom: '16px' } }),
      ...li.map((ln, i) =>
        xh(
          'div',
          { style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } },
          ln || ' '
        )
      ),
      xh('div', { style: { marginTop: '16px', color: '#7b8794', fontSize: '22px' } }, '由 koishi-plugin-ysyunhei 生成')
    )
  const buf = await puppeteerUtile(ctx, config, vnode)
    if (!buf) return text
    return h('div',
      h.image('base64://' + buf.toString('base64')),
      url
    )
  } catch (e) {
  try { (ctx as any).logger('ysyunhei').error('[render] failed:', e) } catch {}
    return text
  }
}

function colorByHour(start: number, end: number, lightColor = '#e8edf2', darkColor = '#252525') : (bg: boolean) => string {
  // 使用北京时间（UTC+8），与精致睡眠逻辑保持一致
  const bj = new Date(Date.now() + 8 * 60 * 60 * 1000)
  const h = bj.getUTCHours()
  // 支持跨零点时间段
  const isLight = start === end
    ? true
    : (start < end ? (h >= start && h < end) : (h >= start || h < end))
  return (bg: boolean = true) => bg ? (isLight ? lightColor : darkColor) : (isLight ? darkColor : lightColor)
}
