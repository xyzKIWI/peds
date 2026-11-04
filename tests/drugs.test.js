'use strict';

// 逐藥驗算：每個藥物至少涵蓋
//   1. 有出處的計算範例（註解寫出處；找不到外部可逐字核對的原文就寫「未找到可驗證範例」）
//   2. 體重邊界：3 kg、一般體重、達到上限時是否封頂
//   3. mg → mL 依濃度換算；顆數／包數的取整方式（本工具一律不取整，見 TEST_REPORT.md）
//   4. 年齡或體重的切換點
//   5. 缺值、0、負數、極端值（另見 inputs.test.js 的全藥物掃描）
//
// 預期值一律手算寫死，不從程式反推。
// 和出處不一致的案例以 { todo } 標記：會執行、會顯示失敗原因，但不讓 CI 變紅；全部列在 TEST_REPORT.md。
//
// 出處縮寫：
//   [JSON]  peds_drugs.json 該藥的 source 欄。只驗「資料檔數值 → 畫面數字」的算術；未取得原文逐字核對。
//   [PALS]  AHA/AAP 2025 PALS 流程圖（cpr.heart.org 2025-Algorithms：Algorithm-PALS-CA-250123、
//           Algorithm-PALS-Bradycardia-250121、Algorithm-PALS-Tachyarrhythmia-LngDscrp-250729），2026-11-04 讀取
//   [AES]   AES 2016 Proposed Algorithm for Convulsive Status Epilepticus（aesnet.org cse-treatment-chart-final_rerelease.pdf），2026-11-04 讀取
//   [FDA-Tamiflu] TAMIFLU 美國仿單 Table 1（accessdata.fda.gov 021087s071,021246s054lbl.pdf），2026-11-04 讀取
//   [FDA-Xofluza] XOFLUZA 美國仿單 Table 1-3（accessdata.fda.gov 210854s023,214410s008lbl.pdf），2026-11-04 讀取

const { describe, test } = require('node:test');
const { assert, data, drug, dose, close, range } = require('./helpers.js');

const covered = new Set();
function drugSuite(id, fn) {
  covered.add(id);
  describe(`${id}（${drug(id).generic}）`, fn);
}

// ---------------------------------------------------------------- 退燒止痛
drugSuite('antiphen_syrup', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表] 20 kg：10-15 mg/kg → 200-300 mg', () => {
    range(dose('antiphen_syrup', 20).mgRange, [200, 300], 'mg');
  });
  test('3 kg：30-45 mg = 1.25-1.875 mL（24 mg/mL）', () => {
    const r = dose('antiphen_syrup', 3);
    range(r.mgRange, [30, 45], 'mg');
    range(r.mlRange, [1.25, 1.875], 'mL');
  });
  test('70 kg：高值先封頂 1000 mg/dose，低值 700 mg 未達上限', () => {
    const r = dose('antiphen_syrup', 70);
    range(r.mgRange, [700, 1000], 'mg');
    range(r.mlRange, [700 / 24, 1000 / 24], 'mL');
  });
  test('每日上限（max_mg_per_day / max_mg_per_kg_per_day / max_doses_per_day）只顯示文字，不參與計算', () => {
    const r = dose('antiphen_syrup', 120);
    range(r.mgRange, [1000, 1000], '單次封頂');
    assert.equal(r.dailyCap, undefined);
  });
});

drugSuite('acetaminophen_tab', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表] 20 kg：200-300 mg = 0.4-0.6 tab（500 mg/tab，不取整）', () => {
    const r = dose('acetaminophen_tab', 20);
    range(r.mgRange, [200, 300], 'mg');
    range(r.unitRange, [0.4, 0.6], 'tab');
  });
  test('3 kg：30-45 mg = 0.06-0.09 tab（顆數不取整）', () => {
    range(dose('acetaminophen_tab', 3).unitRange, [0.06, 0.09], 'tab');
  });
  test('120 kg：封頂 1000 mg = 2 tab', () => {
    const r = dose('acetaminophen_tab', 120);
    range(r.mgRange, [1000, 1000], 'mg');
    range(r.unitRange, [2, 2], 'tab');
  });
});

drugSuite('idefen_syrup', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表] 20 kg：5-10 mg/kg → 100-200 mg = 5-10 mL', () => {
    const r = dose('idefen_syrup', 20);
    range(r.mgRange, [100, 200], 'mg');
    range(r.mlRange, [5, 10], 'mL');
  });
  test('3 kg：15-30 mg = 0.75-1.5 mL', () => {
    range(dose('idefen_syrup', 3).mlRange, [0.75, 1.5], 'mL');
  });
  test('50 kg：高值封頂 400 mg（20 mL），低值 250 mg', () => {
    const r = dose('idefen_syrup', 50);
    range(r.mgRange, [250, 400], 'mg');
    range(r.mlRange, [12.5, 20], 'mL');
  });
  test('年齡切換點資料：< 6 個月 禁用（畫面行為見 page.test.js）', () => {
    const c = drug('idefen_syrup').contraindications[0];
    assert.deepEqual([c.type, c.threshold_months, c.severity], ['age_below_months', 6, '禁用']);
  });
});

drugSuite('voren_supp', () => {
  test('出處範例 [JSON 高醫速算表] 25 kg：BW÷25 ~ BW÷12.5 → 1-2 顆', () => {
    range(dose('voren_supp', 25).unitRange, [1, 2], 'supp');
  });
  test('3 kg：0.12-0.24 顆（不取整到半顆）', () => {
    range(dose('voren_supp', 3).unitRange, [0.12, 0.24], 'supp');
  });
  test('120 kg：4.8-9.6 顆 — 無單次封頂（記錄現況，列入報告）', () => {
    range(dose('voren_supp', 120).unitRange, [4.8, 9.6], 'supp');
  });
});

// ---------------------------------------------------------------- 感冒／呼吸道
for (const [id, mlPerKgDay, src] of [
  ['peace_syrup', 0.6, '高醫速算表'],
  ['cypromin_syrup', 0.6, '高醫速算表'],
  ['soltan_syrup', 0.6, '高醫速算表'],
  ['secorine_syrup', 1, '高醫速算表'],
  ['glyo_syrup', 1, '高醫速算表']
]) {
  drugSuite(id, () => {
    test(`出處範例 [JSON ${src}] 10 kg：${mlPerKgDay} mL/kg/day ÷ 3 → ${mlPerKgDay * 10 / 3} mL/dose`, () => {
      range(dose(id, 10).mlRange, [mlPerKgDay * 10 / 3, mlPerKgDay * 10 / 3], 'mL');
    });
    test('3 kg', () => {
      range(dose(id, 3).mlRange, [mlPerKgDay * 3 / 3, mlPerKgDay * 3 / 3], 'mL');
    });
    test('120 kg：無 mL 封頂（記錄現況，列入報告）', () => {
      range(dose(id, 120).mlRange, [mlPerKgDay * 120 / 3, mlPerKgDay * 120 / 3], 'mL');
    });
    test('mL/kg 型不換算 mg（即使資料有濃度）', () => {
      assert.equal(dose(id, 10).mgRange, undefined);
    });
  });
}

