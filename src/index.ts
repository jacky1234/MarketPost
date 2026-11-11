import type { Env, Feed } from './types.js';
import { validate } from './validation.js';
import { hasAccess } from './access.js';
import { bearerPrincipal,requiredScope,type Principal } from './tokens.js';
import { decode, listFeed, health, QueryError, date } from './queries.js';
const json = (body: unknown, status = 200) => Response.json(body, {status, headers:{'Cache-Control':'no-store'}});
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url), path = url.pathname, method = request.method;
  let principal:Principal|null=null;
  if(path.startsWith('/v1/')&&(request.headers.has('authorization')||(method==='POST'&&path==='/v1/feed'))){
    principal=await bearerPrincipal(request,env);if(!principal)return json({error:'Unauthorized'},401);
    const scope=requiredScope(method,path);
    if(!scope||!principal.scopes.includes(scope)||(method!=='GET'&&principal.kind==='reader'))return json({error:'Forbidden'},403);
  }
  if (path === '/v1/feed' && method === 'POST') {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return json({errors:{body:'需要 application/json'}},400);
    let body: unknown;
    try { body = await request.json(); } catch { return json({errors:{body:'无效 JSON'}},400); }
    if(body&&typeof body==='object'&&'from' in body&&typeof body.from==='string'&&body.from!==principal!.agent)return json({error:'Unauthorized'},401);
    const {item, errors} = validate(body);
    if (!item) return json({code: errors['view.basis'] || errors['view.invalidation'] ? 'view_incomplete' : 'validation_error',errors},400);
    if(item.from!==principal!.agent)return json({error:'Unauthorized'},401);
    const columns = ['id','idempotency_key','protocol_version','type','from_agent','producer','market','symbol','name','tier','trading_day','event_at','published_at','severity','status','title','summary','body_md','data_json','signals_json','sources_json','view_json','reply_to','tags'];
    const values = columns.map(c => c === 'from_agent' ? item.from : c.endsWith('_json') ? JSON.stringify(item[c.slice(0,-5)] ?? null) : c === 'tags' ? JSON.stringify(item.tags) : item[c] ?? null);
    const result = await env.DB.prepare(`INSERT INTO feed_items (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')}) ON CONFLICT(idempotency_key) DO NOTHING`).bind(...values).run();
    const stored = await env.DB.prepare('SELECT id, from_agent FROM feed_items WHERE idempotency_key = ?').bind(item.idempotency_key).first();
    if (!stored || stored.from_agent !== item.from) return json({error:'Conflicting identity'},409);
    return json({id:stored.id,deduplicated:result.meta.changes === 0},result.meta.changes ? 201 : 200);
  }
  if (!principal && method === 'GET' && path.startsWith('/v1/') && !(await hasAccess(request, env))) return json({error:'Unauthorized'},401);
  if (path === '/v1/feed' && method === 'GET') return json(await listFeed(url,env));
  if (path === '/v1/agents' && method === 'GET') {
    const d = url.searchParams.get('trading_day');
    if (d && !date(d)) throw new QueryError('无效 trading_day');
    const rows = await env.DB.prepare('SELECT from_agent AS "from", COUNT(*) AS count FROM feed_items'+(d?' WHERE trading_day = ?':'')+' GROUP BY from_agent ORDER BY from_agent').bind(...(d?[d]:[])).all();
    return json({agents:rows.results});
  }
  if (path === '/v1/watchlist' && method === 'GET' && principal) return json({items:(await env.DB.prepare('SELECT symbol, name, tier, proxy_symbol AS proxy FROM watchlist WHERE active = 1 ORDER BY sort_order, symbol').all()).results});
  if (path === '/v1/watchlist' && method === 'GET') return json({items:(await env.DB.prepare('SELECT symbol, market, name, tier, currency, proxy_symbol, thesis, active, sort_order, created_at, updated_at FROM watchlist WHERE active = 1 ORDER BY sort_order, symbol').all()).results});
  // 人类全量档案；Bearer 对该路径默认拒绝，watchlist:read 不覆盖 lots。
  if (method === 'GET' && /^\/v1\/watchlist\/[^/]+$/.test(path)) {
    let symbol: string; try {symbol=decodeURIComponent(path.slice('/v1/watchlist/'.length));} catch {throw new QueryError('无效 symbol');}
    const item=await env.DB.prepare('SELECT symbol, market, name, tier, currency, proxy_symbol, thesis FROM watchlist WHERE symbol = ? AND active = 1').bind(symbol).first();
    if (!item) return json({error:'Not found'},404);
    const lots=(await env.DB.prepare('SELECT lot_id, symbol, shares, cost, note, alert_rule FROM watchlist_lots WHERE symbol = ? ORDER BY lot_id').bind(symbol).all()).results;
    return json({item,lots});
  }
  if (method === 'GET' && /^\/v1\/feed\/[^/]+$/.test(path)) {
    let id: string; try { id=decodeURIComponent(path.slice('/v1/feed/'.length)); } catch {throw new QueryError('无效 id');}
    const row=await env.DB.prepare('SELECT * FROM feed_items WHERE id = ?').bind(id).first();
    return row?json({...decode(row),data_raw:row.data_json}):json({error:'Not found'},404);
  }
  if (method === 'GET' && path === '/v1/events') {
    const from=url.searchParams.get('from'),to=url.searchParams.get('to');
    if((from&&!date(from))||(to&&!date(to))||(from&&to&&from>to))throw new QueryError('无效事件日期范围');
    const where:string[]=[],values:string[]=[];
    if(from){where.push('event_date >= ?');values.push(from);}if(to){where.push('event_date <= ?');values.push(to);}
    return json({items:(await env.DB.prepare('SELECT * FROM events'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY event_date, id').bind(...values).all()).results});
  }
  if (method === 'GET' && path === '/v1/alert-rules') {
    const rows=(await env.DB.prepare('SELECT * FROM alert_rules ORDER BY active DESC, id').all()).results;
    return json({items:rows.map(row=>{const {condition_json,...rest}=row;return {...rest,condition:condition_json?JSON.parse(condition_json as string):null};})});
  }
  if (method === 'GET' && path === '/v1/health/producers') return json(await health(url,env));
  if ((method === 'GET' && path === '/v1/commands') || (method === 'POST' && ['/v1/watchlist','/v1/commands'].includes(path)) || (method === 'PATCH' && /^\/v1\/(commands|watchlist)\/[^/]+$/.test(path)) || (method === 'DELETE' && /^\/v1\/watchlist\/[^/]+$/.test(path))) return json({error:'Not implemented'},501);
  if (path.startsWith('/v1/')) return json({error:'Not found'},404);
  return env.ASSETS.fetch(request);
}
export default { async fetch(request: Request, env: Env): Promise<Response> {
  try { return await route(request,env); } catch (error) { return error instanceof QueryError ? json({code:'invalid_query',error:error.message},400) : json({error:'Storage or request failure'},500); }
}};
