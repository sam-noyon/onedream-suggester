// src/pages/api/search-programs.js

const CX = '8033959c4315a4ee9';
const KEYS = [
  'AIzaSyBvZ-zGRzGLfsNHYYR7SpsHpim9Ty8MMNQ',
  'AIzaSyBA9u2VnxPZ2_YTmPTHApyK6v4024ee-FM',
  'AIzaSyDqT1IdlFaGU_l0ctzsoaWq3AjgBpQqZC4',
  'AIzaSyDWiDj2z0VUxkqH0n-X0ytfHWjUvpAOS4c',
  'AIzaSyBtkB51RWjrWrQF2Y2GZkkgfV1VvlDxAx0',
];

const COUNTRY_SITE = {
  denmark: 'site:.dk',
  finland: 'site:.fi',
  germany: 'site:.de',
  netherlands: 'site:.nl',
  sweden: 'site:.se',
  france: 'site:.fr',
  spain: 'site:.es',
  ireland: 'site:.ie',
  uk: 'site:.ac.uk',
};

function buildQuery({ field = '', degree = 'Master', english = 'yes', country = 'all' }) {
  const f = (field || '').trim();
  const deg = (degree || 'Master').toLowerCase();
  const eng = (english || 'yes').toLowerCase();
  const ct = (country || 'all').toLowerCase();

  const degreeTerm = deg === 'master' ? '(master OR MSc)' : '(bachelor OR BSc)';
  const englishTerm = eng === 'yes' ? 'english' : '';
  const programTerms = '(programme OR program OR course OR studies OR study)';
  const siteFilter = ct === 'all' ? '' : (COUNTRY_SITE[ct] || '');

  // Focus on subject pages at universities
  // You can tweak this string later to be stricter/looser.
  const parts = [f, degreeTerm, englishTerm, programTerms, siteFilter]
    .filter(Boolean)
    .join(' ');

  return parts;
}

async function cseRequest(q, key, extra = {}) {
  const params = new URLSearchParams({
    key,
    cx: CX,
    q,
    num: String(extra.num ?? 10),
  });
  const url = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
  const r = await fetch(url, { cache: 'no-store' });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

export default async function handler(req, res) {
  try {
    // Parse incoming filters
    const { country = 'all', field = '', degree = 'Master', english = 'yes' } = req.query;

    const q = buildQuery({ country, field, degree, english });

    // Try keys in order; stop at the first non-quota/non-auth response
    let data = null;
    let lastErr = null;
    for (const key of KEYS) {
      const { status, json } = await cseRequest(q, key);
      if (status === 429 || status === 403) {
        lastErr = json;
        continue; // try next key
      }
      data = json;
      break;
    }

    if (!data) {
      return res.status(200).json({
        items: [],
        error: 'google_error',
        body: lastErr || null,
      });
    }

    const items = Array.isArray(data.items) ? data.items : [];
    const cleaned = items.map(it => ({
      link: it.link,
      title: it.title,
      displayLink: it.displayLink,
      snippet: it.snippet,
    }));

    return res.status(200).json({ items: cleaned, q });
  } catch (e) {
    return res.status(200).json({
      items: [],
      error: 'server_error',
      message: String(e?.message || e),
    });
  }
}
