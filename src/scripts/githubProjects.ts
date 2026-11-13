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

/** Fetch, cache, filter and render public GitHub repositories on the home page. */
export async function initializeProjects(onProjectsRendered?: () => void): Promise<void> {
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
    onProjectsRendered?.();
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
