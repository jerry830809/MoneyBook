# 通用靜態網站部署規範

## 部署前檢查

1. 搜尋待發布的程式碼及文件，確認沒有實際 Token（權杖）、Base ID（資料庫識別碼）或密碼。
2. 確認網站內的 CSS、JavaScript 引用與頁面連結都使用相對路徑。
3. 在本機瀏覽器逐頁確認版面、導覽及操作，完成功能測試後才能部署。
4. 列出待提交檔案與部署目標，取得使用者確認後，才可執行 `git push`（推送到遠端儲存庫）或正式部署。

## GitHub Pages

1. 確認要發布的 GitHub 儲存庫為 Public repository（公開儲存庫）。
2. 在 `Settings` → `Pages` 將發布來源設為 `Deploy from a branch`（從分支部署）。
3. 選擇 `main` 分支與 `/(root)`（根目錄）並儲存。不得選用 `/docs` 作為網站發布目錄。

## Netlify

- 透過 GitHub 匯入時，`Build command`（建置指令）留空，`Publish directory`（發布目錄）指向存放網站 HTML 的專案根目錄。
- 手動部署可使用 Netlify Drop，將已通過部署前檢查的網站資料夾拖曳上傳。
