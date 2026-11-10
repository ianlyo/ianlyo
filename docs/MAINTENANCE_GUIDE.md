# 維護指南 / Maintenance Guide

完全不需要更動任何前端程式碼。所有更新都只需透過新增或編輯 Markdown / YAML 檔案，並 push 到 GitHub，GitHub Actions 就會在約 1–2 分鐘內自動重新建置並發布網站（可在 GitHub 儲存庫的 **Actions** 標籤查看）。

> 修改介面文字或全站設定請見 [EDITING_GUIDE.md](EDITING_GUIDE.md)；AI 助理專用規範請見 [AI_MAINTENANCE_GUIDE.md](AI_MAINTENANCE_GUIDE.md)。

You never need to touch the frontend codebase. Everything is done by adding or editing files, then pushing to GitHub. GitHub Actions rebuilds and publishes the site in 1–2 minutes.

---

## 第一次設定（只需做一次）/ One-time GitHub Setting
進入 GitHub 儲存庫 → **Settings → Pages → Build and deployment → Source: 選擇「GitHub Actions」**。自訂網域保持為 `linnu.dpdns.org`（由 `public/CNAME` 控制）。

---

## 發布新文章 / Publish a Blog Post
1. 複製 `templates/new-blog-post.md` 至 `src/content/blog/<文章檔名>.md`（檔名即為網址路徑，例如 `/blog/my-post/`）。
2. 編輯頂部的 frontmatter 區塊（`title` 標題、`description` 簡介、`pubDate` 日期、`category` 分類、`tags` 標籤），並在下方開始用 Markdown 撰寫文章內容。
3. 提交（commit）並 push 到 GitHub 即可。
4. 若文章尚未寫完，可在 frontmatter 加上 `draft: true` 隱藏該文章。

> **分類說明**：分類必須是範本中所列的 8 個固定分類之一；標籤（tags）則可自由填寫。

---

## 新增 Android App / Add an Android App
1. 複製 `templates/new-android-app.yaml` 至 `src/content/apps/<app-id>.yaml`。
2. 將應用程式圖示與高解析截圖（建議 1080×2400 或原始手機尺寸）放入 `public/apps/<app-id>/` 目錄。
3. 填寫 YAML 內的各項欄位；截圖清單加入 `screenshots:` 陣列，頁面會自動以 Apple 風格的大尺寸橫向輪播呈現（圖片為主不用多餘文字，附帶 `<` 與 `>` 圓形按鈕、指示條與觸控滑動支援）。
4. 若尚未有測試或商店連結，可保留為 `""`（頁面上會以停用狀態的「佔位」按鈕顯示）。
5. Push 到 GitHub 後，頁面會自動生成於 `/beta/<app-id>/` 以及 `/en/beta/<app-id>/`。

---

## 填寫 Health Debug 實際資料 / Fill in Health Debug
編輯 `src/content/apps/health-debug.yaml`，將標示為 `PLACEHOLDER` 的內容替換為實際資料（`packageName`、`version`、`minAndroid`、`optInUrl`、`googleGroupUrl`、`playStoreUrl`、`githubUrl`、`feedbackUrl`、截圖路徑等）。

---

## 更新版本與 Changelog / Update Version & Changelog
修改該 App YAML 內的 `version:`，並在 `changelog:` 最上方新增最新一筆版本紀錄（格式可參考 `templates/changelog-and-screenshots.md`）。

---

## 本地預覽（選用）/ Preview Locally (Optional)
若您有安裝 Node.js，可在終端機執行：
```bash
npm install   # 僅需執行一次
npm run dev   # 開啟 http://localhost:4321 預覽
```
若欄位填寫格式有誤，執行 `npm run build` 會直接明確指出錯誤的檔案與欄位名稱。

---

## 常見問題與除錯 / Troubleshooting
- **GitHub Actions 建置失敗**：開啟失敗的 Actions 紀錄，通常會直接列出是哪個檔案的哪個欄位格式不符（例如 `status` 必須是 `closed-beta`、`open-beta`、`released`、`coming-soon` 或 `paused`）。
- **YAML 格式注意事項**：縮排請使用空格（不要用 Tab）；版本號請加上引號（例如 `"1.0"`）。
- **Google Play Beta 流程**：頁面已內建標準 4 步驟導引 — 加入 Google 群組 → 開啟測試頁面（相同 Google 帳號）→ 接受測試並安裝 → 於 Google Play 提交私人意見回饋。
