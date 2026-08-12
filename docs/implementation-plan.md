# NameSolver 實作計畫

> 產品定位：**台灣姓名取名條件求解器**  
> 核心承諾：**條件不是參考，是條件。**  
> 文件版本：v1.0（2026-08-13）

## 1. 執行摘要

NameSolver 不以 LLM 隨機產生姓名，而是用可追溯資料、確定性條件求解與可解釋排序，找出真的符合使用者限制的候選名。第一版同時提供：

1. **幫我找名字**：依每個字的位置、筆畫、五行、指定／排除字、家族避諱、總筆畫、實用偏好等條件求解。
2. **幫我檢查名字**：輸入既有姓名，逐項驗證資料、條件、音韻、字義、常見度與書寫便利性。

MVP 的技術核心是：

```text
版本化資料來源
  → Character DB
  → SQL 初篩
  → 確定性 Constraint Engine
  → Feature / Ranking Engine
  → 多樣性重排
  → 規則式解釋
  → 可選 LLM 潤飾
```

預估由一位全職開發者完成可公開 beta 需要 **8～10 週**；資料人工校對是主要工期與風險，不是頁面或 LLM 串接。

---

## 2. MVP 範圍

### 2.1 必做

- 台灣正體中文姓名候選字庫，所有關鍵欄位保留來源與版本。
- 姓氏與單名／雙名（全名 2 或 3 字）。
- 第二字、第三字分開設定：
  - 康熙筆畫：單值、多選、區間。
  - 五行：指定判定流派後選擇金木水火土。
  - 指定字、允許字、排除字。
  - 字輩與固定位置。
- 全名總筆畫條件。
- 家族避諱：嚴格禁止與盡量避免分離。
- 性別風格傾向；不得宣稱字有客觀性別。
- 避免生僻字、難輸入／難顯示字、熱門姓名與負面國語諧音。
- 確定性排序、逐項分數依據、資料來源與信心等級。
- 無解原因、各階段剩餘數量、可實際增加候選數的放寬建議。
- 候選收藏與比較；MVP 先存在瀏覽器，不要求登入。
- 姓名分析模式。
- 手機與桌面響應式介面、基本分享連結與 SEO 頁面。

### 2.2 明確不做

- 生辰八字、喜用神、生肖姓名學。
- Couples Mode、多使用者投票、帳號系統。
- 台語諧音與英文拼音負面詞庫。
- 以 LLM 決定筆畫、五行或條件是否符合。
- 宣稱「一定可登記」、「吉凶為科學事實」或提供人生預測。
- 用不存在的完整人口資料推算精準撞名百分比。

### 2.3 上線後優先順序

- P1：台語諧音、世代流行圖、可分享候選清單。
- P2：帳號、Couples Mode、家庭投票、公開 API。
- P3：三才五格、81 數理、八字、生肖；全部以可插拔模組與「文化參考」呈現。

---

## 3. 產品與資料原則

### 3.1 Hard constraint 與 soft preference 必須分開

- **Hard constraint** 不符合即不得出現在結果中，例如指定字、筆畫、五行流派、家族禁字、總筆畫。
- **Soft preference** 只影響排序，例如偏少見、書寫方便、風格偏好、盡量避開某字。
- 結果卡不得用高總分掩蓋 hard constraint 失敗。
- API 回傳每項規則的 `passed / failed / not_evaluated` 與證據。

### 3.2 所有衍生結論都可追溯

每筆筆畫、讀音、五行、字義、常見度與人工標註都要記錄：

- `source_id`、來源 URL／出版品。
- `source_version`、擷取日期。
- `method`：原始資料、人工校對、演算法衍生或模型生成。
- `confidence`：high / medium / low。
- `review_status`：unreviewed / reviewed / disputed。

### 3.3 不把流派差異包裝成唯一真理

- 現代筆畫與康熙筆畫分欄。
- 五行以 `(character, school, element)` 多筆資料表示。
- 傳統姓名學分數獨立顯示，預設不混入「現代實用推薦分」。
- 同一字不同來源有衝突時，保留兩者並在 UI 顯示差異。

### 3.4 撞名風險使用等級，不使用虛假精度

