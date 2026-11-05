# 驗算測試報告

產出日期：2026-11-04（Asia/Taipei）
範圍：`dose-calculations.js`、`peds_drugs.json`（68 個藥物）、`index.html` 的 PALS／SE 流程與頁尾
執行方式：`node --test`（GitHub Actions：`.github/workflows/test.yml`，push 與 PR 時自動跑）

> 第一版報告只記錄測試結果、沒有改任何臨床數值。
> 2026-11-04 Kiwi 確認後，第 4 節的 5 項已依出處修正（Tamiflu、Xofluza、Diazepam IV、Taita 顯示），對應測試由 `todo` 改為一般測試。
> 第 5 節的「可疑」項目仍未修改，需要 Kiwi 判斷。

## 總覽

| 檔案 | 內容 | 結果 |
| --- | --- | --- |
| `tests/calculations.test.js` | 原有測試（Ketamine、Acetaminophen、Ibuprofen、輸入邊界），未改動 | 通過 |
| `tests/drugs.test.js` | 68 個藥物逐一驗算：出處範例、3 kg、一般體重、封頂、mL／顆數換算、年齡／體重切換點、速算；另有覆蓋率檢查 | 201 通過 |
| `tests/inputs.test.js` | 全藥物缺值、0、負數、NaN、極端值掃描；上限不被突破；速算落在範圍內；畫面數字取整 `num()` | 83 通過 |
| `tests/page.test.js` | 頁尾免責聲明／來源／校對日、回入口連結（含 github.io）、375 px 與 1280 px 無水平捲動、禁忌切換點、供應狀態、Taita／Tamiflu／Xofluza 修正後畫面、速算顯示 | 20 通過 |
| `tests/flows.test.js` | PALS 三個流程與 SE 四個階段：順序與 20 kg、3 kg、120 kg 劑量和頁面一致 | 16 通過 |
| **合計** | | **321 項：321 通過、0 todo、0 失敗** |

頁面測試需要 Playwright。CI 會臨時安裝（`--no-save`，repo 不新增依賴）；本機沒裝時頁面測試會自動 skip，計算測試照跑。

## 1. 本次之前沒被測到的項目

原本的 `tests/calculations.test.js` 只涵蓋：

- Ketamine `singleDose`／`packageOrderAmount`（20 kg 的 IV、IM、稀釋液換算）
- Acetaminophen 糖漿 20 kg、120 kg 封頂
- Ibuprofen 糖漿 20 kg
- `validWeight`／`validAgeYears` 的邊界

其餘 **65 個藥物**、全部 PALS／SE 流程、頁面顯示（禁忌隱藏、供應狀態、頁尾）都沒有測試。現在每個藥物都有對應的測試區塊；`drugs.test.js` 最後一項會檢查 `peds_drugs.json` 的每個 id 都有測試，以後新增藥物沒補測試時 CI 會失敗。

## 2. 出處

| 代號 | 出處 | 讀取方式 |
| --- | --- | --- |
| PALS | AHA/AAP 2025 PALS 流程圖：Pediatric Cardiac Arrest（`Algorithm-PALS-CA-250123`）、Bradycardia With a Pulse（`Algorithm-PALS-Bradycardia-250121`）、Tachyarrhythmia With a Pulse（無障礙版 `Algorithm-PALS-Tachyarrhythmia-LngDscrp-250729`），cpr.heart.org | 2026-11-04 讀取原文 |
| AES | AES 2016 Proposed Algorithm for Convulsive Status Epilepticus（aesnet.org `cse-treatment-chart-final_rerelease.pdf`），即 SE 頁引用的 Glauser 2016 | 2026-11-04 讀取原文 |
| FDA-Tamiflu | TAMIFLU 美國仿單 Table 1（accessdata.fda.gov `021087s071,021246s054lbl.pdf`） | 2026-11-04 讀取原文 |
| FDA-Xofluza | XOFLUZA 美國仿單 Table 1-3（accessdata.fda.gov `210854s023,214410s008lbl.pdf`） | 2026-11-04 讀取原文 |
| JSON | `peds_drugs.json` 該藥的 `source` 欄 | 只驗「資料檔數值 → 畫面數字」的算術，**沒有拿到原文逐字核對** |

## 3. 通過的項目

