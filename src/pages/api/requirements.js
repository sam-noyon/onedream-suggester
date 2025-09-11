// src/pages/api/requirements.js
export default async function handler(req, res) {
  try {
    const url = (req.query.url || '').trim();
    if (!url) return res.status(400).json({ error: 'missing_url' });

    // Fetch the page with a decent UA + language
    const r = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        'Accept-Language': 'en,en-GB;q=0.9,en-US;q=0.8',
      },
    });
    const finalURL = r.url || url;
    const html = await r.text();

    // Strip scripts/styles
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // --- quick extractors ---
    // IELTS / TOEFL / PTE
    const ielts = (() => {
      const m = text.match(/IELTS[^0-9]*([0-9](?:\.[0-9])?)/i);
      return m ? Number(m[1]) : null;
    })();
    const toefl = (() => {
      const m = text.match(/TOEFL[^0-9]*([0-9]{2,3})/i);
      return m ? Number(m[1]) : null;
    })();
    const pte = (() => {
      const m = text.match(/PTE[^0-9]*([0-9]{2,3})/i);
      return m ? Number(m[1]) : null;
    })();

    // ECTS / Credits / CFU
    // We try to find the smallest "min requirement" first; if not found, we fall back to the biggest number as programme load
    const ectsNumbers = [...text.matchAll(/(\d{2,3})\s*(?:ECTS|credit points|credits|CFU)\b/gi)]
      .map(m => Number(m[1]))
      .filter(n => n >= 20 && n <= 360);

    let ectsMin = null;
    let programEcts = null;
    if (ectsNumbers.length) {
      // heuristic: if any number is between 60–180 and the text has "minimum" nearby, call it a minimum
      const minLike = [...text.matchAll(/minimum[^\.]{0,40}?(\d{2,3})\s*(?:ECTS|credit|CFU)/gi)]
        .map(m => Number(m[1]));
      if (minLike.length) ectsMin = Math.min(...minLike);

      // fallbacks
      if (!ectsMin) {
        // pick the smallest plausible minimum
        const plausible = ectsNumbers.filter(n => n <= 180);
        if (plausible.length) ectsMin = Math.min(...plausible);
      }
      // programme size = the largest number
      programEcts = Math.max(...ectsNumbers);
    }

    // Non-EU / International hint
    const nonEU =
      /non[-\s]?eu|international (students|applicants)|outside the eu|all nationalities/i.test(text);

    // Language taught in English hint
    const englishTaught =
      /taught in English|language of instruction[^\.]{0,40}English|English-taught/i.test(text);

    // Notes: pick short requirement-like sentences
    const picks = [];
    const sentences = text.split(/(?<=\.)\s+/).slice(0, 400);
    const keepRx =
      /(requirement|admission|entry|eligibility|prerequisite|IELTS|TOEFL|PTE|ECTS|credit|CFU|non[-\s]?EU|international)/i;
    for (const s of sentences) {
      if (keepRx.test(s) && s.length >= 40 && s.length <= 220) {
        picks.push(s.trim());
        if (picks.length >= 12) break;
      }
    }

    // Canonical link (if available)
    const canMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i);
    const canonical = canMatch ? canMatch[1] : finalURL;

    return res.status(200).json({
      ielts,
      toefl,
      pte,
      ectsMin: ectsMin || null,
      programEcts: programEcts || null,
      notes: picks,
      englishTaught,
      nonEU,
      canonical,
    });
  } catch (e) {
    return res.status(200).json({ error: 'extract_failed', detail: String(e) });
  }
}
