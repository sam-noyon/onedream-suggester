// src/pages/api/search-programs.js

const KEYS = (process.env.CSE_KEYS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const CX = process.env.CSE_CX || ""; // your Search engine ID

const COUNTRY_TLDS = {
  denmark: "site:.dk",
  finland: "site:.fi",
  germany: "site:.de",
  italy: "site:.it",
  france: "site:.fr",
  spain: "site:.es",
  ireland: "site:.ie",
  netherlands: "site:.nl",
  sweden: "site:.se",
  malaysia: "site:.my",
  uk: "(site:.ac.uk OR site:.uk)"
};

// Build a focused query leaning toward official subject pages
function buildQuery({ country, field, degree, english }) {
  const parts = [];

  if (field) parts.push(`"${field}"`);
  // Prefer programme/program/study/course words
  parts.push("(programme OR program OR study OR studies OR course)");
  if (degree?.toLowerCase() === "master") parts.push("(master OR msc)");
  if (degree?.toLowerCase() === "bachelor") parts.push("(bachelor OR bsc)");
  if (english === "yes") parts.push("english");

  // Prefer university domains in the selected country
  if (country && COUNTRY_TLDS[country]) parts.push(COUNTRY_TLDS[country]);

  // Reduce brochures/news noise a bit
  parts.push("-brochure -pdf -news");

  return parts.join(" ");
}

async function googleCSE(query, key) {
  const url =
    "https://www.googleapis.com/customsearch/v1?" +
    new URLSearchParams({
      key,
      cx: CX,
      q: query,
      num: "10",
      safe: "active"
    }).toString();

  const r = await fetch(url, { headers: { Accept: "application/json" } });

  // If quota or rate limited, surface it to the rotator
  if (r.status === 429 || r.status === 403) {
    const body = await r.json().catch(() => ({}));
    const reason =
      body?.error?.errors?.[0]?.reason ||
      body?.error?.status ||
      String(r.status);
    const err = new Error(reason);
    err._quota = true;
    throw err;
  }

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`CSE error ${r.status}: ${txt.slice(0, 200)}`);
  }
  return r.json();
}

// Try each key until one works (or all are exhausted)
async function callWithRotation(query) {
  if (!CX || !KEYS.length) {
    throw new Error("Missing env: CSE_CX or CSE_KEYS");
  }

  let lastErr;
  for (let i = 0; i < KEYS.length; i++) {
    try {
      return await googleCSE(query, KEYS[i]);
    } catch (e) {
      lastErr = e;
      // rotate only on quota/rate errors, otherwise stop immediately
      if (!e?._quota) throw e;
    }
  }
  // Nothing left
  const err = new Error(
    `All CSE keys exhausted: ${lastErr ? lastErr.message : "unknown"}`
  );
  err._exhausted = true;
  throw err;
}

export default async function handler(req, res) {
  try {
    const country = String(req.query.country || "").toLowerCase();
    const field = String(req.query.field || "");
    const degree = String(req.query.degree || "");
    const english = String(req.query.english || "");

    const query = buildQuery({ country, field, degree, english });
    const data = await callWithRotation(query);

    const items = (data.items || []).map(it => ({
      title: it.title,
      link: it.link,
      snippet: it.snippet,
      displayLink: it.displayLink
    }));

    res.status(200).json({ items });
  } catch (e) {
    // Keep your frontend stable: deliver empty list + a hint
    const message = String(e.message || e);
    const exhausted = !!e?._exhausted;

    res
      .status(200)
      .json({ items: [], error: exhausted ? "quota_exhausted" : "cse_error", detail: message });
  }
}
