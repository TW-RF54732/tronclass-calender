#!/usr/bin/env python3
"""填入變數，或執行時貼上 JSON；不需要命令列參數。"""
import json
from pathlib import Path

# 可填入 JSON 字串、完整 HTTP 擷取文字，或 Python dict/list。
# 留為 None 時，執行程式後貼上內容，最後單獨輸入 END。
JSON_INPUT = None

# 設為 None 只顯示結果；填入路徑則同時存檔。
OUTPUT_PATH = None
# OUTPUT_PATH = Path(__file__).parent / 'captures' / 'structured' / 'formatted.json'


def format_json(value):
    """回傳縮排 JSON 字串，也可由其他程式 import 呼叫。"""
    if isinstance(value, str):
        text = value.strip().lstrip('\ufeff')
        try:
            value = json.loads(text)
        except json.JSONDecodeError:
            if 'Requested:' in text:
                value = json.loads(text.split('Requested:', 1)[1].strip())
            else:
                text = text.replace('\r\n', '\n')
                if '\n\n' not in text:
                    raise
                value = json.loads(text.split('\n\n', 1)[1].strip())
    return json.dumps(value, ensure_ascii=False, indent=2)


def read_runtime_input():
    print('貼上 JSON 或 HTTP 擷取文字，最後另起一行輸入 END：')
    lines = []
    while True:
        try:
            line = input()
        except EOFError:
            break
        if line == 'END':
            break
        lines.append(line)
    return '\n'.join(lines)


def main():
    value = JSON_INPUT if JSON_INPUT is not None else read_runtime_input()
    try:
        result = format_json(value)
        print(result)
        if OUTPUT_PATH is not None:
            output = Path(OUTPUT_PATH)
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(result + '\n', encoding='utf-8')
            print(f'已儲存：{output}')
    except (OSError, ValueError, TypeError) as error:
        print(f'無法格式化 JSON：{error}')
        raise SystemExit(1)


if __name__ == '__main__':
    main()
