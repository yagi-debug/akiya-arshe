#!/usr/bin/env node
// LINE導線URLの検問。build/deployの前に必ず走り、違反が1件でもあればビルドを止める。
//
// 背景（2026-08-08 会長指摘）: 自動記事生成ジョブが2026年4〜5月に架空のLINE URL
// （lin.ee/example, lin.ee/gyFhEvp 等）を創作してそのまま公開し、リンク切れCTAが
// 約3ヶ月半本番に残っていた。生成AIはURLを平気で創作するので、正URL以外を
// 機械検査で止めるのが唯一の恒久対策。
//
// 正とするLINE導線はこの2形だけ（流入経路計測付き入口URL）:
//   https://line.arshe1719.workers.dev/auth/line?ref=hp    （HP内の通常導線）
//   https://line.arshe1719.workers.dev/auth/line?ref=llms  （llms.txt）
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOTS = ['src', 'public'];
const EXTS = new Set(['.astro', '.md', '.mdx', '.ts', '.js', '.mjs', '.txt', '.html', '.json', '.xml']);
const ALLOWED = /^https:\/\/line\.arshe1719\.workers\.dev\/auth\/line\?ref=(hp|llms)$/;

// URLらしき塊を拾う各パターン。lin.ee は全面禁止（経路が取れない旧URL＋創作URLの温床）
const SUSPECTS = [
  /https?:\/\/lin\.ee\/[^\s"'`)\]<>（）、。]*/g,
  /https?:\/\/liff\.line\.me\/[^\s"'`)\]<>（）、。]*/g,
  /https?:\/\/line\.me\/R\/[^\s"'`)\]<>（）、。]*/g,
  /https?:\/\/line\.arshe1719\.workers\.dev\/[^\s"'`)\]<>（）、。]*/g,
];

// クリック可能CTA（tel:/mailto:）の許可リスト。記事AIは電話番号・メアドも創作する
// （2026-08-08検出: 架空の06-7777-1373が4月から記事に載っていた）。
// 本文中の役所等の電話番号は対象外。検査するのはリンク（tel:/mailto:）だけ。
const ALLOWED_TEL = new Set(['06-7509-5696']);
const ALLOWED_MAILTO = new Set(['info.arshe@arshe-corp.com']);
const TEL_RE = /tel:([0-9+-]+)/g;
const MAILTO_RE = /mailto:([^\s"'`)\]<>（）、。?]+)/g;

const violations = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (EXTS.has(extname(name))) check(p);
  }
}

function check(file) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const re of SUSPECTS) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        const url = m[0];
        if (!ALLOWED.test(url)) violations.push(`${file}:${i + 1}: ${url}`);
      }
    }
    TEL_RE.lastIndex = 0;
    for (const m of line.matchAll(TEL_RE)) {
      if (!ALLOWED_TEL.has(m[1])) violations.push(`${file}:${i + 1}: tel:${m[1]}（許可済み電話番号ではない）`);
    }
    MAILTO_RE.lastIndex = 0;
    for (const m of line.matchAll(MAILTO_RE)) {
      if (m[1] && !ALLOWED_MAILTO.has(m[1])) violations.push(`${file}:${i + 1}: mailto:${m[1]}（許可済みメアドではない）`);
    }
  });
}

for (const root of ROOTS) walk(root);

if (violations.length > 0) {
  console.error('✖ LINE導線URLの検問で違反を検出。正URL（auth/line?ref=hp|llms）以外は公開できません:');
  for (const v of violations) console.error('  ' + v);
  console.error(`計${violations.length}件。記事生成がURLを創作した可能性が高い。正URLに直してから再実行してください。`);
  process.exit(1);
}
console.log('✓ LINE導線URL検問OK（lin.ee残存なし・入口URLはref=hp/llmsのみ）');
