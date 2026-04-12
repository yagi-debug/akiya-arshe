import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guide = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guide' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.string(),
    updatedDate: z.string().optional(),
    author: z.string().default('宅建業者'),
    authorTitle: z.string().default(''),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
  }),
});

const area = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/area' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    areaName: z.string(),
    prefecture: z.string().default('大阪府'),
    avgPricePerSqm: z.number().optional(),
    population: z.number().optional(),
    publishDate: z.string(),
    updatedDate: z.string().optional(),
  }),
});

export const collections = { guide, area };
