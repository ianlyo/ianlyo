# Changelog entry template

Paste this at the TOP of the `changelog:` list in `src/content/apps/<app>.yaml`
(keep the indentation - 2 spaces before the dash):

```yaml
  - version: "1.1.0"
    date: "2026-02-01"
    notes:
      - { zh: 修正閃退問題, en: Fixed a crash on launch }
      - { zh: 新增深色模式, en: Added dark mode }
```

Also update `version:` at the top of the same file to match.

# Screenshots template

1. Save PNG/JPG files in `public/apps/<app-id>/` (e.g. `screenshot-1.png`, portrait ~1080x2400).
2. Add them to the app file:

```yaml
screenshots:
  - src: /apps/<app-id>/screenshot-1.png
    alt: { zh: 主畫面, en: Home screen }
```

The first screenshot is also used as the social-share preview image.
