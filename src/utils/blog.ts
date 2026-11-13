import type { CollectionEntry } from 'astro:content';
import type { Lang } from '../i18n/ui';

export type Post = CollectionEntry<'blog'>;

export interface ResolvedPost {
  post: Post;
  slug: string;
  isFallback: boolean;
  originalLang: Lang;
  hasTranslation: boolean;
}

/** Canonical slug shared across translations of the same post. */
export function getPostSlug(post: Post): string {
  return (
    post.data.translationKey ??
    post.id.replace(/\.(en|zh-hant)$/i, '').replace(/\/(en|zh-hant)$/i, '')
  );
}

/** Published posts (drafts excluded in production), newest first. */
export function sortPosts(posts: Post[]) {
  return posts
    .filter((p) => import.meta.env.DEV || !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/**
 * Group posts by canonical slug and pick the entry matching `lang`,
 * falling back to the available original language when no translation exists.
 */
export function resolvePostsForLang(posts: Post[], lang: Lang): ResolvedPost[] {
  const sorted = sortPosts(posts);
  const groups = new Map<string, Post[]>();
  for (const post of sorted) {
    const slug = getPostSlug(post);
    const list = groups.get(slug);
    if (list) list.push(post);
    else groups.set(slug, [post]);
  }

  const resolved: ResolvedPost[] = [];
  for (const [slug, variants] of groups) {
    const exact = variants.find((p) => p.data.lang === lang);
    const chosen = exact ?? variants[0];
    resolved.push({
      post: chosen,
      slug,
      isFallback: chosen.data.lang !== lang,
      originalLang: chosen.data.lang,
      hasTranslation: variants.length > 1,
    });
  }

  return resolved.sort((a, b) => b.post.data.pubDate.valueOf() - a.post.data.pubDate.valueOf());
}

/** Reading time in minutes: ~220 words/min for Latin text, ~400 chars/min for CJK. */
export function readingTime(body = '') {
  const text = body.replace(/```[\s\S]*?```/g, ' ');
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = text.replace(/[\u3400-\u9fff]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220 + cjk / 400));
}

export function slugify(s: string) {
  return s.trim().toLowerCase().replace(/&/g, '').replace(/\s*\/\s*/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-');
}

/** Related = most shared tags, +2 for same category, excluding the current post across languages. */
export function relatedPosts(current: ResolvedPost, all: ResolvedPost[], limit = 3): ResolvedPost[] {
  return all
    .filter((item) => item.slug !== current.slug)
    .map((item) => ({
      item,
      score:
        item.post.data.tags.filter((t) => current.post.data.tags.includes(t)).length +
        (item.post.data.category === current.post.data.category ? 2 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.item.post.data.pubDate.valueOf() - a.item.post.data.pubDate.valueOf())
    .slice(0, limit)
    .map((x) => x.item);
}

export function formatDate(d: Date, lang: string = 'zh-Hant') {
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}
