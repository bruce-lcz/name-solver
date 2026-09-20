# NameSolver

NameSolver 是一個確定性、可追溯的台灣繁體中文姓名條件探索器。它讓使用者先輸入必要條件，再從名字的任一位置開始挑字：固定第二字會列出可搭配的第三字，固定第三字也會反向列出第二字。推薦分數只改變順序，不會把合法候選刪掉。

NameSolver is a deterministic, evidence-aware Taiwanese Chinese name exploration tool. Users can start from either given-name position: fixing the second character produces the compatible third-character pool, and fixing the third character works in the other direction. Recommendation scores change ordering only; they never remove a hard-constraint match.

## 功能 Features

- 名字長度 1～3 字，支援每個位置獨立的筆畫、五行、指定、允許與排除條件。
- 第二字與第三字都能獨立固定或解除；也能固定完整組合後只替換其中一字。
- 顯示每個候選字的可搭配數量、最佳範例與推薦分數。
- 組合結果與候選字池都支援分頁，不建立完整的數十億筆笛卡兒陣列。
- 缺少目前篩選條件所需資料的字會進入「待確認字池」，不會被誤標為符合。
- 保留 JSON 進階模式，API 與 UI 使用同一份 `constraints.v1` 契約。

- Given-name lengths from 1 to 3, with independent stroke, element, required, allowed, and excluded-character rules per position.
- Fix or release either character independently, including replacing one character in an already fixed pair.
- Show compatible-count, best-example, and recommendation information for each candidate.
- Paginate both full combinations and character pools without materializing billions of Cartesian products.
- Keep characters with missing filter metadata in a visible pending pool instead of treating them as confirmed matches.
- Keep the JSON advanced mode; the UI and API share the same `constraints.v1` contract.

## 字庫 Dataset

網站使用本機版本化的 CNS11643 snapshot `20260805`，目前包含 **76,930 個標準 Unicode CJK 漢字**；其中 76,921 個有現代筆畫資料。私用區外字、部首與非姓名碼位不列入網站字庫。

The web app uses the versioned CNS11643 snapshot `20260805`, containing **76,930 standard Unicode CJK ideographs**; 76,921 have modern-stroke data. Private-use glyphs, radicals, and non-name code points are excluded from the web dataset.

CNS11643 本身沒有提供完整的康熙筆畫、五行、字義、稀有度或風格資料。已審核的 50 字 fixture 會覆蓋相同字的補充 metadata；其餘字在沒有設定對應條件時仍可探索，設定後若資料不足會列入待確認池。

CNS11643 does not provide a complete Kangxi-stroke, five-element, meaning, rarity, or style dataset. The reviewed 50-character fixture overlays additional metadata where available. Other characters remain explorable when those filters are unset and move to the pending pool when the required metadata is unavailable.

資料匯入報告位於 [data/releases/cns11643-20260805/report.json](./data/releases/cns11643-20260805/report.json)。原始來源與 checksum 說明見 [docs/data-sources.md](./docs/data-sources.md)。

## 快速開始 Quick start

需求：Node.js 24+ 與 npm。

Requirements: Node.js 24+ and npm.

```sh
npm install
npm test
npm run build
npm run web:build
npm run dev
```

開發伺服器啟動後，開啟 <http://localhost:3000>。

After the development server starts, open <http://localhost:3000>.

常用指令：

| 指令 | 用途 |
| --- | --- |
| `npm test` | 執行 Vitest 測試 |
| `npm run build` | TypeScript 型別檢查 |
| `npm run web:build` | 建立 Next.js production bundle |
| `npm run dev` | 啟動網站與 API |
| `npm run pipeline:cns` | 將本機 CNS snapshot 轉成版本化字庫 |
| `npm run crawl:cns` | 下載官方 CNS11643 snapshot |

| Command | Purpose |
| --- | --- |
| `npm test` | Run the Vitest suite |
| `npm run build` | Type-check the repository |
| `npm run web:build` | Build the Next.js production bundle |
| `npm run dev` | Start the web app and API |
| `npm run pipeline:cns` | Convert the local CNS snapshot into a versioned release |
| `npm run crawl:cns` | Download the official CNS11643 snapshot |

`npm run pipeline:cns` 預設讀取 `data/raw/cns11643/20260805`，輸出到 `data/releases/cns11643-20260805`。下載資料與正式發佈是分開的步驟。

`npm run pipeline:cns` reads `data/raw/cns11643/20260805` by default and writes `data/releases/cns11643-20260805`. Downloading a snapshot and publishing a release are separate steps.

## API

`POST /api/v1/solve` 接受 `constraints`，以及可選的分頁與固定字欄位：

`POST /api/v1/solve` accepts `constraints` plus optional pagination and fixed-character fields:

```json
{
  "constraints": {
    "schemaVersion": 1,
    "surname": "陳",
    "givenNameLength": 2,
    "positions": [
      { "strokeSystem": "modern", "strokes": { "values": [7] } },
      { "strokeSystem": "modern", "strokes": { "values": [12] } }
    ],
    "totalStrokes": { "values": [19] },
    "hardExcludedChars": ["強"],
    "preferences": {
      "rarity": "uncommon",
      "styles": ["modern"],
      "avoidNegativeHomophones": true,
      "avoidDifficultCharacters": true
    }
  },
  "fixedCharacters": ["沐", null],
  "limit": 20,
  "offset": 0,
  "poolLimit": 24,
  "poolOffsets": [0, 0]
}
```

