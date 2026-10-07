# 分析輸出

現有 `summary.md`、`diff.json`、pretty JSON 與 schema JSON 保留自整理前。

比較工具未指定 `--out` 時會覆寫此目錄的同名報告。保留歷次紀錄請指定新的子資料夾，例如：

```sh
python3 analyze/compare.py --out analyze/reports/2026-10-07-comparison
```

報告可能含個資，由 Git 忽略。
