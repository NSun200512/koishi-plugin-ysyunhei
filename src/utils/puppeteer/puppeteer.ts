import fs from 'fs/promises'
import path from 'path'
import os from 'os'

import puppeteer from 'puppeteer-core';

import type { Browser } from 'puppeteer-core';
import type Config from '../../config';

const HTML_TEMPLATE_FILE_PATH = path.join(__dirname, 'template.html');

let browser: Browser;

async function findChromeExecutable(): Promise<string | undefined> {
  const platform = os.platform()
  const candidates: string[] = []
  if (platform === 'win32') {
    const programFiles = process.env['PROGRAMFILES'] || 'C:/Program Files'
    const programFilesx86 = process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)'
    const localAppData = process.env['LOCALAPPDATA'] || 'C:/Users/' + os.userInfo().username + '/AppData/Local'
    candidates.push(
      path.join(programFiles, 'Google/Chrome/Application/chrome.exe'),
      path.join(programFilesx86, 'Google/Chrome/Application/chrome.exe'),
      path.join(programFiles, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(programFilesx86, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(localAppData, 'Google/Chrome/Application/chrome.exe'),
      path.join(localAppData, 'Chromium/Application/chrome.exe'),
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    )
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
    )
  } else {
    // linux
    candidates.push(
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge',
    )
  }
  for (const p of candidates) {
    try {
      const stat = await fs.stat(p)
      if (stat.isFile()) return p
    } catch {}
  }
  return undefined
}

const init = async (executablePath?: string) => {
  const exe = executablePath && executablePath.trim() ? executablePath : await findChromeExecutable()
  if (!exe) throw new Error('未找到可用的 Chrome/Chromium/Edge 浏览器，请在配置中指定 browser_path。')
  browser = await puppeteer.launch({
      executablePath: exe,
      headless: true,
  });
}


const openHtmlFile = async (html: string, targetPath: string) : Promise<boolean> => {
  try {
    const HtmlFilsData = await fs.readFile(HTML_TEMPLATE_FILE_PATH, 'utf-8');
    if (!HtmlFilsData) return false;

    const NEWHTMLDATA = HtmlFilsData.replace(/\${content}/g, html);
  await fs.writeFile(targetPath, NEWHTMLDATA, 'utf-8');
    return true;

  } catch (error) {
    return false;
  }
}



export default async function puppeteerUtile(config: Config, html: string = ''): Promise<Buffer<ArrayBuffer> | string> {
  // 必须每次调用都重新生成新的浏览器对象，否则会报错-硬币

  await init(config.browser_path);

  // 为并发渲染生成唯一的临时 html 文件，避免相互覆盖
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ysyunhei-'))
  const targetPath = path.join(tmpDir, 'target.html')

  const result = await openHtmlFile(html, targetPath);
  if (!result) return void 0;

  // 打开一个新的页面
  const page = await browser.newPage();
  await page.goto('file://' + targetPath, { waitUntil: 'networkidle0' });
  // 截图并获取 Base64 编码
  const fileElement = await page.waitForSelector('#app');
  const screenshotBuffer = await fileElement.screenshot();
  const screenshotBase64 = Buffer.from(screenshotBuffer);

  // 关闭浏览器
  await browser.close();
  // 清理临时文件
  try { await fs.rm(tmpDir, { recursive: true, force: true }) } catch {}
  return screenshotBase64;
}
