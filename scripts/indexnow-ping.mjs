// デプロイ後にIndexNow(Bing等)へ全URLを通知する。失敗してもデプロイは成功扱い。
import { readFileSync } from "node:fs";

const KEY = "603a425071457d07748eb0b40bd290cc";
const HOST = "akiya.arshe-corp.com";

try {
  const xml = readFileSync(new URL("../dist/sitemap-0.xml", import.meta.url), "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: HOST,
      key: KEY,
      keyLocation: `https://${HOST}/${KEY}.txt`,
      urlList: urls,
    }),
  });
  console.log(`IndexNow: ${urls.length} URLs → HTTP ${res.status}`);
} catch (e) {
  console.warn("IndexNow ping failed (deploy自体は成功):", e.message);
}
