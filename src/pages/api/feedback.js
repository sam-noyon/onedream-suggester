export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({error:"method"});

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const host = (body && body.host) || "";
    if (!host) return res.status(200).json({ok:true}); // no-op

    // If you set these envs, we’ll record a simple counter per domain:
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return res.status(200).json({ok:true}); // no-op without config

    const curR = await fetch(`${url}/GET/od:host:${host}`, { headers: { Authorization: `Bearer ${token}` }});
    const curJ = await curR.json();
    const cur  = curJ.result ? parseFloat(curJ.result) : 0;
    const next = cur + (body.like ? 1 : -1);
    await fetch(`${url}/SET/od:host:${host}/${next}`, { headers: { Authorization: `Bearer ${token}` }});
    return res.status(200).json({ok:true});
  } catch {
    return res.status(200).json({ok:true});
  }
}
