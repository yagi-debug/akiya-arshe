// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// コンテンツのfrontmatterから実際の更新日を引く（全URLにビルド日を入れると
// Googleがlastmodを信頼しなくなるため、実日付が取れるページだけに付ける）
const lastmodMap = {};
// noindexページはsitemapにも載せない（noindexなのにsitemap掲載はGoogleへの矛盾シグナルになるため）
const noindexPaths = new Set();
for (const coll of ['guide', 'area']) {
  const dir = fileURLToPath(new URL(`./src/content/${coll}`, import.meta.url));
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const fm = src.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const m = fm[1].match(/updatedDate:\s*["']?(\d{4}-\d{2}-\d{2})/) ||
              fm[1].match(/publishDate:\s*["']?(\d{4}-\d{2}-\d{2})/);
    const pathname = `/${coll}/${f.replace(/\.md$/, '')}/`;
    if (m) lastmodMap[pathname] = m[1];
    if (/^noindex:\s*true/m.test(fm[1])) noindexPaths.add(pathname);
  }
}

export default defineConfig({
  site: 'https://akiya.arshe-corp.com',
  integrations: [sitemap({
    changefreq: 'weekly',
    priority: 0.7,
    // /tokuten/ はLINE友だち限定の特典受け取りページ（noindex）なのでsitemapに載せない
    filter: (page) => {
      const pathname = new URL(page).pathname;
      return !noindexPaths.has(pathname) && pathname !== '/tokuten/';
    },
    serialize(item) {
      const pathname = new URL(item.url).pathname;
      const lastmod = lastmodMap[pathname];
      // ガイド記事・エリアページは高優先度
      if (pathname.startsWith('/guide/') || pathname.startsWith('/area/')) {
        return { ...item, priority: 0.8, changefreq: 'weekly', ...(lastmod ? { lastmod } : {}) };
      }
      // トップページ・LPは最高優先度
      if (item.url === 'https://akiya.arshe-corp.com/' || pathname.includes('/lp-')) {
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