import { test, expect } from "@playwright/test";
const baseActivity = { id: 9, course_id: 7, course_name: "中文程式設計與資料結構", source: "activities", type: "homework", title: "第一次作業", start_time: "2026-10-01T08:00:00Z", deadline: "2026-10-03T15:59:00Z", url: "https://eclass.yuntech.edu.tw/course/7/learning-activity#/9", description: '<p onclick="window.pwned=1">安全段落 <strong>重點</strong></p><script>window.pwned=1</script><iframe src="https://evil.example"></iframe><img src=x onerror="window.pwned=1" alt="圖片替代文字"><a href="javascript:window.pwned=1">危險連結</a><a href="/course/7">安全連結</a><svg onload="window.pwned=1"></svg><a href="mailto:test@example.com">Email</a>' };
test("mobile filters, fixed subscription URLs, untimed detail and safe HTML", async ({ page }) => {
  let loggedIn = false;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === "/api/login") { loggedIn = true; await route.fulfill({ json: { ok: true } }); return; }
    if (path === "/api/logout") { loggedIn = false; await route.fulfill({ json: { ok: true } }); return; }
    if (!loggedIn) { await route.fulfill({ status: 401, json: { error: "請先登入。" } }); return; }
    if (path === "/api/status") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", lastAttempt: "2026-10-08T00:00:00Z", lastCompleteSuccess: null, stale: true, intervalMinutes: 30, lastError: "部分來源失敗", sources: [{ source: "exam-list", course_name: "中文程式設計", error: "上游 HTTP 500", updatedAt: "2026-10-07T00:00:00Z" }], progress: { total: 3, done: 3 }, job: null } });
    else if (path === "/api/activities") await route.fulfill({ json: { publishedAt: "2026-10-08T00:00:00Z", courses: [{ id: 7, name: baseActivity.course_name }], calendarEvents: [{ uid: "c7-activities-9-main@tronclass-calendar", start: baseActivity.start_time, end: baseActivity.deadline, allDay: false }], activities: [baseActivity, { ...baseActivity, id: 10, title: "無時間教材", type: "material", start_time: null, deadline: null }] } });
    else if (path === "/api/subscription-url") {
      const href = `https://calendar.example/calendar/fixture-token.ics?${url.searchParams}`;
      await route.fulfill({ json: { https: href, webcal: href.replace(/^https:/, "webcal:") } });
    } else await route.fulfill({ status: 202, json: { jobId: "fixture" } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "登入個人行事曆" })).toBeVisible();
  await page.getByLabel("網頁密鑰", { exact: true }).fill("fixture-key");
  await page.getByRole("button", { name: "登入", exact: true }).click();
  await expect(page.locator("#calendar-view")).toBeVisible();
  await page.getByRole("button", { name: "列表", exact: true }).click();
  await expect(page.locator(".activity")).toHaveCount(2);
  await expect(page.locator("#status")).toContainText("資料已過期");
  await expect(page.locator("#sources")).toContainText("HTTP 500");
  await page.locator("#activities").getByText("第一次作業", { exact: true }).click();
  await expect(page.locator(".description").first()).toContainText("安全段落 重點");
  await expect(page.locator(".description").first()).toContainText("圖片替代文字");
  expect(await page.evaluate(() => (globalThis as any).pwned)).toBeUndefined();
  expect(await page.locator(".description script,.description iframe,.description img,.description svg,.description [onclick],.description [onerror]").count()).toBe(0);
  expect(await page.getByText("危險連結", { exact: true }).first().getAttribute("href")).toBeNull();
  await expect(page.getByText("安全連結", { exact: true }).first()).toHaveAttribute("href", "https://eclass.yuntech.edu.tw/course/7");
  expect(await page.evaluate(() => { const browser = globalThis as any; return browser.document.documentElement.scrollWidth <= browser.innerWidth; })).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
  const subscription = await page.locator("#subscription").inputValue();
  await page.locator(".sidebar-group > summary").click();
  await page.getByLabel("搜尋標題或課程").fill("無時間");
  await expect(page.locator(".activity")).toHaveCount(1);
  await expect(page.locator(".activity")).toContainText("無時間活動");
  expect(await page.locator("#subscription").inputValue()).toBe(subscription);
  await page.getByLabel("教材", { exact: true }).uncheck();
  await expect(page.locator(".activity")).toHaveCount(0);
  await expect.poll(async () => new URL(await page.locator("#subscription").inputValue()).searchParams.get("types")).toBe("homework");
  await page.getByRole("button", { name: "全選", exact: true }).click();
  await expect(page.locator(".activity")).toHaveCount(2);
  await page.getByRole("button", { name: "登出", exact: true }).click();
  await expect(page.locator("#login-panel")).toBeVisible();
  expect(await page.locator("#subscription").inputValue()).toBe("");
  expect(errors).toEqual([]);
});
