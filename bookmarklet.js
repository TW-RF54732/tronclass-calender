// 原始碼：可直接貼到登入後的 Console；書籤網址由 build-bookmarklet.py 產生。
(() => {
  if (location.origin !== "https://eclass.yuntech.edu.tw") {
    alert("請先登入 https://eclass.yuntech.edu.tw，再點擊這個書籤。");
    return;
  }
  const hostId = "tronclass-activity-calendar";
  const existing = document.getElementById(hostId);
  if (existing) {
    existing.shadowRoot?.querySelector(".close")?.focus();
    return;
  }

  const knownTypes = ["forum", "homework", "material", "online_video", "page", "questionnaire", "web_link"];
  const typeNames = {
    forum: "討論區", homework: "作業", material: "教材", online_video: "影片",
    page: "頁面", questionnaire: "問卷", web_link: "連結",
  };
  const controller = new AbortController();
  const previousFocus = document.activeElement;
  const host = document.createElement("div");
  host.id = hostId;
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;display:block;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { color-scheme: light; }
      * { box-sizing: border-box; }
      .overlay { position:fixed; inset:0; background:#10223870; padding:24px; display:flex; justify-content:center; align-items:center; font:14px/1.5 system-ui,sans-serif; color:#182a3b; }
      .panel { width:min(1480px,100%); height:94vh; background:#fff; border-radius:16px; display:flex; flex-direction:column; box-shadow:0 20px 80px #0004; overflow:hidden; }
      header { display:flex; align-items:center; justify-content:space-between; padding:18px 24px; border-bottom:1px solid #dce4ed; gap:16px; }
      h1 { margin:0; font-size:21px; } h2 { margin:0; font-size:17px; }
      .sub { color:#607184; font-size:12px; margin-top:3px; }
      button,select,input { font:inherit; }
      button,select,input[type=search] { border:1px solid #c5d2df; border-radius:7px; background:#fff; color:inherit; padding:7px 11px; }
      button { cursor:pointer; } button:hover { background:#eef4fa; }
      button:disabled { opacity:.55; cursor:wait; }
      button:focus-visible,input:focus-visible,select:focus-visible { outline:3px solid #67a6f5; outline-offset:2px; }
      button[aria-pressed=true] { background:#1667c7; color:#fff; border-color:#1667c7; }
      .controls { padding:14px 24px; border-bottom:1px solid #dce4ed; display:grid; gap:12px; }
      .row { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
      fieldset { border:0; margin:0; padding:0; min-width:0; }
      legend { padding:0; font-weight:600; margin-bottom:6px; }
      .types label { display:inline-flex; align-items:center; gap:5px; border:1px solid #dce4ed; border-radius:6px; padding:5px 8px; cursor:pointer; }
      input[type=checkbox] { accent-color:#1667c7; }
      .search { flex:1; min-width:160px; max-width:340px; }
      .course { max-width:320px; }
      .status { margin:0; padding:9px 24px; color:#52677b; background:#f6f8fb; }
      .failures { padding:8px 24px; background:#fff3db; color:#744c13; max-height:100px; overflow:auto; }
      .summary { padding:10px 24px; color:#52677b; }
      .content { flex:1; min-height:0; overflow:auto; padding:0 24px 20px; }
      table { width:100%; border-collapse:collapse; font-size:13px; }
      th,td { padding:10px; border-bottom:1px solid #e3eaf1; text-align:left; vertical-align:top; }
      th { position:sticky; top:0; background:#f0f5fa; white-space:nowrap; z-index:1; }
      tbody tr:hover { background:#f8fbff; }
      .title-button { border:0; padding:0; color:#155eb2; text-align:left; background:transparent; }
      .time { white-space:nowrap; } .muted { color:#667b8f; }
      .empty { text-align:center; padding:48px 16px; color:#667b8f; }
      .calendar-nav { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
      .legend { font-size:12px; color:#52677b; }
      .calendar { width:100%; min-width:700px; table-layout:fixed; }
      .calendar th { position:static; text-align:center; }
      .calendar td { height:140px; padding:6px; border:1px solid #dce4ed; }
      .day { min-height:130px; } .outside { background:#f7f9fb; color:#94a3b2; }
      .day-number { display:inline-flex; justify-content:center; align-items:center; min-width:26px; height:26px; margin-bottom:4px; }
      .today .day-number { background:#1667c7; color:#fff; border-radius:50%; }
      .day-events { max-height:210px; overflow:auto; display:grid; gap:4px; }
      .event { width:100%; text-align:left; padding:4px 6px; font-size:12px; background:#fff2e9; border-color:#f4c4a7; border-left:3px solid #d7752e; overflow-wrap:anywhere; }
      .event.start { background:#eaf3ff; border-color:#bcd5f5; border-left-color:#2872c7; }
      .event.end { background:#fff0f1; border-color:#efbdc2; border-left-color:#bf4956; }
      .event-course { display:block; font-size:11px; color:#637386; }
      .detail { margin:0 24px 12px; padding:12px; border:1px solid #bfd3e8; border-radius:8px; background:#f7fbff; max-height:45vh; flex-shrink:0; overflow:auto; }
      .detail dl { display:grid; grid-template-columns:100px 1fr; gap:4px 10px; margin:10px 0; }
      .detail dt { color:#607184; } .detail dd { margin:0; overflow-wrap:anywhere; }
      .description { margin:12px 0; padding:12px; background:#fff; border:1px solid #dce4ed; border-radius:6px; overflow-wrap:anywhere; }
      .description h3 { margin:0 0 8px; font-size:14px; }
      .description p { margin:6px 0; } .description pre { white-space:pre-wrap; }
      .description th { position:static; }
      a { color:#155eb2; }
      [hidden] { display:none !important; }
      @media(max-width:650px) {
        .overlay { padding:0; } .panel { height:100dvh; border-radius:0; }
        header,.controls { padding:12px; } .status,.summary { padding:8px 12px; }
        .content { padding:0 12px 12px; } .detail { margin:0 12px 8px; }
        h1 { font-size:18px; } .types label { font-size:12px; }
      }
    </style>
    <div class="overlay">
      <section class="panel" role="dialog" aria-modal="true" aria-label="課程活動">
        <header>
          <div><h1>課程活動</h1><div class="sub">最新學年度 · 台灣時間 Asia/Taipei</div></div>
          <div class="row"><button class="refresh" type="button">重新整理</button><button class="close" type="button" aria-label="關閉課程活動">關閉 ✕</button></div>
        </header>
        <div class="controls">
          <fieldset><legend>活動類型</legend><div class="row types"></div></fieldset>
          <div class="row">
            <button class="all-types" type="button">全選</button><button class="no-types" type="button">清除選取</button>
            <select class="course" aria-label="篩選課程"><option value="">所有課程</option></select>
            <input class="search" type="search" placeholder="搜尋活動或課程名稱" aria-label="搜尋活動或課程名稱">
            <button class="table-view" type="button" aria-pressed="true">表格</button>
            <button class="calendar-view" type="button" aria-pressed="false">行事曆</button>
          </div>
        </div>
        <p class="status" role="status" aria-live="polite">準備讀取課程…</p>
        <div class="failures" role="alert" hidden></div>
        <div class="summary"></div>
        <section class="detail" aria-label="活動詳細資料" hidden></section>
        <div class="content"></div>
      </section>
    </div>`;
  document.body.append(host);

  const $ = (selector) => root.querySelector(selector);
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const button = (text, action, className) => {
    const element = node("button", text, className);
    element.type = "button";
    element.addEventListener("click", action);
    return element;
  };
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const dateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  });
  const validDate = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const dateKey = (date) => {
    const parts = Object.fromEntries(dateFormatter.formatToParts(date).map((part) => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const formatTime = (value) => {
    const date = validDate(value);
    return date ? formatter.format(date) : "—";
  };
  const todayKey = dateKey(new Date());
  const [currentYear, currentMonth] = todayKey.split("-").map(Number);
  let month = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  let activities = [];
  let courses = [];
  let view = "table";
  let loading = false;
  const selectedTypes = new Set(knownTypes);
  const availableTypes = new Set(knownTypes);

  function renderTypes() {
    $(".types").replaceChildren();
    for (const type of availableTypes) {
      const label = node("label");
      const input = node("input");
      input.type = "checkbox";
      input.checked = selectedTypes.has(type);
      input.value = type;
      input.addEventListener("change", () => {
        if (input.checked) selectedTypes.add(type);
        else selectedTypes.delete(type);
        render();
      });
      label.append(input, node("span", `${typeNames[type] || type} (${type})`));
      $(".types").append(label);
    }
  }

  function renderDescription(html) {
    const content = node("div");
    // 保留說明的基本排版與連結，不把 API 提供的事件或腳本帶進登入頁。
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const allowed = new Set(["P", "DIV", "SPAN", "STRONG", "EM", "B", "I", "U", "S", "BR", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "TABLE", "THEAD", "TBODY", "TFOOT", "TR", "TH", "TD", "H1", "H2", "H3", "H4", "A"]);
    const blocked = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE", "TEMPLATE"]);
    const copy = (source, destination) => {
      if (source.nodeType === 3) {
        destination.append(document.createTextNode(source.textContent));
        return;
      }
      if (source.nodeType !== 1 || blocked.has(source.tagName)) return;
      if (source.tagName === "IMG") {
        if (source.getAttribute("alt")) destination.append(document.createTextNode(source.getAttribute("alt")));
        return;
      }
      if (!allowed.has(source.tagName)) {
        for (const child of source.childNodes) copy(child, destination);
        return;
      }
      const element = node(source.tagName.toLowerCase());
      if (source.tagName === "A") {
        try {
          const url = new URL(source.getAttribute("href") || "", location.origin);
          if (["https:", "http:", "mailto:"].includes(url.protocol)) {
            element.href = url.href;
            element.target = "_blank";
            element.rel = "noopener noreferrer";
          }
        } catch { /* 無效網址仍顯示連結文字。 */ }
      }
      for (const child of source.childNodes) copy(child, element);
      destination.append(element);
    };
    for (const child of parsed.body.childNodes) copy(child, content);
    if (!content.textContent.trim()) content.textContent = "此活動沒有說明。";
    return content;
  }

  function showDetail(activity) {
    const detail = $(".detail");
    detail.hidden = false;
    const heading = node("div", undefined, "row");
    heading.append(node("h2", activity.title || "未命名活動"), button("收起", () => { detail.hidden = true; }));
    const list = node("dl");
    const values = [
      ["課程", activity.course_name], ["類型", activity.type], ["活動 ID", activity.id],
      ["開始", formatTime(activity.start_time)], ["截止", formatTime(activity.deadline)],
      ["結束", formatTime(activity.end_time)], ["發布", formatTime(activity.data?.publish_time)],
      ["成績公布", formatTime(activity.data?.announce_score_time)],
      ["互評開始", formatTime(activity.inter_score_map?.start_time)],
      ["互評結束", formatTime(activity.inter_score_map?.end_time)],
      ["組內評分開始", formatTime(activity.intra_score_map?.start_time)],
      ["組內評分結束", formatTime(activity.intra_score_map?.end_time)],
      ["API 狀態", `published=${activity.published ?? "—"} / is_started=${activity.is_started ?? "—"} / is_closed=${activity.is_closed ?? "—"}`],
    ];
    for (const [label, value] of values) list.append(node("dt", label), node("dd", String(value ?? "—")));
    const description = node("section", undefined, "description");
    description.append(node("h3", "活動說明"), renderDescription(
      typeof activity.data?.description === "string" ? activity.data.description : "",
    ));
    const link = node("a", "開啟活動頁面 ↗");
    link.href = `/course/${activity.course_id}/learning-activity#/${activity.id}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    detail.replaceChildren(heading, list, description, link);
  }

  function getFiltered() {
    const courseId = $(".course").value;
    const query = $(".search").value.trim().toLocaleLowerCase();
    return activities.filter((activity) => selectedTypes.has(activity.type)
      && (!courseId || String(activity.course_id) === courseId)
      && (!query || `${activity.title || ""} ${activity.course_name || ""}`.toLocaleLowerCase().includes(query)));
  }

  function getEvents(activity) {
    const definitions = [
      ["start", "開始", activity.start_time],
      ["deadline", "截止", activity.deadline],
      ["end", "結束", activity.end_time],
      ["start", "互評開始", activity.inter_score_map?.start_time],
      ["end", "互評結束", activity.inter_score_map?.end_time],
      ["start", "組內評分開始", activity.intra_score_map?.start_time],
      ["end", "組內評分結束", activity.intra_score_map?.end_time],
    ];
    const deadline = validDate(activity.deadline);
    return definitions.flatMap(([kind, label, value]) => {
      const date = validDate(value);
      if (!date) return [];
      // 同一個活動的截止與結束若相同，只放一個截止事件。
      if (label === "結束" && deadline && date.getTime() === deadline.getTime()) return [];
      return [{ kind, label, date, day: dateKey(date), activity }];
    });
  }

  function renderTable(filtered) {
    if (!filtered.length) {
      $(".content").append(node("p", "沒有符合篩選條件的活動。", "empty"));
      return;
    }
    const table = node("table");
    const head = node("thead");
    const header = node("tr");
    for (const title of ["課程", "類型", "活動", "開始", "截止", "結束", "狀態"]) header.append(node("th", title));
    head.append(header);
    const body = node("tbody");
    for (const activity of filtered) {
      const row = node("tr");
      const titleCell = node("td");
      titleCell.append(button(activity.title || "未命名活動", () => showDetail(activity), "title-button"));
      const state = activity.is_closed === true ? "已結束" : activity.is_started === false ? "尚未開始" : activity.is_started === true ? "已開始" : "—";
      row.append(node("td", activity.course_name), node("td", activity.type), titleCell,
        node("td", formatTime(activity.start_time), "time"), node("td", formatTime(activity.deadline), "time"),
        node("td", formatTime(activity.end_time), "time"), node("td", state));
      body.append(row);
    }
    table.append(head, body);
    $(".content").append(table);
  }

  function renderCalendar(filtered) {
    const content = $(".content");
    const nav = node("div", undefined, "calendar-nav");
    const controls = node("div", undefined, "row");
    const moveMonth = (delta) => {
      month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1));
      render();
    };
    controls.append(button("‹ 上個月", () => moveMonth(-1)),
      node("h2", `${month.getUTCFullYear()} 年 ${month.getUTCMonth() + 1} 月`),
      button("下個月 ›", () => moveMonth(1)),
      button("本月", () => { month = new Date(Date.UTC(currentYear, currentMonth - 1, 1)); render(); }));
    nav.append(controls, node("span", "藍：開始 · 橘：截止 · 紅：結束", "legend"));
    const byDay = new Map();
    let undated = 0;
    for (const activity of filtered) {
      const events = getEvents(activity);
      if (!events.length) undated++;
      for (const event of events) {
        if (!byDay.has(event.day)) byDay.set(event.day, []);
        byDay.get(event.day).push(event);
      }
    }
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const first = new Date(Date.UTC(year, monthIndex, 1));
    const start = new Date(first);
    start.setUTCDate(1 - first.getUTCDay());
    const table = node("table", undefined, "calendar");
    const head = node("thead");
    const weekdays = node("tr");
    for (const name of ["日", "一", "二", "三", "四", "五", "六"]) weekdays.append(node("th", name));
    head.append(weekdays);
    const body = node("tbody");
    let monthEvents = 0;
    for (let week = 0; week < 6; week++) {
      const row = node("tr");
      for (let day = 0; day < 7; day++) {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + week * 7 + day);
        const key = date.toISOString().slice(0, 10);
        const inMonth = date.getUTCMonth() === monthIndex;
        const cell = node("td", undefined, `${inMonth ? "" : "outside"} ${key === todayKey ? "today" : ""}`);
        const wrap = node("div", undefined, "day");
        wrap.append(node("div", String(date.getUTCDate()), "day-number"));
        const eventsWrap = node("div", undefined, "day-events");
        const events = (byDay.get(key) || []).sort((a, b) => a.date - b.date);
        if (inMonth) monthEvents += events.length;
        for (const event of events) {
          const time = formatter.format(event.date).split(" ").pop();
          const eventButton = button(`${time} ${event.label} · ${event.activity.title || "未命名活動"}`, () => showDetail(event.activity), `event ${event.kind}`);
          eventButton.title = `${event.activity.course_name}\n${event.activity.title}\n${event.label}：${formatter.format(event.date)}`;
          eventButton.append(node("span", event.activity.course_name, "event-course"));
          eventsWrap.append(eventButton);
        }
        wrap.append(eventsWrap);
        cell.append(wrap);
        row.append(cell);
      }
      body.append(row);
    }
    table.append(head, body);
    content.append(nav, node("p", `本月 ${monthEvents} 個時間事件。${undated} 個活動沒有開始／截止／結束時間，可切換表格查看。發布時間與成績公布時間不列入月曆。`, "muted"), table);
  }

  function render() {
    const filtered = getFiltered();
    $(".summary").textContent = `共 ${courses.length} 門課程、${activities.length} 個已讀取活動；符合篩選 ${filtered.length} 個。點擊活動可查看詳細資料。`;
    $(".table-view").setAttribute("aria-pressed", String(view === "table"));
    $(".calendar-view").setAttribute("aria-pressed", String(view === "calendar"));
    $(".detail").hidden = true;
    $(".content").replaceChildren();
    if (view === "table") renderTable(filtered);
    else renderCalendar(filtered);
  }

  async function request(path, options = {}) {
    const requestController = new AbortController();
    const abort = () => requestController.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(abort, 30000);
    try {
      controller.signal.throwIfAborted();
      const response = await fetch(`${location.origin}${path}`, {
        ...options, credentials: "include", signal: requestController.signal,
        headers: { Accept: "application/json, text/plain, */*", ...options.headers },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) throw error;
      if (requestController.signal.aborted) throw new Error("請求逾時，請重新整理");
      throw error;
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", abort);
    }
  }

  async function load() {
    if (loading) return;
    loading = true;
    $(".refresh").disabled = true;
    $(".failures").hidden = true;
    $(".status").textContent = "讀取課程清單…";
    try {
      const allCourses = [];
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        $(".status").textContent = `讀取課程清單：第 ${page} 頁…`;
        const data = await request("/api/my-courses", {
          method: "POST", headers: { "Content-Type": "application/json;charset=utf-8" },
          body: JSON.stringify({
            fields: "academic_year_id,display_name,id", page, page_size: 10,
            conditions: { status: ["ongoing", "notStarted"], keyword: "", classify_type: "recently_started", display_studio_list: false },
            showScorePassedStatus: false,
          }),
        });
        if (!Array.isArray(data.courses) || !Number.isInteger(data.pages) || data.pages < 0) throw new Error("課程清單格式不符合預期");
        if (data.courses.some((course) => !Number.isFinite(course.academic_year_id) || !Number.isSafeInteger(course.id) || course.id <= 0)) throw new Error("課程 ID 或學年度格式不符合預期");
        allCourses.push(...data.courses);
        pages = data.pages;
      }
      const academicYearId = allCourses.reduce((max, course) => Math.max(max, course.academic_year_id), -Infinity);
      courses = [...new Map(allCourses.filter((course) => course.academic_year_id === academicYearId).map((course) => [course.id, course])).values()];
      const previousCourse = $(".course").value;
      $(".course").replaceChildren(node("option", "所有課程"));
      $(".course").firstChild.value = "";
      for (const course of courses) {
        const option = node("option", course.display_name);
        option.value = String(course.id);
        $(".course").append(option);
      }
      if (courses.some((course) => String(course.id) === previousCourse)) $(".course").value = previousCourse;
      activities = [];
      const failures = [];
      render();
      for (const [index, course] of courses.entries()) {
        $(".status").textContent = `讀取活動 ${index + 1}/${courses.length}：${course.display_name}`;
        try {
          const data = await request(`/api/courses/${course.id}/activities?sub_course_id=0`);
          if (!Array.isArray(data.activities)) throw new Error("回應沒有 activities 陣列");
          for (const activity of data.activities) {
            const type = activity.type ?? "unknown";
            activities.push({ ...activity, type, course_id: course.id, course_name: course.display_name });
            if (!availableTypes.has(type)) {
              availableTypes.add(type);
              selectedTypes.add(type);
            }
          }
        } catch (error) {
          if (controller.signal.aborted) throw error;
          failures.push(`${course.display_name} (${course.id})：${error.message || String(error)}`);
          $(".failures").hidden = false;
          $(".failures").textContent = `部分課程讀取失敗，資料尚不完整：${failures.join("；")}`;
        }
        renderTypes();
        render();
      }
      $(".status").textContent = courses.length
        ? `讀取完成 · academic_year_id ${academicYearId} · ${courses.length - failures.length}/${courses.length} 門課程成功`
        : "目前查詢條件沒有課程。";
    } catch (error) {
      if (!controller.signal.aborted) $(".status").textContent = `讀取失敗：${error.message || String(error)}。請確認登入狀態後重新整理。`;
    } finally {
      loading = false;
      $(".refresh").disabled = false;
    }
  }

  const close = () => {
    controller.abort();
    document.removeEventListener("keydown", onKeyDown, true);
    host.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === "Tab") {
      const focusable = [...root.querySelectorAll("button:not(:disabled),input,select,a[href]")].filter((element) => element.getClientRects().length);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (root.activeElement === first || !root.activeElement)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (root.activeElement === last || !root.activeElement)) { event.preventDefault(); first?.focus(); }
    }
  };
  document.addEventListener("keydown", onKeyDown, true);
  $(".close").addEventListener("click", close);
  $(".refresh").addEventListener("click", load);
  $(".all-types").addEventListener("click", () => { for (const type of availableTypes) selectedTypes.add(type); renderTypes(); render(); });
  $(".no-types").addEventListener("click", () => { selectedTypes.clear(); renderTypes(); render(); });
  $(".search").addEventListener("input", render);
  $(".course").addEventListener("change", render);
  $(".table-view").addEventListener("click", () => { view = "table"; render(); });
  $(".calendar-view").addEventListener("click", () => { view = "calendar"; render(); });
  renderTypes();
  render();
  $(".close").focus();
  void load();
})();
