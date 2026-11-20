# 通用前端開發規範

## 技術與檔案配置

- 使用 HTML5、CSS 與原生 JavaScript。以 ES Modules（JavaScript 模組）組織程式，HTML 以 `<script type="module">` 載入頁面程式。
- 透過 jsDelivr CDN（內容傳遞網路）載入 Bootstrap 5.3。需要圖表時，也透過 CDN 載入 Chart.js。
- 不透過 npm 安裝網站相依套件，也不使用前端框架或建置工具。本機預覽用的靜態伺服器是唯一的 npm 使用例外。
- HTML 檔放在專案根目錄。首頁檔名使用 `index.html`，共用樣式使用 `css/style.css`。
- 各頁的程式放在 `js/`，依頁面命名。跨頁共用的函式放在 `js/common.js`，外部 API（應用程式介面）的呼叫集中在 `js/` 的服務專用檔案。
- 站內連結、資源引用和模組匯入一律使用相對路徑，例如 `./css/style.css`。站內路徑避免以 `/` 開頭，讓網站能在子路徑下正常運作。

## 介面與表單

- 各頁使用一致的 Bootstrap 導覽列。版面採手機優先的響應式設計，並優先使用 Bootstrap 元件與工具類別。
- 等待資料載入時顯示 Spinner（載入轉圈指示器）。操作完成或失敗時，用 Toast（浮動通知）或 Alert（提示訊息）提供回饋。
- 刪除等無法復原的操作須先透過 Bootstrap Modal（互動式對話框）確認。
- 表單送出前檢查必填欄位與輸入格式，將錯誤提示顯示在對應欄位下方。

## JavaScript 寫法

- 變數宣告使用 `const` 或 `let`。變數與函式名稱使用 `camelCase`（小駝峰命名）。
- 非同步操作使用 `async/await`（非同步語法）。使用 `textContent` 將資料寫入畫面，使用者輸入不得透過 `innerHTML` 插入。
- 數字與金額用 `Intl.NumberFormat` 格式化，日期用 `Intl.DateTimeFormat` 格式化。語系統一使用 `zh-TW`（臺灣繁體中文）。
- 專案的頁面清單、各頁功能與配色記在 [docs/PRD.md](PRD.md)。
