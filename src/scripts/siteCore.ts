import { initThemeManager, cycleThemeMode } from './themeManager';
import { initScrollReveal } from './scrollReveal';

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count?: number;
  fork?: boolean;
}

const GITHUB_ICON_SVG =
  '<svg class="github-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.36 6.84 9.71.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.59 2.35 1.13 2.92.86.09-.67.35-1.13.64-1.39-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0 1 12 7.14c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"/></svg>';

const LANGUAGE_COLORS: Record<string, string> = {
  Swift: '#FA7343',
  Python: '#3776AB',
  JavaScript: '#F7DF1E',
  TypeScript: '#3178C6',
  HTML: '#E34F26',
  CSS: '#1572B6',
  'C++': '#F34B7D',
  Dart: '#00B4AB',
  Kotlin: '#A97BFF',
};

const CATEGORY_LANGUAGES: Record<string, string[]> = {
  mobile: ['Swift', 'Kotlin', 'Dart'],
  python: ['Python'],
  web: ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'C++'],
};

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

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>'"]/g, (character) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#039;',
      '"': '&quot;',
    };
    return map[character] || character;
  });
}

async function initializeProjects(): Promise<void> {
  const section = document.getElementById('projects');
  const grid = document.getElementById('projects-grid');
  if (!section || !grid || section.dataset.projectsBound === '1') return;
  section.dataset.projectsBound = '1';

  const status = document.getElementById('projects-status');
  const githubUser = section.dataset.githubUser || 'ianlyo';
  const labels = {
    repoSingle: section.dataset.repoSingle || 'public repository',
    repoPlural: section.dataset.repoPlural || 'public repositories',
    noMatches: section.dataset.noMatches || 'No repositories match your filters.',
    showAll: section.dataset.showAll || 'Show all repositories',
    showLess: section.dataset.showLess || 'Show less',
    loadError: section.dataset.loadError || 'Repositories could not be loaded right now.',
    loadErrorLink: section.dataset.loadErrorLink || 'View all public repositories on GitHub.',
    defaultDesc: section.dataset.defaultDesc || 'Open-source project on GitHub',
    viewLabel: section.dataset.viewLabel || 'View',
  };

  const cacheKey = 'github_repos_cache';
  const cacheTimeKey = 'github_repos_cache_time';
  const cacheDuration = 3600000;

  let reposData: GitHubRepo[] | null = null;
  let cachedData: string | null = null;
  let cachedTime: string | null = null;
  try {
    cachedData = localStorage.getItem(cacheKey);
    cachedTime = localStorage.getItem(cacheTimeKey);
  } catch {}
  const isCacheValid = Boolean(
    cachedData && cachedTime && Date.now() - parseInt(cachedTime, 10) < cacheDuration
  );

  try {
    if (isCacheValid && cachedData) {
      reposData = JSON.parse(cachedData) as GitHubRepo[];
    } else {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(githubUser)}/repos?type=owner&sort=updated&per_page=100`
      );
      if (!response.ok) throw new Error('API rate limit or network error');
      reposData = (await response.json()) as GitHubRepo[];
      try {
        localStorage.setItem(cacheKey, JSON.stringify(reposData));
        localStorage.setItem(cacheTimeKey, Date.now().toString());
      } catch {}
    }
  } catch {
    if (cachedData) {
      reposData = JSON.parse(cachedData) as GitHubRepo[];
    } else {
      if (status) {
        status.innerHTML = `${escapeHtml(labels.loadError)} <a href="https://github.com/${encodeURIComponent(githubUser)}?tab=repositories" target="_blank" rel="noopener" class="text-accent" style="color: inherit; text-decoration: none; font-weight: 600;">${escapeHtml(labels.loadErrorLink)}</a>`;
        status.classList.add('is-error');
      }
      const heroStats = document.querySelector<HTMLElement>('.hero-stats');
      if (heroStats) heroStats.style.display = 'none';
      return;
    }
  }

  if (!reposData) return;

  const publicProjects = reposData.filter((repo) => !repo.fork && repo.name.toLowerCase() !== 'fork');
  let showAllProjects = false;
  let activeCategory = 'all';

  const updateGitHubStats = () => {
    const languages = new Set(publicProjects.map((r) => r.language).filter(Boolean));
    const stars = publicProjects.reduce((total, r) => total + (r.stargazers_count || 0), 0);
    const repoStat = document.getElementById('repo-stat');
    const starStat = document.getElementById('star-stat');
    const languageStat = document.getElementById('language-stat');
    if (repoStat) repoStat.textContent = String(publicProjects.length);
    if (starStat) starStat.textContent = String(stars);
    if (languageStat) languageStat.textContent = String(languages.size);
  };

  const syncCategoryFilterUI = () => {
    document.querySelectorAll<HTMLElement>('.category-filter').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.category === activeCategory);
    });
    const mobileCatSelect = document.getElementById('mobile-category-filter') as HTMLSelectElement | null;
    if (mobileCatSelect && mobileCatSelect.value !== activeCategory) {
      mobileCatSelect.value = activeCategory;
    }
  };

  const updateClearFiltersButton = () => {
    const button = document.getElementById('clear-filters') as HTMLButtonElement | null;
    const search = document.getElementById('project-search') as HTMLInputElement | null;
    const filter = document.getElementById('language-filter') as HTMLSelectElement | null;
    if (!button) return;
    const hasSearch = Boolean(search && search.value.trim() !== '');
    const hasFilter = Boolean(filter && filter.value !== '');
    const hasCategory = activeCategory !== 'all';
    button.hidden = !hasSearch && !hasFilter && !hasCategory;
  };

  const createProjectCard = (repo: GitHubRepo) => {
    const language = repo.language || 'Other';
    const color = LANGUAGE_COLORS[language] || '#64748b';
    const description = repo.description || labels.defaultDesc;
    return `
      <div class="col-lg-4 col-md-6 mb-4">
        <article class="card repo-card reveal">
          <div class="card-body">
            <h3 class="card-title">
              <a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noopener">${escapeHtml(repo.name)}</a>
            </h3>
            <p class="card-text">${escapeHtml(description)}</p>
            <div class="project-card-footer">
              <small class="text-muted d-inline-flex align-items-center">
                <span class="language-dot" style="background-color: ${color}"></span>
                ${escapeHtml(language)}
              </small>
              <a href="${escapeHtml(repo.html_url)}" class="btn btn-outline-primary d-inline-flex align-items-center gap-1" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(repo.name)} on GitHub">
                ${GITHUB_ICON_SVG} <span>${escapeHtml(labels.viewLabel)}</span>
                <svg class="ui-icon icon-xs" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            </div>
          </div>
        </article>
      </div>
    `;
  };

  const renderProjects = () => {
    const searchInput = document.getElementById('project-search') as HTMLInputElement | null;
    const filterSelect = document.getElementById('language-filter') as HTMLSelectElement | null;
    const countEl = document.getElementById('project-count');
    const showMoreButton = document.getElementById('show-more-projects') as HTMLButtonElement | null;

    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const language = filterSelect ? filterSelect.value : '';

    const visibleProjects = publicProjects.filter((repo) => {
      const searchableText = `${repo.name} ${repo.description || ''}`.toLowerCase();
      const categoryMatch =
        activeCategory === 'all' ||
        (repo.language ? (CATEGORY_LANGUAGES[activeCategory] || []).includes(repo.language) : false);
      return searchableText.includes(query) && (!language || repo.language === language) && categoryMatch;
    });

    const displayProjects = showAllProjects ? visibleProjects : visibleProjects.slice(0, 6);

    if (countEl) {
      const noun = visibleProjects.length === 1 ? labels.repoSingle : labels.repoPlural;
      countEl.textContent = `${visibleProjects.length} ${noun}`;
    }

    if (status) {
      status.textContent = visibleProjects.length ? '' : labels.noMatches;
    }

    if (showMoreButton) {
      showMoreButton.hidden = visibleProjects.length <= 6;
      showMoreButton.innerHTML = `${escapeHtml(showAllProjects ? labels.showLess : labels.showAll)} <svg class="ui-icon projects-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
      showMoreButton.setAttribute('aria-expanded', String(showAllProjects));
    }

    grid.innerHTML = displayProjects.map(createProjectCard).join('');
    initScrollReveal();
    unifiedScrollController?.remeasure();
  };

  updateGitHubStats();

  document.querySelectorAll<HTMLElement>('.category-filter').forEach((button) => {
    button.addEventListener('click', () => {
      activeCategory = button.dataset.category || 'all';
      syncCategoryFilterUI();
      const langFilter = document.getElementById('language-filter') as HTMLSelectElement | null;
      if (langFilter) langFilter.value = '';
      showAllProjects = false;
      updateClearFiltersButton();
      renderProjects();
    });
  });

  const mobileCatSelect = document.getElementById('mobile-category-filter') as HTMLSelectElement | null;
  mobileCatSelect?.addEventListener('change', () => {
    activeCategory = mobileCatSelect.value || 'all';
    syncCategoryFilterUI();
    const langFilter = document.getElementById('language-filter') as HTMLSelectElement | null;
    if (langFilter) langFilter.value = '';
    showAllProjects = false;
    updateClearFiltersButton();
    renderProjects();
  });

  const filter = document.getElementById('language-filter') as HTMLSelectElement | null;
  const search = document.getElementById('project-search') as HTMLInputElement | null;
  const clearButton = document.getElementById('clear-filters') as HTMLButtonElement | null;
  const showMoreBtn = document.getElementById('show-more-projects') as HTMLButtonElement | null;

  if (filter) {
    const uniqueLanguages = [
      ...new Set(publicProjects.map((r) => r.language).filter((l): l is string => Boolean(l))),
    ].sort();
    uniqueLanguages.forEach((lang) => {
      const option = document.createElement('option');
      option.value = lang;
      option.textContent = lang;
      filter.appendChild(option);
    });
    filter.addEventListener('change', () => {
      activeCategory = 'all';
      syncCategoryFilterUI();
      updateClearFiltersButton();
      renderProjects();
    });
  }

  search?.addEventListener('input', () => {
    showAllProjects = false;
    updateClearFiltersButton();
    renderProjects();
  });

  showMoreBtn?.addEventListener('click', () => {
    showAllProjects = !showAllProjects;
    renderProjects();
    if (!showAllProjects) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  clearButton?.addEventListener('click', () => {
    if (search) search.value = '';
    if (filter) filter.value = '';
    activeCategory = 'all';
    showAllProjects = false;
    syncCategoryFilterUI();
    updateClearFiltersButton();
    renderProjects();
    search?.focus();
  });

  requestAnimationFrame(renderProjects);
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
  void initializeProjects();
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
