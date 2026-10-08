import { test, expect } from "@playwright/test";
import { eventsForActivity } from "../../src/calendar";
import type { Activity } from "../../src/types";

test("short periods appear above long periods in month cells, day agenda and activity list", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-08T01:00:00Z") });
  const base: Activity = { id: 1, course_id: 7, course_name: "測試課程", source: "activities", type: "homework", title: "長時段", description: "", url: "https://eclass.yuntech.edu.tw/course/7/learning-activity#/1", start_time: "2026-10-01T00:00:00Z", deadline: "2026-10-30T00:00:00Z" };
  const activities: Activity[] = [
    { ...base, inter_score_map: { start_time: "2026-10-09T00:00:00Z", end_time: "2026-10-09T00:05:00Z" } },
    { ...base, id: 2, title: "中時段", start_time: "2026-10-07T16:00:00Z", deadline: "2026-10-08T16:00:00Z" },
    { ...base, id: 3, title: "短時段", start_time: "2026-10-08T05:00:00Z", deadline: "2026-10-08T07:00:00Z" },
    { ...base, id: 4, title: "單一時間", start_time: "2026-10-08T01:00:00Z", deadline: null },
    { ...base, id: 5, title: "無時間", start_time: null, deadline: null },
    { ...base, id: 6, title: "只有互評", start_time: null, deadline: null, inter_score_map: { start_time: "2026-10-08T02:00:00Z", end_time: "2026-10-08T05:00:00Z" } },
    { ...base, id: 7, title: "25 小時橫跨三天", start_time: "2026-10-07T15:30:00Z", deadline: "2026-10-08T16:30:00Z" },
    { ...base, id: 8, title: "47 小時橫跨兩天", start_time: "2026-10-07T16:00:00Z", deadline: "2026-10-09T15:00:00Z" },
  ];
  const calendarEvents = activities.flatMap(a => eventsForActivity(a).events).map(({ uid, start, end, allDay, durationMs }) => ({ uid, start, end, allDay, durationMs }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/status") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", intervalMinutes: 30, sources: [], job: null } });
    else if (url.pathname === "/api/activities") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", courses: [{ id: 7, name: base.course_name }], activities, calendarEvents } });
    else await route.fulfill({ json: { https: "https://calendar.example/calendar/token.ics", webcal: "webcal://calendar.example/calendar/token.ics" } });
  });
  await page.goto("/");
  await expect(page.locator('#month-grid [data-date="2026-10-08"] .event-title')).toHaveText(["單一時間", "短時段"]);
  await expect(page.locator('#month-grid [data-date="2026-10-08"] .event-role')).toHaveText(["開始", "開始"]);
  await expect(page.locator("#day-activities .agenda-title")).toHaveText(["單一時間 · 開始", "短時段 · 開始", "短時段 · 截止", "只有互評 · 互評開始", "只有互評 · 互評結束", "中時段 · 開始", "中時段 · 截止", "25 小時橫跨三天 · 開始", "25 小時橫跨三天 · 截止", "47 小時橫跨兩天 · 開始"]);
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await expect(page.locator("#activities .activity").filter({ has: page.locator(".title", { hasText: "短時段" }) }).locator(".activity-role")).toHaveText(["開始", "截止"]);
  await expect(page.locator("#activities .title")).toHaveText(["單一時間", "短時段", "只有互評", "中時段", "25 小時橫跨三天", "47 小時橫跨兩天", "長時段", "無時間"]);
});
