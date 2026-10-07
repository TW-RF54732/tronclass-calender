# 活動 API 分析

依據目前的 `activities-payload.json`：課程 ID 是 **128027**，共有 20 個活動，包含 5 個 `homework`、1 個 `forum`、3 個 `material`、11 個 `web_link`。沒有測驗樣本。

## 值得觀察的欄位

| 欄位 | 用途與注意事項 |
| --- | --- |
| `activities[].id` | 活動本身的 ID；不同於 `course_id`、附件或其他巢狀物件的 ID。 |
| `course_id`、`type`、`title` | 所屬課程、活動類型、標題。應依 `type` 分類，不能僅因標題有 Test 就判定為平台測驗。 |
| `start_time` | 活動開始時間；教材與連結也可能有值。`null` 不能解讀為尚未開放。 |
| `deadline` | 本次 5 個作業都有此欄位，適合觀察繳交期限。 |
| `end_time` | 活動結束時間。本次作業與 `deadline` 相同，但討論區只有 `end_time`，所以不能只看 `deadline`。 |
| `published`、`is_started`、`is_closed`、`is_in_progress` | 伺服器回應當下的發布與進行狀態。檔案中的狀態是快照，不一定符合現在時間，也不是個人的繳交完成狀態。 |
| `data.publish_time` | 發布時間。本次部分資料是 2 月發布、9 月開始，應與 `start_time` 分開保存，不拿來替代活動開始時間。 |
| `data.announce_score_time` | 成績公布時間，不是繳交截止或活動結束時間。 |
| `inter_score_map.start_time/end_time`、`intra_score_map.start_time/end_time` | 可能的互評與組內評分時段；本次全部是 `null`，有實際樣本後再確認行為。 |
| `prerequisites`、`has_assign_student`、`has_assign_group`、`is_assigned_to_all` | 觀察先修活動或指定對象限制；時間已到不一定代表每個人都能操作。 |

## 有截止或結束時間的活動

以下均為台灣時間（Asia/Taipei，UTC+8）。

| 活動 ID | 類型 | 標題 | 開始 | 截止／結束 |
| --- | --- | --- | --- | --- |
| 884252 | homework | Week 1 Homework - 觀看影片 | 2026/09/10 17:00 | 2026/09/16 23:59 |
| 888929 | forum | 分組名單 Group List | 2026/09/17 14:10 | 2026/09/24 12:00（end_time） |
| 888932 | homework | Week 2 In-class Exercise : Java program | 2026/09/17 14:10 | 2026/09/17 23:59 |
| 892925 | homework | Week 3 In-Class Exercise: Calculate your BMI. | 2026/09/24 16:00 | 2026/09/24 23:59 |
| 892937 | homework | Week 4 In-class Exercise | 2026/10/01 16:44 | 2026/10/01 17:10 |
| 892934 | homework | Week 4 Homework | 2026/10/01 16:32 | 2026/10/07 23:59 |

另有 12 個教材或連結只有 `start_time`。剩下 2 個只有發布時間，沒有活動開始、截止或結束時間。

`Week 4 In-class Exercise` 的開放窗口是 26 分鐘，但不能據此推斷有「開始作答後限時 26 分鐘」的規則。這份資料沒有測驗，尚無法確認測驗的 `type`、作答限時欄位或單位；需要測驗活動回應，必要時再觀察其詳細 API。

## Console 腳本

把 `course-activities.js` 最後一行的 `128027` 改為目標課程 ID，在已登入的 eclass 網頁 Console 執行整段。它列出兩張時間表，回傳 `{ courseId, deadlines, openingOnly, timedActivities, payload }`；`payload` 保留完整回應，其他陣列中的時間保留原始 UTC 字串。

腳本目前只依已觀察到的開始／截止／結束與評分時段篩選，不猜測未確認的測驗作答限時欄位。API 的發布時間與成績公布時間不會單獨觸發收錄。
