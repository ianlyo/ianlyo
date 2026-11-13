import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

/** Text with a Traditional Chinese (required) and English (optional) version. */
const localized = z.object({
  zh: z.string(),
  en: z.string().optional(),
});

/** Optional URL: empty string means "not set yet" (the UI shows a placeholder). */
const optionalUrl = z.union([z.literal(''), z.url()]).default('');

export const BLOG_CATEGORIES = [
  'Android Development',
  'Android Custom ROMs',
  'Kotlin / Java',
  'Jetpack Compose',
  'System Modification',
  'Open Source Projects',
  'Tutorials & Guides',
  'Development Notes',
] as const;

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    category: z.enum(BLOG_CATEGORIES),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    lang: z.enum(['zh-Hant', 'en']).default('zh-Hant'),
    translationKey: z.string().optional(),
  }),
});

const apps = defineCollection({
  loader: glob({ pattern: '*.{yaml,yml}', base: './src/content/apps' }),
  schema: z.object({
    name: z.string(),
    /** Android package name, e.g. com.example.app */
    packageName: z.string(),
    /** Path under /public, e.g. /apps/my-app/icon.png (placeholder icon is used if empty) */
    icon: z.string().default(''),
    status: z.enum(['closed-beta', 'open-beta', 'released', 'coming-soon', 'paused']),
    version: z.string(),
    minAndroid: z.string(),
    targetAndroid: z.string().default(''),
    tagline: localized,
    description: localized,
    features: z
      .array(z.object({ title: localized, description: localized, image: z.string().optional(), images: z.array(z.string()).optional(), video: z.string().optional(), zoom: z.union([z.boolean(), z.object({ scale: z.number().optional(), mobileScale: z.number().optional(), origin: z.enum(['top left','top center','top right','center','bottom left','bottom center','bottom right']).optional(), mobileOrigin: z.enum(['top left','top center','top right','center','bottom left','bottom center','bottom right']).optional() })]).optional() }))
      .default([]),
    /** Permissions the app requests (shown as chips). */
    permissions: z.array(z.string()).default([]),
    screenshots: z.array(z.object({ src: z.string(), alt: localized })).default([]),
    specs: z.array(z.object({ label: localized, value: z.string() })).default([]),
    tech: z.array(z.string()).default([]),
    faq: z.array(z.object({ q: localized, a: localized })).default([]),
    changelog: z
      .array(z.object({ version: z.string(), date: z.string(), notes: z.array(localized) }))
      .default([]),
    googleGroupUrl: optionalUrl,
    /** Additional Google Groups (shown as extra buttons in step 1). */
    extraGroups: z.array(z.object({ name: z.string(), url: z.url() })).default([]),
    optInUrl: optionalUrl,
    playStoreUrl: optionalUrl,
    githubUrl: optionalUrl,
    feedbackUrl: optionalUrl,
    privacyUrl: z.string().default(''),
    /** Set true to hide the app from listings. */
    hidden: z.boolean().default(false),
  }),
});

export const collections = { blog, apps };