官方出版品可支援熱門排行與年代趨勢，但不代表取得完整人口姓名頻率。MVP 只顯示：

- 高：命中官方公布的高頻名／用字。
- 中：命中多個公開熱門排行或近代上升用字。
- 低：未命中已收錄排行，但不宣稱一定少見。
- 未知：資料不足。

每個等級都附「依據資料年份、涵蓋範圍與限制」。

---

## 4. 建議技術架構

### 4.1 技術選型

| 層次 | 選型 | 原因 |
| --- | --- | --- |
| Web | Next.js App Router + TypeScript | 一個專案完成 SSR、SEO、UI 與 API，適合 side project |
| UI | Tailwind CSS + 可存取元件庫 | 快速完成響應式表單與結果卡 |
| 表單／驗證 | React Hook Form + Zod | 前後端共用 constraint schema |
| DB | PostgreSQL | 適合結構化篩選、版本化資料與後續統計 |
| ORM／migration | Drizzle ORM | SQL 透明、型別安全、方便保留複雜查詢 |
| 求解器 | 純 TypeScript domain package | 可單元測試、可離線執行、不綁框架 |
| 資料匯入 | TypeScript CLI | 維持單一語言；批次下載、解析、正規化與檢核 |
| 測試 | Vitest + fast-check + Playwright | 單元、性質測試與端對端驗證 |
| 本機環境 | Docker Compose（PostgreSQL） | 開發環境可重現 |
| 監控 | 結構化 log + error tracking | 追蹤慢查詢、匯入錯誤與求解失敗 |

初始化時鎖定當下穩定版與 Node LTS；本文件不硬寫容易過期的套件版本。

### 4.2 單體優先，不拆微服務

```text
Browser
  │
  ▼
Next.js Web/API
  ├─ constraint validation
  ├─ solver domain
  ├─ ranking domain
  ├─ explanation adapter
  └─ PostgreSQL

Offline CLI
  ├─ download raw release
  ├─ parse / normalize
  ├─ validate / diff
  └─ publish dataset release
```

LLM、資料匯入與傳統姓名學模組使用 adapter interface；核心求解器不得依賴它們。

### 4.3 建議目錄

```text
NameSolver/
├─ apps/
│  └─ web/
├─ packages/
│  ├─ db/
│  ├─ domain/
│  ├─ solver/
│  ├─ ranking/
│  ├─ data-pipeline/
│  └─ ui/
├─ data/
│  ├─ fixtures/
│  └─ reviewed/
├─ docs/
│  ├─ implementation-plan.md
│  ├─ data-sources.md
│  └─ scoring.md
├─ tests/
│  └─ e2e/
└─ docker-compose.yml
```

---

## 5. 資料取得與治理

### 5.1 資料來源矩陣

| 資料 | MVP 來源 | 可直接得到 | 缺口／處理方式 |
| --- | --- | --- | --- |
| Unicode、注音、拼音、部首、現代筆畫、字形結構 | CNS11643 全字庫開放資料 | 官方檔案與版本 | 匯入時保留原始 release checksum 與來源標示 |
| 康熙筆畫 | 另找可合法再利用且可批次取得的資料，或建立人工校對集 | 不由 CNS11643 保證 | Phase 0 必須完成授權與準確度 spike，否則不得公開宣稱 |
| 戶政姓名用字適用性 | 法規、官方字源標記與人工查核 | 只能建立證據，不宜直接等同核准 | 欄位命名為 `registration_evidence`，避免 `is_legal=true` |
| 字義／命名字義 | 授權允許的辭典資料 + 人工摘要 | 字典義與命名語境不同 | 不抓取未確認授權內容；摘要需記來源與審核狀態 |
| 五行 | 明確選定的流派資料 + 人工校對 | 流派間可能衝突 | 多筆存放，不設唯一 `element` |
| 熱門姓名／年代 | 內政部 112 年《全國姓名統計分析》等官方出版品 | 公布排行與統計表 | PDF 表格擷取後人工覆核；不外推完整人口機率 |
| 負面諧音 | 人工規則與測試語料 | 國語第一版 | 規則有 severity、適用語言與理由；允許回報誤判 |
| 風格、性別傾向、生僻程度 | 頻率特徵 + 人工標註 | 主觀資料 | 顯示為「傾向」，提供 confidence，不當作事實 |

