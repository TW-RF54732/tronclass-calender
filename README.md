# TronClass 課程行事曆

把雲科 TronClass 的課程活動與測驗整理成列表及月曆，方便查看開始時間、截止時間與活動詳情。

## 推薦：Bookmarklet

想直接查看課程活動，推薦先使用 bookmarklet。在已登入的 TronClass 網頁點一下書籤，就能開啟活動列表與月曆，不需要自行部署服務。

**[前往書籤安裝網站](https://tw-rf54732.github.io/tronclass-calender/)**

1. 開啟安裝網站，把「雲科課程活動」拖到瀏覽器書籤列；無法拖曳時可依網站說明手動加入。
2. 登入 [雲科 TronClass](https://eclass.yuntech.edu.tw)。
3. 在 TronClass 網頁點擊書籤，查看課程活動與測驗。

支援課程與活動類型篩選、關鍵字搜尋、列表／月曆切換，以及活動詳情。資料在使用時從目前登入的帳號讀取，也可按「重新整理」更新。

[Bookmarklet 使用說明](bookmarklet/README.md)

## Service：個人行事曆訂閱服務

如果希望把活動訂閱到手機行事曆，可以自行部署 `service/` 的 Cloudflare Worker。服務預設每 30 分鐘同步最新學年度的課程活動與測驗，提供活動網頁及 ICS 訂閱網址。

需要自己的 Cloudflare 帳號，並手動設定 TronClass Session、使用者 ID、網頁登入密鑰與訂閱 token。Session 過期後需要更新；手機行事曆的更新頻率由訂閱 App 決定。

[Service 使用與部署說明](service/README.md)

## 開發與研究

- [Bookmarklet 建置與發布](bookmarklet/docs/development.md)：原始碼、安裝頁建置與 GitHub Pages 發布。
- [Service 開發與驗證](service/README.md#本機開發)：本機環境及測試。
- [Service 技術參考](service/docs/reference.md)：同步機制、行事曆規則與 HTTP 介面。
- [API 研究導覽](analyze/README.md)：桌面與手機 API 的分析筆記、示範腳本及比較工具。

Bookmarklet 使用 `bookmarklet-v*` tag 發布安裝網站；Service 使用 `service-v*` tag 通過測試後部署 Cloudflare。各自的設定與發布步驟見上方文件。
