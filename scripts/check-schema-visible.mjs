#!/usr/bin/env node
// 構造化データ（JSON-LD）の画面一致検問。build の最後に走り、違反が1件でもあればビルドを止める。
//
// 背景（2026-10-11）: guide テンプレートが frontmatter の faqs・howToSteps を JSON-LD にだけ出し、
// 画面に表示していなかった（FAQ: 340ページ中252ページ、HowTo: 127ページ中99ページ）。
// Google は「構造化データは画面に見える内容と一致させる」ことを求める。
// dist の全 HTML について、FAQPage / QAPage / HowTo の質問・答え・手順が
// 画面の文字（script・style・noscript・template を除いたもの。details の中身を含む）に含まれるかを調べる。
//
// 使い方: node scripts/check-schema-visible.mjs [dist のパス（既定 dist）]

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const DIST = process.argv[2] || 'dist';
if (!existsSync(DIST)) {
  console.error(`✖ ${DIST} がありません。先に astro build を実行してください`);
  process.exit(1);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

// 比較用の正規化: HTMLタグ・markdown記号・空白（全角含む）を除く
// stripTags=true は JSON-LD 側の文字列用。画面側はタグを外し終えた後の文字なので、
// 「&lt;」から戻した < を新しいタグと見なして本文を削らないよう、タグ除去を重ねない。
function normalize(s, { stripTags = true } = {}) {
  let t = String(s ?? '');
  if (stripTags) t = t.replace(/<[^>]*>/g, '');
  return t
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_#<>|`~\\]/g, '')
    .replace(/\s+/g, '')
    .replace(/　/g, '');
}

function visibleText(html) {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<[^>]*>/g, '');
  return normalize(decodeEntities(body), { stripTags: false });
}

function jsonLdBlocks(html) {
  const out = [];
  const re = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    try {
      out.push(JSON.parse(decodeEntities(m[1]).trim()));
    } catch {
      out.push({ __parseError: true });
    }
  }
  return out;
}

// JSON-LD から検査対象 {kind, label, text} を取り出す
function* collect(node) {
  if (Array.isArray(node)) {
    for (const n of node) yield* collect(n);
    return;
  }
  if (!node || typeof node !== 'object') return;
  if (node.__parseError) {
    yield { kind: 'JSON-LD', label: '解析不能', text: '' , parseError: true };
    return;
  }
  const types = [].concat(node['@type'] ?? []);
  const has = (t) => types.includes(t);
  if (has('FAQPage')) {
    for (const q of [].concat(node.mainEntity ?? [])) {
      yield { kind: 'FAQPage 質問', label: q.name, text: q.name };
      const a = q.acceptedAnswer;
      for (const ans of [].concat(a ?? [])) yield { kind: 'FAQPage 答え', label: q.name, text: ans?.text };
    }
  }
  if (has('QAPage')) {
    const q = node.mainEntity;
    if (q) {
      yield { kind: 'QAPage 質問', label: q.name, text: q.name };
      for (const ans of [].concat(q.acceptedAnswer ?? [], q.suggestedAnswer ?? [])) {
        yield { kind: 'QAPage 答え', label: q.name, text: ans?.text };
      }
    }
  }
  if (has('HowTo')) {
    for (const s of [].concat(node.step ?? [])) {
      yield { kind: 'HowTo 手順名', label: s.name, text: s.name };
      yield { kind: 'HowTo 手順本文', label: s.name, text: s.text };
    }
  }
  if (node['@graph']) yield* collect(node['@graph']);
}

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(name) === '.html') files.push(p);
  }
})(DIST);

const violations = [];
const pagesWithViolation = new Set();
let checkedItems = 0;
let pagesWithSchema = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const blocks = jsonLdBlocks(html);
  const items = [...collect(blocks)];
  if (items.length === 0) continue;
  pagesWithSchema++;
  const visible = visibleText(html);
  for (const it of items) {
    checkedItems++;
    if (it.parseError) {
      violations.push(`${file}: JSON-LD を解析できない`);
      pagesWithViolation.add(file);
      continue;
    }
    const needle = normalize(decodeEntities(String(it.text ?? '')));
    if (!needle || !visible.includes(needle)) {
      const shown = String(it.text ?? '').replace(/\s+/g, ' ').slice(0, 60);
      violations.push(`${file}: ${it.kind} が画面に無い: ${shown}`);
      pagesWithViolation.add(file);
    }
  }
}

if (violations.length > 0) {
  console.error('✖ 構造化データ（FAQPage・QAPage・HowTo）に、画面に表示されていない内容があります。Google の方針に反するため公開できません:');
  for (const v of violations) console.error('  ' + v);
  console.error(`計${violations.length}件・${pagesWithViolation.size}ページ（検査した HTML ${files.length} 枚、構造化データのあるページ ${pagesWithSchema}、検査項目 ${checkedItems}）。`);
  console.error('直し方: 画面に出すか、構造化データから外す。frontmatter の faqs はテンプレートが本文の直後に表示する。howToSteps は全手順が本文にあるときだけ構造化データに出る。');
  process.exit(1);
}
console.log(`✓ 構造化データ検問OK（HTML ${files.length} 枚・構造化データのあるページ ${pagesWithSchema}・検査項目 ${checkedItems}・画面に無い内容 0）`);
