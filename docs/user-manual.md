# NameSolver 使用手冊（目前垂直切片）

版本：0.1.0  
適用日期：2026-08-13

## 1. 目前可以做什麼

NameSolver 目前提供 TypeScript 函式，依輸入的候選字資料與 `constraints.v1` 條件，產生所有通過 hard constraints 的姓名候選。

現階段適合開發與規則驗證，尚未提供可操作的網站畫面或可直接啟動的 HTTP 服務。`POST /api/v1/solve` 目前是 framework-neutral route core，需由程式直接呼叫。

可用條件包括：

- 名字長度 1～3 字，且每個名字位置各有一組條件。
- 每個位置的筆畫單值、多選或區間。
- 每個位置的五行流派與可接受五行。
- 每個位置的指定字、允許字與排除字。
- 全域嚴格排除字。
- 名字各字的總筆畫單值、多選或區間。

`genderStyle`、`softExcludedChars` 與 `preferences` 可以通過 schema 驗證，但目前不參與篩選或排序。

## 2. 安裝與驗證

需求：Node.js 與 npm。於專案根目錄執行：

```sh
npm install
npm test
npm run build
```

- `npm test` 執行 Vitest 測試。
- `npm run build` 執行 TypeScript 型別檢查，不會產生部署檔。
- 目前沒有 `npm run dev`，也沒有可啟動的前端網站。

## 3. 基本用法

在 TypeScript 程式中匯入 `solve`：

```ts
import { solve } from "./packages/solver/src/index.ts";

const characters = [
  {
    char: "沐",
    strokes: { kangxi: 8 },
    elements: { radical: "water" },
    rarityBand: "uncommon"
  },
  {
    char: "安",
    strokes: { kangxi: 6 },
    elements: { radical: "earth" }
  }
];

const response = solve(
  {
    schemaVersion: 1,
    surname: "陳",
    givenNameLength: 2,
    positions: [
      {
        strokeSystem: "kangxi",
        strokes: { values: [8] },
        element: { school: "radical", values: ["water"] }
      },
      {
        strokeSystem: "kangxi",
        strokes: { min: 6, max: 6 },
        element: { school: "radical", values: ["earth"] }
      }
    ],
    totalStrokes: { values: [14] },
    hardExcludedChars: []
  },
  characters,
  50
);

console.log(response.results);
```

第三個參數是最多回傳筆數，預設為 50。現版尚未驗證此參數，呼叫端應傳入大於 0 的整數。

上述範例會產生「陳沐安」。請注意，目前 `totalStrokes: 14` 只計算「沐」與「安」，不包含姓氏「陳」。

## 4. Constraint 欄位

### 最上層欄位

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `schemaVersion` | 是 | 目前固定為 `1`。 |
| `surname` | 是 | 1～8 個字元的字串；目前未限制一定是漢字。 |
| `givenNameLength` | 是 | 1～3，必須與 `positions` 長度相同。 |
| `genderStyle` | 否 | `feminine`、`masculine` 或 `neutral`；目前不影響結果。 |
| `positions` | 是 | 每個名字位置的 hard constraints。 |
| `totalStrokes` | 否 | 名字各位置筆畫的合計條件；目前不含姓氏。 |
| `hardExcludedChars` | 否 | 全部位置都不得使用的字。預設空陣列。 |
| `softExcludedChars` | 否 | 盡量避免的字；目前不影響結果。 |
| `preferences` | 否 | 排序偏好；目前不影響結果。 |

### `positions` 欄位

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `strokeSystem` | 是 | `kangxi` 或 `modern`。 |
| `strokes` | 否 | 筆畫條件，格式見下節。 |
| `element` | 否 | 五行條件，需同時指定 `school` 與 `values`。 |
| `requiredChar` | 否 | 此位置必須使用的單一漢字，預設 `null`。 |
| `allowedChars` | 否 | 非空時，此位置只能使用陣列中的字。 |
| `excludedChars` | 否 | 此位置不得使用的字。 |

如果 `requiredChar` 同時出現在 `excludedChars`，驗證會失敗。如果 `allowedChars` 非空，`requiredChar` 必須包含在其中。

### 筆畫條件

可使用離散值：

```json
{ "values": [8, 9, 12] }
```

也可使用上下限：

```json
{ "min": 8, "max": 12 }
```

`values`、`min`、`max` 可以合併使用，此時所有條件都必須同時符合。至少要提供其中一項，且 `min` 不得大於 `max`。

### 五行條件

```json
{
  "school": "radical",
  "values": ["wood", "water"]
}
```

- `school`：`radical` 或 `numerology`。
- `values`：`wood`、`fire`、`earth`、`metal`、`water` 中至少一項。

## 5. 候選字資料格式

每筆候選字必須是單一漢字：

