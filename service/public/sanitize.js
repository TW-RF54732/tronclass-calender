// Same safe tags/protocols as legacy/calendar/src/bookmarklet.js.
export function renderDescription(html, document = globalThis.document) {
  const content = document.createElement("div");
  content.className = "description";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const allowed = new Set(["P", "DIV", "SPAN", "STRONG", "EM", "B", "I", "U", "S", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "H1", "H2", "H3", "H4", "A"]);
  const blocked = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "TEMPLATE"]);
  const copy = (source, destination) => {
    if (source.nodeType === 3) { destination.append(document.createTextNode(source.textContent)); return; }
    if (source.nodeType !== 1 || blocked.has(source.tagName)) return;
    if (source.tagName === "IMG") {
      if (source.getAttribute("alt")) destination.append(document.createTextNode(source.getAttribute("alt")));
      return;
    }
    if (!allowed.has(source.tagName)) { for (const child of source.childNodes) copy(child, destination); return; }
    const element = document.createElement(source.tagName.toLowerCase());
    if (source.tagName === "A") {
      try {
        const url = new URL(source.getAttribute("href") || "", "https://eclass.yuntech.edu.tw");
        if (url.hostname === "eclassa.yuntech.edu.tw") url.hostname = "eclass.yuntech.edu.tw";
        if (["https:", "http:", "mailto:"].includes(url.protocol)) {
          element.href = url.href; element.target = "_blank"; element.rel = "noopener noreferrer";
        }
      } catch { /* Keep link text when URL is invalid. */ }
    }
    for (const child of source.childNodes) copy(child, element);
    destination.append(element);
  };
  for (const child of parsed.body.childNodes) copy(child, content);
  if (!content.textContent.trim()) content.textContent = "此活動沒有說明。";
  return content;
}