### 3.1 和外部出處一致（PALS／AES／FDA）

| 藥物 | 出處 | 驗證內容 |
| --- | --- | --- |
| Epinephrine（arrest） | PALS | 0.01 mg/kg、0.1 mg/mL、max 1 mg：3 kg 0.3 mL、20 kg 2 mL、100 kg 以上封頂 1 mg = 10 mL |
| Amiodarone | PALS | 5 mg/kg、max 300 mg：60 kg 起封頂 300 mg = 6 mL |
| Lidocaine | PALS | 1 mg/kg：20 kg 20 mg = 1 mL |
| Atropine | PALS | 0.02 mg/kg、min 0.1 mg、max 0.5 mg：5 kg 以下 0.1 mg、25 kg 以上 0.5 mg |
| Adenosine | PALS | 第一劑 0.1 mg/kg max 6 mg、第二劑 0.2 mg/kg max 12 mg：60 kg 起封頂 |
| 電擊能量 | PALS | 去顫 2 → 4 → ≥ 4 J/kg；同步電擊 0.5-1 → 2 J/kg；順序一致 |
| PALS 藥物順序 | PALS | Arrest：epinephrine → amiodarone／lidocaine；Brady：epinephrine → atropine；Tachy：adenosine |
| Lorazepam | AES | 0.1 mg/kg、max 4 mg：40 kg 起封頂 4 mg = 2 mL |
| Diazepam IV（已修正） | AES | 0.15-0.2 mg/kg、max 10 mg：10 kg 1.5-2 mg = 0.3-0.4 mL，50 kg 起高值封頂 |
| Diazepam PR | AES | AES 0.2-0.5 mg/kg、max 20 mg；工具取上限 0.5 mg/kg，40 kg 起封頂 20 mg |
| Levetiracetam IV | AES | 60 mg/kg、max 4500 mg：75 kg 起封頂，80 kg = 45 mL = 9 Vial |
| Valproate IV | AES | 40 mg/kg、max 3000 mg：75 kg 起封頂，80 kg = 30 mL = 7.5 vial |
| Phenobarbital IV | AES | 15 mg/kg：10 kg 150 mg = 1.5 mL |
| SE 階段順序 | AES | 0–5 → 5–20 → 20–40 → 40–60 min；第二線 phenytoin → valproate → levetiracetam → 備案 phenobarbital |
| Tamiflu（已修正） | FDA-Tamiflu | 剛好 15／23／40 kg → 30／45／60 mg；15.1／23.1／40.1 kg → 45／60／75 mg；未滿 1 歲 3 mg/kg BID |
| Xofluza 體重分組 | FDA-Xofluza | < 20 kg 2 mg/kg、20 至 < 80 kg 40 mg、≥ 80 kg 80 mg，邊界一致 |
| Xofluza 年齡（已修正） | FDA-Xofluza | ≥ 5 歲；< 5 歲顯示「不建議」 |

### 3.2 算術驗證通過（出處為 JSON 來源欄）

其餘藥物都已驗過：3 kg、一般體重、上限封頂、mg → mL（依 `concentration_mg_per_ml`）、mg → 顆／Vial／Amp（依 `concentration_mg_per_unit`）、mcg → mL（Fentanyl）、mL/kg 型、包數型、4-2-1 rule 的切換點（10 kg、20 kg），以及年齡／體重分組的切換點（Cetirizine 3／6 歲、ACC 6／14 歲、Relenza 7 歲、Kascoal 2／12 歲、MgO 2／6／12 歲、Terbutaline／Ipratropium 20 kg、Meptin 15／30 kg）。

### 3.3 輸入與頁面行為

