# 兒科藥物劑量速算

急診兒科使用的靜態網頁，輸入體重與年齡後換算 mg、mL 或劑型數量。本工具不會自動還原上一位病人的體重與年齡；供應狀態、禁忌與快捷劑量為不同層次資訊。

**Live**：[https://xyzKIWI.github.io/peds/](https://xyzKIWI.github.io/peds/)

## 本機開啟

```powershell
python -m http.server 8000
```

瀏覽 `http://localhost:8000/`。

## 資料維護

`peds_drugs.json` 是藥品資料的唯一來源。`index.html` 仍內嵌一份自動產生的 JSON，以保留離線開啟能力；不可手動維護內嵌副本。

修改 `peds_drugs.json` 後執行：

```powershell
node scripts/sync-data.mjs
node scripts/validate-data.mjs
node scripts/sync-data.mjs --check
node scripts/check-html-js.mjs
node tests/calculations.test.js
```

`rewrite_clinical_summary.py` 只補上尚未建立的 `kmuh_detail`，不會覆寫已審核內容。Windows 下以 UTF-8 讀寫。

## 2026-09-21 高風險變更

- Ketamine 改為先選用途與途徑；處置鎮靜分列初始與追加、原液與已確認稀釋液。依院內 HIS 截圖更新為 `2KET10`、Ketalar 500 mg/10 mL、開藥單位 Vial，並將原液抽藥 c.c. 除以 10 mL 換算成 `0.xx Vial`。
- 明確禁用條件觸發時，隱藏快捷給藥數字。
- Midatin 新品更新為 `2MID50`、50 mg/50 mL/Bag（1 mg/mL）；舊 `2MIDAT` 15 mg/3 mL/Amp（5 mg/mL）仍保留為缺藥資料，避免誤套舊濃度速算。Thiopental 依院內現況標示無藥，不列入預設可用清單。
- Clodrin `3CLO30` 的岡山藥品頁標示「灌腸用／外用局部用」，但官方仿單明寫口服且避免肛門給藥。快捷結果已暫停，等院內藥師確認實際流程。

## 安全說明

這是供授權臨床人員複核的計算與參考工具，不是病人個別化處方、醫囑或最終給藥決定。使用前仍需核對院內現行 protocol、藥品濃度、當日累計劑量、禁忌與監測條件。
