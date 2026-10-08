import { authenticated, loginCookie, logoutCookie, sameSecret } from "./auth";
import { selected } from "./calendar";
import type { Env } from "./types";
export { CalendarStore } from "./store";

const securityHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'",
};
function secure(response: Response): Response {
  const result = new Response(response.body, response);
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (name !== "Cache-Control" || !result.headers.has(name)) result.headers.set(name, value);
  }
  return result;
}
function store(env: Env): DurableObjectStub { return env.CALENDAR.get(env.CALENDAR.idFromName("personal-calendar")); }
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") && request.method === "POST" && request.headers.get("Origin") !== url.origin) return Response.json({ error: "要求必須來自同源網頁。" }, { status: 403 });
  if (url.pathname === "/api/login" && request.method === "POST") {
    if (!env.WEB_ACCESS_KEY) return Response.json({ error: "尚未設定網頁密鑰。" }, { status: 503 });
    if (!request.headers.get("Content-Type")?.startsWith("application/json")) return Response.json({ error: "請使用 JSON。" }, { status: 415 });
    if (Number(request.headers.get("Content-Length")) > 4096) return Response.json({ error: "請求過大。" }, { status: 413 });
    // Streaming limit also covers requests with absent or dishonest Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "缺少密鑰。" }, { status: 400 });
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return Response.json({ error: "請求過大。" }, { status: 413 }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let key: unknown;
    try { key = JSON.parse(new TextDecoder().decode(bytes))?.key; } catch { return Response.json({ error: "JSON 格式錯誤。" }, { status: 400 }); }
    if (typeof key !== "string" || !await sameSecret(key, env.WEB_ACCESS_KEY)) return Response.json({ error: "密鑰錯誤。" }, { status: 401 });
    return Response.json({ ok: true }, { headers: { "Set-Cookie": await loginCookie(env.WEB_ACCESS_KEY) } });
  }
  if (url.pathname === "/api/logout" && request.method === "POST") return Response.json({ ok: true }, { headers: { "Set-Cookie": logoutCookie() } });
  const calendar = /^\/calendar\/([A-Za-z0-9_-]+)\.ics$/.exec(url.pathname);
  if (calendar && request.method === "GET") {
    if (!env.CALENDAR_TOKEN || !await sameSecret(calendar[1], env.CALENDAR_TOKEN)) return new Response("Not found", { status: 404 });
    return store(env).fetch(new Request(`https://calendar.internal/calendar${url.search}`, { headers: { "If-None-Match": request.headers.get("If-None-Match") ?? "" } }));
  }
  if (url.pathname.startsWith("/api/")) {
    if (!await authenticated(request, env.WEB_ACCESS_KEY)) return Response.json({ error: "請先登入。" }, { status: 401 });
    const paths: Record<string, { method: string; path: string }> = {
      "/api/status": { method: "GET", path: "/status" },
      "/api/activities": { method: "GET", path: "/activities" },
      "/api/sync": { method: "POST", path: "/sync" },
    };
    if (url.pathname === "/api/subscription-url" && request.method === "GET") {
      if (!/^[A-Za-z0-9_-]+$/.test(env.CALENDAR_TOKEN ?? "")) return Response.json({ error: "請設定 URL-safe 訂閱 token。" }, { status: 503 });
      const subscription = new URL(`/calendar/${env.CALENDAR_TOKEN}.ics`, url.origin);
      subscription.protocol = "https:";
      for (const key of ["courses", "types"]) {
        const values = selected(url.searchParams, key);
        if (values) subscription.searchParams.set(key, [...values].sort().join(","));
      }
      return Response.json({ https: subscription.href, webcal: subscription.href.replace(/^https:/, "webcal:") });
    }
    const path = paths[url.pathname];
    if (!path) return Response.json({ error: "Not found" }, { status: 404 });
    if (request.method !== path.method) return new Response("Method not allowed", { status: 405, headers: { Allow: path.method } });
    return store(env).fetch(new Request(`https://calendar.internal${path.path}${url.search}`, { method: request.method }));
  }
  if (url.pathname.startsWith("/calendar/")) return new Response("Not found", { status: 404 });
  return env.ASSETS.fetch(request);
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return secure(await route(request, env)); }
    catch { return secure(Response.json({ error: "服務暫時無法處理請求，請檢查設定。" }, { status: 503 })); }
  },
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await store(env).fetch(new Request("https://calendar.internal/tick", { method: "POST" }));
  },
} satisfies ExportedHandler<Env>;
