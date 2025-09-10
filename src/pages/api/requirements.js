// src/pages/api/requirements.js
export default async function handler(req, res) {
  // CORS for your WordPress domain
  res.setHeader("Access-Control-Allow-Origin", "*"); // or "https://onedreambd.com"
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "missing_url" });

  try {
    const seen = new Set();
    const pages = [];
    // fetch primary
    const main = await fetchPage(url);
    pages.push(main); seen.add(cleanURL(url));

    // try to find related requirement/admission links on same host (max 3)
    const rels = extractLinks(main.html)
      .filter(u => sameHost(url, u) && /admission|requirement|entry|eligib|language|english/i.test(u))
      .slice(0, 3);
    for (const u of rels) {
      if (seen.has(cleanURL(u))) continue;
      try { pages.push(await fetchPage(u)); seen.add(cleanURL(u)); } catch {}
    }

    // extract signals
    const signals = pages.map(p => glean(p.html));
    const merged = mergeSignals(signals);

    // fill canonical
    merged.canonical = main.finalURL || url;

    return res.status(200).json(merged);
  } catch (e) {
    return res.status(500).json({ error: "failed", detail: String(e) });
  }
}

// ---- helpers

async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  const r = await fetch(url, {
    signal: ctrl.signal,
    headers: {
      "User-Agent": "Mozilla/5.0 (OneDream-Requirements/1.0; +https://onedreambd.com)"
    }
  });
  clearTimeout(t);
  const html = await r.text();
  return { html, finalURL: r.url };
}

function cleanURL(u){ try{ return new URL(u).origin + new URL(u).pathname; }catch{ return u; } }
function sameHost(a,b){ try{ return new URL(a).host === new URL(b).host; }catch{ return false; } }

function extractLinks(html) {
  const links = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
  let m; while((m=re.exec(html))){ 
    const href=m[1]; if(!href||href.startsWith('#')||href.startsWith('mailto')) continue;
    links.push(href.startsWith('http')?href:href);
  }
  return Array.from(new Set(links));
}

function glean(html) {
  const txt = dehtml(html);
  const out = { notes: [] };

  // IELTS overall (6.0, 6.5, 7.0 etc.)
  const ieltsRe = /IELTS[^0-9]{0,12}(\d(?:\.\d)?)\s*(?:overall|band)?/i;
  const im = txt.match(ieltsRe);
  if (im) { out.ielts = Number(im[1]); out.ieltsNote = pickLine(txt, im.index); }

  // ECTS (min/requirement)
  const ectsRe = /(?:minimum|min\.?|at\s+least|require(?:s|d)?|contain(?:s|ing)?)[^0-9]{0,20}(\d{2,3})\s*ECTS/i;
  const em = txt.match(ectsRe);
  if (em) { out.ectsMin = Number(em[1]); out.ectsNote = pickLine(txt, em.index); }

  // Programme ECTS total (e.g., "120 ECTS programme")
  const progRe = /(\d{2,3})\s*ECTS\s*(?:programme|program|credits?)/i;
  const pm = txt.match(progRe);
  if (pm) out.programEcts = Number(pm[1]);

  // Useful notes: GPA, prerequisite areas
  const notes = [];
  const gpaRe = /(CGPA|GPA)[^\d]{0,8}(\d(?:\.\d)?)/i;
  const gm = txt.match(gpaRe); if (gm) notes.push(pickLine(txt, gm.index));
  const prereqRe = /(mathematics|higher math|programming|data structures|physics|chemistry|biology|accounting|statistics)/ig;
  let pr; const seen = new Set();
  while((pr = prereqRe.exec(txt))){ const line = pickLine(txt, pr.index); if(!seen.has(line)){seen.add(line); notes.push(line);} if(notes.length>6)break; }
  out.notes = notes;

  return out;
}

function dehtml(s){
  return s.replace(/<script[\s\S]*?<\/script>/gi,' ')
          .replace(/<style[\s\S]*?<\/style>/gi,' ')
          .replace(/<[^>]+>/g,' ')
          .replace(/\s+/g,' ')
          .trim();
}
function pickLine(txt, i){
  // return a short slice around index i
  const start = Math.max(0, i-140), end = Math.min(txt.length, i+140);
  return txt.substring(start, end).replace(/^\s+|\s+$/g,'');
}

function mergeSignals(arr){
  const out = { notes: [] };
  for (const s of arr){
    if (s.ielts && (!out.ielts || s.ielts>out.ielts)) { out.ielts=s.ielts; out.ieltsNote=s.ieltsNote; }
    if (s.ectsMin && (!out.ectsMin || s.ectsMin>s.ectsMin)) { out.ectsMin=s.ectsMin; out.ectsNote=s.ectsNote; }
    if (s.programEcts && (!out.programEcts || s.programEcts>out.programEcts)) out.programEcts=s.programEcts;
    out.notes.push(...(s.notes||[]));
  }
  // de-dup notes
  out.notes = Array.from(new Set(out.notes)).slice(0,8);
  return out;
}
