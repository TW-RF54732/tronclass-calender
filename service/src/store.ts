import { DurableObject } from "cloudflare:workers";
import { digest, eventContent, eventsForActivity, matchesFilters, renderCalendar } from "./calendar";
import { fetchPage, latestCourses, normalize, type Task, UpstreamError } from "./upstream";
import { intervalMinutes, type Activity, type CalendarEvent, type Course, type Env, type Job, type SourceStatus, type Status } from "./types";

const initialStatus = (): Status => ({ lastAttempt: null, lastCompleteSuccess: null, publishedAt: null, lastError: null, sources: [] });
type TaskRow = { key: string; json: string; done: number; error: string | null };
export class CalendarStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks (key TEXT PRIMARY KEY, json TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, error TEXT);
      CREATE TABLE IF NOT EXISTS staging (source TEXT NOT NULL, id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(source,id));
      CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS activities (source TEXT NOT NULL, id INTEGER NOT NULL, json TEXT NOT NULL, PRIMARY KEY(source,id));
      CREATE TABLE IF NOT EXISTS events (uid TEXT PRIMARY KEY, json TEXT NOT NULL, active INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sources (key TEXT PRIMARY KEY, json TEXT NOT NULL);`);
    // Upgrade published events from saved activities even if the upstream
    // session is expired. Do not change source freshness or start a sync job.
    ctx.storage.transactionSync(() => {
      if (this.read<number>("calendarFormatVersion") !== 5) {
        for (const row of sql.exec<{ source: string; id: number; json: string }>("SELECT source,id,json FROM activities").toArray()) {
          const activity: Activity = JSON.parse(row.json);
          activity.url = `https://eclass.yuntech.edu.tw/course/${activity.course_id}/${activity.source === "exam-list" ? "exam" : "learning-activity"}#/${activity.id}`;
          sql.exec("UPDATE activities SET json=? WHERE source=? AND id=?", JSON.stringify(activity), row.source, row.id);
        }
        if (this.status().publishedAt) this.rebuildEvents(new Date().toISOString());
        this.write("calendarFormatVersion", 5);
      }
    });
  }
  private read<T>(key: string): T | null {
    const row = this.ctx.storage.sql.exec<{ json: string }>("SELECT json FROM meta WHERE key=?", key).toArray()[0];
    return row ? JSON.parse(row.json) : null;
  }
  private write(key: string, value: unknown): void {
    this.ctx.storage.sql.exec("INSERT OR REPLACE INTO meta VALUES (?,?)", key, JSON.stringify(value));
  }
  private rows<T>(table: "courses" | "activities" | "events" | "sources", active = false): T[] {
    return this.ctx.storage.sql.exec<{ json: string }>(`SELECT json FROM ${table}${active ? " WHERE active=1" : ""} ORDER BY 1`).toArray().map(row => JSON.parse(row.json));
  }
  private status(): Status { return this.read<Status>("status") ?? initialStatus(); }
  private job(): Job | null { return this.read<Job>("job"); }
  private async trigger(manual: boolean): Promise<Response> {
    const interval = intervalMinutes(this.env.POLL_INTERVAL_MINUTES);
    const active = this.job();
    if (active) {
      // Recover if a prior invocation stopped after saving progress but before
      // rescheduling. Never replace an existing alarm or create a second job.
      if (await this.ctx.storage.getAlarm() === null) await this.ctx.storage.setAlarm(Date.now() + 1000);
      return Response.json({ jobId: active.id, joined: true }, { status: 202 });
    }
    const status = this.status();
    if (!manual && status.lastAttempt && Date.now() - Date.parse(status.lastAttempt) < interval * 60_000) return Response.json({ due: false });
    if (!this.env.TRONCLASS_SESSION_ID?.trim() || !/^[1-9]\d*$/.test(this.env.TRONCLASS_USER_ID ?? "")) {
      status.lastAttempt = new Date().toISOString(); status.lastError = "缺少有效的 TronClass Secrets。";
      this.write("status", status);
      return Response.json({ error: status.lastError }, { status: 503 });
    }
    const job: Job = { id: crypto.randomUUID(), startedAt: new Date().toISOString(), requests: 0 };
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec("DELETE FROM tasks; DELETE FROM staging;");
      this.write("job", job);
      this.write("status", { ...status, lastAttempt: job.startedAt, lastError: null });
      const task: Task = { key: "courses", source: "courses", page: 1 };
      this.ctx.storage.sql.exec("INSERT INTO tasks (key,json) VALUES (?,?)", task.key, JSON.stringify(task));
    });
    await this.ctx.storage.setAlarm(Date.now() + 1000);
    return Response.json({ jobId: job.id, joined: false }, { status: 202 });
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && (url.pathname === "/sync" || url.pathname === "/tick")) return this.trigger(url.pathname === "/sync");
    if (url.pathname === "/status") {
      const tasks = this.ctx.storage.sql.exec<{ total: number; done: number; failed: number }>("SELECT COUNT(*) total, COALESCE(SUM(done),0) done, COALESCE(SUM(error IS NOT NULL),0) failed FROM tasks").one();
      const status = this.status();
      return Response.json({ ...status, sources: this.rows<SourceStatus>("sources"), warnings: this.read("warnings") ?? [], job: this.job(), progress: tasks, intervalMinutes: intervalMinutes(this.env.POLL_INTERVAL_MINUTES),
        stale: !status.publishedAt || Date.now() - Date.parse(status.publishedAt) > intervalMinutes(this.env.POLL_INTERVAL_MINUTES) * 120_000 });
    }
    if (url.pathname === "/activities") {
      return Response.json({
        courses: this.rows<Course>("courses"),
        activities: this.rows<Activity>("activities").filter(a => matchesFilters(a, url.searchParams)),
        // Reuse the published ICS events so the web month and subscription have
        // identical period, marker and Taipei all-day semantics.
        calendarEvents: this.rows<CalendarEvent>("events", true).filter(e => matchesFilters(e, url.searchParams))
          .map(({ uid, start, end, allDay, durationMs }) => ({ uid, start, end, allDay, durationMs })),
        publishedAt: this.status().publishedAt,
      });
    }
    if (url.pathname === "/calendar") {
      if (!this.status().publishedAt) return new Response("尚無可用快照，請先同步。", { status: 503, headers: { "Retry-After": "300" } });
      const body = renderCalendar(this.rows<CalendarEvent>("events", true).filter(e => matchesFilters(e, url.searchParams)));
      const etag = `"${await digest(body)}"`;
      const headers = { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, no-cache", ETag: etag, "Content-Disposition": 'inline; filename="tronclass.ics"' };
      const matches = request.headers.get("If-None-Match")?.split(",").map(v => v.trim().replace(/^W\//, ""));
      return matches?.includes(etag) || matches?.includes("*") ? new Response(null, { status: 304, headers }) : new Response(body, { headers });
    }
    return new Response("Not found", { status: 404 });
  }
  async alarm(): Promise<void> {
    if (!this.job()) return;
    // 40 * 30s exceeds the alarm's 15-minute wall limit in the worst case.
    // Also stop after 60 seconds and persist each page independently.
    const started = Date.now();
    for (let count = 0; count < 40 && Date.now() - started < 60_000; count++) {
      const job = this.job();
      if (!job) return;
      const row = this.ctx.storage.sql.exec<TaskRow>("SELECT * FROM tasks WHERE done=0 ORDER BY key LIMIT 1").toArray()[0];
      if (!row) { this.publish(); return; }
      const task: Task = JSON.parse(row.json);
      let page: Awaited<ReturnType<typeof fetchPage>>;
      try { page = await fetchPage(task, this.env); }
      catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
        this.ctx.storage.transactionSync(() => {
          job.requests++;
          this.write("job", job);
          if (error.auth || task.source === "courses") {
            const status = this.status();
            this.write("status", { ...status, lastError: error.message });
            const key = error.auth ? "authentication" : "courses";
            const previous = this.rows<SourceStatus>("sources").find(source => source.key === key);
            const source: SourceStatus = { key, source: "courses", updatedAt: previous?.updatedAt ?? null, error: error.message };
            this.ctx.storage.sql.exec("INSERT OR REPLACE INTO sources VALUES (?,?)", key, JSON.stringify(source));
            this.ctx.storage.sql.exec("DELETE FROM meta WHERE key='job'; DELETE FROM tasks; DELETE FROM staging;");
          } else {
            this.ctx.storage.sql.exec("UPDATE tasks SET done=1,error=? WHERE key=?", error.message, task.key);
            this.ctx.storage.sql.exec("DELETE FROM staging WHERE source=?", task.key);
          }
        });
        if (!this.job()) return;
        continue;
      }
      this.ctx.storage.transactionSync(() => {
        for (const item of page.items) {
          // Select the latest year before deduplicating course IDs. An older
          // duplicate on a later page must not overwrite the latest-year course.
          const key = task.source === "courses" ? `${item.academic_year_id}:${item.id}` : String(item.id);
          this.ctx.storage.sql.exec("INSERT OR REPLACE INTO staging VALUES (?,?,?)", task.key, key, JSON.stringify(item));
        }
        job.requests++;
        this.write("job", job);
        if (task.page < page.pages) {
          task.page++;
          this.ctx.storage.sql.exec("UPDATE tasks SET json=? WHERE key=?", JSON.stringify(task), task.key);
        } else {
          this.ctx.storage.sql.exec("UPDATE tasks SET done=1 WHERE key=?", task.key);
          if (task.source === "courses") {
            const all = this.ctx.storage.sql.exec<{ json: string }>("SELECT json FROM staging WHERE source='courses'").toArray().map(row => JSON.parse(row.json));
            for (const course of latestCourses(all)) {
              for (const source of ["activities", "exam-list"] as const) {
                const next: Task = { key: `${course.id}:${source}`, source, course, page: 1 };
                this.ctx.storage.sql.exec("INSERT INTO tasks (key,json) VALUES (?,?)", next.key, JSON.stringify(next));
              }
            }
          }
        }
      });
    }
    if (this.ctx.storage.sql.exec("SELECT key FROM tasks WHERE done=0 LIMIT 1").toArray().length === 0) this.publish();
    else await this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  private publish(): void {
    const job = this.job();
    if (!job) return;
    const now = new Date().toISOString();
    // SQL transaction includes snapshots, event versions, status and job removal.
    // Replayed alarms either resume a persisted cursor or see no active job.
    this.ctx.storage.transactionSync(() => {
      const sql = this.ctx.storage.sql;
      const courses = latestCourses(sql.exec<{ json: string }>("SELECT json FROM staging WHERE source='courses'").toArray().map(row => JSON.parse(row.json)));
      const keys = new Set(courses.flatMap(c => [`${c.id}:activities`, `${c.id}:exam-list`]));
      for (const row of sql.exec<{ source: string }>("SELECT DISTINCT source FROM activities").toArray()) {
        if (!keys.has(row.source)) sql.exec("DELETE FROM activities WHERE source=?", row.source);
      }
      sql.exec("DELETE FROM courses; DELETE FROM sources;");
      for (const course of courses) sql.exec("INSERT INTO courses VALUES (?,?)", course.id, JSON.stringify(course));
      const oldSources = this.read<SourceStatus[]>("sourceHistory") ?? [];
      const sources: SourceStatus[] = [{ key: "courses", source: "courses", updatedAt: now, error: null }];
      for (const row of sql.exec<TaskRow>("SELECT * FROM tasks WHERE key <> 'courses'").toArray()) {
        const task: Task = JSON.parse(row.json);
        const course = task.course!;
        if (!row.error) {
          sql.exec("DELETE FROM activities WHERE source=?", task.key);
          for (const raw of sql.exec<{ json: string }>("SELECT json FROM staging WHERE source=?", task.key).toArray()) {
            const activity = normalize(JSON.parse(raw.json), course, task.source as Activity["source"]);
            sql.exec("INSERT INTO activities VALUES (?,?,?)", task.key, activity.id, JSON.stringify(activity));
          }
        }
        sources.push({ key: task.key, course_id: course.id, course_name: course.name, source: task.source,
          updatedAt: row.error ? oldSources.find(s => s.key === task.key)?.updatedAt ?? null : now, error: row.error });
      }
      this.rebuildEvents(now);
      for (const source of sources) sql.exec("INSERT INTO sources VALUES (?,?)", source.key, JSON.stringify(source));
      const partial = sources.some(s => s.error);
      this.write("status", { ...this.status(), publishedAt: now, lastCompleteSuccess: partial ? this.status().lastCompleteSuccess : now, lastError: partial ? "部分來源失敗，保留該來源先前資料。" : null });
      this.write("sourceHistory", sources);
      sql.exec("DELETE FROM meta WHERE key='job'; DELETE FROM tasks; DELETE FROM staging;");
    });
  }
  private rebuildEvents(now: string): void {
    const sql = this.ctx.storage.sql;
    const previous = new Map(this.rows<CalendarEvent>("events").map(e => [e.uid, e]));
    sql.exec("UPDATE events SET active=0");
    const warnings: { activity: string; messages: string[] }[] = [];
    for (const activity of this.rows<Activity>("activities")) {
      const result = eventsForActivity(activity);
      if (result.warnings.length) warnings.push({ activity: `${activity.course_id}:${activity.source}:${activity.id}`, messages: result.warnings });
      for (const event of result.events) {
        const old = previous.get(event.uid);
        const changed = !old || eventContent(old) !== eventContent(event);
        event.sequence = old ? old.sequence + (changed ? 1 : 0) : 0;
        event.modified = !old || changed ? now : old.modified;
        sql.exec("INSERT OR REPLACE INTO events VALUES (?,?,1)", event.uid, JSON.stringify(event));
      }
    }
    this.write("warnings", warnings);
  }
}