### 5.2 資料匯入流程

```text
download
  → checksum + immutable raw snapshot
  → parse with explicit encoding
  → normalize Unicode NFC
  → validate code points and referential integrity
  → map sources and evidence
  → compare with previous release
  → manual review queue
  → publish versioned dataset
```

每次 release 必須產生：

- 總筆數、成功／失敗／缺欄位數。
- 與上版新增、刪除、變更數。
- 隨機抽樣與固定 gold set 檢核結果。
- 原始檔 checksum、授權文字與 attribution。
- 可重跑的 CLI 指令與 machine-readable report。

### 5.3 MVP 字庫規模

- 開發 fixture：50 個完整人工驗證字，用於 vertical slice。
- private beta：至少 500 個常見命名字，關鍵欄位有來源且完成審核。
- public beta：目標 1,000 個命名字；不是把 CNS 全字庫全部標成「適合命名」。
- 對未完整標註的字，分析模式可顯示基礎資料，但不得進入產生器候選集合。

---

## 6. 資料模型

以下是邏輯模型；實作時以 migration 固化。

### 6.1 來源與版本

```text
data_sources
- id, name, publisher, url, license, attribution_text

data_releases
- id, source_id, version, published_at, imported_at
- raw_checksum, status, import_report_json
```

### 6.2 字元核心

```text
characters
- id, char, codepoint, traditional_form
- radical, structure, modern_strokes
- candidate_status, rarity_band, input_difficulty
- created_at, updated_at

character_readings
- id, character_id, language, system, value, tone
- source_release_id, confidence, review_status

character_strokes
- id, character_id, system, strokes
- source_release_id, confidence, review_status

character_elements
- id, character_id, school, element
- source_release_id, confidence, review_status

character_meanings
- id, character_id, kind, text, sentiment
- source_release_id, method, confidence, review_status

character_tags
- character_id, tag, weight
- source_release_id, method, review_status

registration_evidence
- id, character_id, evidence_type, result, note
- source_release_id, checked_at
```

### 6.3 姓名統計與風險規則

```text
name_statistics
- id, text, statistic_type, gender_group
- period_start, period_end, rank, count
- population_scope, source_release_id, source_page

homophone_rules
- id, language, normalized_pronunciation, matched_text
- severity, reason, enabled, review_status

scoring_profiles
- id, version, weights_json, thresholds_json, active_from
```

### 6.4 搜尋與可重現性

```text
search_snapshots
- id, public_token, constraints_json
- dataset_release_id, scoring_profile_id
- created_at, expires_at
```

MVP 不保存親屬姓名。前端只送出正規化後的禁用字集合；若使用分享連結，預設不包含原始親屬姓名。

---

## 7. Constraint contract

前後端共用 Zod schema，並版本化為 `constraints.v1`：

```json
{
  "schemaVersion": 1,
  "surname": "王",
  "givenNameLength": 2,
  "genderStyle": "feminine",
  "positions": [
    {
      "strokeSystem": "kangxi",
      "strokes": { "values": [8, 9, 12] },
      "element": { "school": "radical", "values": ["wood"] },
      "requiredChar": null,
      "allowedChars": [],
      "excludedChars": ["怡", "芮"]
    },
    {
      "strokeSystem": "kangxi",
      "strokes": { "min": 14, "max": 17 },
      "element": { "school": "radical", "values": ["water"] },
      "requiredChar": null,
      "allowedChars": [],
      "excludedChars": ["澄"]
    }
  ],
  "totalStrokes": { "min": 28, "max": 35 },
  "hardExcludedChars": ["建", "國", "志", "明"],
  "softExcludedChars": ["雅", "雯", "俊", "傑"],
  "preferences": {
    "rarity": "uncommon",
    "avoidNegativeHomophones": true,
    "avoidDifficultCharacters": true,
    "styles": ["modern", "gentle"]
  }
}
```

驗證規則包含：姓名長度與 position 數量一致、指定字不得同時被排除、區間上下限合理、選五行時必須指定流派、總筆畫採用的系統一致。

