import fs from 'fs/promises'
import path from 'path'

import puppeteer from 'puppeteer-core';
import type { Context } from 'koishi'
import { getLogger } from '../logger'

import type { Browser } from 'puppeteer-core';
import type Config from '../../config';

// 同时支持外联模板与内联模板：优先读取外联，失败时回退到内联
const HTML_TEMPLATE_FILE_PATH = path.join(__dirname, 'template.html');
// 将模板内联作为回退，避免打包后找不到外部文件导致渲染失败
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ysyunhei</title>
  <style>
    #app {
      width: fit-content;
    }
  </style>
  <!-- 防止滚动条影响尺寸 -->
  <style>
    html, body { margin: 0; padding: 0; }
  </style>
  </head>
  <body>
  <div id="app">__CONTENT__</div>
  </body>
</html>`;

let browser: Browser;

const init = async (executablePath: string) => {
  browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: true,
  });
}


const composeHtml = async (html: string): Promise<string | undefined> => {
  try {
    let tpl: string | undefined;
    try {
      tpl = await fs.readFile(HTML_TEMPLATE_FILE_PATH, 'utf-8');
    } catch {}
    return (tpl ?? HTML_TEMPLATE).replace(/__CONTENT__/g, html);
  } catch {
    return undefined;
  }
}



export default async function puppeteerUtile(ctx: Context, config: Config, html: string = ''): Promise<Buffer<ArrayBuffer> | string> {
  // 必须每次调用都重新生成新的浏览器对象，否则会报错-硬币
  const logger = getLogger(ctx, config)
  logger.info('[puppeteer] launching', { path: config.browser_path })
  await init(config.browser_path);
  const finalHtml = await composeHtml(html)
  if (!finalHtml) return void 0
  logger.debug('[puppeteer] html composed')

  // 打开一个新的页面
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: 'domcontentloaded' })
  logger.debug('[puppeteer] page content set')
  // 截图并获取 Base64 编码
  const fileElement = await page.waitForSelector('#app');
  logger.debug('[puppeteer] #app selected')
  const screenshotBuffer = await fileElement.screenshot();
  logger.info('[puppeteer] screenshot done', { bytes: (screenshotBuffer as any)?.length })
  const screenshotBase64 = Buffer.from(screenshotBuffer);

  // 关闭浏览器
  await browser.close();
  logger.info('[puppeteer] browser closed')
  return screenshotBase64;
}
