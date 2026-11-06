// 日期差只比较登记日期与上海今日，不换算事件时区的具体发生时刻。
export function shanghaiDay(now=new Date()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftDay(day,delta){const date=new Date(day+'T00:00:00Z');date.setUTCDate(date.getUTCDate()+delta);return date.toISOString().slice(0,10);}
export function daysUntil(day,today){return Math.round((Date.parse(day+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);}
export function countdown(day,today){const n=daysUntil(day,today);return n===0?'今天':n===1?'明天':n>1?`还有 ${n} 天`:`已过 ${-n} 天`;}
const ordered=rows=>[...rows].sort((a,b)=>a.event_date.localeCompare(b.event_date)||a.id.localeCompare(b.id));
export function eventModel(data,{today,mode,day}){
 const end=shiftDay(today,30),start=shiftDay(today,-7);
 const rows=ordered(data.items.filter(e=>mode==='day'?e.event_date===day:e.event_date>=today&&e.event_date<=end));
 const groups=[];for(const row of rows){let group=groups.at(-1);if(group?.day!==row.event_date){group={day:row.event_date,items:[]};groups.push(group);}group.items.push(row);}
 return {groups,nearest:ordered(data.future.filter(e=>e.event_date>=today))[0]??null,recent:ordered(data.recent.filter(e=>e.event_date>=start&&e.event_date<today))};
}
export async function loadEvents(api,signal,{today,mode,day}){
 const query=range=>'/v1/events?'+new URLSearchParams(range);
 const range=mode==='day'?{from:day,to:day}:{from:today,to:shiftDay(today,30)};
 const [current,past]=await Promise.all([api(query(range),signal),api(query({from:shiftDay(today,-7),to:shiftDay(today,-1)}),signal)]);
 // 只有当前范围为空才读全部未来登记，用于寻找 30 天外最近的一条。
 const future=current.items.length?[]:(await api(query({from:today}),signal)).items;
 return {items:current.items,recent:past.items,future};
}
export function renderEvents(parent,data,options){
 const {today,mode,day}=options,model=eventModel(data,options);
 const add=(parent,tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const card=(parent,event,past=false)=>{const c=add(parent,'article',null,'card event-card'+(past?' event-past':''));add(c,'span',countdown(event.event_date,today),'badge event-countdown');add(c,'span',({high:'重要',normal:'一般',low:'低'})[event.importance]||event.importance||'一般','badge event-importance '+(event.importance==='high'?'high':''));add(c,'h3',event.title);add(c,'p',`${event.symbol||event.market||'全局'} · ${event.event_date} · ${event.event_type}`,'event-meta');add(c,'p',`登记时区 ${event.timezone||'Asia/Shanghai'} · ${past?'已过':event.status}`,'meta');if(event.description)add(c,'p',event.description);if(event.source_url){try{const url=new URL(event.source_url);if(['http:','https:'].includes(url.protocol)){const a=add(c,'a','事件来源');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}}catch{}}return c;};
 if(!model.groups.length){add(parent,'p',mode==='day'?`${day} 暂无已登记事件`:'未来 30 天暂无已登记事件','empty');if(model.nearest){const box=add(parent,'section',null,'event-next');add(box,'h3','最近的未来事件');card(box,model.nearest);}}
 for(const group of model.groups){const section=add(parent,'section',null,'event-day');add(section,'h3',group.day,'event-date');for(const event of group.items)card(section,event,event.event_date<today);}
 if(model.recent.length){const details=add(parent,'details',null,'event-history');add(details,'summary',`近 7 天已过事件 · ${model.recent.length} 条`);for(const event of model.recent)card(details,event,true);}
 return model;
}
