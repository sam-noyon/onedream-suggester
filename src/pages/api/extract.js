// src/pages/api/extract.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const url = String(req.query.url || "");
  if (!url) return res.status(400).json({ error: "missing_url" });

  try {
    const r = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; OneDreamBot/1.0; +https://onedream-suggester.vercel.app)",
        "accept": "text/html,application/xhtml+xml",
      },
    });
    const html = await r.text();
    const txt  = html.replace(/\s+/g, " ");

    const ectsMatch  = txt.match(/(\d{2,3})\s*ECTS/i);
    const ieltsMatch = txt.match(/IELTS[^0-9]*([5-9](?:\.[0-9])?)/i);

    let tuitionPerYear = null;
    const tu1 = txt.match(/(tuition[^0-9]{0,40}|fee[^0-9]{0,40})(\d{3,5})(?:\s*)(EUR|€|USD|\$)[^\.]{0,60}(per\s*(year|annum|semester))/i);
    if (tu1) {
      const amount = parseInt(tu1[2], 10);
      const perSem = /semester/i.test(tu1[5] || "");
      tuitionPerYear = perSem ? amount * 2 : amount;
    }

    const ects  = ectsMatch  ? parseInt(ectsMatch[1], 10) : null;
    const ielts = ieltsMatch ? parseFloat(ieltsMatch[1]) : null;

    return res.status(200).json({ ects, ielts, tuitionPerYear });
  } catch (e) {
    return res.status(200).json({ ects: null, ielts: null, tuitionPerYear: null, note: "extract_failed" });
  }
}
