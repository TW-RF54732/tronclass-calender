# 舊版設施

- [calendar/](calendar/README.md)：可繼續維護與發布的日曆 bookmarklet、userscript、安裝網站、模板及建置工具。
- `archive/desktop/`：歷史 Console 探測腳本、分析筆記與本機 API 樣本。
- `archive/reorganization-2026-10-07.json`：先前搬移紀錄，路徑是當時的歷史位置。

在專案根目錄預覽舊版：

```sh
uv run python legacy/calendar/tools/build-bookmarklet.py --output /tmp/tronclass-calendar-preview
```

GitHub Pages 發布流程保留於根目錄 `.github/workflows/pages.yml`，仍由 `v*` tag 觸發。建置工具同時支援目前與歷史 tag 的原始碼位置。

逆向後可用的新版 API 示範位於 [analyze/scripts](../analyze/scripts/README.md)，研究資料不放在此區。
