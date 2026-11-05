'use strict';

// 頁面測試（Playwright）：頁尾、回入口連結、版面寬度、禁忌切換點、供應狀態。
// 本機沒裝 Playwright 時整個檔案 skip；CI 會安裝並設 REQUIRE_E2E=1。

const { describe, test, before, after } = require('node:test');
const { assert, data, html } = require('./helpers.js');
const { playwright, launch, openPage, setWeight, setAge, openView, hasHorizontalScroll } = require('./e2e-helpers.js');

describe('頁尾靜態內容（不需瀏覽器）', () => {
  test('HTML 內的免責聲明靜態副本與 _meta.disclaimer 完全一致', () => {
    const m = html.match(/<div class="disclaimer" id="disclaimer"[^>]*>([^<]*)<\/div>/);
    assert.ok(m, '找不到 #disclaimer');
    assert.equal(m[1], data._meta.disclaimer);
  });
  test('HTML 內的來源靜態副本與 _meta.primary_source、se_algorithm.citation 一致', () => {
    assert.ok(html.includes(`<li id="src-primary">${data._meta.primary_source}</li>`));
    assert.ok(html.includes(`<li id="src-se">SE 流程：${data.se_algorithm.citation}</li>`));
  });
  test('保留原本的校對日頁尾，日期與 _meta.last_updated 一致', () => {
    assert.ok(html.includes(`資料查核：${data._meta.last_updated}</div>`));
  });
});

