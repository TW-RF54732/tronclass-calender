# PC 與 mobile 課程列表 API 比較

分析日期：2026-10-07

## 結論

目前樣本中，兩個 API 回傳相同的課程資料，主要差別在提供哪些欄位。PC 提供較完整的課程狀態與管理資訊；mobile 的結構較精簡，但也有自己的欄位，因此不是 PC 回傳的嚴格子集合。

這是依樣本推得的結果，不代表 API 的正式規格，也不能保證其他頁面或帳號的回傳相同。

## 樣本與比較方式

| 項目 | PC | mobile |
|---|---|---|
| HTTP 方法 | POST | GET |
| 路徑 | `/api/my-courses` | `/api/users/176757/courses` |
| 樣本檔 | [PC](../captures/PC) | [mobile](../captures/mobile) |
| 回傳課程數 | 10 | 10 |
| 頁碼 | 1 | 1 |
| 每頁筆數 | 10 | 10 |
| 總課程數 | 32 | 32 |
| 總頁數 | 4 | 4 |

比較範圍為記錄中的 JSON payload。以唯一 `id` 配對課程與教師，區分缺少欄位、`null`、型別改變及值改變。

兩邊 10 門課的 ID 與排列順序相同，共同欄位的值與型別也相同。此處只分析第 1 頁，未驗證其餘 22 門課。

## 差異統計

| 分類 | 筆數 | 說明 |
|---|---:|---|
| PC 獨有 | 259 | 每門課 25 個差異，加上 9 位教師的頭像欄位 |
| mobile 獨有 | 20 | 每門課 2 個欄位 |
| 共同欄位值不同 | 0 | 配對後沒有發現 |
| 共同欄位型別不同 | 0 | 配對後沒有發現 |
| 合計 | 279 | 同一欄位在不同課程出現，會分別計數 |

279 筆差異不等於 279 個不同欄位，主要是相同的結構差異在各課程重複出現。

## PC 獨有欄位

下列 17 個課程頂層欄位，在這 10 門課中皆為 PC 獨有：

| 欄位分組（依名稱推測） | 欄位 |
|---|---|
| 課程狀態 | `archived`、`is_closed`、`is_started` |
| 權限、審核與管理 | `allow_clone`、`audit_remark`、`audit_status`、`can_withdraw_course`、`created_user`、`imported_from`、`is_instructor` |
| 顯示資訊 | `display_name`、`is_default_course_cover`、`small_cover` |
| 協同教學 | `is_team_teaching` |
| 組織資訊 | `org` |
| 學習進度與使用者紀錄 | `study_completeness`、`user_stick_course_record` |

另外，每門課都有以下 8 個巢狀欄位差異：

- `course_attributes.audience_type`
- `course_attributes.copy_status`
- `course_attributes.graduate_method`
- `course_attributes.is_during_publish_period`
- `course_attributes.published`
- `course_attributes.tip`
- `grade.id`
- `klass.id`

9 門課有教師資料，教師物件的 `avatar_small_url` 也是 PC 獨有；另一門課的教師陣列為空。

因此 PC 獨有差異為 `(17 + 8) × 10 + 9 = 259` 筆。欄位的實際語意仍需正式文件或更多樣本確認。

## mobile 獨有欄位

| 欄位 | 這份樣本中的值 |
|---|---|
| `learning_mode` | 10 門課全部為 `"freedom"` |
| `team_teachings` | 10 門課全部為空陣列 `[]` |

PC 的 `is_team_teaching` 與 mobile 的 `team_teachings` 名稱相關，但型態及內容不同；這份樣本不足以證明兩者可直接互換。

## 對日曆工具的影響

- 如果只需要課程 ID、名稱、教師、學期和課程日期，兩邊在目前樣本都提供相同資料。
- 如果需要以 `is_closed`、`archived` 等狀態篩選課程，mobile 這份回傳缺少相關欄位，不能直接沿用依賴 PC 欄位的邏輯。
- 欄位缺少不等於 `false`，也不等於 `null`；讀取不同 API 時應保留這個區別。
- `start_date`、`end_date` 是課程層級日期，這份課程列表無法提供每週上課時間或作業截止日。

## 後續可驗證項目

- 比較其餘頁面，確認欄位差異及共同欄位值是否一致。
- 檢查已結束、封存或有協同教師的課程，觀察狀態欄位及 `team_teachings` 的內容。
- 分別確認兩個 API 的查詢條件、排序與驗證方式；相同回傳樣本不代表請求可直接互換。

## 相關產物

- [完整差異報告](../reports/summary.md)
- [完整差異 JSON](../reports/diff.json)
- [格式化 PC JSON](../reports/left.pretty.json)
- [格式化 mobile JSON](../reports/right.pretty.json)
- [比較工具使用說明](../README.md)
