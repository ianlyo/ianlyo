/**
 * 全域跨頁轉場分類與動態編排控制器
 *
 * 負責於 Astro ClientRouter 導覽生命週期中協調以下機制：
 * 1. 判斷導覽方向（forward 前進深層 / back 返回上層）並掛載 data-transition-direction
 * 2. 分類轉場語意（drill / rise / slide-forward / slide-back / overlay / lang）並掛載 data-vt
 * 3. 驅動頂部 2px 線性載入光軌（#vt-loading-bar）之即時進度推進與完成歸零
 * 4. 於 DOM 交換後與載入完成時自動指派 --stagger-index，驅動瀑布流線性交錯進場
 */

import { isReducedMotionActive } from './domUtils';

export type TransitionDirection = 'forward' | 'back';

export type TransitionKind =
  | 'drill'
  | 'rise'
  | 'slide-forward'
  | 'slide-back'
  | 'overlay'
  | 'lang';

interface RouteInfo {
  lang: 'en' | 'zh-Hant';
  segments: string[];
}

interface PreparationEvent extends Event {
  from: URL;
  to: URL;
  direction: string;
}

interface BeforeSwapEvent extends Event {
  newDocument?: Document;
}

const EN_PREFIX = /^\/en(?=\/|$)/;
const OVERLAY_SECTIONS = new Set(['search', 'settings']);
const VT_ATTR = 'vt';
const DIRECTION_ATTR = 'transitionDirection';
const LOADING_BAR_ID = 'vt-loading-bar';

/** 保持轉場方向屬性直到首屏進場動畫結束的延遲毫秒數 */
const CLEAR_DELAY_MS = 1100;
/** 載入光軌每次模擬遞增的線性步進間隔 */
const PROGRESS_TICK_MS = 90;
/** 首屏交錯元素索引上限 */
const MAX_HERO_STAGGER = 10;
/** 清單與卡片群組子元素索引上限 */
const MAX_GROUP_STAGGER = 12;

const STAGGER_GROUP_SELECTOR = [
  '.card-grid',
  '.stagger-group',
  '.capabilities-grid',
  '.featured-grid',
  '.project-grid',
  '.settings-sections',
  '.hero-stats',
  '.chip-row',
].join(', ');

let activeKind: TransitionKind | null = null;
let activeDirection: TransitionDirection | null = null;
let clearTimer: number | undefined;
let progressTimer: number | undefined;
let progressHideTimer: number | undefined;
let currentProgress = 0;
let bound = false;

function parseRoute(url: URL): RouteInfo {
  return {
    lang: EN_PREFIX.test(url.pathname) ? 'en' : 'zh-Hant',
    segments: url.pathname.replace(EN_PREFIX, '').split('/').filter(Boolean),
  };
}

/** 判斷是否為同區段的分頁路由（例如 /blog/2/） */
function isPaginationOf(section: string, segments: string[]): boolean {
  return segments[0] === section && segments.length === 2 && /^\d+$/.test(segments[1]);
}

/** 解析分頁頁碼，根目錄頁碼視為 1 */
function extractPageNumber(section: string, segments: string[]): number {
  if (segments[0] !== section) return 1;
  if (segments.length === 2 && /^\d+$/.test(segments[1])) {
    return parseInt(segments[1], 10);
  }
  return 1;
}

/** 判斷導覽屬於前進深層頁面或返回上層頁面 */
export function resolveTransitionDirection(
  from: URL,
  to: URL,
  rawDirection: string
): TransitionDirection {
  if (rawDirection === 'back') return 'back';

  const a = parseRoute(from);
  const b = parseRoute(to);
  const sameSection = a.segments[0] === b.segments[0];
  const isPaging =
    sameSection &&
    Boolean(b.segments[0]) &&
    (isPaginationOf(b.segments[0], a.segments) || isPaginationOf(b.segments[0], b.segments));

  if (isPaging) {
    const prevPage = extractPageNumber(b.segments[0], a.segments);
    const nextPage = extractPageNumber(b.segments[0], b.segments);
    return nextPage < prevPage ? 'back' : 'forward';
  }

  if (b.segments.length < a.segments.length) return 'back';
  return 'forward';
}

/** 分類跨頁導覽語意類型 */
export function resolveTransitionKind(
  from: URL,
  to: URL,
  direction: string
): TransitionKind {
  const a = parseRoute(from);
  const b = parseRoute(to);

  if (a.lang !== b.lang && a.segments.join('/') === b.segments.join('/')) return 'lang';
  if (b.segments.length > 0 && OVERLAY_SECTIONS.has(b.segments[0])) return 'overlay';

  const sameSection = a.segments[0] === b.segments[0];
  const isPaging =
    sameSection &&
    Boolean(b.segments[0]) &&
    (isPaginationOf(b.segments[0], a.segments) || isPaginationOf(b.segments[0], b.segments));

  if (!isPaging) {
    if (b.segments.length > a.segments.length) return 'drill';
    if (b.segments.length < a.segments.length) return 'rise';
  }
  return direction === 'back' ? 'slide-back' : 'slide-forward';
}

/** 將當前的轉場語意與方向屬性套用至指定的 Document 根節點 */
function applyTransitionAttributes(targetDoc: Document = document): void {
  const root = targetDoc.documentElement;
  if (!root) return;
  if (activeKind) root.dataset[VT_ATTR] = activeKind;
  if (activeDirection) root.dataset[DIRECTION_ATTR] = activeDirection;
}

