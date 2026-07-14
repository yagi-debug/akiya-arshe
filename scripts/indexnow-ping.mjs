// デプロイ後にIndexNow(Bing等)へ全URLを通知する。
// GitHub Pagesの反映ラグがあるため、キーファイルが公開されるまで待ってから通知する。
import { readFileSync } from "node:fs";

const KEY = "603a425071457d07748eb0b40bd290cc";
const HOST = "akiya.arshe-corp.com";
const KEY_URL = `https://${HOST}/${KEY}.txt`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const xml = readFileSync(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // キーファイルの公開を待つ（最大3分）
  let keyLive = false;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${KEY_URL}?t=${i}`).catch(() => null);
    if (r && r.ok) {
      keyLive = true;
      break;
    }
    await sleep(15000);
  }
  if (!keyLive) {
    console.warn("IndexNow: キーファイル未公開のためスキップ");
    process.exit(0);
  }

  // Bingのエンドポイントに送る（IndexNowプロトコルにより他の参加エンジンにも共有される。
  // api.indexnow.org はキー検証結果をキャッシュして403を返し続けることがあるため使わない）
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://www.bing.com/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_URL, urlList: urls }),
    });
    console.log(`IndexNow(Bing): ${urls.length} URLs → HTTP ${res.status}`);
    if (res.status === 200 || res.status === 202) break;
    await sleep(30000);
  }
} catch (e) {
  console.warn("IndexNow ping failed (deploy自体は成功):", e.message);
}
