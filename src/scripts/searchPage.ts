import { registerPageLifecycle } from './domUtils';

interface PagefindTranslations {
  placeholder: string;
  clear: string;
  loadMore: string;
  searchLabel: string;
  filters: string;
  zeroResults: string;
  manyResults: string;
  oneResult: string;
  altSearch: string;
  searchSuggestions: string;
}

type PagefindConstructor = new (options: Record<string, unknown>) => unknown;

declare global {
  interface Window {
    PagefindUI?: PagefindConstructor;
  }
}

let pagefindLoader: Promise<PagefindConstructor | null> | null = null;

function loadPagefindScript(): Promise<PagefindConstructor | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.PagefindUI) return Promise.resolve(window.PagefindUI);
  if (pagefindLoader) return pagefindLoader;

  pagefindLoader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/pagefind/pagefind-ui.js';
    script.async = true;
    script.onload = () => resolve(window.PagefindUI ?? null);
    script.onerror = () => {
      pagefindLoader = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return pagefindLoader;
}

function parseTranslations(raw: string | undefined): PagefindTranslations | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PagefindTranslations;
  } catch {
    return null;
  }
}

/** 延遲載入 Pagefind UI 並掛載至目前頁面的 `#search` 容器 */
export async function initSearchPage(): Promise<void> {
  const container = document.getElementById('search');
  if (!container || container.dataset.pagefindBound === '1') return;
  container.dataset.pagefindBound = '1';

  const tr = parseTranslations(container.dataset.translations);
  const PagefindUI = await loadPagefindScript();

  if (!container.isConnected) return;

  if (!PagefindUI || !tr) {
    const devNote = document.getElementById('search-dev-note');
    if (devNote) devNote.hidden = false;
    return;
  }

  new PagefindUI({
    element: '#search',
    showSubResults: true,
    resetStyles: false,
    autofocus: true,
    translations: {
      placeholder: tr.placeholder,
      clear_search: tr.clear,
      load_more: tr.loadMore,
      search_label: tr.searchLabel,
      filters_label: tr.filters,
      zero_results: tr.zeroResults,
      many_results: tr.manyResults,
      one_result: tr.oneResult,
      alt_search: tr.altSearch,
      search_suggestion: tr.searchSuggestions,
    },
  });
}

registerPageLifecycle(() => {
  void initSearchPage();
});
