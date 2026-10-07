# API 分析

整理 TronClass PC 與 mobile 的 API 擷取，比較 JSON 結構與值，記錄對日曆工具的影響。

## 目錄

- `captures/`：原始 HTTP 與 JSON 擷取，依 API 分組。
- `reports/`：比較報告、格式化 JSON 與欄位結構。(棄用，資料摘要於notes)
- `notes/`：分析結論與研究筆記。
- `compare.py`：JSON 比較工具，只需 Python 3。
- [scripts/](scripts/README.md)：使用 eclassa URL 與手動 X-SESSION-ID 的 API 請求腳本。

## 分析筆記

- [課程列表](notes/get-courses-api-comparison.md)
- [課程活動](notes/get-activities-api-comparison.md)
- [測驗列表與設定](notes/get-exams-api-comparison.md)
- [請求標頭結構比較](notes/request-headers-comparison.md)
- [研究紀錄](notes/research-log.md)

## 比較 JSON

在專案根目錄執行，例如比較測驗列表：

```bash
python3 analyze/compare.py \
  analyze/captures/get_exams/PC.txt \
  analyze/captures/get_exams/mobile.txt \
  --out analyze/reports/get_exams
```

先看輸出目錄的 `summary.md`；完整差異在 `diff.json`，縮排資料與欄位結構分別在 `*.pretty.json`、`*.schema.json`。

工具支援純 JSON 與含 JSON body 的 HTTP 記錄；物件陣列以唯一 `id` 配對，其他陣列依索引比較。相同輸出目錄會覆寫報告，要保留不同批次請更換 `--out`。

原始擷取與報告由 Git 忽略，可能含驗證資訊及個資；可提交的分析結論放在 `notes/`。
