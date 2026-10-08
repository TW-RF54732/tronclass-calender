import { describe, expect, it } from "vitest";
import ICAL from "ical.js";
import { canonical, eventContent, eventsForActivity, foldLine, instant, matchesFilters, renderCalendar } from "../src/calendar";
import { intervalMinutes } from "../src/types";
import { normalize, upstreamUrl } from "../src/upstream";
import { activity, course } from "./fixtures";

describe("calendar semantics", () => {
  it("exports only start and deadline markers, deduplicating the end", () => {
    const events = eventsForActivity(activity).events;
    expect(events).toHaveLength(2);
    expect(events.map(e => e.start)).toEqual(["2026-10-01T08:00:00.000Z", "2026-10-03T14:59:00.000Z"]);
    expect(events.every(e => !e.allDay && Date.parse(e.end!) - Date.parse(e.start) === 3_600_000)).toBe(true);
  });
  it("names start and deadline events and uses deadline when end is on the same Taipei day", () => {
    const events = eventsForActivity({ ...activity, deadline: "2026-10-03T08:00:00Z", end_time: "2026-10-03T15:59:00Z" }).events;
    expect(events.map(e => e.summary)).toEqual([
      `[${activity.course_name}] ${activity.title} · 開始`,
      `[${activity.course_name}] ${activity.title} · 截止`,
    ]);
    expect(events[1].start).toBe("2026-10-03T07:00:00.000Z");
    expect(events[1].description).toContain("2026-10-03T15:59:00Z");
  });
  it.each(["start_time", "deadline", "end_time"] as const)("keeps a lone %s in a one-hour display slot", key => {
    const result = eventsForActivity({ ...activity, start_time: null, deadline: null, end_time: null, [key]: "2026-10-01T08:00:00Z" });
    expect(result.events).toHaveLength(1); expect(result.events[0].start).toBe(key === "start_time" ? "2026-10-01T08:00:00.000Z" : "2026-10-01T07:00:00.000Z"); expect(result.events[0].end).toBe(key === "start_time" ? "2026-10-01T09:00:00.000Z" : "2026-10-01T08:00:00.000Z");
  });
  it("uses end if no deadline and keeps untimed activity out of ICS", () => {
    expect(eventsForActivity({ ...activity, deadline: null }).events[1].end).toBe("2026-10-03T15:59:00.000Z");
    expect(eventsForActivity({ ...activity, start_time: null, deadline: null, end_time: null }).events).toEqual([]);
  });
  it("keeps a distinct end in details without adding another calendar event", () => {
    const result = eventsForActivity({ ...activity, end_time: "2026-12-31T16:30:00Z" });
    expect(result.events).toHaveLength(2);
    expect(result.events[1].description).toContain("2026-12-31T16:30:00Z");
  });
  it.each([
    ["2026-10-01T15:30:00Z", "2026-10-01T16:30:00Z"],
    ["2026-10-01T16:00:00Z", "2026-10-02T16:00:00Z"],
    ["2026-09-08T01:00:00Z", "2027-01-11T15:59:00Z"],
  ])("keeps short, midnight and semester spans confined to their endpoints (%s)", (start, deadline) => {
    const events = eventsForActivity({ ...activity, start_time: start, deadline, end_time: null }).events;
    events.forEach(e => { e.modified = "2026-10-08T00:00:00.000Z"; });
    const output = renderCalendar(events);
    expect(output).toContain("DTEND"); expect(output).not.toContain("VALUE=DATE");
    const parsed = new ICAL.Component(ICAL.parse(output)).getAllSubcomponents("vevent").map(e => new ICAL.Event(e));
    expect(parsed).toHaveLength(2);
    expect(parsed.every(e => !e.startDate.isDate)).toBe(true);
    expect(events[0].start).toBe(new Date(start).toISOString());
    expect(events[1].end).toBe(new Date(deadline).toISOString());
    expect(events.every(e => Date.parse(e.end!) - Date.parse(e.start) === 3_600_000)).toBe(true);
  });
  it("makes separate deadline and end markers without start", () => {
    expect(eventsForActivity({ ...activity, start_time: null, end_time: "2026-10-04T00:00:00Z" }).events.map(e => e.allDay)).toEqual([false]);
  });
  it("creates peer and intra endpoint markers", () => {
    const map = { start_time: "2026-10-05T00:00:00Z", end_time: "2026-10-06T00:00:00Z" };
    expect(eventsForActivity({ ...activity, inter_score_map: map, intra_score_map: map }).events).toHaveLength(6);
  });
  it("turns reversed periods into markers and records warnings", () => {
    const result = eventsForActivity({ ...activity, start_time: "2026-10-05T00:00:00Z" });
    expect(result.warnings).toHaveLength(1); expect(result.events.every(e => Date.parse(e.end!) - Date.parse(e.start) === 3_600_000)).toBe(true);
  });
  it("rejects impossible, ambiguous, non-string and malformed times", () => {
    for (const value of ["2026-02-30T00:00:00Z", "2026-13-01T00:00:00Z", "2026-10-01T24:00:00Z", "2026-10-01", "nonsense", 0]) expect(instant(value)).toBeNull();
    const result = eventsForActivity({ ...activity, start_time: "bad" });
    expect(result.warnings[0]).toContain("時間無效");
    expect(instant("2026-10-01T16:00:00+08:00")).toBe("2026-10-01T08:00:00.000Z");
  });
  it("has stable role UIDs when time or content changes, and independent source IDs", () => {
    const first = eventsForActivity(activity).events[0];
    const second = eventsForActivity({ ...activity, deadline: "2026-10-02T00:00:00Z" }).events[0];
    expect(first.uid).toBe(second.uid); expect(eventContent(first)).not.toBe(eventContent(second));
    expect(eventsForActivity({ ...activity, source: "exam-list" }).events[0].uid).not.toBe(first.uid);
    expect(canonical({ a: 1, b: 2 })).toBe(canonical({ b: 2, a: 1 }));
  });
  it("parses RFC5545 output with Chinese UTF-8 folds, escaped text, CRLF and UTC", () => {
    const events = eventsForActivity({ ...activity, title: "中文標題".repeat(40), deadline: "2026-10-01T09:00:00Z", end_time: "2026-10-04T16:30:00Z" }).events;
    events.forEach(e => { e.modified = "2026-10-08T00:00:00.000Z"; e.sequence = 2; });
    const output = renderCalendar(events);
    for (const line of output.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(output.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    const component = new ICAL.Component(ICAL.parse(output));
    const parsed = component.getAllSubcomponents("vevent");
    expect(parsed).toHaveLength(2);
    expect(parsed[0].getFirstPropertyValue("sequence")).toBe(2);
    const period = parsed.find(e => String(e.getFirstPropertyValue("uid")).includes("-start@"))!;
    expect(new ICAL.Event(period).startDate.toJSDate().toISOString()).toBe("2026-10-01T08:00:00.000Z");
    expect(period.getFirstPropertyValue("summary")).toContain("中文標題".repeat(40));
    expect(period.getFirstPropertyValue("description")).toContain("第二行 & <內容>");
    expect(foldLine("中".repeat(50))).toContain("\r\n ");
  });
  it("preserves Legacy links, exam counts, raw limit_time and publish metadata", () => {
    const normalized = normalize({ ...activity, limit_time: "13", subjects_count: 5, publish_time: "2026-10-08T00:00:00Z", secret: "never-copy" }, course, "exam-list");
    expect(normalized.url).toBe("https://eclass.yuntech.edu.tw/course/7/exam#/9");
    expect(normalized).not.toHaveProperty("secret");
    const result = eventsForActivity(normalized);
    expect(result.events[0].description).toContain("原始 limit_time，單位未確認）：13");
    expect(result.events).toHaveLength(2);
  });
  it("distinguishes omitted and explicitly empty filters", () => {
    expect(matchesFilters(activity, new URLSearchParams())).toBe(true);
    expect(matchesFilters(activity, new URLSearchParams("courses="))).toBe(false);
    expect(matchesFilters(activity, new URLSearchParams("courses=7&types=homework"))).toBe(true);
    expect(matchesFilters(activity, new URLSearchParams("types=exam"))).toBe(false);
  });
  it("validates poll interval and mobile query parameters", () => {
    expect(intervalMinutes()).toBe(30);
    for (const value of ["1", "6", "", "bad", "Infinity"]) expect(() => intervalMinutes(value)).toThrow();
    const url = upstreamUrl({ key: "courses", source: "courses", page: 2 }, "42");
    expect(url.pathname).toBe("/api/users/42/courses"); expect(url.searchParams.get("page_size")).toBe("10"); expect(url.searchParams.get("normal")).toContain('"apiVersion":"1.1.0"');
  });
});
