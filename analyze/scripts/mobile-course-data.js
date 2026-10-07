// 在 eclassa 網頁 Console 執行：課程 → 每門課活動 → 每門課測驗。
(async () => {
  const X_SESSION_ID = "";
  const USER_ID = "";
  const BASE_URL = "https://eclass.yuntech.edu.tw"; // API Host；頁面仍開 eclassa
  const PAGE_SIZE = 10;
  const LATEST_ACADEMIC_YEAR_ONLY = true; // 沿用 PC：只取最大 academic_year_id

  // 複選顯示類型；[] 顯示全部，篩選不會刪除原始資料。
  const displayTypes = [
    "forum", "homework", "material", "online_video", "page",
    "questionnaire", "web_link", "exam",
  ];
  const selectedTypes = new Set(displayTypes);
  const matchesType = item => selectedTypes.size === 0 || selectedTypes.has(item.type);

  if (!Number.isSafeInteger(PAGE_SIZE) || PAGE_SIZE < 1) throw new Error("PAGE_SIZE 必須是正整數。");
  if (!X_SESSION_ID.trim()) throw new Error("請填入 X_SESSION_ID。");
  if (!/^[1-9]\d*$/.test(String(USER_ID))) throw new Error("請填入 USER_ID（正整數）。");

  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-Hant",
    "X-SESSION-ID": X_SESSION_ID.trim(),
    "X-Requested-With": "XMLHttpRequest",
  };
  const payloads = [];
  async function get(path, params = {}) {
    const url = new URL(path, BASE_URL);
    url.search = new URLSearchParams(params).toString();
    const response = await fetch(url, { method: "GET", credentials: "omit", headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}：${url.pathname}`);
    const text = await response.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`API 未回傳 JSON：HTTP ${response.status}；URL=${response.url || url}；Content-Type=${response.headers.get("content-type") || "未知"}；redirected=${response.redirected}。若回傳 HTML，請確認 API Host 與 Session 是否有效。`);
    }
    payloads.push({ url: url.toString(), payload });
    return payload;
  }
  async function getPages(path, key, params) {
    const items = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const payload = await get(path, { ...params, page, page_size: PAGE_SIZE });
      if (!Array.isArray(payload[key]) || !Number.isSafeInteger(payload.pages) || payload.pages < 0) {
        throw new Error(`${path} 第 ${page} 頁缺少有效的 ${key} 或 pages。`);
      }
      items.push(...payload[key]);
      pages = payload.pages;
    }
    return items;
  }

  const allCourses = await getPages(`/api/users/${USER_ID}/courses`, "courses", {
    sort: "all",
    keyword: "",
    normal: JSON.stringify({ version: 7, apiVersion: "1.1.0" }),
    conditions: JSON.stringify({
      role: [], semester_id: [], academic_year_id: [],
      status: ["ongoing", "notStarted"], course_type: [],
      effectiveness: [], published: [], display_studio_list: false,
    }),
    fields: "id,org_id,name,second_name,start_date,end_date,department(id,name),instructors(id,email,name),grade(name),klass(name),academic_year_id,semester_id,cover,learning_mode,course_attributes(teaching_class_name,data),public_scope,course_type,course_code,compulsory,credit,team_teachings(id,name,email)",
  });
  for (const course of allCourses) {
    if (!Number.isSafeInteger(course.id) || course.id <= 0 || !Number.isFinite(course.academic_year_id)) {
      throw new Error("課程資料缺少有效的 id 或 academic_year_id。");
    }
  }
  const academicYearId = allCourses.length
    ? allCourses.reduce((max, course) => Math.max(max, course.academic_year_id), -Infinity)
    : null;
  const courses = [...new Map(allCourses
    .filter(course => !LATEST_ACADEMIC_YEAR_ONLY || course.academic_year_id === academicYearId)
    .map(course => [course.id, course])).values()];

  console.info(`academic_year_id 最大值：${academicYearId ?? "無"}；共 ${courses.length} 門課程。`);
  console.table(courses.map(course => ({ id: course.id, name: course.name })));

  const activities = [];
  const exams = [];
  const failures = [];
  const courseSummary = [];
  for (const [index, course] of courses.entries()) {
    const summary = {
      course_id: course.id, course_name: course.name,
      activity_count: null, exam_count: null, displayed_count: 0,
      activity_status: "失敗", exam_status: "失敗",
    };
    console.info(`[${index + 1}/${courses.length}] ${course.name}（${course.id}）`);
    try {
      const payload = await get(`/api/courses/${course.id}/activities`);
      if (!Array.isArray(payload.activities)) throw new Error("回應缺少 activities 陣列。");
      summary.activity_count = payload.activities.length;
      summary.activity_status = "成功";
      summary.displayed_count += payload.activities.filter(matchesType).length;
      activities.push(...payload.activities.map(activity => ({
        ...activity, course_id: course.id, course_name: course.name,
      })));
    } catch (error) {
      failures.push({ course_id: course.id, course_name: course.name, endpoint: "activities", error: String(error) });
      console.warn(`課程 ${course.id} 活動取得失敗：${error}`);
    }
    // 活動失敗仍嘗試測驗；測驗列表自動取得全部分頁。
    try {
      const items = await getPages(`/api/courses/${course.id}/exam-list`, "exams", {
        conditions: JSON.stringify({ itemsSortBy: { predicate: "created_at", reverse: true } }),
      });
      summary.exam_count = items.length;
      summary.exam_status = "成功";
      summary.displayed_count += items.filter(matchesType).length;
      exams.push(...items.map(exam => ({ ...exam, course_id: course.id, course_name: course.name })));
    } catch (error) {
      failures.push({ course_id: course.id, course_name: course.name, endpoint: "exam-list", error: String(error) });
      console.warn(`課程 ${course.id} 測驗取得失敗：${error}`);
    }
    courseSummary.push(summary);
  }

  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const formatTime = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? `無法解析：${value}` : formatter.format(date);
  };
  const allActivities = [...activities, ...exams];
  const filteredActivities = allActivities.filter(matchesType);
  const table = filteredActivities.map((activity) => ({
    course_id: activity.course_id,
    course_name: activity.course_name,
    activity_id: activity.id,
    type: activity.type,
    title: activity.title,
    "開始（台灣）": formatTime(activity.start_time),
    "截止（台灣）": formatTime(activity.deadline),
    "結束（台灣）": formatTime(activity.end_time),
    "發布（台灣）": formatTime(activity.data?.publish_time),
    "成績公布（台灣）": formatTime(activity.data?.announce_score_time),
    "互評開始（台灣）": formatTime(activity.inter_score_map?.start_time),
    "互評結束（台灣）": formatTime(activity.inter_score_map?.end_time),
    "組內評分開始（台灣）": formatTime(activity.intra_score_map?.start_time),
    "組內評分結束（台灣）": formatTime(activity.intra_score_map?.end_time),
    published: activity.published,
    is_started: activity.is_started,
    is_closed: activity.is_closed,
    is_in_progress: activity.is_in_progress,
  }));

  console.info("各課程活動與測驗數量：");
  console.table(courseSummary);
  console.info(`顯示 type：${selectedTypes.size ? [...selectedTypes].join(", ") : "全部"}`);
  console.info(`活動 ${activities.length} 個；測驗 ${exams.length} 個；符合篩選 ${filteredActivities.length} 個，時間顯示為 Asia/Taipei。`);
  console.table(table);
  if (failures.length) {
    console.warn(`${failures.length} 個請求失敗，資料尚不完整：`);
    console.table(failures);
  }
  // 原始時間與所有類型仍保留；篩選只影響 filteredActivities 與 table。
  return {
    academicYearId, courses, displayTypes, activities, exams, allActivities,
    filteredActivities, table, courseSummary, failures, payloads,
  };
})();
