import {
  COLOR_THEME_MAP,
  DEFAULT_COLOR_THEME,
  DEFAULT_THEME_MODE,
  isValidColorTheme,
  isValidThemeMode,
  type ColorThemeId,
  type ResolvedThemeMode,
  type ThemeMode,
} from '../config/themes';
import { fadeImageOnLoad, safeGetStorage, safeRemoveStorage, safeSetStorage } from './domUtils';

export type ReduceMotionPref = 'off' | 'on' | 'system';
export type FontScalePref = 'normal' | 'large' | 'xlarge';

export interface PreferencesState {
  themeMode: ThemeMode;
  resolvedTheme: ResolvedThemeMode;
  colorTheme: ColorThemeId;
  reduceMotion: ReduceMotionPref;
  resolvedReduceMotion: boolean;
  fontScale: FontScalePref;
  highContrast: boolean;
  progressBar: boolean;
}

const STORAGE_KEYS = {
  theme: 'theme',
  colorTheme: 'pref-color-theme',
  reduceMotion: 'pref-reduce-motion',
  fontScale: 'pref-font-scale',
  highContrast: 'pref-high-contrast',
  progressBar: 'pref-progress-bar',
} as const;

const THEME_ICONS: Record<ThemeMode, string> = {
  auto: '<svg class="nav-icon theme-icon-system" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8a2.83 2.83 0 0 0 4 4 4 4 0 1 1-4-4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.3 17.7-1.4 1.4"/><path d="m19.1 4.9-1.4 1.4"/></svg>',
  light:
    '<svg class="nav-icon theme-icon-light" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  dark: '<svg class="nav-icon theme-icon-dark" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
};

let systemListenersBound = false;
let transitionTimer: number | undefined;

/** 將已解析的偏好狀態對應至 html 根節點的 data-* 屬性組 */
function getDomAttributeEntries(state: PreferencesState): ReadonlyArray<readonly [string, string]> {
  return [
    ['data-bs-theme', state.resolvedTheme],
    ['data-color-theme', state.colorTheme],
    ['data-reduce-motion', state.resolvedReduceMotion ? 'true' : 'false'],
    ['data-font-scale', state.fontScale],
    ['data-high-contrast', state.highContrast ? 'true' : 'false'],
    ['data-progress-bar', state.progressBar ? 'true' : 'false'],
  ];
}

/** 依據作業系統深淺色偏好解析 auto 主題模式 */
export function resolveThemeMode(mode: ThemeMode): ResolvedThemeMode {
  if (mode === 'light' || mode === 'dark') return mode;
  const prefersDark =
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  return prefersDark ? 'dark' : 'light';
}

export function resolveReduceMotion(pref: ReduceMotionPref): boolean {
  if (pref === 'on') return true;
  if (pref === 'system') {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    );
  }
  return false;
}

export function getPreferencesState(): PreferencesState {
  const rawTheme = safeGetStorage(STORAGE_KEYS.theme);
  const themeMode: ThemeMode = isValidThemeMode(rawTheme) ? rawTheme : DEFAULT_THEME_MODE;

  const rawColor = safeGetStorage(STORAGE_KEYS.colorTheme);
  const colorTheme: ColorThemeId = isValidColorTheme(rawColor) ? rawColor : DEFAULT_COLOR_THEME;

  const rawMotion = safeGetStorage(STORAGE_KEYS.reduceMotion);
  const reduceMotion: ReduceMotionPref =
    rawMotion === 'on' || rawMotion === 'system' || rawMotion === 'off' ? rawMotion : 'off';

  const rawScale = safeGetStorage(STORAGE_KEYS.fontScale);
  const fontScale: FontScalePref =
    rawScale === 'large' || rawScale === 'xlarge' || rawScale === 'normal' ? rawScale : 'normal';

  const highContrast = safeGetStorage(STORAGE_KEYS.highContrast) === 'true';
  const progressBar = safeGetStorage(STORAGE_KEYS.progressBar) !== 'false';

  return {
    themeMode,
    resolvedTheme: resolveThemeMode(themeMode),
    colorTheme,
    reduceMotion,
    resolvedReduceMotion: resolveReduceMotion(reduceMotion),
    fontScale,
    highContrast,
    progressBar,
  };
}

function syncThemeToggleButtons(mode: ThemeMode, withAnimation: boolean): void {
  const toggles = document.querySelectorAll<HTMLButtonElement>('.theme-toggle');
  toggles.forEach((toggle) => {
    const labelMap: Record<ThemeMode, string> = {
      auto: toggle.dataset.labelAuto || 'Theme: System (Click to switch to Light mode)',
      light: toggle.dataset.labelLight || 'Theme: Light (Click to switch to Dark mode)',
      dark: toggle.dataset.labelDark || 'Theme: Dark (Click to switch to System)',
    };
    const nextTitle = labelMap[mode];
    if (toggle.dataset.renderedMode !== mode) {
      toggle.innerHTML = THEME_ICONS[mode];
      toggle.dataset.renderedMode = mode;
      if (withAnimation) {
        toggle.classList.remove('is-switching');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => toggle.classList.add('is-switching'));
        });
      }
    }
    toggle.setAttribute('aria-label', nextTitle);
    toggle.setAttribute('title', nextTitle);
  });
}

function syncContributionChart(colorTheme: ColorThemeId, resolvedTheme: ResolvedThemeMode): void {
  const graphImg = document.getElementById('contribution-graph-img') as HTMLImageElement | null;
  if (!graphImg) return;
  const user = graphImg.dataset.githubUser || 'ianlyo';
  const palette = COLOR_THEME_MAP[colorTheme][resolvedTheme];
  const targetUrl = `https://ghchart.rshah.org/${palette.ghChart}/${user}`;
  if (graphImg.getAttribute('src') !== targetUrl) {
    fadeImageOnLoad(graphImg, { nextSrc: targetUrl });
  }
}

