// src/pages/api/search-programs.js
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    const {
      country = "denmark",
      field = "Computer Science",
      degree = "Bachelor",
      english = "yes",
    } = req.query;

    const domains = {
      denmark: ["studyindenmark.dk","nyidanmark.dk","ufm.dk","ku.dk","dtu.dk","sdu.dk","aau.dk","au.dk","itu.dk"],
      finland: ["studyinfinland.fi","opintopolku.fi","migri.fi","helsinki.fi","aalto.fi","tuni.fi","lut.fi","oulu.fi","utu.fi"],
      germany: ["daad.de","tum.de","uni-heidelberg.de","tu-dresden.de"],
      italy: ["universitaly.it","studyinitaly.esteri.it","polimi.it","unibo.it","unimi.it"],
      malaysia: ["studyinmalaysia.com","utm.my","um.edu.my","upm.edu.my"],
    };

    const sites = (domains[country] || []).map(d => `site:${d}`).join(" OR ");
    const englishBit = english === "yes" ? '("taught in English" OR English)' : "";
    const query = `${sites} ${field} ${degree} ${englishBit} ECTS`.trim();

    const params = new URLSearchParams({
      key: process.env.GOOGLE_CSE_KEY ?? "",
      cx:  process.env.GOOGLE_CSE_CX  ?? "",
      q:   query,
      num: "10",
      safe:"active",
    });

    const apiUrl = `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
    const r = await fetch(apiUrl);
    if (!r.ok) {
      const body = await r.text();
      return res.status(r.status).json({ items: [], error: "google_error", body: body.slice(0,300) });
    }

    const json = await r.json();
    const items = (json.items || []).map(it => ({
      title: it.title,
      link: it.link,
      snippet: it.snippet,
      displayLink: it.displayLink,
    }));

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: "search_failed", detail: String(err) });
  }
}
