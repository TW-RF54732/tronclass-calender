# PC 與 mobile 測驗 API 分析

分析日期：2026-10-07。來源為 `analyze/captures/get_exams/PC.txt` 與 `mobile.txt`；未重送請求。

## 結論

兩邊都有相同的 4 個測驗，依唯一 `id` 配對後，每個測驗的欄位、型別和值完全一致。比較工具唯一差異是頂層 `page_size`：PC 為 20，mobile 為 10。原始陣列排列不同，請求的排序條件也不同，不應依陣列索引配對測驗。

此結論只涵蓋課程 128027 的本次樣本，並非 API 正式規格。

## 請求比較

| 項目 | PC | mobile |
|---|---|---|
| 方法 | GET | GET |
| Host | `eclass.yuntech.edu.tw` | `eclass.yuntech.edu.tw` |
| Path | `/api/courses/128027/exam-list` | 相同 |
| `page` | 1 | 1 |
| `page_size` | 20 | 10 |
| `conditions.itemsSortBy.predicate` | `module` | `created_at` |
| `conditions.itemsSortBy.reverse` | false | true |
| `reloadPage` | false | 未提供 |

PC 依 module 排序，mobile 使用 created_at 反向排序。未對齊 query 前，不能把分頁大小與順序差異歸因為平台回傳格式差異。

PC 的測驗 ID 順序：`57962 → 57959 → 58229 → 58235`。

mobile 的順序：`58235 → 58229 → 57962 → 57959`。

## 回傳結構與分頁

```text
{
  end: 4,
  exams: [{ id, type, title, start_time, end_time, limit_time, ... }],
  page: 1,
  page_size: 20 或 10,
  pages: 1,
  start: 1,
  total: 4
}
```

本次總數 4，小於兩邊的 page_size，因此兩邊都在單頁取得 4 筆。其他課程如果超過一頁，需要依 pages 或 total 繼續取得資料。

測驗物件沒有 `course_id`，所屬課程需從請求路徑保留；也沒有 `deadline`，截止／結束時間讀取 `end_time`。

## 測驗時間與題數

以下為 Asia/Taipei（UTC+8），年份均為 2026；原始 JSON 時間為 UTC（`Z`）。

| ID | 標題 | 開始 | 結束 | 開放窗口 | 題數 |
|---|---|---|---|---|---:|
| 57962 | Review Quiz for Week 1 | 09/17 14:10 | 09/17 14:25 | 15 分鐘 | 10 |
| 57959 | Week 2 Homework : Java Basics | 09/17 00:00 | 09/23 23:59 | 6 天 23 小時 59 分 | 50 |
| 58229 | Review Quiz for Week 2 (New) | 09/24 14:10 | 09/24 14:20 | 10 分鐘 | 10 |
| 58235 | Review Quiz for Week 3 | 10/01 14:10 | 10/01 14:20 | 10 分鐘 | 10 |

四筆 `type` 皆為 `exam`。即使標題含 Homework，仍應當成測驗解析，不能依標題歸入一般 homework 活動。

所有 `limit_time` 都為 null。開放窗口不等於開始作答後的個人倒數限時；此樣本無法確認非 null 的 limit_time 型態、單位與規則，也不宜自行將 null 當成 0 分鐘。

## 繳交、完成與成績欄位

| ID | `submission_count` | `submit_times` | `score` | `final_score` |
|---|---:|---:|---|---|
| 57962 | 1 | 3 | 有字串值 | null |
| 57959 | 1 | 3 | 有字串值 | null |
| 58229 | 1 | 1 | 有字串值 | null |
| 58235 | 0 | 2 | 缺少欄位 | 缺少欄位 |

依欄位名稱，submission_count 可作為已繳交次數、submit_times 可作為設定的允許次數候選；確切次數限制、重交及暫存規則仍需介面或詳細 API 驗證。不能直接用兩者相減就斷言還能作答，因為也受時間、權限及其他規則限制。

四筆的完成條件均為 `completion_criterion_key="submitted"`，顯示文字為「繳交測驗」。`completion_criterion_value` 為字串 `"0"`，不能解讀為未完成。

本次四筆 `published=true`、`is_started=true`、`is_closed=true`、`is_in_progress=false`。關閉狀態是活動狀態快照，不代表學生已繳交；58235 就同時為已關閉、submission_count=0。

