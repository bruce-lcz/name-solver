# NameSolver 實作符合性檢查報告

檢查日期：2026-08-13  
比對基準：`docs/implementation-plan.md` 1.0 版  
檢查範圍：目前工作目錄中的原始碼、測試、建置設定與文件

## 結論

目前實作是可建置、可測試的 **Phase 1 垂直切片雛形**，但只完成 Phase 1 的部分工作，尚未達到完整 MVP。

- `npm test`：通過，1 個測試檔、3 個測試案例全部成功。
- `npm run build`：通過，TypeScript 型別檢查無錯誤。
- 已完成：monorepo 基本目錄、`constraints.v1` 的主要 Zod schema、字元 schema、確定性的 hard constraint solver、階段計數、framework-neutral `/solve` 核心及基本測試。
- 尚未完成：PostgreSQL／migration、CI、50 字 fixture、實際 Next.js Route Handler、輸入表單、結果卡、E2E、資料來源與版本、排序、無解診斷、分析模式、收藏比較及其餘公開端點。

因此，若驗收目標是「可證明核心 hard constraint 求解概念」，目前結果大致相符；若驗收目標是計畫中的 Phase 1 全部 exit criteria 或完整 MVP，則不相符。

## 主要差異與風險

### 高：`totalStrokes` 的語意與計畫不同

計畫要求「全名總筆畫條件」，目前 solver 只加總名字各位置的筆畫，不包含姓氏。README 也把目前行為定義為 given-name characters 的總和。因 `surname` 只有文字、沒有筆畫資料，現有資料模型無法計算全名總筆畫。

影響：使用者若依計畫認為 28 畫代表姓氏加名字，會得到錯誤篩選結果。

建議：在正式擴充前明確決定契約。若維持計畫語意，請提供姓氏筆畫或將姓氏也解析為 Character，並新增包含單姓、複姓與不同筆畫系統的測試。

### 高：未排除名字中的重複字

計畫的求解管線要求在雙名笛卡兒組合後排除重複字；目前任何通過位置條件的同一字都能組成例如「陳安安」。

影響：可能回傳計畫明確要求排除的候選。

建議：加入組合級重複字規則、對應 rejection code 與單元／性質測試；若產品其實允許疊字，則應修改計畫並提供可設定的明確選項。

### 高：`hardConstraintMatches` 不是完整命中數

solver 達到 `limit` 後即停止收集，並以 `results.length` 填入 `hardConstraintMatches`。當實際命中數大於 `limit` 時，欄位只代表「本次回傳筆數」，不是計畫所稱的階段剩餘數量。

影響：無解診斷、漏斗計數與前端顯示會低估命中數。

建議：完整計數與分頁結果分開計算；新增「命中數大於 limit」的測試。

### 中：總筆畫可混用不同筆畫系統

計畫的 Constraint contract 要求總筆畫採用的系統一致；目前每個位置可指定不同 `strokeSystem`，solver 仍會把不同系統的數值直接相加。

影響：總筆畫數值可能沒有一致的判定基礎。

建議：schema 驗證所有位置使用相同系統，或把總筆畫的系統改為獨立且明確的欄位。

### 中：輸入邊界與錯誤回應不完整

- `limit` 沒有型別、整數、正數與上限驗證；`limit = 0` 仍可能回傳一筆。
- API core 只攔截 `ZodError`；缺少 `characters`、body 為 `null` 等情況可能拋出一般執行期錯誤，而不是 400。
- `surname` 僅限制字串長度，未限制漢字；多個陣列也沒有計畫要求的數量上限。
- 字元輸入重複時，可能產生重複結果。

建議：為整個 request body 建立嚴格的 Zod schema，統一驗證 `constraints`、`characters` 與 `limit`，並加入 payload 上限與錯誤案例測試。

### 中：目前不是可直接部署的 HTTP API

`apps/web/src/app/api/v1/solve/route.ts` 匯出的是 `postSolve()` 函式，沒有匯出 Next.js App Router 所需的 `POST(request)` handler；`apps/web` 也尚未配置完整 Next.js 應用。

影響：手冊使用者不能啟動網站後直接呼叫 `POST /api/v1/solve`。

建議：現階段稱為「route core」是準確的；完成 Next.js handler 後再將它標示為 HTTP endpoint。

## 與計畫的對照

| 計畫項目 | 狀態 | 實作觀察 |
| --- | --- | --- |
| monorepo 專案骨架 | 部分完成 | 有 `apps`、`packages`、workspace 設定；尚無完整 Next.js、DB、migration、CI。 |
| 共用 `constraints.v1` schema | 大致完成 | 主要欄位與交叉驗證存在；總筆畫系統一致性及輸入上限未完成。 |
| 字元記錄與驗證 | 基礎完成 | 支援單一漢字、筆畫、五行、罕見度、輸入難度與 tags；無來源、版本、信心與 review 狀態。 |
| hard constraint solver | 部分完成 | 位置筆畫、五行、指定／允許／排除字、全域禁字、名字筆畫合計可運作；重複字與全名總筆畫不符計畫。 |
| soft preference／ranking | 尚未完成 | schema 接受偏好，但 solver 不使用，也沒有 score、breakdown 或 deterministic ranking。 |
| 階段數量與拒絕原因 | 部分完成 | 有 position candidates、combinations 與 rejectedByRule；命中數受 limit 截斷。 |
| `/solve` API | 雛形完成 | 有 framework-neutral core 與 Zod 錯誤轉 400；不是實際 HTTP Route Handler，回傳契約也缺版本、分數、證據與 cursor。 |
| 其餘公開端點 | 尚未完成 | analyze、diagnose、character、meta、explanations 均不存在。 |
| 50 字 fixture 與 UI 流程 | 尚未完成 | 測試 fixture 只有 4 字；沒有表單或結果卡。 |
| 自動測試 | 基礎完成 | 3 個 Vitest 案例通過；缺少 property-based、E2E、邊界及完整 hard rule coverage。 |
| 無 LLM 依賴 | 完成 | 核心求解不使用 LLM。 |
| 完整 MVP Definition of Done | 未達成 | 資料治理、診斷、UX、可存取性、營運與復原文件等尚未實作。 |

## 建議驗收順序

1. 先決定並修正 `totalStrokes` 契約，避免後續資料與 UI 建在錯誤語意上。
2. 補上重複字、混用筆畫系統、`limit` 與 request body 的防護及測試。
3. 完成實際 Next.js `POST` handler、50 字 fixture 與一條表單到結果卡的 E2E。
4. 補 PostgreSQL、migration 與 CI，完成 Phase 1 尚缺項目。
5. 再依計畫推進資料治理、Phase 3 constraint coverage、ranking 與 diagnose，避免把尚未生效的 soft preferences 暴露為可用功能。

