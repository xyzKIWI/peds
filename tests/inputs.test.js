'use strict';

// 全藥物掃描：缺值、0、負數、NaN、極端值，以及畫面數字的取整方式。
// 這些是程式行為，不涉及臨床數值；預期值依 dose-calculations.js 的既有設計（validWeight 0 < w ≤ 120、validAgeYears 0-18）。

const { describe, test } = require('node:test');
const { assert, calc, data, html, extractPageFunction } = require('./helpers.js');

// 列出所有「藥物 × 計算規則」
const calcEntries = [];
for (const d of data.drugs) {
  if (d.calc) calcEntries.push({ drug: d, calc: d.calc, label: d.id });
  (d.indications || []).forEach((ind, i) => calcEntries.push({ drug: d, calc: ind.calc, label: `${d.id}#${i}` }));
}

describe('validWeight / validAgeYears 邊界', () => {
  test('體重：0.1 與 120 可算；0、負數、120.01、NaN、Infinity、字串不可算', () => {
    assert.equal(calc.validWeight(0.1), true);
    assert.equal(calc.validWeight(120), true);
    for (const bad of [0, -0.1, 120.01, NaN, Infinity, -Infinity, '20', null, undefined]) {
      assert.equal(calc.validWeight(bad), false, String(bad));
    }
  });
  test('年齡：0 與 18 歲可算；負數、18.01、NaN 不可算', () => {
    assert.equal(calc.validAgeYears(0), true);
    assert.equal(calc.validAgeYears(18), true);
    for (const bad of [-0.01, 18.01, NaN, Infinity, '5']) assert.equal(calc.validAgeYears(bad), false, String(bad));
  });
  test('畫面體重輸入框 max="120"，與 JS、計算層一致（2026-11-05 修正，原本 100）', () => {
    assert.match(html, /id="weight"[^>]*max="120"/);
    assert.match(html, /v <= 0 \|\| v > 120/);
  });
});

describe('每個藥物的缺值／非法值', () => {
  for (const { drug, calc: c, label } of calcEntries) {
    const isAge = c.type === 'age_band';
    test(`${label}（${c.type}）`, () => {
      if (isAge) {
        assert.deepEqual(calc.calculateDose(drug, c, 20, null), { needs_age: true }, '缺年齡');
        assert.deepEqual(calc.calculateDose(drug, c, 20, undefined), { needs_age: true }, 'undefined 年齡');
        for (const bad of [-1, 18.5, NaN, 999]) {
          assert.deepEqual(calc.calculateDose(drug, c, 20, bad), { invalid_age: true }, `年齡 ${bad}`);
        }
      } else {
        assert.deepEqual(calc.calculateDose(drug, c, null, 5), { needs_weight: true }, '缺體重');
        assert.deepEqual(calc.calculateDose(drug, c, undefined, 5), { needs_weight: true }, 'undefined 體重');
        for (const bad of [0, -5, NaN, Infinity, 121, 1e6]) {
          assert.deepEqual(calc.calculateDose(drug, c, bad, 5), { invalid_weight: true }, `體重 ${bad}`);
        }
      }
    });
  }
});

describe('age_band 的體重處理', () => {
  const cet = data.drugs.find(d => d.id === 'cetirizine_syrup');
  test('< 3 歲 mg/kg 分組：體重 0 或負數 → invalid_weight', () => {
    assert.deepEqual(calc.calculateDose(cet, cet.calc, 0, 1), { invalid_weight: true });
    assert.deepEqual(calc.calculateDose(cet, cet.calc, -3, 1), { invalid_weight: true });
  });
  test('≥ 3 歲固定劑量分組：不檢查體重，體重 -3 仍回傳 5 mg（畫面輸入框會先擋掉；記錄現況）', () => {
    assert.deepEqual(calc.calculateDose(cet, cet.calc, -3, 4).mgRange, [5, 5]);
  });
});