- 所有計算規則：缺體重 → 「輸入體重後計算」；缺年齡 → 「輸入年齡後計算」；0、負數、NaN、Infinity、> 120 kg、> 18 歲 → 不計算。
- 0.1-120 kg × 0-18 歲掃描：沒有 NaN、負數，範圍下限都 ≤ 上限；有單次上限的規則在任何體重都沒有超過上限；mg/kg/day 規則的每日總量沒有超過每日上限。
- 禁忌切換點：Ibuprofen 5 個月禁用並隱藏數字、6 個月顯示；Ketamine 2 個月禁用、3 個月顯示；Novamin 1.9 歲禁用、2 歲顯示。
- Ketamine 處置鎮靜預設途徑為 IM（頁面下拉選單實測）。
- 供應狀態非 available 的品項（Thiopental、Chloral hydrate、舊 Midatin）不顯示快捷數字。
- 頁尾：採用 main 已合併的 PR #2 版本（本 PR 原本的頁尾已移除，避免重複）。測試確認免責聲明包含 `_meta.disclaimer` 原文、列出資料來源、校對日與 `_meta.last_updated` 一致、只有一份頁尾；回入口連結在 er.kiwi-ai.uk 為 `../`、在 github.io 為 `/ed-tools/`；14 個分頁在 375 px 與 1280 px 都沒有水平捲動。

## 4. 和出處不一致的地方（2026-11-04 已修正）

第一版報告列出的 7 個 `todo` 已依出處修正，測試改為一般測試並全部通過。

| # | 藥物 | 輸入 | 修正前 | 修正後（= 出處） | 出處 | 改了什麼 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Tamiflu | 15 kg | 45 mg BID | 30 mg BID | FDA-Tamiflu「15 kg or less」 | `calc.upper_inclusive: true`：分組改為 low < 體重 ≤ high |
| 2 | Tamiflu | 23 kg | 60 mg BID | 45 mg BID | FDA-Tamiflu「15.1 kg to 23 kg」 | 同上 |
| 3 | Tamiflu | 40 kg | 75 mg BID | 60 mg BID | FDA-Tamiflu「23.1 kg to 40 kg」 | 同上 |
| 4 | Tamiflu | 6 kg、6 個月 | 30 mg BID | 3 mg/kg BID = 18 mg | FDA-Tamiflu「2 Weeks to less than 1 Year」 | `calc.infant_rule`：< 1 歲改用 3 mg/kg |
| 5 | Xofluza | 年齡下限 | 「≥1 歲」、< 12 個月不建議 | 「≥5 歲」、< 5 歲不建議 | FDA-Xofluza | 分組文字、notes、藥品資料警語、禁忌一起改 |
| 6 | Diazepam IV | 10 kg | 0.2-0.3 mg/kg = 2-3 mg | 0.15-0.2 mg/kg = 1.5-2 mg | AES（SE 頁原本的流程文字就寫 0.15–0.2） | `calc.low/high`；max 10 mg 不變 |
| 7 | Taita 1／2／5 號 | 15 kg | 畫面顯示 `undefined` | 50 mL/hr | 程式問題 | 畫面改用 `num(rate) + " mL/hr"`，格式與舊版內嵌 `calcDose` 相同 |

修正後的行為變化，請留意：

- **Tamiflu 現在需要先輸入年齡**才會顯示劑量（沒輸入年齡時顯示「輸入年齡後計算」），因為未滿 1 歲的劑量不同。
- Tamiflu 未滿 1 歲只算出 mg，沒有上限，也沒有換算懸液 mL（資料沒有懸液濃度，見 5.4）。
- 15 與 15.1 kg 之間（例如 15.05 kg）FDA 表沒有寫；工具歸到 > 15 kg 那組（45 mg）。23、40 kg 附近同理。
- `peds_drugs.json` 的 `source` 欄已補上：Tamiflu「FDA Tamiflu 仿單 Table 1」、Xofluza「FDA Xofluza 仿單（2025）」、Diazepam IV「AES 2016」。
- `ml_by_weight_after_dilution` 同樣只回傳數字，畫面也一併改成沿用舊版文字格式（目前沒有藥物用到）。

## 4.1 速算（2026-11-05，Kiwi 指定）

藥卡改成「速算為主、範圍為輔」：有 `calc.quick` 的藥，先用大字顯示單一 mL 數，下面的範圍縮小、改灰色，標為「參考範圍」。

