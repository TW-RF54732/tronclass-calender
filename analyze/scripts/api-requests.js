// 修改以下 const，再整段貼到 https://eclassa.yuntech.edu.tw 的 Console 執行。
// 回傳完整 JSON，不篩選或分析資料。
(async () => {
  const X_SESSION_ID = ""; // 手動填入 X-SESSION-ID
  const BASE_URL = "https://eclass.yuntech.edu.tw"; // API Host；頁面仍開 eclassa
  const ENDPOINT = "activities"; // courses / activities / exam-list / exams
  const USER_ID = ""; // courses 使用
  const COURSE_ID = 128027;
  const PAGE = 1;
  const PAGE_SIZE = 10;

  if (!X_SESSION_ID.trim()) {
    throw new Error("請先填入 const X_SESSION_ID。");
  }
  if (ENDPOINT === "courses" && !/^[1-9]\d*$/.test(String(USER_ID))) {
    throw new Error("請填入 USER_ID（正整數）。");
  }
  if (ENDPOINT !== "courses" && !/^[1-9]\d*$/.test(String(COURSE_ID))) {
    throw new Error("請填入有效的 const COURSE_ID（正整數）。");
  }
  if (!Number.isSafeInteger(PAGE) || PAGE < 1 ||
      !Number.isSafeInteger(PAGE_SIZE) || PAGE_SIZE < 1) {
    throw new Error("PAGE 與 PAGE_SIZE 必須是正整數。");
  }

  const paths = {
    courses: `/api/users/${USER_ID}/courses`,
    activities: `/api/courses/${COURSE_ID}/activities`,
    "exam-list": `/api/courses/${COURSE_ID}/exam-list`,
    exams: `/api/courses/${COURSE_ID}/exams`,
  };
  if (!Object.hasOwn(paths, ENDPOINT)) {
    throw new Error("ENDPOINT 請填 courses、activities、exam-list 或 exams。");
  }
  const url = new URL(paths[ENDPOINT], BASE_URL);
  const method = "GET";
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-Hant",
    "X-SESSION-ID": X_SESSION_ID.trim(),
    "X-Requested-With": "XMLHttpRequest",
  };
  if (ENDPOINT === "courses") {
    url.search = new URLSearchParams({
      page: String(PAGE), page_size: String(PAGE_SIZE), sort: "all", keyword: "",
      normal: JSON.stringify({ version: 7, apiVersion: "1.1.0" }),
      conditions: JSON.stringify({
        role: [], semester_id: [], academic_year_id: [], status: ["ongoing", "notStarted"],
        course_type: [], effectiveness: [], published: [], display_studio_list: false,
      }),
      fields: "id,name,academic_year_id,semester_id",
    }).toString();
  } else if (ENDPOINT === "exam-list") {
    url.search = new URLSearchParams({
      page: String(PAGE),
      page_size: String(PAGE_SIZE),
      conditions: JSON.stringify({
        itemsSortBy: { predicate: "created_at", reverse: true },
      }),
    }).toString();
  }

  console.info(`${method} ${url}`);
  const response = await fetch(url, {
    method,
    credentials: "omit",
    headers,
  });
  if (!response.ok) {
    throw new Error(`請求失敗：HTTP ${response.status}（${ENDPOINT}）`);
  }
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`API 未回傳 JSON：HTTP ${response.status}；URL=${response.url || url}；Content-Type=${response.headers.get("content-type") || "未知"}；redirected=${response.redirected}。若回傳 HTML，請確認 API Host 與 Session 是否有效。`);
  }
  console.log(JSON.stringify(payload, null, 2));
  return payload;
})();
