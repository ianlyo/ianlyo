import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { resolvePostsForLang } from '../utils/blog';
import { SITE } from '../config/site';

export async function GET(context: APIContext) {
  const posts = resolvePostsForLang(await getCollection('blog'), 'zh-Hant');
  return rss({
    title: SITE.rss.title,
    description: SITE.rss.description,
    site: context.site!,
    items: posts.map((item) => ({
      title: item.post.data.title,
      description: item.post.data.description,
      pubDate: item.post.data.pubDate,
      link: `/blog/${item.slug}/`,
      categories: [item.post.data.category, ...item.post.data.tags],
    })),
    customData: '<language>zh-Hant</language>',
  });
}
