"""產生不依賴外部網站或套件的 bookmarklet 與安裝頁。"""

from html import escape
from pathlib import Path
from urllib.parse import quote

root = Path(__file__).resolve().parent
source = (root / "bookmarklet.js").read_text(encoding="utf-8")
bookmarklet = "javascript:" + quote(source, safe="")
(root / "bookmarklet.txt").write_text(bookmarklet + "\n", encoding="utf-8")

page = """<!doctype html>
<html lang="zh-Hant">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>雲科 TronClass 課程活動書籤</title>
<style>
  body { max-width:760px; margin:56px auto; padding:0 24px; font:16px/1.7 system-ui,sans-serif; color:#182a3b; background:#f6f8fb; }
  main { padding:28px; background:white; border:1px solid #dce4ed; border-radius:14px; }
  h1 { margin-top:0; font-size:26px; } h2 { font-size:18px; }
  .bookmark { display:inline-block; padding:12px 20px; background:#1667c7; color:#fff; border-radius:8px; text-decoration:none; font-weight:600; }
  textarea { width:100%; height:100px; box-sizing:border-box; padding:8px; border:1px solid #c5d2df; border-radius:6px; }
  button { padding:8px 14px; font:inherit; cursor:pointer; } .muted { color:#607184; }
</style>
<main>
  <h1>TronClass 課程活動</h1>
  <p>查看最新學年度的課程活動，複選活動類型，切換表格與月曆。</p>
  <p><a class="bookmark" href="__BOOKMARKLET__">雲科課程活動</a></p>
  <ol>
    <li>把上方「雲科課程活動」拖到瀏覽器的書籤列。</li>
    <li>開啟 <a href="https://eclass.yuntech.edu.tw" target="_blank" rel="noopener noreferrer">雲科 TronClass</a> 並登入。</li>
    <li>在 TronClass 網頁點擊書籤，開啟活動面板。</li>
  </ol>
  <p class="muted">所有時間顯示為台灣時間。課程查詢沿用 ongoing／notStarted 與最近開始的條件，抓完分頁後取最大的 academic_year_id。月曆顯示活動與評分時段的開始、截止、結束；沒有時間的活動可在表格查看。</p>
  <h2>手動建立書籤</h2>
  <p>新增一個書籤，名稱可填「雲科課程活動」，網址貼入以下完整內容（包含 javascript:）。</p>
  <textarea id="code" readonly aria-label="完整書籤網址" spellcheck="false">__CODE__</textarea>
  <button id="copy" type="button">複製書籤網址</button>
  <span id="status" role="status"></span>
</main>
<script>
  document.getElementById('copy').addEventListener('click', async () => {
    const code = document.getElementById('code');
    code.focus();
    code.select();
    try {
      await navigator.clipboard.writeText(code.value);
      document.getElementById('status').textContent = '已複製';
    } catch {
      document.getElementById('status').textContent = '內容已選取，請按 Ctrl+C（Mac：⌘C）複製。';
    }
  });
</script>
</html>
"""
page = page.replace("__BOOKMARKLET__", escape(bookmarklet, quote=True)).replace("__CODE__", escape(bookmarklet))
(root / "install-bookmarklet.html").write_text(page, encoding="utf-8")
print("Generated bookmarklet.txt and install-bookmarklet.html")
