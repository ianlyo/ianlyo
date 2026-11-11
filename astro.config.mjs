import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';

// Custom domain is set by public/CNAME. Change `site` if the domain changes.
export default defineConfig({
  site: 'https://linnu.dpdns.org',
  server: {
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
  },
  trailingSlash: 'always',
  build: { format: 'directory' },
  redirects: {
    '/beta': '/apps-dev/',
    '/beta/health-debug': '/apps-dev/health-debug/',
    '/beta/focus-log': '/apps-dev/focus-log/',
    '/en/beta': '/en/apps-dev/',
    '/en/beta/health-debug': '/en/apps-dev/health-debug/',
    '/en/beta/focus-log': '/en/apps-dev/focus-log/',
  },
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