drugSuite('cypromin_tab', () => {
  test('出處範例 [JSON 高醫速算表] 10 kg：0.24 mg/kg/day ÷ 3 = 0.8 mg = 0.2 tab（4 mg/tab）', () => {
    const r = dose('cypromin_tab', 10);
    range(r.mgRange, [0.8, 0.8], 'mg');
    range(r.unitRange, [0.2, 0.2], 'tab');
  });
  test('3 kg：0.24 mg = 0.06 tab', () => {
    range(dose('cypromin_tab', 3).unitRange, [0.06, 0.06], 'tab');
  });
  test('100 kg：每日封頂 16 mg → 5.333 mg/dose = 1.333 tab', () => {
    const r = dose('cypromin_tab', 100);
    range(r.mgRange, [16 / 3, 16 / 3], 'mg');
    range(r.unitRange, [4 / 3, 4 / 3], 'tab');
  });
  test('同成分糖漿（cypromin_syrup）在 100 kg 換算 8 mg/dose = 24 mg/day，超過錠劑的 16 mg/day 上限（列入報告）', () => {
    const syrupMl = dose('cypromin_syrup', 100).mlRange[0];
    close(syrupMl * drug('cypromin_syrup').concentration_mg_per_ml * 3, 24, '糖漿 mg/day');
  });
});

drugSuite('cetirizine_syrup', () => {
  test('出處範例 [JSON 勝克敏液仿單 + 院內藥典] 2 歲 12 kg：0.25 mg/kg = 3 mg = 3 mL', () => {
    const r = dose('cetirizine_syrup', 12, 2);
    range(r.mgRange, [3, 3], 'mg');
    range(r.mlRange, [3, 3], 'mL');
  });
  test('3 kg 新生兒（0 歲）：0.75 mg = 0.75 mL', () => {
    range(dose('cetirizine_syrup', 3, 0).mlRange, [0.75, 0.75], 'mL');
  });
  test('< 3 歲但 25 kg：封頂 5 mg', () => {
    range(dose('cetirizine_syrup', 25, 2.9).mgRange, [5, 5], 'mg');
  });
  test('年齡切換點：2.99 歲用 mg/kg；3 歲 → 5 mg；5.99 歲 → 5 mg；6 歲 → 10 mg', () => {
    close(dose('cetirizine_syrup', 10, 2.99).mgRange[0], 2.5, '2.99 歲');
    close(dose('cetirizine_syrup', 10, 3).mgRange[0], 5, '3 歲');
    close(dose('cetirizine_syrup', 10, 5.99).mgRange[0], 5, '5.99 歲');
    close(dose('cetirizine_syrup', 10, 6).mgRange[0], 10, '6 歲');
  });
  test('缺年齡 → needs_age；< 3 歲缺體重 → needs_weight；≥ 3 歲固定劑量不需體重', () => {
    assert.deepEqual(dose('cetirizine_syrup', 10, null), { needs_age: true });
    assert.deepEqual(dose('cetirizine_syrup', null, 2), { needs_weight: true });
    close(dose('cetirizine_syrup', null, 4).mgRange[0], 5, '4 歲無體重');
  });
});

drugSuite('actein_granule', () => {
  test('出處範例 [JSON 高醫速算表] 30 kg：1 包/10 kg/day ÷ 3 = 1 包/dose', () => {
    close(dose('actein_granule', 30).packsPerDose, 1, '包');
  });
  test('3 kg：0.1 包/dose（不取整）', () => {
    close(dose('actein_granule', 3).packsPerDose, 0.1, '包');
  });
  test('120 kg：4 包/dose — 無封頂（記錄現況，列入報告）', () => {
    close(dose('actein_granule', 120).packsPerDose, 4, '包');
  });
});

