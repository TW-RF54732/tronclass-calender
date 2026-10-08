# TronClass 個人行事曆訂閱服務

單帳號、自行部署的 TypeScript Cloudflare Worker。定期用手機 API 同步最新學年度課程，提供手機活動網頁及 ICS 訂閱。登入、Session 更新與部署均由使用者手動處理；沒有自動登入、歷史學年封存、預設提醒或依完成狀態隱藏活動。

所有服務原始碼、靜態網頁、設定、fixture 和測試都在本目錄。上游流程參考 [研究腳本](../analyze/elcassa/scripts/mobile-course-data.js)，連結與 HTML 白名單參考 [Bookmarklet](../bookmarklet/src/bookmarklet.js)，未使用私人擷取資料。

## 本機開發

需要 Node.js 22.12 以上（建議 Node.js 24 LTS）及 npm。

```sh
cd service
npm ci
cp .dev.vars.example .dev.vars
# 在 .dev.vars 手動填入四個值；不要提交此檔案。
npm run dev
```

開啟 Wrangler 顯示的 HTTPS 本機網址。自簽憑證需先在瀏覽器接受；登入 Cookie 要求 HTTPS。輸入 `WEB_ACCESS_KEY` 後按「立即同步」。本機 Cron 不會自行依雲端時程執行，手動同步會建立同一種 alarm 工作。本機資料存在 `.wrangler/`，不會寫入雲端。

本機未填入有效 Secrets 時，仍可跑所有合成測試。不要用 `.dev.vars.example` 的假 Session 來測試實際平台。

## Secrets 與手動部署

| 名稱 | 用途 |
| --- | --- |
| `TRONCLASS_SESSION_ID` | 從已登入的手機 API 請求手動取得 `X-SESSION-ID` |
| `TRONCLASS_USER_ID` | 自己的正整數使用者 ID |
| `WEB_ACCESS_KEY` | 獨立且隨機的網頁登入密鑰，也用來簽章 Cookie |
| `CALENDAR_TOKEN` | 另一個隨機值，只用於訂閱網址；限 `A-Z a-z 0-9 _ -` |

網頁密鑰與訂閱 token 建議各自至少使用 32 個隨機 bytes，例如分別執行兩次 `openssl rand -hex 32`。訂閱網址能讀取私人活動，應視為密鑰保存。Session 與使用者 ID 不會送至前端；應用程式沒有輸出認證值的日誌，預設停用 Worker observability。不要把訂閱網址寫進存取日誌或公開分享。

```sh
npx wrangler login
# 先建立 Worker 名稱及 SQLite Durable Object migration
npm run deploy
# 逐一輸入秘密，勿放在命令列參數或 wrangler.jsonc
npx wrangler secret put TRONCLASS_SESSION_ID
npx wrangler secret put TRONCLASS_USER_ID
npx wrangler secret put WEB_ACCESS_KEY
npx wrangler secret put CALENDAR_TOKEN
```

Wrangler 會建立 `CalendarStore` 的 `v1` migration，`new_sqlite_classes` 必須保留，後續不得把已部署的 SQLite namespace 換成 KV 儲存。Secrets 完成後，開啟部署網址登入並手動同步，或等下一次 Cron（最多 5 分鐘）。首次有效的排程檢查立即同步。

更新 Session：再次執行 `npx wrangler secret put TRONCLASS_SESSION_ID`，再從網頁按「立即同步」。變更 `WEB_ACCESS_KEY` 會使既有 Cookie 無法通過簽章驗證；變更 `CALENDAR_TOKEN` 會使舊訂閱網址失效，手機需換成新網址。切換帳號請部署另一個 Worker，避免跨帳號沿用上次成功的快照。

`wrangler.jsonc` 的 `POLL_INTERVAL_MINUTES` 預設 `30`，需為至少 5 且是 5 的倍數。Cron 固定 `*/5 * * * *`，只判斷到期，不直接抓完所有課程。修改 vars 後重新部署。compatibility date 使用 `2026-08-15`，與目前 Workers Vitest runtime 共同支援的日期一致。

## GitHub Actions tag 部署

工作流程位於 `.github/workflows/service.yml`，推送 `service-v*` tag 後，先執行 `npm ci`、型別檢查、Workers 測試、dry-run 建置及 Chromium 瀏覽器測試；全部成功才部署該 tag 的程式。`bookmarklet-v*` 和舊 `v*` tags 只發布 bookmarklet，不部署服務。

首次使用請在 GitHub 的 Settings → Environments 建立 `cloudflare-production`；若設定部署 tag 限制，允許 `service-v*`。在此 environment 的 Secrets 設定：

| GitHub Secret | 用途 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare 的 Edit Cloudflare Workers API token，授權目標帳號部署 Worker |
| `CLOUDFLARE_ACCOUNT_ID` | 目標 Cloudflare 帳號 ID |

