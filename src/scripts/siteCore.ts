import { initThemeManager, cycleThemeMode } from './themeManager';
import { initScrollReveal } from './scrollReveal';
import { initializeProjects } from './githubProjects';
import {
  createToastNotifier,
  fadeImageOnLoad,
  registerPageLifecycle,
  safeSetStorage,
  setScrollGradientPhase,
} from './domUtils';

interface GradientItem {
  el: HTMLElement;
  absTop: number;
  height: number;
  isHero: boolean;
  phaseOffset: number;
  lastGradKey: string;
}

const LOCALE_STORAGE_KEY = 'preferred-locale';
const MOBILE_BREAKPOINT_QUERY = '(max-width: 768px)';
const TOP_SAFE_ZONE_PX = 200;
const NAV_HIDE_SCROLL_PX = 60;
const NAV_SHOW_SCROLL_PX = 8;

let globalListenersBound = false;
let unifiedScrollController: { remeasure: () => void } | null = null;

function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener(
    'load',
    () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    },
    { once: true }
  );
}

function setupThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>('.theme-toggle').forEach((toggle) => {
    if (toggle.dataset.bound === 'true') return;
    toggle.dataset.bound = 'true';
    toggle.addEventListener('click', () => {
      cycleThemeMode(true);
    });
  });
}

function setupSmoothAnchors(): void {
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    if (link.dataset.anchorBound === 'true') return;
    link.dataset.anchorBound = 'true';
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        e.preventDefault();
        targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function setNavDrawerOpen(open: boolean): void {
  const openBtn = document.getElementById('nav-drawer-open');
  const backdrop = document.getElementById('nav-drawer-backdrop');
  const drawer = document.getElementById('nav-drawer');
  if (!drawer || !openBtn || !backdrop) return;

  drawer.classList.toggle('is-open', open);
  backdrop.classList.toggle('is-open', open);
  if (open) {
    drawer.removeAttribute('inert');
  } else {
    drawer.setAttribute('inert', '');
  }
  drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
  openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  document.body.style.overflow = open ? 'hidden' : '';
}

function setupNavDrawer(): void {
  const openBtn = document.getElementById('nav-drawer-open');
  const closeBtn = document.getElementById('nav-drawer-close');
  const backdrop = document.getElementById('nav-drawer-backdrop');
  const drawer = document.getElementById('nav-drawer');
  if (!drawer || !openBtn || !backdrop || drawer.dataset.bound === 'true') return;
  drawer.dataset.bound = 'true';

  const openDrawer = () => setNavDrawerOpen(true);
  const closeDrawer = () => setNavDrawerOpen(false);

  openBtn.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  drawer.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeDrawer));
}

function setupLangSwitch(): void {
  document.querySelectorAll<HTMLElement>('[data-lang-switch]').forEach((btn) => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', (e) => {
      const target = btn.getAttribute('data-lang-switch');
      if (target) safeSetStorage(LOCALE_STORAGE_KEY, target);
      const href = btn.getAttribute('href');
      const isPlainClick =
        !(e instanceof MouseEvent) ||
        (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0);
      if (href && isPlainClick) {
        e.preventDefault();
        window.location.replace(href);
      }
    });
  });

  document.querySelectorAll<HTMLSelectElement>('[data-lang-select]').forEach((sel) => {
    if (sel.dataset.bound === 'true') return;
    sel.dataset.bound = 'true';
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      const href = opt?.getAttribute('data-href') || '';
      if (sel.value) safeSetStorage(LOCALE_STORAGE_KEY, sel.value);
      if (href) window.location.replace(href);
    });
  });
}

function setupShareButton(): void {
  const btn = document.getElementById('share-btn') as HTMLButtonElement | null;
  if (!btn || btn.dataset.bound === 'true') return;
  btn.dataset.bound = 'true';

  const showToast = createToastNotifier(document.getElementById('share-toast'), 2000);

  btn.addEventListener('click', async () => {
    const data = {
      title: btn.dataset.shareTitle || document.title,
      text: btn.dataset.shareText || '',
      url: btn.dataset.shareUrl || window.location.href,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(data.url);
      showToast(btn.dataset.copied);
    } catch {
      window.prompt('', data.url);
    }
  });
}

function getViewportScrollY(): number {
  return Math.max(window.scrollY || document.documentElement.scrollTop || 0, 0);
}

function collectGradientMetrics(scrollY: number, vh: number): GradientItem[] {
  const els = Array.from(
    document.querySelectorAll<HTMLElement>('.hero-title em, .scroll-gradient-text, [data-scroll-gradient]')
  ).filter((el) => el.getAttribute('data-gsap-gradient') !== 'true');

  return els.map((el, idx) => {
    const rect = el.getBoundingClientRect();
    const absTop = rect.top + scrollY;
    return {
      el,
      absTop,
      height: rect.height,
      isHero: absTop < vh * 0.85,
      phaseOffset: (idx % 4) * 0.15,
      lastGradKey: '',
    };
  });
}