---

## 8. 求解與排序演算法

### 8.1 求解管線

1. 正規化輸入、產生 canonical constraint hash。
2. 依每個位置的 hard constraints 用 SQL 取候選字。
3. 對雙名做笛卡兒組合；排除重複字、禁字與指定字衝突。
4. 計算全名 hard constraints：總筆畫與組合級規則。
5. 為通過者計算音韻、字義、書寫、熱門度、風格等 features。
6. 套用版本化 scoring profile。
7. 做 diversity rerank，避免前十名只差一個字。
8. 產生規則式 explanation facts。
9. 只對使用者展開的少量結果呼叫 LLM 潤飾；失敗時回退規則式文案。

初期每個位置約數十至數百字，雙名組合可直接枚舉；不需要 SAT solver 或 agent。當規則成長到跨位置複雜相依時，再評估 CSP library。

### 8.2 分數設計

Hard constraint 不計分；它只有通過或失敗。預設「現代實用推薦分」建議：

| 維度 | 權重 | 內容 |
| --- | ---: | --- |
| 音韻 | 30 | 聲調變化、聲母／韻母重複、連讀、負面近音 |
| 字義 | 25 | 單字正向程度、組合語意衝突、來源信心 |
| 書寫便利 | 20 | 筆畫負擔、輸入與常用字支援、字形平衡 |
| 撞名／流行 | 15 | 官方排行命中、時代集中度、證據完整性 |
| 風格符合 | 10 | 人工標籤與使用者偏好相似度 |

另列：

- `constraint_match = 100%`，否則結果根本不應出現。
- 傳統姓名學結果是獨立模組，不預設加入總分。
- 每個分項提供 feature breakdown，不只顯示一個數字。
- 同分時依實用度、資料完整度、Unicode codepoint 做穩定排序，確保結果可重現。

### 8.3 音韻 MVP

- 先將每個字的多音讀法展開；候選名保留所有有效 reading path。
- 使用國語聲母、韻母、聲調特徵計算重複與節奏。
- 諧音採詞庫 + 音節正規化規則，不讓 LLM 自行判定 hard failure。
- 嚴重負面近音可 hard exclude；模糊案例只扣分並顯示理由。
- 對多音字或無法判定的讀音顯示「需確認」，不靜默選一個。

### 8.4 無解診斷

每個過濾階段記錄 `before_count / after_count / rejected_by_rule`。零結果時：

1. 找出淘汰最多的限制。
2. 分別重跑「一次放寬一條」與相鄰筆畫區間。
3. 計算每個放寬方案實際新增的候選數。
4. 依改動成本、增加數量與使用者標記的重要性排序。
5. UI 允許一鍵套用後重新求解。

MVP 不宣稱計算完整 minimal unsatisfiable core；畫面名稱用「主要瓶頸」與「可增加候選的調整」。

---

## 9. API 設計

### 9.1 公開端點

```text
POST /api/v1/solve
POST /api/v1/analyze
POST /api/v1/diagnose
GET  /api/v1/characters/:char
GET  /api/v1/meta/options
POST /api/v1/explanations
```

### 9.2 `POST /solve` 回傳摘要

```json
{
  "queryId": "...",
  "datasetVersion": "...",
  "scoringVersion": "...",
  "counts": {
    "positionCandidates": [37, 24],
    "combinations": 888,
    "hardConstraintMatches": 31
  },
  "results": [
    {
      "name": "王芮澄",
      "constraintMatch": true,
      "score": 92,
      "scoreBreakdown": {},
      "checks": [],
      "evidence": [],
      "explanationFacts": []
    }
  ],
  "nextCursor": null
}
```

要求：

- 同一 constraints、dataset version、scoring version 必須得到相同排序。
- 初次只回傳規則式 facts，不等待 LLM。
- cursor 內含 query hash，不能接受任意 SQL 欄位。
- 所有輸入有長度、字元集合、陣列數量與 rate limit。

---

## 10. 前端資訊架構

### 10.1 首頁

- 產品定位與可信度說明。
- 「幫我找名字」與「幫我檢查名字」兩個主入口。
- 範例條件直接試用。
- 資料來源、更新日期與方法說明入口。

