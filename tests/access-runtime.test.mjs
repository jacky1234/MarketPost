// Wrangler 的锁定依赖自带 workerd/Miniflare；无需增加项目运行时依赖。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Miniflare, convertV4MiniflareOptions, Log, LogLevel } from 'miniflare';
const source=await readFile(new URL('../.test-build/access.js',import.meta.url),'utf8');
async function nativeCheck(redirect=false){
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'runtime-test-key',alg:'RS256',use:'sig'};
 const issuer='https://runtime-test.cloudflareaccess.com',aud=randomUUID();
 const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const input=encode({alg:'RS256',kid:jwk.kid})+'.'+encode({iss:issuer,aud:[aud],exp:Math.floor(Date.now()/1000)+300});
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));
 const jwt=input+'.'+Buffer.from(signature).toString('base64url');
 // 在原生 workerd 构造 Request，确保不会把 Node 支持而 Workers 不支持的选项漏测。
 const script=source+`\nexport default {async fetch(req,env){let calls=0;globalThis.fetch=async(url,init)=>{calls++;const upstream=new Request(url,init);if(upstream.redirect!=='manual')throw Error('Must not follow redirects');return ${redirect?"new Response(null,{status:302,headers:{location:'https://example.invalid'}})":"Response.json(JSON.parse(env.TEST_JWKS))"};};const allowed=await hasAccess(req,env);return Response.json({allowed,calls},{status:allowed?200:401});}};`;
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script,compatibilityDate:'2026-11-01',bindings:{ENVIRONMENT:'production',ACCESS_TEAM_DOMAIN:issuer,ACCESS_AUD:aud,TEST_JWKS:JSON.stringify({keys:[jwk]})},log:new Log(LogLevel.NONE)}));
 try{const r=await mf.dispatchFetch('http://localhost/v1/feed',{headers:{'Cf-Access-Jwt-Assertion':jwt}});return {status:r.status,body:await r.json()};}finally{await mf.dispose();}
}
test('原生 workerd：JWKS Request 选项兼容，合法票据验签通过',async()=>{assert.deepEqual(await nativeCheck(),{status:200,body:{allowed:true,calls:1}});});
test('原生 workerd：JWKS 302 仍拒绝，不跟随跳转',async()=>{assert.deepEqual(await nativeCheck(true),{status:401,body:{allowed:false,calls:1}});});
