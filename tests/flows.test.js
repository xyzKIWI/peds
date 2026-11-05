'use strict';

// PALS 與 SE 流程：驗證「資料檔 → 頁面」的步驟順序與劑量一致。不判斷指引本身。
// 出處：[PALS] AHA/AAP 2025 PALS 流程圖（cpr.heart.org 2025-Algorithms），[AES] AES 2016 CSE 流程圖，2026-11-04 讀取。

const { describe, test, before, after } = require('node:test');
const { assert, data, drug } = require('./helpers.js');
const { playwright, launch, openPage, setWeight, openView } = require('./e2e-helpers.js');

const pals = id => data.pals_algorithms.find(a => a.id === id);

describe('PALS 資料（不需瀏覽器）', () => {
  test('三個流程依序為 cardiac arrest → tachy with pulse → brady with pulse', () => {
    assert.deepEqual(data.pals_algorithms.map(a => a.id), ['cardiac_arrest', 'tachy_pulse', 'brady_pulse']);
  });
  test('[PALS] Cardiac arrest 藥物順序：epinephrine → amiodarone → lidocaine（流程圖第 5 步 epinephrine，第 7 步 amiodarone 或 lidocaine）', () => {
    assert.deepEqual(pals('cardiac_arrest').drugs, ['epinephrine_arrest', 'amiodarone_arrest', 'lidocaine_arrest']);
  });
  test('[PALS] 電擊能量：2 J/kg → 4 J/kg → ≥ 4 J/kg（max 10 J/kg or adult dose）', () => {
    const e = pals('cardiac_arrest').energy_doses;
    assert.deepEqual(e.map(x => x.j_per_kg), [2, 4, 4]);
    assert.match(e[2].note, /max 10 J\/kg or adult dose/);
  });
  test('[PALS] 同步電擊：0.5-1 J/kg → 2 J/kg', () => {
    const e = pals('tachy_pulse').energy_doses;
    assert.deepEqual(e.map(x => [x.j_per_kg, x.high_j_per_kg]), [[0.5, 1], [2, undefined]]);
  });
  test('[PALS] Tachy 用 adenosine；Brady 用 epinephrine → atropine', () => {
    assert.deepEqual(pals('tachy_pulse').drugs, ['adenosine']);
    assert.deepEqual(pals('brady_pulse').drugs, ['epinephrine_arrest', 'atropine_brady']);
  });
  test('流程引用的藥物 id 都存在於藥物清單', () => {
    for (const a of data.pals_algorithms) for (const id of a.drugs || []) assert.ok(drug(id), id);
  });
});

describe('SE 資料（不需瀏覽器）', () => {
  const stages = data.se_algorithm.time_stages;
  test('[AES] 四個階段依時間排序：0–5 → 5–20 → 20–40 → 40–60 min', () => {
    assert.deepEqual(stages.map(s => s.minutes), ['0–5', '5–20', '20–40', '40–60']);
  });
  test('第一線（5–20 min）藥物順序', () => {
    assert.deepEqual(stages[1].drugs, ['midazolam_midatin_5mg_shortage', 'lorazepam_inj', 'diazepam_iv', 'diazepam_pr', 'phenobarbital_iv']);
  });
  test('[AES] 第二線（20–40 min）順序與 AES 一致：phenytoin（AES 為 fosphenytoin）→ valproate → levetiracetam → 備案 phenobarbital', () => {
    assert.deepEqual(stages[2].drugs, ['phenytoin_iv', 'depakine_iv', 'keppra_iv', 'phenobarbital_iv']);
  });
  test('第一線的 midazolam 是舊品 2MIDAT（缺藥），新品 2MID50 不在 SE 流程裡（記錄現況，列入報告）', () => {
    assert.equal(drug('midazolam_midatin_5mg_shortage').availability.status, 'shortage');
    assert.ok(!stages.some(s => (s.drugs || []).includes('midazolam_dormicum')));
  });
  test('流程引用的藥物 id 都存在於藥物清單', () => {
    for (const s of stages) for (const id of s.drugs || []) assert.ok(drug(id), id);
  });
});

