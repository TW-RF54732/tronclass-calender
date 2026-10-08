目前你的 `eclass` 行事曆程式實際用到的 API，整理成最精簡版本如下：

| URL Path | 精簡格式 | 簡介 |
|---|---|---|
| `/api/my-courses` | `POST` | 取得目前使用者的課程清單 |
| `/api/courses/{course_id}/activities?sub_course_id=0` | `GET` | 取得指定課程的活動，包括作業、教材、討論、連結等 |
| `/api/courses/{course_id}/exam-list?...` | `GET` | 取得指定課程的測驗列表 |

其中 `/api/my-courses` 目前你的程式送的 body 大致是：

```json
{
  "fields": "academic_year_id,display_name,id",
  "page": 1,
  "page_size": 10,
  "conditions": {
    "status": ["ongoing", "notStarted"],
    "keyword": "",
    "classify_type": "recently_started",
    "display_studio_list": false
  },
  "showScorePassedStatus": false
}
```

可以再壓成：

```text
POST /api/my-courses
→ 找「我有哪些課」
→ 取得 course_id
```

接著：

```text
GET /api/courses/{course_id}/activities?sub_course_id=0
→ 取得一般活動
→ homework / forum / material / web_link / page / questionnaire / ...
```

以及：

```text
GET /api/courses/{course_id}/exam-list
→ 取得 exam
→ deadline / start_time / end_time / limit_time / 題數 / 作答次數
```

你目前整個資料流程其實就是：

```text
/my-courses
    ↓
course_id[]
    ↓
┌──────────────────────────────────┐
│ /courses/{id}/activities         │
│ /courses/{id}/exam-list          │
└──────────────────────────────────┘
    ↓
合併成 activities[]
    ↓
calendar
```

如果目標是分析手機版認證，**現在先只盯 `/api/my-courses` 就夠了**。

因為我們不需要重新驗證所有 API。只要手機版成功呼叫：

```text
POST https://eclass.yuntech.edu.tw/api/my-courses
```

然後把它跟電腦版的同一條 request 比較，就可以把問題單純化成：

```text
URL：一樣
Method：一樣
Body：可能一樣

真正要找：
Headers / Authorization / Session
```

這會是現在最有效率的切入點。