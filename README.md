# TronClass

同一個專案、同一個版本庫，以三個主要目錄管理舊版設施、研究成果及新版服務開發。

```text
legacy/                 舊版設施與歷史資料
  calendar/             舊日曆 bookmarklet、userscript、安裝網站與建置工具
  archive/              舊桌面探測腳本、樣本、筆記與歷史整理紀錄
analyze/                研究資料與逆向成果
  scripts/              逆向後可用的 API 示範，供新開發參考
  notes/                API 比較、驗證結論與研究紀錄
  captures/             本機原始擷取
  reports/              本機衍生報告
  compare.py            JSON 比較工具
  format_json.py        JSON 格式化工具
service/                新版 Cloudflare Workers 個人化服務開發預留區
```

[analyze/scripts](analyze/scripts/README.md) 是重要的可用 API 示範，不是舊版封存：包含單端點請求與「課程 → 活動 → 測驗」完整流程。保留原始腳本與其驗證限制，新服務開發從此參考。[研究導覽](analyze/README.md) 彙整筆記與工具用法。

[舊版設施](legacy/README.md) 持續保留維護及發布入口；[新版服務區](service/README.md) 目前留白，尚未建立 Worker、前端、認證或資料庫。原始碼可公開，使用者自行配置與部署個人服務。

## 研究環境

```sh
uv sync
uv run python analyze/compare.py analyze/captures/get_courses/PC analyze/captures/get_courses/mobile --out analyze/reports/new-comparison
uv run python analyze/format_json.py
```

Python 3.12 與 `.venv` 由根目錄的 uv 設定統一管理；API 示範直接在瀏覽器 Console 執行，不需要 npm。不同研究批次請使用不同輸出目錄，避免覆寫報告。

Git 設定、Python 環境設定及 `.github/workflows/` 留在根層。GitHub Pages 仍使用 `v*` tag 觸發，建置入口更新至 `legacy/calendar/`。本機擷取、報告、環境檔與憑證不提交。

本次三區整理紀錄見 [搬移清單](legacy/reorganization-three-areas-2026-10-07.json)，先前整理紀錄保留於 `legacy/archive/`。
