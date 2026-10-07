// 在 https://eclassa.yuntech.edu.tw 的 Console 執行；API Host 使用 eclass。
// 顯示縮排 JSON 並回傳完整物件。
(async () => {
  const X_SESSION_ID = "";
  const BASE_URL = "https://eclass.yuntech.edu.tw";
  const COURSE_ID = 128027;

  if (!X_SESSION_ID.trim()) throw new Error("請填入 X_SESSION_ID。");
  if (!/^[1-9]\d*$/.test(String(COURSE_ID))) throw new Error("COURSE_ID 必須是正整數。");
  const url = new URL(`/api/courses/${COURSE_ID}/activities`, BASE_URL);
  const method = "GET";
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "zh-Hant",
    "X-SESSION-ID": X_SESSION_ID.trim(),
    "X-Requested-With": "XMLHttpRequest",
  };

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
