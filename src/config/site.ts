/**
 * 全站共用設定（單一來源）/ Site-wide settings (single source of truth).
 *
 * 想改網站名稱、作者、GitHub 帳號、主題色等，只需修改這個檔案。
 * Edit this file to change the site name, author, GitHub account, theme color, etc.
 * 介面文字請改 `src/i18n/ui.ts`。See docs/EDITING_GUIDE.md.
 *
 * 注意：網域 (`site`) 仍定義在 astro.config.mjs 與 public/CNAME；此處 `url` 需保持一致。
 */
const githubUser = 'ianlyo';

export const SITE = {
  /** 網站簡稱（標題尾綴、og:site_name、頁尾） */
  name: 'ianlyo',
  /** 作者顯示名稱（SEO / JSON-LD） */
  author: 'Ian',
  /** 正式網址（需與 astro.config.mjs 的 site 一致，結尾含 /） */
  url: 'https://linnu.dpdns.org/',
  /** 瀏覽器主題色 */
  themeColor: '#4f46e5',
  /** 預設社群分享圖（放在 public/ 底下） */
  ogImage: '/og/default.png',
  /** 社群分享圖替代文字 */
  ogImageAlt: 'ianlyo - Developer Portfolio & Apps Showcase',
  /** RSS 標題 / 描述 */
  rss: {
    title: 'ianlyo - Technical Blog',
    description: 'Software development notes, tutorials and project updates by Ian.',
  },
  github: {
    user: githubUser,
    profileUrl: `https://github.com/${githubUser}`,
    reposUrl: `https://github.com/${githubUser}?tab=repositories`,
    avatarUrl: `https://github.com/${githubUser}.png`,
    /** 首頁貢獻圖 */
    contributionChartUrl: `https://ghchart.rshah.org/4f46e5/${githubUser}`,
  },
} as const;
