// 登入 https://eclass.yuntech.edu.tw 後，整段貼到 Console 執行。
// 沿用 my-courses 的查詢條件，只取最大 academic_year_id 的課程。
// 蒐集全部活動的 type，印出種類、數量與範例；不做時間篩選。
(async () => {
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
        status: "成功",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ course_id: course.id, course_name: course.display_name, error: message });
      courseSummary.push({
        course_id: course.id,
        course_name: course.display_name,
        activity_count: null,
        status: "失敗",
      });
      console.warn(`課程 ${course.id} 取得失敗：${message}`);
    }
  }

  const grouped = new Map();
  for (const activity of activities) {
    const type = activity.type ?? "（缺少 type）";
    if (!grouped.has(type)) {
      grouped.set(type, { count: 0, courseIds: new Set(), examples: [] });
    }
    const group = grouped.get(type);
    group.count++;
    group.courseIds.add(activity.course_id);
    if (group.examples.length < 3) {
      group.examples.push({
        course_id: activity.course_id,
        course_name: activity.course_name,
        activity_id: activity.id,
        title: activity.title,
      });
    }
  }
  const types = [...grouped.keys()].sort();
  const typeSummary = types.map((type) => {
    const group = grouped.get(type);
    return {
      type,
      activity_count: group.count,
      course_count: group.courseIds.size,
      example_titles: group.examples.map((example) => example.title).join(" | "),
    };
  });
  const examples = types.flatMap((type) =>
    grouped.get(type).examples.map((example) => ({ type, ...example })),
  );

  console.info(`共 ${activities.length} 個活動，${types.length} 種 type：`);
  console.log(types);
  console.table(typeSummary);
  console.info("各 type 的活動範例（最多 3 個）：");
  console.table(examples);
  if (failures.length) {
    console.warn(`${failures.length} 門課程取得失敗，type 統計尚不完整：`);
    console.table(failures);
  }
  return { academicYearId, types, typeSummary, examples, courses, activities, failures, payloads };
})();
