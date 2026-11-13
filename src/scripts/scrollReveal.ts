/**
 * 滾動觸發淡入與線性交錯揭露系統 (.reveal)
 *
 * 自動偵測帶有 .reveal（及其修飾類別 .reveal-fade、.reveal-scale、.reveal-left、.reveal-right）
 * 的元素進入可視區域，加上 .is-visible 觸發 GPU 合成進場過渡，並於過渡結束後標記 .is-settled
 * 以恢復交互懸停反應速度。
 *
 * 支援特性：
 * - 可視區域內批次線性交錯（--stagger-index 驅動，每項間隔 50ms）
 * - 相容於 Astro View Transitions（astro:page-load）
 * - 即時無障礙降級（data-reduce-motion、site:preferences-change 與 prefers-reduced-motion）
 * - 動態渲染內容重新掃描（initScrollReveal）
 */

import { isReducedMotionActive } from './domUtils';

const REVEAL_BASE_MS = 760;
const REVEAL_SETTLE_BUFFER_MS = 140;
const MAX_BATCH_STAGGER = 10;

let activeObserver: IntersectionObserver | null = null;
let prefListenerBound = false;

function parseDelayMs(el: HTMLElement): number {
  try {
    const raw = window.getComputedStyle(el).transitionDelay || '0s';
    const first = raw.split(',')[0].trim();
    if (first.endsWith('ms')) return Math.max(0, parseFloat(first) || 0);
    if (first.endsWith('s')) return Math.max(0, (parseFloat(first) || 0) * 1000);
  } catch {
    // 忽略樣式讀取例外
  }
  return 0;
}

/** 立即將元素設為已揭露且定型狀態 */
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
      let batchIndex = 0;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target as HTMLElement;
          observer.unobserve(target);
          if (target.style.getPropertyValue('--stagger-index') === '') {
            target.style.setProperty('--stagger-index', String(Math.min(batchIndex, MAX_BATCH_STAGGER)));
          }
          batchIndex += 1;
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

/** 掃描頁面中的 .reveal 元素並註冊滾動與首屏線性交錯進場 */
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

  /* 先批次讀取所有幾何位置，再進行 DOM 寫入以避免排版抖動 */
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

  aboveView.forEach((el) => {
    el.dataset.revealQueued = '1';
    settleRevealElement(el);
  });

  belowView.forEach((el) => {
    el.dataset.revealQueued = '1';
    observer?.observe(el);
  });

  if (inViewBatch.length > 0) {
    inViewBatch.forEach((el, idx) => {
      el.dataset.revealQueued = '1';
      if (el.style.getPropertyValue('--stagger-index') === '') {
        el.style.setProperty('--stagger-index', String(Math.min(idx, MAX_BATCH_STAGGER)));
      }
    });
    /* 等待兩個動畫影格以確保新插入的 DOM 先繪製初始透明狀態 */
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        inViewBatch.forEach((el) => triggerRevealElement(el));
      });
    });
  }
}

/** 於 Astro 交換 DOM 前中斷現有的滾動觀察器 */
export function cleanupScrollReveal(): void {
  activeObserver?.disconnect();
  activeObserver = null;
}

if (typeof window !== 'undefined') {
  (window as unknown as { initScrollReveal?: typeof initScrollReveal }).initScrollReveal = initScrollReveal;
}
