# TronClass API 研究

目前以同網站手機版 API 的分析為主；舊版桌面測試與日曆服務已分開保存。

| 目錄 | 用途 |
| --- | --- |
| `analyze/` | 手機版／PC API 比較工具與研究紀錄 |
| `analyze/captures/` | 原始擷取檔，保留 HTTP 記錄與 JSON |
| `analyze/reports/` | 比較產出的結構、整理後 JSON 與差異報告 |
| `analyze/notes/` | 研究進度與判讀紀錄 |
| `archive/desktop/scripts/` | 舊版 Console 探測／測試腳本 |
| `archive/desktop/data/` | 舊版 API 回應樣本 |
| `archive/desktop/notes/` | 舊版活動分析文件 |
| `services/calendar/` | 日曆 bookmarklet、userscript、安裝網站與建置工具 |

從專案根目錄比較現有 PC／手機樣本，使用獨立輸出資料夾以保留之前的報告：

```sh
python3 analyze/compare.py --out analyze/reports/2026-10-07-comparison
```

比較工具會從擷取檔取出 JSON，略過 HTTP headers；物件陣列以唯一 `id` 配對，降低排列順序造成的差異。原始回應欄位和值仍完整保留。詳見 [分析工具說明](analyze/README.md)。

舊測試腳本可整段貼到已登入的網站 Console；用法保留在各檔案開頭。日曆安裝與發布方式見 [服務說明](services/calendar/README.md)。

本機 API 樣本、擷取檔及產出報告仍保存，但由 `.gitignore` 排除，避免將驗證資訊與個資提交。分享時使用另行去識別化的副本。

本次搬移清單與原檔 SHA-256 記錄在 [整理紀錄](archive/reorganization-2026-10-07.json)，可核對檔案保存情況。