| 藥 | 速算 | 16 kg | 換算 | 上限 |
| --- | --- | --- | --- | --- |
| Anti-phen 糖漿（24 mg/mL） | BW÷2 mL | 8 mL | 192 mg = 12 mg/kg | 1000 mg；≥ 83.3 kg 封頂 41.7 mL，畫面標「已達單次上限」 |
| Ibuprofen（Idefen）糖漿（20 mg/mL） | BW÷2 mL | 8 mL | 160 mg = 10 mg/kg | 400 mg；> 40 kg 封頂 20 mL，畫面標「已達單次上限」 |
| Voren 栓劑（12.5 mg） | BW÷12.5 顆 | 1.28 顆 | 16 mg = 1 mg/kg | 無單次上限（見 5.2） |
| Aswell 糖漿（1 mg/mL） | BW÷10 mL | 1.6 mL | 1.6 mg = 0.1 mg/kg | 10 mg；> 100 kg 封頂並標示 |

- 依據：Kiwi 的初版速算表兩藥都寫「BW/4~BW/2 ml」，Kiwi 指定取 BW/2。Anti-phen 藥卡備註原本就寫「BW÷2 mL = 12 mg/kg/dose」。
- 速算沿用該藥既有的單次上限；測試確認 0.5-120 kg 的速算都落在參考範圍內、不超過上限。
- Voren、Aswell 速算由 Kiwi 2026-11-05 指定（Voren：臨床常用 BW÷12.5；Aswell：BW÷10，即 0.1 mg/kg，在 EMA 2013 兒童 0.1-0.15 mg/kg 內）。其他藥沒有速算，照舊顯示範圍。
- **錠劑往下取到 ¼ 顆**（Kiwi 指定，依初版速算表規則）：`form` 為 tab 且有算出顆數的 9 個錠劑，大字顯示取整結果（例：27 kg Acetaminophen 錠 ½-¾ 錠），小字保留算出的原始顆數；算出不足 ¼ 顆時顯示「不足 ¼」。膠囊、栓劑、針劑不取整。
- **Succinylcholine IM 上限 150 mg**（Kiwi 指定，依 FDA Anectine 仿單「not more than 150 mg total dose」）。
- 初版速算表與網頁不一致的單次上限（Anti-phen 10 mL、Ibuprofen 10 mL）**沒有套用**，速算仍用網頁現有的 1000 mg／400 mg。

## 5. 缺少封頂或邊界可疑的地方（測試記錄現況，未標 todo）

### 5.1 程式／顯示問題

1. ~~Taita 4-2-1 rule 顯示 `undefined`~~：已修正，見第 4 節。
2. **`index.html` 內嵌一份舊的 `calcDose`**（約 190 行），已被 `dose-calculations.js` 取代、不會執行，但留著容易讓人改錯地方。
3. **體重輸入框 `max="100"`**，但 JS 和計算層接受到 120 kg，兩邊不一致。
4. **畫面數字兩位小數**：< 0.005 會顯示成「0」（只有 < 0.5 kg 才會遇到）；Ketamine 6 kg 開藥量 0.048 Vial 顯示成「0.05 Vial」。
5. ~~顆數不取整~~：錠劑已改為往下取到 ¼ 顆（見 4.1）。栓劑、包數仍照小數顯示（例：Voren 16 kg 1.28 顆）。

### 5.2 沒有單次上限（120 kg 時的結果）

| 藥物 | 規則 | 120 kg 結果 |
| --- | --- | --- |
| Voren 栓劑 | BW÷25 ~ BW÷12.5 顆 | 4.8-9.6 顆 |
| Peace／Soltan（0.6 mL/kg/day）、Secorine／Glyo（1 mL/kg/day） | ÷ 3 | 24 mL、40 mL/dose |
| Cypromin 糖漿 | 0.6 mL/kg/day ÷ 3 | 24 mL/dose；換算 **28.8 mg/day**，但同成分的 Cypromin 錠有 16 mg/day 上限（100 kg 時糖漿已經是 24 mg/day；糖漿在 > 66.7 kg 就超過 16 mg/day） |
| Actein 顆粒 | 1 包/10 kg/day ÷ 3 | 4 包/dose |
| Smecta | BW÷30 包 | 4 包/dose |
| Glycerin | 0.5 mL/kg | 60 mL |
| Taita（4-2-1 rule） | | 160 mL/hr |
| Succinylcholine IV | IV 1-2 mg/kg | IV 120-240 mg（IM 已加上 150 mg 上限，見 4.1） |
| Ketamine 處置鎮靜 | IM 4 mg/kg | 480 mg = 9.6 mL（`singleDose` 有上限參數，但 protocol 沒有設定） |
| PALS 電擊能量 | J/kg × 體重 | 去顫 240／480 J、同步 60-120／240 J；「max 10 J/kg or adult dose」只在備註文字 |

