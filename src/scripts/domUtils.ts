/**
 * 共用瀏覽器與 DOM 工具模組
 *
 * 集中管理安全的 localStorage 存取、動態減少偏好偵測、
 * 圖片載入淡入過渡、提示訊息觸發、滾動漸層 CSS 變數更新，
 * 以及跨模組的 Astro 頁面生命週期註冊機制。
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 安全讀取 localStorage 字串值，避免在受限環境拋出例外 */
export function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** 安全寫入 localStorage 字串值（忽略配額或隱私瀏覽限制錯誤） */
export function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* 忽略儲存空間配額或無痕模式寫入限制 */
  }
}

/** 安全移除 localStorage 指定鍵值（忽略受限環境錯誤） */
export function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* 忽略無痕模式或受限環境錯誤 */
  }
}

/** 判斷目前是否啟用動態減少模式（同時考量網站設定與作業系統偏好） */
export function isReducedMotionActive(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.documentElement.getAttribute('data-reduce-motion') === 'true') return true;
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

/**
 * 圖片載入完成後平滑淡入（使用 .is-loading 透明度類別），
 * 並附帶逾時保護避免慢速或快取失敗導致圖片保持隱藏。
 */
export function fadeImageOnLoad(
  img: HTMLImageElement | null,
  options: { nextSrc?: string; fallbackTimeoutMs?: number } = {}
): void {
  if (!img) return;
  const { nextSrc, fallbackTimeoutMs = 2500 } = options;
  const clearLoading = () => img.classList.remove('is-loading');

  img.classList.add('is-loading');
  img.addEventListener('load', clearLoading, { once: true });
  img.addEventListener('error', clearLoading, { once: true });
  window.setTimeout(clearLoading, fallbackTimeoutMs);

  if (nextSrc !== undefined) {
    img.src = nextSrc;
  }

  if (img.complete) {
    clearLoading();
  }
}

/** 建立綁定至 .share-toast 浮動元素的提示訊息觸發器 */
export function createToastNotifier(toastEl: HTMLElement | null, durationMs = 2000): (message?: string) => void {
  let timer: number | undefined;
  return (message?: string) => {
    if (!toastEl || !message) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => toastEl.classList.remove('is-visible'), durationMs);
  };
}

/** 將標準化漸層相位 [0, 1) 套用至元素的 --hero-grad-x/y CSS 自訂變數 */
export function setScrollGradientPhase(el: HTMLElement, phase: number): void {
  const normalized = ((phase % 1) + 1) % 1;
  const gradX = `${(normalized * 100).toFixed(1)}%`;
  const gradY = `${(50 + Math.sin(normalized * Math.PI * 2) * 50).toFixed(1)}%`;
  el.style.setProperty('--hero-grad-x', gradX);
  el.style.setProperty('--hero-grad-y', gradY);
}

export interface PageLifecycleHooks {
  onLoad: () => void;
  onBeforeSwap?: () => void;
}

const PAGE_GEN_KEY = '__sitePageGeneration';

function getPageGeneration(): number {
  if (typeof window === 'undefined') return 1;
  const win = window as unknown as Record<string, number | undefined>;
  return win[PAGE_GEN_KEY] ?? 1;
}

function initPageGenerationTracker(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const win = window as unknown as Record<string, unknown>;
  if (win[PAGE_GEN_KEY] !== undefined) return;
  win[PAGE_GEN_KEY] = 1;
  document.addEventListener('astro:before-swap', () => {
    win[PAGE_GEN_KEY] = ((win[PAGE_GEN_KEY] as number) || 1) + 1;
  });
}

/**
 * 統一註冊初始載入與 Astro View Transitions 換頁生命週期回呼，
 * 確保每次頁面造訪時 onLoad 僅執行一次。
 */
export function registerPageLifecycle(hooks: (() => void) | PageLifecycleHooks): void {
  if (typeof document === 'undefined') return;
  initPageGenerationTracker();

  const { onLoad, onBeforeSwap } = typeof hooks === 'function' ? { onLoad: hooks } : hooks;
  let lastHandledGen = 0;

  const runOnceForCurrentVisit = () => {
    const gen = getPageGeneration();
    if (lastHandledGen === gen) return;
    lastHandledGen = gen;
    onLoad();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runOnceForCurrentVisit, { once: true });
  } else {
    runOnceForCurrentVisit();
  }

  document.addEventListener('astro:page-load', runOnceForCurrentVisit);
  if (onBeforeSwap) {
    document.addEventListener('astro:before-swap', onBeforeSwap);
  }
}

export interface ConfirmDialogOptions {
  dialogId: string;
  triggerEl: HTMLElement | null;
  onConfirm: () => void | Promise<void>;
  signal?: AbortSignal;
}

/** 綁定共用 <dialog> 確認視窗的開啟、取消、遮罩點擊與確認回呼 */
export function bindConfirmDialog({
  dialogId,
  triggerEl,
  onConfirm,
  signal,
}: ConfirmDialogOptions): void {
  const dialog = document.getElementById(dialogId) as HTMLDialogElement | null;
  const cancelBtn = dialog?.querySelector<HTMLElement>('[data-dialog-cancel]');
  const confirmBtn = dialog?.querySelector<HTMLElement>('[data-dialog-confirm]');

  triggerEl?.addEventListener(
    'click',
    () => {
      if (dialog && typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        void onConfirm();
      }
    },
    { signal }
  );

  cancelBtn?.addEventListener('click', () => dialog?.close(), { signal });

  dialog?.addEventListener(
    'click',
    (e) => {
      if (e.target === dialog) dialog.close();
    },
    { signal }
  );

  confirmBtn?.addEventListener(
    'click',
    () => {
      dialog?.close();
      void onConfirm();
    },
    { signal }
  );

  signal?.addEventListener('abort', () => {
    if (dialog?.open) dialog.close();
  });
}

/** 綁定返回上一頁按鈕（優先使用瀏覽器歷史紀錄，無歷史時導向 fallbackUrl） */
export function bindBackButton(
  buttonEl: HTMLElement | null,
  onFallback: (url: string) => void,
  signal?: AbortSignal
): void {
  buttonEl?.addEventListener(
    'click',
    () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        onFallback(buttonEl.dataset.fallbackUrl || '/');
      }
    },
    { signal }
  );
}