```ts
{
  char: "沐",
  strokes: {
    kangxi: 8,
    modern: 7
  },
  elements: {
    radical: "water",
    numerology: "wood"
  },
  rarityBand: "uncommon",
  inputDifficulty: 0.1,
  tags: ["modern", "gentle"]
}
```

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `char` | 是 | 恰好一個漢字。 |
| `strokes` | 否 | `kangxi`、`modern` 對應正整數；預設空物件。 |
| `elements` | 否 | `radical`、`numerology` 對應五行；預設空物件。 |
| `rarityBand` | 否 | `common`、`uncommon` 或 `rare`；預設 `common`。 |
| `inputDifficulty` | 否 | 0～1；預設 0。現版不影響排序。 |
| `tags` | 否 | 字串陣列；預設空陣列。現版不影響排序。 |

若某位置設定筆畫或五行條件，而該字缺少相同系統／流派的資料，該字會被排除。

## 6. 回傳結果

`solve()` 回傳：

```ts
{
  results: [
    {
      name: "陳沐安",
      characters: [/* 已驗證並補入預設值的字元記錄 */],
      totalStrokes: 14,
      constraintMatch: true,
      checks: [
        { character: "沐", position: 0, passed: true, failures: [] },
        { character: "安", position: 1, passed: true, failures: [] }
      ]
    }
  ],
  counts: {
    inputCharacters: 2,
    positionCandidates: [1, 1],
    combinations: 1,
    hardConstraintMatches: 1,
    rejectedByRule: {}
  }
}
```

計數欄位：

- `inputCharacters`：輸入候選字筆數。
- `positionCandidates`：各位置通過位置級條件的候選數。
- `combinations`：位置候選的笛卡兒組合數。
- `hardConstraintMatches`：目前實作等於本次回傳結果數，會受 `limit` 影響。
- `rejectedByRule`：各位置篩選與總筆畫篩選的拒絕次數；同一字可能同時記入多個原因。

可能的拒絕原因：

| 代碼 | 意義 |
| --- | --- |
| `hard_excluded` | 出現在全域嚴格排除字中。 |
| `required_char` | 不符合指定字。 |
| `allowed_chars` | 不在允許字清單中。 |
| `excluded_chars` | 出現在該位置排除字中。 |
| `missing_strokes` | 缺少指定筆畫系統的資料。 |
| `strokes` | 筆畫不符。 |
| `missing_element` | 缺少指定流派的五行資料。 |
| `element` | 五行不符。 |
| `total_strokes` | 名字總筆畫不符。 |

## 7. 使用 route core

若呼叫端想取得類似 HTTP 的 status/body 結果，可使用 `postSolve()`：

```ts
import { postSolve } from "./apps/web/src/app/api/v1/solve/route.ts";

const response = postSolve({
  constraints,
  characters,
  limit: 20
});

if (response.status === 200) {
  console.log(response.body.results);
} else {
  console.error(response.body.error, response.body.issues);
}
```

Constraint 或 Character 的 Zod 驗證失敗時，回傳：

```ts
{
  status: 400,
  body: {
    error: "invalid_request",
    issues: [/* Zod issues */]
  }
}
```

這不是實際 HTTP 呼叫方式；目前不能用 `curl` 直接呼叫它。

## 8. 常見問題

### 為什麼設定偏好後順序沒有變？

目前尚未實作 soft preference 與 ranking。結果順序主要來自輸入候選字的順序及笛卡兒組合順序。

### 為什麼候選字完全沒有出現？

檢查 `counts.rejectedByRule`。最常見原因是缺少所選筆畫系統或五行流派的資料，或被位置／全域排除條件移除。

### `totalStrokes` 是否包含姓氏？

目前不包含，只加總名字各位置的筆畫。這與實作計畫的「全名總筆畫」仍有差異。

### 可以避免「安安」這類重複字嗎？

目前 solver 不會自動排除名字中的重複字。可暫時透過各位置的 `excludedChars`／`allowedChars` 控制特定組合，但無法以現有 contract 通用地禁止所有重複字。

### 可以投入正式姓名資料嗎？

目前候選字由呼叫端直接提供，尚無資料來源、版本、信心等級或登記證據。正式用途前應等待資料治理與 Character DB 階段完成。

## 9. 目前限制

- 沒有 UI、可部署 API、資料庫或內建候選字庫。
- 沒有分數、音韻、字義、熱門度、風格排序與來源證據。
- 沒有無解診斷或經重跑驗證的放寬建議。
- 沒有姓名分析、收藏、比較或分享。
- 沒有分頁／cursor；所有位置組合會先在記憶體建立，大型字庫可能耗用大量記憶體。
- `limit` 與完整 request body 邊界尚未嚴格驗證。
- `hardConstraintMatches` 受 `limit` 截斷，不能當作完整命中總數。
- 不會自動排除名字重複字。
- 不應把目前結果解讀為可登記保證、吉凶判定或人生預測。

完整的計畫符合性與待辦優先順序請參閱 `docs/implementation-review.md`。

