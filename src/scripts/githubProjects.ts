import { initScrollReveal } from './scrollReveal';
import { isReducedMotionActive, safeGetStorage, safeSetStorage } from './domUtils';

interface GitHubRepo {
  name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count?: number;
  fork?: boolean;
}

interface ProjectLabels {
  repoSingle: string;
  repoPlural: string;
  noMatches: string;
  showAll: string;
  showLess: string;
  loadError: string;
  loadErrorLink: string;
  defaultDesc: string;
  viewLabel: string;
}

interface ProjectFilterState {
  query: string;
  language: string;
  category: string;
  showAll: boolean;
}

const CACHE_KEY = 'github_repos_cache';
const CACHE_TIME_KEY = 'github_repos_cache_time';
const CACHE_DURATION_MS = 3_600_000;
const INITIAL_VISIBLE_COUNT = 6;
const STAT_ANIMATION_MS = 560;
const STAGGER_STEP_MS = 55;

const GITHUB_ICON_SVG =
  '<svg class="github-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.36 6.84 9.71.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .08 1.53 1.06 1.53 1.06.9 1.59 2.35 1.13 2.92.86.09-.67.35-1.13.64-1.39-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0 1 12 7.14c.85 0 1.71.12 2.51.36 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"/></svg>';

const EXTERNAL_LINK_ICON_SVG =
  '<svg class="ui-icon icon-xs" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>';

const CHEVRON_DOWN_ICON_SVG =
  '<svg class="ui-icon projects-toggle-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

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

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#039;',
  '"': '&quot;',
};

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>'"]/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