### 10.2 找名字流程

建議分步而非一次顯示所有進階欄位：

1. 基本：姓氏、單／雙名、性別風格。
2. 每字條件：筆畫、五行、指定／排除字、字輩。
3. 家族與全名限制：總筆畫、hard／soft 避諱。
4. 現代偏好：熱門度、生僻、音韻、風格。
5. 結果：篩選摘要、候選卡、比較、無解診斷。

表單右側／底部固定顯示「目前條件摘要」，清楚標記 hard 與 soft。

### 10.3 結果卡

- 姓名、注音、綜合推薦分與資料信心。
- `條件符合 100%` 與可展開的逐條驗證。
- 音韻、字義、書寫便利、撞名風險、風格分項。
- 每字的現代／康熙筆畫、五行流派、字義與來源。
- 為什麼推薦、注意事項、資料不足警示。
- 收藏、加入比較、複製分享連結。

### 10.4 分析姓名

- 逐字資料與來源。
- 全名 hard checks 與分項評估。
- 筆畫／五行來源衝突警示。
- 不將「未查到」誤顯示為「通過」。

### 10.5 無解狀態

- 目前條件與各階段候選數漏斗。
- 最嚴格的 1～3 個限制。
- 每個放寬建議的實際新增候選數。
- 一鍵套用、撤銷與回復原條件。

---

## 11. LLM 使用邊界

LLM 僅用於把已驗證 facts 改寫成自然語言：

- 輸入只包含候選名、結構化字義、音韻特徵、評分與注意事項。
- 強制 JSON schema：`summary`、`why_recommended`、`cautions`。
- prompt 明定不得新增筆畫、五行、法規、統計或吉凶事實。
- 輸出做 schema validation、敏感宣稱檢查與快取。
- API timeout 或驗證失敗時顯示規則式模板，不影響搜尋結果。
- 不傳出生時間、親屬姓名等非必要個資。

MVP 可以先完全不用 LLM；先證明資料與求解器有價值，再開啟解釋 adapter。

---

## 12. 測試策略與品質門檻

### 12.1 資料測試

- codepoint 唯一，`char` 與 Unicode 一致。
- 筆畫為合理正整數；element 只接受固定 enum。
- 每個公開候選字的康熙筆畫、五行、字義至少一筆來源。
- 固定 gold set 逐字比對；來源更新不得靜默改值。
- PDF／文字擷取表格需抽樣人工比對來源頁碼。

### 12.2 Solver 單元與性質測試

- 每種 constraint 的 pass／fail 邊界。
- 任意輸入下，所有輸出必須符合全部 hard constraints。
- 先加限制後的候選集合不得比原集合大。
- 相同輸入與版本的結果順序穩定。
- 診斷建議顯示的新增數，必須等於套用後實際差值。
- 多音字、Unicode 擴充字、重複字、空集合與衝突條件測試。

### 12.3 API／E2E

- 「王 + 第二字 9 畫木 + 第三字 16 畫水」完整流程 fixture。
- 指定字、字輩、家族禁字與總筆畫組合。
- 零結果 → 放寬 → 有結果。
- 分析姓名、收藏比較、分享快照。
- 手機 viewport、鍵盤操作、screen reader label 與色彩對比。

### 12.4 Public beta gate

- hard constraint 違規：測試語料中 **0 筆**。
- gold set 關鍵欄位正確率：**100%**。
- 每個公開結果關鍵資料有來源：**100%**。
- `/solve` 不含 LLM 的 p95：開發資料規模下 **< 1 秒**。
- LLM 不可用時所有核心流程仍可完成。
- 零結果頁至少提供一個經重跑驗證的建議，或明確說無可用建議。

---

## 13. 隱私、安全與合規

- 家族姓名在瀏覽器端轉為禁用字集合，後端預設不收原始姓名。
- 搜尋 log 不記完整姓名與自由文字；用 constraint hash 與匿名統計。
- 分享 token 高熵、可過期；分享內容顯示前先讓使用者預覽。
- Zod validation、參數化 SQL、CSP、CSRF 策略、rate limit。
- LLM key 只放 server；prompt 與輸出不得進公開 log。
- 資料頁固定顯示 attribution、版本、方法限制與文化／命理免責說明。
- 「可登記」改為有證據等級的「用字參考」，並提示正式登記仍以戶政機關認定為準。