drugSuite('acc_effervescent', () => {
  test('出處：[JSON 高醫藥品庫 + Lexicomp]；年齡分組文字，未找到可驗證範例', () => {
    assert.match(dose('acc_effervescent', 20, 8).bandText, /0\.5 # BID/);
  });
  test('年齡切換點：5.99 歲 → 不建議；6 歲 → 0.5 #；13.99 歲 → 0.5 #；14 歲 → 1 #', () => {
    assert.match(dose('acc_effervescent', 20, 5.99).bandText, /不建議/);
    assert.match(dose('acc_effervescent', 20, 6).bandText, /^0\.5 #/);
    assert.match(dose('acc_effervescent', 20, 13.99).bandText, /^0\.5 #/);
    assert.match(dose('acc_effervescent', 20, 14).bandText, /^1 #/);
  });
});

drugSuite('epinephrine_inh_croup', () => {
  test('出處範例 [JSON 高醫速算表 + Lexicomp] 3 kg：0.5 mL/kg → 1.5 mL', () => {
    range(dose('epinephrine_inh_croup', 3).mlRange, [1.5, 1.5], 'mL');
  });
  test('切換點：10 kg 剛好 5 mL；20 kg 封頂 5 mL', () => {
    range(dose('epinephrine_inh_croup', 10).mlRange, [5, 5], '10 kg');
    range(dose('epinephrine_inh_croup', 20).mlRange, [5, 5], '20 kg');
  });
});

for (const id of ['terbutaline_neb', 'ipratropium_neb']) {
  drugSuite(id, () => {
    test('出處：[JSON 高醫速算表]；體重分組文字，未找到可驗證範例', () => {
      assert.equal(dose(id, 3).bandText, '0.5 amp/dose');
    });
    test('體重切換點：19.9 kg → 0.5 amp；20 kg → 1 amp；120 kg → 1 amp', () => {
      assert.equal(dose(id, 19.9).bandText, '0.5 amp/dose');
      assert.equal(dose(id, 20).bandText, '1 amp/dose');
      assert.equal(dose(id, 120).bandText, '1 amp/dose');
    });
  });
}

drugSuite('exdila_syrup', () => {
  test('出處範例 [JSON 高醫速算表] 10 kg：0.25 mL/kg = 2.5 mL', () => {
    range(dose('exdila_syrup', 10).mlRange, [2.5, 2.5], 'mL');
  });
  test('3 kg → 0.75 mL；40 kg 剛好 10 mL；50 kg 封頂 10 mL', () => {
    range(dose('exdila_syrup', 3).mlRange, [0.75, 0.75], '3 kg');
    range(dose('exdila_syrup', 40).mlRange, [10, 10], '40 kg');
    range(dose('exdila_syrup', 50).mlRange, [10, 10], '50 kg');
  });
});

drugSuite('meptin_tab', () => {
  test('出處：[JSON Lexicomp + 高醫藥品庫]；體重分組文字，未找到可驗證範例', () => {
    assert.equal(dose('meptin_tab', 3).bandText, '0.5 # BID');
  });
  test('體重切換點：14.9 → 0.5 #；15 → 1 #；29.9 → 1 #；30 → 1-2 #', () => {
    assert.equal(dose('meptin_tab', 14.9).bandText, '0.5 # BID');
    assert.equal(dose('meptin_tab', 15).bandText, '1 # BID');
    assert.equal(dose('meptin_tab', 29.9).bandText, '1 # BID');
    assert.equal(dose('meptin_tab', 30).bandText, '1-2 # BID');
  });
});

drugSuite('prednisolone_tab', () => {
  test('出處範例 [JSON 高醫速算表 + Lexicomp] Croup 10 kg：2 mg/kg = 20 mg = 4 tab（5 mg/tab）', () => {
    const r = dose('prednisolone_tab', 10, undefined, 0);
    range(r.mgRange, [20, 20], 'mg');
    range(r.unitRange, [4, 4], 'tab');
  });
  test('3 kg：6 mg = 1.2 tab（不取整）', () => {
    range(dose('prednisolone_tab', 3, undefined, 0).unitRange, [1.2, 1.2], 'tab');
  });
  test('兩個適應症在 25 kg 剛好 50 mg，30 kg 封頂 50 mg = 10 tab', () => {
    for (const i of [0, 1]) {
      range(dose('prednisolone_tab', 25, undefined, i).mgRange, [50, 50], `ind ${i} 25 kg`);
      range(dose('prednisolone_tab', 30, undefined, i).unitRange, [10, 10], `ind ${i} 30 kg`);
    }
  });
});

drugSuite('methylpred_inj', () => {
  test('出處範例 [JSON 高醫速算表 + Lexicomp] 10 kg：1.6 mg/kg = 16 mg = 0.4 Vial（40 mg/Vial）', () => {
    const r = dose('methylpred_inj', 10, undefined, 0);
    range(r.mgRange, [16, 16], 'mg');
    range(r.unitRange, [0.4, 0.4], 'Vial');
  });
  test('3 kg：4.8 mg；40 kg：封頂 60 mg = 1.5 Vial', () => {
    range(dose('methylpred_inj', 3, undefined, 1).mgRange, [4.8, 4.8], '3 kg');
    const r = dose('methylpred_inj', 40, undefined, 1);
    range(r.mgRange, [60, 60], '40 kg');
    range(r.unitRange, [1.5, 1.5], '40 kg Vial');
  });
});

// ---------------------------------------------------------------- 抗生素
drugSuite('zithromax_susp', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表 + 中榮 PDF] 10 kg：10 mg/kg/day QD = 100 mg = 2.5 mL（40 mg/mL）', () => {
    const r = dose('zithromax_susp', 10);
    range(r.mgRange, [100, 100], 'mg');
    range(r.mlRange, [2.5, 2.5], 'mL');
  });
  test('3 kg → 30 mg = 0.75 mL；50 kg 剛好 500 mg；60 kg 封頂 500 mg = 12.5 mL', () => {
    range(dose('zithromax_susp', 3).mlRange, [0.75, 0.75], '3 kg');
    range(dose('zithromax_susp', 50).mgRange, [500, 500], '50 kg');
    range(dose('zithromax_susp', 60).mlRange, [12.5, 12.5], '60 kg');
  });
});

drugSuite('zithromax_tab', () => {
  test('出處範例 [JSON Lexicomp] 25 kg：250 mg = 1 粒', () => {
    range(dose('zithromax_tab', 25).unitRange, [1, 1], '粒');
  });
  test('3 kg → 0.12 粒；60 kg 封頂 500 mg = 2 粒', () => {
    range(dose('zithromax_tab', 3).unitRange, [0.12, 0.12], '3 kg');
    range(dose('zithromax_tab', 60).unitRange, [2, 2], '60 kg');
  });
});

for (const [id, key, perUnit, src] of [
  ['amoxicillin_susp', 'mlRange', 25, 'Lexicomp + 高醫速算表'],
  ['amoxicillin_cap', 'unitRange', 500, 'Lexicomp'],
  ['curam_susp', 'mlRange', 80, 'Lexicomp + 高醫速算表'],
  ['curam_tab', 'unitRange', 875, 'Lexicomp']
]) {
  drugSuite(id, () => {
    test(`出處範例 [JSON ${src}] 10 kg：80-90 mg/kg/day ÷ 2 = 400-450 mg/dose`, () => {
      const r = dose(id, 10);
      range(r.mgRange, [400, 450], 'mg');
      range(r[key], [400 / perUnit, 450 / perUnit], key);
    });
    test('3 kg：120-135 mg/dose', () => {
      range(dose(id, 3).mgRange, [120, 135], 'mg');
    });
    test('每日封頂 3000 mg：33.4 kg 高值已封頂；40 kg 兩端都是 1500 mg/dose', () => {
      const mid = dose(id, 34);
      close(mid.mgRange[0], 34 * 80 / 2, '34 kg 低值');
      close(mid.mgRange[1], 1500, '34 kg 高值');
      range(dose(id, 40).mgRange, [1500, 1500], '40 kg');
      range(dose(id, 40)[key], [1500 / perUnit, 1500 / perUnit], `40 kg ${key}`);
    });
  });
}

