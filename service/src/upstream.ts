import type { Activity, Course, Env, Source } from "./types";

const BASE = "https://eclass.yuntech.edu.tw";
export class UpstreamError extends Error {
  constructor(message: string, public auth = false) { super(message); }
}
export interface Task { key: string; source: Source | "courses"; course?: Course; page: number }
export function upstreamUrl(task: Task, user: string): URL {
  const url = new URL(task.source === "courses"
    ? `/api/users/${user}/courses`
    : `/api/courses/${task.course!.id}/${task.source}`, BASE);
  // Activities in the research fixture are unpaginated. The same endpoint also
  // accepts pagination when the server returns pages; do not add unrelated filters.
  if (task.source !== "activities" || task.page > 1) {
    url.searchParams.set("page", String(task.page));
    url.searchParams.set("page_size", "10");
  }
  if (task.source === "exam-list") {
    url.searchParams.set("conditions", JSON.stringify({ itemsSortBy: { predicate: "created_at", reverse: true } }));
  } else if (task.source === "courses") {
    const params = {
      sort: "all", keyword: "",
      normal: JSON.stringify({ version: 7, apiVersion: "1.1.0" }),
      conditions: JSON.stringify({ role: [], semester_id: [], academic_year_id: [], status: ["ongoing", "notStarted"], course_type: [], effectiveness: [], published: [], display_studio_list: false }),
      fields: "id,org_id,name,second_name,start_date,end_date,department(id,name),instructors(id,email,name),grade(name),klass(name),academic_year_id,semester_id,cover,learning_mode,course_attributes(teaching_class_name,data),public_scope,course_type,course_code,compulsory,credit,team_teachings(id,name,email)",
    };
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url;
}
export async function fetchPage(task: Task, env: Env, timeoutMs = 30_000): Promise<{ items: Record<string, unknown>[]; pages: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(upstreamUrl(task, env.TRONCLASS_USER_ID), {
      method: "GET", redirect: "manual", signal: controller.signal,
      headers: { Accept: "application/json, text/plain, */*", "Accept-Language": "zh-Hant", "X-SESSION-ID": env.TRONCLASS_SESSION_ID.trim(), "X-Requested-With": "XMLHttpRequest" },
    });
    if (response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) {
      throw new UpstreamError("認證失效或登入重新導向，請更新 Session。", true);
    }
    if (!response.ok) throw new UpstreamError(`上游 HTTP ${response.status}`);
    // A login page must never be treated as a successful empty source.
    const text = await response.text();
    if (/^\s*</.test(text) || response.headers.get("content-type")?.includes("text/html")) {
      throw new UpstreamError("上游回傳登入 HTML，請更新 Session。", true);
    }
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(text); } catch { throw new UpstreamError("上游回應不是有效 JSON。"); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new UpstreamError("上游回應格式錯誤。");
    const key = task.source === "courses" ? "courses" : task.source === "exam-list" ? "exams" : "activities";
    if (!Array.isArray(payload[key])) throw new UpstreamError(`上游缺少 ${key} 陣列。`);
    const pages = payload.pages ?? (task.source === "activities" ? 1 : undefined);
    if (!Number.isSafeInteger(pages) || Number(pages) < 0 || Number(pages) > 10_000 || (Number(pages) === 0 && payload[key].length > 0)) {
      throw new UpstreamError("上游分頁資訊無效。");
    }
    for (const item of payload[key]) {
      if (!item || typeof item !== "object" || !Number.isSafeInteger(item.id) || item.id <= 0 || (task.source === "courses" && !Number.isFinite(item.academic_year_id))) {
        throw new UpstreamError("上游資料識別或學年度無效。");
      }
    }
    return { items: payload[key], pages: Number(pages) };
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(controller.signal.aborted ? "上游請求逾時（30 秒）。" : "上游連線失敗。");
  } finally { clearTimeout(timer); }
}
export function latestCourses(items: Record<string, unknown>[]): Course[] {
  const year = items.reduce((max, item) => Math.max(max, Number(item.academic_year_id)), -Infinity);
  return [...new Map(items.filter(item => item.academic_year_id === year).map(item => [Number(item.id), {
    id: Number(item.id), name: String(item.name ?? item.display_name ?? "未命名課程"), academic_year_id: year,
  }])).values()].sort((a, b) => a.id - b.id);
}
export function normalize(item: Record<string, unknown>, course: Course, source: Source): Activity {
  const data = item.data && typeof item.data === "object" ? item.data as Record<string, unknown> : {};
  // Copy only calendar fields: credentials and unrelated personal API data are
  // never persisted, even if upstream adds fields in a future response.
  const activity: Activity = {
    id: Number(item.id), course_id: course.id, course_name: course.name, source,
    type: source === "exam-list" ? "exam" : String(item.type ?? "unknown"),
    title: String(item.title ?? "未命名活動"),
    description: typeof data.description === "string" ? data.description : typeof item.description === "string" ? item.description : "",
    url: `https://eclass.yuntech.edu.tw/course/${course.id}/${source === "exam-list" ? "exam" : "learning-activity"}#/${item.id}`,
  };
  for (const key of ["start_time", "deadline", "end_time", "limit_time", "submit_times", "submission_count", "subjects_count"] as const) {
    if (key in item) activity[key] = item[key];
  }
  for (const key of ["publish_time", "announce_score_time"] as const) {
    activity[key] = data[key] ?? item[key] ?? null;
  }
  for (const key of ["inter_score_map", "intra_score_map"] as const) {
    const value = item[key];
    if (value && typeof value === "object") {
      const map = value as Record<string, unknown>;
      activity[key] = { start_time: map.start_time ?? null, end_time: map.end_time ?? null };
    }
  }
  return activity;
}
