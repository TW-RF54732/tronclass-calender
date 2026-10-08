export interface Env {
  CALENDAR: DurableObjectNamespace;
  ASSETS: Fetcher;
  TRONCLASS_SESSION_ID: string;
  TRONCLASS_USER_ID: string;
  WEB_ACCESS_KEY: string;
  CALENDAR_TOKEN: string;
  POLL_INTERVAL_MINUTES?: string;
}
export type Source = "activities" | "exam-list";
export interface Course { id: number; name: string; academic_year_id: number }
export interface Activity {
  id: number;
  course_id: number;
  course_name: string;
  source: Source;
  type: string;
  title: string;
  description: string;
  url: string;
  start_time?: unknown;
  deadline?: unknown;
  end_time?: unknown;
  publish_time?: unknown;
  announce_score_time?: unknown;
  inter_score_map?: { start_time?: unknown; end_time?: unknown };
  intra_score_map?: { start_time?: unknown; end_time?: unknown };
  limit_time?: unknown;
  submit_times?: unknown;
  submission_count?: unknown;
  subjects_count?: unknown;
}
export interface CalendarEvent {
  uid: string;
  course: number;
  type: string;
  summary: string;
  description: string;
  url: string;
  start: string;
  end?: string;
  allDay: boolean;
  // Original activity period duration, retained for ordering endpoint markers.
  durationMs?: number;
  sequence: number;
  modified: string;
}
export interface SourceStatus {
  key: string;
  course_id?: number;
  course_name?: string;
  source: Source | "courses";
  updatedAt: string | null;
  error: string | null;
}
export interface Job {
  id: string;
  startedAt: string;
  requests: number;
}
export interface Status {
  lastAttempt: string | null;
  lastCompleteSuccess: string | null;
  publishedAt: string | null;
  lastError: string | null;
  sources: SourceStatus[];
}
export function intervalMinutes(value = "30"): number {
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes) || minutes < 5 || minutes % 5 !== 0) {
    throw new Error("POLL_INTERVAL_MINUTES 必須至少為 5，且為 5 的倍數。");
  }
  return minutes;
}
