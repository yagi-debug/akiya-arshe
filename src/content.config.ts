import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const guide = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/guide' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    publishDate: z.string(),
    updatedDate: z.string().optional(),
    author: z.string().default('空き家のミカタ編集部'),
    authorTitle: z.string().default('宅地建物取引業者（大阪府知事(1)第65646号）'),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    howToSteps: z.array(z.object({
      name: z.string(),
      text: z.string(),
    })).optional(),
    // 不正なcluster値が1記事でも入るとastro build全体が失敗しデプロイが止まるため、
    // enumに合わない値は undefined にフォールバックさせる（ビルドを止めない＝根本対策）。
    cluster: z.enum(['inheritance', 'non-rebuildable', 'shared-ownership', 'akiya-tax', 'accident', 'wakeari']).catch(undefined).optional(),
    isPillar: z.boolean().catch(undefined).optional(),
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
    lat: z.number().optional(),
    lng: z.number().optional(),
  }),
});

export const collections = { guide, area };
