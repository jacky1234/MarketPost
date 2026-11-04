import type { Env, Feed } from './types.js';
import { validate } from './validation.js';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
const tokenName = (agent: string) => 'PRODUCER_TOKEN_' + agent.toUpperCase().replace(':','_');
function decode(row: Feed): Feed {
  const out: Feed = {...row, from: row.from_agent};
  delete out.from_agent;
  for (const k of ['data','signals','sources','view']) { out[k] = row[k+'_json'] == null ? null : JSON.parse(row[k+'_json'] as string); delete out[k+'_json']; }
  out.tags = row.tags ? JSON.parse(row.tags as string) : [];
  return out;
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  if (path === '/v1/feed' && method === 'POST') {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({errors:{body:'需要 application/json'}},400);
    let body: unknown;
    try { body = await request.json(); } catch { return json({errors:{body:'无效 JSON'}},400); }
    const {item, errors} = validate(body);
    if (!item) return json({errors},400);
    const expected = env[tokenName(item.from as string)];
    if (typeof expected !== 'string' || !expected || request.headers.get('authorization') !== `Bearer ${expected}`) return json({error:'Unauthorized'},401);
    const columns = ['id','idempotency_key','protocol_version','type','from_agent','producer','market','symbol','name','tier','trading_day','event_at','published_at','severity','status','title','summary','body_md','data_json','signals_json','sources_json','view_json','reply_to','tags'];
    const values = columns.map(c => c === 'from_agent' ? item.from : c.endsWith('_json') ? JSON.stringify(item[c.slice(0,-5)] ?? null) : c === 'tags' ? JSON.stringify(item.tags) : item[c] ?? null);
    const result = await env.DB.prepare(`INSERT INTO feed_items (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(idempotency_key) DO NOTHING`).bind(...values).run();
    const stored = await env.DB.prepare('SELECT id, from_agent FROM feed_items WHERE idempotency_key = ?').bind(item.idempotency_key).first();
    if (!stored || stored.from_agent !== item.from) return json({error:'Conflicting identity'},409);
    return json({id:stored.id,deduplicated:result.meta.changes === 0},result.meta.changes ? 201 : 200);
  }
  // Access 在此预留；本次只有本地读接口，不把任意请求头当成已验证登录态。
  if (path.startsWith('/v1/') && request.headers.has('authorization')) return json({error:'Producer credentials have no read or management permission'},401);
  if (path === '/v1/feed' && method === 'GET') {
    const conditions: string[] = [], values: string[] = [];
    for (const [param,col] of Object.entries({from:'from_agent',type:'type',symbol:'symbol',trading_day:'trading_day'})) if (url.searchParams.has(param)) {conditions.push(`${col} = ?`);values.push(url.searchParams.get(param)!);}
    for (const key of url.searchParams.keys()) if (!['from','type','symbol','trading_day'].includes(key)) return json({errors:{[key]:'该查询参数尚未实现'}},400);
    const rows = await env.DB.prepare('SELECT * FROM feed_items'+(conditions.length?' WHERE '+conditions.join(' AND '):'')+' ORDER BY published_at DESC, id DESC').bind(...values).all();
    return json({items:rows.results.map(decode)});
  }
  if (path === '/v1/agents' && method === 'GET') {
    const d = url.searchParams.get('trading_day');
    const rows = await env.DB.prepare('SELECT from_agent AS "from", COUNT(*) AS count FROM feed_items'+(d?' WHERE trading_day = ?':'')+' GROUP BY from_agent ORDER BY from_agent').bind(...(d?[d]:[])).all();
    return json({agents:rows.results});
  }
  if (path === '/v1/watchlist' && method === 'GET') return json({items:(await env.DB.prepare('SELECT symbol, market, name, tier, currency, proxy_symbol, thesis, active, sort_order, created_at, updated_at FROM watchlist WHERE active = 1 ORDER BY sort_order, symbol').all()).results});
  if ((method === 'GET' && /^\/v1\/(feed\/[^/]+|events|alert-rules|health\/producers|commands)$/.test(path)) || (method === 'POST' && ['/v1/watchlist','/v1/commands'].includes(path)) || (method === 'PATCH' && /^\/v1\/(commands|watchlist)\/[^/]+$/.test(path)) || (method === 'DELETE' && /^\/v1\/watchlist\/[^/]+$/.test(path))) return json({error:'Not implemented'},501);
  if (path.startsWith('/v1/')) return json({error:'Not found'},404);
  return env.ASSETS.fetch(request);
}
export default { async fetch(request: Request, env: Env): Promise<Response> {
  try { return await route(request,env); } catch { return json({error:'Storage or request failure'},500); }
}};
