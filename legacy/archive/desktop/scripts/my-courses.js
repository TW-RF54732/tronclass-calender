// 在登入 https://eclass.yuntech.edu.tw 後，貼到瀏覽器 Console 執行。
// 回傳 [{ display_name, id }]，id 是 courses 陣列中物件第一層的 id。
(async () => {
  const courses = [];
  let pages = 1;

  for (let page = 1; page <= pages; page++) {
    const response = await fetch("https://eclass.yuntech.edu.tw/api/my-courses", {
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
      throw new Error(`課程第 ${page} 頁的回應格式不符合預期，請檢查 courses 和 pages。`);
    }
    for (const course of data.courses) {
      if (!Number.isFinite(course.academic_year_id)) {
        throw new Error(`課程 ${course.id} 缺少有效的 academic_year_id。`);
      }
    }
    courses.push(...data.courses);
    pages = data.pages;
  }

  if (courses.length === 0) {
    console.info("沒有符合目前 API 查詢條件的課程。");
    return [];
  }

  const academicYearId = courses.reduce(
    (max, course) => Math.max(max, course.academic_year_id),
    -Infinity,
  );
  const result = courses
    .filter((course) => course.academic_year_id === academicYearId)
    .map(({ display_name, id }) => ({ display_name, id }));

  console.info(`academic_year_id 最大值：${academicYearId}`);
  console.table(result);
  return result;
})();
