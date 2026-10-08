// 在 https://eclassa.yuntech.edu.tw 的 Console 執行；API Host 使用 eclass。
// 顯示縮排 JSON 並回傳完整物件。
(async () => {
  const X_SESSION_ID = "";
  const BASE_URL = "https://eclass.yuntech.edu.tw";
  const PAGE = 1;
  const PAGE_SIZE = 10;

  if (!X_SESSION_ID.trim()) throw new Error("請填入 X_SESSION_ID。");
  if (!Number.isSafeInteger(PAGE) || PAGE < 1 || !Number.isSafeInteger(PAGE_SIZE) || PAGE_SIZE < 1) throw new Error("PAGE 與 PAGE_SIZE 必須是正整數。");
  const url = new URL("/api/my-courses", BASE_URL);
  const method = "POST";
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-Hant",
    "X-SESSION-ID": X_SESSION_ID.trim(),
    "X-Requested-With": "XMLHttpRequest",
  };
  headers["Content-Type"] = "application/json;charset=utf-8";
  const body = JSON.stringify({
    fields: "academic_year_id,display_name,id",
    page: PAGE, page_size: PAGE_SIZE,
    conditions: {
      status: ["ongoing", "notStarted"], keyword: "",
      classify_type: "recently_started", display_studio_list: false,
    },
    showScorePassedStatus: false,
  });

  console.info(`${method} ${url}`);
  const response = await fetch(url, {
    method,
    credentials: "omit",
    headers,
    body,
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
