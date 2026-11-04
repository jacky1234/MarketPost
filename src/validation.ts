import type { Feed } from './types.js';
export const types = ['pre_market','post_market','price_snapshot','fx_snapshot','tech_report','announcement','alert_trigger','event_update','weekly_review','portfolio_snapshot','system_heartbeat'];
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const object = (v: unknown): v is Feed => !!v && typeof v === 'object' && !Array.isArray(v);
const timestamp = (v: unknown) => text(v) && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
const day = (v: unknown) => text(v) && /^\d{4}-\d\d-\d\d$/.test(v) && !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v;
export function validate(value: unknown): { item?: Feed; errors: Record<string,string> } {
  const errors: Record<string,string> = {};
  if (!object(value)) return { errors: { body: '必须是 JSON 对象' } };
  const f = value;
  for (const k of ['id','idempotency_key','producer','title','summary','body_md']) if (!text(f[k])) errors[k] = '必填非空字符串';
  if (f.protocol_version !== '1.0') errors.protocol_version = '必须为 1.0';
  if (!text(f.id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(f.id)) errors.id = '必须为 UUID';
  if (!text(f.from) || !/^(muse|chatgpt|codex|kimi|gemini|other:[a-z0-9_]+)$/.test(f.from)) errors.from = '无效 agent';
  if (text(f.from) && text(f.idempotency_key) && !f.idempotency_key.startsWith(f.from + ':')) errors.idempotency_key = '必须以完整 from 加冒号开头';
  for (const [k, options] of Object.entries({type:types,severity:['info','normal','important','urgent'],status:['ok','unretrieved','partial']})) if (!options.includes(f[k] as string)) errors[k] = '无效枚举';
  for (const [k, options] of Object.entries({market:['HK','US','SH','SZ','FUND','FX','GLOBAL'],tier:['core','rule','etf_basket','record_only','watch']})) if (f[k] != null && !options.includes(f[k] as string)) errors[k] = '无效枚举';
  if (text(f.summary) && Array.from(f.summary).length > 120) errors.summary = '最多 120 字';
  if (f.reply_to !== null) errors.reply_to = '一期必须为 null';
  if (!(f.type === 'system_heartbeat' && f.trading_day === null) && !day(f.trading_day)) errors.trading_day = '必须为有效 YYYY-MM-DD';
  for (const k of ['event_at','published_at']) if (!timestamp(f[k])) errors[k] = '必须为带时区的 ISO 8601';
  if (!object(f.data)) errors.data = '必须为对象';
  if (f.status === 'partial' && (!object(f.data) || !Array.isArray(f.data.missing) || !f.data.missing.length || !f.data.missing.every(text))) errors['data.missing'] = 'partial 必须列出缺失项';
  for (const k of ['signals','sources','tags']) if (!Array.isArray(f[k])) errors[k] = '必须为数组';
  if (Array.isArray(f.tags) && !f.tags.every(text)) errors.tags = '必须为字符串数组';
  if (Array.isArray(f.signals)) f.signals.forEach((s,i) => { if (!object(s) || !['name','condition','meaning'].every(k=>text(s[k])) || !['info','warn','strong'].includes(s.level as string)) errors[`signals.${i}`] = '需要三段式及合法 level'; });
  if (Array.isArray(f.sources)) f.sources.forEach((s,i) => {
    if (!object(s) || !['title','url','publisher'].every(k=>text(s[k])) || !timestamp(s.published_at)) errors[`sources.${i}`] = '需要标题、链接、发布方、带时区时间';
    else { try { if (!['https:','http:'].includes(new URL(s.url as string).protocol)) throw Error(); } catch { errors[`sources.${i}.url`] = '无效来源 URL'; } }
  });
  if (f.type === 'announcement' && (!Array.isArray(f.sources) || !f.sources.length)) errors.sources = '公告必须附来源';
  if (f.view != null) {
    if (!object(f.view) || !['market','sector','symbol'].includes(f.view.scope as string) || !['bearish','cautious','neutral','cautiously_positive','positive'].includes(f.view.stance as string)) errors.view = '无效观点结构或枚举';
    if (object(f.view)) {
      if (!Array.isArray(f.view.basis) || !f.view.basis.length || !f.view.basis.every(text)) errors['view.basis'] = '必填非空依据数组';
      if (!text(f.view.invalidation)) errors['view.invalidation'] = '必填失效条件';
    }
  }
  for (const k of ['advice','recommendation','trade_action']) if (k in f) errors[k] = '协议不允许此字段';
  return { item: Object.keys(errors).length ? undefined : f, errors };
}
