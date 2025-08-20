export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36";

  try {
    const resp = await fetch("https://film-grab.com/random-post/", {
      headers: { "user-agent": UA, accept: "text/html" },
      redirect: "follow",
    });

    const postUrl = resp.url;
    const html = await resp.text();

    const { title, credits, images } = parseFilmGrab(html);
    if (!images.length) throw new Error("No stills found on the page.");

    const imageUrl = images[Math.floor(Math.random() * images.length)];

    const base = (req.headers["x-forwarded-proto"] || "https") + "://" + req.headers.host;
    const proxiedImage = `${base}/api/filmgrab-proxy?src=${encodeURIComponent(imageUrl)}`;

    res.setHeader("Cache-Control", "public, max-age=60");
    res.status(200).json({ ok: true, film: title || null, credits: credits || null, postUrl, imageUrl, proxiedImage, attribution: "Source: FilmGrab" });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || "Unknown error" });
  }
}

function getAttr(tag, name) {
  const key = name + '="';
  const i = tag.indexOf(key); if (i === -1) return null;
  const j = tag.indexOf('"', i + key.length); if (j === -1) return null;
  return tag.substring(i + key.length, j);
}
function largestFromSrcset(srcset) {
  if (!srcset) return null;
  const urls = [];
  for (const part of srcset.split(",")) {
    const piece = part.trim();
    const space = piece.indexOf(" ");
    const url = space > -1 ? piece.substring(0, space) : piece;
    if (url) urls.push(url);
  }
  return urls.length ? urls[urls.length - 1] : null;
}
function stripTags(s) { return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }

function parseFilmGrab(html) {
  let title = null;
  const t1 = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>(.*?)<\/h1>/i);
  if (t1 && t1[1]) title = stripTags(t1[1]);
  if (!title) { const t2 = html.match(/<title[^>]*>(.*?)<\/title>/i); if (t2 && t2[1]) title = stripTags(t2[1]); }

  let credits = null;
  const contentMatch = html.match(/<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch && contentMatch[1]) {
    const p = contentMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (p && p[1]) credits = stripTags(p[1]).trim();
  }

  let content = contentMatch && contentMatch[1] ? contentMatch[1] : html;

  const images = [];
  const seen = new Set();
  let idx = 0;
  while (true) {
    const start = content.indexOf("<img", idx); if (start === -1) break;
    const end = content.indexOf(">", start); if (end === -1) break;
    const tag = content.substring(start, end + 1); idx = end + 1;

    const full = getAttr(tag, "data-full-url");
    const srcset = getAttr(tag, "srcset");
    const src = getAttr(tag, "src");
    const best = full || largestFromSrcset(srcset) || src;

    if (best && /^https?:\/\//i.test(best) && /\.(jpe?g|png|webp)(\?|$)/i.test(best)) {
      if (!seen.has(best)) { seen.add(best); images.push(best); }
    }
  }
  return { title, credits, images };
}

