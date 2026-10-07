# PC 與 mobile 活動 API 分析

分析日期：2026-10-07。來源為 `analyze/captures/get_activitie/PC` 與 `mobile`，未重送請求。

## 結論

兩份 JSON 解析後完全相等，包含陣列順序；比較工具也得到 0 筆差異。這次活動 API 與課程列表 API 不同：PC/mobile 沒有欄位精簡或新增的差別。

此結論限於課程 128027 的本次樣本，不能推論所有課程、活動類型與查詢條件皆一致。

## 請求比較

| 項目 | PC | mobile |
|---|---|---|
| 方法 | GET | GET |
| Host | `eclass.yuntech.edu.tw` | `eclass.yuntech.edu.tw` |
| Path | `/api/courses/128027/activities` | `/api/courses/128027/activities` |
| Query | `sub_course_id=0` | 無 |
| 驗證相關 header | `Cookie` | `X-SESSION-ID` |
| `X-Requested-With` | 無 | `XMLHttpRequest` |

兩種 query 寫法在此樣本得到相同 JSON，與省略 `sub_course_id` 時使用 0 的假設相容，但尚未證明它的正式預設值。Headers 的存在只代表擷取到的請求形態，未驗證哪些 header 是必要的，也未驗證 Session ID 能否用於其他端點。

## 回傳結構與數量

```text
{
  activities: [
    { id, course_id, type, title, start_time, deadline, end_time,
      published, is_started, is_closed, is_in_progress,
      data, uploads, prerequisites, ... }
  ]
}
```

頂層只有 `activities`，未提供 `page`、`total` 等分頁資訊。樣本包含 21 筆，全部屬於課程 128027；不能單憑這點保證其他回應不會截斷。

| type | 數量 | 觀察 |
|---|---:|---|
| `homework` | 5 | 全部有 `deadline`，且等於 `end_time` |
| `forum` | 1 | 有 `end_time`，`deadline` 為 null |
| `material` | 4 | 3 筆只有開始時間，1 筆無活動時間 |
| `web_link` | 11 | 9 筆只有開始時間，2 筆無活動時間 |

合計：6 筆有截止／結束時間、12 筆只有開始時間、3 筆的開始／截止／結束時間皆為 null。沒有 `exam` 樣本；標題為「Java Online Test」的活動實際類型是 `web_link`，不能依標題當成平台測驗。

## 有截止／結束時間的活動

以下轉換為 Asia/Taipei（UTC+8）；原始 JSON 是以 `Z` 結尾的 UTC 時間。

| ID | 類型 | 標題 | 開始（2026 年） | 截止／結束（2026 年） |
|---|---|---|---|---|
| 884252 | homework | Week 1 Homework - 觀看影片 | 09/10 17:00 | 09/16 23:59 |
| 888929 | forum | 分組名單 Group List | 09/17 14:10 | 10/08 12:00（end_time） |
| 888932 | homework | Week 2 In-class Exercise : Java program | 09/17 14:10 | 09/17 23:59 |
| 892925 | homework | Week 3 In-Class Exercise: Calculate your BMI. | 09/24 16:00 | 09/24 23:59 |
| 892937 | homework | Week 4 In-class Exercise | 10/01 16:00 | 10/01 17:15 |
| 892934 | homework | Week 4 Homework | 10/01 16:00 | 10/07 23:59 |

`Week 4 In-class Exercise` 的活動開放窗口是 75 分鐘；這不是「開始作答後限時 75 分鐘」的證據。

## 欄位用途與限制

| 欄位 | 日曆／解析用途 |
|---|---|
| `id`、`course_id` | 活動識別與課程關聯，不要混用附件或教師的 ID |
| `type`、`title` | 依 type 分類；title 用於顯示 |
| `start_time` | 活動開始時間；null 不代表尚未開放 |
| `deadline` | 作業繳交截止；本次與 end_time 相等，其他樣本仍應分開保存 |
| `end_time` | 活動結束；討論區無 deadline，需讀此欄位 |
| `published`、`is_started`、`is_closed`、`is_in_progress` | 回應當下的狀態快照，不能代替個人完成／繳交狀態 |
| `data` | 依活動類型變化的詳細設定，不能套用單一固定結構 |
| `data.publish_time` | 部分類型的發布時間，不能直接取代 start_time |
| `data.announce_score_time` | 成績公布時間，不是作業截止 |
| `uploads` | 附件資料；附件時間不是活動時間 |
| `inter_score_map`、`intra_score_map` | 互評／組內評分時段；本次 start_time/end_time 全部為 null |

`data` 的類型差異包括：作業有 `allow_retract`、`homework_type`、`score_rule` 等設定；討論區有參與與評分規則；教材有發布設定；外部連結有 `link`。應保留原始 data，不把沒有出現的欄位自行補成 false。

本次所有活動的 `prerequisites` 都是空陣列，`has_assign_student` 與 `has_assign_group` 都為 false，`is_assigned_to_all` 都為 true，因此尚無指定學生、指定群組或先修限制的實際樣本。

## 與舊版活動樣本的變化

對照 [舊版 JSON](../../archive/desktop/data/activities-payload.json)，這些是不同快照間的資料變化，不是 PC/mobile 差異：

- 活動由 20 筆增加至 21 筆：新增 `892928`，`material`，標題為 `Week 4 Slides`，三個主要活動時間皆為 null。
- 討論區 `888929` 的 end_time 從台灣時間 09/24 12:00 改為 10/08 12:00。
- 作業 `892934` 的 start_time 從 10/01 16:32 改為 16:00。
- 作業 `892937` 的 start_time 從 10/01 16:44 改為 16:00，deadline/end_time 從 17:10 改為 17:15，開放窗口由 26 分鐘變為 75 分鐘。

這些變化說明日曆同步應以穩定的活動 ID 更新事件時間，避免每次同步新增重複事件。

## 對日曆工具的影響

- 目前樣本可共用同一套 PC/mobile 活動 JSON 解析邏輯。
- 截止提醒應同時考慮 deadline 與 end_time，並保留兩者語意；只讀 deadline 會漏掉討論區。
- 只有 start_time 的教材／連結適合當開放事件，不應當成截止事件。
- 三個主要時間皆為 null 的活動，不宜自行用發布或附件時間建立截止提醒。
- 日期、狀態及活動數量會隨快照改變；既有事件需更新。
- 尚無測驗及個人作答限時樣本，不能據此判斷測驗端點或限時單位。

## 重現與產物

```bash
python3 analyze/compare.py \
  analyze/captures/get_activitie/PC \
  analyze/captures/get_activitie/mobile \
  --out analyze/reports/get_activitie
```

- [差異報告](../reports/get_activitie/summary.md)
- [完整差異 JSON（空陣列）](../reports/get_activitie/diff.json)
- [格式化 PC JSON](../reports/get_activitie/left.pretty.json)
- [格式化 mobile JSON](../reports/get_activitie/right.pretty.json)
- [PC 欄位結構](../reports/get_activitie/left.schema.json)
- [mobile 欄位結構](../reports/get_activitie/right.schema.json)

原始擷取與衍生 JSON 報告留在本機忽略目錄；本筆記不包含 Cookie 或 Session token 值。