### 5.3 只顯示文字、沒有參與計算的上限

- `max_mg_per_day`（單次型規則）、`max_doses_per_day`、`max_mg_per_kg_per_day`、`max_ml_per_day`：只顯示在「單次上限／每日上限」那行，頁面已註明「本工具未記錄當日累計給藥量」。
- Amiodarone 後續劑量 max 150 mg：只寫在頻次文字裡。
- Lidocaine 封頂 100 mg、Phenobarbital 封頂 1000 mg：PALS／AES 流程圖都沒有寫這兩個上限，來源待確認。

### 5.4 分組縫隙與只有文字的分組

- **MgO 年齡分組有縫隙**：5-6 歲、11-12 歲顯示「無相符區間」（分組是 0-2、2-5、6-11、12 以上）。
- **LGG 沒有 < 3 歲的分組**：顯示「無相符區間」。
- 只顯示公式文字、沒有算出數字：Xofluza < 20 kg（「2 mg/kg」）、MgO < 2 歲（「BW÷20 #」）、Tamiflu 沒有換算懸液 mL。
- ~~Tamiflu 懸液濃度~~：資料 `package` 原本寫「60 mg/mL susp」，已依 FDA 仿單（Table 1：30 mg = 5 mL）改為 6 mg/mL（2026-11-04，Kiwi 確認）。這個欄位只用於顯示，不參與計算。
- Diazepam PR 固定用 4 mg/mL（10 mg/2.5 mL 管）換算；資料備註另有 5 mg/2.5 mL 管（2 mg/mL），用那種管時 mL 會差 2 倍。
- Cetirizine ≥ 3 歲固定劑量時，計算層不檢查體重（輸入框會先擋掉，不影響畫面）。

### 5.5 SE 流程

- 第一線 midazolam 用的是**舊品 2MIDAT（缺藥）**，只顯示缺藥文字、沒有劑量；新品 2MID50（1 mg/mL Bag）不在 SE 流程裡。AES 第一線是 IM midazolam（13-40 kg 5 mg、> 40 kg 10 mg）。
- 第二線 phenytoin：AES 寫的是 fosphenytoin 20 mg PE/kg（max 1500 mg PE），沒有直接寫 phenytoin。工具用 phenytoin 20 mg/kg、max 1500 mg。
- 第一線備案的排列：AES 是 phenobarbital → rectal diazepam → intranasal／buccal midazolam（「擇一」）；頁面是 diazepam PR → phenobarbital。AES 寫的是「擇一」，所以只記錄，不算不一致。

## 6. 找不到可驗證範例的項目

以下藥物的出處只有 `peds_drugs.json` 來源欄（高醫速算表、藥丹、院內藥典、高醫藥品庫，或需訂閱的 Lexicomp），我拿不到原文，所以只驗了資料檔數值換算成畫面數字的算術，**沒有拿出處逐字核對**：

- 退燒止痛：Acetaminophen 糖漿／錠、Ibuprofen、Voren
- 感冒／呼吸道：Peace、Cypromin 糖漿／錠、Cetirizine、Secorine、Glyo、Actein、ACC、Soltan、Epinephrine 吸入（croup）、Terbutaline、Ipratropium、Exdila、Meptin、Prednisolone、Methylprednisolone
- 抗生素：Azithromycin 懸液／錠、Amoxicillin 懸液／膠囊、Curam 懸液／錠
- 流感：Peramivir（Rapiacta）、Zanamivir（Relenza）
- 腸胃：Aswell、Promeran、Primperan、Novamin、Kascoal、LGG、MgO、Glycerin、Smecta
- 點滴：Taita 1／2／5 號
- 鎮靜止痛／RSI：Morphine、Fentanyl、Succinylcholine、Ketamine（RCH／RCEM 原文未取得）、Diphenhydramine 錠／針
- 抽搐：Levetiracetam 糖漿／錠、Valproate 糖漿／錠、Phenytoin（AES 只寫 fosphenytoin）
- 沒有快捷計算、只測供應狀態／方案設定：Midazolam 2MID50、舊 Midatin 2MIDAT、Thiopental、Chloral hydrate
