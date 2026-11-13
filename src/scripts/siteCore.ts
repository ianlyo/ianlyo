import { initThemeManager, cycleThemeMode } from './themeManager';
import { initScrollReveal } from './scrollReveal';
import { initializeProjects } from './githubProjects';

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

function setupNavDrawer(): void {
  const openBtn = document.getElementById('nav-drawer-open');
  const closeBtn = document.getElementById('nav-drawer-close');
  const backdrop = document.getElementById('nav-drawer-backdrop');
  const drawer = document.getElementById('nav-drawer');
  if (!drawer || !openBtn || !backdrop || drawer.dataset.bound === 'true') return;
  drawer.dataset.bound = 'true';

  const openDrawer = () => {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.removeAttribute('inert');
    drawer.setAttribute('aria-hidden', 'false');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const closeDrawer = () => {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    drawer.setAttribute('inert', '');
    drawer.setAttribute('aria-hidden', 'true');
    openBtn.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  openBtn.addEventListener('click', openDrawer);
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeDrawer);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });
}

function setupLangSwitch(): void {
  document.querySelectorAll<HTMLElement>('[data-lang-switch]').forEach((btn) => {
    if (btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-lang-switch');
      if (target) {
        try {
          localStorage.setItem('preferred-locale', target);
        } catch {}
      }
    });
  });

  document.querySelectorAll<HTMLSelectElement>('[data-lang-select]').forEach((sel) => {
    if (sel.dataset.bound === 'true') return;
    sel.dataset.bound = 'true';
    sel.addEventListener('change', () => {
      const opt = sel.options[sel.selectedIndex];
      const target = sel.value;
      const href = opt?.getAttribute('data-href') || '';
      if (target) {
        try {
          localStorage.setItem('preferred-locale', target);
        } catch {}
      }
      if (href) {
        window.location.href = href;
      }
    });
  });
}

function setupShareButton(): void {
  const btn = document.getElementById('share-btn') as HTMLButtonElement | null;
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  const toast = document.getElementById('share-toast');
  let toastTimer: number | undefined;

  const showToast = (msg?: string) => {
    if (!toast || !msg) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2000);
  };

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

interface GradientItem {
  el: HTMLElement;
  absTop: number;
  height: number;
  isHero: boolean;
  phaseOffset: number;
  lastGradX: string;
}

function setupUnifiedScrollLoop(): void {
  if (unifiedScrollController) {
    unifiedScrollController.remeasure();
    return;
  }

  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const TOP_SAFE_ZONE = 200;
  const HIDE_SCROLL_DISTANCE = 60;
  const SHOW_SCROLL_DISTANCE = 8;

  let progressBar: HTMLElement | null = null;
  let nav: HTMLElement | null = null;
  let cachedMetrics: GradientItem[] = [];
  let docHeight = 0;
  let vh = 800;
  let lastScrollY = Math.max(window.scrollY || 0, 0);
  let accumulatedDownScroll = 0;
  let ticking = false;

  const collectElements = () => {
    progressBar = document.getElementById('scroll-progress');
    nav = document.querySelector('.site-nav');
    const gradientEls = Array.from(
      document.querySelectorAll<HTMLElement>('.hero-title em, .scroll-gradient-text, [data-scroll-gradient]')
    ).filter((el) => el.getAttribute('data-gsap-gradient') !== 'true');

    vh = window.innerHeight || document.documentElement.clientHeight || 800;
    docHeight = Math.max(0, document.documentElement.scrollHeight - vh);
    const scroll = Math.max(window.scrollY || document.documentElement.scrollTop || 0, 0);
    lastScrollY = scroll;

    cachedMetrics = gradientEls.map((el, idx) => {
      const rect = el.getBoundingClientRect();
      const absTop = rect.top + scroll;
      return {
        el,
        absTop,
        height: rect.height,
        isHero: absTop < vh * 0.85,
        phaseOffset: (idx % 4) * 0.15,
        lastGradX: '',
      };
    });
  };

  const applyGradientProgress = (item: GradientItem, ratio: number) => {
    const r = Math.min(1, Math.max(0, ratio));
    const phase = (r + item.phaseOffset) % 1;
    const gradX = `${(phase * 100).toFixed(1)}%`;
    if (item.lastGradX === gradX) return;
    item.lastGradX = gradX;
    const gradY = `${(50 + Math.sin(phase * Math.PI * 2) * 50).toFixed(1)}%`;
    item.el.style.setProperty('--hero-grad-x', gradX);
    item.el.style.setProperty('--hero-grad-y', gradY);
  };

  const update = () => {
    const scroll = Math.max(window.scrollY || document.documentElement.scrollTop || 0, 0);

    // 1. Scroll progress bar
    if (progressBar) {
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scroll / docHeight)) : 0;
      progressBar.style.transform = `scaleX(${progress.toFixed(4)})`;
      progressBar.classList.toggle('is-visible', scroll > 8);
    }

    // 2. Hero & scroll gradient text
    for (let i = 0; i < cachedMetrics.length; i++) {
      const item = cachedMetrics[i];
      const rectTop = item.absTop - scroll;
      if (rectTop > vh + 100 || rectTop + item.height < -100) continue;
      const ratio = item.isHero
        ? scroll / Math.max(vh * 0.65, 320)
        : vh + item.height > 0
          ? (vh - rectTop) / (vh + item.height)
          : 0;
      applyGradientProgress(item, ratio);
    }

    // 3. Mobile navbar auto-hide
    if (nav) {
      if (!mobileQuery.matches) {
        nav.classList.remove('is-hidden');
        accumulatedDownScroll = 0;
      } else {
        const delta = scroll - lastScrollY;
        if (scroll <= TOP_SAFE_ZONE) {
          nav.classList.remove('is-hidden');
          accumulatedDownScroll = 0;
        } else if (delta > 0) {
          accumulatedDownScroll += delta;
          if (accumulatedDownScroll >= HIDE_SCROLL_DISTANCE) {
            nav.classList.add('is-hidden');
          }
        } else if (delta < -SHOW_SCROLL_DISTANCE) {
          nav.classList.remove('is-hidden');
          accumulatedDownScroll = 0;
        }
      }
    }

    lastScrollY = scroll;
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
        accumulatedDownScroll = 0;
      }
    });
  }
}

function initSiteCore(): void {
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  initThemeManager();
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

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteCore);
  } else {
    initSiteCore();
  }
  document.addEventListener('astro:page-load', initSiteCore);
}