/** 排程清除暫態轉場屬性，避免影響後續靜態互動 */
function scheduleClearAttributes(): void {
  window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    activeKind = null;
    activeDirection = null;
    delete document.documentElement.dataset[VT_ATTR];
    delete document.documentElement.dataset[DIRECTION_ATTR];
  }, CLEAR_DELAY_MS);
}

function getLoadingBar(): HTMLElement | null {
  return document.getElementById(LOADING_BAR_ID);
}

function setLoadingBarState(state: 'idle' | 'active' | 'finishing', progress: number): void {
  const bar = getLoadingBar();
  if (!bar) return;
  currentProgress = Math.max(0, Math.min(1, progress));
  bar.style.setProperty('--vt-progress', currentProgress.toFixed(3));
  if (state === 'idle') {
    delete bar.dataset.loading;
  } else {
    bar.dataset.loading = state;
  }
}

function stopLoadingTimers(): void {
  window.clearInterval(progressTimer);
  window.clearTimeout(progressHideTimer);
}

/** 啟動頂部 2px 線性載入光軌並持續推進進度 */
function startLoadingBar(): void {
  if (isReducedMotionActive()) return;
  stopLoadingTimers();
  setLoadingBarState('active', 0.18);

  progressTimer = window.setInterval(() => {
    if (currentProgress >= 0.85) {
      window.clearInterval(progressTimer);
      return;
    }
    const step = currentProgress < 0.5 ? 0.12 : 0.04;
    setLoadingBarState('active', Math.min(0.85, currentProgress + step));
  }, PROGRESS_TICK_MS);
}

/** 完成線性載入光軌並在淡出後重設進度 */
function finishLoadingBar(): void {
  window.clearInterval(progressTimer);
  const bar = getLoadingBar();
  if (!bar || !bar.dataset.loading) return;

  setLoadingBarState('finishing', 1);
  window.clearTimeout(progressHideTimer);
  progressHideTimer = window.setTimeout(() => {
    setLoadingBarState('idle', 0);
  }, 180);
}

/** 為頁面子元素指派 --stagger-index，形成線性交錯瀑布流進場節奏 */
export function applyStaggerChoreography(root: ParentNode = document): void {
  if (typeof document === 'undefined') return;

  /* 1. 為首屏進場與明確標記交錯的元素依序設定遞增索引 */
  const heroTargets = root.querySelectorAll<HTMLElement>(
    '.hero-enter, .hero-enter-scale, .hero-enter-fade, [data-stagger-item]'
  );
  heroTargets.forEach((el, index) => {
    if (el.style.getPropertyValue('--stagger-index') !== '') return;
    const hasDelayClass = Array.from(el.classList).some((cls) => cls.startsWith('enter-delay-'));
    if (hasDelayClass) return;
    el.style.setProperty('--stagger-index', String(Math.min(index, MAX_HERO_STAGGER)));
  });

  /* 2. 為卡片網格與清單容器內的直接子元素設定順序交錯索引 */
  const groups = root.querySelectorAll<HTMLElement>(STAGGER_GROUP_SELECTOR);
  groups.forEach((group) => {
    const children = Array.from(group.children) as HTMLElement[];
    children.forEach((child, idx) => {
      const target = child.matches('.reveal, [data-stagger-item]')
        ? child
        : child.querySelector<HTMLElement>('.reveal, [data-stagger-item]') || child;
      if (target.style.getPropertyValue('--stagger-index') !== '') return;
      target.style.setProperty('--stagger-index', String(Math.min(idx, MAX_GROUP_STAGGER)));
    });
  });
}

/** 綁定全域 Astro View Transitions 生命週期事件（單例安全，可重複呼叫） */
export function initViewTransitions(): void {
  if (typeof document === 'undefined') return;
  applyStaggerChoreography(document);

  if (bound) return;
  bound = true;

  /* 準備載入新頁面前：判定方向與類型，啟動頂部線性進度光軌 */
  document.addEventListener('astro:before-preparation', (event) => {
    const { from, to, direction } = event as PreparationEvent;
    window.clearTimeout(clearTimer);
    activeDirection = resolveTransitionDirection(from, to, direction);
    activeKind = resolveTransitionKind(from, to, direction);
    applyTransitionAttributes(document);
    startLoadingBar();
  });

  /* 新頁面資源解析完畢後：線性光軌推進至接近完成 */
  document.addEventListener('astro:after-preparation', () => {
    window.clearInterval(progressTimer);
    const bar = getLoadingBar();
    if (bar?.dataset.loading) {
      setLoadingBarState('finishing', Math.max(currentProgress, 0.92));
    }
  });

  /* DOM 交換前：預先將方向與轉場屬性同步至新文件，防止視覺閃爍 */
  document.addEventListener('astro:before-swap', (event) => {
    const nextDoc = (event as BeforeSwapEvent).newDocument;
    if (nextDoc) {
      applyTransitionAttributes(nextDoc);
    }
  });

  /* DOM 交換完成後：確認屬性掛載、更新載入光軌並指派瀑布流交錯索引 */
  document.addEventListener('astro:after-swap', () => {
    applyTransitionAttributes(document);
    const bar = getLoadingBar();
    if (bar && activeKind) {
      setLoadingBarState('finishing', 0.98);
    }
    applyStaggerChoreography(document);
  });

  /* 頁面載入完成：收尾載入光軌、確保交錯索引完整並排程清除暫態屬性 */
  document.addEventListener('astro:page-load', () => {
    finishLoadingBar();
    applyStaggerChoreography(document);
    if (activeKind || activeDirection) {
      scheduleClearAttributes();
    }
  });
}
