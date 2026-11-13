/**
 * Apple-style Scroll-Triggered Fade-In & Slide-Up (.reveal)
 *
 * Automatically detects elements with `.reveal` (and modifiers `.reveal-fade`,
 * `.reveal-scale`, `.reveal-left`, `.reveal-right`) when they enter the viewport,
 * adding `.is-visible` for smooth GPU-composited entrance transitions and `.is-settled`
 * once the entrance finishes so interactive card hover transitions remain snappy.
 *
 * Supports:
 * - Immediate smooth fade-in for elements already in the viewport (and instant settle for above-viewport elements)
 * - Astro View Transitions (`astro:page-load`)
 * - Live Accessibility Settings (`data-reduce-motion` & `site:preferences-change` & `prefers-reduced-motion`)
 * - Fallback for browsers without IntersectionObserver
 * - Dynamic / client-side content re-scans via `initScrollReveal()`
 */

import { isReducedMotionActive, registerPageLifecycle } from './domUtils';

const REVEAL_BASE_MS = 760;
const REVEAL_SETTLE_BUFFER_MS = 140;

let activeObserver: IntersectionObserver | null = null;
let prefListenerBound = false;

function parseDelayMs(el: HTMLElement): number {
  try {
    const raw = window.getComputedStyle(el).transitionDelay || '0s';
    const first = raw.split(',')[0].trim();
    if (first.endsWith('ms')) return Math.max(0, parseFloat(first) || 0);
    if (first.endsWith('s')) return Math.max(0, (parseFloat(first) || 0) * 1000);
  } catch {}
  return 0;
}

export function settleRevealElement(el: HTMLElement): void {
  el.classList.add('is-visible', 'is-settled');
}

function triggerRevealElement(el: HTMLElement, immediate = false): void {
  if (immediate || isReducedMotionActive()) {
    settleRevealElement(el);
    return;
  }

  if (el.classList.contains('is-settled')) return;
  el.classList.add('is-visible');

  if (el.dataset.revealSettling === '1') return;
  el.dataset.revealSettling = '1';

  const delayMs = parseDelayMs(el);
  let fallbackTimer = 0;

  const finish = () => {
    window.clearTimeout(fallbackTimer);
    el.removeEventListener('transitionend', onTransitionEnd);
    delete el.dataset.revealSettling;
    el.classList.add('is-settled');
  };

  const onTransitionEnd = (e: TransitionEvent) => {
    if (e.target !== el) return;
    if (e.propertyName === 'opacity' || e.propertyName === 'transform') {
      finish();
    }
  };

  el.addEventListener('transitionend', onTransitionEnd);
  fallbackTimer = window.setTimeout(finish, REVEAL_BASE_MS + delayMs + REVEAL_SETTLE_BUFFER_MS);
}

function revealAllImmediately(): void {
  activeObserver?.disconnect();
  document.querySelectorAll<HTMLElement>('.reveal').forEach((el) => {
    settleRevealElement(el);
  });
}

function getObserver(): IntersectionObserver | null {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return null;
  if (activeObserver) return activeObserver;

  activeObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          observer.unobserve(target);
          triggerRevealElement(target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.04,
    }
  );
  return activeObserver;
}

export function initScrollReveal(): void {
  if (typeof window === 'undefined') return;

  if (!prefListenerBound) {
    prefListenerBound = true;
    window.addEventListener('site:preferences-change', () => {
      if (isReducedMotionActive()) {
        revealAllImmediately();
      }
    });
  }

  const elements = document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)');
  if (elements.length === 0) return;

  if (isReducedMotionActive() || !('IntersectionObserver' in window)) {
    elements.forEach((el) => settleRevealElement(el));
    return;
  }

  const observer = getObserver();
  const vh = window.innerHeight || document.documentElement.clientHeight || 800;
  const aboveView: HTMLElement[] = [];
  const inViewBatch: HTMLElement[] = [];
  const belowView: HTMLElement[] = [];

  // Batch all layout reads before any DOM mutations to avoid layout thrashing
  elements.forEach((el) => {
    if (el.dataset.revealQueued === '1') return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= 0) {
      aboveView.push(el);
    } else if (rect.top < vh * 0.94 && rect.bottom > 0) {
      inViewBatch.push(el);
    } else {
      belowView.push(el);
    }
  });

  // Batch DOM writes and observer registrations
  aboveView.forEach((el) => {
    el.dataset.revealQueued = '1';
    settleRevealElement(el);
  });

  belowView.forEach((el) => {
    el.dataset.revealQueued = '1';
    observer?.observe(el);
  });

  if (inViewBatch.length > 0) {
    inViewBatch.forEach((el) => {
      el.dataset.revealQueued = '1';
    });
    // Wait two frames so freshly inserted DOM elements paint their initial opacity: 0 state
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        inViewBatch.forEach((el) => triggerRevealElement(el));
      });
    });
  }
}

// Global exposure for dynamic scripts / developer tools
if (typeof window !== 'undefined') {
  (window as unknown as { initScrollReveal?: typeof initScrollReveal }).initScrollReveal = initScrollReveal;
  registerPageLifecycle(() => initScrollReveal());
}
