import fs from 'fs/promises'
import path from 'path'

import puppeteer from 'puppeteer-core';

import type { Browser } from 'puppeteer-core';
import type Config from '../../config';

const HTML_TEMPLATE_FILE_PATH = path.join(__dirname, 'template.html');
const HTML_TARGET_FILE_PATH = path.join(__dirname, 'target.html');

let browser: Browser;

const init = async (executablePath: string) => {
  browser = await puppeteer.launch({
      executablePath: executablePath,
      headless: true,
  });
}


const openHtmlFile = async (html: string) : Promise<boolean> => {
  try {
    const HtmlFilsData = await fs.readFile(HTML_TEMPLATE_FILE_PATH, 'utf-8');
    if (!HtmlFilsData) return false;

    const NEWHTMLDATA = HtmlFilsData.replace(/\${content}/g, html);

    fs.writeFile(HTML_TARGET_FILE_PATH, NEWHTMLDATA, 'utf-8');
    return true;

  } catch (error) {
    return false;
  }
}



export default async function puppeteerUtile(config: Config, html: string = ''): Promise<Buffer<ArrayBuffer> | string> {
  // 必须每次调用都重新生成新的浏览器对象，否则会报错-硬币

  await init(config.browser_path);

  const result = await openHtmlFile(html);
  if (!result) return void 0;

  // 打开一个新的页面
  const page = await browser.newPage();
  await page.goto('file://' + HTML_TARGET_FILE_PATH, { waitUntil: 'networkidle0' });
  // 截图并获取 Base64 编码
  const fileElement = await page.waitForSelector('#app');
  const screenshotBuffer = await fileElement.screenshot();
  const screenshotBase64 = Buffer.from(screenshotBuffer);

  // 关闭浏览器
  await browser.close();
  return screenshotBase64;
}
