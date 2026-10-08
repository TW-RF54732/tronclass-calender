# Service 技術參考

[返回使用與部署說明](../README.md)

服務的原始碼、靜態網頁、設定、fixture 和測試位於 `service/`。上游流程參考 [研究腳本](../../analyze/elcassa/scripts/mobile-course-data.js)，連結與 HTML 白名單參考 [Bookmarklet](../../bookmarklet/src/bookmarklet.js)。

## 同步與故障判讀

使用一個固定名稱的 SQLite Durable Object，所有 Cron 和手動同步共用同一份持久化工作。資料表分為工作、分頁暫存、已發布課程／活動、事件版本及來源狀態。每頁用 SQLite 交易保存結果與下一頁游標；alarm 最多執行 40 個上游請求，且每批經過 60 秒便停止接新請求，每次請求（含讀取 JSON）30 秒逾時。這避免最壞的 40 × 30 秒超過 alarm 的 15 分鐘限制。下一批以 alarm 續跑，Cron 也能補回意外缺少的 alarm；重複 alarm 不會重複發布已完成工作。

課程列表讀完全部分頁後選最大 `academic_year_id`，依課程 ID 去重。測驗沿用手機的 `created_at` 反向排序與 page_size=10。研究中的活動回應只有 `activities`；服務接受這種完整列表，也會在上游回傳 `pages` 時讀完所有頁。尚未實際驗證的新上游 schema 會視為來源失敗，而不假裝成空列表。

| 網頁狀態 | 處理方式 |
| --- | --- |
| 同步中 | 顯示已完成來源與上游請求次數；訂閱繼續讀舊快照 |
| 登入 HTML、重新導向、401／403 | 視為認證失效，保留整份舊快照；手動更新 Session |
| 課程列表 HTTP 錯誤、格式錯誤或逾時 | 保留整份舊快照，下一次同步重試 |
| 單一活動／測驗來源失敗 | 保留該來源上次成功的完整資料，其他來源仍更新；不發布失敗前的部分分頁 |
| 成功取得空陣列 | 清除對應來源，不沿用舊資料 |
| 資料過期 | 快照超過兩個同步間隔，或尚無快照；來源失敗另列警告及上次更新時間 |
| 尚無可用快照 | ICS 回傳 `503`；完成首次同步後即可訂閱 |

一輪完成後，以單一交易發布快照、更新事件版本與來源狀態並移除工作。只有所有來源成功才更新「最近完整成功」時間。網頁另顯示最近嘗試、已發布快照時間和各來源失敗原因。時間無法解析、順序錯誤也會顯示警告。歷史學年不再供應；事件保留 UID 版本紀錄，以便同一角色移除後再出現時仍能比較內容。

免費方案支援 SQLite Durable Objects，但仍有平台每日請求、CPU、儲存與讀寫額度，單帳號使用不代表不會達到額度。[官方價格與額度](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Workers 限制](https://developers.cloudflare.com/workers/platform/limits/)、[alarm 重試語意](https://developers.cloudflare.com/durable-objects/api/alarms/)。

## 行事曆規則

- 行事曆只建立開始與截止的精確時間標記，無截止時使用結束。互評、組內評分也建立各自的開始與結束標記。開始標記顯示為原始時刻起一小時；截止／結束標記顯示為原始時刻前一小時至該時刻，不鋪滿整個活動期間。
- 單一時刻保留為開始／截止／結束標記，使用一小時顯示區間方便手機閱讀，詳情保留原始時刻。截止與結束相同只保留一份。
- 事件名稱帶有「開始」或「截止」（無截止時為「結束」），網頁月曆與當日清單也顯示此名稱。截止與結束在同一天時只顯示「截止」；不同天仍只顯示截止，精確結束時間保留於詳情。
- 時間逆序改列個別標記並記錄警告；無效時間略過並保留原值與警告。沒有任何有效活動時間就只保留於網頁。發布及成績公布只在詳細資料，不建立事件。
- 事件包含課程、類型、標題、來源、原始時間、說明和完整活動／測驗網址。測驗保留題數、可作答次數、已繳交次數及原始 `limit_time`，不推測限時單位。
- UID 使用課程 ID、來源、活動 ID 和事件角色，同一角色時間改變不換 UID。內容不變時保留 `SEQUENCE` 與 `LAST-MODIFIED`；內容變更才增加版本。事件角色改變（例如新增截止標記）會以對應的新角色呈現。
- ICS 時間標記用 UTC，網頁依 Asia/Taipei 顯示。依 [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) 跳脫文字，以 UTF-8 bytes 75-byte 折行與 CRLF 輸出；不設定預設提醒。

## HTTP 介面

| 路由 | 認證／行為 |
| --- | --- |
| `POST /api/login` | JSON `{ "key": "網頁密鑰" }`；同源 Origin；設定 7 天 HMAC 簽章 Cookie |
| `POST /api/logout` | 同源 Origin；清除 Cookie |
| `GET /api/status` | 網頁 Cookie；同步進度、來源狀態、時間警告 |
| `GET /api/activities` | 網頁 Cookie；已發布課程、活動；可帶 `courses`、`types` |
| `POST /api/sync` | 網頁 Cookie 與同源 Origin；`202` 建立／加入現有工作，由 status 查詢進度 |
| `GET /api/subscription-url` | 網頁 Cookie；回傳固定篩選的 HTTPS 和 webcal 網址 |
| `GET /calendar/{token}.ics` | 獨立訂閱 token；可帶 `courses`、`types`；支援 ETag |

Cookie 名稱 `__Host-tronclass`，包含 `HttpOnly; Secure; SameSite=Strict; Path=/`。登出清除瀏覽器 Cookie；無伺服器 Session 名單，已複製的 Cookie 仍需等待到期或輪替網頁密鑰才會失效。寫入 API 嚴格要求 Origin 與服務網址相同。網頁登入請求限 4 KiB。訂閱 token 不接受網頁密鑰作為替代認證。

