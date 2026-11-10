# 內容與文字編輯指南 / Content & Text Editing Guide

目標：**改文字、改內容時，不需要碰版面程式碼。** 每一類資訊只有一個存放位置。
Goal: change text or content without touching layout code. Each kind of information lives in exactly one place.

> 發布文章、新增 App、部署流程請見 [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)；整體架構請見 [SITE_README.md](SITE_README.md)。

---

## 1. 我想改…… 要去哪裡？ / Where do I edit?

| 想修改的內容 | 檔案 | 備註 |
|---|---|---|
| 網站名稱、作者、GitHub 帳號、主題色、預設分享圖、RSS 標題 | [`src/config/site.ts`](../src/config/site.ts) | 全站共用，改一處即可 |
| 所有介面文字（導覽列、首頁標語、按鈕、Beta 步驟、頁尾、搜尋框等），中英文 | [`src/i18n/ui.ts`](../src/i18n/ui.ts) | `'zh-Hant'` 與 `en` 兩區塊需同步修改 |
| 部落格文章 | `src/content/blog/*.md` | 範本：`templates/new-blog-post.md` |
| Android App 資訊（版本、連結、功能、FAQ、更新紀錄） | `src/content/apps/*.yaml` | 範本：`templates/new-android-app.yaml` |
| 隱私權政策頁 | `public/myfiles/privacy/<App>/index.html` | 純 HTML |
| 網域 | `astro.config.mjs` 的 `site`、`public/CNAME`、`src/config/site.ts` 的 `url` | 三處需一致 |
| 樣式 | `public/assets/css/site.css`、`style.css` | 僅視覺調整時才需要 |

## 2. 修改介面文字 / Editing UI text

`src/i18n/ui.ts` 依區塊分組，找到對應區塊直接改字串：

| 區塊 | 用途 |
|---|---|
| `siteTitle` / `siteDescription` | 瀏覽器標題與 SEO 描述 |
| `nav` | 導覽列 |
| `hero` | 首頁大標題、簡介、三個按鈕 |
| `stats`、`activity` | GitHub 統計與貢獻圖標題 |
| `home` | 首頁 Beta / 部落格區塊標題 |
| `projects` | 專案搜尋、篩選、載入中、顯示全部等文字 |
| `filters` | 四個分類卡片（`[標題, 說明]`） |
| `beta` | Beta 中心與 App 詳情頁，含 4 步驟、按鈕、狀態標籤 `statusLabels` |
| `blog` | 部落格各頁文字 |
| `footer`、`langSwitch`、`notice` | 頁尾、語言切換、提示 |

規則：
1. 中文與英文**鍵名必須相同**，缺一個 `npm run build` 會直接報型別錯誤。
2. 在頁面中用 `ui.區塊.鍵名` 取用，**不要在 `.astro` 內直接寫死文字**。
3. 新增文字：先在 `zh-Hant` 與 `en` 各加一個鍵，再於元件使用。

> 注意：`public/assets/js/script.js` 內仍有少數由瀏覽器動態產生的英文訊息（如 GitHub 載入失敗、"No repositories match your filters."），修改請直接編輯該檔。

## 3. 修改全站設定 / Editing site settings

編輯 `src/config/site.ts`，例如換 GitHub 帳號只需改 `githubUser`，頁首、頁尾、首頁按鈕、貢獻圖、頭像、JSON-LD 會一起更新。

`public/manifest.json` 為靜態檔，其中的頭像網址需手動同步。

## 4. 修改 App 與文章 / Content

- 欄位說明與流程：見 [MAINTENANCE_GUIDE.md](MAINTENANCE_GUIDE.md)。
- 欄位格式由 [`src/content.config.ts`](../src/content.config.ts) 驗證，填錯時建置會指出檔案與欄位。

## 5. 修改後檢查 / Verify

```bash
npm run dev     # 本地預覽 http://localhost:4321
npm run build   # 型別檢查 + 建置 + 搜尋索引，與 CI 相同
```

## 6. 專案結構速查 / Layout cheat-sheet

```
src/config/site.ts     全站設定（名稱 / 作者 / GitHub / 主題色）
src/i18n/ui.ts         介面文字（中 / 英）
src/content/           文章與 App 內容（Markdown / YAML）
src/components/        頁面區塊（盡量不含文字，文字來自 ui.ts）
src/layouts/Base.astro 共用外框（SEO、導覽、頁尾）
src/pages/             路由
public/                靜態檔案
templates/             新文章 / 新 App 範本
docs/                  說明文件
```
