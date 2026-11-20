# 專案開發指引

專案需求與規格請閱讀 [docs/PRD.md](docs/PRD.md)。

## 技術棧與本機預覽

- 使用 HTML5、CSS、原生 JavaScript。Bootstrap 5.3 透過 CDN（內容傳遞網路）載入，資料儲存使用 Airtable。
- 不使用 React、Vue、前端建置工具或後端伺服器。
- 網站以靜態網站形式部署到 GitHub Pages 或 Netlify。
- 在專案根目錄可用 `npx serve -l 3000` 啟動靜態伺服器，從 [http://localhost:3000](http://localhost:3000) 預覽。修改畫面或功能後，在瀏覽器確認顯示與操作正常。

## 開發流程

- 使用繁體中文撰寫使用者介面與程式碼註解。
- 新增功能前，先向使用者說明會新增或修改哪些檔案，取得確認後再實作。
- 專案專屬需求、頁面、業務規則與資料結構寫在 `docs/PRD.md`。其餘規範文件維持通用。

## 文件索引

開始下列工作前，先閱讀所有符合條件的文件，再依其規範執行。

| 觸發條件 | 先閱讀 |
| --- | --- |
| 了解專案需求或規劃功能 | [docs/PRD.md](docs/PRD.md) |
| 新增或修改 HTML、CSS、JavaScript 的畫面或互動 | [docs/Frontend.md](docs/Frontend.md) |
| 讀取或寫入 Airtable，包含新增、更新與刪除記錄 | [docs/Airtable.md](docs/Airtable.md) |
| 部署到 GitHub Pages 或 Netlify | [docs/DEPLOY.md](docs/DEPLOY.md) |
