// Streams the image bytes from FilmGrab to your client (so <img> loads from your origin)

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const src = Array.isArray(req.query.src) ? req.query.src[0] : req.query.src;
  const ref = Array.isArray(req.query.ref) ? req.query.ref[0] : req.query.ref;

  if (!src) { res.status(400).send("Missing ?src=IMAGE_URL"); return; }

  const UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36";

  // Two attempts: with referer (post URL or site root), then without
  const attempts = [
    {
      headers: {
        "user-agent":     UA,
        "accept":         "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "accept-language":"en-US,en;q=0.9",
        "referer":        ref || "https://film-grab.com/",
      },
    },
    {
      headers: {
        "user-agent": UA,
        "accept":     "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "accept-language":"en-US,en;q=0.9",
        "referer":    "",
      },
    },
  ];

  try {
    let upstream, lastErr;
    for (const opt of attempts) {
      try {
        upstream = await fetch(src, { ...opt, redirect: "follow" });
        if (upstream.ok) break;
        lastErr = new Error("Status " + upstream.status);
      } catch (e) { lastErr = e; }
    }

    if (!upstream || !upstream.ok) {
      res.status(502).send("Upstream fetch failed.");
      return;
    }

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("Proxy error: " + (e.message || "unknown"));
  }
}
