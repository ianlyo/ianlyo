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

function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

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
    graphImg.src = targetUrl;
  }
}

function syncMetaThemeColor(colorTheme: ColorThemeId, resolvedTheme: ResolvedThemeMode): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  meta.content = COLOR_THEME_MAP[colorTheme][resolvedTheme].themeColor;
}

export function applyPreferences(options: { withTransition?: boolean; dispatch?: boolean } = {}): PreferencesState {
  const { withTransition = false, dispatch = true } = options;
  const state = getPreferencesState();
  const root = document.documentElement;

  if (withTransition && document.body && !state.resolvedReduceMotion) {
    document.body.classList.add('theme-transition');
    window.clearTimeout(transitionTimer);
    transitionTimer = window.setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 350);
  }

  root.setAttribute('data-bs-theme', state.resolvedTheme);
  root.setAttribute('data-color-theme', state.colorTheme);
  root.setAttribute('data-reduce-motion', state.resolvedReduceMotion ? 'true' : 'false');
  root.setAttribute('data-font-scale', state.fontScale);
  root.setAttribute('data-high-contrast', state.highContrast ? 'true' : 'false');
  root.setAttribute('data-progress-bar', state.progressBar ? 'true' : 'false');

  syncMetaThemeColor(state.colorTheme, state.resolvedTheme);
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
  safeSetStorage(STORAGE_KEYS.theme, DEFAULT_THEME_MODE);
  safeSetStorage(STORAGE_KEYS.colorTheme, DEFAULT_COLOR_THEME);
  safeSetStorage(STORAGE_KEYS.reduceMotion, 'off');
  safeSetStorage(STORAGE_KEYS.fontScale, 'normal');
  safeSetStorage(STORAGE_KEYS.highContrast, 'false');
  safeSetStorage(STORAGE_KEYS.progressBar, 'true');
  return applyPreferences({ withTransition: true });
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
}
