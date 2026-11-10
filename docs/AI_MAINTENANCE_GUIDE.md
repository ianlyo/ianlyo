# AI 維護與內容更新指引 / AI Maintenance & Content Guide

> **致所有協助維護本專案的 AI 助理（以及開發者）：**  
> 請在進行任何修改前閱讀並嚴格遵守本文件規範。本文件定義了本站的架構約定、單一事實來源（SSOT）、文字與內容更新流程，以及視覺元件設計標準。

---

## 1. 核心原則：單一事實來源 (Single Source of Truth, SSOT)

修改任何內容時，**絕對不要在 `.astro` 元件內直接寫死文字或資料**。每一類資訊都有唯一的存放檔案：

| 修改項目 | 唯一正確的檔案位置 | 備註 |
|---|---|---|
| **全站設定**（作者名稱、網站標題、GitHub 帳號、社群連結、主題色） | [`src/config/site.ts`](../src/config/site.ts) | 修改後全站首頁、頁首、頁尾、頭像與 SEO 一併更新 |
| **介面文字與多語系**（按鈕、導覽列、區段標題、提示訊息、無障礙標籤） | [`src/i18n/ui.ts`](../src/i18n/ui.ts) | `'zh-Hant'` 與 `'en'` 必須維持相同鍵名，否則 TypeScript 會報錯 |
| **Android App 資料**（版本、說明、功能列表、截圖清單、測試連結、FAQ、更新紀錄） | `src/content/apps/<app-id>.yaml` | 範本位於 `templates/new-android-app.yaml` |
| **部落格文章** | `src/content/blog/<slug>.md` | 範本位於 `templates/new-blog-post.md` |
| **靜態資源與圖片**（App 圖示、高解析截圖） | `public/apps/<app-id>/` | 網址直接對應 `/apps/<app-id>/...` |
| **自訂樣式** | `public/assets/css/site.css` 或元件內部 `<style>` | 遵循既有 CSS 變數（支援亮色/暗色主題） |

---

## 2. 截圖區段（Apple 風格輪播展示）規範

在 App 詳情頁（`/beta/<app-id>/`），截圖區段採用獨立封裝元件 [`src/components/ScreenshotGallery.astro`](../src/components/ScreenshotGallery.astro)：

### 設計特色與規定：
1. **圖片為主，不用文字**：
   - 截圖區以純粹的高解析度影像呈現，卡片下方**不放置多餘文字描述或說明文字**，保留 Apple 官網般的純粹視覺衝擊力。
   - `alt` 屬性仍須從 YAML 讀取多語系文字以確保無障礙與 SEO。
2. **符合螢幕的大尺寸設計**：
   - 卡片高度設定為 `clamp(480px, 68vh, 620px)`，在桌面端與行動端皆能佔據合適的視覺焦點。
   - 圓角採用 Apple 風格的 `border-radius: 28px`（行動端 `22px`），搭配環境陰影與微透邊框。
3. **左右箭頭控制項 (`<` 與 `>`)**：
   - 底部右側設有 Apple 經典的毛玻璃圓形 `<` 與 `>` 導覽按鈕（直徑 44px），支援即時滾動與邊界停用狀態。
   - 底部左側設有膠囊型指示標籤（Indicator Dots），點擊可直接跳轉至指定截圖。
   - 支援鍵盤左右鍵（`←` / `→`）與觸控滑動。
4. **全螢幕高解析度檢視（Lightbox 燈箱）**：
   - 點擊任一張輪播截圖，即可開啟全螢幕檢視原始解析度圖片。
   - 具備毛玻璃深色背景遮罩、左上角返回箭頭與檔名、右上角「在新分頁開啟原圖」與關閉鍵。
   - 燈箱內部支援左右箭頭切換與鍵盤快捷鍵（`Esc` 退出、`←` / `→` 切換）。
5. **手機版防裁切規範**：
   - 無論是 `ScrollSequence.astro` 滾動互動區或 `ScreenshotGallery.astro` 輪播區，手機版均設定 `object-fit: contain` 與適切圓角（如 `12px` ~ `16px`），嚴格避免外殼裁切到頂部狀態列或底部導覽列。

---

## 3. 手機版導覽列與側邊抽屜選單 (Google 相簿風格)

在手機寬度（`< 768px`）下：
1. **頂部簡潔導覽列**：
   - 桌面橫向文字連結全部隱藏，徹底避免文字擠壓跑版與換行。
   - 左側保留三條線漢堡按鈕 (`☰`) 與 `IAN.` 品牌標誌。
   - 右側提供搜尋按鈕 (`🔍`) 與主題切換鍵 (`🌓`)。
2. **Google 相簿 / Material 3 側邊展開選單 (`#nav-drawer`)**：
   - 點擊漢堡按鈕由左側平滑滑出抽屜選單，附帶半透明毛玻璃背景遮罩（Backdrop）。
   - 選單項目採用 Material 3 圓角膠囊型高亮標籤（當前頁面以主題強調色膠囊背景顯示）。
   - 包含：首頁、Beta 測試、部落格、專案、搜尋，以及下方的中英文語言切換與 GitHub 連結。
   - 支援點擊遮罩關閉、點擊右上角關閉鍵、點擊項目跳轉關閉以及按 `Esc` 鍵關閉。

---

## 4. 如何新增與更新介面文字 (i18n)

所有 UI 文字集中於 [`src/i18n/ui.ts`](../src/i18n/ui.ts)。

### 新增文字步驟：
1. 打開 `src/i18n/ui.ts`。
2. 在 `'zh-Hant'` 區塊的對應分類下新增鍵值（例如 `beta.myNewButton: '立即體驗'`）。
3. **務必**同時在 `'en'` 區塊相同的分類下新增對應英文字串（例如 `beta.myNewButton: 'Try Now'`）。
4. 在 `.astro` 元件內使用：
   ```astro
   ---
   import { t, type Lang } from '../i18n/ui';
   const { lang } = Astro.props;
   const ui = t(lang).beta;
   ---
   <button>{ui.myNewButton}</button>
   ```

---

## 4. 如何更新 App 資訊與發布新版本

編輯 `src/content/apps/<app-id>.yaml`：

1. **更新版本號**：
   修改 `version: "2.2.3"`（注意版本號請加上引號以避免 YAML 解析為浮點數）。
2. **新增更新日誌 (Changelog)**：
   在 `changelog:` 陣列**最上方**插入新版紀錄：
   ```yaml
   changelog:
     - version: "2.2.3"
       date: "2026-11-15"
       notes:
         - { zh: 改進截圖展示區段為 Apple 風格輪播。, en: Upgraded screenshots section to Apple-style carousel. }
   ```
3. **功能說明**：
   修改 `features:` 中的 `title` 與 `description`。若有對應截圖，可設定 `image:` 或 `images:`。

---

## 5. 程式碼維護與驗證規範

AI 在完成修改後，**必須執行建置檢查**：

```bash
npm run build
```

建置過程會執行：
1. `astro check`：TypeScript 型別檢查與 Content Collection 格式驗證。
2. `astro build`：靜態網站編譯至 `dist/`。
3. `pagefind --site dist`：自動建立全文搜尋索引。

若建置過程無任何 Error，方可確認修改完成。
