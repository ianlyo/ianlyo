import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isReducedMotionActive, registerPageLifecycle } from './domUtils';

gsap.registerPlugin(ScrollTrigger);

interface ScreenshotEntry {
  src: string;
  alt: string;
  filename: string;
}

let galleryCtx: gsap.Context | null = null;
let galleryRevealObserver: IntersectionObserver | null = null;
let galleryAbortController: AbortController | null = null;
let lastWindowWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
let resizeListenersBound = false;

function observeGalleryReveal(
  section: HTMLElement,
  gallery: HTMLElement,
  reduceMotion: boolean
): void {
  if (gallery.classList.contains('is-revealed')) return;

  const rect = section.getBoundingClientRect();
  const vh = window.innerHeight || 800;
  if (reduceMotion || !('IntersectionObserver' in window) || rect.top < vh * 0.9) {
    gallery.classList.add('is-revealed');
    return;
  }

  if (!galleryRevealObserver) {
    galleryRevealObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetGallery = entry.target.querySelector<HTMLElement>('[data-gallery]');
            targetGallery?.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
  }
  galleryRevealObserver.observe(section);
}

/** Bind fullscreen lightbox viewer, click-to-zoom, keyboard navigation, and touch swipe. */
function initLightboxController(
  gallery: HTMLElement,
  appId: string,
  screenshotsData: ScreenshotEntry[],
  signal: AbortSignal
): void {
  const lightbox = document.getElementById(`lightbox-${appId}`);
  const lightboxImg = document.getElementById(`lightbox-img-${appId}`) as HTMLImageElement | null;
  const lightboxTitle = document.getElementById(`lightbox-title-${appId}`);
  const lightboxCounter = document.getElementById(`lightbox-counter-${appId}`);
  const lightboxPrev = lightbox?.querySelector<HTMLButtonElement>('[data-lightbox-prev]');
  const lightboxNext = lightbox?.querySelector<HTMLButtonElement>('[data-lightbox-next]');
  const lightboxCloseButtons = lightbox?.querySelectorAll('[data-lightbox-close]');

  let currentIndex = 0;
  let isZoomed = false;

  const resetZoom = () => {
    if (!lightboxImg) return;
    isZoomed = false;
    lightboxImg.classList.remove('is-zoomed');
    lightboxImg.style.transformOrigin = 'center center';
  };

  const toggleZoom = (e: MouseEvent) => {
    if (!lightboxImg) return;
    if (isZoomed) {
      resetZoom();
      return;
    }
    const rect = lightboxImg.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    lightboxImg.style.transformOrigin = `${x}% ${y}%`;
    lightboxImg.classList.add('is-zoomed');
    isZoomed = true;
  };

  const showSlide = (index: number) => {
    const shouldAnimateSwap = Boolean(lightbox?.classList.contains('is-open') && index !== currentIndex);
    resetZoom();
    currentIndex = index;

    const item = screenshotsData[index];
    if (!item || !lightboxImg) return;

    if (shouldAnimateSwap) {
      lightboxImg.classList.remove('is-fading');
      void lightboxImg.offsetWidth;
      lightboxImg.classList.add('is-fading');
    } else {
      lightboxImg.classList.remove('is-fading');
    }

    lightboxImg.src = item.src;
    lightboxImg.alt = item.alt;

    if (lightboxTitle) lightboxTitle.textContent = item.filename;
    if (lightboxCounter) {
      lightboxCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(screenshotsData.length).padStart(2, '0')}`;
    }
    if (lightboxPrev) lightboxPrev.disabled = index === 0;
    if (lightboxNext) lightboxNext.disabled = index === screenshotsData.length - 1;
  };

  const open = (index: number) => {
    if (!lightbox) return;
    showSlide(index);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    if (!lightbox) return;
    resetZoom();
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  };

  lightboxImg?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      toggleZoom(e);
    },
    { signal }
  );

  lightbox?.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const isInteractiveTarget =
        (lightboxImg && (target === lightboxImg || lightboxImg.contains(target))) ||
        (lightboxPrev && (target === lightboxPrev || lightboxPrev.contains(target))) ||
        (lightboxNext && (target === lightboxNext || lightboxNext.contains(target)));
      if (!isInteractiveTarget) close();
    },
    { signal }
  );

  gallery.querySelectorAll<HTMLElement>('[data-lightbox-trigger]').forEach((trigger) => {
    trigger.addEventListener(
      'click',
      () => open(parseInt(trigger.dataset.lightboxTrigger || '0', 10)),
      { signal }
    );
  });

  let touchStartX = 0;
  let touchStartY = 0;

  lightbox?.addEventListener(
    'touchstart',
    (e) => {
      if (!e.touches[0]) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    },
    { passive: true, signal }
  );

  lightbox?.addEventListener(
    'touchend',
    (e) => {
      if (!touchStartX || isZoomed || !e.changedTouches[0]) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
        if (deltaX < 0 && currentIndex < screenshotsData.length - 1) showSlide(currentIndex + 1);
        else if (deltaX > 0 && currentIndex > 0) showSlide(currentIndex - 1);
      }
      touchStartX = 0;
      touchStartY = 0;
    },
    { passive: true, signal }
  );

  lightboxCloseButtons?.forEach((btn) => {
    btn.addEventListener(
      'click',
      (e) => {
        if (e.target === btn || btn.contains(e.target as Node)) close();
      },
      { signal }
    );
  });

  lightboxPrev?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      if (currentIndex > 0) showSlide(currentIndex - 1);
    },
    { signal }
  );

  lightboxNext?.addEventListener(
    'click',
    (e) => {
      e.stopPropagation();
      if (currentIndex < screenshotsData.length - 1) showSlide(currentIndex + 1);
    },
    { signal }
  );

  document.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
      if (!lightbox?.classList.contains('is-open')) return;
      if (e.key === 'Escape') {
        if (isZoomed) resetZoom();
        else close();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        showSlide(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < screenshotsData.length - 1) {
        showSlide(currentIndex + 1);
      }
    },
    { signal }
  );
}

/** Map horizontal touch swipe deltas on the track to smooth page scroll for pinned carousel traversal. */
function bindTrackTouchSwipe(track: HTMLElement, signal: AbortSignal): void {
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeStartScrollY = 0;
  let isHorizontalSwipe = false;
  let touchRafId = 0;
  let pendingTargetScrollY = 0;

  track.addEventListener(
    'touchstart',
    (e: TouchEvent) => {
      if (!e.touches[0]) return;
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
      swipeStartScrollY = window.scrollY;
      isHorizontalSwipe = false;
    },
    { passive: true, signal }
  );

  track.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      if (!e.touches[0] || !swipeStartX) return;
      const deltaX = e.touches[0].clientX - swipeStartX;
      const deltaY = e.touches[0].clientY - swipeStartY;

      if (!isHorizontalSwipe && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
        isHorizontalSwipe = true;
      }

      if (isHorizontalSwipe) {
        pendingTargetScrollY = swipeStartScrollY - deltaX * 1.35;
        if (!touchRafId) {
          touchRafId = window.requestAnimationFrame(() => {
            window.scrollTo({ top: pendingTargetScrollY, behavior: 'auto' });
            touchRafId = 0;
          });
        }
      }
    },
    { passive: true, signal }
  );

  track.addEventListener(
    'touchend',
    () => {
      if (touchRafId) {
        window.cancelAnimationFrame(touchRafId);
        touchRafId = 0;
      }
      swipeStartX = 0;
      swipeStartY = 0;
      isHorizontalSwipe = false;
    },
    { passive: true, signal }
  );
}

function initGallerySection(section: HTMLElement, reduceMotion: boolean, signal: AbortSignal): void {
  const gallery = section.querySelector<HTMLElement>('[data-gallery]');
  const track = section.querySelector<HTMLElement>('.gallery-track');
  if (!gallery || !track) return;

  observeGalleryReveal(section, gallery, reduceMotion);

  const appId = gallery.dataset.appId || 'app';
  let screenshotsData: ScreenshotEntry[] = [];
  try {
    screenshotsData = JSON.parse(gallery.dataset.screenshots || '[]') as ScreenshotEntry[];
  } catch {
    return;
  }
  if (screenshotsData.length === 0) return;

  initLightboxController(gallery, appId, screenshotsData, signal);

  const slides = Array.from(gallery.querySelectorAll<HTMLElement>('.gallery-slide'));
  const prevButton = gallery.querySelector<HTMLButtonElement>('.apple-nav-btn[data-action="prev"]');
  const nextButton = gallery.querySelector<HTMLButtonElement>('.apple-nav-btn[data-action="next"]');
  const dots = Array.from(gallery.querySelectorAll<HTMLButtonElement>('.gallery-dot'));

  let lastActiveIndex = -1;
  const updateActiveSlide = (activeIndex: number) => {
    if (activeIndex === lastActiveIndex) return;
    lastActiveIndex = activeIndex;
    dots.forEach((dot, idx) => {
      const isActive = idx === activeIndex;
      dot.classList.toggle('is-active', isActive);
      dot.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    slides.forEach((slide, idx) => {
      slide.classList.toggle('is-focused', idx === activeIndex);
    });
  };

  const getDistance = () => {
    const gutter = parseFloat(window.getComputedStyle(section).getPropertyValue('--gallery-gutter')) || 40;
    return Math.max(0, track.scrollWidth - window.innerWidth + gutter * 1.5);
  };

  if (getDistance() <= 40) {
    gallery.classList.add('is-centered');
    gsap.set(track, { clearProps: 'all' });
    slides.forEach((slide) => slide.classList.add('is-focused'));
    return;
  }

  gallery.classList.remove('is-centered');

  const isMobile = window.innerWidth <= 768;
  const scrollDistance = () => Math.round(getDistance() * (isMobile ? 0.22 : 0.28) + 10);

  const tween = gsap.to(track, {
    x: () => -getDistance(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${scrollDistance()}`,
      pin: true,
      pinSpacing: true,
      scrub: isMobile ? 0.2 : 0.35,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        const p = self.progress;
        const activeIndex = Math.min(slides.length - 1, Math.max(0, Math.round(p * (slides.length - 1))));
        updateActiveSlide(activeIndex);
        if (prevButton) {
          const disablePrev = p <= 0.01;
          if (prevButton.disabled !== disablePrev) prevButton.disabled = disablePrev;
        }
        if (nextButton) {
          const disableNext = p >= 0.99;
          if (nextButton.disabled !== disableNext) nextButton.disabled = disableNext;
        }
      },
    },
  });

  bindTrackTouchSwipe(track, signal);

  const scrollToSlideIndex = (index: number) => {
    const st = tween.scrollTrigger;
    if (!st) return;
    const targetP = index / Math.max(1, slides.length - 1);
    const targetY = st.start + (st.end - st.start) * targetP;
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  };

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', () => scrollToSlideIndex(idx), { signal });
  });

  prevButton?.addEventListener(
    'click',
    () => {
      const st = tween.scrollTrigger;
      if (!st) return;
      const currentIdx = Math.round(st.progress * (slides.length - 1));
      scrollToSlideIndex(Math.max(0, currentIdx - 1));
    },
    { signal }
  );

  nextButton?.addEventListener(
    'click',
    () => {
      const st = tween.scrollTrigger;
      if (!st) return;
      const currentIdx = Math.round(st.progress * (slides.length - 1));
      scrollToSlideIndex(Math.min(slides.length - 1, currentIdx + 1));
    },
    { signal }
  );

  updateActiveSlide(0);
}