function syncDocumentAttributes(doc: Document, state: PreferencesState): void {
  const root = doc.documentElement;
  for (const [attr, val] of getDomAttributeEntries(state)) {
    root.setAttribute(attr, val);
  }
  const meta = doc.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = COLOR_THEME_MAP[state.colorTheme][state.resolvedTheme].themeColor;
  }
}

/** 將目前 localStorage 的偏好設定套用至 DOM、貢獻圖表、主題標記色與切換按鈕 */
export function applyPreferences(options: { withTransition?: boolean; dispatch?: boolean } = {}): PreferencesState {
  const { withTransition = false, dispatch = true } = options;
  const state = getPreferencesState();

  if (withTransition && document.body && !state.resolvedReduceMotion) {
    document.body.classList.add('theme-transition');
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 350);
  }

  syncDocumentAttributes(document, state);
  syncThemeToggleButtons(state.themeMode, withTransition);
  syncContributionChart(state.colorTheme, state.resolvedTheme);

  if (dispatch && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<PreferencesState>('site:preferences-change', { detail: state }));
  }

  return state;
}

export function setThemeMode(mode: ThemeMode, withTransition = true): PreferencesState {
  safeSetStorage(STORAGE_KEYS.theme, mode);
  return applyPreferences({ withTransition });
}

export function cycleThemeMode(withTransition = true): PreferencesState {
  const { themeMode } = getPreferencesState();
  const next: ThemeMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
  return setThemeMode(next, withTransition);
}

export function setColorTheme(colorTheme: ColorThemeId, withTransition = true): PreferencesState {
  safeSetStorage(STORAGE_KEYS.colorTheme, colorTheme);
  return applyPreferences({ withTransition });
}

export function setReduceMotion(pref: ReduceMotionPref): PreferencesState {
  safeSetStorage(STORAGE_KEYS.reduceMotion, pref);
  return applyPreferences({ withTransition: false });
}

export function setFontScale(scale: FontScalePref): PreferencesState {
  safeSetStorage(STORAGE_KEYS.fontScale, scale);
  return applyPreferences({ withTransition: false });
}

export function setHighContrast(enabled: boolean): PreferencesState {
  safeSetStorage(STORAGE_KEYS.highContrast, enabled ? 'true' : 'false');
  return applyPreferences({ withTransition: false });
}

export function setProgressBar(enabled: boolean): PreferencesState {
  safeSetStorage(STORAGE_KEYS.progressBar, enabled ? 'true' : 'false');
  return applyPreferences({ withTransition: false });
}

export function resetAllPreferences(): PreferencesState {
  Object.values(STORAGE_KEYS).forEach((key) => safeRemoveStorage(key));
  return applyPreferences({ withTransition: true });
}

/** 清除所有本機儲存資料（localStorage、sessionStorage、Cookie、Cache Storage 與 Service Worker） */
export async function clearAllLocalData(): Promise<PreferencesState> {
  try {
    localStorage.clear();
  } catch {
    /* 忽略受限環境錯誤 */
  }

  try {
    sessionStorage.clear();
  } catch {
    /* 忽略受限環境錯誤 */
  }

  if (typeof document !== 'undefined' && document.cookie) {
    document.cookie.split(';').forEach((entry) => {
      const name = entry.split('=')[0]?.trim();
      if (name) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    });
  }

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    } catch {
      /* 忽略 Cache Storage 存取限制 */
    }
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister()));
    } catch {
      /* 忽略 Service Worker 存取限制 */
    }
  }

  return applyPreferences({ withTransition: true });
}

function isDomStateStale(state: PreferencesState): boolean {
  const root = document.documentElement;
  return getDomAttributeEntries(state).some(([attr, val]) => root.getAttribute(attr) !== val);
}

export function syncPreferencesIfStale(dispatch = true): void {
  const state = getPreferencesState();
  if (isDomStateStale(state)) {
    applyPreferences({ withTransition: false, dispatch });
  }
}

export function initThemeManager(): void {
  applyPreferences({ withTransition: false, dispatch: false });

  if (systemListenersBound || typeof window === 'undefined') return;
  systemListenersBound = true;

  const colorSchemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)');
  colorSchemeMedia?.addEventListener?.('change', () => {
    if (getPreferencesState().themeMode === 'auto') {
      applyPreferences({ withTransition: true });
    }
  });

  const reduceMotionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  reduceMotionMedia?.addEventListener?.('change', () => {
    if (getPreferencesState().reduceMotion === 'system') {
      applyPreferences({ withTransition: false });
    }
  });

  window.addEventListener('storage', (event) => {
    if (!event.key || Object.values(STORAGE_KEYS).includes(event.key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])) {
      applyPreferences({ withTransition: false });
    }
  });

  /* 當透過瀏覽器上一頁/下一頁快取 (bfcache) 返回或切換分頁時立即同步狀態 */
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      applyPreferences({ withTransition: false, dispatch: true });
    } else {
      syncPreferencesIfStale(true);
    }
  });

  window.addEventListener('focus', () => {
    syncPreferencesIfStale(true);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncPreferencesIfStale(true);
    }
  });

  document.addEventListener('astro:before-swap', (event) => {
    const nextDoc = (event as Event & { newDocument?: Document }).newDocument;
    if (nextDoc) {
      syncDocumentAttributes(nextDoc, getPreferencesState());
    }
  });

  document.addEventListener('astro:after-swap', () => {
    applyPreferences({ withTransition: false, dispatch: true });
  });
}
