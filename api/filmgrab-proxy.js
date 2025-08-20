// Streams an image with multiple fallbacks (Referer, no-Referer, WP Photon CDN).
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const src = Array.isArray(req.query.src) ? req.query.src[0] : req.query.src;
  const ref = Array.isArray(req.query.ref) ? req.query.ref[0] : req.query.ref;
  if (!src) return res.status(400).send("Missing ?src=IMAGE_URL");

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
  const acceptImg = "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";

  function toPhoton(u) {
    try {
      const x = new URL(u);
      const full = x.host + x.pathname + (x.search || "");
      const A = "https://i0.wp.com/" + full + (x.search ? "&" : "?") + "ssl=1";
      const B = "https://i0.wp.com/" + x.host + x.pathname + "?ssl=1";
      return [A, B];
    } catch { return []; }
  }
  async function tryFetch(url, headers) {
    try {
      const r = await fetch(url, { headers, redirect: "follow" });
      if (!r.ok) return null;
      return r;
    } catch { return null; }
  }

  const headersWithRef = {
    "user-agent": UA,
    "accept": acceptImg,
    "accept-language": "en-US,en;q=0.9",
    "referer": ref || "https://film-grab.com/",
    "origin": "https://film-grab.com",
    "sec-fetch-site": "same-site",
    "sec-fetch-mode": "no-cors",
    "sec-fetch-dest": "image"
  };
  const headersNoRef = {
    "user-agent": UA,
    "accept": acceptImg,
    "accept-language": "en-US,en;q=0.9",
    "referer": ""
  };

  const attempts = [];
  attempts.push({ url: src, headers: headersWithRef });
  attempts.push({ url: src, headers: headersNoRef });

  const [photonA, photonB] = toPhoton(src);
  if (photonA) attempts.push({ url: photonA, headers: headersWithRef });
  if (photonB) attempts.push({ url: photonB, headers: headersWithRef });
  if (photonA) attempts.push({ url: photonA, headers: headersNoRef });
  if (photonB) attempts.push({ url: photonB, headers: headersNoRef });

  try {
    let upstream = null;
    for (const a of attempts) {
      upstream = await tryFetch(a.url, a.headers);
      if (upstream) break;
    }
    if (!upstream) return res.status(502).send("Upstream fetch failed.");

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    console.error("filmgrab-proxy error:", e);
    res.status(500).send("Proxy error: " + (e.message || "unknown"));
  }
};
