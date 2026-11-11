/**
 * Apple-style Scroll-Triggered Fade-In & Slide-Up (.reveal)
 * 
 * Automatically detects elements with the `.reveal` class when they enter the viewport
 * using IntersectionObserver, adding `.is-visible` to trigger smooth CSS animations.
 * 
 * Supports:
 * - View Transitions (Astro's `astro:page-load`)
 * - Accessibility (`prefers-reduced-motion: reduce`)
 * - Fallback for browsers without IntersectionObserver
 * - Dynamic / client-side content re-scans via `initScrollReveal()`
 */

export function initScrollReveal(): void {
  if (typeof window === 'undefined') return;

  // Respect user accessibility settings for reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const elements = document.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)');

  if (elements.length === 0) return;

  // If user prefers reduced motion or browser lacks IntersectionObserver, reveal immediately
  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observerOptions: IntersectionObserverInit = {
    root: null,
    // Trigger when element enters 12% from the bottom of the viewport
    rootMargin: '0px 0px -12% 0px',
    threshold: 0.05,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  elements.forEach((el) => observer.observe(el));
}

// Global exposure for dynamic scripts / developer tools
if (typeof window !== 'undefined') {
  (window as unknown as { initScrollReveal?: typeof initScrollReveal }).initScrollReveal = initScrollReveal;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initScrollReveal());
  } else {
    initScrollReveal();
  }

  // Support Astro View Transitions (<ClientRouter />)
  document.addEventListener('astro:page-load', () => initScrollReveal());
}