---

## 14. 里程碑與驗收

### Phase 0：資料與授權 spike（3～5 天）

工作：

- 建立 `docs/data-sources.md` 與來源／欄位／授權矩陣。
- 實際下載、解析一版 CNS11643 屬性與 Unicode 對照資料。
- 確認康熙筆畫與字義資料的合法批次來源；找不到就定義人工校對流程。
- 從官方姓名統計 PDF 擷取一張表並人工覆核。
- 建立 50 字 gold fixture。

Exit criteria：能合法、可重跑地產出 50 字完整資料；關鍵來源缺口都有明確處理方案。若康熙筆畫來源未解決，停止公開產品時程，只做內部 prototype。

### Phase 1：專案骨架與 vertical slice（3～5 天）

工作：

- 建 monorepo、Next.js、PostgreSQL、migration、CI。
- 建共用 constraint schema。
- 用 50 字 fixture 完成「表單 → solve API → 結果卡」。
- 加第一批單元與 E2E 測試。

Exit criteria：一條代表性查詢可在本機與 CI 穩定通過，沒有 LLM 依賴。

### Phase 2：Character DB 與資料管線（1～1.5 週）

工作：

- 完成來源、release、字元、讀音、筆畫、五行、字義資料表。
- 實作 download／parse／normalize／validate／diff／publish CLI。
- 建 review queue 與匯入報告。
- 擴充至至少 500 個審核候選字。

Exit criteria：空資料庫可由單一指令重建；每個候選字都有可查來源。

### Phase 3：Constraint Engine（1～1.5 週）

工作：

- 完成每位置筆畫、五行、指定／允許／排除字。
- 完成字輩、家族 hard／soft 避諱與總筆畫。
- 實作 SQL 初篩、組合、stable ordering、query hash。
- 以 property-based tests 保證 hard constraints。

Exit criteria：所有規格條件皆有正反測試；任何結果都能逐項說明通過依據。

### Phase 4：Ranking、音韻與無解診斷（1～1.5 週）

工作：

- 實作 feature extraction、版本化權重與分項分數。
- 完成國語音韻、基本負面近音、書寫便利與熱門風險。
- 完成 diversity rerank。
- 完成 stage counts 與 one-change relaxation 診斷。

Exit criteria：分數可重現；無解建議的新增候選數可由重跑驗證。

### Phase 5：完整 UX（1～1.5 週）

工作：

- 首頁雙入口、分步表單、條件摘要。
- 結果卡、詳情、比較、收藏。
- 分析姓名與無解頁面。
- 手機、無障礙、loading／error／empty states。

Exit criteria：核心兩條 journey 通過 Playwright 與人工手機測試。

### Phase 6：解釋、效能與營運能力（約 1 週）

工作：

- 先做規則式 explanation；再接可選 LLM adapter。
- 加 query/result cache、rate limit、結構化 log、錯誤追蹤。
- 建資料版本頁、方法頁、免責與 attribution。
- 完成部署與備份／還原演練。

Exit criteria：達到 public beta gate；LLM 關閉時功能完整。

### Phase 7：Closed beta 與資料 QA（1～2 週）

工作：

- 邀請 10～20 位目標使用者完成真實條件查詢。
- 收集「條件是否可信、結果是否實用、說明是否理解」而非只看點擊率。
- 針對誤判建立可重現 regression fixture。
- 將候選字庫提高到 public beta 目標。

Exit criteria：沒有 P0/P1 資料錯誤；核心任務完成率與信任回饋達到團隊設定門檻。

---

## 15. 風險與應對

