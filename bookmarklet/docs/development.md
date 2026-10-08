# Bookmarklet 建置與發布

[返回使用說明](../README.md)

以下指令均在專案根目錄執行。

## 修改與產生書籤

修改 `bookmarklet/src/bookmarklet.js` 後執行：

```sh
python3 bookmarklet/tools/build-bookmarklet.py
```

再用產生的新網址更新瀏覽器書籤。`bookmarklet/src/bookmarklet.js` 也可直接貼到登入後的 Console 執行。

`bookmarklet/templates/site-template.html` 是安裝頁模板；產生的 HTML 已包含完整 bookmarklet，不需外部套件、CDN 或後端。

## GitHub Pages 發布

GitHub Actions 工作流程位於 `.github/workflows/pages.yml`，在推送 `bookmarklet-v*` tag 時執行（也保留舊 `v*` tag 觸發），建置靜態頁面並部署到 GitHub Pages。

第一次發布前，在 GitHub 儲存庫的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。若 `github-pages` environment 有分支／tag 限制，須允許 `bookmarklet-v*` 與 `v*` tags 部署。

先提交原始碼與工作流程，再推送版本 tag：

```sh
git tag bookmarklet-v1.3.0
git push origin bookmarklet-v1.3.0
```

依目前的 remote，部署成功後安裝頁網址為：

```text
https://tw-rf54732.github.io/tronclass-calender/
```

每次發布會從該 tag 的 `bookmarklet/src/bookmarklet.js` 產生首頁書籤，不需要先手動更新已產生的 HTML。新 tag 名稱使用 `bookmarklet-v` 開頭，舊 `v*` tags 仍支援；後面可使用英文、數字、句點、底線或連字號，例如 `bookmarklet-v1.3.0`、`bookmarklet-v1.4.0-beta.1`。

## 最新與歷史版本

- `/index.html`、`/bookmarklet.txt`：最近一次成功部署的 tag。推送舊版 tag 也會把首頁切換到該版。
- `/releases/v1.0.0/`：該 tag 的固定原始碼產生的安裝頁與 `bookmarklet.txt`。歷史頁面使用當次部署的安裝頁樣式，但內含各 tag 自己的 bookmarklet。
- `/versions.json`：`schemaVersion: 1`，`latest` 表示首頁版本；`releases` 記錄版本、相對路徑、commit SHA、原始碼提交時間。

每次發布都會重新讀取所有 `bookmarklet-v*` 與舊 `v*` tags，重建歷史版本，無須另外維護發布分支或永久保存 Actions artifacts。沒有支援的 bookmarklet 原始碼路徑的早期 tag 不列入；`service-v*` tags 不列入。請保留既有 tags 並使用新的版本號發布。

可在本機模擬建置指定 tag（該 tag 必須已存在）：

```sh
python3 bookmarklet/tools/build-bookmarklet.py --output dist --version v1.0.0 --include-tags
```

部署只上傳 `dist` 的安裝頁與版本資料，不會上傳本機保存的 API 回應 JSON。
