# 手機版 API 腳本

開啟 `https://eclassa.yuntech.edu.tw`，修改腳本開頭的 const，再整段貼到瀏覽器 Console 執行。

## 完整流程

使用 [mobile-course-data.js](mobile-course-data.js)，填入 `X_SESSION_ID` 與 `USER_ID`：

1. GET `/api/users/{USER_ID}/courses`，取得所有分頁。
2. 沿用 PC 邏輯，只取最大 `academic_year_id` 的課程並依 ID 去重。
3. 逐門課 GET `/api/courses/{id}/activities`。
4. 接著 GET `/api/courses/{id}/exam-list`，取得所有測驗分頁。

不需手動填 COURSE_ID。`LATEST_ACADEMIC_YEAR_ONLY=false` 可保留所有查到的學年。回傳 courses、activities、exams、原始 payloads 和 failures，並顯示表格。單門課活動失敗仍嘗試測驗，再繼續下一門課。

顯示功能與 archive 的 all-course-activities 相同：課程清單、每課數量摘要、可複選的 `displayTypes`（空陣列顯示全部）、Asia/Taipei 時間表及失敗清單。表格也包含 `exam`；篩選只影響 `filteredActivities` 與 `table`，全部活動與測驗仍保留。回傳 `allActivities` 為合併列表，`activities`、`exams` 分別保留一般活動及測驗；`payloads` 保存完整原始回應。沒有時間的活動也會顯示。

## 單一請求

[api-requests.js](api-requests.js) 可選擇 courses、activities、exam-list 或 exams。填入 X_SESSION_ID；courses 另填 USER_ID，其餘填 COURSE_ID。列表以 PAGE/PAGE_SIZE 控制單頁。

頁面開啟 eclassa，API 請求則使用擷取檔中的 `https://eclass.yuntech.edu.tw`、GET 與 X-SESSION-ID。eclassa 的 API 路徑目前收到 HTML，不能直接把頁面 Host 當成 API Host。回應不是 JSON 時，腳本會顯示 URL、狀態碼、Content-Type 與重新導向資訊；Session 是否有效仍需實際執行確認。`/exams` 是測驗設定端點，完整流程目前使用含繳交摘要的 `/exam-list`。

舊版腳本保留於 `archive/desktop/scripts/`。Token 在本機手動填入，提交前清空。
