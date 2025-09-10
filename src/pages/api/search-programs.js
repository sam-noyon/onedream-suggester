const CSE = `https://www.googleapis.com/customsearch/v1`;

export default async function handler(req, res) {
  // ---- CORS ----
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.status(204).end(); // preflight
  }

  // ... your existing code (fetch Google, parse, res.status(200).json(...))
}



  try {
    const { country = "finland", field = "", degree = "", english = "yes" } = req.query;

    const countryFilters = {
      finland: '(site:studyinfinland.fi OR site:opintopolku.fi OR site:migri.fi)',
      denmark: '(site:nyidanmark.dk OR site:ufm.dk OR site:studyindenmark.dk OR site:ku.dk OR site:dtu.dk OR site:sdu.dk OR site:aau.dk OR site:au.dk OR site:itu.dk)',
      italy: '(site:universitaly.it OR site:studyinitaly.esteri.it)',
      germany: '(site:daad.de)',
      malaysia: '(site:studyinmalaysia.com)'
    };

    const deg = String(degree).toLowerCase();
    const levelHint = deg.includes("bachelor") ? "Bachelor" : deg.includes("master") ? "Master" : "";
    const langHint = english === "yes" ? '("taught in English" OR English)' : "";

    const q = [
      countryFilters[String(country).toLowerCase()] || "",
      field,
      levelHint,
      langHint,
      "ECTS"
    ].filter(Boolean).join(" ");

    const url = `${CSE}?key=${process.env.GOOGLE_CSE_KEY}&cx=${process.env.GOOGLE_CSE_CX}&q=${encodeURIComponent(q)}&num=10`;

    const r = await fetch(url);
    const data = await r.json();

    const items = (data.items || []).map((i) => ({
      title: i.title,
      link: i.link,
      snippet: i.snippet,
      displayLink: i.displayLink
    }));

    res.status(200).json({ q, items, rawError: data.error || null });
  } catch (err) {
    res.status(500).json({ error: "search_failed", detail: String(err) });
  }
}