// ---------------------------------------------------------------- 流感
drugSuite('tamiflu', () => {
  // 已依 FDA 仿單修正（2026-11-04）：分組改為「low < 體重 ≤ high」，並加上 2 週至未滿 1 歲 3 mg/kg BID
  const band = (w, age = 5) => dose('tamiflu', w, age).bandText;
  test('出處範例 [FDA-Tamiflu] 5 歲 12 kg（15 kg or less）→ 30 mg BID', () => {
    assert.match(band(12), /^30 mg BID/);
  });
  test('[FDA-Tamiflu] 剛好 15 kg → 30 mg；15.1 kg → 45 mg', () => {
    assert.match(band(15), /^30 mg/);
    assert.match(band(15.1), /^45 mg/);
  });
  test('[FDA-Tamiflu] 剛好 23 kg → 45 mg；23.1 kg → 60 mg', () => {
    assert.match(band(23), /^45 mg/);
    assert.match(band(23.1), /^60 mg/);
  });
  test('[FDA-Tamiflu] 剛好 40 kg → 60 mg；40.1 kg → 75 mg；120 kg → 75 mg', () => {
    assert.match(band(40), /^60 mg/);
    assert.match(band(40.1), /^75 mg/);
    assert.match(band(120), /^75 mg/);
  });
  test('1 歲 3 kg → 30 mg（≥ 1 歲依體重分組）', () => {
    assert.match(band(3, 1), /^30 mg/);
  });
  test('[FDA-Tamiflu] 2 週至未滿 1 歲：3 mg/kg BID — 6 個月 6 kg = 18 mg；0.99 歲 9 kg = 27 mg', () => {
    const r = dose('tamiflu', 6, 0.5);
    range(r.mgRange, [18, 18], '6 kg');
    assert.match(r.rule, /3 mg\/kg BID/);
    range(dose('tamiflu', 9, 0.99).mgRange, [27, 27], '0.99 歲');
    range(dose('tamiflu', 3, 0).mgRange, [9, 9], '3 kg 新生兒');
  });
  test('嬰兒規則需要年齡：缺年齡 → needs_age；年齡 -1 或 19 → invalid_age；缺體重仍先要求體重', () => {
    assert.deepEqual(dose('tamiflu', 12, null), { needs_age: true });
    assert.deepEqual(dose('tamiflu', 12, -1), { invalid_age: true });
    assert.deepEqual(dose('tamiflu', 12, 19), { invalid_age: true });
    assert.deepEqual(dose('tamiflu', null, 5), { needs_weight: true });
  });
  test('[FDA-Tamiflu] 懸液濃度文字為 6 mg/mL（仿單 Table 1：30 mg = 5 mL；2026-11-04 由「60 mg/mL」修正）', () => {
    assert.match(drug('tamiflu').package, /(^|\D)6 mg\/mL susp/);
    assert.doesNotMatch(drug('tamiflu').package, /60 mg\/mL/);
  });
  test('嬰兒 3 mg/kg 沒有封頂、也沒有換算懸液 mL（資料無 concentration_mg_per_ml）', () => {
    const r = dose('tamiflu', 12, 0.9);
    range(r.mgRange, [36, 36], '12 kg 嬰兒');
    assert.equal(r.mlRange, undefined);
  });
});

drugSuite('rapiacta_iv', () => {
  test('出處範例 [JSON Lexicomp + 高醫藥品庫] 10 kg：10-12 mg/kg = 100-120 mg = 20-24 mL（5 mg/mL）', () => {
    const r = dose('rapiacta_iv', 10);
    range(r.mgRange, [100, 120], 'mg');
    range(r.mlRange, [20, 24], 'mL');
  });
  test('3 kg → 30-36 mg；50 kg 高值剛好 600；60 kg 兩端封頂 600 mg = 120 mL', () => {
    range(dose('rapiacta_iv', 3).mgRange, [30, 36], '3 kg');
    range(dose('rapiacta_iv', 50).mgRange, [500, 600], '50 kg');
    range(dose('rapiacta_iv', 60).mlRange, [120, 120], '60 kg');
  });
});

drugSuite('xofluza_tab', () => {
  test('出處範例 [FDA-Xofluza] < 20 kg → 2 mg/kg；20 至 < 80 kg → 40 mg；≥ 80 kg → 80 mg', () => {
    assert.match(dose('xofluza_tab', 19.9).bandText, /2 mg\/kg/);
    assert.match(dose('xofluza_tab', 20).bandText, /^40 mg/);
    assert.match(dose('xofluza_tab', 79.9).bandText, /^40 mg/);
    assert.match(dose('xofluza_tab', 80).bandText, /^80 mg/);
    assert.match(dose('xofluza_tab', 3).bandText, /2 mg\/kg/);
  });
  test('< 20 kg 只顯示「2 mg/kg」文字，沒有算出 mg', () => {
    assert.equal(dose('xofluza_tab', 15).mgRange, undefined);
  });
  test('[FDA-Xofluza] 仿單適用 ≥ 5 歲：禁忌設 < 5 歲「不建議」；分組、notes、藥品資料文字都寫 ≥5 歲（2026-11-04 修正）', () => {
    const d = drug('xofluza_tab');
    assert.ok(d.contraindications.some(c => c.type === 'age_below_years' && c.threshold_years === 5 && c.severity === '不建議'));
    assert.match(d.calc.bands[0].dose, /^≥5 歲/);
    assert.match(d.notes, /^≥5 歲/);
    assert.match(d.kmuh_detail['警語'], /^≥5 歲/);
    assert.doesNotMatch(JSON.stringify(d), /≥1 歲/);
  });
});

drugSuite('relenza_inh', () => {
  test('出處：[JSON Lexicomp + 高醫藥品庫]；年齡分組文字，未找到可驗證範例', () => {
    assert.match(dose('relenza_inh', 25, 10).bandText, /^10 mg/);
  });
  test('年齡切換點：6.99 歲 → 不建議；7 歲 → 10 mg', () => {
    assert.match(dose('relenza_inh', 25, 6.99).bandText, /不建議/);
    assert.match(dose('relenza_inh', 25, 7).bandText, /^10 mg/);
  });
});

// ---------------------------------------------------------------- 腸胃
drugSuite('aswell_syrup', () => {
  test('出處範例 [JSON 高醫速算表] 10 kg：0.1-0.2 mg/kg = 1-2 mg = 1-2 mL', () => {
    const r = dose('aswell_syrup', 10);
    range(r.mgRange, [1, 2], 'mg');
    range(r.mlRange, [1, 2], 'mL');
  });
  test('3 kg → 0.3-0.6 mL；60 kg → 6-10 mg（高值封頂）', () => {
    range(dose('aswell_syrup', 3).mlRange, [0.3, 0.6], '3 kg');
    range(dose('aswell_syrup', 60).mgRange, [6, 10], '60 kg');
  });
});

drugSuite('promeran_tab', () => {
  test('出處範例 [JSON Lexicomp + 高醫藥品庫] 10 kg：1-2 mg ÷ 3.84 mg/tab = 0.26-0.52 tab（不取整）', () => {
    range(dose('promeran_tab', 10).unitRange, [1 / 3.84, 2 / 3.84], 'tab');
  });
  test('3 kg；100 kg 封頂 10 mg', () => {
    range(dose('promeran_tab', 3).mgRange, [0.3, 0.6], '3 kg');
    range(dose('promeran_tab', 100).mgRange, [10, 10], '100 kg');
  });
});

drugSuite('primperan_inj', () => {
  test('出處範例 [JSON 高醫速算表] 10 kg：1-2 mg = 0.2-0.4 mL（5 mg/mL）', () => {
    range(dose('primperan_inj', 10).mlRange, [0.2, 0.4], 'mL');
  });
  test('3 kg → 0.06-0.12 mL；100 kg 封頂 10 mg = 2 mL', () => {
    range(dose('primperan_inj', 3).mlRange, [0.06, 0.12], '3 kg');
    range(dose('primperan_inj', 100).mlRange, [2, 2], '100 kg');
  });
});

