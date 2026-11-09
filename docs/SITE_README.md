# ianlyo.dev — Android 開發者作品集、技術部落格與 Beta 測試中心
# ianlyo.dev — Android Developer Portfolio, Blog & Beta Hub

線上站點 / Live site: <https://linnu.dpdns.org>  
使用 [Astro](https://astro.build) 構建，由 GitHub Actions 自動部署至 GitHub Pages。  
Built with [Astro](https://astro.build), deployed to GitHub Pages by GitHub Actions.

> 新手維護指南 / Beginner guide: [`docs/MAINTENANCE_GUIDE.md`](MAINTENANCE_GUIDE.md)

---

## 專案結構 / Architecture

```
src/content/blog/*.md        部落格文章 (Markdown + frontmatter)
src/content/apps/*.yaml      Android App 資料檔 → 自動生成專屬詳情頁面
src/content.config.ts        Typed 結構定義（欄位格式錯誤會在建置時明確報錯）
src/i18n/ui.ts               介面多語系字串，繁體中文 (預設) + 英文
src/layouts/Base.astro       基底版面配置（SEO / OG / Twitter / 語系 / 主題切換）
src/components/              Home, BetaHub, AppPage, AppCard, PostCard
src/pages/                   路由（繁體中文在 /，英文在 /en/）
public/                      靜態資源：CNAME, assets/, apps/<id>/ 圖檔, og/, manifest, sw.js
templates/                   新增文章與 App 的範本檔案
.github/workflows/deploy.yml Push 至 main 分支時自動建置並發布
```

| 功能 / Feature | 實現方式 / How it works |
|---|---|
| 多語系 / i18n | Astro 內建 i18n 路由；預設繁體中文（`/`），英文在 `/en/` |
| 部落格 / Blog | Content Collection、8 大固定分類、自訂標籤、分頁、閱讀時間預估、相關文章、自動目錄、程式碼高亮、RSS (`/rss.xml`) |
| 搜尋 / Search | [Pagefind](https://pagefind.app) 靜態全文檢索索引（建置時自動產生於 `/search/`） |
| Beta 測試中心 / Beta Hub | `/beta/` 與 `/beta/<id>/`（及 `/en/...`）自動由 `apps/*.yaml` 生成 |
| SEO 優化 | 完整標題、描述、標準網址（Canonical）、Open Graph、Twitter Cards、hreflang、JSON-LD 結構化資料、`sitemap-index.xml`、`robots.txt` |
| 主題切換 / Theme | 亮色 / 暗色 / 系統自動跟隨，防閃爍腳本（保持原有邏輯與 LocalStorage） |
| 保留設定 / Preserved | `CNAME`、Teal 主色調、字體、GitHub API 專案瀏覽器 (`script.js`)、PWA、隱私權政策路徑 |

---

## 常用指令 / Commands

```bash
npm install       # 安裝相依套件
npm run dev       # 啟動本地開發伺服器 (http://localhost:4321)
npm run build     # 檢查內容型別 + 靜態建置 + 產生全文檢索索引 → dist/
npm run preview   # 預覽打包產物
```