function updateScrollProgressBar(bar: HTMLElement | null, scrollY: number, maxScrollY: number): void {
  if (!bar) return;
  const progress = maxScrollY > 0 ? Math.min(1, Math.max(0, scrollY / maxScrollY)) : 0;
  bar.style.transform = `scaleX(${progress.toFixed(4)})`;
  bar.classList.toggle('is-visible', scrollY > 8);
}

function updateGradientMetrics(items: GradientItem[], scrollY: number, vh: number): void {
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rectTop = item.absTop - scrollY;
    if (rectTop > vh + 100 || rectTop + item.height < -100) continue;

    const rawRatio = item.isHero
      ? scrollY / Math.max(vh * 0.65, 320)
      : vh + item.height > 0
        ? (vh - rectTop) / (vh + item.height)
        : 0;
    const clamped = Math.min(1, Math.max(0, rawRatio));
    const phase = (clamped + item.phaseOffset) % 1;
    const key = phase.toFixed(3);
    if (item.lastGradKey === key) continue;
    item.lastGradKey = key;
    setScrollGradientPhase(item.el, phase);
  }
}

function createMobileNavVisibilityUpdater(mobileQuery: MediaQueryList) {
  let accumulatedDown = 0;

  return {
    reset() {
      accumulatedDown = 0;
    },
    update(nav: HTMLElement | null, scrollY: number, lastScrollY: number) {
      if (!nav) return;
      if (!mobileQuery.matches || scrollY <= TOP_SAFE_ZONE_PX) {
        nav.classList.remove('is-hidden');
        accumulatedDown = 0;
        return;
      }

      const delta = scrollY - lastScrollY;
      if (delta > 0) {
        accumulatedDown += delta;
        if (accumulatedDown >= NAV_HIDE_SCROLL_PX) {
          nav.classList.add('is-hidden');
        }
      } else if (delta < -NAV_SHOW_SCROLL_PX) {
        nav.classList.remove('is-hidden');
        accumulatedDown = 0;
      }
    },
  };
}

/**
 * Single rAF-throttled scroll loop coordinating reading progress bar,
 * hero/heading gradient parallax, and mobile navigation auto-hide.
 */
function setupUnifiedScrollLoop(): void {
  if (unifiedScrollController) {
    unifiedScrollController.remeasure();
    return;
  }

  const mobileQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
  const mobileNavUpdater = createMobileNavVisibilityUpdater(mobileQuery);

  let progressBar: HTMLElement | null = null;
  let nav: HTMLElement | null = null;
  let cachedMetrics: GradientItem[] = [];
  let maxScrollY = 0;
  let vh = 800;
  let lastScrollY = getViewportScrollY();
  let ticking = false;

  const collectElements = () => {
    progressBar = document.getElementById('scroll-progress');
    nav = document.querySelector('.site-nav');
    vh = window.innerHeight || document.documentElement.clientHeight || 800;
    maxScrollY = Math.max(0, document.documentElement.scrollHeight - vh);
    lastScrollY = getViewportScrollY();
    cachedMetrics = collectGradientMetrics(lastScrollY, vh);
  };

  const update = () => {
    const scrollY = getViewportScrollY();
    updateScrollProgressBar(progressBar, scrollY, maxScrollY);
    updateGradientMetrics(cachedMetrics, scrollY, vh);
    mobileNavUpdater.update(nav, scrollY, lastScrollY);
    lastScrollY = scrollY;
    ticking = false;
  };

  const scheduleUpdate = () => {
    if (!ticking) {
      window.requestAnimationFrame(update);
      ticking = true;
    }
  };

  const remeasure = () => {
    window.requestAnimationFrame(() => {
      collectElements();
      update();
    });
  };

  unifiedScrollController = { remeasure };
  remeasure();

  if (!globalListenersBound) {
    globalListenersBound = true;
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    let resizeTimeout: number | undefined;
    window.addEventListener(
      'resize',
      () => {
        window.clearTimeout(resizeTimeout);
        resizeTimeout = window.setTimeout(remeasure, 150);
      },
      { passive: true }
    );
    mobileQuery.addEventListener?.('change', (e) => {
      if (!e.matches && nav) {
        nav.classList.remove('is-hidden');
        mobileNavUpdater.reset();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && document.getElementById('nav-drawer')?.classList.contains('is-open')) {
        setNavDrawerOpen(false);
      }
    });
  }
}

function setupContributionChartFade(): void {
  const graphImg = document.getElementById('contribution-graph-img') as HTMLImageElement | null;
  if (!graphImg || graphImg.dataset.fadeBound === 'true') return;
  graphImg.dataset.fadeBound = 'true';
  if (!graphImg.complete) {
    fadeImageOnLoad(graphImg);
  }
}

function initSiteCore(): void {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  initThemeManager();
  setupContributionChartFade();
  setupThemeToggle();
  setupSmoothAnchors();
  setupNavDrawer();
  setupLangSwitch();
  setupShareButton();
  setupUnifiedScrollLoop();
  initScrollReveal();
  void initializeProjects(() => unifiedScrollController?.remeasure());
}

registerServiceWorker();
registerPageLifecycle(initSiteCore);