drugSuite('novamin_inj', () => {
  test('出處範例 [JSON 高醫速算表] 20 kg：0.1 mg/kg = 2 mg = 0.4 Amp（5 mg/Amp）', () => {
    const r = dose('novamin_inj', 20);
    range(r.mgRange, [2, 2], 'mg');
    range(r.unitRange, [0.4, 0.4], 'Amp');
  });
  test('3 kg → 0.3 mg；120 kg 封頂 10 mg = 2 Amp', () => {
    range(dose('novamin_inj', 3).mgRange, [0.3, 0.3], '3 kg');
    range(dose('novamin_inj', 120).unitRange, [2, 2], '120 kg');
  });
  test('年齡切換點資料：< 2 歲 禁用', () => {
    const c = drug('novamin_inj').contraindications[0];
    assert.deepEqual([c.type, c.threshold_years, c.severity], ['age_below_years', 2, '禁用']);
  });
});

drugSuite('kascoal_tab', () => {
  test('出處：[JSON 高醫速算表]；年齡分組文字，未找到可驗證範例', () => {
    assert.equal(dose('kascoal_tab', 10, 1).bandText, '0.5 # QID');
  });
  test('年齡切換點：1.99 → 0.5 #；2 → 1 #；11.99 → 1 #；12 → 1-3 #', () => {
    assert.equal(dose('kascoal_tab', 10, 1.99).bandText, '0.5 # QID');
    assert.equal(dose('kascoal_tab', 10, 2).bandText, '1 # QID');
    assert.equal(dose('kascoal_tab', 10, 11.99).bandText, '1 # QID');
    assert.equal(dose('kascoal_tab', 10, 12).bandText, '1-3 # QID');
  });
});

drugSuite('lgg_pack', () => {
  test('出處：[JSON 高醫速算表]；年齡分組文字，未找到可驗證範例', () => {
    assert.equal(dose('lgg_pack', 15, 4).bandText, '0.3-0.5 包 TID');
  });
  test('年齡切換點：6 → 0.5-1 包；12 → 成人劑量', () => {
    assert.equal(dose('lgg_pack', 15, 6).bandText, '0.5-1 包 TID');
    assert.equal(dose('lgg_pack', 15, 12).bandText, '成人劑量');
  });
  test('< 3 歲沒有分組 → 顯示「無相符區間」（記錄現況，列入報告）', () => {
    assert.equal(dose('lgg_pack', 10, 2.9).bandText, '無相符區間');
  });
});

drugSuite('mgo_tab', () => {
  test('出處：[JSON 高醫速算表]；年齡分組文字，未找到可驗證範例', () => {
    assert.equal(dose('mgo_tab', 20, 3).bandText, '0.5-1 # TID-QID');
  });
  test('年齡切換點：1.99 → BW÷20；2 → 0.5-1 #；6 → 1-2 #；12 → 2 #', () => {
    assert.equal(dose('mgo_tab', 10, 1.99).bandText, 'BW÷20 # TID-QID');
    assert.equal(dose('mgo_tab', 10, 2).bandText, '0.5-1 # TID-QID');
    assert.equal(dose('mgo_tab', 20, 6).bandText, '1-2 # TID-QID');
    assert.equal(dose('mgo_tab', 40, 12).bandText, '2 # TID-QID');
  });
  test('分組有縫隙：5-6 歲、11-12 歲落在「無相符區間」（記錄現況，列入報告）', () => {
    assert.equal(dose('mgo_tab', 20, 5.5).bandText, '無相符區間');
    assert.equal(dose('mgo_tab', 35, 11.5).bandText, '無相符區間');
  });
  test('< 2 歲「BW÷20 #」只顯示公式文字，沒有算出顆數', () => {
    assert.equal(dose('mgo_tab', 10, 1).unitRange, undefined);
  });
});

drugSuite('glycerin_supp', () => {
  test('出處範例 [JSON 高醫速算表] 10 kg：0.5 mL/kg = 5 mL', () => {
    range(dose('glycerin_supp', 10).mlRange, [5, 5], 'mL');
  });
  test('3 kg → 1.5 mL；120 kg → 60 mL — 無封頂（記錄現況，列入報告）', () => {
    range(dose('glycerin_supp', 3).mlRange, [1.5, 1.5], '3 kg');
    range(dose('glycerin_supp', 120).mlRange, [60, 60], '120 kg');
  });
});

drugSuite('smecta', () => {
  test('出處範例 [JSON 高醫速算表 + 藥丹] 15 kg：BW÷30 = 0.5 包/dose', () => {
    close(dose('smecta', 15).packsPerDose, 0.5, '包');
  });
  test('3 kg → 0.1 包；120 kg → 4 包 — 無封頂（記錄現況，列入報告）', () => {
    close(dose('smecta', 3).packsPerDose, 0.1, '3 kg');
    close(dose('smecta', 120).packsPerDose, 4, '120 kg');
  });
});

// ---------------------------------------------------------------- 點滴
for (const id of ['taita1', 'taita2', 'taita5']) {
  drugSuite(id, () => {
    test('出處範例 [JSON 高醫藥品庫／高醫速算表] 4-2-1 rule：15 kg = 40 + 5×2 = 50 mL/hr', () => {
      close(dose(id, 15).rate, 50, 'rate');
    });
    test('體重切換點：3 kg 12；10 kg 40；20 kg 60；30 kg 70', () => {
      close(dose(id, 3).rate, 12, '3 kg');
      close(dose(id, 10).rate, 40, '10 kg');
      close(dose(id, 20).rate, 60, '20 kg');
      close(dose(id, 30).rate, 70, '30 kg');
    });
    test('120 kg → 160 mL/hr — 無封頂（記錄現況，列入報告）', () => {
      close(dose(id, 120).rate, 160, '120 kg');
    });
  });
}

// ---------------------------------------------------------------- 鎮靜止痛／RSI
drugSuite('morphine_inj', () => {
  test('出處範例 [JSON 高醫速算表 + Lexicomp] 10 kg：0.05-0.1 mg/kg = 0.5-1 mg = 0.05-0.1 mL（10 mg/mL）', () => {
    const r = dose('morphine_inj', 10);
    range(r.mgRange, [0.5, 1], 'mg');
    range(r.mlRange, [0.05, 0.1], 'mL');
  });
  test('3 kg → 0.15-0.3 mg；60 kg → 3-5 mg；100 kg → 5-5 mg（封頂）', () => {
    range(dose('morphine_inj', 3).mgRange, [0.15, 0.3], '3 kg');
    range(dose('morphine_inj', 60).mgRange, [3, 5], '60 kg');
    range(dose('morphine_inj', 100).mgRange, [5, 5], '100 kg');
  });
});

