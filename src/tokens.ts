import type { Env } from './types.js';
export interface Principal {agent:string;kind:'producer'|'reader';scopes:string[];}
export async function tokenHash(token:string):Promise<string>{
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));
 return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function bearerPrincipal(request:Request,env:Env):Promise<Principal|null>{
 const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')||'');if(!match||match[1].length>4096)return null;
 const hash=await tokenHash(match[1]);
 const row=await env.DB.prepare('SELECT agent, kind, scopes, expires_at, revoked_at FROM api_tokens WHERE token_hash = ?').bind(hash).first();
 if(row){
  if(row.revoked_at!==null)return null;
  if(row.expires_at!==null){const expiry=Date.parse(String(row.expires_at));if(!Number.isFinite(expiry)||expiry<=Date.now())return null;}
  try{const scopes:unknown=JSON.parse(String(row.scopes));if(typeof row.agent!=='string'||!row.agent||!['producer','reader'].includes(String(row.kind))||!Array.isArray(scopes)||scopes.some(s=>typeof s!=='string'))return null;return {agent:row.agent,kind:row.kind as Principal['kind'],scopes};}catch{return null;}
 }
 // 仅对未登记的旧 secret 兜底；查表故障和已登记的无效行绝不回退。
 for(const [key,value]of Object.entries(env)){
  const name=/^PRODUCER_TOKEN_([A-Z0-9_]+)$/.exec(key);if(!name||typeof value!=='string'||!value)continue;
  if(await tokenHash(value)===hash){const suffix=name[1].toLowerCase();return {agent:suffix.startsWith('other_')?'other:'+suffix.slice(6):suffix,kind:'producer',scopes:['feed:write']};}
 }
 return null;
}
export function requiredScope(method:string,path:string):string|null{
 if(method==='POST'&&path==='/v1/feed')return 'feed:write';
 if(method!=='GET')return null;
 if(path==='/v1/feed'||/^\/v1\/feed\/[^/]+$/.test(path))return 'feed:read';
 if(path==='/v1/events')return 'events:read';
 if(path==='/v1/watchlist')return 'watchlist:read';
 return null;
}
