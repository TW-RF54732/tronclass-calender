// 在 https://eclassa.yuntech.edu.tw 的 Console 執行；API Host 使用 eclass。
// 顯示縮排 JSON 並回傳完整物件。
(async () => {
  const X_SESSION_ID = "";
  const BASE_URL = "https://eclass.yuntech.edu.tw";
  const USER_ID = "";
  const PAGE = 1;
  const PAGE_SIZE = 10;

  if (!X_SESSION_ID.trim()) throw new Error("請填入 X_SESSION_ID。");
  if (!/^[1-9]\d*$/.test(String(USER_ID))) throw new Error("USER_ID 必須是正整數。");
  if (!Number.isSafeInteger(PAGE) || PAGE < 1 || !Number.isSafeInteger(PAGE_SIZE) || PAGE_SIZE < 1) throw new Error("PAGE 與 PAGE_SIZE 必須是正整數。");
  const url = new URL(`/api/users/${USER_ID}/courses`, BASE_URL);
  const method = "GET";
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-Hant",
    "X-SESSION-ID": X_SESSION_ID.trim(),
    "X-Requested-With": "XMLHttpRequest",
  };
    url.search = new URLSearchParams({
      page: String(PAGE), page_size: String(PAGE_SIZE), sort: "all", keyword: "",
      normal: JSON.stringify({ version: 7, apiVersion: "1.1.0" }),
      conditions: JSON.stringify({
        role: [], semester_id: [], academic_year_id: [], status: ["ongoing", "notStarted"],
        course_type: [], effectiveness: [], published: [], display_studio_list: false,
      }),
      fields: "id,org_id,name,second_name,start_date,end_date,department(id,name),instructors(id,email,name),grade(name),klass(name),academic_year_id,semester_id,cover,learning_mode,course_attributes(teaching_class_name,data),public_scope,course_type,course_code,compulsory,credit,team_teachings(id,name,email)",
    }).toString();

  console.info(`${method} ${url}`);
  const response = await fetch(url, {
    method,
    credentials: "omit",
    headers,
  });
  if (!response.ok) {
    throw new Error(`請求失敗：HTTP ${response.status}（${url.pathname}）`);
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
