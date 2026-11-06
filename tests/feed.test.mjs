import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { getPlatformProxy } from 'wrangler';
import worker from '../.test-build/index.js';
import { validate } from '../.test-build/validation.js';
const example=JSON.parse(await readFile(new URL('../examples/muse-post-market.json',import.meta.url)));
let platform, directory, env;
const tokens={muse:randomBytes(32).toString('hex'),codex:randomBytes(32).toString('hex')};
before(async()=>{
 directory=await mkdtemp(join(tmpdir(),'marketpost-test-'));
 platform=await getPlatformProxy({persist:{path:directory}});
 env={...platform.env,PRODUCER_TOKEN_MUSE:tokens.muse,PRODUCER_TOKEN_CODEX:tokens.codex};
 const sql=await readFile(new URL('../migrations/0001_init.sql',import.meta.url),'utf8');
 for(const statement of sql.replace(/--[^\n]*/g,'').split(';').filter(s=>s.trim())) await env.DB.prepare(statement).run();
});
after(async()=>{await platform?.dispose();if(directory) await rm(directory,{recursive:true,force:true});});
const post=(item,agent='muse')=>worker.fetch(new Request('http://localhost/v1/feed',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tokens[agent]}`},body:JSON.stringify(item)}),env);
const get=(path,headers)=>worker.fetch(new Request('http://localhost'+path,{headers}),env);
test('有效信封通过，缺 from 拒绝',()=>{assert.deepEqual(validate(example).errors,{});const item={...example};delete item.from;assert.ok(validate(item).errors.from);});
test('拒绝无效枚举、超长摘要、缺交易日和无来源公告',()=>{for(const patch of [{type:'unknown'},{severity:'fatal'},{summary:'字'.repeat(121)},{trading_day:null},{type:'announcement',sources:[]}]) assert.equal(validate({...example,...patch}).item,undefined);});
test('token 不能冒充其他 from',async()=>{assert.equal((await post({...example,from:'codex',idempotency_key:example.idempotency_key.replace('muse:','codex:')})).status,401);});
test('同 key 重试幂等，不同 agent 同标的同日独立保存',async()=>{
 const first=await post(example);assert.equal(first.status,201);assert.equal((await first.json()).deduplicated,false);
 const retry=await post({...example,id:randomUUID()});assert.equal(retry.status,200);assert.deepEqual(await retry.json(),{id:example.id,deduplicated:true});
 const other={...example,id:randomUUID(),from:'codex',idempotency_key:example.idempotency_key.replace('muse:','codex:')};assert.equal((await post(other,'codex')).status,201);
 const rows=await (await get('/v1/feed?symbol=09999.HK&trading_day=2026-11-03')).json();assert.equal(rows.items.length,2);
 assert.equal((await (await get('/v1/feed?from=codex&type=post_market')).json()).items.length,1);
 assert.equal((await (await get('/v1/agents?trading_day=2026-11-03')).json()).agents.length,2);
});
test('非法 JSON 与缺失 token 拒绝',async()=>{assert.equal((await worker.fetch(new Request('http://localhost/v1/feed',{method:'POST',headers:{'content-type':'application/json'},body:'{'}),env)).status,400);assert.equal((await worker.fetch(new Request('http://localhost/v1/feed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(example)}),env)).status,401);});
test('只读关注池不返回 lots，生产者无读权限',async()=>{
 await env.DB.prepare("INSERT INTO watchlist(symbol,market,name,tier) VALUES('09999.HK','HK','示例生物科技','core')").run();
 await env.DB.prepare("INSERT INTO watchlist_lots(lot_id,symbol,shares,cost) VALUES('demo-base','09999.HK',500,50)").run();
 const body=await (await get('/v1/watchlist')).json();assert.equal(body.items.length,1);for(const key of ['lots','shares','cost']) assert.equal(key in body.items[0],false);
 for(const path of ['/v1/watchlist','/v1/feed','/v1/agents']) assert.equal((await get(path,{Authorization:`Bearer ${tokens.muse}`})).status,401);
});
test('协议未实现接口返回 501',async()=>{for(const path of ['/v1/commands']) assert.equal((await get(path)).status,501);});

test('view_incomplete 不入库，同幂等键补全可重发且不被服务端降级',async()=>{
 const item={...example,id:randomUUID(),idempotency_key:'muse:manual:view:09999.HK:2026-11-03',view:{scope:'symbol',target:'09999.HK',stance:'neutral'}};
 const bad=await post(item);assert.equal(bad.status,400);assert.equal((await bad.json()).code,'view_incomplete');
 assert.equal((await get('/v1/feed/'+item.id)).status,404);
 item.view.basis=['虚构测试依据'];item.view.invalidation='虚构条件失效';
 assert.equal((await post(item)).status,201);
 const saved=await (await get('/v1/feed/'+item.id)).json();assert.equal(saved.status,'ok');assert.deepEqual(saved.view,item.view);
});
test('详情、搜索与分页：同时间不遗漏，跨时区按实际时刻排序，cursor 绑定筛选',async()=>{
 const base={...example,trading_day:'2026-11-02',name:'示例生物科技 100%_虚构'};
 for(const [n,at]of [[1,'2026-11-02T16:30:00+08:00'],[2,'2026-11-02T08:30:00Z'],[3,'2026-11-02T10:00:00+00:00']]){
  assert.equal((await post({...base,id:`40000000-0000-4000-8000-00000000000${n}`,idempotency_key:`muse:manual:query:09999.HK:2026-11-02:${n}`,published_at:at})).status,201);
 }
 const query='/v1/feed?trading_day=2026-11-02&q='+encodeURIComponent('100%_虚构')+'&limit=1';let cursor=null,ids=[];
 do {const r=await get(query+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(r.status,200);const body=await r.json();ids.push(...body.items.map(x=>x.id));cursor=body.next_cursor;if(ids.length===1){assert.equal(ids[0],'40000000-0000-4000-8000-000000000003');assert.equal((await get('/v1/feed?q=different&cursor='+encodeURIComponent(cursor))).status,400);}}while(cursor);
 assert.equal(ids.length,3);assert.equal(new Set(ids).size,3);assert.ok(ids[1]>ids[2]);
 for(const query of ['limit=0','limit=101','limit=1.5','cursor=broken','trading_day=2026-02-30'])assert.equal((await get('/v1/feed?'+query)).status,400);
 assert.equal((await get('/v1/feed/missing')).status,404);
 const search=await (await get('/v1/feed?q='+encodeURIComponent("' OR 1=1 --"))).json();assert.equal(search.items.length,0);
});
test('events 日期闭区间、alert rules JSON 与只读权限',async()=>{
 await env.DB.prepare("INSERT INTO events(id,symbol,event_type,title,event_date) VALUES('demo-event','09999.HK','other','虚构测试事件','2026-11-03')").run();
 await env.DB.prepare("INSERT INTO alert_rules(id,symbol,rule_type,rule_desc,condition_json,one_shot) VALUES('demo-rule','09999.HK','demo','虚构规则','{\"threshold\":55}',1)").run();
 assert.equal((await (await get('/v1/events?from=2026-11-03&to=2026-11-03')).json()).items.length,1);
 assert.equal((await (await get('/v1/events?from=2026-11-04')).json()).items.length,0);
 assert.equal((await get('/v1/events?from=2026-11-04&to=2026-11-03')).status,400);
 const rules=await (await get('/v1/alert-rules')).json();assert.deepEqual(rules.items[0].condition,{threshold:55});assert.equal('condition_json' in rules.items[0],false);
 for(const p of ['/v1/feed/'+example.id,'/v1/events','/v1/alert-rules','/v1/health/producers'])assert.equal((await get(p,{Authorization:`Bearer ${tokens.muse}`})).status,401);
});
test('heartbeat：最后一条、来源过滤、历史日与超时/缺失/失败',async()=>{
 const beat={...example,id:randomUUID(),type:'system_heartbeat',producer:'tech-job',trading_day:null,idempotency_key:'muse:tech-job:system_heartbeat:demo:1',event_at:'2026-11-03T16:00:00+08:00',data:{job:'tech-job',ran_at:'2026-11-03T16:00:00+08:00',result:'ok',note:'虚构运行'}};
 assert.equal((await post(beat)).status,201);
 let h=await (await get('/v1/health/producers?trading_day=2026-11-03&from=muse')).json();assert.ok(h.producers.every(x=>x.from==='muse'));assert.equal(h.producers.find(x=>x.producer==='tech-job').state,'fresh');assert.equal(h.producers.find(x=>x.producer==='manual').state,'missing');
 const stale=await worker.fetch(new Request('http://localhost/v1/health/producers?trading_day=2026-11-03&from=muse'),{...env,HEARTBEAT_MAX_AGE_SECONDS:'60'});assert.equal((await stale.json()).producers.find(x=>x.producer==='tech-job').state,'stale');
 assert.equal((await post({...beat,id:randomUUID(),idempotency_key:beat.idempotency_key+':2',published_at:'2026-11-03T17:00:00+08:00',data:{...beat.data,result:'failed'}})).status,201);
 h=await (await get('/v1/health/producers?trading_day=2026-11-03&from=muse')).json();assert.equal(h.producers.find(x=>x.producer==='tech-job').state,'failed');
 assert.equal((await get('/v1/health/producers?trading_day=broken')).status,400);
});

test('标的详情只读 lots：按标的隔离，保留 NULL，列表无成本，写 token 禁读',async()=>{
 await env.DB.prepare("INSERT INTO watchlist_lots(lot_id,symbol,shares,cost,note) VALUES('demo-topup-20260101','09999.HK',200,42,'加仓笔')").run();
 await env.DB.prepare("INSERT INTO watchlist(symbol,market,name,tier) VALUES('ABCD.US','US','ABCD','watch')").run();
 await env.DB.prepare("INSERT INTO watchlist_lots(lot_id,symbol,shares,cost) VALUES('demo-unrecorded','ABCD.US',NULL,NULL)").run();
 const response=await get('/v1/watchlist/09999.HK');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
 const body=await response.json();assert.equal(body.item.symbol,'09999.HK');assert.equal(body.lots.length,2);assert.ok(body.lots.every(l=>l.symbol==='09999.HK'));assert.equal(body.lots.find(l=>l.lot_id==='demo-topup-20260101').cost,42);
 const missing=await (await get('/v1/watchlist/ABCD.US')).json();assert.equal(missing.lots[0].cost,null);assert.equal(missing.lots[0].shares,null);
 const list=await (await get('/v1/watchlist')).json();assert.ok(list.items.every(x=>!('lots'in x)&&!('cost'in x)&&!('shares'in x)));
 assert.equal((await get('/v1/watchlist/09999.HK',{Authorization:`Bearer ${tokens.muse}`})).status,401);
 assert.equal((await get('/v1/watchlist/unknown')).status,404);
 assert.equal((await get('/v1/watchlist/%E0%A4%A')).status,400);
 await env.DB.prepare("UPDATE watchlist SET active = 0 WHERE symbol = 'ABCD.US'").run();assert.equal((await get('/v1/watchlist/ABCD.US')).status,404);
});
test('published_day 按上海日期过滤，可组合交易日且游标隔离',async()=>{
 const item={...example,id:randomUUID(),idempotency_key:'muse:manual:published:09999.HK:2026-11-01',trading_day:'2026-11-01',published_at:'2026-11-04T16:00:00Z'};
 assert.equal((await post(item)).status,201);
 const before={...item,id:randomUUID(),idempotency_key:item.idempotency_key+':before',published_at:'2026-11-04T15:59:59Z'};assert.equal((await post(before)).status,201);
 let body=await(await get('/v1/feed?published_day=2026-11-05&trading_day=2026-11-01')).json();assert.equal(body.items.length,1);assert.equal(body.items[0].id,item.id);
 body=await(await get('/v1/feed?published_day=2026-11-04&trading_day=2026-11-01')).json();assert.deepEqual(body.items.map(x=>x.id),[before.id]);
 for(const d of ['','bad','2026-02-30'])assert.equal((await get('/v1/feed?published_day='+d)).status,400);
 const page=await(await get('/v1/feed?published_day=2026-11-03&limit=1')).json();assert.ok(page.next_cursor);assert.equal((await get('/v1/feed?published_day=2026-11-04&cursor='+encodeURIComponent(page.next_cursor))).status,400);
});

test('详情 data_raw 按字节返回存储 JSON，保留空格和数字写法，data 仍解析',async()=>{
 const id=randomUUID(),raw='{  "close" : 5.000e+1,\n\t"zero": -0.00, "note" : "虚构数据", "ratio": 1.2300e-2  }';
 await env.DB.prepare('INSERT INTO feed_items(id,idempotency_key,type,from_agent,producer,published_at,title,data_json) VALUES(?,?,?,?,?,?,?,?)').bind(id,'codex:manual:raw:'+id,'price_snapshot','codex','manual','2026-11-03T16:00:00+08:00','虚构原文保真 fixture',raw).run();
 const response=await get('/v1/feed/'+id);assert.equal(response.status,200);const detail=await response.json();
 assert.equal(typeof detail.data_raw,'string');assert.deepEqual(Buffer.from(detail.data_raw,'utf8'),Buffer.from(raw,'utf8'));assert.deepEqual(detail.data,{close:50,zero:0,note:'虚构数据',ratio:0.0123});
 const listed=await(await get('/v1/feed?from=codex&q='+encodeURIComponent('虚构原文保真 fixture'))).json();assert.equal('data_raw' in listed.items[0],false);
 assert.equal((await get('/v1/feed/'+id,{Authorization:`Bearer ${tokens.codex}`})).status,401);
});
