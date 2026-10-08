import { test, expect } from "@playwright/test";
import { eventsForActivity } from "../../src/calendar";
import type { Activity } from "../../src/types";
const base: Activity = { id: 9, course_id: 7, course_name: "中文程式設計", source: "activities", type: "homework", title: "跨日作業", description: "<p>作業詳情</p>", url: "https://eclass.yuntech.edu.tw/course/7/learning-activity#/9", start_time: "2026-10-01T08:00:00Z", deadline: "2026-10-03T15:59:00Z", end_time: "2026-10-04T16:30:00Z" };
const activities: Activity[] = [
  base,
  { ...base, title: "午夜結束測驗", source: "exam-list", type: "exam", start_time: "2026-10-04T16:00:00Z", deadline: null, end_time: "2026-10-05T16:00:00Z", url: "https://eclass.yuntech.edu.tw/course/7/exam#/9" },
  { ...base, id: 10, title: "無時間教材", type: "material", start_time: null, deadline: null, end_time: null },
  { ...base, id: 11, title: "只有互評的活動", start_time: null, deadline: null, end_time: null, inter_score_map: { start_time: "2026-10-06T16:00:00Z", end_time: "2026-10-07T16:00:00Z" } },
  { ...base, id: 12, title: "凌晨發布教材", type: "material", start_time: "2026-10-07T16:30:00Z", deadline: null, end_time: null },
  ...[13, 14, 15].map(id => ({ ...base, id, title: `新增教材 ${id}`, type: "material", start_time: "2026-10-08T01:00:00Z", deadline: null, end_time: null })),
];
const calendarEvents = activities.flatMap(activity => eventsForActivity(activity).events).map(({ uid, start, end, allDay, durationMs }) => ({ uid, start, end, allDay, durationMs }));
for (const width of [390, 1280]) {
  test(`${width}px dark default month, navigation, Taipei periods, details and shared filters`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: "light" });
    await page.clock.install({ time: new Date("2026-10-08T01:00:00Z") });
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/status") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", lastAttempt: "2026-10-08T00:00:00Z", lastCompleteSuccess: "2026-10-08T00:00:00Z", intervalMinutes: 30, stale: false, sources: [], job: null } });
      else if (url.pathname === "/api/activities") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", courses: [{ id: 7, name: base.course_name }], activities, calendarEvents } });
      else if (url.pathname === "/api/subscription-url") await route.fulfill({ json: { https: `https://calendar.example/calendar/token.ics?${url.searchParams}`, webcal: `webcal://calendar.example/calendar/token.ics?${url.searchParams}` } });
      else await route.fulfill({ json: { ok: true } });
    });
    await page.goto("/");
    await expect(page.locator("#view-calendar")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#list-view")).toBeHidden();
    await expect(page.locator("#month-title")).toHaveText("2026 年 10 月");
    await expect(page.locator(".calendar-day")).toHaveCount(42);
    await page.screenshot({ path: `test-results/calendar-default-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => { const browser = globalThis as any; return browser.getComputedStyle(browser.document.documentElement).backgroundColor; })).toBe("rgb(17, 17, 19)");
    const day = (key: string) => page.locator(`.calendar-day[data-date="${key}"]`);
    await expect(day("2026-10-08").locator(".date-button")).toHaveAttribute("aria-current", "date");
    for (const key of ["2026-10-01", "2026-10-03"]) await expect(day(key)).toContainText("跨日作業");
    await expect(day("2026-10-04")).not.toContainText("跨日作業");
    await expect(day("2026-10-02")).not.toContainText("跨日作業");
    await expect(day("2026-10-05")).not.toContainText("跨日作業");
    await expect(day("2026-10-05")).toContainText("午夜結束測驗");
    await expect(day("2026-10-06")).not.toContainText("午夜結束測驗");
    await expect(day("2026-10-07")).toContainText("只有互評的活動");
    await expect(day("2026-10-08")).not.toContainText("只有互評的活動");
    await expect(day("2026-10-08")).toContainText("凌晨發布教材");
    await expect(page.locator("#untimed-activities")).toContainText("無時間教材");
    await expect(page.locator("#untimed-activities")).not.toContainText("只有互評的活動");
    await day("2026-10-03").locator(".date-button").click();
    await expect(page.locator("#day-title")).toContainText("10 月 3 日");
    await expect(page.locator("#day-activities")).toContainText("截止");
    await day("2026-10-03").getByRole("button", { name: /截止.*跨日作業/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator("#detail-title")).toHaveText("跨日作業");
    await expect(page.locator("#detail-content")).toContainText("2026-10-04T16:30:00Z");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "下一個月" }).click();
    await expect(page.locator("#month-title")).toHaveText("2026 年 11 月");
    await page.getByRole("button", { name: "上一個月" }).click();
    await expect(page.locator("#month-title")).toHaveText("2026 年 10 月");
    await page.getByRole("button", { name: "今天", exact: true }).click();
    await expect(page.locator("#day-title")).toContainText("10 月 8 日");
    await day("2026-10-08").getByRole("button", { name: "2026-10-08 查看全部 4 個活動時段" }).click();
    await expect(page.locator("#day-activities .agenda-item")).toHaveCount(4);
    await expect(page.locator("#day-activities")).toContainText("新增教材 15");
    const subscription = await page.locator("#subscription").inputValue();
    if (width < 760) await page.locator(".sidebar-group > summary").click();
    await page.getByLabel("搜尋標題或課程").fill("互評");
    await expect(page.locator(".calendar-event")).toHaveCount(2);
    await page.getByRole("button", { name: "列表", exact: true }).click();
    await expect(page.locator("#activities .activity")).toHaveCount(1);
    await expect(page.locator("#activities")).toContainText("只有互評的活動");
    expect(await page.locator("#subscription").inputValue()).toBe(subscription);
    await page.getByLabel("搜尋標題或課程").fill("");
    await page.getByLabel("測驗", { exact: true }).uncheck();
    await expect(page.locator("#activities .activity")).toHaveCount(7);
    await page.getByRole("button", { name: "月曆", exact: true }).click();
    await expect(page.locator(".calendar-event").filter({ hasText: "午夜結束測驗" })).toHaveCount(0);
    await expect.poll(async () => new URL(await page.locator("#subscription").inputValue()).searchParams.get("types")).toBe("homework,material");
    expect(await page.evaluate(() => { const browser = globalThis as any; return browser.document.documentElement.scrollWidth <= browser.innerWidth; })).toBe(true);
    await page.screenshot({ path: `test-results/calendar-${width}.png`, fullPage: true });
    // Empty selection remains empty in both views, including untimed activities.
    await page.getByLabel("中文程式設計", { exact: true }).uncheck();
    await expect(page.locator(".calendar-event")).toHaveCount(0);
    await expect(page.locator("#untimed-panel")).toBeHidden();
    await expect(page.locator("#day-activities")).toContainText("沒有符合篩選");
    await page.getByRole("button", { name: "列表", exact: true }).click();
    await expect(page.locator("#activities")).toContainText("沒有符合篩選的活動");
  });
}
