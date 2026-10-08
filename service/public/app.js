import { renderDescription } from "./sanitize.js";
import { activityKey, calendarItems, dateKey, monthDays, monthStart, sortActivities } from "./month.js";
const $ = id => document.getElementById(id);
const names = { exam: "測驗", forum: "討論區", homework: "作業", material: "教材", online_video: "影片", page: "頁面", questionnaire: "問卷", web_link: "連結" };
let data = { courses: [], activities: [], calendarEvents: [], publishedAt: null };
let selectedCourses = new Set(), selectedTypes = new Set(), initialized = false, timer, generation = 0;
let view = "calendar", selectedDay = dateKey(), month = monthStart(selectedDay);
if (matchMedia("(max-width: 760px)").matches) document.querySelector(".sidebar-group").open = false;
const formatter = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "short", timeStyle: "short", hourCycle: "h23" });
const time = value => { if (value == null || value === "") return "—"; const date = new Date(value); return Number.isFinite(date.getTime()) ? formatter.format(date) : `無法解析：${String(value)}`; };
function node(tag, text, className) { const element = document.createElement(tag); if (text != null) element.textContent = String(text); if (className) element.className = className; return element; }
function message(text) { $("message").textContent = text; }
function showLogin() { clearTimeout(timer); $("login-panel").hidden = false; $("dashboard").hidden = true; $("logout").hidden = true; $("subscription").value = ""; for (const id of ["activities", "month-grid", "day-activities", "untimed-activities", "detail-content"]) $(id).replaceChildren(); $("activity-dialog").close(); }
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401) showLogin(); throw new Error(result.error || `HTTP ${response.status}`); }
  return result;
}
function choices(id, values, selected) {
  $(id).replaceChildren();
  for (const [value, label] of values) {
    const input = node("input"); input.type = "checkbox"; input.value = value; input.checked = selected.has(value);
    input.addEventListener("change", () => { if (input.checked) selected.add(value); else selected.delete(value); render(); subscription().catch(e => message(e.message)); });
    const option = node("label"); option.append(input, node("span", label)); $(id).append(option);
  }
}
function filters() {
  const courseIds = data.courses.map(c => String(c.id)); const types = [...new Set(data.activities.map(a => a.type))].sort();
  if (!initialized) { selectedCourses = new Set(courseIds); selectedTypes = new Set(types); initialized = Boolean(data.publishedAt); }
  choices("courses", data.courses.map(c => [String(c.id), c.name]), selectedCourses);
  choices("types", types.map(t => [t, names[t] || t]), selectedTypes);
}
function render() {
  const query = $("search").value.trim().toLocaleLowerCase();
  const activities = data.activities.filter(a => selectedCourses.has(String(a.course_id)) && selectedTypes.has(a.type) && `${a.title} ${a.course_name}`.toLocaleLowerCase().includes(query));
  const items = calendarItems(data.calendarEvents || [], activities);
  sortActivities(activities, items);
  $("count").textContent = `${activities.length} 個活動`;
  $("calendar-view").hidden = view !== "calendar";
  $("list-view").hidden = view !== "list";
  $("view-title").textContent = view === "calendar" ? "課程月曆" : "活動列表";
  $("view-calendar").setAttribute("aria-pressed", String(view === "calendar"));
  $("view-list").setAttribute("aria-pressed", String(view === "list"));
  if (view === "calendar") { $("activities").replaceChildren(); renderMonth(activities, items); return; }
  $("untimed-activities").replaceChildren();
  $("activities").replaceChildren();
  if (!activities.length) $("activities").append(node("p", "沒有符合篩選的活動。", "panel muted"));
  for (const a of activities) $("activities").append(activityCard(a));
}
function activityContent(a) {
    const content = document.createDocumentFragment();
    const list = node("dl");
    const fields = [["課程", a.course_name], ["類型", names[a.type] || a.type], ["活動 ID", a.id], ...[["開始", a.start_time], ["截止", a.deadline], ["結束", a.end_time], ["發布", a.publish_time], ["成績公布", a.announce_score_time], ["互評開始", a.inter_score_map?.start_time], ["互評結束", a.inter_score_map?.end_time], ["組內評分開始", a.intra_score_map?.start_time], ["組內評分結束", a.intra_score_map?.end_time]].map(([k, v]) => [k, `${time(v)}${v ? `（原始：${v}）` : ""}`]), ...(a.source === "exam-list" ? [["總題數", a.subjects_count], ["可作答次數", a.submit_times], ["已繳交次數", a.submission_count], ["作答限時", `${JSON.stringify(a.limit_time ?? null)}（原始 limit_time，單位未確認）`]] : [])];
    for (const [label, value] of fields) list.append(node("dt", label), node("dd", value ?? "—"));
    const link = node("a", "開啟活動頁面 ↗", "button"); link.href = a.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    content.append(list, node("h3", "活動說明"), renderDescription(a.description), link);
    return content;
}
function activityCard(a) {
    const detail = node("details", null, "activity"); const summary = node("summary");
    summary.append(node("span", names[a.type] || a.type, "badge"), node("span", a.course_name, "course-name"), node("p", a.title, "title"));
    const times = [["開始", a.start_time], a.deadline ? ["截止", a.deadline] : ["結束", a.end_time]].filter(([, v]) => v != null && v !== "");
    for (const [label] of times) summary.append(node("span", label, "badge activity-role"));
    summary.append(node("div", times.length ? times.map(([label, value]) => `${label} ${time(value)}`).join(" · ") : "無時間活動", "muted"));
    detail.append(summary, activityContent(a));
    return detail;
}
function showDetail(activity) {
  $("detail-title").textContent = activity.title;
  $("detail-content").replaceChildren(activityContent(activity));
  $("activity-dialog").showModal();
}
function renderMonth(activities, items) {
  const today = dateKey();
  $("month-title").textContent = `${month.getUTCFullYear()} 年 ${month.getUTCMonth() + 1} 月`;
  $("month-grid").replaceChildren();
  const monthKey = month.toISOString().slice(0, 7);
  for (const day of monthDays(month)) {
    const cell = node("div", null, `calendar-day${day.startsWith(monthKey) ? "" : " outside-month"}${day === selectedDay ? " selected-day" : ""}${day === today ? " today" : ""}`);
    cell.dataset.date = day;
    const date = node("button", Number(day.slice(8)), "date-button");
    date.setAttribute("aria-label", `${day} 查看當日活動`);
    date.setAttribute("aria-pressed", String(day === selectedDay));
    if (day === today) date.setAttribute("aria-current", "date");
    date.addEventListener("click", () => { selectedDay = day; if (!day.startsWith(monthKey)) month = monthStart(day); render(); document.querySelector(`.calendar-day[data-date="${day}"] .date-button`).focus({ preventScroll: true }); });
    cell.append(date);
    const dayItems = items.filter(item => item.first <= day && item.last >= day);
    for (const item of dayItems.slice(0, 2)) {
      const button = node("button", null, `calendar-event type-${item.activity.type.replace(/[^a-z_]/g, "")}`);
      button.setAttribute("aria-label", `${day} ${item.label} ${item.activity.course_name} ${item.activity.title}`);
      button.title = `${item.activity.course_name} · ${item.activity.title} · ${item.when}`;
      button.append(node("span", item.label, "event-role"), node("span", item.shortTime, "event-time"), node("span", item.activity.title, "event-title"));
      button.addEventListener("click", () => showDetail(item.activity));
      cell.append(button);
    }
    if (dayItems.length > 2) {
      const more = node("button", `+${dayItems.length - 2} 個`, "more-events");
      more.setAttribute("aria-label", `${day} 查看全部 ${dayItems.length} 個活動時段`);
      more.addEventListener("click", () => { selectedDay = day; if (!day.startsWith(monthKey)) month = monthStart(day); render(); $("day-title").scrollIntoView({ behavior: "smooth", block: "nearest" }); });
      cell.append(more);
    }
    $("month-grid").append(cell);
  }
  const dayItems = items.filter(item => item.first <= selectedDay && item.last >= selectedDay);
  const date = new Date(`${selectedDay}T00:00:00Z`);
  $("day-title").textContent = `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日 · ${["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.getUTCDay()]}`;
  $("day-count").textContent = `${dayItems.length} 個時段`;
  $("day-activities").replaceChildren();
  if (!dayItems.length) $("day-activities").append(node("p", "這一天沒有符合篩選的活動。", "empty-state muted"));
  for (const item of dayItems) {
    const button = node("button", null, "agenda-item");
    const content = node("span", null, "agenda-content");
    content.append(node("span", `${item.activity.title} · ${item.label}`, "agenda-title"), node("span", `${item.activity.course_name} · ${item.when}`, "muted"));
    button.append(node("span", names[item.activity.type] || item.activity.type, "badge"), content, node("span", "↗", "agenda-arrow"));
    button.addEventListener("click", () => showDetail(item.activity));
    $("day-activities").append(button);
  }
  const timedKeys = new Set(items.map(item => activityKey(item.activity)));
  const untimed = activities.filter(a => !timedKeys.has(activityKey(a)));
  $("untimed-panel").hidden = untimed.length === 0;
  $("untimed-count").textContent = `${untimed.length} 個活動`;
  $("untimed-activities").replaceChildren(...untimed.map(activityCard));
}
async function subscription() {
  const current = ++generation;
  const params = new URLSearchParams({ courses: [...selectedCourses].sort().join(","), types: [...selectedTypes].sort().join(",") });
  const result = await api(`/api/subscription-url?${params}`);
  if (current !== generation) return;
  $("subscription").value = result.https; $("webcal").href = result.webcal;
}
async function loadData() { data = await api("/api/activities"); filters(); render(); await subscription(); }
async function refresh() {
  clearTimeout(timer);
  try {
    const status = await api("/api/status");
    $("login-panel").hidden = true; $("dashboard").hidden = false; $("logout").hidden = false;
    $("status").textContent = `${status.job ? `同步中：${status.progress.done}/${status.progress.total} 個來源，已請求 ${status.job.requests} 次。` : "目前沒有進行中的同步。"} 最近嘗試：${time(status.lastAttempt)}；完整成功：${time(status.lastCompleteSuccess)}；快照：${time(status.publishedAt)}。每 ${status.intervalMinutes} 分鐘同步。${status.stale ? " 資料已過期或尚無快照。" : ""}${status.lastError ? ` ${status.lastError}` : ""}`;
    $("status").className = status.stale || status.lastError ? "warning" : "";
    $("sync").disabled = Boolean(status.job);
    $("sources").replaceChildren();
    for (const source of status.sources) $("sources").append(node("div", `${source.course_name || "課程列表／認證"} · ${source.source}：${source.error || "成功"}（最近更新 ${time(source.updatedAt)}）`, source.error ? "warning" : "muted"));
    for (const warning of status.warnings || []) $("sources").append(node("div", `${warning.activity}：${warning.messages.join("；")}`, "warning"));
    if (!initialized || data.publishedAt !== status.publishedAt) await loadData();
    timer = setTimeout(refresh, status.job ? 5000 : 30000);
  } catch (error) { message(error.message); if (!$("dashboard").hidden) timer = setTimeout(refresh, 30000); }
}
$("login").addEventListener("submit", async event => { event.preventDefault(); const key = $("key").value; $("key").value = ""; try { await api("/api/login", { key }); message(""); initialized = false; await refresh(); } catch (e) { message(e.message); } });
$("logout").addEventListener("click", async () => { try { await api("/api/logout", {}); initialized = false; data = { courses: [], activities: [], calendarEvents: [], publishedAt: null }; generation++; showLogin(); message("已登出。"); } catch (e) { message(e.message); } });
$("sync").addEventListener("click", async () => { $("sync").disabled = true; try { await api("/api/sync", {}); message("同步已排入背景工作。"); await refresh(); } catch (e) { message(e.message); $("sync").disabled = false; } });
$("search").addEventListener("input", render);
$("reset").addEventListener("click", () => { initialized = false; $("search").value = ""; filters(); render(); subscription().catch(e => message(e.message)); });
$("copy").addEventListener("click", async () => { try { await navigator.clipboard.writeText($("subscription").value); message("已複製訂閱網址。"); } catch { $("subscription").select(); message("請長按或使用複製指令複製網址。"); } });
$("view-calendar").addEventListener("click", () => { view = "calendar"; render(); });
$("view-list").addEventListener("click", () => { view = "list"; render(); });
function changeMonth(offset) { month.setUTCMonth(month.getUTCMonth() + offset); selectedDay = month.toISOString().slice(0, 10); render(); }
$("previous-month").addEventListener("click", () => changeMonth(-1));
$("next-month").addEventListener("click", () => changeMonth(1));
$("today").addEventListener("click", () => { selectedDay = dateKey(); month = monthStart(selectedDay); render(); });
$("close-detail").addEventListener("click", () => $("activity-dialog").close());
$("activity-dialog").addEventListener("click", event => { if (event.target === $("activity-dialog")) { const bounds = event.target.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) event.target.close(); } });
refresh();