drugSuite('fentanyl_inj', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表] 10 kg：0.5-1 mcg/kg = 5-10 mcg = 0.1-0.2 mL（50 mcg/mL）', () => {
    const r = dose('fentanyl_inj', 10);
    range(r.mcgRange, [5, 10], 'mcg');
    range(r.mlRange, [0.1, 0.2], 'mL');
  });
  test('3 kg → 1.5-3 mcg = 0.03-0.06 mL；120 kg 封頂 50 mcg = 1 mL', () => {
    range(dose('fentanyl_inj', 3).mlRange, [0.03, 0.06], '3 kg');
    range(dose('fentanyl_inj', 120).mlRange, [1, 1], '120 kg');
  });
});

drugSuite('succinylcholine', () => {
  test('出處範例 [JSON Lexicomp + 高醫速算表] RSI IV 10 kg：1-2 mg/kg = 10-20 mg = 0.2-0.4 mL', () => {
    const r = dose('succinylcholine', 10, undefined, 0);
    range(r.mgRange, [10, 20], 'mg');
    range(r.mlRange, [0.2, 0.4], 'mL');
  });
  test('RSI IM 3 kg：3-4 mg/kg = 9-12 mg', () => {
    range(dose('succinylcholine', 3, undefined, 1).mgRange, [9, 12], 'mg');
  });
  test('120 kg：IV 120-240 mg、IM 360-480 mg — 無封頂（記錄現況，列入報告）', () => {
    range(dose('succinylcholine', 120, undefined, 0).mgRange, [120, 240], 'IV');
    range(dose('succinylcholine', 120, undefined, 1).mgRange, [360, 480], 'IM');
  });
});

drugSuite('ketamine', () => {
  // 既有 calculations.test.js 已驗 20 kg IM 80 mg = 1.6 mL = 0.16 Vial 與 IV 1 mg/kg
  const k = () => drug('ketamine');
  test('出處：[JSON] IM 預設來源 RCH Melbourne 2021-12、IV 預設來源 RCEM 2020；只驗算術', () => {
    const im = k().protocols.find(p => p.id === 'procedural_sedation_im');
    const r = require('../dose-calculations.js').singleDose(20, im.default_initial_mg_per_kg, im.default_concentration_mg_per_ml);
    close(r.mg, 80, 'mg');
    close(r.ml, 1.6, 'mL');
  });
  test('處置鎮靜的第一個途徑是 IM（畫面預設），第二個是 IV', () => {
    assert.deepEqual(k().protocols.filter(p => p.use === '處置鎮靜').map(p => p.route), ['IM', 'IV']);
  });
  test('3 kg IM：12 mg = 0.24 mL = 0.024 Vial；追加 6 mg', () => {
    const { singleDose, packageOrderAmount } = require('../dose-calculations.js');
    const r = singleDose(3, 4, 50);
    close(r.mg, 12, 'mg');
    close(r.ml, 0.24, 'mL');
    close(packageOrderAmount(12, 50, 10).packageFraction, 0.024, 'Vial');
    close(singleDose(3, 2, 50).mg, 6, '追加');
  });
  test('protocol 沒有 max_dose：120 kg IM 初始 480 mg = 9.6 mL — singleDose 支援上限參數但畫面未傳入（記錄現況，列入報告）', () => {
    const { singleDose } = require('../dose-calculations.js');
    close(singleDose(120, 4, 50).mg, 480, '120 kg IM');
    assert.ok(k().protocols.every(p => p.max_dose_mg === undefined));
  });
  test('只有「處置鎮靜」兩個方案是 shortcut；其餘只顯示參考範圍', () => {
    assert.deepEqual(k().protocols.filter(p => p.shortcut).map(p => p.id), ['procedural_sedation_im', 'procedural_sedation_iv']);
  });
  test('年齡切換點資料：< 3 個月 禁用', () => {
    const c = k().contraindications[0];
    assert.deepEqual([c.type, c.threshold_months, c.severity], ['age_below_months', 3, '禁用']);
  });
});

drugSuite('midazolam_dormicum', () => {
  test('出處：[JSON 高醫岡山藥品頁 2MID50 + 官方仿單]；所有方案 shortcut=false，不算快捷劑量，未找到可驗證範例', () => {
    const d = drug('midazolam_dormicum');
    assert.ok(d.protocols.length > 0);
    assert.ok(d.protocols.every(p => p.shortcut === false));
    assert.equal(d.concentration_mg_per_ml, 1);
  });
});

for (const id of ['midazolam_midatin_5mg_shortage', 'citosol', 'chloral_hydrate']) {
  drugSuite(id, () => {
    test(`供應狀態 ${drug(id).availability.status}：不在預設可用清單，畫面隱藏快捷數字（見 page.test.js）`, () => {
      assert.notEqual(drug(id).availability.status, 'available');
    });
  });
}

drugSuite('vena_tab', () => {
  test('出處範例 [JSON Lexicomp + 高醫藥品庫] 10 kg：1.25 mg/kg = 12.5 mg = 1.25 tab（10 mg/tab）', () => {
    range(dose('vena_tab', 10).unitRange, [1.25, 1.25], 'tab');
  });
  test('3 kg → 0.375 tab；40 kg 剛好 50 mg；60 kg 封頂 50 mg = 5 tab', () => {
    range(dose('vena_tab', 3).unitRange, [0.375, 0.375], '3 kg');
    range(dose('vena_tab', 40).mgRange, [50, 50], '40 kg');
    range(dose('vena_tab', 60).unitRange, [5, 5], '60 kg');
  });
});

drugSuite('vena_inj', () => {
  test('出處範例 [JSON 高醫速算表 + Lexicomp] 10 kg：1 mg/kg = 10 mg = 0.333 mL（30 mg/mL）', () => {
    range(dose('vena_inj', 10).mlRange, [1 / 3, 1 / 3], 'mL');
  });
  test('3 kg → 0.1 mL；60 kg 封頂 50 mg = 1.667 mL', () => {
    range(dose('vena_inj', 3).mlRange, [0.1, 0.1], '3 kg');
    range(dose('vena_inj', 60).mlRange, [50 / 30, 50 / 30], '60 kg');
  });
});

// ---------------------------------------------------------------- 抽搐／SE
drugSuite('lorazepam_inj', () => {
  test('出處範例 [AES] IV lorazepam 0.1 mg/kg/dose, max 4 mg：10 kg = 1 mg = 0.5 mL（2 mg/mL）', () => {
    const r = dose('lorazepam_inj', 10);
    range(r.mgRange, [1, 1], 'mg');
    range(r.mlRange, [0.5, 0.5], 'mL');
  });
  test('[AES] 3 kg → 0.3 mg；40 kg 剛好 4 mg；50 kg 封頂 4 mg = 2 mL', () => {
    range(dose('lorazepam_inj', 3).mgRange, [0.3, 0.3], '3 kg');
    range(dose('lorazepam_inj', 40).mgRange, [4, 4], '40 kg');
    range(dose('lorazepam_inj', 50).mlRange, [2, 2], '50 kg');
  });
});

