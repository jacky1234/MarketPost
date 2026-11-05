import type { Env } from './types.js';

type SigningKey = JsonWebKey & { kid?: string; alg?: string; use?: string };
type KeySet = { keys: SigningKey[]; expires: number };
const cached = new Map<string, KeySet>();
const pending = new Map<string, Promise<KeySet>>();
const CACHE_MS = 5 * 60 * 1000;

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function bytes(segment: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) throw Error('Invalid encoding');
  const base = segment.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base.padEnd(Math.ceil(base.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
function parse(segment: string): Record<string, unknown> {
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes(segment)));
  if (!object(value)) throw Error('Invalid object');
  return value;
}
function issuerFrom(env: Env): string {
  if (typeof env.ACCESS_TEAM_DOMAIN !== 'string' || !env.ACCESS_TEAM_DOMAIN.trim()) throw Error('Missing issuer');
  const value = env.ACCESS_TEAM_DOMAIN.trim();
  const url = new URL(value.startsWith('https://') ? value : 'https://' + value);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname) || url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('Invalid issuer');
  return url.origin;
}
async function keys(issuer: string): Promise<KeySet> {
  const current = cached.get(issuer);
  if (current && current.expires > Date.now()) return current;
  const loading = pending.get(issuer);
  if (loading) return loading;
  const task = (async () => {
    // URL 只由私密配置构造；不信任 JWT 中的 jku/x5u/iss 来选择网络目的地。
    const response = await fetch(issuer + '/cdn-cgi/access/certs', { redirect: 'manual', signal: AbortSignal.timeout(5000) });
    // Workers 不支持 redirect:error；manual + 非 2xx 拒绝，仍禁止跟随任何跳转。
    if (!response.ok) throw Error('JWKS unavailable');
    const text = await response.text();
    if (text.length > 65536) throw Error('Oversized JWKS');
    const body: unknown = JSON.parse(text);
    if (!object(body) || !Array.isArray(body.keys) || body.keys.length > 20) throw Error('Invalid JWKS');
    const value = { keys: body.keys.filter(object) as SigningKey[], expires: Date.now() + CACHE_MS };
    if (cached.size >= 8 && !cached.has(issuer)) cached.delete(cached.keys().next().value!);
    cached.set(issuer, value);
    return value;
  })();
  pending.set(issuer, task);
  try { return await task; } finally { pending.delete(issuer); }
}

/** 只允许显式 local/test 且没有 assertion 的本地兼容路径；其他环境 fail closed。 */
export async function hasAccess(request: Request, env: Env): Promise<boolean> {
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  if (assertion === null && (env.ENVIRONMENT === 'local' || env.ENVIRONMENT === 'test')) return true;
  const deny = (reason: string): false => {
    if (env.ENVIRONMENT !== 'local' && env.ENVIRONMENT !== 'test') console.warn('access_jwt_rejected', {reason});
    return false;
  };
  let phase = 'malformed_token';
  try {
    if (!assertion) return deny('missing_assertion');
    if (assertion.length > 16384) return deny('malformed_token');
    phase = 'config_invalid';
    const issuer = issuerFrom(env), audience = env.ACCESS_AUD;
    if (typeof audience !== 'string' || !audience.trim()) return deny('config_invalid');
    phase = 'malformed_token';
    const parts = assertion.split('.');
    if (parts.length !== 3) return deny('malformed_token');
    const header = parse(parts[0]), claims = parse(parts[1]);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit !== undefined) return deny('invalid_header');
    const now = Date.now() / 1000;
    if (claims.iss !== issuer) return deny('issuer_mismatch');
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= now) return deny('expired_or_invalid_exp');
    if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf > now)) return deny('not_yet_valid');
    if (claims.iat !== undefined && (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > now)) return deny('future_iat');
    const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if (!Array.isArray(audiences) || !audiences.every(a => typeof a === 'string') || !audiences.includes(audience)) return deny('aud_mismatch');
    phase = 'jwks_fetch_failed';
    const set = await keys(issuer);
    // 未知 kid 失败关闭；五分钟缓存到期会获取轮换后的密钥，不退回旧 key 或跳过验签。
    const jwk = set.keys.find(k => k.kid === header.kid && k.kty === 'RSA' && (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig'));
    if (!jwk) return deny('jwks_key_not_found');
    phase = 'jwks_key_invalid';
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    phase = 'signature_invalid';
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1])) || deny('signature_invalid');
  } catch { return deny(phase); }
}
