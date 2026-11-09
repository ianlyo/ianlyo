import type { CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** Published posts (drafts excluded in production), newest first. */
export function sortPosts(posts: Post[]) {
  return posts
    .filter((p) => import.meta.env.DEV || !p.data.draft)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
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

/** Related = most shared tags, +2 for same category. */
export function relatedPosts(current: Post, all: Post[], limit = 3) {
  return all
    .filter((p) => p.id !== current.id)
    .map((p) => ({
      p,
      score:
        p.data.tags.filter((t) => current.data.tags.includes(t)).length +
        (p.data.category === current.data.category ? 2 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.data.pubDate.valueOf() - a.p.data.pubDate.valueOf())
    .slice(0, limit)
    .map((x) => x.p);
}

export function formatDate(d: Date, lang: string = 'zh-Hant') {
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}
