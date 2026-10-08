# API 分析

整理 TronClass PC 與 mobile 的 API 擷取、逆向結論及可用示範，供 bookmarklet 與 service 開發參考。

[手機 API 示範](elcassa/scripts/README.md) 是本區的重要開發參考，包含單端點請求及完整資料流程；請依腳本說明確認認證與尚未驗證的限制。

## 目錄

| 路徑 | 內容 |
| --- | --- |
| `eclass/scripts/` | 桌面平台探測腳本 |
| `eclass/notes/` | 桌面平台分析筆記 |
| [elcassa/scripts/](elcassa/scripts/README.md) | 手機 API 示範，使用手動 X-SESSION-ID |
| `elcassa/notes/` | API 比較結論與研究紀錄 |
| `elcassa/captures/` | 本機原始 HTTP 與 JSON 擷取 |
| `elcassa/reports/` | 本機衍生報告；研究摘要以 notes 為主 |
| `elcassa/compare.py` | JSON 比較工具 |
| `elcassa/format_json.py` | JSON 格式化工具 |

## 研究環境

在專案根目錄執行 `uv sync`，使用 Python 3.12 與根目錄的 `.venv`。API 示範直接貼到瀏覽器 Console 執行。

## 分析筆記

- [課程列表](elcassa/notes/get-courses-api-comparison.md)
- [課程活動](elcassa/notes/get-activities-api-comparison.md)
- [測驗列表與設定](elcassa/notes/get-exams-api-comparison.md)
- [請求標頭結構比較](elcassa/notes/request-headers-comparison.md)
- [研究紀錄](elcassa/notes/research-log.md)

## 比較 JSON

在專案根目錄執行，例如比較測驗列表：

```bash
uv run python analyze/elcassa/compare.py \
  analyze/elcassa/captures/get_exams/PC.txt \
  analyze/elcassa/captures/get_exams/mobile.txt \
  --out analyze/elcassa/reports/get_exams
```

先看輸出目錄的 `summary.md`；完整差異在 `diff.json`，縮排資料與欄位結構分別在 `*.pretty.json`、`*.schema.json`。

工具支援純 JSON 與含 JSON body 的 HTTP 記錄；物件陣列以唯一 `id` 配對，其他陣列依索引比較。相同輸出目錄會覆寫報告，要保留不同批次請更換 `--out`。

原始擷取與報告由 Git 忽略，可能含驗證資訊及個資；可提交的分析結論放在各研究目錄的 `notes/`。

格式化 JSON：

```sh
uv run python analyze/elcassa/format_json.py
```
