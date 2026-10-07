#!/usr/bin/env python3
"""Compare JSON or captured HTTP messages, using only the standard library."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
import sys


def read_payload(path):
    text = path.read_text(encoding='utf-8-sig').strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # These captures label their JSON payload with Requested:.
        if 'Requested:' in text:
            return json.loads(text.split('Requested:', 1)[1].strip())
        # Also accept conventional HTTP headers followed by a JSON body.
        for separator in ('\r\n\r\n', '\n\n'):
            if separator in text:
                try:
                    return json.loads(text.split(separator, 1)[1].strip())
                except json.JSONDecodeError:
                    pass
        raise ValueError(f'{path}: 無法解析 JSON；請提供純 JSON 或含 JSON body 的 HTTP 記錄')


def kind(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'boolean'
    if isinstance(value, dict):
        return 'object'
    if isinstance(value, list):
        return 'array'
    if isinstance(value, str):
        return 'string'
    return 'number'


def field_path(path, key):
    return path + '[' + json.dumps(key, ensure_ascii=False) + ']'


def schema(value):
    types = defaultdict(set)
    counts = defaultdict(int)

    def visit(item, path):
        types[path].add(kind(item))
        counts[path] += 1
        if isinstance(item, dict):
            for key, child in item.items():
                visit(child, field_path(path, key))
        elif isinstance(item, list):
            for child in item:
                visit(child, path + '[]')

    visit(value, '$')
    return {path: {'types': sorted(types[path]), 'occurrences': counts[path]}
            for path in sorted(types)}


def compare(left, right, match_key):
    changes = []

    def record(category, path, **values):
        changes.append({'kind': category, 'path': path, **values})

    def indexed(items):
        if not items or not all(isinstance(x, dict) and match_key in x for x in items):
            return None
        keys = [json.dumps(x[match_key], sort_keys=True, ensure_ascii=False) for x in items]
        if len(set(keys)) != len(keys):
            return None
        return dict(zip(keys, items))

    def visit(a, b, path):
        if kind(a) != kind(b):
            record('type_changed', path, left=a, right=b)
        elif isinstance(a, dict):
            for key in sorted(a.keys() | b.keys()):
                child = field_path(path, key)
                if key not in b:
                    record('left_only', child, left=a[key])
                elif key not in a:
                    record('right_only', child, right=b[key])
                else:
                    visit(a[key], b[key], child)
        elif isinstance(a, list):
            ai, bi = indexed(a), indexed(b)
            if ai is not None and bi is not None:
                for key in sorted(ai.keys() | bi.keys()):
                    child = f'{path}[{match_key}={key}]'
                    if key not in bi:
                        record('left_only', child, left=ai[key])
                    elif key not in ai:
                        record('right_only', child, right=bi[key])
                    else:
                        visit(ai[key], bi[key], child)
            else:
                for i in range(max(len(a), len(b))):
                    child = f'{path}[{i}]'
                    if i >= len(b):
                        record('left_only', child, left=a[i])
                    elif i >= len(a):
                        record('right_only', child, right=b[i])
                    else:
                        visit(a[i], b[i], child)
        elif a != b:
            record('value_changed', path, left=a, right=b)

    visit(left, right, '$')
    return changes


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description='整理並比較大型 JSON，支援 HTTP 記錄')
    parser.add_argument('left', nargs='?', type=Path, default=Path(__file__).resolve().parent / 'captures' / 'get_courses' / 'PC')
    parser.add_argument('right', nargs='?', type=Path, default=Path(__file__).resolve().parent / 'captures' / 'get_courses' / 'mobile')
    parser.add_argument('--out', type=Path, default=Path(__file__).parent / 'reports')
    parser.add_argument('--match-key', default='id', help='物件陣列配對欄位，預設 id')
    args = parser.parse_args()
    try:
        left, right = read_payload(args.left), read_payload(args.right)
    except (OSError, ValueError) as error:
        parser.exit(2, f'{error}\n')
    args.out.mkdir(parents=True, exist_ok=True)
    ls, rs = schema(left), schema(right)
    changes = compare(left, right, args.match_key)
    for name, value in [('left.pretty', left), ('right.pretty', right),
                        ('left.schema', ls), ('right.schema', rs), ('diff', changes)]:
        write_json(args.out / (name + '.json'), value)
    counts = {k: sum(c['kind'] == k for c in changes)
              for k in ('left_only', 'right_only', 'type_changed', 'value_changed')}
    lines = ['# JSON 比較報告', '', f'左側：{args.left.name}；右側：{args.right.name}', '',
             f'差異共 {len(changes)} 筆：' + '、'.join(f'{k}={v}' for k, v in counts.items()), '',
             f'物件陣列以唯一 `{args.match_key}` 配對；無法配對時依索引比較。', '',
             '## 欄位結構差異', '']
    for title, paths in [('僅左側有的欄位', ls.keys() - rs.keys()),
                         ('僅右側有的欄位', rs.keys() - ls.keys())]:
        lines += [f'### {title}', ''] + [f'- `{p}`' for p in sorted(paths)] + ['']
    lines += ['### 型別集合不同的欄位', '']
    lines += [f'- `{p}`：{ls[p]["types"]} → {rs[p]["types"]}'
              for p in sorted(ls.keys() & rs.keys()) if ls[p]['types'] != rs[p]['types']]
    lines += ['', '## 逐筆差異', '', '完整值請見 diff.json；以下預覽每個值最多 160 字。', '']
    for c in changes:
        lines += [f'### {c["kind"]}: `{c["path"]}`', '']
        for side in ('left', 'right'):
            if side in c:
                preview = json.dumps(c[side], ensure_ascii=False)
                if len(preview) > 160:
                    preview = preview[:160] + '…'
                lines += [side + ':', '```text', preview, '```', '']
    (args.out / 'summary.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'差異共 {len(changes)} 筆：{counts}')
    print(f'報告：{args.out / "summary.md"}')


if __name__ == '__main__':
    main()