describe('計算結果都是有限數字（0.1-120 kg × 0-18 歲掃描）', () => {
  test('沒有 NaN、Infinity、負數', () => {
    const weights = [0.1, 3, 10, 20, 40, 80, 120];
    const ages = [0, 0.5, 2, 6, 12, 18];
    for (const { drug, calc: c, label } of calcEntries) {
      for (const w of weights) for (const a of ages) {
        const r = calc.calculateDose(drug, c, w, a);
        for (const key of ['mgRange', 'mcgRange', 'mlRange', 'unitRange']) {
          if (!r[key]) continue;
          for (const v of r[key]) assert.ok(Number.isFinite(v) && v >= 0, `${label} ${w} kg ${a} 歲 ${key}=${v}`);
          assert.ok(r[key][0] <= r[key][1], `${label} ${w} kg ${key} 下限 > 上限`);
        }
        for (const key of ['packsPerDose', 'rate']) {
          if (r[key] !== undefined) assert.ok(Number.isFinite(r[key]) && r[key] >= 0, `${label} ${key}`);
        }
      }
    }
  });
  test('速算：0.1-120 kg 都是有限正數、不超過單次上限，且落在參考範圍內', () => {
    for (const { drug, calc: c, label } of calcEntries) {
      if (!c.quick) continue;
      for (let w = 0.5; w <= 120; w += 0.5) {
        const r = calc.calculateDose(drug, c, w, 10);
        const q = r.quick;
        if (q.units !== undefined) {
          // 顆數型（Voren）：落在 unitRange 內
          assert.ok(Number.isFinite(q.units) && q.units > 0, `${label} ${w} kg`);
          assert.ok(q.units >= r.unitRange[0] - 1e-9 && q.units <= r.unitRange[1] + 1e-9, `${label} ${w} kg 不在範圍內`);
          continue;
        }
        assert.ok(Number.isFinite(q.ml) && q.ml > 0, `${label} ${w} kg`);
        if (c.max_dose_mg) assert.ok(q.mg <= c.max_dose_mg + 1e-9, `${label} ${w} kg 超過上限`);
        assert.ok(q.mg >= r.mgRange[0] - 1e-9 && q.mg <= r.mgRange[1] + 1e-9, `${label} ${w} kg 不在範圍內`);
      }
    }
  });
  test('有 max_dose_mg 的規則：0.1-120 kg 任何體重都不超過上限', () => {
    for (const { drug, calc: c, label } of calcEntries) {
      if (!c.max_dose_mg) continue;
      for (let w = 0.5; w <= 120; w += 0.5) {
        const r = calc.calculateDose(drug, c, w, 10);
        assert.ok(r.mgRange[1] <= c.max_dose_mg + 1e-9, `${label} ${w} kg`);
      }
    }
  });
  test('有 max_mg_per_day 的 mg/kg/day 規則：每次 × 次數 不超過每日上限', () => {
    for (const { drug, calc: c, label } of calcEntries) {
      if (c.type !== 'mg_per_kg_per_day' || !c.max_mg_per_day) continue;
      const r = calc.calculateDose(drug, c, 120, 10);
      assert.ok(r.mgRange[1] * (c.doses_per_day || 1) <= c.max_mg_per_day + 1e-9, label);
    }
  });
});

describe('packageOrderAmount / singleDose 非法值', () => {
  test('packageOrderAmount：負劑量、0 或負濃度、0 包裝量 → null；0 mg → 0', () => {
    assert.equal(calc.packageOrderAmount(-1, 50, 10), null);
    assert.equal(calc.packageOrderAmount(NaN, 50, 10), null);
    assert.equal(calc.packageOrderAmount(10, -50, 10), null);
    assert.equal(calc.packageOrderAmount(10, 50, 0), null);
    assert.deepEqual(calc.packageOrderAmount(0, 50, 10), { originalMl: 0, packageFraction: 0 });
  });
  test('singleDose：非法體重 → null；濃度缺或 0 → ml 為 null；有上限參數時封頂', () => {
    assert.equal(calc.singleDose(0, 1, 50), null);
    assert.equal(calc.singleDose(-1, 1, 50), null);
    assert.equal(calc.singleDose(20, 1, 0).ml, null);
    assert.equal(calc.singleDose(20, 1).ml, null);
    assert.equal(calc.singleDose(100, 4, 50, 200).mg, 200);
  });
});

describe('畫面數字取整 num()（從 index.html 取出原函式執行，不改動頁面）', () => {
  const num = extractPageFunction('num');
  test('≥ 100 取整數；10-100 一位小數；< 10 兩位小數並去尾 0', () => {
    assert.equal(num(1000), '1000');
    assert.equal(num(100.4), '100');
    assert.equal(num(41.666), '41.7');
    assert.equal(num(12.5), '12.5');
    assert.equal(num(20), '20');
    assert.equal(num(1.875), '1.88');
    assert.equal(num(2.5), '2.5');
    assert.equal(num(3), '3');
    assert.equal(num(1 / 3), '0.33');
    assert.equal(num(0.26041666), '0.26');
  });
  test('0 → "0"；null／undefined／NaN → "—"', () => {
    assert.equal(num(0), '0');
    for (const v of [null, undefined, NaN]) assert.equal(num(v), '—');
  });
  test('< 0.005 會顯示成 "0"（例：0.4 kg epinephrine 0.004 mg；記錄現況，列入報告）', () => {
    assert.equal(num(0.004), '0');
  });
  test('顆數不取整到 ½ 或 ¼ 顆：0.26 tab、1.71 tab 照小數顯示', () => {
    assert.equal(num(1 / 3.84), '0.26');
    assert.equal(num(1500 / 875), '1.71');
  });
});

describe('頁面使用的計算層', () => {
  test('index.html 直接使用 PedsDoseCalc.calculateDose，沒有內嵌的舊計算副本（2026-11-05 移除）', () => {
    assert.match(html, /const calcDose = PedsDoseCalc\.calculateDose;/);
    assert.doesNotMatch(html, /function calcDose\(/);
    assert.match(html, /<script src="dose-calculations\.js"><\/script>/);
  });
});
