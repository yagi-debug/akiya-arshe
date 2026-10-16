// ビルド後の検問: 検索から外したページの扱いが、あとから崩れていないかを調べる。1つでも崩れていれば行を出して終了コード1で止める。
// 2026-10-12 追加（SEO 記事整理）。
//  1) dist の中で robots が noindex のページが、サイトマップに載っていないこと
//  2) 設計書で「リンク先を中心の記事へ付け替えた」記事へ、ほかのページの本文から張ったリンクが0本であること
//     （付け替えた記事 = 検索から外した記事のうち、被リンクが多く、リンクが中心の記事へ移ったもの。下の MOVED_AWAY）
// 例外: 観測中の改善実験の3ページ（10/15の判定まで触らない）は、付け替え前のリンクのまま残してある。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));
const ORIGIN = 'https://akiya.arshe-corp.com';

// 付け替えた記事 -> 付け替え先（中心の記事）
const MOVED_AWAY = {
  '/guide/souzoku-hub/': '/guide/parent-death-house/',
  '/guide/saikenchifu-hub/': '/guide/non-rebuildable-property-sale/',
  '/guide/kyouyuu-mochibun-hub/': '/guide/kyouyuu-mochibun-kaitori/',
  '/guide/kyouyuu-mochibun-qa-hub/': '/guide/kyouyuu-mochibun-kaitori/',
  '/guide/vacant-house/': '/guide/akiya-shobun-5-hikaku/',
  '/guide/vacancy-tax-6times/': '/guide/akiya-koteishisanzei-6bai-hikaku/',
  '/guide/souzoku-apart-kaitori/': '/guide/souzoku-apart-kanzen-guide/',
  '/guide/akiya-kaitori/': '/guide/akiya-shobun-5-hikaku/',
  '/guide/inheritance-sale/': '/guide/parent-death-house/',
  '/guide/selling-process/': '/guide/osaka-kaitori-vs-chukai/',
  '/guide/saikenchifu-kaitori/': '/guide/non-rebuildable-property-sale/',
  '/guide/inheritance-registry/': '/guide/inheritance-registry-neglect-sale-3options/',
  '/guide/joint-ownership-sale/': '/guide/kyouyuu-mochibun-kaitori/',
  '/guide/lp-wakeari-bukken-kaitori/': '/guide/osaka-city-yakuari-kaitori/',
  '/guide/selling-tax-guide/': '/guide/souzoku-jouto-shotokuzei-5nen-kisanbi/',
  '/guide/jiko-bukken-kaitori/': '/guide/jiko-bukken-hub/',
  '/guide/kotei-shisan-zei-nousho-baikyaku-3taiken/': '/guide/kotei-shisan-zei-tsuchisho-checklist/',
  '/guide/souzoku-fudousan-shobun-kanzen-guide/': '/guide/parent-death-house/',
  '/guide/souzoku-fudousan-urikata-kanzen-guide/': '/guide/parent-death-house/',
  '/guide/souzoku-touki-gimuka-kanzen-taiou-2026/': '/guide/inheritance-registry-neglect-sale-3options/',
  '/guide/kaitori-jirei-10sen/': '/guide/osaka-city-yakuari-kaitori/',
  '/guide/kaitori-jirei/': '/guide/osaka-city-yakuari-kaitori/',
  '/guide/osaka-kaitori-jirei/': '/guide/kyouyuu-mochibun-kaitori/',
  '/guide/nyukyosha-apart-baikyaku/': '/guide/souzoku-apart-owner-change-shokei/',
  '/area/osaka-city/': '/guide/osaka-city-yakuari-kaitori/',
  '/guide/ninibaikyaku-guide/': '/guide/osaka-nini-baikyaku-kyosai-calendar/',
};
// 観測中の3ページ（付け替えずに残す）
const EXEMPT_PAGES = new Set([
  '/guide/wakeari-bukken-kaitori-tetsuzuki/',
  '/guide/abeno-fuminosato-fudosan-kaitori/',
  '/area/osaka-abeno-showamachi/',
]);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (p.endsWith('.html')) yield p;
  }
}
const urlOf = (file) => {
  const rel = '/' + path.relative(dist, file).split(path.sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
};

// サイトマップの URL（パスだけ）
const sitemapPaths = new Set();
for (const f of fs.readdirSync(dist).filter((n) => /^sitemap-\d+\.xml$/.test(n))) {
  for (const m of fs.readFileSync(path.join(dist, f), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) {
    sitemapPaths.add(new URL(m[1]).pathname);
  }
}
if (sitemapPaths.size === 0) { console.error('✗ dist にサイトマップがありません'); process.exit(1); }

const problems = [];
let html = 0, noindexCount = 0;
for (const file of walk(dist)) {
  html++;
  const url = urlOf(file);
  const src = fs.readFileSync(file, 'utf8');
  // 1) noindex ならサイトマップに載っていない
  if (/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(src)) {
    noindexCount++;
    if (sitemapPaths.has(url)) problems.push(`noindex なのにサイトマップに載っている: ${url}`);
  }
  // 2) 付け替えた記事への本文リンクが0本
  if (EXEMPT_PAGES.has(url)) continue;
  for (const m of src.matchAll(/<a\b[^>]*?href=(["'])([^"']+)\1/g)) {
    const href = m[2].replace(ORIGIN, '').split(/[?#]/)[0];
    const norm = href.endsWith('/') ? href : href + '/';
    if (norm === url) continue; // その記事自身の中のリンクは対象外
    if (MOVED_AWAY[norm]) { problems.push(`付け替えたはずの記事へのリンクが残っている: ${url} -> ${m[2]}（付け替え先 ${MOVED_AWAY[norm]}）`); }
  }
}

if (problems.length) {
  console.error(`✗ SEO 構造の検問に ${problems.length} 件の問題があります（HTML ${html} 枚・noindex ${noindexCount} 枚を検査）`);
  for (const p of problems.slice(0, 50)) console.error('  ' + p);
  if (problems.length > 50) console.error(`  …ほか ${problems.length - 50} 件`);
  process.exit(1);
}
console.log(`✓ SEO構造 検問OK（HTML ${html} 枚・noindex ${noindexCount} 枚がサイトマップに無い・付け替え記事 ${Object.keys(MOVED_AWAY).length} 本へのリンク 0）`);