drugSuite('diazepam_iv', () => {
  // 已依 AES 2016 修正（2026-11-04）：0.2-0.3 → 0.15-0.2 mg/kg，max 10 mg 不變
  test('出處範例 [AES] IV diazepam 0.15-0.2 mg/kg/dose, max 10 mg：10 kg = 1.5-2 mg = 0.3-0.4 mL（5 mg/mL）', () => {
    const r = dose('diazepam_iv', 10);
    range(r.mgRange, [1.5, 2], 'mg');
    range(r.mlRange, [0.3, 0.4], 'mL');
  });
  test('[AES] 3 kg → 0.45-0.6 mg；50 kg → 7.5-10 mg（高值剛好封頂）；70 kg → 10-10 mg = 2 mL', () => {
    range(dose('diazepam_iv', 3).mgRange, [0.45, 0.6], '3 kg');
    range(dose('diazepam_iv', 50).mgRange, [7.5, 10], '50 kg');
    range(dose('diazepam_iv', 70).mlRange, [2, 2], '70 kg');
  });
  test('藥卡與 SE 流程文字一致（se_algorithm 第一線寫 0.15–0.2 mg/kg）', () => {
    assert.ok(data.se_algorithm.time_stages[1].actions.some(a => a.includes('IV Diazepam：0.15–0.2 mg/kg')));
  });
});

drugSuite('diazepam_pr', () => {
  test('出處範例 [JSON Lexicomp + 藥丹] 10 kg：0.5 mg/kg = 5 mg = 1.25 mL（4 mg/mL）', () => {
    const r = dose('diazepam_pr', 10);
    range(r.mgRange, [5, 5], 'mg');
    range(r.mlRange, [1.25, 1.25], 'mL');
  });
  test('[AES] rectal diazepam 0.2-0.5 mg/kg, max 20 mg：工具取上限 0.5，40 kg 剛好 20 mg、50 kg 封頂 20 mg', () => {
    range(dose('diazepam_pr', 40).mgRange, [20, 20], '40 kg');
    range(dose('diazepam_pr', 50).mgRange, [20, 20], '50 kg');
    range(dose('diazepam_pr', 3).mgRange, [1.5, 1.5], '3 kg');
  });
  test('mL 只用 4 mg/mL（10 mg/2.5 mL 管）；資料另寫 5 mg/2.5 mL 管（2 mg/mL）時 mL 會差 2 倍（記錄現況，列入報告）', () => {
    assert.equal(drug('diazepam_pr').concentration_mg_per_ml, 4);
    assert.match(drug('diazepam_pr').concentration_note, /5 mg\/2\.5 mL/);
  });
});

for (const [id, conc, perUnit, src] of [
  ['keppra_syrup', 100, null, 'Lexicomp'],
  ['keppra_tab', null, 500, 'Lexicomp']
]) {
  drugSuite(id, () => {
    test(`出處範例 [JSON ${src}] 10 kg：20-40 mg/kg/day ÷ 2 = 100-200 mg/dose`, () => {
      const r = dose(id, 10);
      range(r.mgRange, [100, 200], 'mg');
      if (conc) range(r.mlRange, [1, 2], 'mL');
      if (perUnit) range(r.unitRange, [0.2, 0.4], 'tab');
    });
    test('3 kg → 30-60 mg；100 kg → 1000-1500 mg（高值每日封頂 3000）', () => {
      range(dose(id, 3).mgRange, [30, 60], '3 kg');
      range(dose(id, 100).mgRange, [1000, 1500], '100 kg');
    });
  });
}

drugSuite('keppra_iv', () => {
  test('出處範例 [AES] IV levetiracetam 60 mg/kg, max 4500 mg：10 kg = 600 mg = 6 mL = 1.2 Vial', () => {
    const r = dose('keppra_iv', 10);
    range(r.mgRange, [600, 600], 'mg');
    range(r.mlRange, [6, 6], 'mL');
    range(r.unitRange, [1.2, 1.2], 'Vial');
  });
  test('[AES] 3 kg → 180 mg；75 kg 剛好 4500；80 kg 封頂 4500 mg = 45 mL = 9 Vial', () => {
    range(dose('keppra_iv', 3).mgRange, [180, 180], '3 kg');
    range(dose('keppra_iv', 75).mgRange, [4500, 4500], '75 kg');
    range(dose('keppra_iv', 80).unitRange, [9, 9], '80 kg');
  });
});

for (const [id, key, per] of [['depakine_syrup', 'mlRange', 200], ['depakine_tab', 'unitRange', 200]]) {
  drugSuite(id, () => {
    test('出處範例 [JSON Lexicomp] 20 kg：15-30 mg/kg/day ÷ 2 = 150-300 mg/dose', () => {
      const r = dose(id, 20);
      range(r.mgRange, [150, 300], 'mg');
      range(r[key], [150 / per, 300 / per], key);
    });
    test('3 kg → 22.5-45 mg；120 kg → 900-1500 mg（高值每日封頂 3000）', () => {
      range(dose(id, 3).mgRange, [22.5, 45], '3 kg');
      range(dose(id, 120).mgRange, [900, 1500], '120 kg');
    });
  });
}

drugSuite('depakine_iv', () => {
  test('出處範例 [AES] IV valproic acid 40 mg/kg, max 3000 mg：10 kg = 400 mg = 4 mL = 1 vial', () => {
    const r = dose('depakine_iv', 10);
    range(r.mgRange, [400, 400], 'mg');
    range(r.mlRange, [4, 4], 'mL');
    range(r.unitRange, [1, 1], 'vial');
  });
  test('[AES] 3 kg → 120 mg；75 kg 剛好 3000；80 kg 封頂 3000 mg = 30 mL = 7.5 vial', () => {
    range(dose('depakine_iv', 3).mgRange, [120, 120], '3 kg');
    range(dose('depakine_iv', 75).mgRange, [3000, 3000], '75 kg');
    range(dose('depakine_iv', 80).unitRange, [7.5, 7.5], '80 kg');
  });
});

drugSuite('phenobarbital_iv', () => {
  test('出處範例 [AES] IV phenobarbital 15 mg/kg：10 kg = 150 mg = 1.5 mL（100 mg/mL）', () => {
    const r = dose('phenobarbital_iv', 10);
    range(r.mgRange, [150, 150], 'mg');
    range(r.mlRange, [1.5, 1.5], 'mL');
  });
  test('3 kg → 45 mg；70 kg → 1000 mg（工具封頂 1000；AES 流程圖未寫上限，列入報告）', () => {
    range(dose('phenobarbital_iv', 3).mgRange, [45, 45], '3 kg');
    range(dose('phenobarbital_iv', 70).mgRange, [1000, 1000], '70 kg');
  });
});

