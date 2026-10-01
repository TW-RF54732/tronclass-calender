"""把 bookmarklet 原始碼編入靜態安裝頁，可從 Git tags 重建歷史版本。"""

import argparse
import json
import re
import subprocess
from html import escape
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent
TEMPLATE = (ROOT / "site-template.html").read_text(encoding="utf-8")
TAG_PATTERN = re.compile(r"v[A-Za-z0-9._-]*\Z")


def git(*args):
    return subprocess.check_output(
        ["git", *args], cwd=ROOT, text=True, encoding="utf-8"
    ).strip()


def bookmarklet_url(source):
    return "javascript:" + quote(source, safe="")


def write_page(output, source, version, releases, prefix=""):
    output.mkdir(parents=True, exist_ok=True)
    url = bookmarklet_url(source)
    links = "".join(
        f'<a href="{escape(prefix + release["path"], quote=True)}">{escape(release["version"])}</a>'
        for release in releases
    ) or "<span>尚無發布版本</span>"
    replacements = {
        "__BOOKMARKLET__": escape(url, quote=True),
        "__CODE__": escape(url),
        "__VERSION__": escape(version),
        "__VERSIONS__": links,
    }
    page = TEMPLATE
    for placeholder, value in replacements.items():
        page = page.replace(placeholder, value)
    (output / "index.html").write_text(page, encoding="utf-8")
    (output / "install-bookmarklet.html").write_text(page, encoding="utf-8")
    (output / "bookmarklet.txt").write_text(url + "\n", encoding="utf-8")


def build(output, version, include_tags=False):
    if version != "開發版" and not TAG_PATTERN.fullmatch(version):
        raise ValueError("版本 tag 請使用 v 開頭的英文、數字、句點、底線或連字號，例如 v1.0.0")
    source = (ROOT / "bookmarklet.js").read_text(encoding="utf-8")
    releases = []
    snapshots = {}
    if include_tags:
        for tag in git("tag", "--list", "v*", "--sort=-version:refname").splitlines():
            if not TAG_PATTERN.fullmatch(tag):
                print(f"Skip unsupported tag name: {tag}")
                continue
            # 尚未有 bookmarklet.js 的早期 tag 不列為可安裝版本。
            files = git("ls-tree", "--name-only", tag, "bookmarklet.js").splitlines()
            if "bookmarklet.js" not in files:
                continue
            snapshots[tag] = git("show", f"{tag}:bookmarklet.js") + "\n"
            releases.append({
                "version": tag,
                "path": f"releases/{tag}/",
                "commit": git("rev-parse", f"{tag}^{{commit}}"),
                "sourceCommittedAt": git("log", "-1", "--format=%cI", f"{tag}^{{commit}}"),
            })
        if version not in snapshots:
            raise ValueError(f"找不到 {version} 的 bookmarklet.js；請確認 tag 已建立且包含原始碼")
        # 首頁永遠編入觸發部署的 tag 原始碼。
        source = snapshots[version]
    write_page(output, source, version, releases)
    for release in releases:
        write_page(output / release["path"], snapshots[release["version"]], release["version"], releases, "../../")
    manifest = {
        "schemaVersion": 1,
        "latest": version,
        "releases": releases,
    }
    (output / "versions.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (output / ".nojekyll").write_text("", encoding="utf-8")
    print(f"Built {version}: {output} ({len(releases)} archived releases)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT)
    parser.add_argument("--version", default="開發版")
    parser.add_argument("--include-tags", action="store_true")
    args = parser.parse_args()
    build(args.output.resolve(), args.version, args.include_tags)
