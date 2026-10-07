# API JSON 比較

在專案根目錄執行（只需 Python 3，不需額外套件）：

```bash
python3 analyze/compare.py
```

預設讀取 `analyze/captures/PC` 與 `analyze/captures/mobile`，保留原始檔，將結果寫入 `analyze/reports/`：

- `summary.md`：先看欄位結構差異，再看各筆資料的差異預覽。
- `left.pretty.json` / `right.pretty.json`：完整縮排 JSON。
- `left.schema.json` / `right.schema.json`：欄位路徑、實際出現的型別與次數；陣列元素合併成 `[]`，可查看大型資料的結構。
- `diff.json`：完整差異值，分類為左側獨有、右側獨有、型別改變、值改變。

比較其他檔案：

```bash
python3 analyze/compare.py a.json b.json --out /tmp/api-comparison
python3 analyze/compare.py a.json b.json --match-key course_code
```

支援純 JSON、以 `Requested:` 標示 JSON 的記錄，以及 HTTP headers 後接 JSON body 的文字。工具只分析 JSON payload，不會重送 API 請求或複製 HTTP headers 到報告。若記錄包含多個 payload，請先拆成各自的檔案。

物件陣列的所有元素都有唯一 `id` 時，以 `id` 配對並忽略排列順序；其他陣列依索引比較。`--match-key` 可替換配對欄位。欄位缺少與 `null` 會分開處理。結構報告的出現次數是全資料的累計次數，不代表欄位是必填；型別也只反映目前樣本，不是 API 的正式 schema。

原始檔包含驗證資訊，JSON 及報告也可能包含個人資料；分享前請先移除敏感內容。

## 保留研究紀錄

原始檔放在 `captures/`，判讀筆記放在 `notes/`。既有報告已保留；預設執行會覆寫同名報告，請以 `--out analyze/reports/<日期或批次>` 保存每次比較。

舊版測試與資料見 `../archive/desktop/`；日曆及網站服務見 `../services/calendar/`。
