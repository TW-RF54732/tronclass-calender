// 登入 https://eclass.yuntech.edu.tw 後，整段貼到 Console 執行。
// 沿用 my-courses 的查詢條件，只取最大 academic_year_id 的課程。
// 活動不做時間篩選：包括沒有時間設定的教材、連結等。
(async () => {
  // 複選要顯示的 type，例如 ["homework", "forum", "questionnaire"]。
  // [] 顯示全部；可選：forum、homework、material、online_video、page、questionnaire、web_link。
  const displayTypes = [
    "forum",
    "homework",
    "material",
    "online_video",
    "page",
    "questionnaire",
    "web_link",
  ];
  const selectedTypes = new Set(displayTypes);
  const matchesType = (activity) => selectedTypes.size === 0 || selectedTypes.has(activity.type);

  const baseUrl = "https://eclass.yuntech.edu.tw";
  const allCourses = [];
  let pages = 1;

  for (let page = 1; page <= pages; page++) {
    const response = await fetch(`${baseUrl}/api/my-courses`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json;charset=utf-8",
      },
      body: JSON.stringify({
        fields: "academic_year_id,display_name,id",
        page,
        page_size: 10,
        conditions: {
          status: ["ongoing", "notStarted"],
          keyword: "",
          classify_type: "recently_started",
          display_studio_list: false,
        },
        showScorePassedStatus: false,
      }),
    });
    if (!response.ok) {
      throw new Error(`取得課程第 ${page} 頁失敗：HTTP ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data.courses) || !Number.isInteger(data.pages) || data.pages < 0) {
      throw new Error(`課程第 ${page} 頁的 courses 或 pages 格式不符合預期。`);
    }
    for (const course of data.courses) {
      if (!Number.isFinite(course.academic_year_id) || !Number.isSafeInteger(course.id) || course.id <= 0) {
        throw new Error(`課程第 ${page} 頁包含無效的 academic_year_id 或課程 id。`);
      }
    }
    allCourses.push(...data.courses);
    pages = data.pages;
  }

  const academicYearId = allCourses.length
    ? allCourses.reduce((max, course) => Math.max(max, course.academic_year_id), -Infinity)
    : null;
  // 分頁若出現重複課程，同一個第一層 id 只抓一次。
  const courses = [...new Map(allCourses
    .filter((course) => course.academic_year_id === academicYearId)
    .map((course) => [course.id, course])).values()];
  console.info(`academic_year_id 最大值：${academicYearId ?? "無"}；共 ${courses.length} 門課程。`);
  console.table(courses.map(({ id, display_name }) => ({ id, display_name })));

  const activities = [];
  const payloads = [];
  const failures = [];
  const courseSummary = [];

  // 逐一請求；單一課程失敗仍繼續其餘課程，最後列出失敗清單。
  for (const [index, course] of courses.entries()) {
    console.info(`[${index + 1}/${courses.length}] ${course.display_name}（${course.id}）`);
    try {
      const response = await fetch(
        `${baseUrl}/api/courses/${course.id}/activities?sub_course_id=0`,
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json, text/plain, */*" },
        },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.activities)) throw new Error("回應沒有 activities 陣列");
      payloads.push({ course_id: course.id, payload });
      for (const activity of payload.activities) {
        activities.push({
          ...activity,
          course_id: course.id,
          course_name: course.display_name,
        });
      }
      courseSummary.push({
        course_id: course.id,
        course_name: course.display_name,
        activity_count: payload.activities.length,
        displayed_count: payload.activities.filter(matchesType).length,
        status: "成功",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ course_id: course.id, course_name: course.display_name, error: message });
      courseSummary.push({
        course_id: course.id,
        course_name: course.display_name,
        activity_count: null,
        displayed_count: null,
        status: "失敗",
      });
      console.warn(`課程 ${course.id} 取得失敗：${message}`);
    }
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
  const filteredActivities = activities.filter(matchesType);
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

  console.info("各課程活動數量：");
  console.table(courseSummary);
  console.info(`顯示 type：${selectedTypes.size ? [...selectedTypes].join(", ") : "全部"}`);
  console.info(`全部活動：${activities.length} 個；符合篩選：${filteredActivities.length} 個，時間顯示為 Asia/Taipei。`);
  console.table(table);
  if (failures.length) {
    console.warn(`${failures.length} 門課程取得失敗，活動表格尚不完整：`);
    console.table(failures);
  }

  // activities 保留全部活動；filteredActivities 和 table 僅含選取的 type。
  // payloads 保留各課程完整回應，時間原文不變。
  return { academicYearId, courses, displayTypes, activities, filteredActivities, table, courseSummary, failures, payloads };
})();
