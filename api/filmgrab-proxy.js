export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const src = req.query.src;
  if (!src || Array.isArray(src)) { res.status(400).send("Missing ?src=IMAGE_URL"); return; }

  try {
    const upstream = await fetch(src, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36",
        referer: "",
      },
    });
    if (!upstream.ok) { res.status(upstream.status).send("Upstream fetch failed."); return; }

    const ct = upstream.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");

    const buf = Buffer.from(await upstream.arrayBuffer());
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).send("Proxy error: " + (e.message || "unknown"));
  }
}