`score` 是字串；缺少 score 不等於 0 分。`final_score=null` 也不同於缺少欄位。`score_percentage` 為字串，`score_rule="highest"`；不要把成績、權重與完成條件混為一談。本筆記不重錄個人成績數值。

## 發布、答案與成績公布

- `publish_time` 與 `start_time` 分開保存：57959 的發布晚於設定開始時間；58235 也是開始 1 分鐘後發布。發布時間不能直接取代開始時間。
- 四筆 `announce_answer_status="no_announce"`、`announce_answer_time=null`，不能自行由時間推算答案已公布。
- 四筆 `announce_score_status="immediate_announce"`、`announce_score_time=null`；null 不代表沒有成績公布規則。
- `is_announce_answer_time_passed`、`is_announce_score_time_passed` 是伺服器提供的快照判定，不能只根據公布時間 null 反推其值。

## 補考、題目與限制

- 3 筆有 `makeup_exam_paper`，含自己的 id 和 subjects_count；57959 沒有此欄位。補考卷 ID 不等於原測驗 ID。
- 四筆 `make_up_record=null`、`makeup_exam_submission_count=0`。有補考卷物件不代表目前使用者有補考資格，也沒有足夠補考時間資料可建立補考日曆事件。
- `subjects_rule` 包含抽題、題目順序及選項順序設定；抽題開啟時另有 `select_subjects_randomly_rule`。這是題目規則，不是作答時間。
- 本次 `is_ip_constrained=false`、`limited_ip=""`，沒有 IP 限制的實際樣本。
- `prerequisites`、指定學生／群組陣列皆為空；`is_assigned_to_all=true`，尚無先修或指定對象限制的實際樣本。
- `has_temporary_submission=false`，沒有暫存作答樣本。

## 對日曆工具的影響

1. activities 和 exam-list 是不同集合，需分別取得再合併；活動 API 的 21 筆不包含這 4 個測驗。
2. 合併時保留來源課程 ID 與 type；事件識別建議使用 course_id、type、id，避免把測驗與一般活動當成同一個物件。
3. 測驗用 start_time/end_time 建立開放與結束提醒；不要要求一定有 deadline。
4. PC/mobile 測驗解析可共用，排序和分頁則依請求／回應資訊處理。
5. 可保留 limit_time 供未來顯示，但目前不能標示個人限時分鐘數。
6. 活動關閉、學生繳交與成績是不同狀態；若要隱藏已完成項目，應另訂完成判斷，不要用 is_closed 代替。

## 新增樣本：clear_exams.txt（/exams）

新增來源為 [clear_exams.txt](../captures/get_exams/clear_exams.txt)，請求是 `GET /api/courses/128027/exams`，沒有 query。此檔案的請求包含 `X-SESSION-ID`、`X-Requested-With` 和 `Origin`，未包含 Cookie；本筆記不記錄 token 值。

使用者觀察：此端點在 PC/mobile 的回傳值相同，headers 不同。目前保存一份 clear_exams.txt，因此此處未獨立做兩份 /exams 擷取的逐欄比對。這個觀察也不能直接證明任一 header 可省略或互換。

### /exam-list 與 /exams 的差別

| 項目 | /exam-list | /exams |
|---|---|---|
| 頂層 | exams 加分頁資訊 | 只有 exams |
| 本次測驗 | 相同的 4 個 ID | 相同的 4 個 ID |
| 開始、結束、limit_time | 有 | 相同 |
| 成績與繳交次數摘要 | 有 | 缺少 |
| 題數與補考卷摘要 | 有 | 缺少 |
| 測驗操作與限制設定 | 部分 | 額外提供多個欄位及 data |
| 課程編排資訊 | referrer_id/type | 另有 module、syllabus、sort、unique_key 等 |

將 PC 的 /exam-list 與 /exams 以 ID 配對，共 155 筆差異：左側獨有 35、右側獨有 120，沒有共同欄位值或型別改變。35 筆包含 6 個頂層分頁欄位及各測驗摘要差異；120 筆是每個測驗增加 30 個頂層欄位。新增 data 整個物件計為一筆，沒有逐一累加其子欄位。

