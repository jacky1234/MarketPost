import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import worker from '../.test-build/index.js';
import { hasAccess } from '../.test-build/access.js';
let pair, wrongPair, jwk;
const issuer='https://example-test-'+randomUUID()+'.cloudflareaccess.com';
const audience=randomUUID();
const env={ENVIRONMENT:'production',ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:audience};
const encode=value=>Buffer.from(typeof value==='string'?value:JSON.stringify(value)).toString('base64url');
before(async()=>{
 pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 wrongPair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key',alg:'RS256',use:'sig'};
});
async function token(claims={},key=pair.privateKey,header={}){
 const input=encode({alg:'RS256',kid:'test-key',...header})+'.'+encode({iss:issuer,aud:[audience],exp:Math.floor(Date.now()/1000)+300,...claims});
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(input));return input+'.'+Buffer.from(sig).toString('base64url');
}
function request(assertion,path='/v1/watchlist'){return new Request('http://localhost'+path,{headers:assertion?{'Cf-Access-Jwt-Assertion':assertion}:{}});}
async function withJWKS(fn){
 const previous=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{assert.equal(url,issuer+'/cdn-cgi/access/certs');calls++;return Response.json({keys:[jwk]});};
 try{return await fn(()=>calls);}finally{globalThis.fetch=previous;}
}
const DB={prepare(){return {bind(){return this;},async first(){return null;},async all(){return {results:[]};}};}};
test('Access JWT 合法：JWKS RS256 验签与 aud，通过生产 GET 并缓存公钥',async()=>withJWKS(async calls=>{
 const assertion=await token();assert.equal((await worker.fetch(request(assertion),{...env,DB})).status,200);
 assert.equal(await hasAccess(request(assertion),env),true);assert.equal(calls(),1);
}));
test('Access JWT 过期：401',async()=>withJWKS(async()=>{assert.equal((await worker.fetch(request(await token({exp:Math.floor(Date.now()/1000)-1})),{...env,DB})).status,401);}));
test('Access JWT 签名不符：401',async()=>withJWKS(async()=>{assert.equal((await worker.fetch(request(await token({},wrongPair.privateKey)),{...env,DB})).status,401);}));
test('Access JWT aud 不符：401',async()=>withJWKS(async()=>{assert.equal((await worker.fetch(request(await token({aud:[randomUUID()]})),{...env,DB})).status,401);}));
test('生产/未知环境缺 JWT 或私密配置失败关闭；保护 feed/详情/lots/health',async()=>{
 for(const path of ['/v1/feed','/v1/feed/demo','/v1/watchlist/09999.HK','/v1/health/producers'])assert.equal((await worker.fetch(request(null,path),{...env,DB})).status,401);
 assert.equal(await hasAccess(request(null),{ENVIRONMENT:'production'}),false);
 assert.equal(await hasAccess(request(null),{}),false);
 assert.equal(await hasAccess(request(await token()),{ENVIRONMENT:'production'}),false);
});
test('local/test 无 header 保持兼容；存在非法 header 时仍拒绝',async()=>{
 for(const ENVIRONMENT of ['local','test']){assert.equal((await worker.fetch(request(null),{ENVIRONMENT,DB})).status,200);assert.equal((await worker.fetch(request('invalid'),{ENVIRONMENT,DB})).status,401);}
});
test('拒绝错误 issuer、未知 kid、未生效与算法混淆',async()=>withJWKS(async()=>{
 for(const assertion of [await token({iss:'https://example.invalid'}),await token({},pair.privateKey,{kid:'unknown'}),await token({nbf:Math.floor(Date.now()/1000)+300}),await token({},pair.privateKey,{alg:'none'})])assert.equal(await hasAccess(request(assertion),env),false);
}));
test('JWKS 获取失败不放行；不从 token 中的 jku 选择来源',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Simulated failure');};
 try{const other='https://other-test-'+randomUUID()+'.cloudflareaccess.com';assert.equal(await hasAccess(request(await token({iss:other},pair.privateKey,{jku:'https://example.invalid'})),{...env,ACCESS_TEAM_DOMAIN:other}),false);}finally{globalThis.fetch=previous;}
});
test('POST feed 不依赖 Access，Access JWT 不能代替 agent token，写 token 仍不能读',async()=>{
 const example=JSON.parse(await readFile(new URL('../examples/muse-post-market.json',import.meta.url)));const secret=randomBytes(32).toString('hex');
 const postEnv={...env,PRODUCER_TOKEN_MUSE:secret,DB:{prepare(sql){return {bind(){return this;},async run(){return {meta:{changes:1}};},async first(){return sql.includes('api_tokens')?null:{id:example.id,from_agent:example.from};}};}}};
 const post=headers=>worker.fetch(new Request('http://localhost/v1/feed',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(example)}),postEnv);
 assert.equal((await post({'Cf-Access-Jwt-Assertion':await token()})).status,401);
 assert.equal((await post({authorization:`Bearer ${secret}`})).status,201);
 assert.equal((await post({authorization:`Bearer ${secret}`,'Cf-Access-Jwt-Assertion':'invalid'})).status,201);
 const read=new Request('http://localhost/v1/watchlist',{headers:{authorization:`Bearer ${secret}`,'Cf-Access-Jwt-Assertion':await token()}});
 assert.equal((await worker.fetch(read,{...postEnv,DB})).status,403);
});

test('JWT 诊断日志仅固定原因码，不输出票据或配置值',async()=>{
 const previous=console.warn,logs=[];console.warn=(...args)=>logs.push(args);
 const assertion=await token({aud:[randomUUID()]});
 try{assert.equal(await hasAccess(request(assertion),env),false);}finally{console.warn=previous;}
 assert.deepEqual(logs,[['access_jwt_rejected',{reason:'aud_mismatch'}]]);
 const text=JSON.stringify(logs);assert.equal(text.includes(assertion),false);assert.equal(text.includes(issuer),false);assert.equal(text.includes(audience),false);
});
