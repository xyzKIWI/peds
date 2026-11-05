(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PedsDoseCalc = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function validWeight(weight) {
    return Number.isFinite(weight) && weight > 0 && weight <= 120;
  }

  function validAgeYears(age) {
    return Number.isFinite(age) && age >= 0 && age <= 18;
  }

  function singleDose(weight, mgPerKg, concentrationMgPerMl, maxDoseMg) {
    if (!validWeight(weight)) return null;
    let mg = weight * mgPerKg;
    if (Number.isFinite(maxDoseMg)) mg = Math.min(mg, maxDoseMg);
    return {
      mg,
      ml: Number.isFinite(concentrationMgPerMl) && concentrationMgPerMl > 0
        ? mg / concentrationMgPerMl
        : null
    };
  }

  function packageOrderAmount(doseMg, originalConcentrationMgPerMl, packageVolumeMl) {
    if (!Number.isFinite(doseMg) || doseMg < 0) return null;
    if (!Number.isFinite(originalConcentrationMgPerMl) || originalConcentrationMgPerMl <= 0) return null;
    if (!Number.isFinite(packageVolumeMl) || packageVolumeMl <= 0) return null;
    const originalMl = doseMg / originalConcentrationMgPerMl;
    return {
      originalMl,
      packageFraction: originalMl / packageVolumeMl
    };
  }

  // 速算（例：BW÷2 mL）：由 Kiwi 指定的 calc.quick.ml_per_kg 換算單一 mL 數，
  // 仍套用同一規則的單次上下限（max_dose_mg / min_dose_mg）。
  function quickDose(calc, drug, weight) {
    const q = calc.quick;
    if (!q) return null;
    // 栓劑／顆數型：BW÷N 顆（例：Voren BW÷12.5）
    if (Number.isFinite(q.kg_per_unit) && q.kg_per_unit > 0) {
      const units = weight / q.kg_per_unit;
      const mg = drug.concentration_mg_per_unit ? units * drug.concentration_mg_per_unit : null;
      return { label: q.label, units, unit: drug.unit || '#', mg, mgPerKg: mg == null ? null : mg / weight, capped: false };
    }
    const conc = drug.concentration_mg_per_ml;
    if (!Number.isFinite(q.ml_per_kg) || !(conc > 0)) return null;
    let ml = weight * q.ml_per_kg;
    let mg = ml * conc;
    let capped = false;
    if (calc.max_dose_mg && mg > calc.max_dose_mg) {
      mg = calc.max_dose_mg;
      capped = true;
    }
    if (calc.min_dose_mg && mg < calc.min_dose_mg) mg = calc.min_dose_mg;
    ml = mg / conc;
    return { label: q.label, ml, mg, mgPerKg: mg / weight, capped };
  }

  // 錠劑往下取到 ¼ 顆（Kiwi 初版速算表：開「不超過表上的數值且容易給予的劑量」，例 0.8 → 0.75 粒）
  function floorToQuarter(x) {
    if (!Number.isFinite(x) || x < 0) return null;
    return Math.floor(x * 4 + 1e-9) / 4;
  }

  function calculateDose(drug, calc, weight, age) {
    if (!calc) return null;
    const t = calc.type;

    if (t === 'mg_per_kg_per_dose') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      let lowMg = calc.low * weight;
      let highMg = calc.high * weight;
      if (calc.max_dose_mg) {
        lowMg = Math.min(lowMg, calc.max_dose_mg);
        highMg = Math.min(highMg, calc.max_dose_mg);
      }
      if (calc.min_dose_mg) {
        lowMg = Math.max(lowMg, calc.min_dose_mg);
        highMg = Math.max(highMg, calc.min_dose_mg);
      }
      const result = {
        type: 'dose',
        mgRange: [lowMg, highMg],
        rule: `${calc.low}${calc.high !== calc.low ? '-' + calc.high : ''} mg/kg/dose`
      };
      if (calc.min_dose_mg) result.rule += ` (min ${calc.min_dose_mg} mg)`;
      if (calc.max_dose_mg) result.rule += ` (max ${calc.max_dose_mg} mg/dose)`;
      if (drug.concentration_mg_per_ml) {
        result.mlRange = [lowMg / drug.concentration_mg_per_ml, highMg / drug.concentration_mg_per_ml];
      }
      if (drug.concentration_mg_per_unit) {
        result.unitRange = [lowMg / drug.concentration_mg_per_unit, highMg / drug.concentration_mg_per_unit];
        if (drug.form === 'tab') result.unitRangeRounded = result.unitRange.map(floorToQuarter);
      }
      const quick = quickDose(calc, drug, weight);
      if (quick) result.quick = quick;
      return result;
    }

    if (t === 'mg_per_kg_per_day') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      const dosesDay = calc.doses_per_day || 1;
      let lowMgDay = calc.low * weight;
      let highMgDay = calc.high * weight;
      if (calc.max_mg_per_day) {
        lowMgDay = Math.min(lowMgDay, calc.max_mg_per_day);
        highMgDay = Math.min(highMgDay, calc.max_mg_per_day);
      }
      const lowMg = lowMgDay / dosesDay;
      const highMg = highMgDay / dosesDay;
      const result = {
        type: 'dose',
        mgRange: [lowMg, highMg],
        rule: `${calc.low}${calc.high !== calc.low ? '-' + calc.high : ''} mg/kg/day ÷ ${dosesDay}`
      };
      if (drug.concentration_mg_per_ml) {
        result.mlRange = [lowMg / drug.concentration_mg_per_ml, highMg / drug.concentration_mg_per_ml];
      }
      if (drug.concentration_mg_per_unit) {
        result.unitRange = [lowMg / drug.concentration_mg_per_unit, highMg / drug.concentration_mg_per_unit];
        if (drug.form === 'tab') result.unitRangeRounded = result.unitRange.map(floorToQuarter);
      }
      return result;
    }

    if (t === 'mcg_per_kg_per_dose') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      let lowMcg = calc.low * weight;
      let highMcg = calc.high * weight;
      if (calc.max_dose_mcg) {
        lowMcg = Math.min(lowMcg, calc.max_dose_mcg);
        highMcg = Math.min(highMcg, calc.max_dose_mcg);
      }
      const result = {
        type: 'dose',
        mcgRange: [lowMcg, highMcg],
        rule: `${calc.low}${calc.high !== calc.low ? '-' + calc.high : ''} mcg/kg/dose`
      };
      if (drug.concentration_mcg_per_ml) {
        result.mlRange = [lowMcg / drug.concentration_mcg_per_ml, highMcg / drug.concentration_mcg_per_ml];
      } else if (drug.concentration_mg_per_ml) {
        result.mlRange = [lowMcg / (drug.concentration_mg_per_ml * 1000), highMcg / (drug.concentration_mg_per_ml * 1000)];
      }
      return result;
    }

    if (t === 'ml_per_kg_per_dose') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      let lowMl = calc.low * weight;
      let highMl = calc.high * weight;
      if (calc.max_ml_per_dose) {
        lowMl = Math.min(lowMl, calc.max_ml_per_dose);
        highMl = Math.min(highMl, calc.max_ml_per_dose);
      }
      return { type: 'dose', mlRange: [lowMl, highMl], rule: `${calc.low}${calc.high !== calc.low ? '-' + calc.high : ''} mL/kg/dose` };
    }

    if (t === 'ml_per_kg_per_day') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      const dosesDay = calc.doses_per_day || 1;
      let lowMlDay = calc.low * weight;
      let highMlDay = calc.high * weight;
      let rule = `${calc.low}${calc.high !== calc.low ? '-' + calc.high : ''} mL/kg/day ÷ ${dosesDay}`;
      let capped = false;
      // 依年齡的每日 mg 上限（如 Cypromin 糖漿 < 7 歲 12 mg/day、≥ 7 歲 16 mg/day），需要年齡與濃度
      if (calc.daily_max_mg_by_age) {
        if (age == null) return { needs_age: true };
        if (!validAgeYears(age)) return { invalid_age: true };
        const band = calc.daily_max_mg_by_age.find(b => age >= b.age_low && age < b.age_high);
        const conc = drug.concentration_mg_per_ml;
        if (band && conc > 0) {
          const maxMlDay = band.max_mg_per_day / conc;
          if (highMlDay > maxMlDay) capped = true;
          lowMlDay = Math.min(lowMlDay, maxMlDay);
          highMlDay = Math.min(highMlDay, maxMlDay);
          rule += `（${band.label} 每日上限 ${band.max_mg_per_day} mg）`;
        }
      }
      let lowMl = lowMlDay / dosesDay;
      let highMl = highMlDay / dosesDay;
      if (calc.max_ml_per_dose) {
        if (highMl > calc.max_ml_per_dose) capped = true;
        lowMl = Math.min(lowMl, calc.max_ml_per_dose);
        highMl = Math.min(highMl, calc.max_ml_per_dose);
        rule += `（單次上限 ${calc.max_ml_per_dose} mL）`;
      }
      const result = { type: 'dose', mlRange: [lowMl, highMl], rule };
      if (capped) result.capped = true;
      return result;
    }

    if (t === 'supp_by_weight') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      const result = {
        type: 'dose',
        unitRange: [weight / calc.kg_per_supp_low, weight / calc.kg_per_supp_high],
        rule: `BW÷${calc.kg_per_supp_low} ~ BW÷${calc.kg_per_supp_high} 顆`
      };
      const quick = quickDose(calc, drug, weight);
      if (quick) result.quick = quick;
      return result;
    }

    if (t === 'pack_per_10kg_per_day') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      const dosesDay = calc.doses_per_day || 3;
      const totalPacks = (weight / 10) * (calc.packs_per_10kg_per_day || 1);
      return { type: 'dose', packsPerDose: totalPacks / dosesDay, rule: `${calc.packs_per_10kg_per_day} 包/10kg/day ÷ ${dosesDay}` };
    }

    if (t === 'pack_per_30kg_per_dose') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      return { type: 'dose', packsPerDose: weight / 30, rule: 'BW÷30 包/dose TID' };
    }

    if (t === 'weight_band') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      // 嬰兒另有 mg/kg 規則（如 Tamiflu 2 週至未滿 1 歲 3 mg/kg）時，必須先知道年齡
      if (calc.infant_rule) {
        if (age == null) return { needs_age: true };
        if (!validAgeYears(age)) return { invalid_age: true };
        if (age < calc.infant_rule.age_below_years) {
          const mg = calc.infant_rule.mg_per_kg_per_dose * weight;
          return { type: 'dose', mgRange: [mg, mg], rule: calc.infant_rule.label };
        }
      }
      // upper_inclusive：仿單寫「15 kg or less / 15.1 kg to 23 kg」時，分組為 low < 體重 ≤ high
      const band = calc.upper_inclusive
        ? calc.bands.find(b => weight > b.weight_low && weight <= b.weight_high)
        : calc.bands.find(b => weight >= b.weight_low && weight < b.weight_high);
      return { type: 'band', bandText: band ? band.dose : '無相符區間', rule: '依體重分組' };
    }

    if (t === 'age_band') {
      if (age == null) return { needs_age: true };
      if (!validAgeYears(age)) return { invalid_age: true };
      const band = calc.bands.find(b => age >= b.age_low && age < b.age_high);
      if (!band) return { type: 'band', bandText: '無相符區間', rule: '依年齡分組' };
      if (band.mg_per_kg_per_dose !== undefined) {
        if (weight == null) return { needs_weight: true };
        if (!validWeight(weight)) return { invalid_weight: true };
        const high = band.mg_per_kg_per_dose_high ?? band.mg_per_kg_per_dose;
        let lowMg = band.mg_per_kg_per_dose * weight;
        let highMg = high * weight;
        if (band.max_mg_per_dose) {
          lowMg = Math.min(lowMg, band.max_mg_per_dose);
          highMg = Math.min(highMg, band.max_mg_per_dose);
        }
        const result = { type: 'dose', mgRange: [lowMg, highMg], rule: band.label || `${band.mg_per_kg_per_dose}${high !== band.mg_per_kg_per_dose ? '-' + high : ''} mg/kg/dose` };
        if (drug.concentration_mg_per_ml) result.mlRange = [lowMg / drug.concentration_mg_per_ml, highMg / drug.concentration_mg_per_ml];
        return result;
      }
      if (band.mg_per_dose !== undefined) {
        const mg = band.mg_per_dose;
        const result = { type: 'dose', mgRange: [mg, mg], rule: band.label || `${mg} mg/dose` };
        if (drug.concentration_mg_per_ml) result.mlRange = [mg / drug.concentration_mg_per_ml, mg / drug.concentration_mg_per_ml];
        return result;
      }
      return { type: 'band', bandText: band.dose || '無資料', rule: band.label || '依年齡分組' };
    }

    if (t === 'fluid_421_rule') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      let rate = 0;
      if (weight <= 10) rate = weight * 4;
      else if (weight <= 20) rate = 40 + (weight - 10) * 2;
      else rate = 60 + (weight - 20);
      return { type: 'rate', rate, rule: '4-2-1 rule' };
    }

    if (t === 'ml_by_weight_after_dilution') {
      if (weight == null) return { needs_weight: true };
      if (!validWeight(weight)) return { invalid_weight: true };
      return { type: 'special', values: [weight / 4, weight / 3, weight], note: calc.note || '' };
    }

    return { type: 'special', text: JSON.stringify(calc) };
  }

  return { calculateDose, packageOrderAmount, singleDose, validWeight, validAgeYears, floorToQuarter };
});
