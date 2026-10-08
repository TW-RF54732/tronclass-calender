# captures 請求標頭結構比較

分析日期：2026-10-07。範圍為 captures 下 7 份 HTTP 請求擷取；略過衍生 JSON 和 reports。標頭名稱以不區分大小寫方式比較，未重送請求。Cookie 與 Session token 值不收錄。

## 結論

這些樣本呈現兩套一致的請求模式：PC 從 `eclass.yuntech.edu.tw` 頁面發出、帶 Cookie；mobile 從 `eclassa.yuntech.edu.tw` 頁面發出、帶 `X-SESSION-ID` 與 `X-Requested-With`。兩邊實際 API Host 都是 `eclass.yuntech.edu.tw`。

PC/mobile 的 User-Agent 完全相同，都是 Linux Firefox 151.0。此處的 mobile 是手機版網頁入口，不能依檔名認定為真實手機裝置或原生 App 請求。

## 核心差異

| Header | PC（3 份） | mobile 與 clear_exams（4 份） |
|---|---|---|
| `Cookie` | 全部有 | 全部無 |
| `X-SESSION-ID` | 全部無 | 全部有 |
| `X-Requested-With` | 全部無 | 全部為 `XMLHttpRequest` |
| `Origin` | 課程列表 POST 有，兩份 GET 無 | 全部為 `https://eclassa.yuntech.edu.tw` |
| `Referer` | eclass 下的課程列表／內容／測驗頁 | 全部為 `https://eclassa.yuntech.edu.tw/` |
| `Accept-Language` | `zh-TW,en-US;q=0.9` | `zh-Hant` |
| `Sec-Fetch-Site` | `same-origin` | `same-site` |
| `Content-Type` | 課程列表 POST 有 | 全部無 |
| `Content-Length` | 課程列表 POST 有 | 全部無 |
| `TE` | 全部為 `trailers` | 活動與 clear_exams 有；課程列表與 exam-list 無 |

PC 的 Origin 若出現，其值為 `https://eclass.yuntech.edu.tw`；課程列表 POST 的 Content-Type 為 `application/json;charset=utf-8`、Content-Length 為 805。這是方法與 body 形態不同的樣本，不應視為手機版固定省略 JSON Content-Type 的規則。

## 所有樣本相同的標頭

| Header | 值 |
|---|---|
| `Host` | `eclass.yuntech.edu.tw` |
| `User-Agent` | `Mozilla/5.0 (X11; Linux x86_64; rv:151.0) Gecko/20100101 Firefox/151.0` |
| `Accept` | `application/json, text/plain, */*` |
| `Accept-Encoding` | `gzip, deflate, br, zstd` |
| `Sec-GPC` | `1` |
| `Connection` | `keep-alive` |
| `Sec-Fetch-Dest` | `empty` |
| `Sec-Fetch-Mode` | `cors` |

所有請求行都標示 HTTP/2，所有樣本都沒有 Authorization header；沒有 Authorization 不等於沒有登入驗證，這些樣本另帶 Cookie 或 Session header。

## 每組請求的結構差異

### 課程列表：get_courses

| 項目 | PC | mobile |
|---|---|---|
| 方法與路徑 | `POST /api/my-courses` | `GET /api/users/176757/courses` |
| Header 數 | 16 | 14 |
| 獨有 Header 名稱 | Cookie、Content-Type、Content-Length、TE | X-SESSION-ID、X-Requested-With |

兩邊共有的 Origin、Referer、Accept-Language、Sec-Fetch-Site 值不同。mobile 將欄位選取、篩選與分頁放在 query；不能把此組回傳欄位差異單獨歸因於 headers。

### 活動：get_activitie

| 項目 | PC.txt | mobile.txt |
|---|---|---|
| 路徑 | `/api/courses/128027/activities` | 相同 |
| Query | `sub_course_id=0` | 無 |
| Header 數 | 13 | 15 |
| 獨有 Header 名稱 | Cookie | X-SESSION-ID、X-Requested-With、Origin |

共有的 Referer、Accept-Language、Sec-Fetch-Site 值不同；TE 相同。已比較的 JSON 完全一致，但尚未對齊 query 後單獨測試 headers 的影響。

### 測驗列表：get_exams

| 項目 | PC.txt | mobile.txt |
|---|---|---|
| 路徑 | `/api/courses/128027/exam-list` | 相同 |
| Header 數 | 13 | 14 |
| 獨有 Header 名稱 | Cookie、TE | X-SESSION-ID、X-Requested-With、Origin |

共有的 Referer、Accept-Language、Sec-Fetch-Site 值不同。query 的排序與 page_size 也不同；依 ID 配對後，測驗物件值一致，頂層 page_size 不同。

### 測驗設定：clear_exams.txt

`GET /api/courses/128027/exams`，有 15 個 headers。它的 header 名稱集合與 mobile 活動請求相同；相較 mobile 的 exam-list，多一個 `TE: trailers`。

使用者觀察此端點 PC/mobile 值相同、headers 不同；目前只有一份 /exams 擷取，實際採用的是 X-SESSION-ID 這組模式，尚無獨立的 PC /exams 檔案可逐欄核對。

## 如何解讀來源差異

PC 頁面與 API 的 scheme、host 相同；mobile 頁面 host 是 eclassa，而 API host 是 eclass，因此 mobile 請求是跨 origin。`same-site` 不代表 `same-origin`，`Sec-Fetch-Site` 記錄的是發起端與目的端的關係。[MDN：Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)、[MDN：Sec-Fetch-Site](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-Fetch-Site)

跨 origin 使用自訂 X-SESSION-ID / X-Requested-With header 的瀏覽器請求，屬於需要 CORS preflight 檢查的形態；本次沒有保存 OPTIONS 或回應 headers，因此無法核對允許的 origin、headers、credentials 設定或預檢快取情況。[MDN：CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS)

兩邊 Sec-Fetch-Mode 都是 cors，並不表示兩邊都跨 origin；是否跨 origin 應核對來源與 API URL。

## 驗證相關資訊的判讀界線

- 可確認 PC 送 Cookie、mobile 送 X-SESSION-ID；與兩種不同 session 傳遞方式的假設相容，但不能僅憑擷取證明它們是唯一必要條件。
- Cookie header 可以包含多個 cookie，不能把所有 cookie 都視為登入所需；本次沒有逐個移除或測試。
- X-Requested-With 表示請求帶了這個標記，不足以證明它是登入必要條件。
- Origin、Referer、Sec-Fetch-* 與語言值的差異與兩個頁面入口相符，未驗證伺服器是否用它們做額外判斷。
- 未驗證 X-SESSION-ID 有效期限、取得／更新流程、跨端點適用範圍或 Cookie 的可替代性。
- TE 在 mobile 樣本中有時出現、有時沒有，未見其與已分析回傳內容差異的直接證據。

## 後續研究重點

若要判斷手機版驗證流程，優先追蹤 X-SESSION-ID 的取得、保存與更新，再比較同端點、同 query、同帳號下的結果。CORS 問題需補抓 OPTIONS 與 response headers；只看 GET/POST request headers 不足以確定瀏覽器能否讀取回應。

與各端點 JSON 判讀搭配閱讀：[課程列表](get-courses-api-comparison.md)、[活動](get-activities-api-comparison.md)、[測驗](get-exams-api-comparison.md)。