四個應用 Secrets（`TRONCLASS_SESSION_ID`、`TRONCLASS_USER_ID`、`WEB_ACCESS_KEY`、`CALENDAR_TOKEN`）沿用 Cloudflare 既有設定，不由此 workflow 上傳。首次發布可先用上面的手動部署步驟建立 Worker 並設定 Secrets，再改用 tag 發布；若直接以 tag 建立 Worker，須隨後手動設定四個 Secrets 才能使用。Session 更新仍使用 `wrangler secret put` 或 Cloudflare dashboard。

先提交及推送工作流程與程式，再發布新版本：

```sh
git tag service-v1.0.0
git push origin service-v1.0.0
```

每個 tag 都部署到 `wrangler.jsonc` 中同一個 `tronclass-calendar` Worker，包含靜態網頁、Durable Object migrations 與 Cron。發布舊程式碼會覆蓋目前服務；請使用新的版本號。GitHub Actions 的正式執行與雲端部署需要上述帳號設定，本機 dry-run 不會建立雲端資源。

參考 [Cloudflare GitHub Actions 部署文件](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)。

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

## 網頁與訂閱

網頁固定使用深灰色主題，預設開啟當前台灣月份的月曆，可切換原有活動列表。月曆支援上一月、下一月、回到今天與日期選擇；每格顯示最多兩個時段，其餘從當日清單查看，點活動可開啟詳情。月曆使用與 ICS 相同的已發布事件，僅顯示開始與截止標記（無截止時使用結束），互評與組內評分也只顯示兩端，不佔用中間日期。沒有有效時間的活動另列於「未排入月曆」。兩種檢視共用搜尋、課程和類型篩選，切換不改訂閱網址。桌機篩選置於側欄，手機預設收合於月曆上方。

網頁包含所有活動類型，以及已結束、已繳交與沒有時間的活動；課程／類型複選與搜尋只篩選畫面。活動說明透過 Bookmarklet 的 DOM 標籤白名單重新建立，移除腳本、嵌入內容與所有事件屬性；連結僅允許 HTTP、HTTPS、mailto，相對連結以 TronClass 網站解析。

網頁排序以時段長度由短到長，長時段往下。月曆日期格與當日清單依標記所屬活動的原始時段長度排序，只有單一時間的活動按零長度排列。活動列表以主時段「開始 → 截止」（無截止則到結束）的長度排序；只有互評／組內評分時，使用最長的有效評分時段；無有效時間的活動放最後。長度相同時再依時間、標題或識別排序。這是網頁顯示順序，不推測測驗 `limit_time` 的單位。

勾選課程與類型後，複製 HTTPS 訂閱網址到手機行事曆的「新增訂閱行事曆」，或按 webcal 連結。網址保存產生當下的課程／類型，之後操作網頁不會改變手機既有訂閱；要換篩選需更新訂閱網址。搜尋不放入訂閱。網址省略某個參數代表全部，`courses=` 或 `types=` 代表不選；兩項篩選取交集。

手機更新頻率由訂閱 App 決定；伺服器每 30 分鐘同步並不保證手機每 30 分鐘更新。請不要匯入成一次性的 `.ics` 檔案，否則不會自動更新。ICS 支援 ETag／304，有舊快照時同步故障仍供應資料，所有私人回應禁止共享快取。

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

## 驗證

```sh
npm run check
npm test
npm run build                 # dry run，不建立雲端資源
npx playwright install chromium
npm run test:browser
```

Vitest 在實際 Workers／SQLite Durable Object runtime 執行合成 fixture：多頁課程、活動與測驗、最大學年度、去重、來源同 ID、部分失敗、成功空列表、HTML／重新導向／認證失效、逾時、40 次分批與物件重啟、重複 alarm、原子發布、版本／ETag、登入／登出／同源和篩選。ICS 由 `ical.js` 解析後核對時間、中文折行及日期規則。Playwright 以 390 × 844 手機尺寸驗證活動列表、無時間活動、篩選、固定訂閱網址、登出及惡意 HTML；API 使用 fixture，不連線平台。截圖在忽略的 `test-results/mobile.png`。

開發依賴中的 `sharp`／`undici` 以 overrides 使用修補版本；這些僅供本機工具，不打包進 Worker。Workers Vitest 與 Wrangler 版本鎖於 `package-lock.json`。若執行環境限制設定目錄，可設定 `XDG_CONFIG_HOME=/tmp/tronclass-config` 與 `WRANGLER_LOG_PATH=/tmp/tronclass.log`；測試與本機 dev 需允許 loopback port。

實際上游與手機訂閱需在手動填入有效 Secrets 並部署後驗證：先確認完整同步成功、手機新增訂閱，再在平台活動異動後確認相同 UID 的內容更新。這些步驟不能由合成測試替代，本次實作不會自動讀取私人 Session 或部署帳號。

行事曆格式更新會在 Durable Object 啟動時由既有快照重建事件，移除舊跨日時段，不需要重新連線上游。部署後手機何時取得更新由訂閱端決定。

活動與測驗網址統一使用 `https://eclass.yuntech.edu.tw`；部署後既有快照中的舊網域也會自動更新。
