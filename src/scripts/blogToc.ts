import { registerPageLifecycle } from './domUtils';

let activeTocObserver: IntersectionObserver | null = null;

export function cleanupBlogToc(): void {
  activeTocObserver?.disconnect();
  activeTocObserver = null;
}

/** 高亮顯示目前可視區域對應的文章目錄章節 */
export function initBlogTocHighlight(): void {
  cleanupBlogToc();

  const tocLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.toc a[href^="#"]'));
  if (tocLinks.length === 0) return;

  const headings = tocLinks
    .map((link) => {
      const id = link.getAttribute('href')?.slice(1);
      return id ? document.getElementById(id) : null;
    })
    .filter((el): el is HTMLElement => Boolean(el));

  if (headings.length === 0) return;

  const setActive = (id: string) => {
    tocLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${id}`);
    });
  };

  setActive(headings[0].id);

  if (!('IntersectionObserver' in window)) return;

  activeTocObserver = new IntersectionObserver(
    (entries) => {
      const visible = entries.find((entry) => entry.isIntersecting);
      if (visible) {
        setActive((visible.target as HTMLElement).id);
      }
    },
    { rootMargin: '-96px 0px -65% 0px', threshold: 0 }
  );

  headings.forEach((heading) => activeTocObserver?.observe(heading));
}

registerPageLifecycle({
  onLoad: initBlogTocHighlight,
  onBeforeSwap: cleanupBlogToc,
});
