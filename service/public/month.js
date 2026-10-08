const DAY = 86_400_000;
const TAIPEI = 8 * 3_600_000;
const clock = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export function dateKey(value = Date.now()) {
  return new Date(new Date(value).getTime() + TAIPEI).toISOString().slice(0, 10);
}
export function monthStart(key) { return new Date(`${key.slice(0, 7)}-01T00:00:00Z`); }
export function monthDays(month) {
  const first = new Date(month);
  first.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => new Date(first.getTime() + i * DAY).toISOString().slice(0, 10));
}
export function activityKey(activity) { return `${activity.course_id}:${activity.source}:${activity.id}`; }
function durationMs(event) {
  if (Number.isFinite(event.durationMs) && event.durationMs >= 0) return event.durationMs;
  if (!event.end) return 0;
  const timestamp = value => event.allDay
    ? Date.parse(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T00:00:00Z`)
    : Date.parse(value);
  const duration = timestamp(event.end) - timestamp(event.start);
  return Number.isFinite(duration) && duration >= 0 ? duration : Infinity;
}
function compareDuration(a, b) { return a === b ? 0 : a < b ? -1 : 1; }
export function sortActivities(activities, items) {
  const durations = new Map();
  for (const item of items) {
    const key = activityKey(item.activity);
    const previous = durations.get(key);
    // The activity list represents the main period. For peer/intra-only
    // activities, use the longest available period; untimed items go last.
    if (["main", "start", "deadline", "end"].includes(item.role)) durations.set(key, { duration: item.duration, main: true });
    else if (!previous?.main) durations.set(key, { duration: Math.max(previous?.duration ?? 0, item.duration), main: false });
  }
  return activities.sort((a, b) => compareDuration(durations.get(activityKey(a))?.duration ?? Infinity, durations.get(activityKey(b))?.duration ?? Infinity)
    || (a.deadline || a.end_time || a.start_time || "9999").localeCompare(b.deadline || b.end_time || b.start_time || "9999")
    || a.title.localeCompare(b.title) || activityKey(a).localeCompare(activityKey(b)));
}
export function calendarItems(events, activities) {
  const byKey = new Map(activities.map(a => [activityKey(a), a]));
  return events.flatMap(event => {
    const match = /^c(\d+)-(activities|exam-list)-(\d+)-(.+)@tronclass-calendar$/.exec(event.uid);
    if (!match) return [];
    const activity = byKey.get(`${match[1]}:${match[2]}:${match[3]}`);
    if (!activity) return [];
    let first, last;
    if (event.allDay) {
      const key = value => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
      first = key(event.start);
      last = event.end ? new Date(new Date(`${key(event.end)}T00:00:00Z`).getTime() - DAY).toISOString().slice(0, 10) : first;
    } else {
      first = dateKey(event.start);
      // DTEND is exclusive, including timed events ending at Taipei midnight.
      last = event.end ? dateKey(new Date(event.end).getTime() - 1) : first;
    }
    const role = match[4];
    const label = ({ main: activity.deadline ? "開始 → 截止" : "開始 → 結束", start: "開始", deadline: "截止", end: "結束", "end-date": "結束日期", peer: "互評", "peer-start": "互評開始", "peer-end": "互評結束", intra: "組內評分", "intra-start": "組內評分開始", "intra-end": "組內評分結束" })[role] || "活動";
    const shortTime = event.allDay ? "全天" : first !== last ? "期間" : clock.format(new Date(event.start));
    const when = event.allDay ? `全天 · ${label}` : first !== last ? `${label} · ${first.slice(5)} – ${last.slice(5)}` : `${clock.format(new Date(event.start))}${event.end ? ` – ${clock.format(new Date(event.end))}` : ""} · ${label}`;
    return [{ ...event, activity, role, duration: durationMs(event), first, last, label, shortTime, when }];
  }).sort((a, b) => compareDuration(a.duration, b.duration) || a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
}