/** Revert gallery ScrollTriggers, observers, lightbox locks, and event listeners before swap. */
export function cleanupGalleries(): void {
  if (galleryCtx) {
    galleryCtx.revert();
    galleryCtx = null;
  }
  if (galleryRevealObserver) {
    galleryRevealObserver.disconnect();
    galleryRevealObserver = null;
  }
  galleryAbortController?.abort();
  galleryAbortController = null;
  if (typeof document !== 'undefined' && document.body) {
    document.body.style.overflow = '';
  }
}

/** Initialize all Apple-style screenshot galleries and ScrollTrigger timelines. */
export function setupGalleries(): void {
  cleanupGalleries();
  galleryAbortController = new AbortController();

  const sections = document.querySelectorAll<HTMLElement>('[data-porsche-section]');
  if (!sections.length) return;

  const reduceMotion = isReducedMotionActive();
  const { signal } = galleryAbortController;

  galleryCtx = gsap.context(() => {
    sections.forEach((section) => initGallerySection(section, reduceMotion, signal));
  });

  ScrollTrigger.refresh();
}

registerPageLifecycle({
  onLoad: setupGalleries,
  onBeforeSwap: cleanupGalleries,
});

if (typeof window !== 'undefined' && !resizeListenersBound) {
  resizeListenersBound = true;
  let resizeTimeout: number | undefined;
  window.addEventListener(
    'resize',
    () => {
      // Ignore mobile address bar height fluctuations when viewport width hasn't changed
      if (Math.abs(window.innerWidth - lastWindowWidth) < 2) return;
      lastWindowWidth = window.innerWidth;
      window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(setupGalleries, 200);
    },
    { passive: true }
  );
}
