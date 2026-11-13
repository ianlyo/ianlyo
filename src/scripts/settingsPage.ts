import { navigate } from 'astro:transitions/client';
import {
  bindBackButton,
  bindConfirmDialog,
  createToastNotifier,
  registerPageLifecycle,
  safeSetStorage,
} from './domUtils';
import {
  clearAllLocalData,
  getPreferencesState,
  resetAllPreferences,
  setColorTheme,
  setFontScale,
  setHighContrast,
  setProgressBar,
  setReduceMotion,
  setThemeMode,
  type FontScalePref,
  type PreferencesState,
  type ReduceMotionPref,
} from './themeManager';
import type { ColorThemeId, ThemeMode } from '../config/themes';

const PREF_GROUP_SETTERS: Record<string, (value: string) => void> = {
  theme: (val) => setThemeMode(val as ThemeMode),
  motion: (val) => setReduceMotion(val as ReduceMotionPref),
  fontScale: (val) => setFontScale(val as FontScalePref),
};

function setSegmentedGroupActive(page: HTMLElement, groupName: string, value: string): void {
  const group = page.querySelector<HTMLElement>(`[data-setting-group="${groupName}"]`);
  if (!group) return;
  group.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.value === value);
  });
}

function syncSettingsUI(page: HTMLElement, state: PreferencesState): void {
  setSegmentedGroupActive(page, 'theme', state.themeMode);
  setSegmentedGroupActive(page, 'motion', state.reduceMotion);
  setSegmentedGroupActive(page, 'fontScale', state.fontScale);

  const colorNameEl = document.getElementById('color-theme-current-name');
  page.querySelectorAll<HTMLButtonElement>('[data-color-theme-btn]').forEach((btn) => {
    const isActive = btn.dataset.colorThemeBtn === state.colorTheme;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    if (isActive && colorNameEl && btn.dataset.colorName) {
      colorNameEl.textContent = btn.dataset.colorName;
    }
  });

  const hcBtn = page.querySelector<HTMLButtonElement>('[data-setting-switch="highContrast"]');
  hcBtn?.setAttribute('aria-checked', state.highContrast ? 'true' : 'false');

  const pbBtn = page.querySelector<HTMLButtonElement>('[data-setting-switch="progressBar"]');
  pbBtn?.setAttribute('aria-checked', state.progressBar ? 'true' : 'false');
}

let settingsAbortController: AbortController | null = null;

function cleanupSettingsPage(): void {
  settingsAbortController?.abort();
  settingsAbortController = null;
}

/** 初始化設定頁面控制項並同步瀏覽器偏好設定 */
export function initSettingsPage(): void {
  cleanupSettingsPage();
  const page = document.querySelector<HTMLElement>('.settings-page');
  if (!page || page.dataset.bound === '1') return;
  page.dataset.bound = '1';

  settingsAbortController = new AbortController();
  const { signal } = settingsAbortController;

  const toast = document.getElementById('settings-toast');
  const showToast = createToastNotifier(toast, 1800);

  syncSettingsUI(page, getPreferencesState());

  window.addEventListener(
    'site:preferences-change',
    (e) => {
      if (!document.body.contains(page)) return;
      const detail = (e as CustomEvent<PreferencesState>).detail;
      if (detail) syncSettingsUI(page, detail);
    },
    { signal }
  );

  page.querySelectorAll<HTMLElement>('[data-setting-group]').forEach((group) => {
    const groupName = group.dataset.settingGroup || '';
    group.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg-btn');
      const val = btn?.dataset.value;
      if (!val) return;

      if (groupName === 'lang') {
        safeSetStorage('preferred-locale', val);
        const target = val === 'en' ? group.dataset.enUrl : group.dataset.zhUrl;
        if (target && window.location.pathname !== target) {
          void navigate(target, { history: 'replace' });
        }
        return;
      }

      const setter = PREF_GROUP_SETTERS[groupName];
      if (setter) {
        setter(val);
        showToast(toast?.dataset.saved);
      }
    });
  });

  page.querySelector<HTMLElement>('[data-color-theme-group]')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-color-theme-btn]');
    const themeId = btn?.dataset.colorThemeBtn as ColorThemeId | undefined;
    if (!themeId) return;
    setColorTheme(themeId);
    showToast(toast?.dataset.saved);
  });

  page.querySelectorAll<HTMLButtonElement>('[data-setting-switch]').forEach((btn) => {
    const name = btn.dataset.settingSwitch as 'highContrast' | 'progressBar';
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('aria-checked') !== 'true';
      if (name === 'highContrast') setHighContrast(next);
      else setProgressBar(next);
      showToast(toast?.dataset.saved);
    });
  });

  bindBackButton(
    document.getElementById('settings-back-btn'),
    (url) => {
      void navigate(url);
    },
    signal
  );

  document.getElementById('settings-reset-btn')?.addEventListener('click', () => {
    resetAllPreferences();
    showToast(toast?.dataset.reset);
  });

  bindConfirmDialog({
    dialogId: 'settings-confirm-dialog',
    triggerEl: document.getElementById('settings-clear-data-btn'),
    signal,
    onConfirm: async () => {
      await clearAllLocalData();
      showToast(toast?.dataset.cleared);
    },
  });
}

registerPageLifecycle({
  onLoad: initSettingsPage,
  onBeforeSwap: cleanupSettingsPage,
});
