import type { Activity, CalendarEvent } from "./types";

export const typeNames: Record<string, string> = { exam: "測驗", forum: "討論區", homework: "作業", material: "教材", online_video: "影片", page: "頁面", questionnaire: "問卷", web_link: "連結" };
export function instant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second = "0"] = match;
  const check = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (check.getUTCFullYear() !== Number(year) || check.getUTCMonth() !== Number(month) - 1 || check.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function textDescription(html: string): string {
  // This is plain ICS text, never rendered as HTML. Browser HTML uses the DOM
  // whitelist in public/sanitize.js. Preserve line breaks and basic entities.
  return html.replace(/<(script|style|iframe|object|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\s*(br\b[^>]*|\/p|\/div|\/li|\/tr|\/h[1-4])\s*>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
      if (entity.startsWith("#")) {
        const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
        return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[entity.toLowerCase()] ?? whole;
    }).trim();
}
export function activityDetails(a: Activity): [string, unknown][] {
  return [
    ["課程", a.course_name], ["類型", `${typeNames[a.type] ?? a.type} (${a.type})`], ["來源", a.source], ["活動 ID", a.id],
    ["開始", a.start_time], ["截止", a.deadline], ["結束", a.end_time], ["發布", a.publish_time], ["成績公布", a.announce_score_time],
    ["互評開始", a.inter_score_map?.start_time], ["互評結束", a.inter_score_map?.end_time],
    ["組內評分開始", a.intra_score_map?.start_time], ["組內評分結束", a.intra_score_map?.end_time],
    ...(a.source === "exam-list" ? [["總題數", a.subjects_count], ["可作答次數", a.submit_times], ["已繳交次數", a.submission_count], ["作答限時（原始 limit_time，單位未確認）", a.limit_time]] as [string, unknown][] : []),
  ];
}
export function eventsForActivity(a: Activity): { events: CalendarEvent[]; warnings: string[] } {
  const warnings: string[] = [];
  const events: CalendarEvent[] = [];
  const parse = (value: unknown, label: string) => {
    const result = instant(value);
    if (value !== null && value !== undefined && value !== "" && !result) warnings.push(`${label}時間無效：${String(value)}`);
    return result;
  };
  const add = (role: string, label: string, start: string, durationMs = 0) => {
    const finishing = role === "deadline" || role === "end" || role.endsWith("-end");
    const original = Date.parse(start);
    const end = new Date(original + (finishing ? 0 : 3_600_000)).toISOString();
    start = new Date(original - (finishing ? 3_600_000 : 0)).toISOString();
    events.push({ uid: `c${a.course_id}-${a.source}-${a.id}-${role}@tronclass-calendar`, course: a.course_id, type: a.type,
      summary: `[${a.course_name}] ${a.title} · ${label}`, description: "", url: a.url, start, end, allDay: false,
      durationMs, sequence: 0, modified: "" });
  };
  const s = parse(a.start_time, "開始");
  const d = parse(a.deadline, "截止");
  const e = parse(a.end_time, "結束");
  const end = d ?? e;
  const wrong = Boolean((s && end && s > end) || (d && e && d > e) || (s && e && s > e));
  if (wrong) warnings.push("主時段時間順序錯誤，改列個別標記。");
  const duration = !wrong && s && end && s < end ? Date.parse(end) - Date.parse(s) : 0;
  if (s) add("start", "開始", s, duration);
  if (d) add("deadline", "截止", d, duration);
  else if (e) add("end", "結束", e, duration);
  for (const [role, label, map] of [["peer", "互評", a.inter_score_map], ["intra", "組內評分", a.intra_score_map]] as const) {
    const start = parse(map?.start_time, `${label}開始`);
    const finish = parse(map?.end_time, `${label}結束`);
    if (start && finish && start > finish) warnings.push(`${label}時間順序錯誤，改列個別標記。`);
    const duration = start && finish && start < finish ? Date.parse(finish) - Date.parse(start) : 0;
    if (start) add(`${role}-start`, `${label}開始`, start, duration);
    if (finish && finish !== start) add(`${role}-end`, `${label}結束`, finish, duration);
  }
  const description = `${a.title}\n${activityDetails(a).map(([label, value]) => `${label}：${value === undefined || value === null ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value)}`).join("\n")}\n活動說明：\n${textDescription(a.description)}\n活動網址：${a.url}${warnings.length ? `\n警告：${warnings.join("；")}` : ""}`;
  for (const event of events) event.description = description;
  return { events, warnings };
}
export function taipeiDate(iso: string): string {
  return new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10).replaceAll("-", "");
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function eventContent(event: CalendarEvent): string {
  const { sequence: _sequence, modified: _modified, ...content } = event;
  return canonical(content);
}
export function escapeText(value: string): string {
  return value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll("\u0000", "");
}
export function foldLine(line: string): string {
  let bytes = 0;
  let result = "";
  const encoder = new TextEncoder();
  for (const char of line) {
    const length = encoder.encode(char).length;
    if (bytes + length > 75) { result += "\r\n "; bytes = 1; }
    result += char; bytes += length;
  }
  return result;
}
function utc(iso: string): string { return iso.replaceAll("-", "").replaceAll(":", "").replace(/\.\d+Z$/, "Z"); }
export function renderCalendar(events: CalendarEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//TronClass Calendar//Personal Calendar//ZH", "CALSCALE:GREGORIAN", "X-WR-CALNAME:TronClass 個人行事曆"];
  for (const event of [...events].sort((a, b) => a.uid.localeCompare(b.uid))) {
    lines.push("BEGIN:VEVENT", `UID:${escapeText(event.uid)}`, `DTSTAMP:${utc(event.modified)}`, `LAST-MODIFIED:${utc(event.modified)}`, `SEQUENCE:${event.sequence}`,
      `DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? event.start : utc(event.start)}`);
    if (event.end) lines.push(`DTEND${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? event.end : utc(event.end)}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`, `DESCRIPTION:${escapeText(event.description)}`, `URL:${event.url}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
export async function digest(text: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map(n => n.toString(16).padStart(2, "0")).join("");
}
export function selected(params: URLSearchParams, key: string): Set<string> | null {
  return params.has(key) ? new Set(params.getAll(key).flatMap(v => v.split(",")).map(v => v.trim()).filter(Boolean)) : null;
}
export function matchesFilters(item: { course?: number; course_id?: number; type: string }, params: URLSearchParams): boolean {
  const courses = selected(params, "courses");
  const types = selected(params, "types");
  return (!courses || courses.has(String(item.course ?? item.course_id))) && (!types || types.has(item.type));
}
