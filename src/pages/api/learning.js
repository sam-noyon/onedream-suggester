export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return res.status(200).json({weights:{}}); // no-op without config
  try {
    const scan = await fetch(`${url}/SCAN/0`, { headers: { Authorization: `Bearer ${token}` }});
    const data = await scan.json();
    const keys = (data.result?.[1] || []).filter(k=>k.startsWith('od:host:'));
    const weights = {};
    for (const k of keys){
      const gr = await fetch(`${url}/GET/${k}`, { headers: { Authorization: `Bearer ${token}` }});
      const v = (await gr.json()).result;
      if (v != null) weights[k.replace('od:host:','')] = parseFloat(v);
    }
    return res.status(200).json({weights});
  } catch {
    return res.status(200).json({weights:{}});
  }
}
