import type { Activity } from "../src/types";
export const course = { id: 7, name: "中文課程", academic_year_id: 115 };
export const activity: Activity = {
  id: 9, course_id: 7, course_name: course.name, source: "activities", type: "homework", title: "作業，中文；測試",
  description: "<p>第一行<br>第二行 &amp; &lt;內容&gt;</p>",
  url: "https://eclass.yuntech.edu.tw/course/7/learning-activity#/9",
  start_time: "2026-10-01T08:00:00Z", deadline: "2026-10-03T15:59:00Z", end_time: "2026-10-03T15:59:00Z",
};
export function upstreamFixture(options: { fail?: string; empty?: string; title?: string; courses?: typeof course[]; examPages?: number } = {}) {
  return async (input: RequestInfo | URL): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (options.fail && url.pathname.endsWith(options.fail)) return new Response("Unavailable", { status: 500 });
    if (url.pathname.endsWith("/courses")) return Response.json({ courses: options.courses ?? [course], pages: 1 });
    if (url.pathname.endsWith("/activities")) return Response.json({ activities: options.empty === "activities" ? [] : [{ ...activity, title: options.title ?? activity.title, data: { description: activity.description } }] });
    if (url.pathname.endsWith("/exam-list")) {
      const page = Number(url.searchParams.get("page"));
      return Response.json({ exams: options.empty === "exam-list" ? [] : [{ ...activity, title: options.title ?? activity.title, id: 9 + page - 1, type: "exam", subjects_count: 10, limit_time: 13, submit_times: 3, submission_count: 1 }], pages: options.examPages ?? 1 });
    }
    throw new Error(`Unexpected fixture URL ${url.pathname}`);
  };
}
