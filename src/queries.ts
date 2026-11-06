import type { Env, Feed } from './types.js';
export class QueryError extends Error {}
export function date(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function decode(row: Feed): Feed {
  const out: Feed = {...row, from: row.from_agent}; delete out.from_agent;
  for (const key of ['data','signals','sources','view']) {out[key] = row[key+'_json'] == null ? null : JSON.parse(row[key+'_json'] as string);delete out[key+'_json'];}
  out.tags = row.tags ? JSON.parse(row.tags as string) : []; return out;
}
export async function listFeed(url: URL, env: Env) {
  const p=url.searchParams, where:string[]=[], values:unknown[]=[];
  for(const key of p.keys()) if(!['from','type','symbol','trading_day','published_day','q','limit','cursor'].includes(key)) throw new QueryError('未知参数 '+key);
  for(const [key,col] of Object.entries({from:'from_agent',type:'type',symbol:'symbol',trading_day:'trading_day'})) if(p.get(key)){where.push(`${col} = ?`);values.push(p.get(key));}
  if(p.get('trading_day') && !date(p.get('trading_day')!)) throw new QueryError('无效 trading_day');
  if(p.has('published_day')){const day=p.get('published_day')!;if(!date(day))throw new QueryError('无效 published_day');where.push("date(published_at, '+8 hours') = ?");values.push(day);}
  const q=p.get('q'); if(q){if(q.length>200) throw new QueryError('q 最多 200 字符');where.push("instr(lower(coalesce(name,'') || ' ' || coalesce(symbol,'') || ' ' || title || ' ' || coalesce(summary,'') || ' ' || coalesce(body_md,'')), lower(?)) > 0");values.push(q);}
  const size=p.get('limit')??'30';if(!/^[1-9]\d*$/.test(size)||Number(size)>100) throw new QueryError('limit 必须为 1–100 整数');
  const limit=Number(size), filter=JSON.stringify(['from','type','symbol','trading_day','q'].map(k=>p.get(k)||'').concat(p.has('published_day')?[p.get('published_day')!]:[]));
  if(p.has('cursor')){
    try {
      const c=JSON.parse(decodeURIComponent(atob(p.get('cursor')!)));
      if(c.v!==1||c.filter!==filter||typeof c.at!=='string'||!Number.isFinite(Date.parse(c.at))||typeof c.id!=='string') throw Error();
      where.push('(julianday(published_at) < julianday(?) OR (julianday(published_at) = julianday(?) AND id < ?))');values.push(c.at,c.at,c.id);
    }catch{throw new QueryError('cursor 无效或与筛选条件不符');}
  }
  const rows=(await env.DB.prepare('SELECT * FROM feed_items'+(where.length?' WHERE '+where.join(' AND '):'')+' ORDER BY julianday(published_at) DESC, id DESC LIMIT ?').bind(...values,limit+1).all()).results;
  const more=rows.length>limit, page=rows.slice(0,limit), last=page.at(-1);
  return {items:page.map(decode),next_cursor:more&&last?btoa(encodeURIComponent(JSON.stringify({v:1,at:last.published_at,id:last.id,filter}))):null};
}
export async function health(url: URL, env: Env) {
 const day=url.searchParams.get('trading_day');if(day&&!date(day))throw new QueryError('无效 trading_day');
 const now=Date.now(), reference=day?Math.min(now,Date.parse(day+'T23:59:59.999+08:00')):now;
 const maxAge=Number(env.HEARTBEAT_MAX_AGE_SECONDS??86400);if(!Number.isFinite(maxAge)||maxAge<=0)throw Error('Invalid heartbeat configuration');
 const from=url.searchParams.get('from');
 const known=(await env.DB.prepare('SELECT DISTINCT from_agent, producer FROM feed_items WHERE julianday(published_at) <= julianday(?)'+(from?' AND from_agent = ?':'')+' ORDER BY from_agent, producer').bind(new Date(reference).toISOString(),...(from?[from]:[])).all()).results;
 const beats=(await env.DB.prepare("SELECT * FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY from_agent, producer ORDER BY julianday(published_at) DESC, id DESC) AS rank FROM feed_items WHERE type = 'system_heartbeat' AND julianday(published_at) <= julianday(?)) WHERE rank = 1").bind(new Date(reference).toISOString()).all()).results;
 return {reference_at:new Date(reference).toISOString(),max_age_seconds:maxAge,producers:known.map(k=>{
   const row=beats.find(b=>b.from_agent===k.from_agent&&b.producer===k.producer), feed=row?decode(row):null, data=feed?.data as Feed|undefined;
   const at=data?.ran_at??row?.event_at, age=typeof at==='string'?(reference-Date.parse(at))/1000:null;
   const state=!row?'missing':age===null||!Number.isFinite(age)||age<0?'unknown':age>maxAge?'stale':data?.result==='failed'?'failed':data?.result==='skipped'?'skipped':data?.result==='ok'?'fresh':'unknown';
   return {from:k.from_agent,producer:k.producer,state,last_heartbeat_at:at??null,last_published_at:row?.published_at??null,age_seconds:age,note:data?.note??null};
 })};
}
