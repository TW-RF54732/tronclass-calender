import { env } from "cloudflare:workers";
import { SELF, reset, runDurableObjectAlarm, runInDurableObject, evictDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticated, loginCookie } from "../src/auth";
import type { CalendarStore } from "../src/store";
import { fetchPage, latestCourses } from "../src/upstream";
import { activity, course, upstreamFixture } from "./fixtures";

afterEach(async () => { vi.restoreAllMocks(); await reset(); });
function stub(name = crypto.randomUUID()) { return env.CALENDAR.get(env.CALENDAR.idFromName(name)); }
async function get(store: DurableObjectStub, path: string) { return (await store.fetch(`https://internal${path}`)).json() as Promise<any>; }
async function trigger(store: DurableObjectStub) {
  const response = await store.fetch("https://internal/sync", { method: "POST" });
  return new Response(await response.arrayBuffer(), response);
}
async function finish(store: DurableObjectStub) { for (let i = 0; i < 10 && (await get(store, "/status")).job; i++) await runDurableObjectAlarm(store); }
function mock(options: Parameters<typeof upstreamFixture>[0] = {}) { return vi.spyOn(globalThis, "fetch").mockImplementation(upstreamFixture(options)); }
async function login() {
  const response = await SELF.fetch("https://calendar.example/api/login", { method: "POST", headers: { Origin: "https://calendar.example", "Content-Type": "application/json" }, body: JSON.stringify({ key: env.WEB_ACCESS_KEY }) });
  expect(response.status).toBe(200); return response.headers.get("Set-Cookie")!.split(";")[0];
}
describe("durable synchronization", () => {
  it("immediately starts first cron and joins concurrent manual requests", async () => {
    mock(); const store = stub();
    const responses = await Promise.all([store.fetch("https://internal/tick", { method: "POST" }), trigger(store), trigger(store)]);
    const jobs = await Promise.all(responses.map(r => r.json() as Promise<any>));
    expect(new Set(jobs.map(j => j.jobId)).size).toBe(1);
    await finish(store);
    expect((await get(store, "/activities")).activities).toHaveLength(2);
    expect((await store.fetch("https://internal/tick", { method: "POST" })).status).toBe(200);
  });
  it("selects maximum year after all course pages, deduplicates and gets all exam/activity pages", async () => {
    const seen: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async input => {
      const url = new URL(String(input)); seen.push(url.pathname);
      const page = Number(url.searchParams.get("page") ?? 1);
      if (url.pathname.endsWith("/courses")) return Response.json({ courses: page === 1 ? [course, { ...course, id: 8 }] : [{ ...course, academic_year_id: 114 }, { ...course, id: 8 }], pages: 2 });
      if (url.pathname.endsWith("/activities")) return Response.json({ activities: [{ ...activity, id: page + 20 }], pages: 2 });
      return Response.json({ exams: [{ ...activity, id: page + 20 }], pages: 2 });
    });
    const store = stub(); await trigger(store); await finish(store);
    const result = await get(store, "/activities");
    expect(result.courses.map((c: any) => c.id)).toEqual([7, 8]); expect(result.activities).toHaveLength(8);
    expect(result.calendarEvents).toHaveLength(16);
    expect(new Set(result.calendarEvents.map((e: any) => e.uid)).size).toBe(16);
    expect(seen.filter(p => p.endsWith("/courses"))).toHaveLength(2);
    expect(latestCourses([])).toEqual([]);
  });
  it("retains failed source, replaces successful sources and clears successful empty sources", async () => {
    const fetch = mock(); const store = stub(); await trigger(store); await finish(store);
    const first = await get(store, "/status");
    fetch.mockImplementation(upstreamFixture({ fail: "activities", title: "更新測驗" })); await trigger(store); await finish(store);
    const partial = await get(store, "/activities");
    expect(partial.activities.find((a: any) => a.source === "activities").title).toBe(activity.title);
    expect(partial.activities.find((a: any) => a.source === "exam-list").title).toBe("更新測驗");
    const status = await get(store, "/status");
    expect(status.lastCompleteSuccess).toBe(first.lastCompleteSuccess);
    expect(status.sources.find((s: any) => s.source === "activities").updatedAt).toBe(first.sources.find((s: any) => s.source === "activities").updatedAt);
    fetch.mockImplementation(upstreamFixture({ empty: "activities" })); await trigger(store); await finish(store);
    expect((await get(store, "/activities")).activities.map((a: any) => a.source)).toEqual(["exam-list"]);
  });
  it.each(["courses", "html", "redirect", "auth"])("keeps whole snapshot on %s failure", async failure => {
    const fetch = mock(); const store = stub(); await trigger(store); await finish(store);
    const before = await get(store, "/activities");
    if (failure === "courses") fetch.mockImplementation(upstreamFixture({ fail: "courses" }));
    else fetch.mockImplementation(async input => String(input).includes("/activities")
      ? failure === "html" ? new Response("<html>Login</html>", { headers: { "Content-Type": "text/html" } })
        : new Response(null, { status: failure === "auth" ? 401 : 302, headers: { Location: "https://eclass.yuntech.edu.tw/login" } })
      : upstreamFixture({ title: "不應發布" })(input));
    await trigger(store); await finish(store);
    expect(await get(store, "/activities")).toEqual(before);
    expect((await get(store, "/status")).lastError).toBeTruthy();
    expect((await store.fetch("https://internal/calendar")).status).toBe(200);
  });
  it("persists batches under 40 requests and resumes after eviction with idempotent alarms", async () => {
    const fetch = mock({ courses: Array.from({ length: 22 }, (_, i) => ({ ...course, id: i + 1 })) }); const store = stub();
    await trigger(store); await runDurableObjectAlarm(store);
    expect(fetch).toHaveBeenCalledTimes(40);
    expect((await get(store, "/status")).job.requests).toBe(40);
    const unavailable = await store.fetch("https://internal/calendar");
    expect(unavailable.status).toBe(503); await unavailable.text();
    await evictDurableObject(store); await finish(store);
    expect(fetch).toHaveBeenCalledTimes(45);
    const before = await get(store, "/activities");
    await runInDurableObject<CalendarStore, void>(store as DurableObjectStub<CalendarStore>, async instance => { await instance.alarm(); await instance.alarm(); });
    expect(await get(store, "/activities")).toEqual(before); expect(fetch).toHaveBeenCalledTimes(45);
  });
  it("does not publish partially fetched failed source pages", async () => {
    const fetch = mock({ examPages: 2 }); const store = stub(); await trigger(store); await finish(store);
    fetch.mockImplementation(async input => {
      const url = new URL(String(input));
      return url.pathname.endsWith("exam-list") && url.searchParams.get("page") === "2" ? new Response(null, { status: 500 }) : upstreamFixture({ title: "changed", examPages: 2 })(input);
    });
    await trigger(store); await finish(store);
    expect((await get(store, "/activities")).activities.filter((a: any) => a.source === "exam-list").map((a: any) => a.title)).toEqual([activity.title, activity.title]);
  });
  it("keeps UID/version/ETag stable on unchanged sync and changes versions on edits", async () => {
    const fetch = mock(); const store = stub(); await trigger(store); await finish(store);
    const first = await store.fetch("https://internal/calendar"); const body = await first.text(); const etag = first.headers.get("ETag")!;
    await trigger(store); await finish(store);
    expect(await (await store.fetch("https://internal/calendar")).text()).toBe(body);
    expect((await store.fetch("https://internal/calendar", { headers: { "If-None-Match": `W/${etag}` } })).status).toBe(304);
    fetch.mockImplementation(upstreamFixture({ title: "modified" })); await trigger(store); await finish(store);
    const changed = await store.fetch("https://internal/calendar");
    expect(changed.headers.get("ETag")).not.toBe(etag); expect(await changed.text()).toContain("SEQUENCE:1");
    const empty = await store.fetch("https://internal/calendar?courses="); expect(await empty.text()).not.toContain("BEGIN:VEVENT");
  });
  it("removes obsolete academic years and accepts an empty course list", async () => {
    const fetch = mock(); const store = stub(); await trigger(store); await finish(store);
    fetch.mockImplementation(upstreamFixture({ courses: [] })); await trigger(store); await finish(store);
    expect((await get(store, "/activities")).activities).toEqual([]);
    expect((await store.fetch("https://internal/calendar")).status).toBe(200);
  });
  it("upgrades stored spans to endpoint markers without fetching upstream; repeated upgrades are idempotent", async () => {
    const fetch = mock(); const store = stub(); await trigger(store); await finish(store);
    const before = await get(store, "/activities");
    const statusBefore = await get(store, "/status");
    await runInDurableObject<CalendarStore, void>(store as DurableObjectStub<CalendarStore>, (_instance, state) => {
      for (const row of state.storage.sql.exec<{ source: string; id: number; json: string }>("SELECT source,id,json FROM activities").toArray()) {
        const old = JSON.parse(row.json);
        old.url = old.url.replace("eclass.yuntech.edu.tw", "eclassa.yuntech.edu.tw");
        state.storage.sql.exec("UPDATE activities SET json=? WHERE source=? AND id=?", JSON.stringify(old), row.source, row.id);
      }
      const rows = state.storage.sql.exec<{ uid: string; json: string }>("SELECT uid,json FROM events WHERE active=1").toArray();
      state.storage.sql.exec("DELETE FROM events");
      for (const row of rows.filter(row => row.uid.includes("-start@"))) {
        const old = JSON.parse(row.json);
        old.uid = old.uid.replace("-start@", "-main@");
        old.start = "20261001"; old.end = "20261004";
        old.allDay = true; old.sequence = 5; old.modified = "2026-10-01T00:00:00.000Z";
        state.storage.sql.exec("INSERT INTO events (uid,json,active) VALUES (?,?,1)", old.uid, JSON.stringify(old));
      }
      state.storage.sql.exec("INSERT OR REPLACE INTO meta VALUES ('calendarFormatVersion','2')");
    });
    const requests = fetch.mock.calls.length;
    await evictDurableObject(store);
    const after = await get(store, "/activities");
    expect(after.calendarEvents.map((e: any) => e.uid)).toEqual(before.calendarEvents.map((e: any) => e.uid));
    expect(after.calendarEvents.every((e: any) => !e.allDay && Date.parse(e.end) - Date.parse(e.start) === 3_600_000)).toBe(true);
    expect(after.activities).toEqual(before.activities);
    expect(await get(store, "/status")).toEqual(statusBefore);
    const response = await store.fetch("https://internal/calendar");
    const body = await response.text(); const etag = response.headers.get("ETag");
    expect(body.match(/SEQUENCE:0/g)).toHaveLength(4);
    expect(body).not.toContain("-main@");
    expect(body).not.toContain("eclassa.yuntech.edu.tw");
    expect(body).toContain("URL:https://eclass.yuntech.edu.tw/course/");
    expect(body).toContain("DTEND");
    expect(body).not.toContain("VALUE=DATE");
    expect(fetch.mock.calls.length).toBe(requests);
    await evictDurableObject(store);
    const repeated = await store.fetch("https://internal/calendar");
    expect(repeated.headers.get("ETag")).toBe(etag); expect(await repeated.text()).toBe(body);
    expect(fetch.mock.calls.length).toBe(requests);
  });
});
describe("upstream failures", () => {
  it("aborts timeout and refuses malformed JSON / schemas", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("abort")))));
    const task = { key: "courses", source: "courses" as const, page: 1 };
    await expect(fetchPage(task, env, 5)).rejects.toThrow("逾時");
    vi.mocked(fetch).mockResolvedValue(new Response("not-json")); await expect(fetchPage(task, env)).rejects.toThrow("JSON");
    vi.mocked(fetch).mockResolvedValue(Response.json({ courses: [], pages: -1 })); await expect(fetchPage(task, env)).rejects.toThrow("分頁");
    vi.mocked(fetch).mockResolvedValue(Response.json({ courses: [{ id: 0 }], pages: 1 })); await expect(fetchPage(task, env)).rejects.toThrow("識別");
  });
});
describe("authentication and HTTP routes", () => {
  it("requires login on every private API and a separate subscription token", async () => {
    for (const path of ["activities", "status", "subscription-url"]) expect((await SELF.fetch(`https://calendar.example/api/${path}`)).status).toBe(401);
    expect((await SELF.fetch("https://calendar.example/api/sync", { method: "POST", headers: { Origin: "https://calendar.example" } })).status).toBe(401);
    expect((await SELF.fetch("https://calendar.example/calendar/fixture-web-key.ics")).status).toBe(404);
    expect((await SELF.fetch("https://calendar.example/calendar/fixture-calendar-token.ics")).status).toBe(503);
  });
  it("logs in, signs seven-day secure cookies, rejects tampering/expiry, and clears on logout", async () => {
    const cookie = await login(); expect(await authenticated(new Request("https://calendar.example", { headers: { Cookie: cookie } }), env.WEB_ACCESS_KEY)).toBe(true);
    expect(await authenticated(new Request("https://calendar.example", { headers: { Cookie: cookie + "bad" } }), env.WEB_ACCESS_KEY)).toBe(false);
    const expired = await loginCookie(env.WEB_ACCESS_KEY, Date.now() - 8 * 86400_000);
    expect(expired).toContain("HttpOnly; Secure; SameSite=Strict"); expect(expired).toContain("Max-Age=604800");
    expect(await authenticated(new Request("https://calendar.example", { headers: { Cookie: expired } }), env.WEB_ACCESS_KEY)).toBe(false);
    expect((await SELF.fetch("https://calendar.example/api/status", { headers: { Cookie: cookie } })).status).toBe(200);
    const logout = await SELF.fetch("https://calendar.example/api/logout", { method: "POST", headers: { Cookie: cookie, Origin: "https://calendar.example" } });
    expect(logout.headers.get("Set-Cookie")).toContain("Max-Age=0");
  });
  it("rejects cross-origin writes and incorrect keys", async () => {
    expect((await SELF.fetch("https://calendar.example/api/login", { method: "POST" })).status).toBe(403);
    const response = await SELF.fetch("https://calendar.example/api/login", { method: "POST", headers: { Origin: "https://calendar.example", "Content-Type": "application/json" }, body: '{"key":"bad"}' });
    expect(response.status).toBe(401);
    const cookie = await login();
    expect((await SELF.fetch("https://calendar.example/api/sync", { method: "POST", headers: { Cookie: cookie, Origin: "https://evil.example" } })).status).toBe(403);
  });
  it("returns fixed HTTPS/webcal filter URLs including explicit empty selections", async () => {
    const cookie = await login();
    const response = await SELF.fetch("https://calendar.example/api/subscription-url?courses=8,7&types=", { headers: { Cookie: cookie } });
    const result = await response.json() as any;
    const url = new URL(result.https); expect(url.searchParams.get("courses")).toBe("7,8"); expect(url.searchParams.get("types")).toBe(""); expect(result.webcal).toMatch(/^webcal:/);
    expect(response.headers.get("Cache-Control")).toContain("no-store"); expect(result.https).not.toContain(env.WEB_ACCESS_KEY);
  });
  it("serves snapshots on the public token route with ETag and never fetches upstream on reads", async () => {
    const fetch = mock(); const store = stub("personal-calendar"); await trigger(store); await finish(store); const count = fetch.mock.calls.length;
    const response = await SELF.fetch("https://calendar.example/calendar/fixture-calendar-token.ics?types=exam");
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("private, no-cache");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer"); const body = await response.text(); expect(body).not.toContain("-activities-"); expect(body).not.toContain(env.TRONCLASS_SESSION_ID);
    const cached = await SELF.fetch("https://calendar.example/calendar/fixture-calendar-token.ics?types=exam", { headers: { "If-None-Match": response.headers.get("ETag")! } }); expect(cached.status).toBe(304);
    const cookie = await login(); await SELF.fetch("https://calendar.example/api/activities", { headers: { Cookie: cookie } });
    expect(fetch.mock.calls.length).toBe(count);
  });
});