`/exam-list` 獨有測驗欄位：`created_by`、`final_score`、`has_temporary_submission`、`makeup_exam_paper`、`makeup_exam_submission_count`、`score`、`subjects_count`、`submission_count`。部分欄位只存在於部分測驗，不能每筆都視為必填。

`/exams` 的新增欄位可分為：

- 限制與操作：`check_submit_ip_consistency`、`disable_copy_paste`、`disable_devtool`、`disable_right_click`、`enable_anti_cheat`、`enable_invigilation`、`is_fullscreen_mode`、`is_leaving_window_constrained`、`is_leaving_window_timeout`、`leaving_window_limit`、`leaving_window_timeout`、`limit_answer_on_signle_client`、`limit_short_answer_upload`。
- 先修與模式：`enable_exam_prerequisite`、`exam_prerequisite`、`is_practice_mode`。
- 內容與設定：`data`、`description`、`default_options_layout`。
- 提交關聯：`exam_submissions`。
- 時間與編排：`created_at`、`module_id`、`module_sort`、`sort`、`syllabus_id`、`syllabus_sort`、`teaching_model`、`unique_key`、`using_phase`、`is_opened_catalog`。

依樣本判斷，/exam-list 偏向列表與個人結果摘要，/exams 偏向設定與課程編排；兩者不是單純完整版／精簡版的包含關係。

### 新欄位的具體觀察

- 57959、57962、58235 的 `enable_anti_cheat`、全螢幕與離開視窗限制旗標皆為 true；`leaving_window_limit=3`、`leaving_window_timeout=15`。58229 對應旗標為 false，兩個數值為 null。15 的時間單位、3 的實際計數行為仍需介面或其他證據確認，不能當成作答限時。
- 四筆 `disable_devtool=true`、`enable_invigilation=false`。這是回傳設定，未測試瀏覽器是否實際執行各項限制。
- `data` 內的公布狀態及選項布局使用數字，而頂層使用可讀字串。例如本次 `data.default_options_layout=2`、頂層為 `"vertical"`；`data.announce_score_status=1`、頂層為 `"immediate_announce"`。這是樣本對應，不能當成完整 enum 表。
- `limit_answer_on_signle_client` 的 signle 拼字就是原始 API 欄位，解析時應保留，不能自行改名為 single 後直接讀取。
- 前三個已繳交測驗的 `exam_submissions` 各有一個數字，數字恰好與測驗 ID 相同；58235 是空陣列，與 /exam-list 的 submission_count=0 一致。但不能因此確認陣列元素是提交紀錄 ID、測驗 ID，或在多次繳交時如何表示。
- 四筆 `limit_time` 仍為 null；新端點沒有補上個人作答限時的實際樣本。

### 日曆工具選用

若只需要測驗標題、開放／截止時間與個人繳交摘要，目前 /exam-list 已提供所需資訊。若需要額外顯示測驗限制或課程編排，可再取得 /exams 並以 ID 合併。不能用 /exams 缺少的 score 或 submission_count 覆寫既有結果為 null 或 0。

相關產物：

- [/exams 格式化 JSON](../reports/get_exams/clear/pretty.json)
- [/exams 欄位結構](../reports/get_exams/clear/schema.json)
- [/exam-list 與 /exams 比較報告](../reports/get_exams/list-vs-exams/summary.md)
- [完整端點差異 JSON](../reports/get_exams/list-vs-exams/diff.json)

## 重現與報告

```bash
python3 analyze/compare.py \
  analyze/captures/get_exams/PC.txt \
  analyze/captures/get_exams/mobile.txt \
  --out analyze/reports/get_exams

python3 analyze/compare.py \
  analyze/captures/get_exams/PC.txt \
  analyze/captures/get_exams/clear_exams.txt \
  --out analyze/reports/get_exams/list-vs-exams
```

- [差異報告](../reports/get_exams/summary.md)
- [完整差異 JSON](../reports/get_exams/diff.json)
- [格式化 PC JSON](../reports/get_exams/left.pretty.json)
- [格式化 mobile JSON](../reports/get_exams/right.pretty.json)
- [PC 欄位結構](../reports/get_exams/left.schema.json)
- [mobile 欄位結構](../reports/get_exams/right.schema.json)

原始擷取與衍生 JSON 報告留在本機忽略目錄；本筆記不收錄驗證 token 值。
