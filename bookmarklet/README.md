# Bookmarklet：雲科 TronClass 課程活動

[開啟書籤安裝網站](https://tw-rf54732.github.io/tronclass-calender/)

## 安裝 bookmarklet

開啟上方安裝網站，把「雲科課程活動」膠囊拖到書籤列。也可以展開「無法拖曳？手動加入書籤」，複製完整書籤網址。也可在本機開啟 [public/index.html](public/index.html) 安裝。

登入 `https://eclass.yuntech.edu.tw` 後，在該網頁點擊書籤。

- 勾選要顯示的活動類型，可複選；「清除選取」會清空活動顯示。
- 可依課程篩選，或搜尋活動與課程名稱。
- 表格顯示全部符合篩選的活動，包括未設定時間的活動。
- 月曆可切換月份，標示活動及測驗的開始、截止、結束時段。同一活動的截止和結束若相同，只列截止。
- 活動包含 `/activities` 和 `/exam-list` 的資料；測驗有獨立的 `exam` 篩選，可查看 `limit_time`、可作答次數和題數。
- 點擊活動查看時間、ID、API 狀態與活動說明（`data.description`），並可開啟對應的課程活動或測驗頁面。
- 「重新整理」重新抓取資料；關閉或按 Escape 會關閉面板並取消請求。

沿用目前課程查詢條件：`ongoing`、`notStarted`、`recently_started`，讀完所有分頁後只取最大的 `academic_year_id`。某門課程抓取失敗時，面板會列出原因並呈現已成功讀取的活動。

所有顯示時間使用 `Asia/Taipei`。月曆以活動時間建立事件，不將發布時間或成績公布時間當作活動期限。`exam-list` 回傳的 `limit_time` 會在測驗詳細資料中顯示；目前樣本中的值都是 `null`，因此無法從樣本確認平台限時的單位或起算方式。

## 開發與發布

原始碼、建置指令、GitHub Pages 設定與歷史版本說明見 [建置與發布文件](docs/development.md)。
