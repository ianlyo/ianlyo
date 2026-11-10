# AGENTS.md — Instructions for AI Assistants

This repository is built with **Astro 5** (TypeScript, Content Collections, Pagefind search, i18n routing).

When maintaining or updating this project, follow these instructions strictly:

## 1. Single Source of Truth (SSOT)
- **NEVER** hardcode user-facing text inside `.astro` components.
- **UI & copy text**: Put all translations into `src/i18n/ui.ts` under both `zh-Hant` and `en`.
- **Site metadata & links**: Edit `src/config/site.ts`.
- **Android App data & changelog**: Edit YAML files in `src/content/apps/<app-id>.yaml`.
- **Blog posts**: Markdown files in `src/content/blog/<slug>.md`.

## 2. Detailed Guides in `docs/`
- Read [`docs/AI_MAINTENANCE_GUIDE.md`](docs/AI_MAINTENANCE_GUIDE.md) for full architecture and updating rules.
- Read [`docs/EDITING_GUIDE.md`](docs/EDITING_GUIDE.md) for content and text editing conventions.
- Read [`docs/MAINTENANCE_GUIDE.md`](docs/MAINTENANCE_GUIDE.md) for publishing workflows and release guidelines.

## 3. Screenshots & Media Design
- Screenshots in `/beta/<app-id>/` are rendered via `src/components/ScreenshotGallery.astro`.
- Follow Apple.com design standards:
  - Responsive large cards with rounded corners (`border-radius: 28px`, mobile `16px`).
  - Image-focused without distracting text captions underneath (`圖片為主不用文字`).
  - Circular glass `<` and `>` arrow buttons, bottom indicator pills, touch swipe, and keyboard navigation.
  - NEVER crop screenshots on mobile devices: always ensure `object-fit: contain` and clean aspect ratio so status/navigation bars are 100% visible.

## 4. Mobile Navigation
- Mobile screens (< 768px) use a Google Photos / Material 3 slide-out Navigation Drawer (`#nav-drawer`).
- Triggered by a 3-line hamburger menu button (`☰`) in the header.
- Desktop navigation links (`.nav-links`) are cleanly hidden on mobile to avoid header overflow.

## 5. Verification
Always verify changes with:
```bash
npm run build
```
Ensure 0 errors in type checking and build.
