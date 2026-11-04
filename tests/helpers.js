'use strict';

// 測試共用工具：只讀取 repo 內的資料與計算層，不修改任何東西。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const calc = require('../dose-calculations.js');
const data = JSON.parse(fs.readFileSync(path.join(root, 'peds_drugs.json'), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function drug(id) {
  const found = data.drugs.find(item => item.id === id);
  if (!found) throw new Error(`peds_drugs.json 找不到 ${id}`);
  return found;
}

// 用頁面實際使用的計算層（index.html 內 calcDose = PedsDoseCalc.calculateDose）
function dose(id, weight, age, indicationIndex) {
  const d = drug(id);
  const c = indicationIndex === undefined ? d.calc : d.indications[indicationIndex].calc;
  return calc.calculateDose(d, c, weight, age);
}

const EPS = 1e-9;
function close(actual, expected, label) {
  assert.ok(Number.isFinite(actual), `${label}: actual 不是數字 (${actual})`);
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: 實際 ${actual}，預期 ${expected}`);
}
function range(actual, [lo, hi], label) {
  assert.ok(Array.isArray(actual), `${label}: 沒有回傳範圍`);
  close(actual[0], lo, `${label} 下限`);
  close(actual[1], hi, `${label} 上限`);
}

// 從 index.html 取出指定的頁面函式原文，在 sandbox 執行；不改動 index.html。
function extractPageFunction(name, context = {}) {
  const start = html.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`index.html 找不到 function ${name}`);
  let depth = 0;
  let end = -1;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  const source = html.slice(start, end);
  const sandbox = vm.createContext({ ...context });
  vm.runInContext(`${source}; this.__fn = ${name};`, sandbox);
  return sandbox.__fn;
}

// Playwright 是選配：本機沒有就 skip；CI 設 REQUIRE_E2E=1 時沒有就直接失敗。
function loadPlaywright() {
  try {
    return require('playwright');
  } catch (error) {
    if (process.env.REQUIRE_E2E === '1') throw error;
    return null;
  }
}

module.exports = { assert, calc, data, html, root, drug, dose, close, range, EPS, extractPageFunction, loadPlaywright };
