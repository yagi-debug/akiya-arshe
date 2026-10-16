// ビルド後の検問: dist の全 HTML で、ページを指す内部リンク（href="/..."）が
// 末尾 / なしになっていないかを数える。1本でもあれば行と件数を出して終了コード1で止める。
// 末尾 / なしは公開サイトで毎回 301 転送を挟むため（2026-10-11 追加）。
// 対象外: ルート "/"、拡張子つきのファイル（/images/a.webp, /llms.txt など）、外部URL、"//" 始まり。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist', import.meta.url));

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (p.endsWith('.html')) yield p;
  }
}

let html = 0;
const bad = [];
for (const file of walk(dist)) {
  html++;
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/href=(["'])(\/[^"']*)\1/g)) {
      const href = m[2];
      if (href.startsWith('//')) continue;
      const pathname = href.split(/[?#]/)[0];
      if (pathname === '/' || pathname.endsWith('/')) continue;
      if (/\.[A-Za-z0-9]+$/.test(pathname.split('/').pop())) continue;
      bad.push(`${path.relative(dist, file)}:${i + 1}  ${href}`);
    }
  });
}

if (bad.length) {
  console.error(`✗ 末尾 / なしの内部リンクが ${bad.length} 本あります（HTML ${html} 枚を検査）`);
  for (const b of bad.slice(0, 50)) console.error('  ' + b);
  if (bad.length > 50) console.error(`  …ほか ${bad.length - 50} 本`);
  process.exit(1);
}
console.log(`✓ 内部リンク末尾 / 検問OK（HTML ${html} 枚・末尾 / なし 0）`);
