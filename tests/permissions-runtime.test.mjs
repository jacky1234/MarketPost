import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {Miniflare,convertV4MiniflareOptions,Log,LogLevel} from 'miniflare';
let mf,db,jwt;
const reader=randomBytes(32).toString('hex'),producer=randomBytes(32).toString('hex'),legacy=randomBytes(32).toString('hex');
const issuer='https://native-permissions-test.cloudflareaccess.com',aud=randomUUID();
const hash=t=>createHash('sha256').update(t).digest('hex');
async function register(token,kind,scopes,expires=null){await db.prepare('INSERT INTO api_tokens(agent,kind,token_hash,scopes,expires_at) VALUES(?,?,?,?,?)').bind('muse',kind,hash(token),JSON.stringify(scopes),expires).run();}
const request=(url,token,method='GET',body)=>mf.dispatchFetch('http://localhost'+url,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
before(async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'permissions-key',alg:'RS256',use:'sig'};
 const modules=await Promise.all((await readdir('.test-build')).filter(f=>f.endsWith('.js')).sort((a,b)=>a==='index.js'?-1:b==='index.js'?1:a.localeCompare(b)).map(async f=>({type:'ESModule',path:path.resolve('.test-build',f),contents:await readFile(path.join('.test-build',f),'utf8')})));
 modules.find(m=>m.path.endsWith('/access.js')).contents+='\nglobalThis.fetch=async()=>Response.json(JSON.parse('+JSON.stringify(JSON.stringify({keys:[jwk]}))+'));';
 mf=new Miniflare(convertV4MiniflareOptions({modules,modulesRoot:path.resolve('.test-build'),compatibilityDate:'2026-11-01',d1Databases:{DB:'permissions-test'},bindings:{ENVIRONMENT:'production',PRODUCER_TOKEN_MUSE:producer,PRODUCER_TOKEN_CODEX:legacy,ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:aud},log:new Log(LogLevel.NONE)}));
 db=await mf.getD1Database('DB');
 for(const name of (await readdir('migrations')).filter(x=>x.endsWith('.sql')).sort()){const sql=await readFile('migrations/'+name,'utf8');for(const statement of sql.replace(/--[^\n]*/g,'').split(';').filter(x=>x.trim()))await db.prepare(statement).run();}
 await register(reader,'reader',['feed:read','events:read','watchlist:read']);await register(producer,'producer',['feed:write']);
 await db.prepare("INSERT INTO watchlist(symbol,market,name,tier,proxy_symbol,thesis) VALUES('09999.HK','HK','虚构标的','core',NULL,'虚构登记')").run();
 await db.prepare("INSERT INTO watchlist_lots(lot_id,symbol,shares,cost) VALUES('demo','09999.HK',500,50)").run();
 const example=JSON.parse(await readFile('examples/muse-post-market.json','utf8'));assert.equal((await request('/v1/feed',producer,'POST',example)).status,201);
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const input=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:issuer,aud:[aud],exp:Math.floor(Date.now()/1000)+300});jwt=input+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input))).toString('base64url');
});
after(async()=>{await mf?.dispose();});
test('原生 workerd reader 读取 feed/detail/events 200，详情保留 data_raw',async()=>{
 const feed=await request('/v1/feed',reader);assert.equal(feed.status,200);const data=await feed.json();const detail=await request('/v1/feed/'+data.items[0].id,reader);assert.equal(detail.status,200);assert.equal(typeof(await detail.json()).data_raw,'string');assert.equal((await request('/v1/events',reader)).status,200);
});
test('原生 workerd scope 默认拒绝：reader 写403、producer读403、不能靠JWT提升权限',async()=>{
 assert.equal((await request('/v1/feed',reader,'POST',{})).status,403);assert.equal((await request('/v1/feed',producer)).status,403);
 for(const route of ['/v1/watchlist/09999.HK','/v1/agents','/v1/alert-rules','/v1/health/producers'])assert.equal((await request(route,reader)).status,403);
 assert.equal((await mf.dispatchFetch('http://localhost/v1/feed',{headers:{authorization:'Bearer '+producer,'Cf-Access-Jwt-Assertion':jwt}})).status,403);
});
test('原生 workerd watchlist 身份投影：reader 仅四字段，人类 Access 保留完整档案及 lots',async()=>{
 const result=await request('/v1/watchlist',reader);assert.equal(result.status,200);const row=(await result.json()).items[0];assert.deepEqual(Object.keys(row).sort(),['name','proxy','symbol','tier']);assert.equal(row.proxy,null);
 const headers={'Cf-Access-Jwt-Assertion':jwt};const human=await mf.dispatchFetch('http://localhost/v1/watchlist',{headers});assert.equal(human.status,200);assert.ok('thesis' in(await human.json()).items[0]);
 const lots=await mf.dispatchFetch('http://localhost/v1/watchlist/09999.HK',{headers});assert.equal(lots.status,200);assert.equal((await lots.json()).lots[0].cost,50);
});
test('原生 workerd producer 认证先于校验，from 绑定保持；无写入探针为400',async()=>{
 assert.equal((await request('/v1/feed',producer,'POST',{from:'muse'})).status,400);assert.equal((await request('/v1/feed',producer,'POST',{from:'codex'})).status,401);assert.equal((await request('/v1/feed',undefined,'POST',{})).status,401);
 assert.equal((await request('/v1/feed',randomBytes(32).toString('hex'))).status,401);
 assert.equal((await request('/v1/feed',legacy,'POST',{from:'codex'})).status,400);assert.equal((await request('/v1/feed',legacy)).status,403);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM feed_items').first()).n,1);
});
test('原生 workerd 过期/异常过期均401',async()=>{
 for(const expiry of ['2000-01-01T00:00:00Z','invalid']){const token=randomBytes(32).toString('hex');await register(token,'reader',['feed:read'],expiry);assert.equal((await request('/v1/feed',token)).status,401);}
});
test('原生 workerd 逐请求改scope即时生效；吊销后401，旧secret不复活',async()=>{
 await db.prepare('UPDATE api_tokens SET scopes = ? WHERE token_hash = ?').bind('[]',hash(reader)).run();assert.equal((await request('/v1/feed',reader)).status,403);
 await db.prepare('UPDATE api_tokens SET scopes = ? WHERE token_hash = ?').bind('[]',hash(producer)).run();assert.equal((await request('/v1/feed',producer,'POST',{from:'muse'})).status,403);
 await db.prepare('UPDATE api_tokens SET revoked_at = ? WHERE token_hash IN (?,?)').bind(new Date().toISOString(),hash(reader),hash(producer)).run();
 assert.equal((await request('/v1/feed',reader)).status,401);assert.equal((await request('/v1/feed',producer,'POST',{from:'muse'})).status,401);
 await db.prepare('UPDATE api_tokens SET revoked_at=NULL,expires_at=? WHERE token_hash=?').bind('2000-01-01T00:00:00Z',hash(producer)).run();assert.equal((await request('/v1/feed',producer,'POST',{from:'muse'})).status,401);
});

test('原生 workerd reader 即使误授写scope仍只读；查表故障不回退旧secret',async()=>{
 const token=randomBytes(32).toString('hex');await register(token,'reader',['feed:write']);assert.equal((await request('/v1/feed',token,'POST',{from:'muse'})).status,403);
 await db.prepare('DROP TABLE api_tokens').run();const response=await request('/v1/feed',legacy,'POST',{from:'codex'});assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Storage or request failure'});
});
