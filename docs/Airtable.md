# 通用 Airtable 資料存取規範

## 連線與憑證

- 純前端靜態網站透過 Airtable REST API（網頁資料存取介面）直接讀寫資料。端點格式為 `https://api.airtable.com/v0/{BaseId}/{TableName}`。
- 使用 Bearer Token（持有者權杖）驗證，請求標頭格式為 `Authorization: Bearer {Token}`。
- 由使用者在 `settings.html` 輸入 Token（權杖）與 Base ID（資料庫識別碼），存入瀏覽器的 `localStorage`（本機儲存空間）。命名方式為 `<專案代號>.token` 與 `<專案代號>.baseId`。依 [docs/PRD.md](PRD.md) 的代號，本專案使用 `moneybook.token` 與 `moneybook.baseId`。
- 尚未設定 Token 時，其他頁面應在發出資料請求前導向 `settings.html`。
- 任何實際 Token、Base ID 或密碼均不得寫入程式碼、HTML 或文件。畫面、錯誤訊息與開發者主控台都不得輸出 Token。
- 設定頁的 Token 欄位使用 `type="password"`，並提供「清除設定」以移除兩個儲存鍵。Token 的權限限於指定 Base 與必要的記錄讀寫權限。
- 此架構僅供個人課程練習。瀏覽器中執行的同源程式可讀取 `localStorage`，因此不適合多人共用同一枚機密 Token。

## 程式與資料約定

- 所有 Airtable API 函式集中在 `js/airtable.js`。使用瀏覽器內建的 `fetch` 與 `async/await` 發送請求，其他模組透過匯出的函式存取資料。
- 每筆資料保留 Airtable 回傳的原始記錄 ID（`rec` 開頭），作為更新與刪除的識別碼。
- 資料表與欄位名稱使用 `PascalCase`（大駝峰命名）。實際表名、欄位、型別及固定選項由 [docs/PRD.md](PRD.md) 定義。
- 固定選項使用 Single select（單選欄位），表單以對應選項的下拉選單呈現。避免使用 `typecast` 自動建立選項。
- 日期使用 Date（日期欄位），傳送格式為 `YYYY-MM-DD`。金額使用 Currency（金額欄位）或 Number（數值欄位）。如有建立時間，使用 Airtable 自動產生的 Created time（建立時間欄位）。
- 資料表、欄位結構與既有資料不得擅自變更或刪除，也不得以既有資料進行刪除測試。

## 請求、分頁與排序

- `GET` 讀取資料，每次最多回傳 100 筆。有 `offset`（分頁游標）時，保留原查詢條件並帶入游標請求下一頁，直到回應不再包含 `offset`。
- 使用 `filterByFormula` 在 Airtable 端篩選，送出前對查詢參數做網址編碼。使用 `sort[0][field]` 與 `sort[0][direction]` 指定排序欄位與方向。
- 使用 `POST` 新增、`PATCH` 更新、`DELETE` 刪除。更新時只送出變更的欄位，單筆更新或刪除使用原始記錄 ID 指定目標。批次新增、更新或刪除每次最多 10 筆，超過上限時分批送出。
- 每個 Base 每秒最多 5 次請求。分頁與批次操作也要計入限額。

## 錯誤處理

| HTTP 狀態碼 | 處理方式 |
| --- | --- |
| `401` 驗證失敗 | 提示檢查 Token 是否有效，提供前往設定頁的入口。 |
| `403` 權限不足 | 提示檢查 Token 是否具有該 Base 與所需操作的權限。 |
| `422` 請求內容無法處理 | 提示檢查欄位、選項或資料格式。若需記錄診斷資訊，只輸出已移除憑證的內容。 |
| `429` 請求過於頻繁 | 暫停發送請求，提示使用者等待 30 秒後再試。 |
