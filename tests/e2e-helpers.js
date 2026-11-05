'use strict';

// 頁面測試共用：用 Playwright 攔截請求，把 repo 檔案「假裝」放在正式網址底下，
// 這樣可以同時測 er.kiwi-ai.uk/peds/ 與 xyzkiwi.github.io/peds/ 兩種入口。
const fs = require('node:fs');
const path = require('node:path');
const { root, loadPlaywright } = require('./helpers.js');

const playwright = loadPlaywright();
const SITES = {
  worker: 'https://er.kiwi-ai.uk/peds/',
  pages: 'https://xyzkiwi.github.io/peds/'
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json' };

async function launch() {
  const browser = await playwright.chromium.launch();
  return browser;
}

async function openPage(browser, { site = 'worker', width = 1280, height = 900 } = {}) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    const known = Object.values(SITES).some(base => url.href.startsWith(new URL(base).origin));
    if (!known) return route.abort();
    const rel = url.pathname.replace(/^\/peds\//, '') || 'index.html';
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: 'not found' });
    }
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(SITES[site]);
  return { page, context, errors };
}

async function setWeight(page, kg) {
  await page.fill('#weight', String(kg));
}

async function setAge(page, value, unit = 'years') {
  await page.selectOption('#age-unit', unit);
  await page.fill('#age', String(value));
}

async function openView(page, view) {
  await page.click(`.tab[data-view="${view}"]`);
}

async function hasHorizontalScroll(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

module.exports = { playwright, SITES, launch, openPage, setWeight, setAge, openView, hasHorizontalScroll };
