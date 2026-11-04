// 手动视觉验收工具；Playwright 可装在临时目录，通过 PLAYWRIGHT_MODULE 指向其 index.mjs。
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const stage=process.env.VISUAL_STAGE||'mobile';
const output=new URL(`../docs/screenshots/${stage}/`,import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'zh-CN',timezoneId:'Asia/Shanghai'});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const tabs=['总览','时间流','持仓','技术面','事件','提醒','指令'];
const results=[];
async function loaded(){await page.waitForFunction(()=>document.querySelector('#feedback').textContent.startsWith('已加载'));}
async function screenshot(name){await page.screenshot({path:new URL(name+'.png',output).pathname});}
async function noOverflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'不应横向溢出');}
try {
 for(const [mode,port]of [['filled',8787],['empty',8788]]){
  for(const [i,tab]of tabs.entries()){
   await page.goto(`http://127.0.0.1:${port}/?day=2026-11-03&tab=${encodeURIComponent(tab)}`);await loaded();await noOverflow();
   assert.equal(await page.locator('h2').textContent(),tab);
   const selected=await page.locator('nav [aria-selected=true]').boundingBox();assert.ok(selected.x>=0&&selected.x+selected.width<=390,'深链接的当前 Tab 应保持可见');
   for(const selector of ['#filters input[name=day]','#filters select[name=from]','#filters input[name=q]','#filters button']){
    const box=await page.locator(selector).boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390,selector+' 应在屏内');
   }
   await screenshot(`${mode}-${i}-top`);
   await page.locator('#panel').scrollIntoViewIfNeeded();await screenshot(`${mode}-${i}-content`);
   if(mode==='empty')assert.match(await page.locator('#content').innerText(),/待 AI POST|尚未录入|暂无已登记|未启用/);
   results.push({mode,tab,viewport:'390×844',overflow:false});
  }
 }
 await page.goto('http://127.0.0.1:8787/?day=2026-11-03&tab='+encodeURIComponent('总览'));await loaded();
 assert.ok(await page.locator('.partial').count());assert.ok(await page.locator('.unretrieved').count());assert.ok(await page.locator('.health.stale').count());
 await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await page.locator('#top').waitFor({state:'visible'});
 const box=await page.locator('#top').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,'回顶完整位于手机视口');
 await screenshot('back-to-top');await page.locator('#top').click();await page.waitForFunction(()=>window.scrollY<2);
 await page.locator('#tab-1').click();await loaded();await page.locator('#filters select[name=from]').selectOption('codex');await loaded();
 assert.equal(await page.locator('#content article').count(),1);assert.match(await page.locator('#content article').innerText(),/codex/);await screenshot('agent-filter');
 await page.goBack();await loaded();assert.equal(await page.locator('#filters select[name=from]').inputValue(),'');
 await page.locator('#filters input[name=q]').fill('不会匹配的虚构查询');await page.locator('#filters button').click();await loaded();assert.match(await page.locator('#content').innerText(),/暂无内容/);
 await page.route('**/v1/feed?*',route=>route.fulfill({status:500,contentType:'application/json',body:'{}'}));await page.locator('#reload').click();await page.locator('#feedback.error').waitFor();await page.locator('#panel').scrollIntoViewIfNeeded();await screenshot('request-error');await page.unroute('**/v1/feed?*');await page.locator('#reload').click();await loaded();
 assert.deepEqual(errors,[]);
 await writeFile(new URL('results.json',output),JSON.stringify({stage,viewport:{width:390,height:844},tabs:results,back_to_top:box,checks:['筛选条无横溢','逐Tab空态','回顶按钮屏内且可点击','agent过滤与URL回退','partial/unretrieved/断供','HTTP错误与重试'],pageErrors:errors},null,2)+'\n');
 console.log(`PASS ${stage}: 7 Tabs × 有数据/空态，390×844，回顶/筛选/错误重试。`);
}finally{await browser.close();}
