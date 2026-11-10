import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { sortPosts } from '../utils/blog';
import { SITE } from '../config/site';

export async function GET(context: APIContext) {
  const posts = sortPosts(await getCollection('blog'));
  return rss({
    title: SITE.rss.title,
    description: SITE.rss.description,
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.pubDate,
      link: `/blog/${p.id}/`,
      categories: [p.data.category, ...p.data.tags],
    })),
    customData: '<language>zh-Hant</language>',
  });
}
