// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://akiya.arshe-corp.com',
  integrations: [sitemap({
    changefreq: 'weekly',
    priority: 0.7,
    serialize(item) {
      // ガイド記事・エリアページは高優先度
      if (item.url.includes('/guide/') || item.url.includes('/area/')) {
        return { ...item, priority: 0.8, changefreq: 'weekly' };
      }
      // トップページ・LPは最高優先度
      if (item.url === 'https://akiya.arshe-corp.com/' ||
          item.url.includes('/lp-')) {
        return { ...item, priority: 1.0, changefreq: 'daily' };
      }
      return item;
    }
  })],
  vite: {
    plugins: [tailwindcss()]
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light'
    }
  }
});