請求欄位：

| 欄位 | 說明 |
| --- | --- |
| `constraints` | `constraints.v1` 必填條件 |
| `fixedCharacters` | 依位置固定的字；使用 `null` 表示未固定 |
| `limit` / `offset` | 完整姓名組合的頁大小與偏移量 |
| `poolLimit` / `poolOffsets` | 各位置候選池的頁大小與偏移量 |
| `poolStatus` | `eligible` 或 `pending`；預設 `eligible` |

Request fields:

| Field | Description |
| --- | --- |
| `constraints` | Required `constraints.v1` hard and soft preferences |
| `fixedCharacters` | Fixed character by position; use `null` for an open position |
| `limit` / `offset` | Page size and offset for full-name combinations |
| `poolLimit` / `poolOffsets` | Page size and offsets for character pools |
| `poolStatus` | `eligible` or `pending`; defaults to `eligible` |

回應包含：

The response includes:

- `results`：已通過所有可判定 hard constraints 的完整姓名，依推薦分數排序。
- `pools`：每個位置的候選字、可搭配數量、最佳範例與下一頁 offset。
- `pendingPools`：缺少目前篩選所需 metadata 的候選字。
- `counts.hardConstraintMatches`：完整可確認命中數，不受目前頁面 `limit` 影響。
- `pendingCombinations`：因缺少必要 metadata 而無法判定的組合數。
- `nextCursor`：完整組合的下一頁 offset；沒有下一頁時為 `null`。

- `results`: complete names that pass every determinable hard constraint, ranked by recommendation score.
- `pools`: candidate characters by position, compatible counts, best examples, and the next pool offset.
- `pendingPools`: characters missing metadata required by the active filters.
- `counts.hardConstraintMatches`: the full confirmed match count, independent of the current page size.
- `pendingCombinations`: combinations that cannot be confirmed because required metadata is missing.
- `nextCursor`: the next full-combination offset, or `null` when there is no next page.

## Hard rules 與排序 Ranking

硬條件決定資格：指定／允許／排除字、筆畫、五行、全域避用字與名字總筆畫。偏好排序包含稀有度、風格、易輸入、軟排除、負面諧音與重複字分數；缺少 metadata 的字不會因 schema 預設值而獲得虛假的推薦優勢。

Hard constraints determine eligibility: required, allowed, and excluded characters; strokes; elements; global exclusions; and total given-name strokes. Preference ranking considers rarity, style, input ease, soft exclusions, negative homophones, and repeated-character penalties. Missing metadata never receives an artificial ranking advantage from schema defaults.

`totalStrokes` 只計算名字，不包含姓氏；每個位置使用自己宣告的 stroke system。

`totalStrokes` sums the given-name characters only, excluding the surname; each position uses its declared stroke system.

## 專案結構 Project layout

```text
apps/web/                 Next.js UI and route handlers
packages/domain/          Zod contracts and character schema
packages/solver/          Hard-rule solver and paged exploration index
packages/ranking/         Deterministic recommendation scoring
packages/diagnostics/     Constraint-relaxation diagnostics
packages/data-pipeline/   CNS crawler and release importer
data/raw/                 Immutable downloaded snapshots
data/releases/            Generated versioned character releases
tests/                    Unit, property, API, and exploration tests
```

## 驗證與限制 Validation and limitations

目前驗證包含 16 個 Vitest 測試、TypeScript build、Next.js production build，以及完整字庫的雙向選字、固定字、分頁、筆畫／五行／總筆畫與待確認池測試。

Current validation covers 16 Vitest tests, the TypeScript build, the Next.js production build, and full-dataset tests for bidirectional selection, fixed characters, pagination, stroke/element/total-stroke filters, and pending pools.

目前限制：

- CNS snapshot 沒有完整康熙筆畫、五行、字義、稀有度與風格資料。
- 私用區外字尚未納入，因為需要額外字型與字元識別支援。
- 結果是資料與規則的探索工具，不是戶政登記保證或命理判定。
- 完整組合採分頁；一次要求極大的 page size 仍會受到 API 上限 100 筆限制。

Current limitations:

- The CNS snapshot does not contain complete Kangxi-stroke, element, meaning, rarity, or style metadata.
- Private-use glyphs are excluded until font and character-identity support is added.
- Results are evidence-aware data exploration, not a household-registration guarantee or fortune-telling judgment.
- Full combinations are paginated; a single request is capped at 100 results by the API contract.

更多欄位與使用範例請見 [docs/user-manual.md](./docs/user-manual.md)。資料來源與治理說明請見 [docs/data-sources.md](./docs/data-sources.md)。

See [docs/user-manual.md](./docs/user-manual.md) for the complete field reference and examples. See [docs/data-sources.md](./docs/data-sources.md) for provenance and data-governance notes.
