# TronClass

同一個版本庫包含 Cloudflare 服務、持續維護的 bookmarklet，以及 API 研究資料。

```text
service/                Cloudflare Workers 個人行事曆訂閱服務
bookmarklet/            日曆 bookmarklet、userscript 與安裝網站
  src/                  原始碼
  templates/            安裝頁模板
  public/               產生的靜態安裝頁
  tools/                建置與歷史版本發布工具
analyze/                研究資料與逆向成果
  eclass/               桌面平台探測腳本與筆記
  elcassa/              手機 API 腳本、筆記、比較工具與本機資料
```

[Cloudflare 服務](service/README.md) 提供活動網頁、定期同步與 ICS 訂閱，由使用者自行配置及部署。[Bookmarklet](bookmarklet/README.md) 持續維護與發布，在已登入的 TronClass 網頁中執行，另包含 userscript。

[API 示範](analyze/elcassa/scripts/README.md) 包含單端點請求與「課程 → 活動 → 測驗」完整流程，供服務開發參考。[研究導覽](analyze/README.md) 彙整筆記與工具用法。

## 研究環境

```sh
uv sync
uv run python analyze/elcassa/compare.py analyze/elcassa/captures/get_courses/PC analyze/elcassa/captures/get_courses/mobile --out analyze/elcassa/reports/new-comparison
uv run python analyze/elcassa/format_json.py
```

Python 3.12 與 `.venv` 由根目錄的 uv 設定統一管理；API 示範直接在瀏覽器 Console 執行。不同研究批次請使用不同輸出目錄，避免覆寫報告。

GitHub Pages 使用 `v*` tag 觸發，以 `bookmarklet/tools/build-bookmarklet.py` 建置安裝網站；建置工具保留歷史 tag 原始碼路徑的支援。本機擷取、報告、環境檔與憑證不提交。
