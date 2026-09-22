# 臺灣低碳旅行 App：GitHub Pages 發布說明

這是完整網站專案，保留最新版的交通規則、側面交通圖案、英語任務、地圖動畫與 WebM 影片下載。不需要 Gemini 或 API 金鑰。

## 第一次發布（使用 GitHub 網頁）

1. 解壓縮下載的 ZIP；不要直接把 ZIP 上傳 GitHub。
2. 在 GitHub 右上角按「+ → New repository」。名稱可填 `taiwan-trip`，選 Public，勾選 Add a README file，按 Create repository。此做法會公開程式碼，請勿放入學生名冊或密碼。
3. 在儲存庫按「Add file → Upload files」。將解壓縮後資料夾**裡面的檔案和 src 資料夾**拖入；不要把外層 taiwan-trip-github 資料夾整個上傳。按 Commit changes。確認 package.json、package-lock.json、index.html 都在儲存庫首頁。
4. 設定發布工作流程：如果儲存庫已經有 `.github/workflows/deploy.yml`，略過此步。否則按「Add file → Create new file」，檔名輸入 `.github/workflows/deploy.yml`，用記事本開啟壓縮包中的 `deploy-workflow.txt`，將全文貼上，按 Commit changes。這一步可避免上傳時漏掉以點開頭的資料夾。
5. 進入「Settings → Pages」，在 Build and deployment 的 Source 選擇 **GitHub Actions**。
6. 進入「Actions → Publish Taiwan Trip」，按「Run workflow → Run workflow」。如果第一次上傳時工作流程因尚未啟用 Pages 而失敗，完成第 5 步後重新執行即可。
7. 等工作流程顯示綠色勾勾。在「Settings → Pages」按 Visit site，複製真正的網站網址給學生。不要分享 github.com 的程式碼頁面。

網址通常為 `https://你的帳號.github.io/taiwan-trip/`，以 GitHub 顯示的實際網址為準。此專案使用相對資源路徑，儲存庫改名也不需要修改 base。

## 更新程式

下次更新 App 時，替換 `src/App.tsx` 並提交至 main；GitHub Actions 會重新建置並發布。不要只上傳原始 TSX 到儲存庫根目錄。發布未完成前網站仍可能顯示舊版。

## 上課使用

- 老師先在正式網址走一次「選地點 → 交通 → 英語任務 → 成果 → 影片下載」。
- 每組用小組名稱即可，學生不需要登入 GitHub。作品由學生自行下載、上傳 Padlet；網站不會自動集中收件。
- Create Trip Video 完成後按 Download Video，下載無聲 WebM；建議先用學校實際使用的 Chrome／Edge 裝置試播。
- 目前行程為網頁記憶體中的資料，重新整理或關閉分頁會重設，請先保存成果。
- 距離、時間、碳排和航線規則是課堂估算，地圖路線為示意，不是即時導航或訂票資訊。

## 常見問題

- **看到程式碼而非 App**：請開 Settings → Pages 提供的網址。
- **Actions 沒有 Publish Taiwan Trip**：檢查 `.github/workflows/deploy.yml` 是否存在，檔名不要多出 `.txt`。
- **npm ci 找不到檔案**：確認 package.json 和 package-lock.json 在根目錄，而非多包一層資料夾。
- **部署失敗**：先確認 Source 是 GitHub Actions，並查看 Actions 的紅色錯誤步驟。
- **尚未出現網址／404**：確認部署已成功，再重新整理 Pages。

## 本機開發（非老師發布所必需）

安裝 Node.js 22，執行 `npm ci`、`npm run dev`。正式建置使用 `npm run build`，結果在 dist。不要上傳 node_modules。

地圖陸地資料：Natural Earth，public domain。程式使用 React、Lucide、Vite 與 Tailwind CSS。

官方參考：https://vite.dev/guide/static-deploy 、https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
