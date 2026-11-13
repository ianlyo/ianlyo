/**
 * Shared Browser & DOM Utilities
 *
 * Centralizes safe `localStorage` access, reduced-motion detection,
 * image loading transitions, toast notifications, scroll gradient CSS
 * variable updates, and Astro lifecycle hooks across client modules.
 */

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Safely read a string value from `localStorage` without throwing in restricted contexts. */
export function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Safely persist a string value in `localStorage` (ignores quota/privacy-mode errors). */
export function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota or private browsing restrictions
  }
}

/**
 * Determine whether reduced motion is currently active, honoring both
 * the user's explicit site preference (`data-reduce-motion`) and OS preference.
 */
export function isReducedMotionActive(): boolean {
  if (typeof document === 'undefined') return true;
  if (document.documentElement.getAttribute('data-reduce-motion') === 'true') return true;
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

/**
 * Fade an `<img>` element in smoothly once loaded (using `.is-loading` opacity class),
 * guarded by a timeout fallback so slow or cached failures never leave the image invisible.
 * When switching URLs dynamically, pass `nextSrc` so listeners attach before `img.src` mutates.
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

/**
 * Create a toast notification trigger bound to a floating `.share-toast` element.
 * Resets active timers cleanly when triggered repeatedly.
 */
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

/**
 * Apply a normalized gradient phase (`[0, 1)`) to an element's `--hero-grad-x/y` CSS custom properties
 * so scroll-linked chromatic gradient shifts remain GPU-composited and uniform across components.
 */
export function setScrollGradientPhase(el: HTMLElement, phase: number): void {
  const normalized = ((phase % 1) + 1) % 1;
  const gradX = `${(normalized * 100).toFixed(1)}%`;
  const gradY = `${(50 + Math.sin(normalized * Math.PI * 2) * 50).toFixed(1)}%`;
  el.style.setProperty('--hero-grad-x', gradX);
  el.style.setProperty('--hero-grad-y', gradY);
}

/**
 * Register a setup callback to execute on initial DOM readiness and subsequent
 * Astro View Transition page loads (`astro:page-load`).
 */
export function registerPageLifecycle(initFn: () => void): void {
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFn);
  } else {
    initFn();
  }
  document.addEventListener('astro:page-load', initFn);
}