| 風險 | 影響 | 應對 |
| --- | --- | --- |
| 找不到合法、完整的康熙筆畫資料 | 核心承諾無法成立 | Phase 0 設為硬 gate；先做人工審核小字庫，不爬未授權網站 |
| 五行流派互相衝突 | 使用者不信任 | 流派化資料模型、顯示來源、允許自訂、不設唯一答案 |
| 官方姓名資料只有排行／出版品 | 撞名分數虛假精確 | 只做 evidence-based risk band，顯示未知與資料涵蓋範圍 |
| 「戶政可用」被誤解為法律保證 | 合規與信任風險 | 改稱用字證據，附來源與免責，正式登記由戶政機關認定 |
| 人工字義／風格標註主觀 | 排序爭議 | confidence、review status、回報機制、傳統與現代分數分離 |
| 多音字造成音韻誤判 | 錯誤排除 | 展開 reading paths，模糊案例只警示不 hard fail |
| 表單條件太多 | 使用者放棄 | 分步 progressive disclosure、範例與即時候選數 |
| LLM 幻覺 | 錯誤資料與成本 | 只餵 verified facts、schema validation、快取與模板 fallback |
| 候選前幾名過度相似 | 使用感受差 | diversity rerank 與「更多同風格／更多變化」切換 |

---

## 16. 上線指標

### 產品指標

- 找名字流程完成率。
- 有結果查詢比例與零結果後成功放寬比例。
- 每次查詢收藏／比較比例。
- 分析姓名到「開始找名字」的轉換。
- 使用者回報的資料錯誤率與修正時間。

### 技術指標

- solve p50 / p95、候選組合數、慢查詢。
- 各 hard rule 淘汰比例，用來發現錯誤資料或不合理預設。
- 無解診斷成功產生有效建議比例。
- LLM 使用率、timeout、schema failure、fallback 比例與單次成本。
- 每個 dataset release 的 diff、驗證失敗與 rollback 次數。

---

## 17. 開工順序（第一批 issue）

1. ADR：確認單體架構、技術棧與版本政策。
2. Data source inventory：CNS11643、康熙筆畫、字義、姓名統計。
3. CNS11643 下載／checksum／解析 spike。
4. 建立 50 字 gold fixture 與人工覆核格式。
5. 建 PostgreSQL schema 與第一版 migration。
6. 定義 `constraints.v1` Zod schema 與範例 payload。
7. 寫 property test：輸出永遠符合 hard constraints。
8. 實作 position query 與組合求解器。
9. 建代表性 vertical slice 頁面與 `/solve` API。
10. 實作 stage count 與無解診斷 prototype。
11. 擴充 scoring features 與版本化 profile。
12. 完成結果卡與分析姓名 journey。

第一個可展示 checkpoint 不是漂亮首頁，而是：使用 50 字可信 fixture，輸入多組位置條件後，系統穩定列出全部且僅有符合條件的名字，並能解釋零結果的原因。

---

## 18. 完成定義

MVP 只有在下列條件全部成立時才算完成：

- 所有必做 constraints 已實作且有自動測試。
- 公開候選字達資料門檻，關鍵欄位 100% 有來源。
- hard constraint 測試違規為 0。
- 無結果不是死路，診斷與放寬建議經實際重跑驗證。
- 核心功能在無 LLM、LLM timeout 與資料來源暫時不可用時仍正常。
- 使用者能看到資料版本、判定流派、分數依據與限制。
- 找名字與分析姓名在桌面、手機、鍵盤操作下皆可完成。
- production migration、備份、還原、監控與 rollback 文件齊全。

---

## 19. 已核對的官方參考來源

- [政府資料開放平臺：CNS11643 中文標準交換碼全字庫](https://data.gov.tw/dataset/5961/)
- [全字庫：授權方式及範圍](https://www.cns11643.gov.tw/pageView.jsp?ID=59&SN=&la=0&lang=tw)
- [內政部戶政司：人口統計電子書（含姓名統計）](https://www.ris.gov.tw/documents/html/5/2/popudata-quart-pub.html)
- [內政部戶政司：112 年全國姓名統計分析 PDF](https://www.ris.gov.tw/documents/data/5/2/112namestat.pdf)
- [內政部主管法規：姓名條例](https://glrs.moi.gov.tw/LawContent.aspx?id=FL002325)

資料實作仍須把每一來源的授權版本、下載日期、原始 checksum 與必要 attribution 存進 `data_sources`／`data_releases`，不能只靠本節連結。
