// 登入 eclass.yuntech.edu.tw 後，整段貼到 Console。
// 修改最後一行的課程 ID；這是 courses[].id，不是活動 ID。
(async (courseId) => {
  if (!Number.isSafeInteger(courseId) || courseId <= 0) {
    throw new Error("courseId 必須是正整數。");
  }

  const response = await fetch(
    `https://eclass.yuntech.edu.tw/api/courses/${courseId}/activities?sub_course_id=0`,
    {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json, text/plain, */*" },
    },
  );
  if (!response.ok) {
    throw new Error(`取得課程活動失敗：HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (!Array.isArray(payload.activities)) {
    throw new Error("API 回應沒有 activities 陣列，請確認登入狀態與課程 ID。");
  }

  // 保存 UTC 原始字串；只有 Console 表格轉成台灣時間。
  const hasTime = (value) => value !== null && value !== undefined && value !== "";
  const timedActivities = payload.activities
    .filter((activity) => [
      activity.start_time,
      activity.end_time,
      activity.deadline,
      activity.inter_score_map?.start_time,
      activity.inter_score_map?.end_time,
      activity.intra_score_map?.start_time,
      activity.intra_score_map?.end_time,
    ].some(hasTime))
    .map((activity) => ({
      id: activity.id,
      course_id: activity.course_id,
      type: activity.type,
      title: activity.title,
      start_time: activity.start_time ?? null,
      deadline: activity.deadline ?? null,
      end_time: activity.end_time ?? null,
      publish_time: activity.data?.publish_time ?? null,
      announce_score_time: activity.data?.announce_score_time ?? null,
      published: activity.published,
      is_started: activity.is_started,
      is_closed: activity.is_closed,
      is_in_progress: activity.is_in_progress,
      inter_review_start_time: activity.inter_score_map?.start_time ?? null,
      inter_review_end_time: activity.inter_score_map?.end_time ?? null,
      intra_review_start_time: activity.intra_score_map?.start_time ?? null,
      intra_review_end_time: activity.intra_score_map?.end_time ?? null,
    }));

  const hasEnding = (activity) => [
    activity.deadline,
    activity.end_time,
    activity.inter_review_end_time,
    activity.intra_review_end_time,
  ].some(hasTime);
  const deadlines = timedActivities.filter(hasEnding);
  const openingOnly = timedActivities.filter((activity) => !hasEnding(activity));

  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const formatTime = (value) => {
    if (!hasTime(value)) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? `無法解析：${value}` : formatter.format(date);
  };
  const rows = (activities) => activities.map((activity) => ({
    id: activity.id,
    type: activity.type,
    title: activity.title,
    "開始（台灣）": formatTime(activity.start_time),
    "截止（台灣）": formatTime(activity.deadline),
    "結束（台灣）": formatTime(activity.end_time),
    "互評開始（台灣）": formatTime(activity.inter_review_start_time),
    "互評結束（台灣）": formatTime(activity.inter_review_end_time),
    "組內評分開始（台灣）": formatTime(activity.intra_review_start_time),
    "組內評分結束（台灣）": formatTime(activity.intra_review_end_time),
    is_started: activity.is_started,
    is_closed: activity.is_closed,
  }));

  console.info(`課程 ${courseId}：共 ${payload.activities.length} 個活動。時間皆顯示為 Asia/Taipei。`);
  console.info(`有截止或結束時間：${deadlines.length} 個`);
  console.table(rows(deadlines));
  console.info(`只有開始時間：${openingOnly.length} 個`);
  console.table(rows(openingOnly));

  // 完整回應供分析尚未確認的測驗欄位；不把影片長度視為作答限時。
  return { courseId, deadlines, openingOnly, timedActivities, payload };
})(128027);
