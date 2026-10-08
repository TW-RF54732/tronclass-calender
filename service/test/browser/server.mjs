import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const files = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"], "/month.js": ["month.js", "text/javascript"], "/sanitize.js": ["sanitize.js", "text/javascript"], "/styles.css": ["styles.css", "text/css"] };
createServer(async (request, response) => {
  const file = files[new URL(request.url, "http://localhost").pathname];
  if (!file) { response.writeHead(404); response.end(); return; }
  response.setHeader("Content-Type", file[1]);
  response.end(await readFile(new URL(`../../public/${file[0]}`, import.meta.url)));
}).listen(8789, "127.0.0.1");