drugSuite('phenytoin_iv', () => {
  test('工具 [JSON AES 2016 + 院內藥典] 10 kg：20 mg/kg = 200 mg = 4 mL（50 mg/mL）', () => {
    const r = dose('phenytoin_iv', 10);
    range(r.mgRange, [200, 200], 'mg');
    range(r.mlRange, [4, 4], 'mL');
  });
  test('3 kg → 60 mg；75 kg 剛好 1500；80 kg 封頂 1500 mg = 30 mL', () => {
    range(dose('phenytoin_iv', 3).mgRange, [60, 60], '3 kg');
    range(dose('phenytoin_iv', 75).mgRange, [1500, 1500], '75 kg');
    range(dose('phenytoin_iv', 80).mlRange, [30, 30], '80 kg');
  });
  // [AES] 流程圖寫的是 fosphenytoin 20 mg PE/kg, max 1500 mg PE；未直接寫 phenytoin，故 phenytoin 本身未找到可驗證範例。
});

// ---------------------------------------------------------------- PALS 藥物
drugSuite('epinephrine_arrest', () => {
  test('出處範例 [PALS] epinephrine 0.01 mg/kg（0.1 mg/mL），max 1 mg：20 kg = 0.2 mg = 2 mL', () => {
    const r = dose('epinephrine_arrest', 20);
    range(r.mgRange, [0.2, 0.2], 'mg');
    range(r.mlRange, [2, 2], 'mL');
  });
  test('[PALS] 3 kg → 0.03 mg = 0.3 mL；100 kg 剛好 1 mg = 10 mL；120 kg 封頂 1 mg', () => {
    range(dose('epinephrine_arrest', 3).mlRange, [0.3, 0.3], '3 kg');
    range(dose('epinephrine_arrest', 100).mlRange, [10, 10], '100 kg');
    range(dose('epinephrine_arrest', 120).mgRange, [1, 1], '120 kg');
  });
});

drugSuite('amiodarone_arrest', () => {
  test('出處範例 [PALS] amiodarone 5 mg/kg bolus（max 300 mg）：20 kg = 100 mg = 2 mL（50 mg/mL）', () => {
    const r = dose('amiodarone_arrest', 20);
    range(r.mgRange, [100, 100], 'mg');
    range(r.mlRange, [2, 2], 'mL');
  });
  test('[PALS] 3 kg → 15 mg；60 kg 剛好 300；70 kg 封頂 300 mg = 6 mL', () => {
    range(dose('amiodarone_arrest', 3).mgRange, [15, 15], '3 kg');
    range(dose('amiodarone_arrest', 60).mgRange, [300, 300], '60 kg');
    range(dose('amiodarone_arrest', 70).mlRange, [6, 6], '70 kg');
  });
  test('[PALS] 後續劑量 max 150 mg 只寫在頻次文字，計算層沒有第二劑封頂（記錄現況，列入報告）', () => {
    assert.match(drug('amiodarone_arrest').frequency, /150 mg/);
  });
});

drugSuite('lidocaine_arrest', () => {
  test('出處範例 [PALS] lidocaine 1 mg/kg：20 kg = 20 mg = 1 mL（20 mg/mL）', () => {
    const r = dose('lidocaine_arrest', 20);
    range(r.mgRange, [20, 20], 'mg');
    range(r.mlRange, [1, 1], 'mL');
  });
  test('3 kg → 3 mg；120 kg → 100 mg（工具封頂 100；PALS 流程圖未寫上限，列入報告）', () => {
    range(dose('lidocaine_arrest', 3).mgRange, [3, 3], '3 kg');
    range(dose('lidocaine_arrest', 120).mgRange, [100, 100], '120 kg');
  });
});

drugSuite('atropine_brady', () => {
  test('出處範例 [PALS] atropine 0.02 mg/kg，min 0.1 mg，max single 0.5 mg：10 kg = 0.2 mg = 0.4 mL', () => {
    const r = dose('atropine_brady', 10);
    range(r.mgRange, [0.2, 0.2], 'mg');
    range(r.mlRange, [0.4, 0.4], 'mL');
  });
  test('[PALS] 最低劑量切換點：3 kg 0.06 → 0.1 mg；5 kg 剛好 0.1 mg', () => {
    range(dose('atropine_brady', 3).mgRange, [0.1, 0.1], '3 kg');
    range(dose('atropine_brady', 3).mlRange, [0.2, 0.2], '3 kg mL');
    range(dose('atropine_brady', 5).mgRange, [0.1, 0.1], '5 kg');
  });
  test('[PALS] 最高劑量切換點：25 kg 剛好 0.5 mg；30 kg 封頂 0.5 mg = 1 mL', () => {
    range(dose('atropine_brady', 25).mgRange, [0.5, 0.5], '25 kg');
    range(dose('atropine_brady', 30).mlRange, [1, 1], '30 kg');
  });
});

drugSuite('adenosine', () => {
  test('出處範例 [PALS] 第一劑 0.1 mg/kg（max 6 mg）：10 kg = 1 mg = 0.333 mL（3 mg/mL）', () => {
    const r = dose('adenosine', 10, undefined, 0);
    range(r.mgRange, [1, 1], 'mg');
    range(r.mlRange, [1 / 3, 1 / 3], 'mL');
  });
  test('[PALS] 第二劑 0.2 mg/kg（max 12 mg）：10 kg = 2 mg', () => {
    range(dose('adenosine', 10, undefined, 1).mgRange, [2, 2], 'mg');
  });
  test('[PALS] 3 kg → 0.3 / 0.6 mg；60 kg 兩劑剛好 6 / 12 mg；80 kg 封頂 6 mg = 2 mL、12 mg = 4 mL', () => {
    range(dose('adenosine', 3, undefined, 0).mgRange, [0.3, 0.3], '3 kg 1st');
    range(dose('adenosine', 3, undefined, 1).mgRange, [0.6, 0.6], '3 kg 2nd');
    range(dose('adenosine', 60, undefined, 0).mgRange, [6, 6], '60 kg 1st');
    range(dose('adenosine', 60, undefined, 1).mgRange, [12, 12], '60 kg 2nd');
    range(dose('adenosine', 80, undefined, 0).mlRange, [2, 2], '80 kg 1st');
    range(dose('adenosine', 80, undefined, 1).mlRange, [4, 4], '80 kg 2nd');
  });
});

// ---------------------------------------------------------------- 覆蓋率
test('peds_drugs.json 每一個藥物都有對應的驗算區塊（新增藥物時會在這裡失敗）', () => {
  const missing = data.drugs.map(d => d.id).filter(id => !covered.has(id));
  assert.deepEqual(missing, []);
});
