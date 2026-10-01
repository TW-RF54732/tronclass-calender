# 雲科 TronClass 課程活動

## 安裝 bookmarklet

用瀏覽器開啟 `install-bookmarklet.html`，把「雲科課程活動」連結拖到書籤列。也可以新增書籤，把 `bookmarklet.txt` 的整行內容貼到書籤網址。

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