describe('頁面（瀏覽器）', { skip: playwright ? false : '未安裝 Playwright（CI 會跑）' }, () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  test('頁尾顯示免責聲明（_meta 原文）、資料來源與校對日', async () => {
    const { page, context, errors } = await openPage(browser);
    assert.equal(await page.textContent('#disclaimer'), data._meta.disclaimer);
    assert.ok(await page.isVisible('#disclaimer'));
    const sources = await page.$$eval('#footer-sources li', items => items.map(li => li.textContent));
    assert.equal(sources[0], data._meta.primary_source);
    assert.ok(sources.some(s => s.includes('AHA/AAP 2025 PALS')));
    assert.ok(sources.some(s => s.includes(data.se_algorithm.citation)));
    assert.match(await page.textContent('.page-footer .footer-info'), /資料查核：2026-09-21/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('回入口連結：er.kiwi-ai.uk 上 href="../"', async () => {
    const { page, context } = await openPage(browser, { site: 'worker' });
    assert.equal(await page.textContent('#back-home'), '← 回急診臨床小工具');
    assert.equal(await page.getAttribute('#back-home', 'href'), '../');
    await context.close();
  });

  test('回入口連結：github.io 上改連 /ed-tools/', async () => {
    const { page, context } = await openPage(browser, { site: 'pages' });
    assert.equal(await page.getAttribute('#back-home', 'href'), '/ed-tools/');
    await context.close();
  });

  for (const [label, width] of [['手機 375px', 375], ['桌機 1280px', 1280]]) {
    test(`${label}：各分頁都沒有水平捲動`, async () => {
      const { page, context, errors } = await openPage(browser, { width, height: 812 });
      await setWeight(page, 20);
      await setAge(page, 5);
      const views = await page.$$eval('.tab', tabs => tabs.map(t => t.dataset.view));
      for (const view of views) {
        await openView(page, view);
        assert.equal(await hasHorizontalScroll(page), false, `${view} 分頁有水平捲動`);
      }
      assert.deepEqual(errors, []);
      await context.close();
    });
  }

  test('Ibuprofen 年齡切換點：5 個月 → 禁用並隱藏數字；6 個月 → 顯示 mL', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 7);
    await setAge(page, 5, 'months');
    const card = page.locator('.drug-card[data-id="idefen_syrup"]');
    assert.match(await card.innerText(), /已觸發明確禁用條件/);
    assert.doesNotMatch(await card.innerText(), /mL 數/);
    await setAge(page, 6, 'months');
    assert.doesNotMatch(await card.innerText(), /已觸發明確禁用條件/);
    // 7 kg × 5-10 mg/kg = 35-70 mg = 1.75-3.5 mL（20 mg/mL）
    assert.match(await card.innerText(), /1\.75-3\.5\s*mL/);
    await context.close();
  });

  test('Ketamine：預設途徑 IM；2 個月禁用並隱藏快捷數字；3 個月顯示 4 mg/kg', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 6);
    const card = page.locator('.drug-card[data-id="ketamine"]');
    assert.equal(await card.locator('select[data-protocol-field="route"]').inputValue(), 'IM');
    await setAge(page, 2, 'months');
    assert.match(await card.innerText(), /已觸發明確禁用條件，快捷給藥數字已隱藏/);
    await setAge(page, 3, 'months');
    // 6 kg × 4 mg/kg = 24 mg = 0.48 mL；開藥量 0.048 → 畫面兩位小數 0.05 Vial
    const text = await card.innerText();
    assert.match(text, /24 mg = 0\.48 mL/);
    assert.match(text, /開藥量 0\.05 Vial/);
    await context.close();
  });

  test('Novamin：1.9 歲禁用；2 歲顯示劑量', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 12);
    const card = page.locator('.drug-card[data-id="novamin_inj"]');
    await setAge(page, 1.9);
    assert.match(await card.innerText(), /已觸發明確禁用條件/);
    await setAge(page, 2);
    assert.match(await card.innerText(), /1\.2\s*mg/);
    await context.close();
  });

  test('供應狀態非 available 的品項（Midatin 舊品、Thiopental、Chloral hydrate）不顯示快捷數字', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 20);
    await openView(page, 'supply');
    for (const id of ['citosol', 'chloral_hydrate']) {
      const text = await page.locator(`.drug-card[data-id="${id}"]`).innerText();
      assert.match(text, /快捷給藥數字已隱藏/, id);
      assert.doesNotMatch(text, /\d\s*mL 數/, id);
    }
    await context.close();
  });

  test('輸入 0 kg 或 130 kg 時不計算（state 清空，顯示「輸入體重後計算」）', async () => {
    const { page, context } = await openPage(browser);
    page.on('dialog', d => d.dismiss());
    for (const kg of [0, -3, 130]) {
      await setWeight(page, kg);
      const text = await page.locator('.drug-card[data-id="lorazepam_inj"]').innerText();
      assert.match(text, /輸入體重後計算/, `${kg} kg`);
    }
    await context.close();
  });

  test('Taita 4-2-1 rule 卡片顯示 mL/hr 數字（2026-11-04 修正前顯示 undefined）', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 15);
    await page.fill('#search', 'taita');
    const text = await page.locator('#drug-list').innerText();
    assert.doesNotMatch(text, /undefined/);
    // 15 kg：40 + 5 × 2 = 50 mL/hr，三張卡都一樣
    assert.equal(text.match(/50 mL\/hr/g)?.length, 3);
    await setWeight(page, 120);
    assert.match(await page.locator('#drug-list').innerText(), /160 mL\/hr/);
    await context.close();
  });

  test('Tamiflu：沒輸入年齡 → 要求年齡；6 個月 6 kg → 18 mg；5 歲 15 kg → 30 mg', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 6);
    const card = page.locator('.drug-card[data-id="tamiflu"]');
    assert.match(await card.innerText(), /輸入年齡後計算/);
    await setAge(page, 6, 'months');
    assert.match(await card.innerText(), /3 mg\/kg BID[\s\S]*18\s*mg/);
    await setWeight(page, 15);
    await setAge(page, 5);
    assert.match(await card.innerText(), /30 mg BID × 5 days/);
    await context.close();
  });

  test('Xofluza：4 歲顯示「不建議」；5 歲不顯示', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 18);
    const card = page.locator('.drug-card[data-id="xofluza_tab"]');
    await setAge(page, 4);
    assert.match(await card.innerText(), /不建議[\s\S]*< 5 歲/);
    await setAge(page, 5);
    assert.doesNotMatch(await card.innerText(), /< 5 歲不在 FDA 仿單/);
    assert.match(await card.innerText(), /≥5 歲 \+ <20 kg/);
    await context.close();
  });
  test('速算為主：Anti-phen／Ibuprofen 16 kg 顯示「速算 BW÷2 → 8 mL」，範圍改為參考；120 kg 標示已達上限', async () => {
    const { page, context } = await openPage(browser, { width: 375 });
    await setWeight(page, 16);
    await setAge(page, 4);
    const ibu = page.locator('.drug-card[data-id="idefen_syrup"] .quick-dose');
    assert.match(await ibu.innerText(), /速算 BW÷2[\s\S]*8\s*mL[\s\S]*160 mg（10 mg\/kg）/);
    const apap = page.locator('.drug-group .quick-dose').first();
    assert.match(await apap.innerText(), /速算 BW÷2[\s\S]*8\s*mL[\s\S]*192 mg（12 mg\/kg）/);
    assert.ok(await page.locator('.dose-row-ref').count() > 0, '範圍列標為參考');
    await setWeight(page, 120);
    assert.match(await apap.innerText(), /41\.7\s*mL[\s\S]*已達單次上限 1000 mg/);
    assert.equal(await hasHorizontalScroll(page), false);
    await context.close();
  });

  test('沒有速算的藥照舊顯示範圍（例：Aswell）', async () => {
    const { page, context } = await openPage(browser);
    await setWeight(page, 10);
    const card = page.locator('.drug-card[data-id="aswell_syrup"], .drug-group:has([data-id="aswell_syrup"])').first();
    assert.equal(await card.count(), 1, '找到 Aswell 卡片');
    assert.match(await card.innerText(), /Aswell/);
    assert.equal(await card.locator('.quick-dose').count(), 0);
    await context.close();
  });
});
