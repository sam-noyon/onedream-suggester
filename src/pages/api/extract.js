import * as cheerio from "cheerio";

export default async function handler(req, res) {
  // --- CORS ---
  // add at top of handler
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");
if (req.method === "OPTIONS") return res.status(200).end();


  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") return res.status(400).json({ error: "url required" });

    const html = await (await fetch(url)).text();
    const $ = cheerio.load(html);
    const text = $("body").text().replace(/\s+/g, " ");

    const ects = (text.match(/(\d{2,3})\s*ECTS/) || [])[1] || null;
    const ielts = (text.match(/IELTS[^0-9]*([0-9]\.?[0-9]?)/i) || [])[1] || null;
    const tuition = (text.match(/(€|EUR|€\s*|EUR\s*)\s*([\d.,]{3,6})\s*(per|a)\s*(year|annum)/i) || [])[2] || null;

    res.status(200).json({
      ects: ects ? Number(ects) : null,
      ielts: ielts ? Number(ielts) : null,
      tuitionPerYear: tuition ? Number(String(tuition).replace(/[.,]/g, "")) : null
    });
  } catch (e) {
    res.status(200).json({ ects: null, ielts: null, tuitionPerYear: null });
  }
}
