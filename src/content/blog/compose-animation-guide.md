---
title: 使用 Jetpack Compose 實作流暢動畫與 Material 3 動態配色
description: 深入探討在現代 Android 應用中如何運用 Jetpack Compose Animation API 與 Material You Dynamic Color 打造自然滑順的使用者體驗。
pubDate: 2026-11-10
category: Jetpack Compose
tags: [Android, Compose, UI, Animation, Material3]
---

在現代 Android 開發中，**Jetpack Compose** 徹底改變了我們構建宣告式 UI 的思維方式。搭配 **Material 3 (Material You)**，我們能輕鬆打造兼具原生美感與個人化色彩的應用程式。

## 什麼是 Dynamic Color？

從 Android 12（API 31）開始引入的動態配色（Dynamic Color），能根據使用者設定的手機桌布自動提取主要色系，並衍生出協調的色調調色盤（Tonal Palettes）。

```kotlin
@Composable
fun MyAppTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
```

## 流暢的過渡動畫：AnimatedVisibility

Compose 的動畫 API 非常直覺，例如展開或收合列表項目的微互動：

```kotlin
AnimatedVisibility(
    visible = isExpanded,
    enter = fadeIn() + expandVertically(),
    exit = fadeOut() + shrinkVertically()
) {
    CardContent(details)
}
```

## 結語

保持介面的簡潔與視覺回饋的流暢度，是提升 App 質感的關鍵。善用 Compose 的聲明式特性，能大幅降低管理 UI 動畫狀態的複雜度。