function readProjectLabels(section: HTMLElement): ProjectLabels {
  return {
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
}

/** Load public GitHub repositories with a 1-hour `localStorage` cache and offline fallback. */
async function loadGitHubRepos(githubUser: string): Promise<GitHubRepo[] | null> {
  const cachedData = safeGetStorage(CACHE_KEY);
  const cachedTime = safeGetStorage(CACHE_TIME_KEY);
  const isCacheValid = Boolean(
    cachedData && cachedTime && Date.now() - parseInt(cachedTime, 10) < CACHE_DURATION_MS
  );

  if (isCacheValid && cachedData) {
    try {
      return JSON.parse(cachedData) as GitHubRepo[];
    } catch {
      // Ignore malformed cache and re-fetch
    }
  }

  try {
    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(githubUser)}/repos?type=owner&sort=updated&per_page=100`
    );
    if (!response.ok) throw new Error('API rate limit or network error');
    const reposData = (await response.json()) as GitHubRepo[];
    safeSetStorage(CACHE_KEY, JSON.stringify(reposData));
    safeSetStorage(CACHE_TIME_KEY, Date.now().toString());
    return reposData;
  } catch {
    if (!cachedData) return null;
    try {
      return JSON.parse(cachedData) as GitHubRepo[];
    } catch {
      return null;
    }
  }
}

function animateStatValue(el: HTMLElement | null, target: number): void {
  if (!el) return;
  if (isReducedMotionActive() || target <= 0) {
    el.textContent = String(target);
    return;
  }

  const startVal = parseInt(el.textContent || '', 10);
  const from = Number.isFinite(startVal) ? startVal : 0;
  if (from === target) {
    el.textContent = String(target);
    return;
  }

  const startTime = performance.now();
  const step = (now: number) => {
    const progress = Math.min(1, (now - startTime) / STAT_ANIMATION_MS);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(from + (target - from) * eased));
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      el.textContent = String(target);
    }
  };
  window.requestAnimationFrame(step);
}

function updateGitHubStats(projects: GitHubRepo[]): void {
  const languages = new Set(projects.map((r) => r.language).filter(Boolean));
  const stars = projects.reduce((total, r) => total + (r.stargazers_count || 0), 0);
  animateStatValue(document.getElementById('repo-stat'), projects.length);
  animateStatValue(document.getElementById('star-stat'), stars);
  animateStatValue(document.getElementById('language-stat'), languages.size);
}

function filterPublicProjects(projects: GitHubRepo[], state: ProjectFilterState): GitHubRepo[] {
  const query = state.query.toLowerCase().trim();
  return projects.filter((repo) => {
    const searchableText = `${repo.name} ${repo.description || ''}`.toLowerCase();
    const categoryMatch =
      state.category === 'all' ||
      (repo.language ? (CATEGORY_LANGUAGES[state.category] || []).includes(repo.language) : false);
    const languageMatch = !state.language || repo.language === state.language;
    return searchableText.includes(query) && languageMatch && categoryMatch;
  });
}

function populateLanguageOptions(select: HTMLSelectElement | null, projects: GitHubRepo[]): void {
  if (!select) return;
  const uniqueLanguages = [
    ...new Set(projects.map((r) => r.language).filter((l): l is string => Boolean(l))),
  ].sort();

  uniqueLanguages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    select.appendChild(option);
  });
}

function createProjectCardHtml(
  repo: GitHubRepo,
  labels: ProjectLabels,
  index: number,
  keepSettledCount: number
): string {
  const language = repo.language || 'Other';
  const color = LANGUAGE_COLORS[language] || '#64748b';
  const description = repo.description || labels.defaultDesc;
  const isAlreadyShown = index < keepSettledCount;
  const delayMs = isAlreadyShown ? 0 : ((index - keepSettledCount) % INITIAL_VISIBLE_COUNT) * STAGGER_STEP_MS;
  const cardClasses = isAlreadyShown ? 'card repo-card reveal is-visible is-settled' : 'card repo-card reveal';
  const delayAttr = isAlreadyShown ? '' : ` style="--reveal-delay: ${delayMs}ms"`;

  return `
    <div class="col-lg-4 col-md-6 mb-4">
      <article class="${cardClasses}"${delayAttr}>
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
              ${EXTERNAL_LINK_ICON_SVG}
            </a>
          </div>
        </div>
      </article>
    </div>
  `;
}

/** Fetch, cache, filter, and render public GitHub repositories on the home page. */
export async function initializeProjects(onProjectsRendered?: () => void): Promise<void> {
  const section = document.getElementById('projects');
  const grid = document.getElementById('projects-grid');
  if (!section || !grid || section.dataset.projectsBound === '1') return;
  section.dataset.projectsBound = '1';

  const status = document.getElementById('projects-status');
  const githubUser = section.dataset.githubUser || 'ianlyo';
  const labels = readProjectLabels(section);

  const reposData = await loadGitHubRepos(githubUser);
  if (!reposData) {
    if (status) {
      status.innerHTML = `${escapeHtml(labels.loadError)} <a href="https://github.com/${encodeURIComponent(githubUser)}?tab=repositories" target="_blank" rel="noopener" class="text-accent" style="color: inherit; text-decoration: none; font-weight: 600;">${escapeHtml(labels.loadErrorLink)}</a>`;
      status.classList.add('is-error');
    }
    const heroStats = document.querySelector<HTMLElement>('.hero-stats');
    if (heroStats) heroStats.style.display = 'none';
    return;
  }

  const publicProjects = reposData.filter((repo) => !repo.fork && repo.name.toLowerCase() !== 'fork');
  const searchInput = document.getElementById('project-search') as HTMLInputElement | null;
  const languageSelect = document.getElementById('language-filter') as HTMLSelectElement | null;
  const mobileCatSelect = document.getElementById('mobile-category-filter') as HTMLSelectElement | null;
  const clearButton = document.getElementById('clear-filters') as HTMLButtonElement | null;
  const showMoreBtn = document.getElementById('show-more-projects') as HTMLButtonElement | null;
  const countEl = document.getElementById('project-count');

  const state: ProjectFilterState = {
    query: '',
    language: '',
    category: 'all',
    showAll: false,
  };

  const syncCategoryFilterUI = () => {
    document.querySelectorAll<HTMLElement>('.category-filter').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.category === state.category);
    });
    if (mobileCatSelect && mobileCatSelect.value !== state.category) {
      mobileCatSelect.value = state.category;
    }
  };

  const updateClearFiltersButton = () => {
    if (!clearButton) return;
    const hasFilters = state.query.trim() !== '' || state.language !== '' || state.category !== 'all';
    clearButton.hidden = !hasFilters;
  };

  const renderProjects = (keepSettledCount = 0) => {
    state.query = searchInput?.value || '';
    state.language = languageSelect?.value || '';

    const visibleProjects = filterPublicProjects(publicProjects, state);
    const displayProjects = state.showAll ? visibleProjects : visibleProjects.slice(0, INITIAL_VISIBLE_COUNT);

    if (countEl) {
      const noun = visibleProjects.length === 1 ? labels.repoSingle : labels.repoPlural;
      countEl.textContent = `${visibleProjects.length} ${noun}`;
    }

    if (status) {
      status.textContent = visibleProjects.length ? '' : labels.noMatches;
    }

    if (showMoreBtn) {
      showMoreBtn.hidden = visibleProjects.length <= INITIAL_VISIBLE_COUNT;
      showMoreBtn.innerHTML = `${escapeHtml(state.showAll ? labels.showLess : labels.showAll)} ${CHEVRON_DOWN_ICON_SVG}`;
      showMoreBtn.setAttribute('aria-expanded', String(state.showAll));
    }

    grid.innerHTML = displayProjects
      .map((repo, idx) => createProjectCardHtml(repo, labels, idx, keepSettledCount))
      .join('');
    initScrollReveal();
    onProjectsRendered?.();
  };

  const selectCategory = (nextCategory: string) => {
    state.category = nextCategory || 'all';
    syncCategoryFilterUI();
    if (languageSelect) languageSelect.value = '';
    state.language = '';
    state.showAll = false;
    updateClearFiltersButton();
    renderProjects();
  };

  updateGitHubStats(publicProjects);
  populateLanguageOptions(languageSelect, publicProjects);

  document.querySelectorAll<HTMLElement>('.category-filter').forEach((button) => {
    button.addEventListener('click', () => selectCategory(button.dataset.category || 'all'));
  });

  mobileCatSelect?.addEventListener('change', () => selectCategory(mobileCatSelect.value));

  languageSelect?.addEventListener('change', () => {
    state.category = 'all';
    syncCategoryFilterUI();
    updateClearFiltersButton();
    renderProjects();
  });

  searchInput?.addEventListener('input', () => {
    state.showAll = false;
    updateClearFiltersButton();
    renderProjects();
  });

  showMoreBtn?.addEventListener('click', () => {
    const prevCount = state.showAll ? 0 : Math.min(INITIAL_VISIBLE_COUNT, grid.children.length);
    state.showAll = !state.showAll;
    renderProjects(state.showAll ? prevCount : 0);
    if (!state.showAll) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  clearButton?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (languageSelect) languageSelect.value = '';
    state.category = 'all';
    state.showAll = false;
    syncCategoryFilterUI();
    updateClearFiltersButton();
    renderProjects();
    searchInput?.focus();
  });

  window.requestAnimationFrame(() => renderProjects());
}
