# 雲科 TronClass 課程活動

[開啟書籤安裝網站](https://tw-rf54732.github.io/tronclass-calender/)

## 安裝 bookmarklet

用瀏覽器開啟 `index.html`，把「雲科課程活動」膠囊拖到書籤列。也可以展開「無法拖曳？手動加入書籤」，複製完整書籤網址。`install-bookmarklet.html` 提供相同的安裝頁。

登入 `https://eclass.yuntech.edu.tw` 後，在該網頁點擊書籤。

- 勾選要顯示的活動類型，可複選；「清除選取」會清空活動顯示。
- 可依課程篩選，或搜尋活動與課程名稱。
- 表格顯示全部符合篩選的活動，包括未設定時間的活動。
- 月曆可切換月份，標示開始、截止、結束與評分時段。同一活動的截止和結束若相同，只列截止。
- 點擊活動查看時間、ID、API 狀態，或開啟所屬課程內容。
- 「重新整理」重新抓取資料；關閉或按 Escape 會關閉面板並取消請求。

沿用目前課程查詢條件：`ongoing`、`notStarted`、`recently_started`，讀完所有分頁後只取最大的 `academic_year_id`。某門課程抓取失敗時，面板會列出原因並呈現已成功讀取的活動。

所有顯示時間使用 `Asia/Taipei`。月曆以活動時間建立事件，不將發布時間或成績公布時間當作活動期限。活動的可用時段不代表測驗開始作答後的限時；目前樣本尚未包含平台測驗限時欄位。

## 修改與產生書籤

修改 `bookmarklet.js` 後執行：

```sh
python build-bookmarklet.py
```

再用產生的新網址更新瀏覽器書籤。`bookmarklet.js` 也可直接貼到登入後的 Console 執行。

`site-template.html` 是安裝頁模板；產生的 HTML 已包含完整 bookmarklet，不需外部套件、CDN 或後端。

## GitHub Pages 發布

GitHub Actions 工作流程位於 `.github/workflows/pages.yml`，只在推送 `v*` tag 時執行，建置靜態頁面並部署到 GitHub Pages。

第一次發布前，在 GitHub 儲存庫的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。若 `github-pages` environment 有分支／tag 限制，須允許 `v*` tags 部署。

先提交原始碼與工作流程，再推送版本 tag：

```sh
git tag v1.0.0
git push origin v1.0.0
```

依目前的 remote，部署成功後安裝頁網址為：

```text
https://tw-rf54732.github.io/tronclass-calender/
```

每次發布會從該 tag 的 `bookmarklet.js` 產生首頁書籤，不需要先手動更新已產生的 HTML。tag 名稱使用 `v` 開頭的英文、數字、句點、底線或連字號，例如 `v1.0.0`、`v1.1.0-beta.1`。

## 最新與歷史版本

- `/index.html`、`/bookmarklet.txt`：最近一次成功部署的 tag。推送舊版 tag 也會把首頁切換到該版。
- `/releases/v1.0.0/`：該 tag 的固定原始碼產生的安裝頁與 `bookmarklet.txt`。歷史頁面使用當次部署的安裝頁樣式，但內含各 tag 自己的 bookmarklet。
- `/versions.json`：`schemaVersion: 1`，`latest` 表示首頁版本；`releases` 記錄版本、相對路徑、commit SHA、原始碼提交時間。

每次發布都會重新讀取所有 `v*` tags，重建歷史版本，無須另外維護發布分支或永久保存 Actions artifacts。沒有 `bookmarklet.js` 的早期 tag 不列入。請保留既有 tags 並使用新的版本號發布。

可在本機模擬建置指定 tag（該 tag 必須已存在）：

```sh
python build-bookmarklet.py --output dist --version v1.0.0 --include-tags
```

部署只上傳 `dist` 的安裝頁與版本資料，不會上傳本機保存的 API 回應 JSON。
