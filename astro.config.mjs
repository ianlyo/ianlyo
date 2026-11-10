import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Custom domain is set by public/CNAME. Change `site` if the domain changes.
export default defineConfig({
  site: 'https://linnu.dpdns.org',
  trailingSlash: 'always',
  build: { format: 'directory' },
  i18n: {
    defaultLocale: 'zh-Hant',
    locales: ['zh-Hant', 'en'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    icon(),
    sitemap({
      i18n: { defaultLocale: 'zh-Hant', locales: { 'zh-Hant': 'zh-Hant', en: 'en' } },
    }),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      wrap: true,
    },
  },
});
