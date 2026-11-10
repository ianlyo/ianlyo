---
title: 歡迎來到我的技術部落格
description: 這是一篇範例文章，示範如何用 Markdown 發佈文章、使用分類、標籤、程式碼區塊與目錄。
pubDate: 2026-11-10
category: Development Notes
tags: [部落格, Astro, 範例]
---

這是範例文章。要發佈新文章，只要在 `src/content/blog/` 新增一個 `.md` 檔並 push 到 GitHub，網站就會自動重新建置。

## 如何新增文章

複製 `templates/new-blog-post.md`，修改 frontmatter 與內容即可。

## 程式碼區塊

支援語法高亮：

```kotlin
@Composable
fun Greeting(name: String) {
    Text(text = "Hello, $name!")
}
```

## 分類與標籤

分類必須是固定的八個之一（見 `src/content.config.ts`）；標籤可以自由新增。

### 草稿

在 frontmatter 加入 `draft: true`，文章就不會被發佈。

> 刪除這篇範例文章前，請先新增你自己的第一篇文章。