describe('PALS／SE 頁面（瀏覽器，20 kg）', { skip: playwright ? false : '未安裝 Playwright（CI 會跑）' }, () => {
  let browser;
  before(async () => { browser = await launch(); });
  after(async () => { await browser?.close(); });

  async function rows(page, cardIndex) {
    return page.locator('.pals-card').nth(cardIndex).locator('.pals-drug-row').evaluateAll(els => els.map(el => ({
      name: el.querySelector('.drug-name-mini').childNodes[0].textContent.trim(),
      dose: el.querySelector('.drug-dose').innerText.trim()
    })));
  }

  test('PALS 頁面順序與 20 kg 劑量', async () => {
    const { page, context, errors } = await openPage(browser);
    await setWeight(page, 20);
    await openView(page, 'pals');
    const titles = await page.$$eval('.pals-card h2', hs => hs.map(h => h.textContent));
    assert.deepEqual(titles.map(t => data.pals_algorithms.findIndex(a => t.includes(a.title))), [0, 1, 2]);

    // Cardiac arrest：epinephrine 0.01 mg/kg、amiodarone 5 mg/kg、lidocaine 1 mg/kg
    assert.deepEqual(await rows(page, 0), [
      { name: 'Epinephrine', dose: '0.2 mg (2 mL)' },
      { name: 'Amiodarone', dose: '100 mg (2 mL)' },
      { name: 'Lidocaine', dose: '20 mg (1 mL)' }
    ]);
    // Tachy：adenosine 0.1 → 0.2 mg/kg（3 mg/mL）
    assert.deepEqual(await rows(page, 1), [
      { name: 'Adenosine', dose: '2 mg (0.67 mL)' },
      { name: 'Adenosine', dose: '4 mg (1.33 mL)' }
    ]);
    // Brady：epinephrine → atropine 0.02 mg/kg（0.5 mg/mL）
    assert.deepEqual(await rows(page, 2), [
      { name: 'Epinephrine', dose: '0.2 mg (2 mL)' },
      { name: 'Atropine', dose: '0.4 mg (0.8 mL)' }
    ]);
    // 電擊能量
    const energy = await page.$$eval('.pals-energy', els => els.map(e => e.querySelector('.val').textContent));
    assert.deepEqual(energy, ['40 J', '80 J', '80 J', '10-20 J', '40 J']);
    // 初始步驟照資料順序
    const steps = await page.locator('.pals-card').nth(0).locator('.pals-section').first().locator('li').allTextContents();
    assert.deepEqual(steps, pals('cardiac_arrest').steps_initial.map(s => s.replace(/<[^>]+>/g, '')));
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('PALS 3 kg 與 120 kg：上下限是否套用', async () => {
    const { page, context } = await openPage(browser);
    await openView(page, 'pals');
    await setWeight(page, 3);
    assert.deepEqual((await rows(page, 2))[1], { name: 'Atropine', dose: '0.1 mg (0.2 mL)' }, 'atropine 最低 0.1 mg');
    await setWeight(page, 120);
    assert.deepEqual(await rows(page, 0), [
      { name: 'Epinephrine', dose: '1 mg (10 mL)' },
      { name: 'Amiodarone', dose: '300 mg (6 mL)' },
      { name: 'Lidocaine', dose: '100 mg (5 mL)' }
    ]);
    assert.deepEqual((await rows(page, 2))[1], { name: 'Atropine', dose: '0.5 mg (1 mL)' }, 'atropine 單劑上限 0.5 mg');
    await context.close();
  });

  test('PALS 120 kg 電擊能量照 J/kg 直接乘，沒有成人上限（記錄現況，列入報告）', async () => {
    const { page, context } = await openPage(browser);
    await openView(page, 'pals');
    await setWeight(page, 120);
    const energy = await page.$$eval('.pals-energy', els => els.map(e => e.querySelector('.val').textContent));
    assert.deepEqual(energy, ['240 J', '480 J', '480 J', '60-120 J', '240 J']);
    await context.close();
  });

  test('SE 頁面：階段順序、每階段藥物順序與 20 kg 劑量', async () => {
    const { page, context, errors } = await openPage(browser);
    await setWeight(page, 20);
    await openView(page, 'se');
    const times = await page.$$eval('.se-stage-time', els => els.map(e => e.textContent));
    assert.deepEqual(times, ['0–5 min', '5–20 min', '20–40 min', '40–60 min']);

    const stageRows = idx => page.locator(`.se-stage[data-stage="${idx}"] .pals-drug-row`).evaluateAll(els => els.map(el => ({
      name: el.querySelector('.drug-name-mini').childNodes[0].textContent.trim(),
      dose: el.querySelector('.drug-dose').innerText.replace(/\s+/g, ' ').trim()
    })));
    assert.equal((await stageRows(0)).length, 0);
    assert.deepEqual(await stageRows(1), [
      // 舊 Midatin 為缺藥：只顯示供應狀態文字，不顯示劑量
      { name: 'Midazolam', dose: `${drug('midazolam_midatin_5mg_shortage').availability.label} 不顯示院內快捷劑量` },
      { name: 'Lorazepam', dose: '2 mg (1 mL)' },
      { name: 'Diazepam', dose: '3-4 mg (0.6-0.8 mL)' },   // 0.15-0.2 mg/kg（AES）
      { name: 'Diazepam', dose: '10 mg (2.5 mL)' },
      { name: 'Phenobarbital', dose: '300 mg (3 mL)' }
    ]);
    assert.deepEqual(await stageRows(2), [
      { name: 'Phenytoin', dose: '400 mg (8 mL)' },
      { name: 'Valproate Sodium', dose: '800 mg (8 mL)' },
      { name: 'Levetiracetam', dose: '1200 mg (12 mL)' },
      { name: 'Phenobarbital', dose: '300 mg (3 mL)' }
    ]);
    assert.equal((await stageRows(3)).length, 0);
    const decisions = await page.$$eval('.se-decision', els => els.length);
    assert.equal(decisions, 3, '階段之間有 3 個「Does Seizure Continue?」');
    assert.match(await page.textContent('.pals-citation'), /Glauser T/);
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('SE 120 kg：各藥封頂', async () => {
    const { page, context } = await openPage(browser);
    await openView(page, 'se');
    await setWeight(page, 120);
    const doses = await page.locator('.se-stage .pals-drug-row .drug-dose').allInnerTexts();
    assert.deepEqual(doses.slice(1).map(s => s.replace(/\s+/g, ' ').trim()), [
      '4 mg (2 mL)',        // lorazepam max 4
      '10 mg (2 mL)',       // diazepam IV max 10
      '20 mg (5 mL)',       // diazepam PR max 20
      '1000 mg (10 mL)',    // phenobarbital max 1000
      '1500 mg (30 mL)',    // phenytoin max 1500
      '3000 mg (30 mL)',    // valproate max 3000
      '4500 mg (45 mL)',    // levetiracetam max 4500
      '1000 mg (10 mL)'
    ]);
    await context.close();
  });
});
