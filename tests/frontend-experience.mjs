import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const out=new URL('../docs/screenshots/experience/',import.meta.url);await mkdir(out,{recursive:true});
const body='# 标题\n\n- 条目 **重点**\n- [安全链接](https://example.invalid)\n\n<script>window.pwned=true</script>\n[坏链接](javascript:alert)';
const raw='{ "close" : 50, "note" : "虚构数据" }';
const item={id:'demo',type:'post_market',from:'codex',producer:'manual',title:'虚构体验测试',summary:'仅用于前端验收',body_md:body,data:JSON.parse(raw),data_raw:raw,trading_day:'2026-11-01',published_at:new Date().toISOString(),signals:[{name:'信号',condition:'虚构条件',meaning:'虚构含义',level:'warn'}],tags:[],severity:'normal',status:'ok'};
const results=[];
async function touchSizes(page){for(const target of await page.locator('button,input,select,summary,a').all()){if(!await target.isVisible())continue;const box=await target.boundingBox();assert.ok(box.width>=40&&box.height>=40,`${await target.evaluate(el=>el.outerHTML)} height=${box.height}`);}}
async function noOverflow(page){const measured=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(measured.scrollWidth<=measured.viewport,JSON.stringify(measured));return measured;}

try{for(const width of [390,360]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const page=await context.newPage();let copied=[];const errors=[],measurements=[];page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('captureCopy',text=>copied.push(text));await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.captureCopy(text)}}));
 await page.route('**/v1/**',async route=>{const u=new URL(route.request().url());let data;
 if(u.pathname.startsWith('/v1/feed/'))data=item;
 else if(u.pathname==='/v1/feed'){const visible=u.searchParams.has('published_day')||u.searchParams.get('trading_day')==='2026-11-01';data={items:visible?[item,{...item,id:'hb',type:'system_heartbeat'}]:[],next_cursor:null};}
 else if(u.pathname==='/v1/health/producers')data={producers:[{from:'codex',producer:'manual',state:'fresh'}]};else data={items:[]};await route.fulfill({json:data});});
 const loaded=()=>page.waitForFunction(()=>document.querySelector('#feedback').textContent.startsWith('已加载'));
 await page.goto('http://127.0.0.1:8787/?day=2026-11-01');await loaded();assert.match(await page.locator('#feedback').innerText(),/已加载 1 条/);assert.match(await page.locator('#filters select[name=from]').innerText(),/codex · 1/);assert.equal(await page.locator('#producer-status').getAttribute('open'),null);
 await touchSizes(page);await noOverflow(page);
 for(const field of await page.locator('#filters label').all()){const b=await field.boundingBox();assert.ok(b.width>=width-40);}
 await page.getByRole('button',{name:'查看详情',exact:true}).first().click();await page.locator('.markdown h1').waitFor();assert.equal(await page.locator('.markdown strong').innerText(),'重点');assert.equal(await page.locator('.markdown li').count(),2);assert.equal(await page.locator('.markdown script').count(),0);assert.equal(await page.evaluate(()=>window.pwned),undefined);assert.equal(await page.locator('.markdown a').count(),1);assert.equal(await page.locator('.signal').count(),2);
 await page.getByRole('button',{name:'复制原文',exact:true}).click();assert.equal(copied.at(-1),body);await page.getByRole('button',{name:'复制数据',exact:true}).click();assert.equal(copied.at(-1),raw);await page.waitForTimeout(1600);await page.getByRole('button',{name:'复制原文',exact:true}).waitFor();
 await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});document.execCommand=command=>{if(command==='copy'){window.captureCopy(document.querySelector('textarea').value);return true;}return false;};});await page.getByRole('button',{name:'复制原文',exact:true}).click();await page.waitForTimeout(50);assert.equal(copied.at(-1),body);
 await touchSizes(page);await noOverflow(page);
 const pre=page.locator('#detail pre').last();const old=await pre.textContent();await pre.evaluate(el=>el.textContent='虚构长字段'.repeat(300));await noOverflow(page);assert.ok(await pre.evaluate(el=>el.getBoundingClientRect().right<=innerWidth));await pre.evaluate((el,text)=>el.textContent=text,old);
 const dialog=await page.locator('#detail').boundingBox();assert.equal(dialog.width,width);assert.equal(dialog.height,844);await page.locator('#detail').evaluate(el=>el.scrollTop=el.scrollHeight);const close=await page.locator('#close-detail').boundingBox();assert.ok(close.y>=0&&close.y+close.height<=844);await page.screenshot({path:new URL(`${width}-detail.png`,out).pathname});await page.locator('#close-detail').click();
 await page.locator('#next-day').click();await loaded();assert.match(await page.locator('#content').innerText(),/该交易日暂无投递内容，生产者最近运行见上方状态/);await page.locator('#prev-day').click();await loaded();assert.equal(await page.locator('[name=day]').inputValue(),'2026-11-01');
 await page.locator('#by-published').click();await loaded();assert.equal(await page.locator('#content article').count(),1);assert.match(await page.locator('#content').innerText(),/2026-11-01/);
 for(let i=0;i<7;i++){await page.locator('#tab-'+i).click();await loaded();measurements.push({tab:i,...await noOverflow(page)});await touchSizes(page);const selected=await page.locator('nav [aria-selected=true]').boundingBox();assert.ok(selected.x>=0&&selected.x+selected.width<=width+1);}
 await page.locator('#tab-0').click();await loaded();await page.screenshot({path:new URL(`${width}-overview.png`,out).pathname});assert.deepEqual(errors,[]);results.push({width,height:844,passed:true,measurements,checks:['Markdown DOM/XSS/links','结构化signals','响应body_md与data_raw逐字复制（mock）','Clipboard降级/恢复文案','纵向筛选/前后日','状态折叠','全屏sheet/关闭','计数/空态','今日发布','7Tab scrollWidth<=视口','可见触控目标宽高>=40px','长JSON不撑宽']});await context.close();
}
 const desktop=await browser.newPage({viewport:{width:1200,height:900}});
 const content=Array.from({length:60},(_,i)=>({...item,id:'demo-'+i,from:i%2?'muse':'codex'}));
 await desktop.route('**/v1/**',async route=>{const u=new URL(route.request().url());let data;
 if(u.pathname==='/v1/feed')data=u.searchParams.has('cursor')?{items:content.slice(50),next_cursor:null}:{items:[...content.slice(0,50),{...item,id:'hb',type:'system_heartbeat'}],next_cursor:'fixture-next'};
 else if(u.pathname==='/v1/health/producers')data={producers:[{from:'codex',producer:'manual',state:'fresh'}]};else data={items:[]};await route.fulfill({json:data});});
 const done=()=>desktop.waitForFunction(()=>document.querySelector('#feedback').textContent.startsWith('已加载'));
 await desktop.goto('http://127.0.0.1:8787/?day=2026-11-01&tab='+encodeURIComponent('时间流'));await done();assert.match(await desktop.locator('#feedback').innerText(),/已加载 50 条/);assert.match(await desktop.locator('[name=from]').innerText(),/全部来源 · 60/);assert.match(await desktop.locator('[name=from]').innerText(),/codex · 30/);await desktop.locator('#more').click();assert.match(await desktop.locator('#feedback').innerText(),/已加载 60 条/);await desktop.locator('[name=from]').selectOption('codex');await done();assert.match(await desktop.locator('#feedback').innerText(),/已加载 30 条/);assert.equal(await desktop.locator('.health').isVisible(),true);assert.ok((await desktop.locator('.health').boundingBox()).height>40);await noOverflow(desktop);await desktop.close();results.push({desktop:true,passed:true,checks:['跨API分页汇总来源计数','heartbeat不计入60条内容','本地50条展示分页','来源筛选30条','桌面状态卡片保留']});

 if(process.env.LOCAL_FIXTURE_CHECK==='1'){
  const real=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});let captured;await real.exposeFunction('captureCopy',value=>captured=value);await real.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>window.captureCopy(value)}}));
  await real.goto('http://127.0.0.1:8787/?day=2026-11-03');await real.waitForFunction(()=>document.querySelector('#feedback').textContent.startsWith('已加载'));
  const detail=await real.evaluate(async()=>await(await fetch('/v1/feed/90000000-0000-4000-8000-000000000001')).json());
  assert.equal(detail.data_raw,'{"open": 51, "high": 52, "low": 49, "close": 50, "change_pct": -2, "volume": 10000, "volume_ratio": 1}');
  await real.locator('article').filter({has:real.getByRole('heading',{name:detail.title,exact:true})}).filter({hasText:detail.from+' / '+detail.producer}).getByRole('button',{name:'查看详情',exact:true}).click();await real.getByRole('button',{name:'复制原文',exact:true}).click();assert.equal(captured,detail.body_md);await real.getByRole('button',{name:'复制数据',exact:true}).click();assert.equal(captured,detail.data_raw);await noOverflow(real);await real.screenshot({path:new URL('390-local-d1-detail.png',out).pathname});await real.close();results.push({localD1:true,passed:true,checks:['真实本地详情接口保留fixture JSON空格','body_md经真实接口到Clipboard逐字相同','data_raw经真实接口到Clipboard逐字相同']});
 }
 await writeFile(new URL('results.json',out),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));}finally{await browser.close();}
